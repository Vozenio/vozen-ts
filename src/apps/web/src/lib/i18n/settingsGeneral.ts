// Settings: File Preferences, General, Debug, and Experiments sections.
// Merged into the central i18next resources by src/lib/i18n.ts.

export const en = {
  settingsGeneral: {
    filePreferences: {
      title: "File Preferences",
      localEditorIntegration: "Local editor integration",
      setupGuide: "Setup guide",
      accessDenied:
        "Your browser blocked access to vozen on this device. Allow local network access for this site in browser settings, then reload vozen.",
      accessAvailable:
        "vozen couldn’t connect to its local editor helper. Make sure the vozen desktop app or CLI is running on this device, then retry. If it is already running, a remote browser origin may need to be configured.",
      accessDefault:
        "Connect this browser to vozen on this device so it can discover installed editors. vozen only contacts the local helper after you choose Enable; your browser may ask for local network access.",
      retrying: "Retrying…",
      enabling: "Enabling…",
      blocked: "Blocked",
      retry: "Retry",
      enable: "Enable",
      directoryDefault: {
        label: "Directory default",
        emptyDescription: "No local app can open directories.",
      },
      fileDefault: {
        label: "File default",
        emptyDescription: "No local app can open files.",
      },
      unavailable: "Unavailable",
    },
    general: {
      title: "General",
      navigateToThreadAfterCreate: "Navigate to threads on creation",
      richTextEditing: "Markdown formatting in prompt box",
      steerActiveThreadOnEnter: "Steer running threads on Enter",
      steerActiveThreadOnEnterDescription:
        "Use Enter to steer the current run and Command+Enter to queue a follow-up.",
      openLinksInAppBrowser: "Open links in the in-app browser",
      openLinksInAppBrowserDescription: "Open web links inside vozen.",
      rewriteLocalhostLinks: "Rewrite localhost links",
      rewriteLocalhostLinksDescription: "Point localhost links at this host.",
      streamerMode: "Streamer mode",
      streamerModeDescription:
        "Hide the custom models from config.json in every model picker, so a screen share does not show them.",
    },
    debug: {
      title: "Debug",
      unhandledProviderEvents: "Show unhandled provider events",
      unhandledProviderEventsDescription:
        "Show raw provider events vozen does not recognize. Development builds always show these events.",
    },
    experiments: {
      title: "Experiments",
      description: "Early features that are off by default. Opt in to try them.",
      changelogPreview: "Changelog preview",
      changelogPreviewDescription:
        "Show the latest release notes as a compact preview on the Updates page.",
      editMessages: "Edit messages",
      editMessagesDescription:
        "Edit a sent message and replace the conversation from that point. Workspace changes are kept.",
      mobileApp: "Mobile app",
      mobileAppDescription:
        "Pair the vozen mobile app over vozen connect: shows Add mobile device under Remote access and enables vozen connect machine-code.",
      providerSessionReaping: "Idle provider session release",
      providerSessionReapingDescription:
        "Release restorable provider sessions after 30 idle minutes. A change can take up to five minutes.",
      timelineWindowing: "Timeline windowing",
      timelineWindowingDescription:
        "Mount only nearby rows in long timelines and expanded timeline details.",
    },
  },
};

export const zh: typeof en = {
  settingsGeneral: {
    filePreferences: {
      title: "文件偏好",
      localEditorIntegration: "本地编辑器集成",
      setupGuide: "设置指南",
      accessDenied:
        "浏览器阻止了对本设备上 vozen 的访问。请在浏览器设置中允许本站点访问本地网络,然后重新加载 vozen。",
      accessAvailable:
        "vozen 无法连接到本地编辑器助手。请确认本设备上的 vozen 桌面应用或 CLI 正在运行,然后重试。如果已在运行,可能需要配置远程浏览器来源。",
      accessDefault:
        "将此浏览器连接到本设备上的 vozen,以便发现已安装的编辑器。只有在你选择“启用”后,vozen 才会联系本地助手;浏览器可能会请求本地网络访问权限。",
      retrying: "重试中…",
      enabling: "启用中…",
      blocked: "已阻止",
      retry: "重试",
      enable: "启用",
      directoryDefault: {
        label: "默认目录打开方式",
        emptyDescription: "没有本地应用可以打开目录。",
      },
      fileDefault: {
        label: "默认文件打开方式",
        emptyDescription: "没有本地应用可以打开文件。",
      },
      unavailable: "不可用",
    },
    general: {
      title: "通用",
      navigateToThreadAfterCreate: "创建后跳转到对话",
      richTextEditing: "在输入框中启用 Markdown 格式",
      steerActiveThreadOnEnter: "按 Enter 引导正在运行的对话",
      steerActiveThreadOnEnterDescription:
        "使用 Enter 引导当前运行,使用 Command+Enter 排队后续消息。",
      openLinksInAppBrowser: "在应用内浏览器中打开链接",
      openLinksInAppBrowserDescription: "在 vozen 内部打开网页链接。",
      rewriteLocalhostLinks: "重写 localhost 链接",
      rewriteLocalhostLinksDescription: "将 localhost 链接指向此主机。",
      streamerMode: "直播模式",
      streamerModeDescription:
        "在每个模型选择器中隐藏 config.json 中的自定义模型,这样屏幕共享时不会显示它们。",
    },
    debug: {
      title: "调试",
      unhandledProviderEvents: "显示未处理的提供方事件",
      unhandledProviderEventsDescription:
        "显示 vozen 无法识别的原始提供方事件。开发构建始终显示这些事件。",
    },
    experiments: {
      title: "实验功能",
      description: "默认关闭的早期功能,自愿开启试用。",
      changelogPreview: "更新日志预览",
      changelogPreviewDescription:
        "在“更新”页面以简洁预览的形式显示最新的发行说明。",
      editMessages: "编辑消息",
      editMessagesDescription:
        "编辑已发送的消息并从该处替换对话内容。工作区改动会被保留。",
      mobileApp: "移动端应用",
      mobileAppDescription:
        "通过 vozen connect 配对 vozen 移动端应用:会在“远程访问”下显示“添加移动设备”,并启用 vozen connect 的设备验证码。",
      providerSessionReaping: "释放空闲的提供方会话",
      providerSessionReapingDescription:
        "在空闲 30 分钟后释放可恢复的提供方会话。更改最多需要五分钟生效。",
      timelineWindowing: "时间线窗口化",
      timelineWindowingDescription:
        "在长时间线和展开的时间线详情中只挂载附近的行。",
    },
  },
};
