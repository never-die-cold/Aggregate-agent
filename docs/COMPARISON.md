# 同类项目对比与提升路线

> 调研时间：2026-11-03。GitHub Star 数仅代表生态热度，不代表代码质量；新项目可能功能很强但星数很低。
>
> 对比对象：Agent Viewer、Sessions Viewer、Agent Sessions、AgentSessionManager、llm-deep-trace、Kept、Sniffly、OpenCode Manager、tuios、Claude Code Trace 等。

---

## 1. 先说结论

同类产品大致分四类：

1. **多 Agent 会话浏览器**：Agent Viewer、Sessions Viewer、Agent Sessions、AgentSessionManager、llm-deep-trace。
2. **单 Agent 深度工具**：Claude Code Trace、Sniffly、OpenCode Manager。
3. **对话归档 / 第二大脑**：Kept、ThreadShelf、LightHistory。
4. **Agent 运行与终端管理**：tuios、ai-code-conductor、nodeterm。

一个明显的信号：**高星项目大多不是“纯查看器”**。

- `tuios`（约 6.3k stars）是终端窗口管理器，核心卖点是“知道每个 Agent 在干什么 + 统一 Inbox”。
- `Sniffly`（约 1.3k）是 Claude Code 的使用分析面板，重点是用量、错误和可分享报告。
- `OpenCode Manager`（约 912）是单 Agent 的自托管指挥中心，包含会话、Git、终端、定时任务、手机访问。
- 纯会话浏览器的星数通常在几十到几百。

这说明用户需求已经从“帮我打开 JSONL”升级为：

> **找得到 → 看得懂 → 接得上 → 管得住 → 知道花了多少。**

AgentHub 目前强在“找得到 + 看得懂”，弱在“接得上 + 管得住 + 花了多少”。

---

## 2. 最接近的几个项目

| 项目 | 形态 | 覆盖 | 它做得好的地方 | 相对 AgentHub 的差异 |
|---|---|---|---|---|
| [Agent Viewer](https://github.com/Atituiset/agent-viewer) | Electron 桌面 | 7 个 Agent | 统一浏览、会话回放、**实时跟随**、**子 Agent 泳道图**、SSH / WSL、中英双语、未知 JSONL 自动发现 | 不含 ZCode / DSH；不做恢复、清理、导出、成本分析 |
| [Sessions Viewer](https://github.com/jerrywu001/cc-sessions-viewer) | Tauri 桌面 | 7 个 Agent | **内置聊天与一键恢复**、嵌入终端、分屏、收藏、重命名/回收站、Markdown/HTML/JSON 导出、项目/模型/工具成本统计、**Skills/MCP/Hooks/指令文件统一管理** | 不含 ZCode / DSH；桌面端，不做远程 |
| [Agent Sessions](https://github.com/jazzyalex/agent-sessions) | macOS 原生 | 16 个 Agent | 搜索提示词/回复/工具调用/命令输出/错误/路径/图片；**恢复会话**；**Codex/Claude 配额与 burn rate**；会话信息面板；图片；压缩 Codex `.zst` 与 DSH v4 | macOS only；不含 ZCode；闭源式产品完成度，开源可改但平台受限 |
| [AgentSessionManager](https://github.com/zhuchongba-01/AgentSessionManager) | Tauri 桌面 | 7 个 Agent（含 ZCode、DSH） | **项目分组 + 缩略导航**、子会话归属、批量清理、删除前逐条核对、失败可见、长历史分页 + 消息虚拟滚动、符号链接安全 | 不做恢复/实时/导出/统计；偏“清理工具” |
| [llm-deep-trace](https://github.com/userFRM/llm-deep-trace) | Node Web | 11 个 Agent | **子 Agent 树 + Conversation Map**、实时 tail（3 秒轮询）、全文搜索、Ctrl+F、图片灯箱、按日/提供商/工具统计、会话归档 | 不含 DSH / ZCode；不做恢复；无鉴权 |
| [Kept](https://github.com/egroup-labs/kept) | 桌面 + 浏览器扩展 | ChatGPT / Claude / Gemini / Grok / Kimi | 对话落成 Markdown 文件、SQLite FTS5、主题/图谱视图、**MCP Server**、浏览器扩展同步云端对话 | 不是编码 Agent 会话查看器；不做 Codex/OpenCode/ZCode/DSH |
| [Sniffly](https://github.com/chiphuyen/sniffly) | Python Web | Claude Code | 用量模式、错误分类、指令历史、可分享仪表盘 | 单 Agent、纯分析，不做聚合 |
| [OpenCode Manager](https://github.com/chriswritescode-dev/opencode-manager) | 自托管 Web | OpenCode | 会话 + Git + 终端 + 定时任务、手机访问、管理员账号 | 单 Agent，偏运行管理 |
| [tuios](https://github.com/Gaurav-Gosain/tuios) | 终端管理器 | 多 Agent | 平铺窗口、工作区、会话持久化、**统一 Agent Inbox**、实时状态 | 不是历史查看器，解决“正在运行”的问题 |

> 直接对标建议看 **Agent Viewer、Sessions Viewer、Agent Sessions、AgentSessionManager、llm-deep-trace** 这五个。Kept 更适合看“对话归档 + MCP”的产品思路。

---

## 3. 功能矩阵

`✓` 已有；`部分` 有限或需要额外配置；`—` 没有。

| 能力 | AgentHub | Agent Viewer | Sessions Viewer | Agent Sessions | AgentSessionManager | llm-deep-trace |
|---|---|---|---|---|---|---|
| 形态 | 本地 Web，零依赖 | Electron | Tauri | macOS 原生 | Tauri | Node Web |
| 覆盖 Agent 数 | 5 | 7 | 7 | 16 | 7 | 11 |
| 含 ZCode / DSH | ✓ / ✓ | — / — | — / — | — / ✓ | ✓ / ✓ | — / — |
| 跨 Agent 项目归并 | ✓ | 部分 | ✓ | 部分 | ✓ | 部分 |
| 全局搜索 | 标题/正文 | 标题/项目 | 标题/用户提示词 | 提示词/回复/工具/输出/错误/路径/图片 | 标题/正文 | 全文 |
| 会话内查找 | — | — | 部分 | 部分 | 部分 | ✓ |
| 实时跟随 | —（60 秒同步） | ✓ | 内置聊天/终端 | 运行状态/配额 | — | ✓（3 秒轮询） |
| 子 Agent 树/泳道 | 仅标记 | ✓ | 部分 | — | 仅归属 | ✓ |
| 恢复/启动 Agent | 仅复制命令 | — | ✓ | ✓ | — | — |
| 清理/批量删除 | — | — | ✓ 重命名/回收站 | 收藏/置顶 | ✓ 批量删除 | 归档 |
| 标签/收藏/备注 | — | — | ✓ 收藏 | ✓ 星标/置顶 | — | 归档 |
| 导出 | — | — | MD / HTML / JSON | 部分（图片/复制） | — | — |
| 图片/附件/Diff | — | — | ✓ 图片/Diff | ✓ 图片 | — | ✓ 图片 |
| Token/成本/配额 | 仅总量 | 元数据 | 项目/模型/工具 | 配额与 burn rate | 部分 | 统计 |
| Skills/MCP/Hooks 管理 | — | — | ✓ | — | — | — |
| SSH / WSL | — | ✓ | — | — | — | — |
| 鉴权 | 无（仅 localhost） | OS keychain + TOFU | 桌面 | macOS | 桌面 | 无 |
| 公开 API / 插件 | REST + 适配器 | 有限 | 有限 | — | — | — |

---

## 4. AgentHub 的真实不足

### P0：影响“每天都想打开”的断层

1. **没有实时跟随**
   - 现在 `lib/sync.js` 每 60 秒扫一次，只更新索引，不会在详情页里追加正在写入的消息。
   - 对比：Agent Viewer 的 Live Mode、Claude Code Trace 的 live tail、llm-deep-trace 的 3 秒轮询。
   - 影响：Agent 正在跑的时候，你仍然要刷新页面猜进度。

2. **子 Agent 只是标签，不是结构**
   - Codex 的 `parentThreadId`、OpenCode 的 `parent_id`、Kimi 的 `agents`、DSH 的 subagent 信息都存在于数据里，但 UI 只显示“子代理”标签。
   - 对比：Agent Viewer 泳道、llm-deep-trace 的子 Agent 树、AgentSessionManager 的“某某会话的子会话”。
   - 影响：多 Agent 协作时，无法回答“这个子任务是谁派生的、花了多少、结果回到哪”。

3. **没有会话内查找**
   - 长会话只能靠浏览器 Ctrl+F，匹配的是 DOM 文本，不是结构化消息；工具输出折叠后还搜不到。
   - 对比：llm-deep-trace 的 Ctrl+F 匹配计数；Sessions Viewer 的 Jump to prompt。
   - 影响：几百条消息的会话很难定位“哪一步改了那个文件”。

4. **没有导出**
   - 不能把一个会话、一个项目或一次排查过程导出成 Markdown/JSON/HTML 交给别人或另一个 Agent。
   - 对比：Sessions Viewer 的 MD/HTML/JSON 导出。
   - 影响：跨 Agent 接力只能手工复制，正好卡在用户最核心的“切换 Agent”场景上。

### P1：从“查看器”变成“管理台”所缺的

5. **没有安全的管理动作**
   - 目前完全只读。不能收藏、打标签、归档、软删除、批量清理，也不能把项目标记为“正在进行”。
   - 对比：AgentSessionManager 有批量清理、逐条核对、子会话链、符号链接保护；Sessions Viewer 有重命名/回收站。
   - 建议：**先做 archive/tag/favorite，不做硬删除**；如果做删除，必须有回收站、备份和子会话链确认。

6. **搜索还不够“深”**
   - `server.js` 只在 `title / project_path / search_text` 上用 `instr` 扫描；`search_text` 只包含用户与助手正文，不含工具输出、文件路径、错误栈、图片 alt。
   - 当前 533 段会话约 50–100ms，但到万级会明显变慢；也没有相关度排序。
   - 对比：Agent Sessions 搜命令输出/错误/路径/图片；llm-deep-trace 全文搜索。
   - 建议：FTS5 trigram + CJK bigram，或 SQLite FTS + 分层索引；先索引工具输出的摘要与错误行。

7. **没有成本/配额/错误分析**
   - 只有总 token，没有按项目、模型、工具、时间聚合，也没有订阅配额 burn rate、错误分类、重试次数。
   - 对比：Agent Sessions 的 Quota Meter、Sniffly 的错误分析、Sessions Viewer 的项目/模型/工具成本。
   - 影响：无法回答“哪个 Agent 最烧钱”“这次失败是模型问题还是工具问题”。

8. **Agent 覆盖与路径可配置性不足**
   - 目前只覆盖 5 个：ChatGPT/Codex、Kimi Code、ZCode、OpenCode、DSH；缺少 Claude Code、Gemini CLI、Cursor、Copilot CLI、Pi、Grok Build。
   - 适配器直接使用 `HOME`，没有 `CODEX_HOME`、`CLAUDE_CONFIG_DIR`、`XDG_DATA_HOME`、`PI_CODING_AGENT_DIR` 等覆盖；ZCode 只读 v2/backup，没有 `~/.zcode/cli/db/db.sqlite`。
   - 也没有 Agent Viewer 那种“未知 JSONL 自动发现”。
   - 影响：换一台机器或自定义安装目录就要改代码。

9. **工具资产没有盘点**
   - 你管理 5 个 Agent，真正难的是 Skills、MCP server、Hooks、AGENTS.md/CLAUDE.md 在多处重复、失效、版本不一致。
   - 对比：Sessions Viewer 已经把 Skills/MCP/Hooks/指令文件做成统一管理页。
   - 这是“管理各个 Agent”比“看会话”更高频、更痛的入口。

### P2：工程与分发

10. **没有测试/CI/解析夹具**
    - 目前只有手工验收脚本；适配器格式一旦变化，回归成本高。
    - 对比：Agent Viewer、Sessions Viewer、Agent Sessions 都有 CI 或 fixture 体系。
    - 建议：把脱敏样本放进 `test/fixtures`，每个适配器至少一个 golden test；不要提交真实会话。

11. **没有鉴权，也没有移动端/安装包**
    - 只监听 `127.0.0.1`，这是正确的默认值；但如果以后要手机访问/远程，必须加 token/密码、HTTPS、CORS 限制。
    - 对比：OpenCode Manager 有管理员账号和手机访问；Claude Code Trace 有 JWT 客户端。
    - 分发上，Node 24 + 终端仍是门槛；可以考虑 `npx agenthub`、Docker、PWA，而不是立刻上 Electron/Tauri。

12. **没有 i18n / 插件规范**
    - 目前中文 UI 硬编码；适配器是源码级扩展，不是可安装插件。
    - Agent Viewer 中英双语、Claude Code Trace 有 source plugin 规范。

---

## 5. AgentHub 真正的机会

### 机会一：跨 Agent 的「项目时间线」+「接力包」

大多数同类项目都在做“单个会话的回放”，最多按项目分组；**至少在上述项目里，我还没有看到把同一个项目里 5 个 Agent 的会话合并成一条时间线的实现**。

AgentHub 已经有 `project_key`，可以进一步做：

- 项目页：按时间交错展示 Codex / Kimi / ZCode / OpenCode / DSH 的消息、工具调用、文件变更。
- 「生成接力包」：选一个时间范围，抽取
  - 项目目标
  - 已确认的决策
  - 改过的文件
  - 未完成 TODO / 失败命令
  - 最近一次各 Agent 的结论
- 输出 Markdown，一键复制给下一个 Agent。

这不是“再做一个查看器”，而是直接解决“我该在哪个 Agent 里继续”的问题。**这是最值得押注的差异化。**

### 机会二：MCP Memory Server

Kept 已经证明“把本地对话库通过 MCP 暴露给 Agent”是可行的；但它是聊天归档，不是编码 Agent 会话。

AgentHub 可以提供：

- `search_sessions(query, project, agent, since)`
- `get_project_timeline(project)`
- `get_handoff_pack(project, since)`
- `get_session(session_id)`

这样 Claude Code / Codex / Kimi 在开工前可以主动检索“这个项目之前哪个 Agent 做过什么”，而不是靠人贴上下文。

### 机会三：Agent 对比/路由

同一任务在多个 Agent 里跑过时，比较：

- 耗时、token、成本
- 工具调用次数、失败率
- 最终结果/改动文件
- 哪个 Agent 更适合这类任务

这个方向目前没有成熟开源实现，但需要足够多的跨 Agent 同任务样本。

### 机会四：工具资产盘点

把 Skills、MCP、Hooks、指令文件做成统一清单：

- 哪些 Skill 在三处重复
- 哪个 MCP server 已失效
- 哪个项目的 AGENTS.md 和全局指令冲突
- 一键预览/修复（默认 dry-run）

这比“再显示一个会话列表”更能体现“管理各个 Agent”。

---

## 6. 建议路线

### Phase 1（先做，1 周内可感知）

- 会话内查找（Ctrl+F / 跳转到匹配消息）
- 导出当前会话为 Markdown / JSON
- 标签 / 收藏 / 归档（先不做硬删除）
- 长会话列表虚拟滚动 + 详情消息分批渲染
- 首页/项目页显示“最近一次活动”

### Phase 2（体验断层，2 周）

- 实时跟随：`fs.watch` + 每会话 SSE；运行中标记
- 子 Agent 树：schema 增加 `parent_id`，Codex/OpenCode/Kimi/DSH 适配器补映射
- 项目时间线：跨 Agent 按时间合并
- 会话内错误/命令输出高亮

### Phase 3（差异化，2 周）

- 「接力包」生成与导出
- MCP Server（search / timeline / handoff）
- 工具资产盘点（Skills/MCP/Hooks/指令文件，dry-run）

### Phase 4（补齐与规模化）

- 安全清理：回收站、批量、子会话链、失败续清
- 成本/配额/错误分析
- Claude Code / Gemini / Cursor / Copilot / Pi / Grok 适配器
- 环境变量覆盖 + 未知 JSONL 自动发现
- SSH / WSL、鉴权、PWA、测试/CI

---

## 7. 不建议做什么

- **不要做完整的聊天客户端**：Sessions Viewer 的内置聊天很强，但需要处理 provider 鉴权、流式输出、权限模式、终端集成，投入大且偏离“聚合”。
- **不要做终端管理器**：tuios 的平铺/工作区/常驻会话是另一个产品；AgentHub 应做“记忆与接力”，不是“再开一个终端”。
- **不要做云端同步/遥测**：这会直接破坏本地优先的定位。
- **不要一开始就做硬删除**：数据丢失不可逆；先 archive/tag，删除必须配回收站与备份。
- **不要为了安装包上 Electron/Tauri**：Node Web 的零依赖是优势；先用 `npx`/Docker/PWA 降低门槛。

---

## 8. 参考链接

- [Agent Viewer](https://github.com/Atituiset/agent-viewer)
- [Sessions Viewer](https://github.com/jerrywu001/cc-sessions-viewer)
- [Agent Sessions](https://github.com/jazzyalex/agent-sessions)
- [AgentSessionManager](https://github.com/zhuchongba-01/AgentSessionManager)
- [llm-deep-trace](https://github.com/userFRM/llm-deep-trace)
- [Kept](https://github.com/egroup-labs/kept)
- [Sniffly](https://github.com/chiphuyen/sniffly)
- [OpenCode Manager](https://github.com/chriswritescode-dev/opencode-manager)
- [tuios](https://github.com/Gaurav-Gosain/tuios)
- [Claude Code Trace](https://github.com/delexw/claude-code-trace)
