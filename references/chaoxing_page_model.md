# 超星作业页 DOM 模型与提交流程

## 1. 浏览器接管

Chromium 136+（Edge 157 实测）禁止在**默认用户数据目录**上启用 `--remote-debugging-port`：

```
--remote-debugging-port is disallowed with the default user data directory
```

解决思路：创建一个指向真实 profile 的**目录联接（junction）**，把它作为 `--user-data-dir`。
路径字符串与默认值不同即可通过校验，而文件读写仍落在真实 profile 上，Cookie / 登录态完整保留。

Windows（`scripts/takeover_browser.ps1` 已实现）：

```powershell
New-Item -ItemType Junction -Path "$env:TEMP\wb-edge-ud" -Target "$env:LOCALAPPDATA\Microsoft\Edge\User Data"
Start-Process msedge -ArgumentList @(
  "--remote-debugging-port=9222",
  "--user-data-dir=$env:TEMP\wb-edge-ud",
  "--profile-directory=Default",
  "--restore-last-session")
```

要点：
- 必须先关闭浏览器实例，否则 profile 锁冲突，新实例会把参数转交给旧进程直接退出。
- `--restore-last-session` 恢复原有标签页，登录态与作业页面自动回来。
- 联接只改变路径字符串；删除联接请用 `Remove-Item <link>`，不要对其递归操作。
- macOS / Linux：直接用真实 profile 路径即可（无默认目录限制），或用 `--user-data-dir=/tmp/xxx` 复制一份 profile。

连接：

```js
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
```

---

## 2. 页面 DOM 结构

作业作答页：`https://mooc1-api.chaoxing.com/mooc-ans/mooc2/work/dowork?courseId=..&classId=..&cpi=..&workId=..&answerId=..&standardEnc=..&enc=..`

### 题目容器

```html
<div class="questionLi fontLabel singleQuesId" id="question215293304" data="215293304">
  <h3 class="mark_name ...">1. <span class="colorShallow">(单选题)</span> 题干…</h3>
  <input type="hidden" id="answertype215293304" value="0">   <!-- 0单选 1多选 2填空 3判断 -->
  <input type="hidden" id="answer215293304" value="">        <!-- 客观题：平台写入的答案 -->
</div>
```

- 题号 → qid：`h3.closest('[id^=question]').id.replace('question','')`
- 题型：`#answertype<qid>` 的 value（0=单选，1=多选，2=填空，3=判断）

### 客观题选项

```html
<div class="clearfix answerBg workTextWrap" onclick="addChoice(this)" role="radio" qid="215293304" qtype="0">
  <span data="A" class="choice215293304 num_option fl">A</span>
  <div class="fl answer_p"><p>选项文本</p></div>
</div>
```

- **`data` 属性在内层 `span` 上**，不在 `div.answerBg` 上。选择器要用 `div.answerBg[qid="X"] span[data="A"]`。
- 判断题：`A`=对 → `data="true"`，`B`=错 → `data="false"`。
- 平台点击处理函数 `addChoice(obj)` 会把选中项的 `data` 写进 `#answer<qid>`，并给 span 加 `check_answer` class。

### 填空题

```html
<input type="hidden" name="tiankongsize215293323" value="2">   <!-- 平台实际空位数 -->
<div class="stem_answer">
  <span class="tiankong">第1空</span>
  <div class="edui-default">
    <div id="edui61" class="edui-editor edui-default">
      <div id="edui61_iframeholder"><iframe id="ueditor_14"></iframe></div>
    </div>
    <textarea name="answerEditor2152933231" style="display:none"></textarea>
  </div>
</div>
```

- 第 j 空对应 `UE.getEditor('answerEditor<qid><j>')`，其可见输入区是 `div[id$="_iframeholder"] > iframe` 里的 contenteditable body。
- **`tiankongsize` 可能小于题干中下划线的个数**（实测有一题题干写 2 个空、平台只建 1 个空位）。此时把多个答案用 `、` 合并填进同一个空位，判分同样满分。
- 编辑器内容存在 iframe 里，**表单 textarea 靠 `editor.sync()` 同步**。

---

## 3. 答案保存与提交

### 关键函数

| 函数 | 作用 |
|---|---|
| `addChoice(obj)` | 客观题点击处理，写 `#answer<qid>` |
| `loadEditorAnswerd(qid, type)` | 填空题内容变化时校验各空非空 |
| `syncAnswer(qid, type)` | 填空题：把编辑器内容 `sync()` 进 textarea |
| `saveWork()` | 「暂时保存」：先对所有题 `syncAnswer`，再 POST（`saveStatus=1`） |
| `saveAnswer(options)` | 暂存 AJAX：`POST /mooc-ans/work/addStudentWorkNewWeb?...&saveStatus=1` |
| `submitValidate()` | 「提交」按钮入口，GET `/work/validate` |
| `ready2Submit()` | 校验每题非空 → `workPop("确认提交？", "提交", "取消")` |
| `confirmSubmitWork()` | 真正的提交 POST（**不会**调用 `syncAnswer`） |
| `submitStep()` / `doStep()` | 提交后的收尾 |

### 提交链路

```
<a onclick="submitValidate();">提交</a>
   → GET  /mooc-ans/work/validate?courseId&classId&cpi
       status=1 → 账号异常，请重新登录
       status=2 → 弹验证码
       status=3 → ready2Submit()
   → ready2Submit() 逐题校验非空 → workPop("确认提交？")
   → 弹窗 #popok「提交」 → submitCheckTimes() → confirmSubmitWork()
   → POST /mooc-ans/work/addStudentWorkNewWeb  （表单序列化）
   → 跳转 work/prompt 页，显示「作业 XX 分 提交时间 …」
```

### 重要坑

1. **`confirmSubmitWork()` 只做 `$("#submitForm").serialize()`，不会同步编辑器内容。**
   如果只用 API 往 UEditor 里塞答案而没 `sync()`，提交上去的填空答案是空的。
   解决办法：作答后调用 `syncAnswer`，或先点一次「暂时保存」（它内部会 sync）。
2. 「暂时保存」是草稿保存（`saveStatus=1`），**不是提交**，不会触发判分。偶发网络失败时可重试。
3. 提交后同一 `answerId` 不能再进入作答页，会返回「作答状态异常！」。重新作答需要在课程作业列表里发起新的一次。

---

## 4. 作业详情页（核验用）

`work/prompt` → 点「查看详情」→ `work/view`，每题展示：

```
我的答案： X     正确答案： Y     1.7分     答案解析： …   AI讲解
```

用 `check_result.js` 解析该页可逐题比对并求总分。
