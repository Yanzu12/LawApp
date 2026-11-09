# AI智能案例检索功能说明

> 当前实现：**元典开放平台「案例语义检索」** + **DeepSeek-V4.1-Flash-1017**
> 上一版基于德理关键词检索的方案已被替换。

## 功能概述

类案检索的链路是：用户提问 → AI 补充过滤条件 → 元典语义检索 → 案例注入系统提示词 → 模型生成回答 → 附上案例原文。

与旧版最大的差别在于**检索方式**：旧版是把问题拆成关键词做倒排匹配，新版是直接拿用户原话做向量语义相似度检索。

## 检索方式对比

### 旧版（德理·关键词检索）
```
用户问题："公司让我调岗到外地，我不去，算不算旷工被辞退？"
  ↓
AI 抽关键词：["调岗", "旷工", "辞退"]
  ↓
倒排/关键词匹配
  ↓
命中所有含这些词的文书（大量噪声，且同义表述检索不到）
```

**痛点**：
- 同义不同词检不到（"调岗" vs "变更工作岗位"）
- 口语化问题抽不出关键词
- 排序靠关键词相关度，不等于案情相似度
- 必须有 caseId 再调详情接口，链路两次请求

### 新版（元典·语义检索）
```
用户问题（原文）
  ↓
POST https://open.chineselaw.com/open/case_vector_search
  { query: 用户原话, rewrite_flag: true, return_num: N,
    wenshu_filter: { wenshu_type, ay } }
  ↓
向量相似度召回 + 平台侧 query 改写
  ↓
extra.wenshu[]：直接返回整理后的案例内容 + score 相似度
```

**优势**：
- 语义匹配，同义表述、口语化描述都能召回
- `rewrite_flag` 由平台做查询改写，不需要本地维护关键词库
- 一次请求即拿到案例正文，无需二次调详情
- 返回 `score`，可以按相似度决定引用权重

## 接口约定

| 项 | 值 |
| --- | --- |
| 地址 | `POST https://open.chineselaw.com/open/case_vector_search` |
| 鉴权 | 请求头 `X-API-Key: <YUANDIAN_API_KEY>` |
| 关键入参 | `query`（必填）、`rewrite_flag`、`return_num`、`wenshu_filter` |
| 结果位置 | `extra.wenshu[]` |
| 结果字段 | `title` / `ah`（案号）/ `jbdw`（经办法院）/ `ajlb`（案件类别）/ `wszl`（文书种类）/ `spcx`（审判程序）/ `jaDate` / `content` / `score` / `anyou` |

`wenshu_filter` 均为可选：`wenshu_type`、`ay`（案由数组）、`wszl`（文书种类编码 1 判决/2 裁定/3 调解/4 决定）、`ja_start`/`ja_end`、`dianxing`、`fayuan`、`cj`、`xzqh_p`/`xzqh_c`、`spcx`、`source`。

## 技术实现

### 1. `searchCasesBySemantic()` — 语义检索
```typescript
// 位置：index.ts
async function searchCasesBySemantic(options: CaseSearchOptions): Promise<any[] | null>
```

- 组装 `query` + `wenshu_filter`，`rewrite_flag: true`
- 60 秒超时，超时/异常返回 `null` 而不是抛错，避免拖垮整条对话
- 只取 `extra.wenshu`（其余数据源字段为空列表）

### 2. `normalizeYuandianCase()` — 结构归一化
把元典字段映射为前端既有的 `CaseData` 结构，因此**前端渲染代码无需改动**：

| 元典字段 | 内部字段 |
| --- | --- |
| `title` | `title` |
| `ah` | `caseNumber` |
| `jbdw` | `court` |
| `ajlb` | `caseType` |
| `anyou[0]` | `causeName` / `cause` |
| `wszl` | `judgementType` |
| `jaDate`（20191223） | `judgementDate`（2019-12-23） |
| `spcx` | `levelOfTrial` |
| `content` | `content` + `detail.data.docResult` |
| `score` | `similarity` |

### 3. `splitCaseContentSections()` — 正文分段
元典返回的 `content` 是整理后的"基本事实 + 争议焦点 + 裁判理由"整段文本，没有 `docResult` 结构。
这里按「本案的案件基本事实为」「争议焦点」「本院认为」三类说理节点切分，生成带标签的段落，供前端折叠展示与导出 Word 使用。

### 4. `buildSemanticQuery()` — 检索串构造
- 若用户上传了文档，取「【我的问题】」之后的提问部分，不把整篇文档塞进检索串
- 检索串截断到 400 字，过长会稀释语义指向
- AI 分析出的案由/关键词追加为提示，但不替代原文

### 5. `analyzeQuestionWithAI()` — 过滤条件分析
语义检索本身已能理解问题，AI 分析的职责缩小为**补充枚举型过滤条件**：

```json
{
  "caseType": "民事案件",
  "cause": "劳动合同纠纷",
  "keywords": ["违法解除", "经济补偿"],
  "partyStanding": "原告方",
  "userIntent": "一句话概括"
}
```

该调用的 thinking 被显式关闭（`thinking.type = disabled`），只求结构化输出、降低延迟；失败也不影响检索。

### 6. 过滤条件回退
`wenshu_type` / `ay` 是精确枚举过滤，AI 判断偏差时会**直接查空**。
所以命中为空且带过滤条件时，自动去掉过滤条件再检索一次（纯语义召回）。

## 工作流程

```
1. 用户提交问题（可选带文档）
   ↓
2. 并行：AI 分析过滤条件（容错）+ 语义检索准备
   ↓
3. POST /open/case_vector_search   ← X-API-Key 鉴权
   ↓
4. 命中为空且带过滤 → 去掉过滤重试
   ↓
5. normalizeYuandianCase() 归一化 + 按说理节点分段
   ↓
6. 注入系统提示词（含相似度、案号、法院、案例正文摘录）
   ↓
7. 调用模型（DeepSeek-V4.1-Flash-1017 / 通义法睿-Plus）流式生成
   ↓
8. 正文后附加案例详情附录，返回前端
```

## 系统提示词配合

检索结果是否被"用好"，很大程度取决于提示词。本次同步强化了以下约束：

1. **先判断相关性再引用**：争点不同就明说"该案争点与您的问题不同"，不硬套。
2. **引用必须落地**：案号 + 法院 + 裁判要点 + 支持的是哪个结论。
3. **案例不作普遍规则**：表述为"该案中法院认为……"，而非"法律规定……"。
4. **不得添加案例中不存在的事实与结果，不得改写案号**。
5. **关联度低时承认没找到**，并给出改进检索的建议。
6. **正文不重复罗列案号法院**（由文末附录统一给出），正文只写参考价值。

## 配置要求

- **环境变量**：`supabase secrets set YUANDIAN_API_KEY=<你的 key>`（也兼容 `YUANDIAN_KEY`）
- **数据库**：`api_configs` 中 DeepSeek 记录的 `model_name` 改为 `deepseek-flash`
- **数据库**：`base_prompts` 中激活记录更新为新的系统提示词
- 以上数据库改动见 `supabase/migrations/20261109000000_switch_to_yuandian_and_deepseek_v41_flash.sql`

## 计费

元典案例语义检索按次计费（15 POINT/次）。因此：
- 只在用户开启"类案检索"时才调用
- `return_num` 直接等于用户选择的案例数量（1-5），不做额外放大
- 只有在过滤条件命中为空时才发生第二次调用

## 降级机制

| 情况 | 行为 |
| --- | --- |
| AI 过滤条件分析失败 | 忽略过滤，纯语义检索 |
| 带过滤检索为空 | 去掉 `wenshu_filter` 重试 |
| 接口超时（60s） | 返回 `null`，对话继续，仅无案例 |
| 未配 Key | `getYuandianApiKey` 抛错，被 `collectCaseContext` 捕获，对话继续 |
| 检索无结果 | 提示"未检索到相关案例"，正常生成回答 |

## 测试建议

1. **同义表述**：用与条文完全不同的口语描述同一事实，确认仍能召回。
2. **跨案由**：劳动争议 vs 劳务合同，确认不会串案由召回。
3. **过滤回退**：构造一个 AI 会误判案由的问题，确认第二次检索仍能返回结果。
4. **相关性**：故意问一个案例库很冷门的问题，确认模型会承认"未找到高度匹配类案"而不是硬套。
5. **前端展示**：确认案例卡片能展开正文分段，且"导出案例"生成的 Word 含案号、法院、分段正文。
