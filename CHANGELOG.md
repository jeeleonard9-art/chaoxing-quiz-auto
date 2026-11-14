# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-11-14

修复与增强，主要来自一位真实用户在另一台电脑上跑完整流程后反馈的问题。

### Fixed

- **`takeover_browser.js` 在 Windows 上探测不到浏览器**（P0）：
  `process.platform` 在 Windows 是 `win32`，而配置表用的键是 `win`，
  `BROWSERS[key][process.platform]` 恒为 `undefined` → 永远找不到浏览器。
  新增 `platformKey()` 做 `win32 → win` 映射，三处索引（可执行文件 / 配置目录 / 进程名）统一修正。
- **关闭浏览器依赖 PATH 里的 `taskkill`**：改为用
  `%SystemRoot%\System32\taskkill.exe` 全路径调用。
- **判分核验误报满分题**：平台把同一空的多个答案点写进标准答案文本时
  （如 `sendRedirect ();其他 Web 应用`），旧逻辑判成"答案不一致"。
  新增 `splitPoints()` / `answerHit()`，按"命中任一答案点即算对"的口径比对。
- **DOM 测试在慢机器/受限环境上偶发失败**：改为先等题目节点出现再断言，
  起浏览器失败时降级为 skip，不再让流水线变红。

### Added

- **提交前先「暂时保存」**（`submit_work.js` 默认行为，`--no-save` 可关）：
  - 绕开部分版本平台页面 `submitValidate()` 只在 `/work/validate` 返回 status 2/3 时才继续、
    正常返回（302 → status 0）没有 else 分支，导致**点「提交」毫无反应**的问题；
  - 先落一次草稿，避免学习通风控或偶发 bug 把整份作答清空。
- **提交护栏**：确认框出现「未做完 / 未作答 / 还有…」时拒绝点击确认并退出（退出码 4），
  同时保存现场截图 `submit_blocked.png`；确认框没出现时自动调用平台自身的
  `ready2Submit()` 兜底。
- **无 git 环境的安装兜底**：`install.sh` / `install.ps1` 检测到没有 git 时自动下载
  GitHub zip 包解压安装。
- 故障排查文档补充「点了提交没反应」「没有 git 怎么装」「DOM 测试失败」三类条目。
- README（中英）补充提交前暂时保存的原因、平台 302 缺陷说明，以及
  "工具只代劳点鼠标敲字、答案仍需使用者认可"的使用边界说明。

### Changed

- 单元测试从 9 个增加到 11 个（新增 `splitPoints` 与 `answerHit` 的判分口径用例）。
- `check_result.js` 全部一致时额外打印「全部答案与平台标准答案一致 ✓」。

## [1.0.0] — 2026-11-14

### Added

- **浏览器接管** `scripts/takeover_browser.js`：跨平台（Windows / macOS / Linux），
  自动探测 Edge / Chrome，通过"指向真实 profile 的符号链接"绕开 Chromium 136+
  "默认用户数据目录禁用远程调试"限制，同时完整保留登录态与会话恢复。
- **抽题** `scripts/extract_questions.js`：输出结构化 `questions.json` 与人读版
  `questions.txt`，标注被服务端剥离的尖括号标签。
- **作答** `scripts/answer_work.js`：按题号升序逐题作答，客观题用真实鼠标点击
  选项字母，填空/简答题用真实键盘在 UEditor iframe 内输入；每题间隔可配，
  逐题回读平台写入值校验，失败自动重试一次，末尾全量复核并以退出码反映结果。
- **提交** `scripts/submit_work.js`：提交前完整性自检（缺题拒绝提交），
  鼠标点击「提交」→ 处理「确认提交？」弹窗 → 等待落库 → 报告结果。
- **核验** `scripts/check_result.js`：解析作业详情页，逐题比对「我的答案 / 正确答案 /
  得分」，输出失分题与总分。
- **一键流程** `scripts/run_all.js`：抽取 → 作答 → （提交）→ 核验，任一步复核不通过即中止。
- **单元测试** `tests/answers_util.test.js`：答案分配、文本归一化、答案表校验、参数解析。
- **参考文档**：DOM 结构与提交流程、判分口径踩坑清单、答案表格式、故障排查、
  Servlet 章节完整参考答案。
- 中英双语 README、安装脚本（`install.sh` / `install.ps1`）、CI 工作流
  （ubuntu / macos / windows × Node 20 / 22 / 24）。

### Known limitations

- macOS / Linux 的浏览器接管与作答路径已实现但**未在真机验证**（仅 Windows + Edge 实测通过）。
- 平台要求验证码时会停止并报错，不做绕过。
- 提交后同一份答卷不可修改（超星限制），需从课程作业列表重新发起一次作答。
