export const en = {
  views: {
    threadDetail: {
      paneMaximizeButton: {
        moveLeft: "Move left",
        moveRight: "Move right",
        moveTop: "Move top",
        moveBottom: "Move bottom",
        exitFullScreen: "Exit Full Screen",
        fullScreen: "Full Screen",
        move: "Move",
        paneArrangement: "Pane arrangement",
        movePane: "Move pane",
      },
      secondaryPanelHost: {
        hideRightPanel: "Hide right panel",
        showRightPanel: "Show right panel",
        resizeRightPanel: "Resize right panel",
        emptyPanelMessage: "This pane has no right panel.",
      },
      header: {
        hideRightPanel: "Hide right panel",
        showRightPanel: "Show right panel",
        childPill: "child",
        sideChatPill: "side chat",
        closePane: "Close pane",
      },
      secondaryContent: {
        noDetailsAvailable: "No thread details available.",
        drawerLabel: "Thread details",
      },
      splitThreadArea: {
        pane: {
          newThreadTitle: "New thread",
          closeButtonLabel: "Close pane",
        },
      },
      promptArea: {
        composer: {
          stoppingThreadPlaceholder: "Stopping thread...",
        },
        errors: {
          queueMessageFailed: "Failed to queue message",
          sendMessageFailed: "Failed to send message",
        },
        execution: {
          handoffToNewThread: "Handoff to new thread",
        },
        sentMessageEditor: {
          stopEditingLabel: "Stop editing sent message",
          editingLabel: "Editing message",
          editMessagePlaceholder: "Edit message",
          submitEditTitle: "Submit edit (Enter)",
        },
      },
      view: {
        common: {
          notFound: "Not found",
        },
        error: {
          failedToLoadThread: "Failed to load thread.",
        },
        hostConnection: {
          host: "Host",
          disconnectedReconnecting:
            "{{subject}} disconnected. Waiting for reconnection...",
          disconnected: "{{subject}} disconnected",
          waitingForReconnection: "Waiting for reconnection",
        },
        localFile: {
          openTargetLabel: "Open in {{label}}",
          failedToOpen: "Failed to open file locally",
          storagePathUnavailable: "Thread storage path is not available yet.",
          contextMenu: {
            openIn: "Open in",
            openWithBuiltInPreview: "Open with built-in preview",
            openWithPlugin: "Open with {{title}}",
            copyFilePath: "Copy file path",
            copyFilePathSuccess: "File path copied",
            copyFilePathError: "Failed to copy file path",
            copyFileName: "Copy file name",
            copyFileNameSuccess: "File name copied",
            copyFileNameError: "Failed to copy file name",
          },
        },
        secondaryPanel: {
          threadInfoAriaLabel: "Show thread info panel",
          threadInfoLabel: "Info",
          threadInfoTitle: "Thread info",
          diffAriaLabel: "Show diff panel",
          diffLabel: "Diff",
          diffTitle: "Diff",
        },
        pullRequest: {
          markingReady: "Marking pull request ready",
          readyResponseError: "Expected pull request ready action response.",
          updateFailedTitle: "Failed to update pull request",
          updateFailedFallback: "Pull request was not updated",
          convertingToDraft: "Converting pull request to draft",
          draftResponseError: "Expected pull request draft action response.",
          mergeMerging: "Merging pull request",
          mergeSquashing: "Squash merging pull request",
          mergeRebasing: "Rebase merging pull request",
          mergeResponseError: "Expected pull request merge action response.",
          mergeFailedTitle: "Failed to merge pull request",
          mergeFailedFallback: "Pull request was not merged",
        },
        thread: {
          assignParentFailed: "Failed to assign parent thread.",
          editSessionExpired: "The message being edited is no longer available.",
          editMessageFailed: "Failed to edit the message",
        },
        workspace: {
          openInTargetLabel: "Open workspace in {{label}}",
        },
        tabs: {
          browserFallback: "Browser",
          terminalFallback: "Terminal",
          newTab: "New tab",
        },
      },
    },
    authCallback: {
      success: {
        title: "Authentication completed",
        message: "You can close this window.",
      },
      error: {
        title: "Authentication failed",
        message: "Something went wrong. Please close this window and try again.",
      },
    },
    pluginPanel: {
      unavailable:
        "This plugin panel is not available. The plugin may have been disabled or removed.",
    },
    rootCompose: {
      emptyWelcome: {
        importProjectsPrompt:
          "Search my home directory (max depth 3) for git repositories touched in the last 30 days and import only those projects into vozen using the cli",
        learnPrompt:
          "What can vozen do, and how can you (my agent) interact with it? Summarize vozen's capabilities and how you'd use the vozen CLI to work with threads and projects.",
        newThread: {
          title: "New thread",
          description: "Start a new conversation",
        },
        importProjects: {
          title: "Automatically import my projects",
          description: "Find repos touched in the last 30 days",
        },
        newProject: {
          title: "New project",
          description: "Create one from a local folder",
        },
        learn: {
          title: "Learn what vozen can do",
          description: "Get a tour of its capabilities",
        },
      },
      secondaryContent: {
        rightPanel: "Right panel",
      },
      mobileRecents: {
        openThread: "Open {{title}}{{indicatorSuffix}}",
        recent: "Recent",
        creatingThread: "Creating thread",
      },
      view: {
        rightPanelToggle: {
          hide: "Hide right panel",
          show: "Show right panel",
        },
        panelTabs: {
          browserFallback: "Browser",
          terminalFallback: "Terminal",
          newTab: "New tab",
        },
        metadataPanel: {
          noThreadDetails: "No thread details available.",
        },
        fork: {
          forkingLabel: "Forking {{title}}",
          cancelAriaLabel: "Cancel fork",
        },
        errors: {
          failedToLoadProjects: "Failed to load projects.",
        },
        providerCli: {
          updateBeforeStarting: "Update {{provider}} before starting a thread.",
        },
      },
    },
    projectSettings: {
      addOnAMachine: "Add on a machine",
      alreadyAdded: "Already added",
      offline: "Offline",
      addLocalPath: "Add local path",
      title: "Project Sources",
      loading: "Loading…",
      noSourcesConfigured: "No sources configured.",
    },
    tools: {
      toggleError: "Failed to {{action}} plugin",
      deleteError: "Failed to delete plugin",
      removedToast: "Plugin removed from vozen",
      uninstalledToast: "Plugin uninstalled",
      loadError: "Couldn't load plugin.",
      loadingPlugin: "Loading plugin",
      installedLoadError: "Couldn't load the installed plugin.",
      notFound: "Plugin not found.",
      confirmRemoveTitle: "Remove plugin from vozen?",
      confirmUninstallTitle: "Uninstall plugin?",
    },
    machineSettings: {
      primaryRemoveDisabledReason: "vozen's primary machine can't be removed.",
      permissionLimit: {
        title: "Permission limit",
        description:
          "Highest permission mode any thread on the selected machine may run with. Threads that ask for more resolve down to it, and a provider that supports nothing this low can't run here.",
      },
      status: {
        online: "Online",
        offline: "Offline",
        lastSeen: "last seen {{time}}",
        paired: "paired {{time}}",
      },
      loading: "Loading…",
      backToMachines: "Machines",
      notPaired: "Machine is no longer paired.",
      badge: {
        thisMachine: "This machine",
        primary: "Primary",
      },
      actionsMenuLabel: "{{name}} actions",
      actionsMenu: {
        rename: "Rename",
      },
      permissionLimitError: "Couldn't change the permission limit for {{name}}.",
      providerClis: {
        title: "Provider CLIs",
        installedLabel: "Installed",
        unavailableOffline: "Unavailable while offline",
        checking: "Checking…",
        statusUnavailable: "Status unavailable",
        noneInstalled: "None installed",
        toFix: "{{count}} to fix",
      },
      machineInfo: {
        title: "Machine information",
        projectsLabel: "Projects",
        none: "None",
        updatesLabel: "Updates",
        upToDate: "Up to date",
        retryRequested: "Update retry requested for {{name}}",
        retrying: "Retrying…",
        retryUpdate: "Retry update",
      },
      dangerZone: {
        title: "Danger zone",
        description:
          "Revokes {{name}}'s access to this server. Project checkouts stay on its disk.",
        removeMachine: "Remove machine",
      },
      renameError: "Couldn't rename the machine.",
      removeDialog: {
        title: "Remove {{name}}?",
        description:
          "This revokes {{name}}'s access to this server. Project checkouts stay on its disk, but its environments become read-only history and it can't run new work until it's paired again.",
      },
      removeError: "Couldn't remove {{name}}.",
    },
  },
};

export const zh: typeof en = {
  views: {
    threadDetail: {
      paneMaximizeButton: {
        moveLeft: "左移",
        moveRight: "右移",
        moveTop: "上移",
        moveBottom: "下移",
        exitFullScreen: "退出全屏",
        fullScreen: "全屏",
        move: "移动",
        paneArrangement: "窗格排列",
        movePane: "移动窗格",
      },
      secondaryPanelHost: {
        hideRightPanel: "隐藏右侧面板",
        showRightPanel: "显示右侧面板",
        resizeRightPanel: "调整右侧面板大小",
        emptyPanelMessage: "此窗格没有右侧面板。",
      },
      header: {
        hideRightPanel: "隐藏右侧面板",
        showRightPanel: "显示右侧面板",
        childPill: "子会话",
        sideChatPill: "旁支会话",
        closePane: "关闭窗格",
      },
      secondaryContent: {
        noDetailsAvailable: "暂无会话详情。",
        drawerLabel: "会话详情",
      },
      splitThreadArea: {
        pane: {
          newThreadTitle: "新会话",
          closeButtonLabel: "关闭面板",
        },
      },
      promptArea: {
        composer: {
          stoppingThreadPlaceholder: "正在停止线程…",
        },
        errors: {
          queueMessageFailed: "消息加入队列失败",
          sendMessageFailed: "消息发送失败",
        },
        execution: {
          handoffToNewThread: "交接给新线程",
        },
        sentMessageEditor: {
          stopEditingLabel: "停止编辑已发送的消息",
          editingLabel: "正在编辑消息",
          editMessagePlaceholder: "编辑消息",
          submitEditTitle: "提交编辑（回车）",
        },
      },
      view: {
        common: {
          notFound: "未找到",
        },
        error: {
          failedToLoadThread: "加载会话失败。",
        },
        hostConnection: {
          host: "主机",
          disconnectedReconnecting: "{{subject}} 已断开连接，正在等待重新连接…",
          disconnected: "{{subject}} 已断开连接",
          waitingForReconnection: "正在等待重新连接",
        },
        localFile: {
          openTargetLabel: "在 {{label}} 中打开",
          failedToOpen: "本地打开文件失败",
          storagePathUnavailable: "会话存储路径尚不可用。",
          contextMenu: {
            openIn: "打开方式",
            openWithBuiltInPreview: "用内置预览打开",
            openWithPlugin: "用 {{title}} 打开",
            copyFilePath: "复制文件路径",
            copyFilePathSuccess: "文件路径已复制",
            copyFilePathError: "复制文件路径失败",
            copyFileName: "复制文件名",
            copyFileNameSuccess: "文件名已复制",
            copyFileNameError: "复制文件名失败",
          },
        },
        secondaryPanel: {
          threadInfoAriaLabel: "显示会话信息面板",
          threadInfoLabel: "信息",
          threadInfoTitle: "会话信息",
          diffAriaLabel: "显示差异面板",
          diffLabel: "差异",
          diffTitle: "差异",
        },
        pullRequest: {
          markingReady: "正在将拉取请求标记为就绪",
          readyResponseError: "预期应返回拉取请求就绪操作的响应。",
          updateFailedTitle: "更新拉取请求失败",
          updateFailedFallback: "拉取请求未被更新",
          convertingToDraft: "正在将拉取请求转换为草稿",
          draftResponseError: "预期应返回拉取请求草稿操作的响应。",
          mergeMerging: "正在合并拉取请求",
          mergeSquashing: "正在压缩合并拉取请求",
          mergeRebasing: "正在变基合并拉取请求",
          mergeResponseError: "预期应返回拉取请求合并操作的响应。",
          mergeFailedTitle: "合并拉取请求失败",
          mergeFailedFallback: "拉取请求未被合并",
        },
        thread: {
          assignParentFailed: "分配父会话失败。",
          editSessionExpired: "正在编辑的消息已不可用。",
          editMessageFailed: "编辑消息失败",
        },
        workspace: {
          openInTargetLabel: "在 {{label}} 中打开工作区",
        },
        tabs: {
          browserFallback: "浏览器",
          terminalFallback: "终端",
          newTab: "新标签页",
        },
      },
    },
    authCallback: {
      success: {
        title: "认证已完成",
        message: "你可以关闭此窗口了。",
      },
      error: {
        title: "认证失败",
        message: "出了点问题，请关闭此窗口后重试。",
      },
    },
    pluginPanel: {
      unavailable: "该插件面板不可用，插件可能已被禁用或移除。",
    },
    rootCompose: {
      emptyWelcome: {
        importProjectsPrompt:
          "在我的主目录中搜索（最大深度 3）最近 30 天有变动的 git 仓库，并使用 cli 只导入这些项目到 vozen 中",
        learnPrompt:
          "vozen 能做什么，你（我的智能体）又该如何与它交互？总结一下 vozen 的能力，以及你会如何用 vozen CLI 来处理线程和项目。",
        newThread: {
          title: "新建线程",
          description: "开始一段新对话",
        },
        importProjects: {
          title: "自动导入我的项目",
          description: "查找最近 30 天有变动的仓库",
        },
        newProject: {
          title: "新建项目",
          description: "从本地文件夹创建一个项目",
        },
        learn: {
          title: "了解 vozen 能做什么",
          description: "快速了解它的功能",
        },
      },
      secondaryContent: {
        rightPanel: "右侧面板",
      },
      mobileRecents: {
        openThread: "打开 {{title}}{{indicatorSuffix}}",
        recent: "最近",
        creatingThread: "正在创建线程",
      },
      view: {
        rightPanelToggle: {
          hide: "隐藏右侧面板",
          show: "显示右侧面板",
        },
        panelTabs: {
          browserFallback: "浏览器",
          terminalFallback: "终端",
          newTab: "新建标签页",
        },
        metadataPanel: {
          noThreadDetails: "暂无会话详情。",
        },
        fork: {
          forkingLabel: "正在分支 {{title}}",
          cancelAriaLabel: "取消分支",
        },
        errors: {
          failedToLoadProjects: "加载项目失败。",
        },
        providerCli: {
          updateBeforeStarting: "开始会话前请先更新 {{provider}}。",
        },
      },
    },
    projectSettings: {
      addOnAMachine: "在某台机器上添加",
      alreadyAdded: "已添加",
      offline: "离线",
      addLocalPath: "添加本地路径",
      title: "项目来源",
      loading: "加载中…",
      noSourcesConfigured: "尚未配置任何来源。",
    },
    tools: {
      toggleError: "{{action}} 插件失败",
      deleteError: "删除插件失败",
      removedToast: "插件已从 vozen 中移除",
      uninstalledToast: "插件已卸载",
      loadError: "无法加载插件。",
      loadingPlugin: "正在加载插件",
      installedLoadError: "无法加载已安装的插件。",
      notFound: "未找到该插件。",
      confirmRemoveTitle: "从 vozen 中移除该插件？",
      confirmUninstallTitle: "卸载该插件？",
    },
    machineSettings: {
      primaryRemoveDisabledReason: "vozen 的主机器无法移除。",
      permissionLimit: {
        title: "权限上限",
        description:
          "所选机器上任何线程可运行的最高权限模式。要求更高权限的线程会降到这一级，若某个 provider 连这个最低权限都不支持，则无法在此运行。",
      },
      status: {
        online: "在线",
        offline: "离线",
        lastSeen: "最后在线 {{time}}",
        paired: "配对于 {{time}}",
      },
      loading: "加载中…",
      backToMachines: "机器",
      notPaired: "该机器已不再配对。",
      badge: {
        thisMachine: "本机",
        primary: "主机器",
      },
      actionsMenuLabel: "{{name}} 操作",
      actionsMenu: {
        rename: "重命名",
      },
      permissionLimitError: "无法修改 {{name}} 的权限上限。",
      providerClis: {
        title: "Provider CLI",
        installedLabel: "已安装",
        unavailableOffline: "离线时不可用",
        checking: "检查中…",
        statusUnavailable: "状态不可用",
        noneInstalled: "未安装任何 CLI",
        toFix: "{{count}} 项待修复",
      },
      machineInfo: {
        title: "机器信息",
        projectsLabel: "项目",
        none: "无",
        updatesLabel: "更新",
        upToDate: "已是最新",
        retryRequested: "已为 {{name}} 发起重试更新",
        retrying: "重试中…",
        retryUpdate: "重试更新",
      },
      dangerZone: {
        title: "危险操作区",
        description: "撤销 {{name}} 对此服务器的访问权限。项目检出内容仍保留在其磁盘上。",
        removeMachine: "移除机器",
      },
      renameError: "无法重命名该机器。",
      removeDialog: {
        title: "移除 {{name}}？",
        description:
          "此操作将撤销 {{name}} 对此服务器的访问权限。项目检出内容仍保留在其磁盘上，但其环境会变为只读历史记录，需重新配对后才能运行新任务。",
      },
      removeError: "无法移除 {{name}}。",
    },
  },
};
