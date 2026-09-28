# 测试报告

## 当前结论

- **本地 MVP 验收：`PASS`** — 11 个测试文件、46 项自动化测试全部通过；ESLint、生产构建、生产依赖高危漏洞审计，以及实时主研判、同一时点风格追问、历史快照、证据和合规本地流程均已通过。
- **生产部署验收：`PASS`** — Vercel 已发布；GitHub-hosted 境外 runner 已验证基础 HTTP 主链路，并在最终验证部署上完成真实 LLM 烟测。
- **真实运行时 LLM：`PASS`** — Vercel 使用 Sensitive 环境变量接入阿里云百炼 `qwen-plus`；最终烟测返回 HTTP 200，`synthesis.status=success`，执行轨迹包含 `qwen-plus`，且没有模板降级 limitation。

这里的 `PASS` 只覆盖下文列出的本地实现、自动化检查、生产 HTTP 烟测与一次真实百炼调用，不表示公开行情或外部模型具备生产 SLA，也不表示未实现的扶摇或 demo Provider 已通过。历史快照与 `auto` 降级已经实现，但未对生产环境做真实网络故障注入；跨浏览器、慢网、全量无障碍和限流专项也未执行。

## 测试环境

| 项目 | 实际值 |
|---|---|
| 执行日期 | 2026-09-28，Asia/Shanghai |
| 操作系统 | macOS 26.4（Build 25E246） |
| Node.js | v24.18.0 |
| npm | 11.18.0 |
| Next.js | 16.3.5（Turbopack） |
| 本地地址 | 实时/默认 `auto`：`http://localhost:3000`；强制快照烟测：`http://localhost:3002` |
| 数据模式 | 默认 `auto`；本轮分别验证实际 `live` 响应与强制 `snapshot` 响应 |
| 实际在线来源 | 东方财富公开行情接口；不可靠的新浪 100 行后备已删除 |
| 内置快照 | `data/market-snapshot.json`，抓取于 `2026-09-28T03:24:04.494Z`，市场日期 `2026-09-28` |
| LLM 模式 | Vercel 的 `LLM_API_KEY` 使用 Sensitive 变量；已配置百炼兼容接口与 `LLM_MODEL=qwen-plus`；失败时安全回退确定性模板 |
| 生产 URL | `https://market-regime-research-gamma.vercel.app` |
| Vercel 最终验证部署 | `dpl_4XVx5GBhKEmAPR8T8EdF8mV7yCkJ` |
| 真实 LLM 最终烟测 | 2026-09-28 15:56:59 CST；[GitHub Actions run 36390799687，attempt 4](https://github.com/llllllllampard/market-regime-research/actions/runs/36390799687/attempts/4) |
| 源码远程 | `https://github.com/llllllllampard/market-regime-research` |
| 代码验收基线 | `e4e9516e912f` |

状态定义：

- `PASS`：实际执行并符合预期。
- `PARTIAL`：主要路径可用，但仍有明确未覆盖分支。
- `PENDING`：尚未执行或缺少外部环境，不能视为通过。
- `N/A`：当前版本未实现该能力。

## 命令执行结果

### 自动化测试

```text
$ npm test
Test Files  11 passed (11)
Tests       46 passed (46)
Exit code   0
```

### 静态检查

```text
$ npm run lint
eslint .
Exit code 0（无 error）
```

### 生产构建

```text
$ npm run build
Next.js 16.3.5 (Turbopack)
Compiled successfully
TypeScript finished successfully
Routes: /, /_not-found, /api/analyze
Exit code 0
```

其中 `/` 为静态预渲染页面，`/api/analyze` 为动态服务端路由。

### 生产依赖安全审计

```text
$ npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org
found 0 vulnerabilities
Exit code 0
```

为避免部署环境依赖京东内网 registry，`package-lock.json` 已在不改变依赖版本的前提下重建：移除了 525 个 `registry.m.jd.com` resolved URL，当前复查内网 registry 引用为 0。完整依赖审计仍报告 2 项 `moderate`，均位于 Vitest 的 dev-only 依赖链；自动修复要求破坏性 major 升级，因此本轮未强制升级。这两项不进入生产依赖树，但仍作为后续开发工具升级项保留。

### 本地服务

```text
$ npm run dev
Local: http://localhost:3000
Ready in 251ms
```

依赖在本轮测试前已经安装；本轮没有重新把 `npm install` 计入通过项。

## 生产环境烟测

本机访问 `vercel.app` 受到 DNS 污染，无法作为可靠的生产网络验证端。因此，生产 HTTP 证据均由 GitHub-hosted 境外 runner 对生产 URL 执行；本地相同版本已人工验证证据抽屉与风格追问的视觉和交互。下表是基础主链路烟测记录；最终真实 LLM 验收另见其后的专节。

| 场景 | 实际结果 | 状态 |
|---|---|---|
| 首页 | `GET /` → `200`，`404 ms` | `PASS` |
| 健康检查 | `GET /api/analyze` → `200`，`260 ms` | `PASS` |
| 20 日主研判 | `POST /api/analyze` → `200`，`2078 ms`；`live`、`marketDate=2026-09-28`、`issues=0`、`dataHealth=partial`、`state=synchronized_pressure`、`confidence=74`、`evidence=3`、`sources=3` | `PASS` |
| 同会话风格追问 | `POST /api/analyze` → `200`，`127 ms`；成功复用同一研究会话快照 | `PASS` |
| 60 日主研判 | `POST /api/analyze` → `200`，`507 ms`；`live`、`issues=0`、`dataHealth=partial`、`confidence=74` | `PASS` |
| 荐股拦截 | 请求返回 `422`，`category=recommendation` | `PASS` |
| 涨跌预测拦截 | 请求返回 `422`，`category=prediction` | `PASS` |
| 非法请求格式 | 请求返回 `400` | `PASS` |

20/60 日响应的 `partial` 均由盘中成交额按口径主动留空导致，不是数据来源失败；两次主研判的 `issues=0`。这些时延是单次烟测观测值，不是性能 SLA。

### 真实 LLM 最终烟测

Vercel 通过 Sensitive 环境变量接入阿里云百炼 `qwen-plus`，没有在仓库、测试输出或本文记录密钥值。最终验证使用部署 `dpl_4XVx5GBhKEmAPR8T8EdF8mV7yCkJ`、代码基线 `e4e9516e912f`，由 GitHub Actions [run 36390799687，attempt 4](https://github.com/llllllllampard/market-regime-research/actions/runs/36390799687/attempts/4) 于 2026-09-28 15:56:59 CST 执行。

| 检查项 | 实际结果 | 状态 |
|---|---|---|
| HTTP 与耗时 | `POST /api/analyze` → `200`，`8870 ms` | `PASS` |
| 合成状态 | `synthesis.status=success` | `PASS` |
| 模型轨迹 | 执行轨迹包含 `qwen-plus` | `PASS` |
| 降级检查 | 响应中没有模板降级 limitation | `PASS` |

上述结果只证明该次真实调用成功，不把单次 `8870 ms` 当作性能 SLA。此前 [run 36389179154](https://github.com/llllllllampard/market-regime-research/actions/runs/36389179154) 使用旧的 9 秒 LLM 截止时间，完整业务请求触发了安全降级；该次结果明确记录为降级证据，不包装为真实 LLM 成功。后续将截止时间调整为 15 秒、对百炼请求关闭思考模式、改用定性最小输入和无数字指数占位符，并明确严格 JSON 输出契约后，最终烟测通过。

## 自动化测试明细

| 测试文件 | 数量 | 已验证内容 | 状态 |
|---|---:|---|---|
| `tests/state.test.ts` | 7 | 四种明确状态、拉锯/分歧、阈值边界、任一核心坐标缺失时证据不足 | `PASS` |
| `tests/compliance.test.ts` | 14 | 多种预测、简短股票名荐股、二选一交易、收益承诺、仓位建议拦截及安全改写；研究方法类“推荐”不误杀；范围外个股估值请求拦截 | `PASS` |
| `tests/citations.test.ts` | 3 | Evidence → Metric → Source 正常链路；未知 Source；幻觉 inline Evidence ID | `PASS` |
| `tests/confidence.test.ts` | 5 | 七维覆盖率、分数有限范围、全 A 代理封顶、过期封顶、demo 封顶、盘中历史快照 74 分封顶、核心缺失封顶 | `PASS` |
| `tests/null-safety.test.ts` | 4 | 缺失不变成 0/NaN/Infinity；宽度缺失时保留趋势但状态不足；趋势与宽度日期错配时拒绝合成状态；取数前合规拦截 | `PASS` |
| `tests/runtime-ai.test.ts` | 6 | 未配置时模板降级；合法假模型响应；百炼专属参数与跨 Provider 回归；定性最小输入、标准指数占位符恢复及 Unicode 数字/未知或误用 token 拒绝；未知 `E999` 拒绝；叙事方向冲突拒绝 | `PASS` |
| `tests/provider.test.ts` | 1 | 日线响应的指数身份不符时拒绝数据，不把中证 1000 当作沪深 300 | `PASS` |
| `tests/fallback.test.ts` | 2 | `auto` 在核心实时数据缺失时显式切换到快照；`live` 不静默降级且返回证据不足 | `PASS` |
| `tests/api-compliance.test.ts` | 2 | API 对“推荐茅台”和股票二选一请求直接返回 422 `COMPLIANCE_BLOCKED`，不会进入分析主链路 | `PASS` |
| `tests/api-session-cache.test.ts` | 1 | 两分钟快照缓存按浏览器会话 ID 与 20/60 日窗口隔离，风格追问只复用对应快照 | `PASS` |
| `tests/switch-conditions-ui.test.ts` | 1 | 响应归一化和 UI 同时保留并渲染确认规则 `persistence` 与触发后影响 `consequence` | `PASS` |
| **合计** | **46** | 11 个测试文件 | **`PASS`** |

测试使用固定 fixture 和注入式假客户端，不包含真实 API Key，也不会把假模型响应当作外部模型成功证据。

## 本地手工与端到端结果

| ID | 场景 | 实际操作与结果 | 状态 |
|---|---|---|---|
| E01 | 首页与默认流程 | 打开本地页面，默认问题、20/60 日选择器、开始研判、加载态和结果区域可用 | `PASS` |
| E02 | 20 日主研判 | 通过页面及 `POST /api/analyze` 请求；2026-09-28 11:36 CST 返回 `live`、3 个东方财富 SourceRef、8 个指标、程序状态、置信度、切换条件和执行轨迹 | `PASS` |
| E03 | 60 日窗口 | 先执行 60 日主研判，再请求 60 日风格研究；ResearchPlan 与相对收益指标窗口均为 60 日，不是仅替换界面标签 | `PASS` |
| E04 | 证据追溯 | 点击 Evidence ID 打开抽屉，可见关联 Metric、公式、SourceRef、市场日期、抓取时间、原始字段和请求参数 | `PASS` |
| E05 | 继续研究大小盘风格 | 点击继续研究入口后显示事实、归纳、不确定性和可点击引用；API 返回 `style_rotation` 计划。同一浏览器会话的 60 日主研判与随后追问 `fetchedAt` 完全相同，执行轨迹确认复用 3 个数据集 | `PASS` |
| E06 | 合规拦截 | 输入“明天涨不涨，买什么股，几成仓？”时返回 `COMPLIANCE_BLOCKED`；API 自动化另验证“推荐茅台”和股票二选一均返回 422，研究框架类“推荐”不被误杀 | `PASS` |
| E07 | 未配置 LLM 的安全回退 | 在未配置运行时 LLM 的测试路径中，主研判仍成功；执行轨迹明确显示使用确定性模板，不冒充外部模型结果 | `PASS` |
| E08 | 盘中流动性 | 2026-09-28 11:36 CST 的最新 K 线是当日未收盘数据；成交额比返回 `null`/“盘中未完成”，未错误比较完整日均值，数据健康度为 `partial` | `PASS` |
| E09 | 实时数据主链路 | 东方财富沪深 300、中证 1000 日线及全 A 涨跌分布均成功返回；SourceRef 使用真实 Provider 名 | `PASS` |
| E10 | 强制历史快照 | 以 `DATA_MODE=snapshot` 在本地生产服务请求 20 日主研判；返回 `snapshot`、3 个来源、市场日期 `2026-09-28`、`coverage=0.4286`、`confidence=74`，封顶原因明确为历史快照来自盘中未收盘截面 | `PASS` |
| E11 | `auto` 显式降级 | 自动化注入核心实时数据缺失；结果保留实时错误、追加显式切换 issue，并使用带标签的内置快照生成可复核结果 | `PASS` |
| E12 | `live` 禁止静默降级 | 同一核心缺失 fixture 使用 `live`；结果保持 `live`、状态为“证据不足”、健康度为 `failed` | `PASS` |
| E13 | 真实网络故障下的自动切换 | 尚未在本地 UI 对真实网络做断网/超时注入；当前证据是 fixture 自动化测试和强制快照烟测 | `PARTIAL` |
| E14 | 窄屏与慢网 | 尚未留存系统化的手机宽度和网络限速检查记录 | `PENDING` |
| E15 | 状态切换条件展示 | 服务端渲染合同测试确认页面同时显示“确认规则”和“触发后”，没有丢失 `persistence` 或 `consequence` | `PASS` |
| E16 | 生产真实 LLM | GitHub-hosted runner 调用最终验证部署；HTTP 200、`8870 ms`、`synthesis.status=success`、轨迹含 `qwen-plus`，且没有模板降级 limitation | `PASS` |

实时数据会变化。E02/E03/E05/E08/E09 记录的是测试时链路行为，不把当时市场数值设为未来测试的固定期望。E10 使用的是仓库内固定快照，因此其来源时点与盘中置信度上限可重复核验。

## 实时样本的口径检查

2026-09-28 11:36 CST 的 20 日实时主研判响应体现了两项人工口径修正：

| 检查项 | 预期 | 实际结果 | 状态 |
|---|---|---|---|
| 盘中成交额 | 未收盘累计额不得与完整交易日均值直接比较 | `M_LIQUIDITY_AMOUNT_RATIO=null`，显示“盘中未完成” | `PASS` |
| 覆盖率 | 以题目七维为分母；盘中流动性缺失时只有 3 个维度可用 | `coverage=0.4286`（3/7） | `PASS` |
| 全 A 宽度代理 | 不包装为沪深 300 成分股宽度 | 来源 scope、Evidence 文案和置信度封顶均明确为代理 | `PASS` |
| 置信度含义 | 不得表达为上涨概率 | 返回“当前状态分类的证据质量与稳定性，不是未来上涨概率” | `PASS` |

固定测试 fixture 中四个已实现维度均可用时，自动化断言覆盖率为 `0.5714`（4/7）。

## 数据与失败路径验证

| 能力 | 当前验证范围 | 状态 |
|---|---|---|
| 东方财富日线 | 真实请求 + Zod 校验 + 页面/API SourceRef | `PASS` |
| 东方财富全 A 宽度 | 真实请求 + Zod 校验 + 代理口径展示 | `PASS` |
| IPv4 优先修正 | 服务端启用 `setDefaultResultOrder("ipv4first")` 后主链路实测成功 | `PASS` |
| 新浪宽度候选后备 | 实测发现接口最多返回 100 行，不能代表全市场宽度；已从运行时代码删除 | `PASS`（拒绝不可靠来源） |
| 单一数据集失败 | loader 并发取数并结构化保留 sibling 结果；fixture 覆盖宽度缺失 | `PASS` |
| 内置历史快照 | 同一公开行情链路的真实抓取；模式、来源、市场日期与抓取时点均保留；强制 `snapshot` API 烟测通过 | `PASS` |
| `auto` 模式 | 核心实时数据缺失 fixture 触发显式快照降级，并保留实时 issue | `PASS` |
| `live` 模式 | 相同故障不切换快照，返回证据不足 | `PASS` |
| 构造 demo Provider | 当前未实现；仅置信度函数的 demo 封顶有单测 | `N/A` |
| 扶摇 Provider | 当前未实现 | `N/A` |

当前默认 `DATA_MODE=auto`：实时核心数据正常时返回 `live`；缺失时保留错误并显式返回 `snapshot`。设置 `live` 可禁止降级，设置 `snapshot` 可直接使用内置快照。所有模式都不会生成构造数据。

## LLM 与引用安全验证

| 场景 | 实际结果 | 状态 |
|---|---|---|
| 无 Key/模型 | 使用确定性模板，执行轨迹明确标记降级 | `PASS` |
| 合法结构化假响应 | 严格 Schema 通过，引用追加到展示文本 | `PASS` |
| 未知 Evidence ID | 拒绝响应并回退模板 | `PASS` |
| 叙事方向与所引证据冲突 | 拒绝响应并回退模板 | `PASS` |
| Evidence → Metric → Source 链路 | 正常 fixture 通过，未知 Source 被拒绝 | `PASS` |
| 坏 JSON、HTTP 错误、超时 | 代码统一 catch 并回退；尚无逐项自动化断言 | `PARTIAL` |
| 模型文本含数字 | 诊断调用被校验拒绝并安全回退；这是拒绝路径通过，不计为外部模型成功 | `PASS`（安全回退） |
| 模型结构不合规 | 诊断调用被 Schema 拒绝并安全回退；这是拒绝路径通过，不计为外部模型成功 | `PASS`（安全回退） |
| 旧 9 秒截止时间 | run 36389179154 触发安全降级；未误报为成功，随后完成参数与超时修正 | `PASS`（安全回退） |
| 真实外部模型 | 百炼 `qwen-plus` 最终烟测 HTTP 200，`synthesis.status=success`，轨迹与无降级检查通过 | `PASS` |

## 独立人工复算

以下结果由 `data/market-snapshot.json` 的原始 bars/breadth 独立计算，再与 API 输出逐项比对。样本是 2026-09-28 11:24 CST 抓取的盘中快照；数值只用于验证公式实现，不代表未来判断。

| 项目 | 复核口径 | 独立结果与 API 对照 | 状态 |
|---|---|---|---|
| 20 日收益 | 最新收盘 / 20 个交易日前收盘 - 1 | `-5.7848%`，精确一致 | `PASS` |
| MA20 与偏离 | 最近 20 个收盘点位算术平均；最新收盘 / MA20 - 1 | `MA20=4520.555`、偏离 `-3.9377%`，精确一致 | `PASS` |
| MA20 五日斜率 | 当前 MA20 / 五个交易日前 MA20 - 1 | `-0.6181%`，精确一致 | `PASS` |
| 趋势分 | 三个归一化趋势分量截断后取均值 | `-0.7697`，精确一致 | `PASS` |
| 上涨家数占比与宽度分 | 上涨数 /（上涨 + 下跌 + 平盘）；`clamp((ratio-0.5)/0.25)` | `11.6813%`、宽度分 `-1`，精确一致 | `PASS` |
| 20 日大小盘相对表现 | 沪深 300 区间收益 - 中证 1000 区间收益 | `-0.3286` 个百分点，精确一致 | `PASS` |
| 60 日收益与大小盘相对表现 | 同上，窗口改为 60 个交易日 | 沪深 300 收益 `-10.3181%`、相对表现 `5.1812` 个百分点，精确一致 | `PASS` |
| 盘中成交额比 | 当日未收盘时禁止与 20 个完整交易日均值比较 | API 返回 `null`/“盘中未完成”，与规则一致，未制造无效比值 | `PASS` |

## 已知测试边界

- 新鲜度按周一至周五的工作日近似计算，尚未覆盖中国交易所节假日日历。
- PublicMarketProvider 目前只有指数身份错配的独立 mock 单测；完整 HTTP/Schema 失败矩阵及真实网络断开时的 `auto` 页面提示仍需专项故障注入。
- 已完成一次百炼 `qwen-plus` 真实成功烟测，但供应方限流、长期稳定性、成本和更多响应差异仍未专项验证；诊断中出现的数字/结构拒绝均按设计安全回退，不计作模型成功。
- 风格继续研究会在同一浏览器会话、同一窗口主研判后的两分钟内复用同一快照；不同会话/窗口已验证隔离，超时、服务实例切换或没有对应快照时会重新取数。
- API 已实现每 IP 每分钟 12 次限流、10 KB 请求体上限与取消信号传递，但尚无专门的自动化边界测试。
- 本轮未做生产真实网络故障注入、跨浏览器、慢网、全量无障碍或限流专项测试；生产页面 HTTP 可访问性与真实 LLM 单次成功由境外 runner 验证，本地相同版本完成了证据抽屉和风格追问的视觉交互检查。

## 生产发布清单

- [x] 创建并确认公开源码远程：`https://github.com/llllllllampard/market-regime-research`。
- [x] 记录代码验收基线 `e4e9516e912f`。
- [x] 发布并回填：`https://market-regime-research-gamma.vercel.app`，最终验证部署 `dpl_4XVx5GBhKEmAPR8T8EdF8mV7yCkJ`。
- [x] 由 GitHub-hosted 境外 runner 跑通生产首页、健康检查、20/60 日主研判、同会话风格追问、合规拦截和非法请求。
- [x] 在本地相同版本跑通证据抽屉和风格继续研究的视觉交互。
- [ ] 强制触发生产环境核心实时数据失败，核对原始错误、`auto` 快照标签和历史抓取时点提示。
- [x] 使用 Vercel Sensitive 环境变量配置百炼 `qwen-plus`，且未在仓库与报告中记录密钥。
- [x] 完成真实 LLM 最终烟测：run 36390799687 attempt 4，HTTP 200、`synthesis.status=success`、轨迹含 `qwen-plus`、无模板降级 limitation。
- [ ] 完成跨浏览器、慢网和全量无障碍专项测试。
- [x] 记录真实 LLM 供应方、模型名、时间、部署、代码基线和校验后输出。

生产部署状态为 `PASS`；未勾选项是明确保留的非阻断验证边界，不包含在本次通过范围内。
