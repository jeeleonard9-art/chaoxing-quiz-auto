# answers.json 格式

`answer_work.js --answers answers.json` 读取此文件。
**答案内容由调用本 Skill 的 Agent 自行推理后填入**，本文件只定义格式。

## 生成骨架

```bash
node scripts/answers_util.js init
```

读取当前目录的 `questions.json`，按题号与空位数生成一份 `answers.json` 骨架
（客观题与填空题的槽位已列好，值为空字符串待填）。也可以指定路径：

```bash
node scripts/answers_util.js init --questions questions.json --out answers.json
```

骨架长这样（题号是占位的示例）：

```json
{
  "choice": {
    "1": "",
    "2": "",
    "3": ""
  },
  "fill": {
    "4": ["", ""]
  }
}
```

## 填写规则

```json
{
  "choice": {
    "1": "C",
    "2": "ABD",
    "3": "true"
  },
  "fill": {
    "4": ["示例第一空", "示例第二空"]
  }
}
```

| 题型 | 取值 | 说明 |
|---|---|---|
| 单选 | `"A"` ~ `"D"`… | 选项字母 |
| 多选 | `"ABD"` | 多个字母连写（脚本会依次点击各字母） |
| 判断 | `"true"` / `"false"` | `true` = 对（A），`false` = 错（B） |
| 填空 | 字符串数组 | 按"第1空、第2空…"顺序 |

### 填空题数组长度

- 数组长度**等于**平台空位数（`questions.json` 里该题的 `slots`）——推荐做法；
- 数组长度**多于**空位数：脚本会把多余的答案用 `、` 合并进最后一个空位
  （平台空位少于题干下划线数量时用这招）；
- 数组长度**少于**空位数：多余空位留空，提交时的完整性自检会拦下。

## 填写前先看这两份文档

- `references/grading_rules.md` —— 判分口径（空白归一化、多答案点、题干标签还原等）
- `questions.txt` —— 抽题结果的人读版，含全部题干与选项

## 校验

`answer_work.js` 在真正作答前会校验答案表结构（题号是否为数字、选项是否为合法字母、
填空数组是否为空），不合法会直接报错退出；答完还会做**全量复核**，
任何一题与预期不符都会打印 ✗ 并以退出码 2 结束。
