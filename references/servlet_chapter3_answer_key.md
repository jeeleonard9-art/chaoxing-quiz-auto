# 第3章 Servlet 作业 · 参考答案（57 题）

来源：超星学习通《Java Web 程序设计》课程「第3章 Servlet作业」（题量 57，满分 100：
单选 19 题 32.3 分 / 判断 20 题 35.3 分 / 填空 18 题 32.4 分）。

填空题答案列为**平台标准答案原文**（来自作业详情页），可直接照抄。

## 一、单选题（19 题）

| 题 | 答案 | 题 | 答案 | 题 | 答案 |
|---|---|---|---|---|---|
| 1 | C | 8 | A | 15 | A |
| 2 | B | 9 | A | 16 | D |
| 3 | B | 10 | C | 17 | A |
| 4 | C | 11 | C | 18 | B |
| 5 | B | 12 | B | 19 | B |
| 6 | B | 13 | C | | |
| 7 | B | 14 | D | | |

要点：
- Q1 问"错误的是"→ C（Servlet 不能被浏览器直接访问）。
- Q2 "只会被调用一次"→ B `init()`；`destroy()` 至多一次，非必调。
- Q10 "直接实现 Servlet 接口"实指 `GenericServlet`，但"专门处理 HTTP 请求"是 `HttpServlet` 的唯一特征 → C。
- Q12 正确项 B（每个 Servlet 实例对应一个 ServletConfig）；D 的标签原为 `<servlet-mapping>`，故为错。
- Q16 问"区别错误的是"→ D（forward 只能在当前应用内，redirect 可跨应用）。

## 二、判断题（20 题）

| 题 | 答案 | 题 | 答案 | 题 | 答案 | 题 | 答案 |
|---|---|---|---|---|---|---|---|
| 20 | 错 | 25 | 错 | 30 | 错 | 35 | 对 |
| 21 | 错 | 26 | 对 | 31 | 对 | 36 | 对 |
| 22 | 对 | 27 | 错 | 32 | 错 | 37 | 对 |
| 23 | 对 | 28 | 错 | 33 | 对 | 38 | 对 |
| 24 | 对 | 29 | 对 | 34 | 错 | 39 | 对 |

要点：
- Q21 可通过继承 `HttpServlet` 间接实现 → 错。
- Q25 全局初始化参数要用 `ServletContext` → 错。
- Q26 `<servlet-mapping>` 用于指定访问路径 → 对。
- Q28 实例回收由 JVM GC 决定 → 错。
- Q34 请求参数乱码要用 `request.setCharacterEncoding` → 错。
- Q37 容器重启会调用 `destroy()` → 对；Q38 `sendRedirect` 可跳转到其它 Web 应用 → 对。

## 三、填空题（18 题）

| 题 | 第1空 | 第2空 | 第3空 |
|---|---|---|---|
| 40 | 服务器 | Servlet 容器 | |
| 41 | Servlet | HttpServlet | |
| 42 | init () | service () | |
| 43 | init () | service () | |
| 44 | doGet () | doPost () | |
| 45 | HttpServletRequest | HttpServletResponse | |
| 46 | 之前 | setCharacterEncoding () | |
| 47 | getWriter () | | |
| 48 | ServletContext | Web 应用启动 | |
| 49 | ServletConfig | getInitParameter () | |
| 50 | @WebServlet | | |
| 51 | 转发(forward) | 重定向(redirect) | 重定向(redirect) |
| 52 | getRequestDispatcher () | forward () | |
| 53 | sendRedirect () | | |
| 54 | setContentType () | | |
| 55 | getContextPath () | getRealPath () | |
| 56 | destroy () | | |
| 57 | 抽象类 | GenericServlet | |

⚠️ **第 51 题必须写成 `转发(forward)` / `重定向(redirect)`**，只写「转发」「重定向」判 0 分。
其余各题标识符的空格与括号在判分时会被归一化，`init()` 与 `init ()` 等价。
第 55 题平台只建 1 个空位（题干写了两处方法名），把两个方法用 `、` 连写填进同一空即可满分。

## 可直接使用的 answers.json

```json
{
  "choice": {
    "1":"C","2":"B","3":"B","4":"C","5":"B","6":"B","7":"B","8":"A","9":"A","10":"C",
    "11":"C","12":"B","13":"C","14":"D","15":"A","16":"D","17":"A","18":"B","19":"B",
    "20":"false","21":"false","22":"true","23":"true","24":"true",
    "25":"false","26":"true","27":"false","28":"false","29":"true","30":"false",
    "31":"true","32":"false","33":"true","34":"false","35":"true",
    "36":"true","37":"true","38":"true","39":"true"
  },
  "fill": {
    "40":["服务器","Servlet 容器"],
    "41":["Servlet","HttpServlet"],
    "42":["init()","service()"],
    "43":["init()","service()"],
    "44":["doGet()","doPost()"],
    "45":["HttpServletRequest","HttpServletResponse"],
    "46":["之前","setCharacterEncoding"],
    "47":["getWriter"],
    "48":["ServletContext","Web 应用启动"],
    "49":["ServletConfig","getInitParameter"],
    "50":["@WebServlet"],
    "51":["转发(forward)","重定向(redirect)","重定向(redirect)"],
    "52":["getRequestDispatcher","forward()"],
    "53":["sendRedirect"],
    "54":["setContentType"],
    "55":["getContextPath、getRealPath"],
    "56":["destroy()"],
    "57":["抽象类","GenericServlet"]
  }
}
```

> 首次实测结果：按上表作答得 **98.2 分**（仅第 51 题因漏写英文括注被判 0 分，失 1.8 分）。
> 把第 51 题改成 `转发(forward)` / `重定向(redirect)` 后即为满分。
