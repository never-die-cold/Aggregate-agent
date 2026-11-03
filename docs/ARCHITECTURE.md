# Architecture

AgentHub 是一个单进程、本地优先的会话聚合器。它由四层组成：

```
Adapters  →  Sync Manager  →  SQLite Index  →  HTTP API / SSE  →  Web UI
```

没有云端服务、消息队列、Redis 或前端构建工具。Node.js 进程同时提供 API 与静态页面。

---

## 1. Adapters

每个数据源实现同一个只读接口：

```ts
interface SessionMeta {
  source: string;
  nativeId: string;
  title: string;
  projectPath?: string;
  projectName?: string;
  model?: string;
  status?: 'active' | 'completed' | 'archived' | 'error';
  createdAt: number;       // epoch ms
  updatedAt: number;       // epoch ms
  sourcePath?: string;
  archived?: boolean;
  tokens?: number;
  cost?: number;
  bytes?: number;
  fingerprint: string;     // 决定是否需要重新解析
  extra?: Record<string, unknown>;
}

interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  kind: 'text' | 'reasoning' | 'tool' | 'tool-call' | 'plan' | 'log' | 'note';
  text: string;
  toolName?: string;
  createdAt?: number;
  meta?: Record<string, unknown>;
}

interface LoadResult {
  messages: Message[];
  searchText: string;
  metaPatch?: Partial<SessionMeta>;
}
```

适配器负责三件事：

1. **发现**：检查默认路径是否存在。
2. **扫描**：读取元数据，不加载大段消息；输出 fingerprint。
3. **加载**：仅在 fingerprint 变化时读取消息并归一化。

### 各来源的读取策略

| 来源 | 元数据 | 正文 | 增量键 |
|---|---|---|---|
| Codex | `state_5.sqlite.threads` | `thread_history_1.sqlite.thread_items` | `updated_at_ms` + token + 标题长度 |
| Kimi | `state.json` | `agents/main/wire.jsonl` 的 `agent.message.appended` | wire/state 的 size+mtime |
| ZCode | `tasks-index.sqlite.tasks` | `searchable_text`（单段文本） | `updated_at` + 文本长度 |
| OpenCode | `session` / `session_v2` | `message` + `part`；新库回退 `session_message` | `time_updated` + 消息数 |
| DSH | 项目缓存 `session_projcache` | zstd 解压后的 v4 事件流 | 文件 size+mtime + lastPromptAt |

所有源数据库都以 `readOnly: true` 打开；ZCode/Codex/OpenCode 的 WAL 由 SQLite 自身处理，不执行 checkpoint 或写入。

---

## 2. Sync Manager

`lib/sync.js` 负责编排：

1. `initSources()` 把适配器注册进 `sources` 表，保留用户设置的 `enabled`。
2. 对每个启用的来源执行 `scan()`。
3. 对每个 `SessionMeta`：
   - 总是 upsert 元数据，记录 `seen_at`。
   - 若 fingerprint 与上次不同（或强制重扫），调用 `load()`。
   - 在单个事务中写入元数据、消息、`search_text` 与 `fingerprint`。
4. 扫描结束后删除该来源中 `seen_at` 早于本轮的数据，并重算来源统计。
5. 通过 SSE 推送 `{ type: 'sync', state }`。

索引是**可丢弃的缓存**：删除 `data/agenthub.db` 后重新扫描即可恢复，不影响任何 Agent 的原始数据。

并发控制：同一时间只允许一个 sync 任务；HTTP 的同步接口立即返回 `202`，实际任务在后台执行，进度通过 SSE 推送。

---

## 3. SQLite Index

```sql
sources(
  id, name, short_name, color, glyph, kind, data_path,
  detected, enabled, session_count, message_count,
  indexed_bytes, last_scan, error, note, meta_json
)

sessions(
  id, source, native_id, title, project_path, project_key,
  project_name, model, status, created_at, updated_at,
  indexed_at, seen_at, source_path, archived, message_count,
  tokens, cost, bytes, fingerprint, extra_json, search_text
)

messages(
  id, session_id, seq, role, kind, text, tool_name,
  created_at, meta_json
)
```

设计要点：

- `session.id = source + ':' + nativeId`，避免不同 Agent 的 ID 冲突。
- `project_key` 是规范化后的工作目录小写路径，用于跨 Agent 合并项目。
- `search_text` 是用户与助手正文的拼接（不含工具输出），上限 350k 字符。
- 列表查询避免读取 `search_text`；只有带搜索词时才取回并生成 snippet。
- 搜索使用 `instr(lower(...), lower(?))` 的 AND 组合，兼容中文 1–2 字查询；在当前数据规模（几百段会话）下延迟可接受。

### 为什么不用 FTS5

FTS5 的 `unicode61` 无法对中文子串检索；`trigram` 要求至少 3 个字符，2 字中文查询会漏。当前规模下直接扫描拼接文本更可靠。若未来会话数达到数万级，可引入 CJK bigram 或外部搜索引擎。

---

## 4. HTTP API

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/bootstrap` | 启动数据：来源、统计、项目预览、同步状态 |
| GET | `/api/sessions` | 会话列表；参数 `source/project/q/sort/archived/limit/offset` |
| GET | `/api/sessions/:id` | 会话详情、消息、父/子会话、resume 命令、源目录 |
| GET | `/api/sessions/:id/tree` | 直接父会话与子会话列表 |
| GET | `/api/sessions/:id/live` | SSE：单会话实时跟随（3 秒检查 + full/append 事件） |
| GET | `/api/projects` | 项目聚合 |
| GET | `/api/sources` | 数据源状态 |
| POST | `/api/sync` | 触发同步；`{source?, force?}` |
| POST | `/api/reindex` | 清空索引并全量重建 |
| POST | `/api/sources/:id` | `{enabled, sync}` |
| POST | `/api/open` | 用系统文件管理器打开目录 |
| GET | `/api/events` | SSE：同步进度 |

服务只监听 `127.0.0.1`，没有鉴权；它是个人本机工具，不应直接暴露到局域网或公网。

### 4.1 实时跟随与子代理树

- `lib/sync.js#syncSession(id)` 会对单个会话重新加载并比较消息签名；只有在消息数或正文变化时才入库。
- `GET /api/sessions/:id/live` 是一条 SSE：3 秒调用一次 `syncSession`；若消息数变化则发 `append/clear`，若内容变化但数量不变则发 `snapshot`。
- `sessions.parent_id / parent_native_id` 用来表达父子关系。Codex 读取 `thread_spawn.parent_thread_id`，OpenCode 读取 `parent_id`，ZCode 读取 `forked_from_task_id`，其它来源暂无父子信息。
- 详情页顶部会把直接子会话渲染为可跳转的树块；会话库列表为子会话加缩进和 `↳`，父会话用 `+N` 标记子会话数量。

---

## 5. Web UI

`public/app.js` 使用 hash 路由：

- `#/overview` 总览
- `#/sessions` 会话库（列表 + 详情）
- `#/projects` 项目
- `#/agents` 智能体 / 数据源
- `#/settings` 设置

没有虚拟 DOM。页面切换时重建视图，列表刷新时只更新列表容器。所有动态文本先经过 `escapeHtml`；Markdown 渲染器在转义后再插入受控标签，链接只允许 `http(s)` 与 `mailto`。

SSE 收到同步完成事件后，刷新 bootstrap 与当前视图；不会在用户阅读详情时强制滚动。

---

## 6. 扩展建议

- **来源路径配置**：把 `roots` 放到 `config.json` 或 UI 设置，支持非默认安装目录。
- **SSH / WSL 来源**：在适配器前增加远程文件读取层；不要复制整库，按需读取。
- **CJK 搜索**：为 `search_text` 建立 bigram 倒排，或使用 SQLite FTS5 + 自定义 tokenizer。
- **会话导出**：把归一化消息导出为 Markdown / JSON，注意默认脱敏。
- **写入操作**：如实现归档/删除，必须经过明确的用户确认，并保持源格式兼容。
