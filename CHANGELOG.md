# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  （ubuntu / macos / windows × Node 18 / 20 / 22）。

### Known limitations

- macOS / Linux 的浏览器接管与作答路径已实现但**未在真机验证**（仅 Windows + Edge 实测通过）。
- 平台要求验证码时会停止并报错，不做绕过。
- 提交后同一份答卷不可修改（超星限制），需从课程作业列表重新发起一次作答。
