// Translation resources for src/components/secondary-panel/** and
// src/components/git-diff/**. Not yet wired into src/lib/i18n.ts's
// EN_TRANSLATION/ZH_TRANSLATION resource bundles — every call site passes
// its English text as the i18next `defaultValue`, so the app renders
// identically before and after this namespace is merged in.
export const en = {
  secondaryPanel: {
    threadStorageFileTree: {
      ariaLabel: "Thread storage file tree",
    },
    browserNewTabScreen: {
      recentlyVisited: "Recently visited",
      clear: "Clear",
      clearRecentlyVisited: "Clear recently visited",
    },
    terminalHostSelector: {
      machine: "Machine",
      loading: "Loading…",
      noMachines: "No machines",
      offline: "Offline",
    },
    launcherRow: {
      open: "open",
    },
    threadStorageBrowser: {
      loadingFiles: "Loading files...",
      failedToLoad: "Failed to load thread storage",
      noFilesYet: "No files yet.",
      noFilesMatchSearch: "No files match search.",
      searchFiles: "Search files",
      closeSearch: "Close search",
    },
    browserFindBar: {
      findInPage: "Find in page",
      findInPageWithShortcut: "Find in page ({{shortcut}})",
      previousMatch: "Previous match",
      nextMatch: "Next match",
      closeFindBar: "Close find bar",
    },
    threadStorageFilePreview: {
      previewNotAvailable: "Preview not available for {{mimeType}}.",
    },
    gitDiff: {
      diffFileCard: {
        binaryFile: "Binary file.",
        changedLinesCount: "{{changedLines}} changed lines.",
        loadDiff: "Load diff",
        loadError: "Failed to load this file's diff.",
        retry: "Retry",
        tooLarge: "Too large to display ({{changedLines}} changed lines).",
        openFile: "Open file",
        noRenderableDiff: "No renderable diff for this file.",
        truncated: "This diff was truncated for display.",
        showFullDiff: "Show full diff",
      },
    },
    gitDiffToolbar: {
      truncatedFilesLabel: {
        one: "{{count}}+ file",
        other: "{{count}}+ files",
      },
      truncatedSummaryTitle: {
        template:
          "Showing the first {{filesCount}} changed {{fileWord}}; shown slice: {{insertions}} {{insertionWord}}, {{deletions}} {{deletionWord}}",
        fileWord: { one: "file", other: "files" },
        insertionWord: { one: "insertion", other: "insertions" },
        deletionWord: { one: "deletion", other: "deletions" },
      },
      shownSeparator: " · shown ",
      expandAllFilesLabel: "Expand all files",
      collapseAllFilesLabel: "Collapse all files",
      disableLineWrapLabel: "Disable diff line wrap",
      wrapLinesLabel: "Wrap diff lines",
      diffViewModeGroupLabel: "Diff view mode",
      stackedDiffViewLabel: "Stacked diff view",
      splitDiffViewLabel: "Split diff view",
    },
    tabContent: {
      gitDiff: {
        loadError: "Failed to load git diff",
        noDiffToDisplay: "No diff to display.",
        workspaceUnavailable: "Workspace unavailable",
        truncatedBanner:
          "Showing the first {{count}} changed files. Additional changes are omitted.",
      },
    },
    tabStrip: {
      scrollLeft: "Scroll tabs left",
      scrollRight: "Scroll tabs right",
      closeTab: "Close {{label}}",
    },
    sidebarSplitContainer: {
      panelTabFallback: "Panel tab",
      groupTabHere: "Group tab here",
      splitLeft: "Split left",
      splitRight: "Split right",
      splitTop: "Split top",
      splitBottom: "Split bottom",
      resizeHorizontal: "Resize right panel panes",
      resizeVertical: "Resize stacked right panel panes",
    },
    browserTabContent: {
      chrome: {
        goBack: "Go back",
        goForward: "Go forward",
        stopLoading: "Stop loading",
        reload: "Reload",
        openInExternalBrowser: "Open in external browser",
        navRegionLabel: "Browser navigation",
        secureConnection: "Secure connection",
        insecureConnection: "Connection not secure",
        addressPlaceholder: "Enter a URL",
        addressBarLabel: "Address and search bar",
      },
      unavailable: {
        title: "Browser tabs need the desktop app",
        description:
          "The in-app web browser runs in the vozen desktop app. Open this thread there to browse the web.",
      },
      pageLoadError: {
        serverNotReachableTitle: "Server not reachable",
        pageBlockedTitle: "Page blocked",
        pageUnavailableTitle: "Page unavailable",
        unreachableMessage:
          "The browser could not reach {{host}}. Start the server, then reload.",
        thisLocalServer: "this local server",
        genericMessage:
          "The browser could not load this page. Try reloading or opening it externally.",
        reload: "Reload",
        openExternally: "Open externally",
      },
    },
    threadMetadataContent: {
      parent: {
        label: "Parent",
        fallbackThreadLabel: "Parent thread",
        noneLabel: "None",
        clearAriaLabel: "Clear parent thread",
        assignMenuLabel: "Assign parent thread",
        loadingThreads: "Loading threads…",
        retryLoadingThreads: "Retry loading threads",
      },
      forks: { label: "Forks" },
      environment: {
        label: "Environment",
        hostTitleConnected: "On {{name}} (connected)",
        hostTitleOffline: "On {{name}} (offline)",
        offlineSuffix: " (offline)",
        createThreadInWorktree: "Create new thread in this worktree",
      },
      workspacePath: {
        label: "Directory",
        copyLabel: "Copy directory",
        copySuccess: "Directory copied",
        copyError: "Failed to copy directory",
      },
      branch: {
        copyValueFallbackLabel: "Copy checkout value",
        copySuccessFallback: "Value copied",
        copyErrorFallback: "Failed to copy value",
      },
      pullRequest: {
        label: "Pull request",
        ariaLabel: "Pull request {{number}}: {{label}}",
      },
      mergeBase: { label: "Merge base" },
      gitStatus: { label: "Git status" },
      archived: { label: "Archived" },
      commits: {
        label: "Commits",
        copyShaAriaLabel: "Copy commit {{shortSha}} SHA",
        copySuccess: "Commit SHA copied",
        copyError: "Failed to copy commit SHA",
      },
      storage: {
        label: "Thread storage",
        searchAriaLabel: "Search files",
      },
    },
    newTabFileSearch: {
      sections: { actions: "Actions", files: "Files", recent: "Recent" },
      source: { workspace: "Workspace", threadStorage: "Thread storage" },
      search: {
        placeholder: "Search files",
        placeholderUnavailable: "No searchable source",
        ariaLabel: "Search files",
        ariaLabelWithShortcut: "Search files ({{shortcut}})",
        unavailableMessage: "No searchable source is available.",
      },
      results: {
        ariaLabel: "File search results",
        noResults: "No results match your search.",
        typeToSearch: "Type to search files.",
        searchFailed: "Search failed.",
        searching: "Searching files...",
      },
      recentEmptyHint: "Plans, mockups, and files you open will show up here.",
      showMore: { showLess: "Show less", showMoreCount: "Show {{count}} more" },
      actions: { openBrowser: "Open browser", startTerminal: "Start terminal" },
    },
    filePreview: {
      emptyFile: "Empty file.",
      notFound: "File not found.",
      loadError: "Failed to load file",
      header: {
        refresh: { idle: "Refresh file", refreshing: "Refreshing file" },
        copy: {
          csv: "Copy CSV",
          markdown: "Copy markdown",
          html: "Copy HTML source",
          default: "Copy file contents",
        },
        openExternal: "Open in external browser",
        openInEditor: {
          default: "Open in editor",
          withShortcut: "Open in editor ({{shortcut}})",
        },
        toggle: {
          ariaLabel: {
            csv: "CSV view mode",
            html: "HTML view mode",
            markdown: "Markdown view mode",
          },
          preview: "Preview",
          raw: "Raw",
        },
        lineWrap: { enable: "Wrap lines", disable: "Disable line wrap" },
        copyPath: {
          label: "Copy file path",
          success: "File path copied",
          error: "Failed to copy file path",
        },
      },
      csv: {
        tableAriaLabel: "{{fileName}} CSV preview",
        columnFallback: "Column {{index}}",
        truncation: {
          rows: "{{rowCount}} rows",
          columns: "{{columnCount}} columns",
          note: "Showing the first {{parts}}.",
        },
      },
      iframe: { loadError: "Failed to load HTML preview." },
    },
    threadSecondaryPanel: {
      hidePanel: "Hide right panel",
      rightPanelViews: "Right panel views",
      noFilePreviewContent: "No file preview content provided.",
      gitDetectionError: "Could not determine whether this workspace uses Git.",
      retry: "Retry",
      checkingGitSupport: "Checking Git support…",
      panelViewUnavailable: "This panel view is unavailable.",
      openNewTab: "Open new tab",
      resizeThreadAndRightPanel: "Resize thread and right panel",
    },
  },
  gitDiff: {
    cardHeader: {
      rawToggle: {
        showPreview: "Show image preview for {{fileLabel}}",
        showRaw: "Show raw SVG diff for {{fileLabel}}",
      },
      toggle: {
        expand: "Expand {{label}}",
        collapse: "Collapse {{label}}",
        noChanges: "{{label}} has no changes to expand",
      },
      copyPath: "Copy path for {{label}}",
      openInEditor: "Open {{label}} in editor",
    },
    cardBody: {
      imagePreview: {
        old: "Old",
        new: "New",
        noPreview: "No preview available for this image.",
        altOld: "{{fileDiffLabel}} (old)",
        altNew: "{{fileDiffLabel}} (new)",
        lightboxTitle: "{{fileDiffLabel}} image preview",
      },
      deletedFile: {
        message: "This file was deleted.",
        loadButton: "Load diff",
      },
      contextExpansion: {
        loading: "Loading context…",
        error: "Couldn't load surrounding context.",
        expandButton: "Expand context",
        retryButton: "Retry",
      },
    },
  },
};

export const zh: typeof en = {
  secondaryPanel: {
    threadStorageFileTree: {
      ariaLabel: "会话存储文件树",
    },
    browserNewTabScreen: {
      recentlyVisited: "最近访问",
      clear: "清除",
      clearRecentlyVisited: "清除最近访问记录",
    },
    terminalHostSelector: {
      machine: "机器",
      loading: "加载中…",
      noMachines: "暂无机器",
      offline: "离线",
    },
    launcherRow: {
      open: "打开",
    },
    threadStorageBrowser: {
      loadingFiles: "正在加载文件...",
      failedToLoad: "加载会话存储失败",
      noFilesYet: "暂无文件。",
      noFilesMatchSearch: "没有匹配搜索的文件。",
      searchFiles: "搜索文件",
      closeSearch: "关闭搜索",
    },
    browserFindBar: {
      findInPage: "在页面中查找",
      findInPageWithShortcut: "在页面中查找（{{shortcut}}）",
      previousMatch: "上一个匹配项",
      nextMatch: "下一个匹配项",
      closeFindBar: "关闭查找栏",
    },
    threadStorageFilePreview: {
      previewNotAvailable: "{{mimeType}} 类型暂不支持预览。",
    },
    gitDiff: {
      diffFileCard: {
        binaryFile: "二进制文件。",
        changedLinesCount: "{{changedLines}} 处变更。",
        loadDiff: "加载差异",
        loadError: "加载该文件的差异失败。",
        retry: "重试",
        tooLarge: "文件过大，无法显示（{{changedLines}} 处变更）。",
        openFile: "打开文件",
        noRenderableDiff: "该文件没有可渲染的差异。",
        truncated: "此差异因过长已被截断显示。",
        showFullDiff: "查看完整差异",
      },
    },
    gitDiffToolbar: {
      truncatedFilesLabel: {
        one: "{{count}}+ 个文件",
        other: "{{count}}+ 个文件",
      },
      truncatedSummaryTitle: {
        template:
          "显示前 {{filesCount}} 个变更文件；已显示部分：{{insertions}} 处新增，{{deletions}} 处删除",
        fileWord: { one: "个文件", other: "个文件" },
        insertionWord: { one: "处新增", other: "处新增" },
        deletionWord: { one: "处删除", other: "处删除" },
      },
      shownSeparator: " · 已显示 ",
      expandAllFilesLabel: "展开所有文件",
      collapseAllFilesLabel: "折叠所有文件",
      disableLineWrapLabel: "关闭差异行换行",
      wrapLinesLabel: "自动换行差异行",
      diffViewModeGroupLabel: "差异视图模式",
      stackedDiffViewLabel: "堆叠视图",
      splitDiffViewLabel: "分栏视图",
    },
    tabContent: {
      gitDiff: {
        loadError: "加载 Git 差异失败",
        noDiffToDisplay: "暂无可显示的差异。",
        workspaceUnavailable: "工作区不可用",
        truncatedBanner: "仅显示前 {{count}} 个变更文件，其余变更已省略。",
      },
    },
    tabStrip: {
      scrollLeft: "向左滚动标签页",
      scrollRight: "向右滚动标签页",
      closeTab: "关闭 {{label}}",
    },
    sidebarSplitContainer: {
      panelTabFallback: "面板标签页",
      groupTabHere: "在此处合并标签页",
      splitLeft: "向左拆分",
      splitRight: "向右拆分",
      splitTop: "向上拆分",
      splitBottom: "向下拆分",
      resizeHorizontal: "调整右侧面板窗格大小",
      resizeVertical: "调整堆叠的右侧面板窗格大小",
    },
    browserTabContent: {
      chrome: {
        goBack: "后退",
        goForward: "前进",
        stopLoading: "停止加载",
        reload: "刷新",
        openInExternalBrowser: "在外部浏览器中打开",
        navRegionLabel: "浏览器导航",
        secureConnection: "安全连接",
        insecureConnection: "连接不安全",
        addressPlaceholder: "输入网址",
        addressBarLabel: "地址和搜索栏",
      },
      unavailable: {
        title: "浏览器标签页需要桌面客户端",
        description:
          "应用内网页浏览器运行在 vozen 桌面客户端中。请在该客户端中打开此会话以浏览网页。",
      },
      pageLoadError: {
        serverNotReachableTitle: "无法连接到服务器",
        pageBlockedTitle: "页面已被拦截",
        pageUnavailableTitle: "页面不可用",
        unreachableMessage: "浏览器无法连接到 {{host}}。请先启动服务器，然后刷新。",
        thisLocalServer: "本地服务器",
        genericMessage: "浏览器无法加载此页面。请尝试刷新，或在外部浏览器中打开。",
        reload: "刷新",
        openExternally: "在外部打开",
      },
    },
    threadMetadataContent: {
      parent: {
        label: "父级",
        fallbackThreadLabel: "父会话",
        noneLabel: "无",
        clearAriaLabel: "清除父会话",
        assignMenuLabel: "分配父会话",
        loadingThreads: "正在加载会话…",
        retryLoadingThreads: "重试加载会话",
      },
      forks: { label: "分支" },
      environment: {
        label: "环境",
        hostTitleConnected: "位于 {{name}}（已连接）",
        hostTitleOffline: "位于 {{name}}（离线）",
        offlineSuffix: "（离线）",
        createThreadInWorktree: "在此工作树中创建新会话",
      },
      workspacePath: {
        label: "目录",
        copyLabel: "复制目录",
        copySuccess: "目录已复制",
        copyError: "复制目录失败",
      },
      branch: {
        copyValueFallbackLabel: "复制检出值",
        copySuccessFallback: "值已复制",
        copyErrorFallback: "复制值失败",
      },
      pullRequest: {
        label: "拉取请求",
        ariaLabel: "拉取请求 {{number}}：{{label}}",
      },
      mergeBase: { label: "合并基准" },
      gitStatus: { label: "Git 状态" },
      archived: { label: "已归档" },
      commits: {
        label: "提交",
        copyShaAriaLabel: "复制提交 {{shortSha}} 的 SHA",
        copySuccess: "提交 SHA 已复制",
        copyError: "复制提交 SHA 失败",
      },
      storage: {
        label: "会话存储",
        searchAriaLabel: "搜索文件",
      },
    },
    newTabFileSearch: {
      sections: { actions: "操作", files: "文件", recent: "最近" },
      source: { workspace: "工作区", threadStorage: "会话存储" },
      search: {
        placeholder: "搜索文件",
        placeholderUnavailable: "没有可搜索的来源",
        ariaLabel: "搜索文件",
        ariaLabelWithShortcut: "搜索文件（{{shortcut}}）",
        unavailableMessage: "没有可用的可搜索来源。",
      },
      results: {
        ariaLabel: "文件搜索结果",
        noResults: "没有匹配的搜索结果。",
        typeToSearch: "输入以搜索文件。",
        searchFailed: "搜索失败。",
        searching: "正在搜索文件…",
      },
      recentEmptyHint: "计划、原型图和已打开的文件都会显示在这里。",
      showMore: { showLess: "收起", showMoreCount: "显示更多（{{count}}）" },
      actions: { openBrowser: "打开浏览器", startTerminal: "启动终端" },
    },
    filePreview: {
      emptyFile: "空文件。",
      notFound: "文件未找到。",
      loadError: "文件加载失败",
      header: {
        refresh: { idle: "刷新文件", refreshing: "正在刷新文件" },
        copy: {
          csv: "复制 CSV",
          markdown: "复制 Markdown",
          html: "复制 HTML 源码",
          default: "复制文件内容",
        },
        openExternal: "在外部浏览器中打开",
        openInEditor: {
          default: "在编辑器中打开",
          withShortcut: "在编辑器中打开（{{shortcut}}）",
        },
        toggle: {
          ariaLabel: {
            csv: "CSV 视图模式",
            html: "HTML 视图模式",
            markdown: "Markdown 视图模式",
          },
          preview: "预览",
          raw: "原始文本",
        },
        lineWrap: { enable: "自动换行", disable: "取消自动换行" },
        copyPath: {
          label: "复制文件路径",
          success: "文件路径已复制",
          error: "复制文件路径失败",
        },
      },
      csv: {
        tableAriaLabel: "{{fileName}} CSV 预览",
        columnFallback: "第 {{index}} 列",
        truncation: {
          rows: "{{rowCount}} 行",
          columns: "{{columnCount}} 列",
          note: "仅显示前 {{parts}}。",
        },
      },
      iframe: { loadError: "HTML 预览加载失败。" },
    },
    threadSecondaryPanel: {
      hidePanel: "隐藏右侧面板",
      rightPanelViews: "右侧面板视图",
      noFilePreviewContent: "未提供文件预览内容。",
      gitDetectionError: "无法确定该工作区是否使用 Git。",
      retry: "重试",
      checkingGitSupport: "正在检查 Git 支持…",
      panelViewUnavailable: "此面板视图不可用。",
      openNewTab: "打开新标签页",
      resizeThreadAndRightPanel: "调整对话区与右侧面板大小",
    },
  },
  gitDiff: {
    cardHeader: {
      rawToggle: {
        showPreview: "显示 {{fileLabel}} 的图片预览",
        showRaw: "显示 {{fileLabel}} 的原始 SVG 差异",
      },
      toggle: {
        expand: "展开 {{label}}",
        collapse: "折叠 {{label}}",
        noChanges: "{{label}} 没有可展开的变更",
      },
      copyPath: "复制 {{label}} 的路径",
      openInEditor: "在编辑器中打开 {{label}}",
    },
    cardBody: {
      imagePreview: {
        old: "旧",
        new: "新",
        noPreview: "该图片暂无预览。",
        altOld: "{{fileDiffLabel}}（旧）",
        altNew: "{{fileDiffLabel}}（新）",
        lightboxTitle: "{{fileDiffLabel}} 图片预览",
      },
      deletedFile: {
        message: "此文件已被删除。",
        loadButton: "加载差异",
      },
      contextExpansion: {
        loading: "正在加载上下文…",
        error: "无法加载周围上下文。",
        expandButton: "展开上下文",
        retryButton: "重试",
      },
    },
  },
};
