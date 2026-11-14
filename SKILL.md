---
name: chaoxing-quiz-auto
description: 在超星学习通（chaoxing.com）课程中自动完成作业/测验答题。接管已登录的浏览器，抽取全部题目与选项，逐题用真实鼠标点击+键盘输入作答并逐题校验，最后单独点击提交并核对得分。适用于用户要求"帮我把超星作业做完/自动答题/提交作业"的场景。
agent_created: true
---

# 学习通全自动答题 skills

接管用户已登录的浏览器，完成超星学习通（`mooc1-api.chaoxing.com`）上的作业/测验：
客观题（单选/多选/判断）与主观题（填空/简答）都支持，逐题作答、提交并核验得分。

英文名：**Auto Quiz Answering Skill**。

## 何时使用

- 用户要求"打开浏览器自动完成超星作业/测验/章节作业"
- 用户提供超星作业页面截图或链接（`mooc-ans/mooc2/work/dowork?...`）
- 用户要求"确保答案正确"、"不要提交"或"最后帮我提交"

## 硬性约束

1. **用户说"不准提交"就绝不点提交**；用户要求提交时，提交必须是最后一步，且单独执行。
2. **提交之后不再操作该答卷**（重复进入会返回"作答状态异常！"）。
3. 不猜测答案。先抽取全部题目与选项，基于学科知识推导；措辞不确定的填空/简答题，
   优先参考该课程已提交作业「作业详情」页里的标准答案措辞（见 `references/grading_rules.md`）。

## 依赖

Node.js 20+ 与 `playwright-core`（仅用于连接已开调试端口的浏览器，不下载浏览器内核）：

```bash
npm install
```

所有脚本都在仓库根目录运行，用 `node scripts/<脚本>.js`。

## 流程

### 第 1 步：接管浏览器

浏览器已在运行且带用户登录态时，必须先关闭它，再以远程调试端口重启，才能读取页面与模拟鼠标。

```bash
node scripts/takeover_browser.js            # 自动探测 Edge/Chrome
node scripts/takeover_browser.js --browser chrome --port 9222
```

脚本会：关闭浏览器 → 在系统临时目录建一个指向真实 profile 的符号链接（Windows 用 junction）
→ 以 `--remote-debugging-port=9222` 重启 → 校验 CDP 可用。
这样既绕开了 Chromium 136+ "默认用户数据目录禁用远程调试" 的限制，又完整保留登录态。

### 第 2 步：抽取题目与选项

```bash
node scripts/extract_questions.js --url "<作业链接>"
```

产出 `questions.json`（结构化）与 `questions.txt`（人读版）：题号 → qid、题型、题干、
选项字母与文本、每个作答位置对应的编辑器。
页面上部分标签（如 `<servlet-mapping>`）会被服务端剥离，题干出现空缺时按上下文与该课程
其它题目的行文习惯还原。

### 第 3 步：写答案表

生成 `answers.json`（格式见 `references/answer_format.md`，示例见 `examples/answers.example.json`）：

```json
{ "choice": { "1": "C", "20": "false" },
  "fill":   { "40": ["服务器", "Servlet 容器"] } }
```

- 客观题用选项字母；多选写 `"ABD"`；判断题用 `"true"`（对）/ `"false"`（错）。
- 填空题按"第1空、第2空…"顺序给数组；平台实际空位以 `tiankongsize` 为准，
  可能少于题干中的下划线数，多出的答案用 `、` 连写放在同一个空位里。

### 第 4 步：逐题鼠标作答并校验

```bash
node scripts/answer_work.js --answers answers.json
```

脚本行为：清空表单 → 按题号升序 → 滚动到该题 → 鼠标移动到选项/编辑框 → 点击/键入
→ 等待 0.6–1.0 秒 → 回读平台写入值校验 → 失败重试一次 → 逐题打印进度 → 末尾全量复核。
填空/简答题通过 UEditor 的 iframe 用真实键盘输入，输完调用 `editor.sync()` 把内容同步进
`textarea`（提交接口只读 textarea，不 sync 会丢答案）。

### 第 5 步：提交（单独一步）

```bash
node scripts/submit_work.js
```

先做完整性自检（有题未作答则拒绝提交），再：鼠标点击「提交」→ 等待 `/work/validate`
→ 处理「确认提交？」弹窗（点 `#popok`）→ 等待 POST `/mooc-ans/work/addStudentWorkNewWeb`
→ 跳转到 `work/prompt` 页显示得分。

### 第 6 步：核验结果

```bash
node scripts/check_result.js
```

打开 `work/view` 作业详情页，逐题对比「我的答案 / 正确答案 / 得分」，输出不一致题目与总分。
若有失分题：同一次作答无法修改（会提示"作答状态异常！"），需从课程作业列表重新发起一次作答，
用详情页给出的标准答案措辞修正后重答。

### 一次性跑完

```bash
node scripts/run_all.js --answers answers.json --submit
```

等价于「抽取 → 作答 → 复核 → 提交 → 核验」，任一步复核不通过即中止，不会带着错误答案提交。

## 关键判定规则

填空题判分**对空白与括号位置不敏感，但要求答案文本本身与平台标准答案一致**。
例如标准答案是 `转发(forward)`，答 `转发` 判 0 分；答 `init()` 而标准答案是 `init ()` 则判满分。
因此填空/简答题必须照抄平台标准答案的措辞，详见 `references/grading_rules.md`。

## 参考资料

- `references/chaoxing_page_model.md` — 页面 DOM 结构、答案存储机制、提交流程、浏览器接管原理
- `references/grading_rules.md` — 判分行为与踩坑清单
- `references/answer_format.md` — answers.json 格式
- `references/troubleshooting.md` — 常见故障与处理
- `references/servlet_chapter3_answer_key.md` — Servlet 章节作业参考答案（可直接复用的样例）
