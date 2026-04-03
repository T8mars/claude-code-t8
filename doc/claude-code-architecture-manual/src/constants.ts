export interface Subsection {
  title: string;
  content: string;
  files?: string[];
}

export interface Section {
  id: string;
  title: string;
  icon: string;
  content: string;
  subsections?: Subsection[];
}

export const MANUAL_DATA: Section[] = [
  {
    id: "overall",
    title: "系统整体架构",
    icon: "Layout",
    content: "Claude Code 采用模块化设计，从用户输入的指令到最终的代码执行，形成了一个完整的智能闭环。",
    subsections: [
      {
        title: "核心组件概览",
        content: "• 入口层: 负责接收您的指令并解析意图\n• 初始化: 检查运行环境并启动必要服务\n• 交互界面: 基于终端的图形化操作体验\n• 编排中心: 系统的“大脑”，负责逻辑调度\n• 工具箱: 包含 30 多个强大的自动化工具\n• 智能代理: 负责具体任务的拆解与执行\n• 基础服务: 记忆系统、认证与外部集成\n• 状态管理: 实时维护系统的运行数据",
        files: ["src/entrypoints/cli.tsx", "src/main.tsx", "src/setup.ts"]
      },
      {
        title: "分层协作逻辑",
        content: "系统按照“接收 -> 思考 -> 执行 -> 反馈”的逻辑运行：\n1. 接收：理解您的自然语言需求。\n2. 思考：将大任务拆解为可执行的小步骤。\n3. 执行：调用文件读写、代码编辑等工具。\n4. 反馈：将执行结果实时展示在您的屏幕上。",
        files: ["src/QueryEngine.ts", "src/query.ts"]
      }
    ]
  },
  {
    id: "lifecycle",
    title: "任务处理流程",
    icon: "RefreshCw",
    content: "每一个指令都会经过 8 个关键步骤的处理，确保结果的准确性与安全性。",
    subsections: [
      {
        title: "执行流水线",
        content: "1. 接收输入: 获取您的原始指令\n2. 语义解析: 理解指令背后的真实意图\n3. 上下文收集: 自动寻找相关的代码文件\n4. AI 调度: 与大模型进行深度沟通\n5. 工具识别: 确定需要执行的具体操作\n6. 安全检查: 确保操作不会破坏您的系统\n7. 自动化执行: 在受控环境中运行代码\n8. 结果渲染: 以直观的方式反馈给您",
        files: ["src/query.ts", "src/QueryEngine.ts"]
      },
      {
        title: "自动迭代优化",
        content: "如果任务一次没有完成，系统会自动根据反馈结果进行多轮尝试，直到达成您的目标。这种“自我修正”能力是系统的核心优势。"
      }
    ]
  },
  {
    id: "tools",
    title: "强大的工具箱",
    icon: "Wrench",
    content: "系统内置了丰富的工具，涵盖了文件管理、系统操作、网络搜索等全方位能力。",
    subsections: [
      {
        title: "工具分类",
        content: "• 文件工具: 读取、编辑、写入、搜索文件\n• 系统工具: 执行命令、管理环境变量\n• 智能工具: 任务拆解、子任务管理\n• 外部扩展: 网页搜索、数据抓取、三方集成\n• 通讯工具: 与用户对话、发送通知",
        files: ["src/tools/index.ts", "src/tools/FileTools.ts"]
      },
      {
        title: "安全执行保障",
        content: "所有工具的运行都遵循：输入校验 -> 权限网关 -> 沙箱隔离 -> 正式执行 -> 结果展示。确保每一步都在安全范围内。",
        files: ["src/permissions/index.ts"]
      }
    ]
  },
  {
    id: "multi-agent",
    title: "多智能体协作",
    icon: "Users",
    content: "系统支持多个 AI 智能体协同工作，像一个团队一样共同解决复杂问题。",
    subsections: [
      {
        title: "智能体角色",
        content: "• 协调员: 负责全局调度与任务分配\n• 本地专家: 专注于处理您的本地代码\n• 远程助手: 负责云端或远程环境的任务\n• 协作队友: 与其他团队成员进行同步\n• 记忆专家: 负责整合历史经验与知识",
        files: ["src/agents/Coordinator.ts", "src/agents/LocalAgent.ts"]
      },
      {
        title: "环境隔离技术",
        content: "每个任务都在独立的虚拟环境中运行，互不干扰，确保代码的版本管理与上下文安全。",
        files: ["src/utils/worktree.ts"]
      }
    ]
  },
  {
    id: "ui",
    title: "交互界面设计",
    icon: "Monitor",
    content: "虽然在终端运行，但我们提供了媲美图形化软件的流畅交互与视觉反馈。",
    subsections: [
      {
        title: "界面构成",
        content: "主布局、命令面板、历史记录、状态栏。所有组件都支持实时流式更新，让您看到 AI 的每一步思考。",
        files: ["src/components/App.tsx", "src/components/MainLayout.tsx"]
      },
      {
        title: "渲染引擎",
        content: "采用自定义的高性能渲染技术，确保在不同终端环境下都能获得一致、快速的响应体验。",
        files: ["src/render/InkEngine.ts"]
      },
      {
        title: "便捷操作",
        content: "支持全局快捷键、Vim 模式操作、智能焦点管理，让您的开发效率翻倍。"
      }
    ]
  },
  {
    id: "security",
    title: "安全与权限控制",
    icon: "ShieldCheck",
    content: "安全是我们的底线。系统内置了多层防御体系，防止任何未经授权的操作。",
    subsections: [
      {
        title: "信任模型",
        content: "通过用户白名单、域名准入、行为分析等技术，实时评估每一个操作的风险等级。",
        files: ["src/security/TrustManager.ts"]
      },
      {
        title: "权限模式",
        content: "• 询问模式: 关键操作必须经过您的同意\n• 自动模式: 基于预设策略自动执行安全操作\n• 旁路模式: 针对受信任环境的快速授权",
        files: ["src/permissions/PermissionEngine.ts"]
      },
      {
        title: "沙箱隔离",
        content: "敏感代码在完全隔离的沙箱中运行，无法访问您的核心隐私数据或破坏系统稳定性。",
        files: ["src/security/Sandbox.ts"]
      }
    ]
  },
  {
    id: "state",
    title: "数据与后台服务",
    icon: "RefreshCw",
    content: "高效的数据流转与后台服务，为智能交互提供坚实的基础支撑。",
    subsections: [
      {
        title: "状态管理",
        content: "实时监控 100 多个运行指标，确保系统状态的同步与界面的快速响应。",
        files: ["src/state/store.ts", "src/state/AppState.ts"]
      },
      {
        title: "核心服务",
        content: "• 记忆系统: 记住您的偏好与历史代码逻辑\n• 认证服务: 安全连接您的第三方账号\n• 性能分析: 统计任务耗时与资源消耗\n• 上下文压缩: 智能精简数据，提升处理速度",
        files: ["src/services/MCPService.ts", "src/services/MemoryService.ts"]
      }
    ]
  },
  {
    id: "path",
    title: "学习与核心价值",
    icon: "Compass",
    content: "了解系统的演进路径，以及它能为您带来的核心开发价值。",
    subsections: [
      {
        title: "研究步骤",
        content: "1. 启动流程: 了解系统如何从零启动\n2. 任务执行: 观察一个指令如何变成代码\n3. 协作模式: 体验多智能体如何共同工作\n4. 界面交互: 探索终端下的高效操作方式\n5. 安全机制: 验证系统如何保护您的代码"
      },
      {
        title: "核心价值点",
        content: "1. 极高的自动化程度：让 AI 真正接管繁琐工作。\n2. 深度安全保障：在享受便利的同时无需担心安全。\n3. 极致的交互体验：重新定义终端开发工具。\n4. 强大的扩展性：支持各种插件与外部服务集成。"
      }
    ]
  }
];
