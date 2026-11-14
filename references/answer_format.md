# answers.json 格式

`answer_work.js --answers answers.json` 读取此文件。

```json
{
  "choice": {
    "1": "C",
    "2": "B",
    "20": "false",
    "21": "false"
  },
  "fill": {
    "40": ["服务器", "Servlet 容器"],
    "47": ["getWriter"],
    "55": ["getContextPath、getRealPath"]
  }
}
```

## choice（客观题：单选 / 多选 / 判断）

| 题型 | 取值 | 说明 |
|---|---|---|
| 单选 | `"A"` ~ `"D"` | 选项字母 |
| 多选 | `"ABD"` | 多个字母连写（平台会累加） |
| 判断 | `"true"` / `"false"` | `true` = 对（A），`false` = 错（B） |

键是题号字符串。

## fill（填空题）

- 键是题号字符串，值是**按"第1空、第2空…"顺序排列**的数组。
- 数组长度可以等于平台空位数（`tiankongsize`）。
- 数组长度 **多于** 平台空位数时，脚本会自动把多余的答案用 `、` 合并进最后一个空位
  （例如题干写了 2 个空但平台只建 1 个空位 → 写成 `["getContextPath、getRealPath"]`）。
- 数组长度少于空位数时，多余空位留空（提交会被校验拦下）。

## 通用建议

- 填空题答案尽量与平台标准答案**逐字一致**，尤其是带英文括号的写法（`转发(forward)` 而非 `转发`）。
- 键值数量应与题目数量一致；漏题会在复核阶段报 `✗`。
- 作答后先看 `answer_work.js` 的复核输出，全绿再执行 `submit_work.js`。
