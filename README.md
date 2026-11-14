# 学习通全自动答题 skills

[![CI](https://github.com/jeeleonard9-art/chaoxing-quiz-auto/actions/workflows/ci.yml/badge.svg)](https://github.com/jeeleonard9-art/chaoxing-quiz-auto/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> English name: **Auto Quiz Answering Skill** · 英文文档见 [README_EN.md](README_EN.md)

> **关于仓库名**：GitHub 会直接丢弃仓库名中的非 ASCII 字符（纯中文名会被规范化成 `-skills`），
> 所以仓库名固定为 `chaoxing-quiz-auto`。技能显示名为 **学习通全自动答题 skills**，
> 英文名 **Auto Quiz Answering Skill**；克隆后目录名即 `chaoxing-quiz-auto`，
> 与 `SKILL.md` 里的 `name` 字段一致，可直接放进任意 skills 目录。

接管你**已经登录**的浏览器，把超星学习通（chaoxing.com）上的作业/测验自动做完：
抽题 → 逐题用真实鼠标点击 + 键盘输入作答 → 逐题回读校验 → 单独点提交 → 核对逐题得分。

```
接管浏览器(CDP) → 抽取题目与选项 → 写答案表 → 逐题鼠标作答+校验 → 提交 → 逐题核验得分
```

## 它解决什么问题

超星学习通的作业页是一长条动态表单：几十道单选、判断、填空题，每题都要点选项或往
富文本框里敲字，还要在页面右侧的小题号面板之间来回跳。手工做一遍不难，但**重复做、
改一版再做一遍**非常痛苦——尤其是刷章节作业或者错题重做。

这个工具把这件事变成一条命令：

```bash
node scripts/run_all.js --answers answers.json --submit
```

它不是"把答案糊到隐藏域上"，而是**真的用鼠标点、真的用键盘敲**，每题点完都回读
平台的写入值确认命中，错了自动重试一次。所以它既能扛住页面的异步渲染，也不会因为
一次点击落空而悄悄留下空白题。

## 实测效果

| 场景 | 结果 |
|---|---|
| 《Java Web 程序设计》第3章 Servlet 作业 | 57 题（19 单选 + 20 判断 + 18 填空），逐题鼠标作答，程序复核 **0 处偏差** |
| 平台判分 | 98.2 / 100 —— 唯一失分是第 51 题填空，标准答案是 `转发(forward)` 而填了 `转发`（见下文） |

那次 98.2 分反而是最有价值的产出：**它把超星的判分口径实测清楚了**，
并写进了 `references/grading_rules.md`，下次同类作业不会再踩同一个坑。

## ⚠️ 先读这一条：提交是不可逆的

超星学习通的作业一旦提交：

- **同一份答卷不能再修改**，重新进入作答页只会返回「**作答状态异常！**」；
- 想改答案，只能去课程作业列表**重新发起一次作答**（老师开了"可重做"才行）。

所以工具的设计是**把提交单独拆成一步**，并在下单前做两件事：
`answer_work.js` 末尾的**全量复核**（不一致就打印 ✗ 并以退出码 2 结束），
以及 `submit_work.js` 开头的**完整性自检**（有任何一题没答案就直接拒绝提交）。

**如果你只想要"填好但不交"**，跑 `answer_work.js` 就停，不要跑 `submit_work.js`。

## ⚠️ 提交前为什么先点「暂时保存」

真实用户在另一台电脑上跑这套流程时踩到过一个平台侧的问题：**直接点「提交」毫无反应**——
`/work/validate` 返回 302，页面既不弹确认框也不发提交请求，URL 也不跳转。

根因是部分版本学习通页面自身的缺陷：`submitValidate()` 只在 `/work/validate` 返回 `status` 为 2/3 时
才继续走 `ready2Submit()`，正常返回（302 → status 0）没有 else 分支。

**先点一次「暂时保存」再点「提交」，确认弹窗就会正常弹出并走完**
`submitCheckTimes → submitWork → confirmSubmitWork → POST addStudentWorkNewWeb`。

所以 `submit_work.js` 的默认顺序是：

```
完整性自检 → 暂时保存（草稿落库）→ 点「提交」→ 处理「确认提交？」弹窗 → 报告结果
```

这同时解决了两件事：绕开平台那个 302 分支；以及**先落一次草稿**，避免学习通风控或偶发 bug
让整份作答被清空——草稿在服务器上，页面出问题也能恢复。

脚本另有两道护栏：确认框里若出现「未做完 / 未作答 / 还有…」字样，**拒绝点击确认**并退出（退出码 4）；
点「提交」后确认框没出现时，自动调用平台自身的 `ready2Submit()` 兜底。

## ⚠️ 第二个坑：填空题的判分口径

超星填空题判分时**会归一化空白与括号位置，但要求答案文本本身与标准答案一致**：

| 平台标准答案 | 你的答案 | 得分 |
|---|---|---|
| `init ()` | `init()` | ✅ 满分 |
| `getWriter ()` | `getWriter` | ✅ 满分 |
| `getContextPath ();getRealPath ()` | `getContextPath、getRealPath` | ✅ 满分 |
| **`转发(forward)` / `重定向(redirect)`** | **`转发` / `重定向`** | ❌ **0 分** |

也就是说，**中文 + 英文括注**的写法（`转发(forward)`）才是标准答案，只写中文会被判错。
`check_result.js` 会在提交后把每题的「正确答案」原文打出来，照着改就能拿满分。

## 兼容性

### 按运行方式

| 你的 agent 支持什么 | 能不能用 | 怎么接 |
|---|---|---|
| Skill 机制（WorkBuddy、Claude Code、兼容 Agent Skills 规范的运行时） | ✅ | 直接用 `SKILL.md`，模型自行决定何时调用 |
| 命令行 / 任何语言 | ✅ | 直接执行 `scripts/*.js`，全部输出人可读文本 |
| MCP | ⚠️ | 本仓库未内置 MCP 适配层，可自行包一层 stdio server |
| 只能发 HTTP 请求、不能起本地进程 | ❌ | 浏览器接管必须能操作本机进程 |

`SKILL.md` frontmatter 里的 `agent_created: true` 是 WorkBuddy 的私有字段，
其他运行时通常会忽略未知字段；严格校验的运行时删掉这一行即可。

### 按题型

| 题型 | 平台 answertype | 支持 |
|---|---|---|
| 单选题 | 0 | ✅ |
| 多选题 | 1 | ✅（答案表写 `"ABD"`，脚本依次点击各字母） |
| 判断题 | 3 | ✅（答案表写 `true` / `false`） |
| 填空题 | 2 | ✅（UEditor 富文本，真实键盘输入） |
| 简答/论述等主观题 | 4/5/6/7/8/18… | ✅（单编辑器，同样走 UEditor 输入） |

### 按平台

| 平台 | 浏览器接管 | 作答 | 状态 |
|---|---|---|---|
| Windows 10/11 + Edge | ✅ 实测 | ✅ 实测 | 完整跑通（2026-11-14，Edge 157） |
| Windows + Chrome | ✅ 同一套逻辑 | 未实测 | — |
| macOS | ✅ 已实现 | 未实测 | 见 `references/troubleshooting.md` |
| Linux | ✅ 已实现 | 未实测 | 见 `references/troubleshooting.md` |

**诚实说明**：只有 Windows + Edge 是真机跑通的。macOS / Linux 的浏览器路径解析、
符号链接与进程关闭都已实现，但**没有在真机上验证过**。
如果你在 mac/Linux 上跑通了或跑挂了，欢迎提 issue。

### 平台要求

- Node.js 20+（playwright-core 1.6x 要求 20 以上；CI 覆盖 20 / 22 / 24 × ubuntu / macos / windows）
- 唯一一个依赖：`playwright-core`（只做 CDP 连接，不下载浏览器内核）
- 需要本机已安装 Edge 或 Chrome，且**已经登录**学习通

## 安装

### 方式一：作为 Skill（推荐）

```bash
# WorkBuddy
bash install.sh
# 或手动
git clone https://github.com/jeeleonard9-art/chaoxing-quiz-auto.git \
  "$HOME/.workbuddy/skills/chaoxing-quiz-auto"

# Claude Code
git clone https://github.com/jeeleonard9-art/chaoxing-quiz-auto.git \
  ~/.claude/skills/chaoxing-quiz-auto
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

**本机没有 git 也没关系**：安装脚本会检测到没有 git 时自动改用 GitHub zip 包下载并解压。
也可以直接下载 zip（<https://github.com/jeeleonard9-art/chaoxing-quiz-auto/archive/refs/heads/main.zip>），
解压后把目录改名成 `chaoxing-quiz-auto` 放进 skills 目录，再在该目录执行 `npm install`。

重启会话后生效。模型会根据 `description` 里的触发条件自行调用。

### 方式二：纯命令行

```bash
git clone https://github.com/jeeleonard9-art/chaoxing-quiz-auto.git
cd chaoxing-quiz-auto
npm install
```

## 在别的 AI 助手上使用（含豆包）

把下面这段直接发给豆包或其他 AI 助手即可（前提是已按上面的方式下载本仓库）：

```
我已从 GitHub 下载了「学习通全自动答题 skills」（https://github.com/jeeleonard9-art/chaoxing-quiz-auto），请先按它的 README 把技能装到你的技能目录（需 Node.js 20+ 并执行 npm install），然后用它帮我完成这份超星学习通作业：接管我已登录的浏览器 → 抽取全部题目与选项 → 逐题用真实鼠标点击与键盘输入作答、每题回读校验 → 作答完成后先把结果交给我确认，我回复「提交」后你再点提交 → 最后用 check_result.js 逐题核对得分，并把失分题连同平台给出的标准答案原文一起告诉我。
```

若该助手能操作浏览器但跑不了 Node 脚本，就让它读文档手动驱动：
`references/chaoxing_page_model.md`（页面结构与提交流程）+ `references/grading_rules.md`（判分口径）。

发送前请确认三件事：**Node.js 20+**、**浏览器里已登录学习通**、**作业页链接在手**。

## 用法

| 命令 | 作用 |
|---|---|
| `node scripts/takeover_browser.js` | 关闭浏览器并以 CDP 端口重启（保留登录态）；`--dry-run` 可只探测不接管 |
| `node scripts/extract_questions.js [--url <链接>]` | 抽取全部题目、选项、作答位置 |
| `node scripts/answer_work.js --answers answers.json` | 逐题鼠标作答 + 复核（不提交） |
| `node scripts/submit_work.js` | 完整性自检 → **暂时保存** → 点提交 → 处理确认弹窗 |
| `node scripts/check_result.js` | 逐题比对「我的答案 / 正确答案 / 得分」 |
| `node scripts/run_all.js --answers answers.json [--submit]` | 一键：抽取 → 作答 → （提交）→ 核验 |

常用参数：

| 参数 | 作用 |
|---|---|
| `--url <作业链接>` | 作业页没打开时用它打开 |
| `--answers <文件>` | 答案表路径，默认 `answers.json` |
| `--gap <毫秒>` | 每题之间的间隔，默认 700（人机节奏，别调太小） |
| `--keep` | 不清空表单，直接在现有状态上作答 |
| `--browser edge\|chrome` | 指定浏览器，默认自动探测 |
| `--port <端口>` | CDP 端口，默认 9222 |
| `--dry-run` | 只探测浏览器与配置目录，不关闭也不接管（先确认再动手） |
| `--dry-run` | 只探测浏览器与配置目录，不关闭也不接管（先确认再动手） |

### 典型流程

```bash
node scripts/takeover_browser.js
node scripts/extract_questions.js              # → questions.json / questions.txt
# 按题目内容写 answers.json（AI 助手可直接生成）
node scripts/answer_work.js --answers answers.json   # 复核全绿再继续
node scripts/submit_work.js                     # 提交
node scripts/check_result.js                    # 逐题核验
```

### 答案表格式

```json
{
  "choice": { "1": "C", "2": "B", "20": "false", "21": "false" },
  "fill":   { "40": ["服务器", "Servlet 容器"], "47": ["getWriter"] }
}
```

详见 `references/answer_format.md`，示例见 `examples/answers.example.json`。

## 工作原理

### 浏览器接管：用符号链接绕过"默认目录禁用远程调试"

Chromium 136+ 起，`--remote-debugging-port` **不能再用在默认用户数据目录上**：

```
--remote-debugging-port is disallowed with the default user data directory
```

这挡住了"直接开个调试端口接管你正在用的浏览器"这条路。工具的做法是：

1. 关闭浏览器（profile 被占用时无法另起实例）；
2. 在系统临时目录建一个**指向真实 profile 的符号链接**（Windows 用 junction，不需要管理员权限）；
3. 以 `--user-data-dir=<链接> --remote-debugging-port=9222 --restore-last-session` 重启。

路径字符串与默认值不同 → 通过校验；文件读写仍落在真实 profile 上 → **Cookie 与登录态原样保留**，
原来开着的标签页也会被恢复。

### 作答：走平台自己的事件处理器

- 客观题：真实鼠标移动到选项的字母上 → 点击 → 平台自己的 `addChoice()` 写值 + 打勾；
  脚本回读 `#answer<qid>` 与 `.check_answer` 确认命中。
- 填空/主观题：点击 UEditor 的 iframe → 真实键盘输入 → `editor.sync()` 把内容同步进 `textarea`。
  **这一步不能省**：提交接口只做 `$("#submitForm").serialize()`，不 sync 的话填空是空的。

### 提交：单独一步 + 两道闸

`submitValidate()` → `GET /work/validate` → `ready2Submit()` 逐题校验非空
→ `workPop("确认提交？")` → 点 `#popok` → `confirmSubmitWork()` POST 落库 → 跳 `work/prompt` 显示分数。

前置两道闸：`answer_work.js` 的复核（不一致退出码 2）与 `submit_work.js` 的完整性自检（缺题退出码 3）。

### 核验：`work/view` 详情页逐题比对

提交后进详情页，每题都有「我的答案 / 正确答案 / 答案解析 / 得分」，直接 diff 就能定位失分题。

## 目录结构

```
chaoxing-quiz-auto/
├── SKILL.md                      # Skill 描述（Agent 读这个）
├── README.md / README_EN.md      # 中 / 英文文档
├── package.json                  # npm install; npm test
├── install.sh / install.ps1      # 一键安装到 skills 目录
├── scripts/
│   ├── takeover_browser.js       # 浏览器接管（跨平台）
│   ├── lib.js                    # CDP 连接、题目结构读取、表单读写、鼠标模拟
│   ├── answers_util.js           # 纯函数：答案分配、文本归一化、参数解析
│   ├── extract_questions.js      # 抽题
│   ├── answer_work.js            # 逐题作答 + 复核
│   ├── submit_work.js            # 提交
│   ├── check_result.js           # 逐题核验
│   └── run_all.js                # 一键流程
├── references/
│   ├── chaoxing_page_model.md    # DOM 结构、答案存储、提交流程
│   ├── grading_rules.md          # 判分口径与踩坑清单
│   ├── answer_format.md          # 答案表格式
│   ├── troubleshooting.md        # 故障排查
│   └── servlet_chapter3_answer_key.md
├── examples/answers.example.json
└── tests/                        # 单元测试（node --test）
```

## CI 到底验证了什么

`CI` 工作流在 **ubuntu / macos / windows × Node 20 / 22 / 24** 九种组合上跑：

| 验证项 | 说明 |
|---|---|
| 脚本语法 | 所有 `scripts/*.js`、`tests/*.js` 过 `node --check` |
| 单元测试 | 答案分配、文本归一化、答案表校验、参数解析 共 9 个用例 |
| DOM 测试 | 用脱敏后的真实页面存档跑 `extractQuestions`：57 题、题型分布、选项字母、编辑器 iframe 序号一一校验（无浏览器时自动跳过） |
| SKILL.md 规范 | frontmatter 必须含 `name` 与 `description` |

**CI 不能证明的**：它不连真实浏览器、不碰真实学习通账号。
"在真机上能不能把作业点完"只有真机能回答——矩阵里那些"未实测"的格子就是它的意思。

## 安全边界

- 只操作**本机回环**接口（`127.0.0.1` 的 CDP 端口），不连任何远程服务
- 只在**用户自己的浏览器和自己的学习通账号**里作答
- 不绕过验证码（平台要验证码就停下报错，交人工）
- 不抓取、不上传课程内容或账号信息到任何第三方
- 提交与否由人决定：`answer_work.js` 跑完即止，提交是独立的一步
- 临时符号链接建在系统临时目录，删链接不影响真实 profile（不要对它递归删除）

### 关于「谁来作答」

这个工具**只负责代劳点鼠标和敲富文本框**，题目的答案仍需要使用者自己推导或认可——
答案表 `answers.json` 是由使用者（或 AI 助手）根据题目内容生成的。

如果某门课是**期末考核性质**，是否用工具代交由使用者自行权衡；用它做章节作业、
刷题、错题重做这类自我检验的场景则没有这个问题。交付时请把这一点说明清楚。

## License

[MIT](LICENSE)
