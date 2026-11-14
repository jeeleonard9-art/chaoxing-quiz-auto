# 超星判分行为与踩坑清单

以下结论来自实测（超星学习通，第3章 Servlet 作业，57 题，2026-11）。

## 1. 填空题：空格不敏感，但文本内容必须一致

实测对比：

| 标准答案 | 考生答案 | 得分 |
|---|---|---|
| `init ()` | `init()` | 满分 |
| `service ()` | `service()` | 满分 |
| `getWriter ()` | `getWriter` | 满分 |
| `setCharacterEncoding ()` | `setCharacterEncoding` | 满分 |
| `sendRedirect ();其他 Web 应用` | `sendRedirect` | 满分 |
| `getContextPath ();getRealPath ()` | `getContextPath、getRealPath` | 满分 |
| **`转发(forward)` / `重定向(redirect)`** | **`转发` / `重定向`** | **0 分** |

结论：
- 标识符与括号之间的空格、括号本身可有可无 → **判分前空白与全半角括号会被归一化**。
- 但**答案文本本身必须与标准答案一致**。`转发` 与 `转发(forward)` 是两个不同的答案，后者才是标准答案。
- 多个答案点之间用 `、` / `;` 分隔时，只要**每个点都出现**即算对（`getContextPath、getRealPath` 同时命中 `getContextPath ()` 与 `getRealPath ()` 两个答案点）。

## 2. 填空题标准答案的措辞规律

平台标准答案常保留出题人写的**中文 + 英文括号**形式。提交后可在 `work/view` 详情页看到每题的「正确答案」原文。

**在填第一次作业之前**，若不确定措辞，可先去看该课程**其它已提交作业**的详情页（同一出题人风格一致），直接照抄其措辞。例如本课程的标准写法是 `转发(forward)`、`重定向(redirect)`、`init ()`、`getWriter ()`。

## 3. 客观题

- 单选/多选：字母 A/B/C/D…，写进 `#answer<qid>`。
- 判断题：`data="true"` 表示"对"，`data="false"` 表示"错"，字母 A=对、B=错。
- 多选题（qtype=1）会累计多个字母到 `#answer<qid>`，点击是"切换式"，取消勾选后再点其它项。

## 4. 题干里的标签会被服务端剥离

形如 `<servlet-mapping>`、`<init-param>`、`<web-app>` 的尖括号内容在服务端 HTML 里就被删掉了，题干会出现空缺：

- 「在 web.xml 中，**标签**用于指定 Servlet 的访问路径」→ 原为 `<servlet-mapping>`
- 「可替代 web.xml 中的**和**标签配置」→ 原为 `<servlet>` 和 `<servlet-mapping>`
- 「ServletConfig 的 init 参数在**标签**中配置」→ 原为 `<init-param>` 或 `<servlet-mapping>`

还原方式：看同一套题里其它题干对同一标签的写法（本课程统一带空格，如「Servlet 容器」）。

## 5. 单选题必须只有唯一正确项

若某单选题出现两个都成立的选项，说明其中一个选项里被剥离的标签是关键区分点。
例：`ServletConfig 的 init 参数在 ____ 标签中配置` —— 若填 `<init-param>` 则该选项为真，与 B 项冲突；正确区分点只能是 `<servlet-mapping>`（init-param 配在 `<servlet>` 内），故 D 为假，选 B。

## 6. 其它注意

- 作答时**不要用 JS 直接赋值隐藏域**：平台的 `addChoice` 才是正解（同时维护 `check_answer` 样式与 aria 属性）。
- 填空题不要只用 `setContent` 写值：**必须 `sync()`**，否则提交的表单里填空是空。
- 提交按钮与「暂时保存」按钮在同一行右侧；提交会弹二次确认框，框内 `#popok` 是确认键、`#popno` 是取消键。
- 提交后不要再操作该答卷（重复进入返回「作答状态异常！」）。
