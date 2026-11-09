# Design — 法律知识助手 · 编目台

<!-- impeccable:design-schema 1 -->

本文件记录已构建的视觉系统。所有值来自 `main/src/index.css` 的 `:root` 与 `.dark`，改代码时同步更新此处。

## Identity

**编目台。** 界面是一只法学院图书馆的卡片目录：提问是权属块，回答是编目卡，编号挂在左侧索引栏上。它是检索仪器，不是聊天玩具。

拒绝的品类默认：白底、一个圆角蓝色气泡、头像圆点、居中单列、通义/DeepSeek 两个模型的裸下拉。

应用场景：法学院学生备赛、教师做案例教学，桌面端长时间阅读，室内光。

## Color

两套主题，同一套语义令牌。界面 95% 为中性纸面与墨色；色彩只做三件事：操作、标记、状态。

### Light

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--paper` | `#EDEAE1` | 页面地面（冷调骨白） |
| `--paper-deep` | `#E4DFD2` | 目录栏、输入台等第二层地面 |
| `--card` | `#FBF8F0` | 编目卡、浮层、输入框 |
| `--card-2` | `#F3EEE2` | 卡头、嵌套区、悬停 |
| `--ink` | `#191A18` | 正文与标题（13.5:1 on paper） |
| `--ink-2` | `#4B4D46` | 次级正文（6.7:1） |
| `--ink-3` | `#6B6C63` | 元数据、占位符（4.7:1，下限） |
| `--rule` | `rgba(25,26,24,.13)` | 发丝线 |
| `--rule-strong` | `rgba(25,26,24,.26)` | 控件边框、分隔 |
| `--action` | `#1F3A66` | 院徽藏青：主按钮、焦点、链接、选中的段 |
| `--action-ink` | `#FBF8F0` | 藏青上的文字（10.3:1） |
| `--action-soft` | `#DDE3EE` | 开关开启态、轻选中底 |
| `--seal` | `#8A2B1E` | 印泥朱红：提问的左侧权属线、流式光标、危险操作 |
| `--seal-ink` | `#8A2B1E` | 朱红作为文字（5.97:1 on paper） |
| `--seal-soft` | `#F1E0DA` | 朱红的浅底（消息跳转闪烁） |
| `--ok` / `--warn` | `#2F6B4F` / `#7A4F12` | 状态 |
| `--sel` | `#C9D6EA` | 文本选中 |

### Dark

`--paper #17181A`、`--paper-deep #111214`、`--card #212325`、`--card-2 #1A1C1E`、`--ink #E6E2D6`、`--ink-2 #B9B5A8`、`--ink-3 #9B9587`、`--action #2E4E80`、`--seal-ink #DE8B7A`。暗色是独立的第二套纸色，不是亮色的反相。

**规则：** 朱红只用于标记与危险，绝不用于主按钮；藏青是唯一的操作色；不用紫/薰衣草；不用渐变文字、不用彩色左侧粗边（提问的 2px 权属线是结构而非装饰）。

## Type

| 令牌 | 值 |
| --- | --- |
| `--font-sans` | Inter → PingFang SC → HarmonyOS Sans SC → Microsoft YaHei → system-ui |
| `--font-serif` | Source Han Serif SC → Songti SC → SimSun → Georgia |
| `--font-mono` | ui-monospace → SF Mono → JetBrains Mono → Consolas |

- **无衬线**承载全部 UI：标题、按钮、标签、表格。字号固定 rem，不做流式缩放。
- **衬线只出现在两个语义位置**：登录页的主张句，与法条原文（`.statute .md`）。成文法用衬线是语义，不是装饰。
- **等宽只用于元数据**：`.entry-line` 12px / 字距 .04em / 数字等宽。款目行、案号、计数、时间。
- 正文 16px / 行高 1.78 / 最大 68ch（`.measure`）；卡片正文同上；13px 是元数据下限，正文不低于 15px。
- 标题阶梯：h1 22 / h2 18 / h3 16 / h4 15（卡内 Markdown）；页面 h1 15px 是工具栏标题，不是内容标题。
- 标题上方留白大于下方（h2：28px 上 / 10px 下）。

## Shape and elevation

- 圆角只有一档：`--radius: 2px`。胶囊只用于开关轨道。
- **编目卡靠线不靠影**：1px 发丝线 + 无阴影。阴影只给浮层（下拉、抽屉），且必须带偏移与柔和模糊：`0 8px 24px -8px rgba(0,0,0,.28)`。
- 禁止：0 偏移彩色光晕、硬偏移块影、卡片左侧彩色竖条（>1px）。

## Components

| 组件 | 规则 |
| --- | --- |
| `.btn` | 一种形状。默认描边、`.btn-primary` 藏青实心、`.btn-quiet` 无边框。hover 提亮一档，active 下移 1px。 |
| `.btn-icon` | 36×36，图标 16px。 |
| `.tool-btn` | 工具栏与输入台的裸按钮：32px 高，`data-on` 表示选中。 |
| `.rail-row` | 目录行；`data-active` 时左侧 2px 朱红短线。 |
| `.entry-line` | 款目行：等宽 12px，用 `.sep` 分隔（·）。 |
| `.field-label` | 13px / 500 的字段名。 |
| 开关 | 36×18 轨道，藏青开启；`role="switch"` + `aria-checked`。 |
| 分段控件 | 1px 边框容器，选中项藏青填充，`aria-pressed`。 |
| 消息 | 提问 = 左侧 2px 朱红线的权属块；回答 = 编目卡（款目行 + 正文）。**没有气泡，没有头像圆点。** |
| 表单 | 错误落在字段下（`aria-describedby`），不用飘窗 toast 代替字段错误。 |

## Rhythm

- 侧栏 272px；主列内容宽 980px 居中；消息行距 32px。
- 间距阶梯：4 / 8 / 12 / 16 / 24 / 32 / 48。
- 每张卡：款目行 32px 高 + 内边距 16px。

## Motion

- 时长 130–240ms；缓动 `cubic-bezier(.2,.7,.3,1)`。
- 动效只表达状态：浮层进出、开关滑动、流式光标脉动（1.1s）、消息落位（200ms）、跳转定位的朱红闪烁（1.8s，一次）。
- 没有滚动淡入、没有视差、没有与滚动绑定的动效。
- `prefers-reduced-motion: reduce` 下全部静止，内容绝不因此隐藏。

## Browser surfaces

属于设计的一部分，不得交给默认值：文本选中色 `--sel`、光标色 `--action`、滚动条（10px，透明轨道，`--rule-strong` 拇指）、焦点环（2px 藏青 + 2px 偏移）、数字等宽（`.tnum`）。

## Accessibility

- 正文与占位符 ≥ 4.5:1；大字 ≥ 3:1。上表已标注关键组合的实测值。
- 触控目标 ≥ 36px（桌面）；移动端主要操作为 36–44px。
- 键盘：Esc 关闭全部浮层；抽屉与章节阅读器为 `role="dialog"` + `aria-modal`；每个图标按钮都有 `aria-label`。
- 中文界面，`lang="zh-CN"`。
