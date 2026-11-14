# 故障排查

## 浏览器接管

| 现象 | 原因 | 处理 |
|---|---|---|
| `ERR --remote-debugging-port is disallowed with the default user data directory` | Chromium 136+ 禁止在默认 profile 上开远程调试 | 用 `takeover_browser.js`（它会自动建符号链接绕过）；不要手动直接传默认目录 |
| `CDP 端口 9222 未就绪` | 浏览器没起来 / 被杀软拦了 | 检查浏览器进程是否被杀；换一个端口 `--port 9333` 再试 |
| 新开的浏览器没有登录态 | 用了新的 profile | 确认 `--user-data-dir` 指向的是**链接**而不是新目录；链接目标必须是真实 profile |
| 浏览器起来但标签页全没了 | `--restore-last-session` 未生效 | 手动打开作业页，再用 `--url` 传链接 |
| macOS 报 `EPERM` / 权限错 | 符号链接权限 | 换用真实路径的副本：`cp -R` 整个 profile 到临时目录再指向它 |

## 连接与页面

| 现象 | 原因 | 处理 |
|---|---|---|
| `未找到已打开的超星作业页` | 作业页没开 | 用 `--url "https://mooc1-api.chaoxing.com/mooc-ans/mooc2/work/dowork?..."` |
| `未找到「提交」按钮` | 页面已是提交后的只读状态 | 同一次答卷不能改，需从课程作业列表重新发起 |
| `作答状态异常！` | 用了已提交的 `answerId` | 同上，重新发起一次作答 |

## 作答

| 现象 | 原因 | 处理 |
|---|---|---|
| 某题一直点不中 | 选项被吸顶栏遮挡 / 元素不在视口 | 脚本已用 `scrollIntoView({block:'center'})`；若仍失败，手动把窗口调大或缩小缩放比例 |
| 填空题内容写进去又没了 | 没调用 `editor.sync()` | 脚本已自动 sync；若是自行改的代码，注意提交接口只读 textarea |
| 填空题复核显示空 | 编辑器 iframe 数量少于空位数 | 平台偶尔只建 1 个空位却写了 2 个下划线；把多答案用 `、` 合并填同一空 |
| 多选题只选上了最后一个 | 平台多选是"切换式"点击 | 答案表里写成 `"ABD"`，脚本会依次点击 A/B/D |
| `第N次点击未生效` | 网络/页面卡 | 脚本会自动重试一次；连续失败会停止并报错 |

## 提交

| 现象 | 原因 | 处理 |
|---|---|---|
| **点了「提交」毫无反应**：没有弹窗、没有 POST、URL 不跳转 | 部分版本平台页面的 `submitValidate()` 只在 `/work/validate` 返回 `status` 2/3 时才继续，正常返回（302 → status 0）没有 else 分支 | **先点「暂时保存」再点「提交」**（`submit_work.js` 默认就是这么做的）。脚本还会在确认框没出现时自动调用平台自身的 `ready2Submit()` 兜底 |
| 弹窗提示"还有未做完的" | 有题没答案 | 脚本会**拒绝点确认**并退出（退出码 4），截图存 `submit_blocked.png`；回到 `answer_work.js` 补齐后重试 |
| 弹窗提示"账号发生异常，请重新登录" | `validate` 返回 status=1 | 重新登录学习通后重试 |
| 弹窗提示需要验证码 | `validate` 返回 status=2 | 人工过一次验证码，本工具不处理验证码 |
| 提交后跳到 `work/prompt` 显示分数 | 正常 | 这是提交成功页；点「查看详情」可看逐题批改 |
| 提交接口 200 但分数没变 | 提交的是上一次的草稿 | 确认 `answer_work.js` 复核全绿后再提交 |

## 安装

| 现象 | 原因 | 处理 |
|---|---|---|
| 本机没有 git | `install.sh` / `install.ps1` 原本依赖 git | v1.1 起安装脚本**自带 zip 包兜底**：没有 git 会自动下载 GitHub zip 解压；也可以直接下载 zip 手动放进 skills 目录再 `npm install` |
| `npm install` 后仍提示缺少 playwright-core | 没在技能目录里执行 | `cd` 到技能目录再 `npm install` |
| Node 版本过低 | playwright-core 1.6x 要求 Node 20+，低于 20 是 `process.exit(1)` 直接退出 | 升级 Node；脚本会先判版本并给出可读提示 |
| `npm test` 里 DOM 测试失败 | 环境里起不来无头浏览器 | v1.1 起该用例在起浏览器失败时**降级为 skip**，不再让流水线变红 |

## 判分

- 填空题判分**忽略空白与括号位置，但要求答案文本与标准答案一致**：
  `init()` ≡ `init ()` ✅；`转发` ≠ `转发(forward)` ❌。
- 提交后用 `check_result.js` 看逐题「正确答案」，据此修正措辞，再重新发起一次作答。
- 详见 `grading_rules.md`。
