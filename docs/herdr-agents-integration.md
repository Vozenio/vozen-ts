# Herdr Agents 接入 vozen — 实施方案

状态:设计定稿,待实施。Phase 0(只读旁挂面板)已完成,详见第 6 节。

## 1. 最终效果

打开 vozen 网页,左侧 sidebar 原生 thread 列表旁多出 Herdr 正在管理的 agent(claude/codex 等),点进去走真实的
`/projects/:projectId/threads/:threadId` 路由,页面跟原生 thread 详情页一样——能看历史消息、能在输入框里发消息、
能看到对方的回复。已知 agent kind(claude/codex/qoder/pi/omp)显示干净的消息气泡;未知 kind 退回终端滚动记录展示。

## 2. 架构决策

**Herdr agent 不落 SQLite,只在内存里合成一个 Thread 形状的对象。**

理由:Herdr 自己的 `herdr agent list` 就是权威数据源(agent 存在与否、状态,全由 Herdr 决定),vozen 没必要把它再抄一份
进自己的数据库、维护自己的过期/同步逻辑。SQLite 落库、schema 迁移、`ThreadManager` 内部改造这些成本全部省掉,唯一代价
是 vozen server 重启后要重新从 `herdr agent list` 拉一次现状——可接受,因为 Herdr 本来就是 source of truth。

**@bb/domain 不改。** 合成对象只需要在运行时满足 `Thread`/`ThreadListEntry` 的 TS 类型形状(结构类型,不需要改共享包源码),
`bbShim.ts` 里现有的 `toBbThread`/`toBbThreadListEntry`/`sidebarBootstrap`(`src/apps/server/bbShim.ts:113/144/307`)
只需要"多喂一些数据源",不用碰 `@bb/domain`/`@bb/server-contract` 包本身。

## 3. 数据流

### 3.1 发现 + 状态(轮询,驱动 sidebar 状态点)

- 新增 `HerdrThreadRegistry`(建议路径 `src/apps/server/herdrThreadRegistry.ts`),内部计时器每 2s 调一次
  `listHerdrAgents()`(已实现,`src/plugins/provider_herdr/client.ts`)。
- 按 `paneId` diff 出:新出现的 agent → 分配合成 `threadId`(建议 `herdr:${paneId}` 或对 paneId 做 hash,保证同一个
  pane 重连后 id 稳定)、挂读取管道(见 3.2);消失的 agent → 拆管道、从列表移除。
- 状态字段(`agentStatus`/`revision`/`stateChangeSeq`)直接映射进合成 thread 的 status,驱动 sidebar 状态点和
  `hasPendingInteraction`(`blocked` → true)。

### 3.2 读(聊天内容)

按 `agent` kind 分两条路,来源:`herdr-mobile-relay` 的 `internal/conversation/reader.go`(纯读取逻辑,不是协议,
可以放心用 TypeScript 重新实现,不涉及抄 AGPL 代码)。

**已知 kind(claude/codex/qoder/pi/omp)**——读原生会话日志文件,不摸终端:

| kind | 日志根目录 | 文件名规则 | 定位方式 |
|---|---|---|---|
| claude | `~/.claude/projects/<slug>/` | `<sessionID>.jsonl` | 按 `agent_session.value` 在各 slug 子目录下找同名文件(`reader.go:189` `findProjectSession`) |
| codex | `~/.codex/sessions/YYYY/MM/DD/` | `rollout-*-<sessionID小写>.jsonl` | 按年/月/日目录降序找后缀匹配的文件(`reader.go:207` `findCodexSession`) |
| qoder | `~/.qoder/projects/<slug>/` | `<sessionID>.jsonl` | 同 claude |
| pi/omp | `~/.pi/agent/sessions/` / `~/.omp/agent/sessions/` | 按 `_` 分隔解析 | `reader.go:222` `resolvePathOrSession` |

`agent_session.value` 已经在 `herdr agent list`/`get` 的输出里(实测:本机 claude 会话输出
`"agent_session":{"agent":"claude","kind":"id","value":"3349a627-…"}`,这个 UUID 就是文件名)。

拿到路径后:
1. 只 tail 读文件尾部(建议参考 `reader.go` 的 16MB 上限,vozen 场景可以更小,比如 512KB),不用整文件读入。
2. 按行 `JSON.parse`,每种 kind 记录格式不同(claude: `{"type":"user"/"assistant","message":{"content":...}}`;
   codex: `{"type":"response_item","payload":{"type":"message","role":...}}`),映射成 `{role, text, tools}[]`。
3. `fs.watch(filePath)` 替代定时轮询——文件变化时触发重读(只重读尾部,不是整文件),比 herdr-mobile-relay 自己
   (纯轮询)还省一档。注意 `fs.watch` 在文件被写入过程中可能触发多次、也可能拿到不完整的最后一行,重读逻辑要
   容忍"最后一行 JSON.parse 失败就跳过,等下一次变化事件再读"。

**未知 kind**:退回 `readHerdrAgent(paneId, lines)`(已实现),定时轮询(没有等价的 watch 机制),前端按终端滚动
文本展示,不切消息气泡。

### 3.3 写(发消息)

`herdr agent prompt <paneId> "<text>"`,**不加 `--wait`**——对齐 `herdr-mobile-relay` 自己的做法
(`internal/herdr/client.go:689` `Prompt()`,发完立即返回,不同步等回复)。前端发送后立即渲染乐观的用户气泡,
真正的回复由 3.2 的 fs.watch/轮询发现新日志行后自然浮现,不依赖这次 HTTP 请求的返回值。

## 4. 具体改动清单

### 已完成(Phase 0,只读旁挂原型)

- `src/plugins/provider_herdr/schema.ts` — `HerdrAgentSnapshot` zod schema + `toHerdrAgentSnapshot` 转换器。
- `src/plugins/provider_herdr/client.ts` — `listHerdrAgents()` / `readHerdrAgent(paneId, lines)`,一次性 CLI exec。
- `src/plugins/provider_herdr/client.test.ts` + `__fixtures__/fake-herdr.ts` — 6 个测试,已过。
- `src/apps/server/http.ts` — `GET /api/herdr/agents`、`GET /api/herdr/agents/:paneId/read`(独立端点,只读)。
- `src/apps/web/src/views/HerdrAgentsView.tsx` + `App.tsx` 的 `/herdr` 路由 — 独立只读面板。

**这些会在 Phase 2/3 被 sidebar+thread 路由整合方案取代或收编**,详见下面。`/api/herdr/agents` 两个端点可以保留
作为调试用途;`/herdr` 独立页面接入原生 thread 路由后可以删除。

### 待实施

1. **`src/plugins/provider_herdr/sessionLog.ts`**(新):`resolveSessionLogPath(kind, sessionId)`(表 3.2 那五种 kind
   的路径解析)+ `readSessionLogTail(path, maxBytes)` + `parseSessionLog(kind, text): {role, text, tools}[]`。
2. **`src/plugins/provider_herdr/watcher.ts`**(新):包一层 `fs.watch`,debounce 一下(文件系统事件可能连续触发多次),
   变化时回调重读。
3. **`src/plugins/provider_herdr/client.ts`**(改):加 `sendHerdrPrompt(paneId, text, bin?)`,包
   `herdr agent prompt <paneId> "<text>"`,不等待。
4. **`src/apps/server/herdrThreadRegistry.ts`**(新):3.1 描述的发现/状态轮询循环 + 内存态 Map<paneId, {snapshot,
   entries, watcher}>。对外方法:`list()`、`get(threadId)`、`timeline(threadId)`、`send(threadId, text)`。
5. **`src/apps/server/bbShim.ts`**(改):`toBbThreadListEntry`/`toBbThread`/`sidebarBootstrap` 三个函数改成同时接受
   `HerdrThreadRegistry` 的合成 thread,和 `ThreadRow` 走同一套输出形状。
6. **`src/apps/server/http.ts`**(改):`/api/v1/threads`、`/api/v1/threads/:id`、`/api/v1/threads/:id/timeline`、
   `/api/v1/threads/:id/send`、`/api/v1/sidebar-bootstrap` 这几个路由里,`threadId` 命中 `herdr:` 前缀时查
   `HerdrThreadRegistry`,否则走原来的 `engine`(`ThreadManager`)。
7. **`src/apps/server/main.ts`**(改):启动时创建并跑起 `HerdrThreadRegistry`,传给 `createApp`。
8. **前端**:sidebar 渲染逻辑本身不用改(它已经是"数据驱动列表"),只要 `/api/v1/sidebar-bootstrap` 和
   `/api/v1/threads` 把 Herdr 合成 thread 混进返回数组即可自动出现。thread 详情页(`ThreadDetailView.tsx` 等)同理,
   只要 `/api/v1/threads/:id/timeline` 返回的 row 形状对,消息气泡会直接复用现成渲染逻辑。

## 5. 分阶段实施

- **Phase 1**:`sessionLog.ts`(先只做 claude+codex 两种 kind)+ `herdrThreadRegistry.ts` + `bbShim.ts`/`http.ts`
  接线,先用轮询读日志(不接 fs.watch),验证 sidebar + thread 详情页 + 发消息全链路能跑通。
- **Phase 2**:接入 `fs.watch`(`watcher.ts`),替换 Phase 1 的轮询读日志部分。
- **Phase 3**:补 qoder/pi/omp 三种 kind 的日志解析;未知 kind 的终端滚动兜底视图。
- **Phase 4(可选,先不做)**:接 Herdr 的 `[[events]] on = "pane.agent_status_changed"` 钩子,把 3.1 的状态轮询换成
  推送,减少 `herdr agent list` 的调用频率。

## 6. 风险 / 未决问题

- **sessionId 会变**:Claude 在 `/compact`、`/resume` 等场景可能换 session 文件,`herdr agent get` 拿到的
  `agent_session.value` 要每次状态轮询都重新读,不能只在首次发现时读一次缓存。
- **合成 threadId 的稳定性**:Herdr 重启、pane 被关闭重开,`paneId` 是否复用需要验证(`herdr-mobile-relay` 的
  `docs`/skill 提到"Closed tab and pane IDs are not reused"——如果这对 agent pane 也成立,`herdr:${paneId}` 作为
  threadId 是安全的,不会撞车)。
- **日志文件读到半行 JSON**:agent 正在写文件时 `fs.watch` 触发,最后一行可能不完整,`parseSessionLog` 必须容忍单行
  parse 失败并跳过,不能整段失败。
- **权限/信任边界**:vozen server 现在会读 `~/.claude`、`~/.codex` 等目录下的会话日志——这些本来就在同一台机器同一个
  用户下,信任边界没有变化(跟 `herdr-mobile-relay` 的 relay 进程一样,本机进程读本机文件)。
- **v1 不做**:Herdr 的 `blocked`(审批/等待输入)状态在 vozen UI 里怎么呈现(要不要做成审批按钮)先不做,只做状态
  文字提示;`agent send-keys` 等更底层控制也不做。

## 7. 参考

`herdr-mobile-relay` 源码位置(仅供理解逻辑,不直接搬代码,AGPL 协议下"重写思路"没问题,"抄代码"有 copyleft 义务,
见 `report.md` 第 7 节第 5 点):

- `internal/conversation/reader.go` — 会话日志定位 + 解析,3.2 节对应的全部逻辑来源。
- `internal/herdr/client.go:689` `Prompt()` — 发消息不等待的做法。
- `internal/herdr/client.go:780` `exec.Command` — CLI exec 包装模式,`provider_herdr/client.ts` 已经照这个思路写了。
