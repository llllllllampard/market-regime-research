# 市场状态研判助手

> 用可追溯证据解释沪深 300 当前市场状态，而不是预测未来涨跌。

## 交付状态

| 项目 | 当前状态 |
|---|---|
| Web 产品 | 已实现：Next.js 单页研究工作台 + `POST /api/analyze` |
| 实时数据 | 已实现并在本机跑通：东方财富沪深 300/中证 1000 日线及全 A 涨跌分布 |
| 数据降级 | 已实现：默认 `auto`；核心实时数据失败时显式切换到带来源和时点的真实历史快照，也可强制 `live` 或 `snapshot` |
| 运行时 LLM | 已在 Vercel 通过 Sensitive 环境变量启用阿里云百炼 `qwen-plus`；结构、引用、数字和合规校验及确定性模板安全降级均已验证 |
| 自动化检查 | 11 个测试文件、`46/46` 测试通过，lint、生产构建及生产依赖高危漏洞审计通过（2026-09-28） |
| 本地产品烟测 | 实时 20/60 日主研判、同一时点风格追问、历史快照、证据抽屉和合规拦截均已验证 |
| 生产部署 | `PASS`；已验证部署 `dpl_4XVx5GBhKEmAPR8T8EdF8mV7yCkJ`，真实 LLM 烟测于 2026-09-28 15:56:59 CST 通过 |
| 在线体验 | [https://market-regime-research-gamma.vercel.app](https://market-regime-research-gamma.vercel.app) |
| 源码仓库 | [GitHub · market-regime-research](https://github.com/llllllllampard/market-regime-research) |
| 代码实现基线 | [`e4e9516e912f`](https://github.com/llllllllampard/market-regime-research/commit/e4e9516e912f) |
| 已验证生产部署 | `dpl_4XVx5GBhKEmAPR8T8EdF8mV7yCkJ` |

最终真实 LLM 烟测由 [GitHub Actions run 36390799687（attempt 4）](https://github.com/llllllllampard/market-regime-research/actions/runs/36390799687) 在 GitHub-hosted runner 完成：HTTP 200、耗时 8870 ms、`synthesis.status=success`、执行轨迹包含 `qwen-plus`，且没有模板降级说明。使用境外 runner 的原因是本机访问 `vercel.app` 受到 DNS 污染。相同版本的证据抽屉与风格追问已在本地完成视觉和交互验证。完整证据与未测边界见 [测试报告](docs/TEST_REPORT.md)。

## 解决的问题

目标用户是需要在盘前、盘后或研究会议前快速形成可复核观点的 A 股研究人员。产品聚焦一个受限问题：

> 截至最新可用市场数据，沪深 300 处于什么状态，主要矛盾是什么，哪些可观测条件出现后需要重新判断？

用户可以选择 20 或 60 个交易日窗口。结果将事实、证据归纳与不确定性分层展示，并可从 Evidence ID 下钻到指标、公式、原始字段、来源、市场日期和抓取时间。

当前已完成的交互包括：

- 20/60 日市场状态研判与执行轨迹。
- 趋势、宽度、大小盘风格、流动性四类证据。
- 状态结论、主要矛盾、反证/不确定性，以及同时展示确认规则和触发后影响的状态切换条件。
- Evidence → Metric → Source 追溯抽屉。
- “继续研究大小盘风格”二次分析。
- 涨跌预测、荐股、收益承诺和仓位建议的合规拦截及安全改写。

## 研判框架

两个确定性主坐标决定候选状态：

- 趋势分 `T`：窗口收益、收盘价相对 MA20、MA20 五日斜率。
- 宽度分 `B`：全 A 上涨家数占比的代理分数。它不是沪深 300 成分股宽度，页面和置信度均明确反映这一偏差。

风格与流动性只用于补充解释和调整证据质量，不替代主坐标。

| 条件 | 市场状态 |
|---|---|
| `T >= 0.25` 且 `B >= 0.15` | 趋势与宽度同步改善 |
| `T >= 0.25` 且 `B <= -0.15` | 指数偏强、结构分化 |
| `T <= -0.25` 且 `B >= 0.15` | 宽度修复、趋势未确认 |
| `T <= -0.25` 且 `B <= -0.15` | 趋势与宽度同步承压 |
| 其他 | 区间拉锯或证据分歧 |

趋势或宽度任一主坐标缺失时，系统只输出“证据不足”，不会拼出一个正常状态。

### 置信度口径

置信度衡量的是当前分类的证据质量与稳定性，**不是未来上涨概率**：

```text
覆盖率 = 当前可用维度数 / 题目要求的 7 个维度
数据质量 = 50% × 覆盖率 + 50% × 新鲜度

置信度 =
45% × 数据质量
+ 35% × 核心证据一致性
+ 20% × 距状态阈值的安全边际
```

本 MVP 实现了结构、宽度、风格和流动性 4 个维度，估值、情绪与事件未覆盖，因此不会把“已实现的 4 项全部可用”误报为 100% 覆盖。核心数据缺失、数据过期、无法核验市场日期、演示数据或全 A 宽度代理都会触发置信度封顶。

盘中沪深 300 当日成交额是未完成累计值，不能直接与完整交易日均值比较。若最新 K 线为上海时区当日且尚未到 15:05，流动性指标明确显示“盘中未完成”并按缺失处理。

## 实际架构

```text
浏览器单页
  → POST /api/analyze
  → 合规检查 + 确定性 ResearchPlan
  → DATA_MODE（auto / live / snapshot）
  → PublicMarketProvider（实时公开行情）或带时间戳的本地历史快照
  → Zod 字段校验 + 统一 MarketSnapshot
  → 确定性 Metric / Evidence / State / Confidence / SwitchCondition
  → 可选 OpenAI-compatible 证据归纳
  → Schema / Evidence ID / 数字 / 合规校验
  → 校验通过的模型文本，或明确标注的确定性模板
  → 页面结果与证据追溯
```

技术栈：Next.js 16 App Router、React 19、TypeScript、Tailwind CSS、Zod、Vitest。`/api/analyze` 使用 Node.js 动态运行时；应用不依赖数据库、登录、队列或定时任务。

### AI 与确定性程序的边界

当前 ResearchPlan、数据计算、状态分类、置信度、切换条件和默认解释全部可以确定性运行。可选 LLM 只接收白名单 Evidence Pack，负责将现有证据重新组织为简洁的标题、主要矛盾、归纳和不确定性。

运行时 LLM 路径已经实现，使用 OpenAI-compatible `POST /chat/completions`：

- 仅在 `LLM_API_KEY` 与 `LLM_MODEL` 同时存在时启用。
- 要求严格 JSON 和已存在的 Evidence ID。
- 模型文本不得含未经白名单校验的数字，也不得出现预测、买卖或仓位建议。
- 超时、HTTP 错误、坏 JSON、Schema 错误、未知引用或合规错误都会回退到确定性模板并在执行轨迹中说明原因。

Vercel 生产环境已通过 Sensitive 环境变量配置阿里云百炼 OpenAI-compatible 服务和 `qwen-plus`，真实外部模型在线推理已完成验证；凭证仅保存在服务端环境变量中，不进入仓库、响应或浏览器。未配置凭证的本地环境仍可完整运行确定性链路。

真实 LLM 联调前几轮依次暴露了三类问题，且每次都被校验器安全降级，没有把不合格模型文本作为结论展示：初始完整业务输入超过原 9 秒截止时间；延长截止时间后，模型输出的数字触发数字白名单校验；移除数字后，返回 JSON 的结构仍不符合 Schema。最终通过将截止时间设为 15 秒、对百炼关闭思考模式（`enable_thinking: false`）、压缩为定性最小输入、禁止模型在叙事中直接生成数字、以无数字占位符表示标准指数名，并强化严格 JSON 输出契约解决。最终生产烟测为 `synthesis.status=success`，执行轨迹记录 `qwen-plus`，没有进入模板降级。

## 数据来源与失败处理

当前运行时包含一个实时 Provider 和一个历史快照加载器。默认 `auto` 优先请求实时数据，核心实时数据不可用时才显式降级。

1. 东方财富公开行情接口提供沪深 300 和中证 1000 日 K 线。
2. 市场宽度使用东方财富全 A 涨跌分布。新浪 `hs_a` 曾被评估为后备来源，但接口即使请求大样本仍只返回 100 行，不能代表全市场宽度，因此已从运行时代码删除。
3. Node/undici 在当前网络访问行情域名时出现过 IPv6 连接不稳定，服务端设置 DNS 结果优先 IPv4；该修正只影响服务端取数。
4. 三类数据并发获取。单个来源失败会保留为结构化 issue，并尽可能保留其他可用事实；`live` 模式下核心趋势或宽度缺失时输出“证据不足”。
5. `auto` 模式下，若沪深 300 日线或宽度任一核心数据不可用，系统会保留实时错误并显式切换到 `data/market-snapshot.json`；`live` 模式不会切换，`snapshot` 模式则直接使用该文件。

所有成功来源都记录真实 endpoint、请求参数、原始字段、单位、市场日期和抓取时间。公开接口无 SLA，不属于交易所认证数据服务，也不等同于题目提到的扶摇数据。

内置快照由同一公开行情链路于 `2026-09-28T03:24:04.494Z`（Asia/Shanghai 11:24:04）抓取，市场日期为 `2026-09-28`，包含沪深 300、中证 1000 和全 A 涨跌分布三个来源。它是盘中历史截面，页面始终标记为 `snapshot`，不会伪装成实时数据；盘中置信度上限仍为 74。当前没有构造演示 Provider 或扶摇 Provider。

## API

健康与范围说明：

```bash
curl http://localhost:3000/api/analyze
```

执行研判：

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H 'Content-Type: application/json' \
  --data '{"question":"当前沪深300处于什么市场状态？","horizon":20}'
```

`horizon` 仅支持 `20` 或 `60`。合规越界返回结构化 `COMPLIANCE_BLOCKED`；请求格式错误返回 400；分析链路不可用返回 503，且不会伪造正常结论。接口还限制请求体为 10 KB，并按客户端 IP 限制每分钟 12 次请求；客户端取消会传递到行情与可选 LLM 请求。

主研判成功后，同一浏览器研究会话、同一窗口的风格/风险追问会在两分钟内复用该次 `MarketSnapshot`，保证证据时点一致；服务端按会话 ID 与窗口隔离缓存，缓存过期、窗口改变或会话改变后重新取数。Web 页面会自动发送 `X-Market-Session-Id`；直接调用 API 时不提供该请求头则不会复用快照。

## 本地启动

环境要求：Node.js 20.9+、npm。

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。不配置 LLM 也可以完成全部确定性分析和页面交互。

### 当前生效的环境变量

| 变量 | 必需 | 实际作用 |
|---|---:|---|
| `LLM_API_KEY` | 否 | OpenAI-compatible 服务端鉴权；缺失时使用确定性模板 |
| `LLM_BASE_URL` | 否 | 代码默认 `https://api.openai.com/v1`；当前生产使用 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `LLM_MODEL` | 否 | 模型名；当前生产使用 `qwen-plus`，与 Key 同时存在才启用运行时 LLM |
| `FUYAO_API_KEY` | 否 | 仅预留，当前代码未接入扶摇 Provider |
| `DATA_MODE` | 否 | `auto`（默认）/`live`/`snapshot`；`auto` 在核心实时数据失败时显式使用内置历史快照 |

真实 Key 不应写入仓库或发送到浏览器。

## 检查与测试

```bash
npm test
npm run lint
npm run build
```

2026-09-28 的最终结果为 11 个测试文件、46 个测试全部通过，ESLint、Next.js 生产构建和生产依赖高危漏洞审计通过。实时模式和 `snapshot` 模式也分别完成 API 烟测。生产环境进一步验证：首页与健康检查、20/60 日实时分析、同会话风格复用、荐股/预测拦截和非法请求校验均按预期返回；真实百炼 LLM 烟测还验证了 HTTP 200、`synthesis.status=success`、`qwen-plus` 执行轨迹和无模板降级。自动化与手工结果、尚未验证项见 [docs/TEST_REPORT.md](docs/TEST_REPORT.md)。

## 部署

已部署到 Vercel：

- 生产 URL：[https://market-regime-research-gamma.vercel.app](https://market-regime-research-gamma.vercel.app)
- 已验证部署 ID：`dpl_4XVx5GBhKEmAPR8T8EdF8mV7yCkJ`
- 源码仓库：[https://github.com/llllllllampard/market-regime-research](https://github.com/llllllllampard/market-regime-research)
- 代码实现基线：[`e4e9516e912f`](https://github.com/llllllllampard/market-regime-research/commit/e4e9516e912f)
- 最终真实 LLM 烟测证据：[GitHub Actions run 36390799687（attempt 4）](https://github.com/llllllllampard/market-regime-research/actions/runs/36390799687)，`2026-09-28 15:56:59 CST`

最终真实 LLM 烟测返回 HTTP 200，耗时 8870 ms；响应为 `synthesis.status=success`，执行轨迹包含 `qwen-plus`，没有模板降级说明。此前生产主链路烟测还覆盖首页、健康检查、20/60 日实时分析、同会话风格复用、荐股/预测拦截及非法请求。20/60 日盘中响应的 `partial` 健康度来自成交额按规则留空，并非来源失败。百炼凭证通过 Vercel Sensitive 环境变量提供，未写入源码或前端资源。

受本机 `vercel.app` DNS 污染影响，生产 HTTP 烟测由 GitHub-hosted 境外 runner 执行；本地相同版本已验证证据抽屉和风格追问交互。本轮没有执行真实故障注入、跨浏览器、慢网或全量无障碍专项测试，这些是已记录的非阻断项，不包含在生产部署 `PASS` 范围内。

## 合规与已知边界

- 不输出未来确定性涨跌、点位预测、收益承诺、个股推荐、买卖点或仓位建议。
- 研究对象固定为沪深 300，只支持 20/60 个交易日窗口。
- 宽度是全 A 涨跌分布代理，不是沪深 300 成分股宽度。
- 成交额是沪深 300 指数口径，不代表全市场资金流。
- 估值、独立情绪指标、宏观、政策、新闻/RAG、回测和历史相似阶段不在 MVP 内。
- 新鲜度当前按工作日近似计算，尚未接入中国交易所节假日日历。
- 大小盘继续研究会沿用所选窗口，并在同一浏览器研究会话的主研判后两分钟内复用同一快照；超过时限或没有对应会话/窗口快照时会重新取数。
- 未实现扶摇或 demo Provider、账户、自选股、持仓、分享、导出或数据库；历史快照与 `auto` 降级已实现。
- 公开行情接口可能限流、改字段或暂停服务，不能将本 MVP 视为高可用生产行情系统。

开发阶段的 AI 使用、人工修正和运行时 AI 验证边界见 [docs/AI_USAGE.md](docs/AI_USAGE.md)。
