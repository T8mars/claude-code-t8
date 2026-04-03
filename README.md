# Claude Code(T8版)

基于 Claude Code 源码修复的 **本地增强版**。本项目不仅完整保留了 Claude Code 的 TUI 交互和 Agent 能力，还额外集成了 **Electron 桌面端** 界面，并支持通过环境变量灵活接入各类 Anthropic 兼容 API以及openai兼容格式的api，支持调用贞贞的ai工坊api。

贞贞的ai工坊平价API：[https://ai.t8star.cn](https://ai.t8star.cn/register?aff=cbff0534884)

本项目参考及基于以下2个项目创建和更新，感谢他们对开源社区的贡献

Claude code：https://github.com/instructkr/claw-code.git

B站：ai代码侠土豆的仓库：https://github.com/AICodert8/claude-code-tudou.git

本地部署视频教程：

Bilibili教程：https://www.bilibili.com/video/BV1qq9TBUEi6/
Youtube教程：https://www.youtube.com/watch?v=dk_HG6d1mQs

---

## 核心特性

- **双端体验**：
  - **终端 TUI**：基于 React + Ink 的完整命令行交互界面，支持工具调用、代码编辑和多步迭代。
  - **桌面端 (Electron)**：提供 Vue 3 构建的图形化聊天界面，支持会话管理、工作区切换及可视化设置。
- **全能 Agent**：内置 `BashTool` (执行终端命令)、`FileEditTool` (精准代码编辑)、`Grep/GlobTool` (代码搜索) 等核心工具。
- **高度可定制**：通过 `.env` 轻松配置 API 端点、模型参数及超时设置，兼容 MiniMax、OpenRouter 等第三方服务。
- **稳定性修复**：针对原始源码在本地环境下的启动卡死、按键失效、依赖缺失等问题进行了深度修复。

---

## 快速开始

### 1. 环境准备
- **Bun** >= 1.1 (推荐)
- **Node.js** >= 18

```bash
npm install
```

#### 核心依赖安装：

安装bun

```bash
powershell -c "irm bun.sh/install.ps1 | iex"
```

安装node.js

https://nodejs.org/en/download

### 2. 配置项目
复制并编辑环境变量：
```bash
cp .env.example .env
```
在 `.env` 中填入你的 `ANTHROPIC_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN`。

### 3. 运行程序

#### 运行终端 TUI (推荐)
```bash
# 交互模式
node .\bin\claude-code-tudou

# 单次执行 (无头模式)
node .\bin\claude-code-tudou -p "帮我分析当前目录结构"
```

#### 运行桌面端 (Electron)
```bash
npm run desktop
```

---

## 项目架构

本项目采用模块化设计，主要分为以下核心部分：

- **`bin/`**: 统一入口脚本，智能路由至不同的运行模式。
- **`src/`**: 核心逻辑层。
  - `entrypoints/`: CLI 入口逻辑。
  - `tools/`: Agent 核心工具集（Bash, Edit, MCP 等）。
  - `services/`: API 通信、LSP 客户端及 MCP 协议实现。
  - `ink/`: 深度定制的终端渲染引擎。
- **`desktop/`**: 桌面端实现。
  - `main.cjs`: Electron 主进程，负责与 CLI 核心通信。
  - `renderer/`: 基于 Vue 3 的前端渲染层。

---

## 关键修复说明

我们对原始泄露代码进行了以下关键性修复，以确保其在本地正常运行：

| 模块 | 修复内容 |
| :--- | :--- |
| **启动链路** | 修复了入口脚本错误的路由逻辑，确保无参数启动时能进入完整 TUI 模式。 |
| **交互性能** | 解决了 `modifiers-napi` 缺失导致的 Enter 键失效问题，增强了输入响应的健壮性。 |
| **依赖补全** | 针对缺失的 `.md` 说明文档和 `.txt` 提示词模板添加了桩文件，防止 Bun 加载器卡死。 |
| **桌面集成** | 重新开发了 Electron 与核心 CLI 的通信桥接，支持流式 JSON 输出解析。 |

---

## 环境变量指南

| 变量名 | 说明 |
| :--- | :--- |
| `ANTHROPIC_API_KEY` | 你的 Anthropic API Key。 |
| `ANTHROPIC_BASE_URL` | 自定义 API 转发地址（可选）。 |
| `ANTHROPIC_MODEL` | 默认使用的模型 ID（如 `claude-3-7-sonnet-latest`）。 |
| `CLAUDE_CONFIG_DIR` | 配置文件存放路径（默认为 `~/.claude`）。 |
| `DISABLE_TELEMETRY` | 设置为 `1` 以禁用匿名数据遥测。 |

---

## 技术栈

- **运行时**: [Bun](https://bun.sh)
- **UI 框架**: React (TUI) / Vue 3 (Desktop)
- **桌面框架**: Electron
- **通讯协议**: MCP (Model Context Protocol), LSP (Language Server Protocol)

---

## 免责声明

本仓库代码基于 2026-03-31 泄露的 Claude Code 源码。所有原始版权归 **Anthropic** 所有。本项目仅供技术交流与研究使用，请勿用于任何商业用途。
