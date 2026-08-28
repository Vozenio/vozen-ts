export const en = {
  plugin: {
    appFileExternalNavigationDispatcher: {
      toast: {
        failedTitle: "Failed to open file externally",
        failedDescription: "The file target is not available on its declared host.",
      },
    },
    browseHero: {
      archetypeCards: {
        sectionTitle: "Start from an example",
        utilityTitle: "Explore plugin capabilities",
      },
      carousel: {
        ariaLabel: "What you can build with vozen plugins",
        headlineLead: "Turn vozen into",
        composingNoun: "whatever you need",
        tablistLabel: "Plugin examples",
        frameTitlePrefix: "vozen — ",
        frameBadge: "Plugin",
        composerPlaceholder: "Describe the plugin you want to build…",
      },
      miniAppScenes: {
        kanban: {
          columns: {
            todo: "Todo",
            inProgress: "In progress",
            review: "Review",
          },
        },
        dashboard: {
          stats: {
            deploys: "Deploys",
            openPRs: "Open PRs",
            ciPass: "CI pass",
          },
          throughput: "Throughput",
        },
        videoEditor: {
          tracks: {
            video: "Video",
            audio: "Audio",
            captions: "Captions",
          },
          launchVideo: "Launch video",
          firstCutTimestamp: "first cut · 00:42",
          captionsAndMusicAdded: "captions and music added",
          renderingFirstCut: "→ rendering first cut",
        },
        chiefOfStaff: {
          workingForYou: "Working for you",
          runningCount: "12 running",
          needsYou: "needs you",
          agentsSuffix: "agents",
        },
        prototypingLab: {
          names: {
            guided: "Guided",
            onePage: "One page",
            express: "Express",
          },
          checkoutFlow: "Checkout flow",
          prototypesCount: "3 prototypes",
          state: {
            ready: "ready",
            building: "building",
          },
          readyCount: "2 prototypes ready",
          compareSideBySide: "→ compare side by side",
        },
        inbox: {
          title: "Inbox",
          openCount: "9 open",
          kind: {
            bug: "bug",
            question: "question",
          },
          replyDrafted: "reply drafted",
          fixThreadOpened: "→ fix thread opened",
        },
      },
    },
    experimentalFileLink: {
      loading: "Loading…",
    },
    experimentalFileLinkMenu: {
      openPreview: "Open preview",
      openWith: "Open with",
      bbPreview: "vozen preview",
      openExternally: "Open externally",
      openIn: "Open in",
      copyFilePath: {
        label: "Copy file path",
        success: "File path copied",
        error: "Failed to copy file path",
      },
      copyFileName: {
        label: "Copy file name",
        success: "File name copied",
        error: "Failed to copy file name",
      },
    },
    management: {
      addPluginDialog: {
        description: {
          builtin: "Install this plugin, bundled with vozen.",
          npm: "Install this {{publisherLabel}} plugin from its listed npm package.",
          repository: "Install this {{publisherLabel}} plugin from its listed source repository.",
        },
        sourceRows: {
          npmPackage: "npm package",
          registry: "registry",
          repository: "repository",
          subdirectory: "subdirectory",
          ref: "ref",
          semverRange: "semver range",
          resolvesToTag: "resolves to tag",
          resolvesToCommit: "resolves to commit",
          notResolved: "not resolved",
        },
        thirdPartySource: {
          resolving: "Resolving the listed source…",
          resolveError: "Could not resolve this listing’s source:",
          listedByPrefix: "Listed by",
          listedBySuffix: ", a third-party marketplace that vozen does not review.",
          authorLabel: "author",
        },
        toastInstalled: "{{name}} installed",
        toastInstallFailed: "Installing the plugin failed",
        installTitle: "Install {{name}}?",
        addTitle: "Add plugin",
        descriptionAddPlugin: "Install from npm, a Git repository, or a local path.",
        descriptionThirdParty: "Install this plugin from the source its marketplace lists.",
        sourceInput: {
          placeholder: "https://github.com/owner/vozen-plugin-name",
          ariaLabel: "Plugin source",
          helper: "GitHub repository URL · npm:package[@version] · ./local/path",
        },
        installingProgressAriaLabel: "Installing plugin",
        cancelButton: "Cancel",
        installingButton: "Installing {{name}}…",
        installButton: "Install {{name}}",
      },
      browsePluginsTab: {
        createButton: {
          label: "Create a plugin",
          optionsAriaLabel: "Create a plugin options",
          installFromSource: "Install from source",
        },
        toolbar: {
          searchPlaceholder: "Search plugins",
          categoryLabel: "Category",
          sortByNameLabel: "Plugin name",
        },
        state: {
          cachedResults: "Showing cached catalog results because the latest search failed.",
          loadingMessage: "Loading plugins",
          unavailableMessage: "vozen's official plugins are unavailable.",
          noSearchMatches: "No plugins match this search.",
          noFilterMatches: "No plugins match these filters.",
        },
        thirdPartyMarketplaceBadge: "third-party marketplace",
        card: {
          toastUninstalled: "{{name}} uninstalled",
          toastUninstallFailed: "Uninstalling {{name}} failed",
          byline: "By: {{name}}",
          repositoryLinkAriaLabel: "Open {{name}} repository",
          repositoryLinkLabel: "repo",
          uninstallAccessibleLabel: "Uninstall {{name}}",
          installedTooltip: "Installed — uninstall {{name}}",
          installAccessibleLabel: "Install {{name}}",
          installTooltip: "Install {{name}}",
          openLabel: "Open {{name}} details",
        },
        confirmDialog: {
          title: "Uninstall {{name}}?",
          description: "The plugin, its installed files, and its settings, secrets, and schedules are removed from this vozen host.",
          confirmLabelPending: "Uninstalling…",
          confirmLabel: "Uninstall",
        },
      },
      checkPluginUpdatesButton: {
        toastCheckFailed: "Checking for plugin updates failed",
        checkingLabel: "Checking for updates…",
        checkLabel: "Check for updates",
        inlineLabel: "Check",
      },
      installedPluginsTab: {
        emptyState: "No plugins installed. Browse the catalog, create a plugin, or run vozen plugin install <source>.",
        toastToggleFailed: "{{action}} {{id}} failed",
        actions: {
          enabling: "Enabling",
          disabling: "Disabling",
          enable: "Enable",
          disable: "Disable",
        },
        row: {
          openLabel: "{{name}} plugin details",
          notRunningBadge: "not running",
          notRunningSuffix: " ({{status}}, not running)",
        },
      },
      ui: {
        fullTrustWarning: "Plugins run as full-trust code with access to your computer. Only install from sources you trust.",
        rollbackNote: "Your plugin data is snapshotted first — if {{toVersion}} fails to start, vozen restores {{fromVersion}} and its data automatically.",
      },
      rowSignal: {
        updateAvailable: "Update available",
        updateToVersion: "Update to {{version}}",
      },
      updatesCard: {
        toastUpdateFailed: "Updating {{name}} failed",
        toastRestoredDescription: "{{version}} was restored.",
        toastUpdated: "{{name}} updated",
        toastNowRunning: "Now running {{version}}.",
        toastAlreadyUpToDate: "{{name}} is already up to date",
        retryButtonAriaLabel: "Retry update to {{version}}",
        retryButtonLabel: "Retry",
        updateButtonAriaLabel: "Update {{name}} to {{version}}",
        updateButtonLabel: "Update",
        status: {
          updateFailedAriaLabel: "Update failed",
          couldNotActivate: "vozen couldn’t activate {{failedVersion}}. It restored {{currentVersion}} and its data.",
          needsAttentionAriaLabel: "Update needs attention",
          availableLabel: "Available",
          blockedAriaLabel: "Update blocked",
          notCompatible: "{{version}} isn’t compatible with this vozen.",
          remainsInstalled: "{{version}} remains installed. Keep using it and check again when a compatible plugin version is available.",
          otherRequirementsSummary: "Other requirements",
        },
      },
      updatePluginDialog: {
        toastUpdated: "{{name}} updated",
        toastNowRunning: "Now running {{version}}.",
        toastAlreadyUpToDate: "{{name}} is already up to date",
        toastUpdateFailed: "Updating {{name}} failed",
        currentlyLine: "Currently {{version}}",
        failed: {
          title: "Update failed",
          descriptionIncomplete: "The update couldn’t be completed.",
          descriptionFailedOn: "Failed on {{date}}.",
          couldNotActivate: "vozen couldn’t activate {{failedVersion}}. It restored {{currentVersion}} and its data.",
          technicalDetailsSummary: "Technical details",
          retryHintNoVersion: "The restored version can keep running. Try again when a compatible update becomes available.",
          retryHintWithVersion: "A compatible update to {{version}} is still available. Retry when you’re ready.",
          markedNote: "The plugin is marked “Update failed” in the installed list until an update succeeds.",
          retryButtonAriaLabel: "Retry update to {{version}}",
          retryButtonLabel: "Retry update",
        },
        closeButton: "Close",
        available: {
          title: "Update {{name}} to {{version}}?",
          compatibleLine: "Compatible with your vozen and plugin SDK",
          detailsSummary: "Details — source, versions",
          sourceLabel: "Source",
          currentLabel: "Current",
          candidateLabel: "Candidate",
          notNowButton: "Not now",
        },
        updateButton: "Update",
        blocked: {
          title: "Update {{name}} to {{version}}?",
          notCompatible: "{{version}} isn’t compatible with this vozen",
          detailsSummary: "Details",
          newestCompatibleLabel: "Newest compatible",
          newestCompatibleValue: "{{version}} — already installed",
          keepUsingNote: "Keep using {{version}} and check again when a compatible plugin version is available.",
        },
        upToDate: {
          title: "{{name}} is up to date",
        },
      },
    },
    composerActions: {
      morePluginActions: "More plugin actions",
      pluginActionFailed: "Plugin action failed",
    },
    pendingInteractionComposer: {
      dismissLabel: {
        cancel: "Cancel",
        stopTurn: "Stop turn",
      },
      attribution: {
        requestedBy: "Requested by ",
        askedThrough: "The agent asks through ",
      },
      crashFallback: {
        message: "The plugin form crashed. {{dismissLabel}} to continue.",
      },
      unavailable: {
        message: "The plugin form is unavailable. {{dismissLabel}} to continue.",
      },
    },
    panelActions: {
      unavailableActionTab: {
        message: "This plugin tab is not available. The plugin may still be loading, or it has been disabled or removed.",
      },
      unavailableFileOpenerTab: {
        message: "This file opener is not available. The plugin may still be loading, or it has been disabled or removed — reopen the file to use the built-in preview.",
      },
    },
    panelRightPanelHost: {
      tabs: {
        browser: {
          fallbackLabel: "Browser",
        },
        terminal: {
          fallbackLabel: "Terminal",
        },
        newTab: {
          label: "New tab",
        },
      },
      toggle: {
        hideLabel: "Hide right panel",
        showLabel: "Show right panel",
      },
      drawerLabel: "Right panel",
    },
    navSidebarItems: {
      extensionsRow: {
        title: "Extensions",
      },
      overflowToggle: {
        label: "More ({{count}})",
      },
      visibilityMenuItem: {
        show: "Show in sidebar",
        hide: "Hide from sidebar",
      },
      row: {
        openInSplitLabel: "{{title}} — open in split",
        optionsLabel: "{{title}} panel options",
      },
    },
    settings: {
      field: {
        selectPlaceholder: "Select…",
        selectProjectPlaceholder: "Select a project…",
        secretSet: "[set]",
        secretNotSet: "[not set]",
      },
      toast: {
        saveSuccess: "Plugin settings saved",
        saveError: "Saving plugin settings failed",
      },
      form: {
        saveButton: "Save settings",
        secretBadge: "secret",
      },
      page: {
        loading: "Loading plugin settings…",
        notInstalled: "This plugin is not installed.",
        configurationLabel: "Configuration",
        pluginDetailsLabel: "Plugin details",
        detailsLinkPrefix: "Release, capabilities, and health live on",
        detailsLinkText: "its plugin page",
      },
      detail: {
        unavailableWhileStatus: "Settings are unavailable while the plugin is {{status}}.",
        enableToEdit: "Enable this plugin to edit its settings.",
      },
    },
    slotMount: {
      crashedChip: "plugin {{pluginId}} crashed",
    },
    overview: {
      actions: {
        newPlugin: "New plugin",
        installFromSource: "Install from source",
      },
      toolbar: {
        searchPlaceholder: "Search installed plugins",
        typeFilterLabel: "Type",
        sortByNameLabel: "Plugin name",
      },
      list: {
        loadError: "Couldn't load plugins.",
        loading: "Loading plugins",
        emptyFiltered: "No plugins match these filters.",
        emptySearchWithFilters: "No plugins match \"{{query}}\" with these filters.",
        emptySearch: "No plugins match \"{{query}}\"",
      },
    },
    threadChat: {
      environment: {
        workingLocally: "Working locally",
        local: "Local",
      },
      threadUnavailable: "This thread is no longer available.",
    },
  },
};

export const zh: typeof en = {
  plugin: {
    appFileExternalNavigationDispatcher: {
      toast: {
        failedTitle: "外部打开文件失败",
        failedDescription: "该文件目标在其声明的宿主上不可用。",
      },
    },
    browseHero: {
      archetypeCards: {
        sectionTitle: "从示例开始",
        utilityTitle: "探索插件能力",
      },
      carousel: {
        ariaLabel: "你可以用 vozen 插件构建什么",
        headlineLead: "把 vozen 变成",
        composingNoun: "你需要的一切",
        tablistLabel: "插件示例",
        frameTitlePrefix: "vozen — ",
        frameBadge: "插件",
        composerPlaceholder: "描述你想构建的插件…",
      },
      miniAppScenes: {
        kanban: {
          columns: {
            todo: "待办",
            inProgress: "进行中",
            review: "评审中",
          },
        },
        dashboard: {
          stats: {
            deploys: "部署次数",
            openPRs: "待处理 PR",
            ciPass: "CI 通过率",
          },
          throughput: "吞吐量",
        },
        videoEditor: {
          tracks: {
            video: "视频",
            audio: "音频",
            captions: "字幕",
          },
          launchVideo: "发布视频",
          firstCutTimestamp: "初剪 · 00:42",
          captionsAndMusicAdded: "已添加字幕和音乐",
          renderingFirstCut: "→ 正在渲染初剪",
        },
        chiefOfStaff: {
          workingForYou: "正在为你工作",
          runningCount: "12 个运行中",
          needsYou: "需要你处理",
          agentsSuffix: "个 agent",
        },
        prototypingLab: {
          names: {
            guided: "引导式",
            onePage: "单页式",
            express: "极简版",
          },
          checkoutFlow: "结账流程",
          prototypesCount: "3 个原型",
          state: {
            ready: "已就绪",
            building: "构建中",
          },
          readyCount: "2 个原型已就绪",
          compareSideBySide: "→ 并排对比",
        },
        inbox: {
          title: "收件箱",
          openCount: "9 个待处理",
          kind: {
            bug: "缺陷",
            question: "疑问",
          },
          replyDrafted: "回复已起草",
          fixThreadOpened: "→ 已开启修复会话",
        },
      },
    },
    experimentalFileLink: {
      loading: "加载中…",
    },
    experimentalFileLinkMenu: {
      openPreview: "打开预览",
      openWith: "打开方式",
      bbPreview: "vozen 预览",
      openExternally: "在外部打开",
      openIn: "打开位置",
      copyFilePath: {
        label: "复制文件路径",
        success: "文件路径已复制",
        error: "复制文件路径失败",
      },
      copyFileName: {
        label: "复制文件名",
        success: "文件名已复制",
        error: "复制文件名失败",
      },
    },
    management: {
      addPluginDialog: {
        description: {
          builtin: "安装此插件，已随 vozen 内置。",
          npm: "从 {{publisherLabel}} 列出的 npm 包安装此插件。",
          repository: "从 {{publisherLabel}} 列出的源代码仓库安装此插件。",
        },
        sourceRows: {
          npmPackage: "npm 包",
          registry: "注册表",
          repository: "仓库",
          subdirectory: "子目录",
          ref: "ref",
          semverRange: "semver 版本范围",
          resolvesToTag: "解析到的标签",
          resolvesToCommit: "解析到的提交",
          notResolved: "未解析",
        },
        thirdPartySource: {
          resolving: "正在解析列出的源…",
          resolveError: "无法解析该列表项的源：",
          listedByPrefix: "由",
          listedBySuffix: " 列出，这是一个未经 vozen 审核的第三方应用市场。",
          authorLabel: "作者",
        },
        toastInstalled: "{{name}} 已安装",
        toastInstallFailed: "安装插件失败",
        installTitle: "安装 {{name}}？",
        addTitle: "添加插件",
        descriptionAddPlugin: "从 npm、Git 仓库或本地路径安装。",
        descriptionThirdParty: "从其应用市场列出的源安装此插件。",
        sourceInput: {
          placeholder: "https://github.com/owner/vozen-plugin-name",
          ariaLabel: "插件源",
          helper: "GitHub 仓库 URL · npm:package[@version] · ./本地路径",
        },
        installingProgressAriaLabel: "正在安装插件",
        cancelButton: "取消",
        installingButton: "正在安装 {{name}}…",
        installButton: "安装 {{name}}",
      },
      browsePluginsTab: {
        createButton: {
          label: "创建插件",
          optionsAriaLabel: "创建插件选项",
          installFromSource: "从源安装",
        },
        toolbar: {
          searchPlaceholder: "搜索插件",
          categoryLabel: "分类",
          sortByNameLabel: "插件名称",
        },
        state: {
          cachedResults: "由于最近一次搜索失败，正在显示缓存的目录结果。",
          loadingMessage: "正在加载插件",
          unavailableMessage: "vozen 官方插件当前不可用。",
          noSearchMatches: "没有插件匹配此搜索。",
          noFilterMatches: "没有插件匹配这些筛选条件。",
        },
        thirdPartyMarketplaceBadge: "第三方应用市场",
        card: {
          toastUninstalled: "{{name}} 已卸载",
          toastUninstallFailed: "卸载 {{name}} 失败",
          byline: "作者：{{name}}",
          repositoryLinkAriaLabel: "打开 {{name}} 的仓库",
          repositoryLinkLabel: "仓库",
          uninstallAccessibleLabel: "卸载 {{name}}",
          installedTooltip: "已安装 — 卸载 {{name}}",
          installAccessibleLabel: "安装 {{name}}",
          installTooltip: "安装 {{name}}",
          openLabel: "查看 {{name}} 详情",
        },
        confirmDialog: {
          title: "卸载 {{name}}？",
          description: "该插件及其已安装的文件、设置、密钥和计划任务都将从此 vozen 主机中移除。",
          confirmLabelPending: "正在卸载…",
          confirmLabel: "卸载",
        },
      },
      checkPluginUpdatesButton: {
        toastCheckFailed: "检查插件更新失败",
        checkingLabel: "正在检查更新…",
        checkLabel: "检查更新",
        inlineLabel: "检查",
      },
      installedPluginsTab: {
        emptyState: "尚未安装任何插件。浏览插件目录、创建插件，或运行 vozen plugin install <source>。",
        toastToggleFailed: "{{action}} {{id}} 失败",
        actions: {
          enabling: "启用",
          disabling: "停用",
          enable: "启用",
          disable: "停用",
        },
        row: {
          openLabel: "{{name}} 插件详情",
          notRunningBadge: "未运行",
          notRunningSuffix: "（{{status}}，未运行）",
        },
      },
      ui: {
        fullTrustWarning: "插件以完全受信任代码的身份运行，可访问你的计算机。请仅从你信任的来源安装。",
        rollbackNote: "系统会先为插件数据创建快照 — 如果 {{toVersion}} 启动失败，vozen 会自动恢复到 {{fromVersion}} 及其数据。",
      },
      rowSignal: {
        updateAvailable: "有可用更新",
        updateToVersion: "更新到 {{version}}",
      },
      updatesCard: {
        toastUpdateFailed: "更新 {{name}} 失败",
        toastRestoredDescription: "已恢复到 {{version}}。",
        toastUpdated: "{{name}} 已更新",
        toastNowRunning: "当前运行版本为 {{version}}。",
        toastAlreadyUpToDate: "{{name}} 已是最新版本",
        retryButtonAriaLabel: "重试更新到 {{version}}",
        retryButtonLabel: "重试",
        updateButtonAriaLabel: "将 {{name}} 更新到 {{version}}",
        updateButtonLabel: "更新",
        status: {
          updateFailedAriaLabel: "更新失败",
          couldNotActivate: "vozen 未能激活 {{failedVersion}}，已恢复到 {{currentVersion}} 及其数据。",
          needsAttentionAriaLabel: "更新需要关注",
          availableLabel: "可用",
          blockedAriaLabel: "更新受阻",
          notCompatible: "{{version}} 与当前 vozen 不兼容。",
          remainsInstalled: "{{version}} 仍保持安装状态。请继续使用，并在有兼容的插件版本时再次检查。",
          otherRequirementsSummary: "其他要求",
        },
      },
      updatePluginDialog: {
        toastUpdated: "{{name}} 已更新",
        toastNowRunning: "当前运行版本为 {{version}}。",
        toastAlreadyUpToDate: "{{name}} 已是最新版本",
        toastUpdateFailed: "更新 {{name}} 失败",
        currentlyLine: "当前版本 {{version}}",
        failed: {
          title: "更新失败",
          descriptionIncomplete: "更新未能完成。",
          descriptionFailedOn: "失败于 {{date}}。",
          couldNotActivate: "vozen 未能激活 {{failedVersion}}，已恢复到 {{currentVersion}} 及其数据。",
          technicalDetailsSummary: "技术细节",
          retryHintNoVersion: "已恢复的版本可以继续运行。等有兼容的更新可用时再试。",
          retryHintWithVersion: "仍有一个兼容的更新可用，版本为 {{version}}。准备好后可重试。",
          markedNote: "在更新成功之前，该插件在已安装列表中会标记为“更新失败”。",
          retryButtonAriaLabel: "重试更新到 {{version}}",
          retryButtonLabel: "重试更新",
        },
        closeButton: "关闭",
        available: {
          title: "将 {{name}} 更新到 {{version}}？",
          compatibleLine: "与你的 vozen 及插件 SDK 兼容",
          detailsSummary: "详情 — 来源、版本",
          sourceLabel: "来源",
          currentLabel: "当前版本",
          candidateLabel: "候选版本",
          notNowButton: "暂不更新",
        },
        updateButton: "更新",
        blocked: {
          title: "将 {{name}} 更新到 {{version}}？",
          notCompatible: "{{version}} 与当前 vozen 不兼容",
          detailsSummary: "详情",
          newestCompatibleLabel: "最新兼容版本",
          newestCompatibleValue: "{{version}} — 已安装",
          keepUsingNote: "请继续使用 {{version}}，并在有兼容的插件版本时再次检查。",
        },
        upToDate: {
          title: "{{name}} 已是最新版本",
        },
      },
    },
    composerActions: {
      morePluginActions: "更多插件操作",
      pluginActionFailed: "插件操作失败",
    },
    pendingInteractionComposer: {
      dismissLabel: {
        cancel: "取消",
        stopTurn: "停止本轮",
      },
      attribution: {
        requestedBy: "请求方：",
        askedThrough: "由以下插件代为请求：",
      },
      crashFallback: {
        message: "插件表单已崩溃。点击「{{dismissLabel}}」以继续。",
      },
      unavailable: {
        message: "插件表单当前不可用。点击「{{dismissLabel}}」以继续。",
      },
    },
    panelActions: {
      unavailableActionTab: {
        message: "此插件标签页当前不可用。插件可能仍在加载，或已被禁用或移除。",
      },
      unavailableFileOpenerTab: {
        message: "此文件打开方式当前不可用。插件可能仍在加载，或已被禁用或移除——请重新打开文件以使用内置预览。",
      },
    },
    panelRightPanelHost: {
      tabs: {
        browser: {
          fallbackLabel: "浏览器",
        },
        terminal: {
          fallbackLabel: "终端",
        },
        newTab: {
          label: "新建标签页",
        },
      },
      toggle: {
        hideLabel: "隐藏右侧面板",
        showLabel: "显示右侧面板",
      },
      drawerLabel: "右侧面板",
    },
    navSidebarItems: {
      extensionsRow: {
        title: "扩展",
      },
      overflowToggle: {
        label: "更多（{{count}}）",
      },
      visibilityMenuItem: {
        show: "在侧边栏中显示",
        hide: "从侧边栏隐藏",
      },
      row: {
        openInSplitLabel: "{{title}} — 在分屏中打开",
        optionsLabel: "{{title}} 面板选项",
      },
    },
    settings: {
      field: {
        selectPlaceholder: "请选择…",
        selectProjectPlaceholder: "请选择项目…",
        secretSet: "[已设置]",
        secretNotSet: "[未设置]",
      },
      toast: {
        saveSuccess: "插件设置已保存",
        saveError: "保存插件设置失败",
      },
      form: {
        saveButton: "保存设置",
        secretBadge: "密钥",
      },
      page: {
        loading: "正在加载插件设置…",
        notInstalled: "该插件尚未安装。",
        configurationLabel: "配置",
        pluginDetailsLabel: "插件详情",
        detailsLinkPrefix: "版本、功能与运行状态位于",
        detailsLinkText: "其插件页面",
      },
      detail: {
        unavailableWhileStatus: "插件处于 {{status}} 状态时设置不可用。",
        enableToEdit: "启用该插件后即可编辑其设置。",
      },
    },
    slotMount: {
      crashedChip: "插件 {{pluginId}} 已崩溃",
    },
    overview: {
      actions: {
        newPlugin: "新建插件",
        installFromSource: "从源码安装",
      },
      toolbar: {
        searchPlaceholder: "搜索已安装的插件",
        typeFilterLabel: "类型",
        sortByNameLabel: "插件名称",
      },
      list: {
        loadError: "无法加载插件。",
        loading: "正在加载插件",
        emptyFiltered: "没有插件符合这些筛选条件。",
        emptySearchWithFilters: "没有插件在这些筛选条件下匹配 \"{{query}}\"。",
        emptySearch: "没有插件匹配 \"{{query}}\"",
      },
    },
    threadChat: {
      environment: {
        workingLocally: "本地运行中",
        local: "本地",
      },
      threadUnavailable: "此会话已不再可用。",
    },
  },
};
