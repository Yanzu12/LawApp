---
version: 1
slug: "main-src-components-chatinterface-tsx"
primary_target: "main/src/components/ChatInterface.tsx"
related_targets: []
---

# Surface: 聊天主界面 + 登录页

Mode: Operate（工作任务界面，非营销页）
Audience: 法学院学生在模拟法庭备赛时、教师与研究人员在课堂与研究中，桌面端长时间阅读。
Job: 提问 → 读长回答 → 展开思维链/相关案例 → 查法条原文 → 导出 Word，之间来回对照不被打断。
Constraints: 保留全部现有功能与交互（双模型、思维链、类案检索 1–5、文档上传、历史对话、法律文库、明暗双主题）；保留院徽与"吉林大学法学院"署名；中文。

## Direction contract

THESIS: 这是一个编目台，不是聊天玩具。每个回答是一张卡片目录里的编目卡：它的款目行（模型、时间、检索状态、字数）先于正文出现，编号挂在左侧索引标签上。拒绝的是品类默认——白底、一个蓝色气泡、头像圆点、居中单列。

OWN-WORLD: 冷调档案骨白 #EDEAE1 纸面、#191A18 墨色正文、#1F3A66 院徽藏青作为唯一操作色、#8A2B1E 印泥朱红只用于封泥标记与危险操作。单一无衬线 UI 字体承载标签与控件；衬线只出现在品牌块与法条原文（法条是成文法文本，衬线是语义而非装饰）。等宽仅用于元数据数字与案号。控件全部是标准控件：按钮、分段控件、输入框、开关、原生弹层。

STORY: 用户第一秒看到左侧目录抽屉（会话与法条分类）、中间一条编目卡流、底部带标签的输入台；明白这是一台可以逐项对照的检索仪器，然后立刻发问、展开案例、导出。

FIRST VIEWPORT: 左侧 264px 目录栏（校徽 + 站名在上，法条分类在中，会话目录在下，底部账户行），细发丝线分隔，无卡片阴影；右侧主列：顶部一条与目录同轴的工具栏（标题、主题、历史、用户），中部消息流每张卡左侧带 22px 索引标签、顶部一条款目行；底部固定输入台（附件标签、模型分段、高级选项、发送）。主操作"发送"在输入台右端，藏青实心。

FORM: 自有候选 5（共 7 个），意译为"宪法相关法/民法法系的检索卡片目录"。seed: 75f0bfe49cfda2c6

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
