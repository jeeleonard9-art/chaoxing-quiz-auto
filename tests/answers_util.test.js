// 单元测试：纯函数逻辑（不依赖浏览器）
// 运行: node --test tests/
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  distribute, normalizeText, sameAnswer, splitPoints, answerHit, validateAnswers, parseArgs
} = require('../scripts/answers_util');

test('distribute: 空位足够时原样保留', () => {
  assert.deepStrictEqual(distribute(['init()', 'service()'], 2), ['init()', 'service()']);
  assert.deepStrictEqual(distribute(['getWriter'], 1), ['getWriter']);
});

test('distribute: 空位少于答案数时用、合并进最后一个空位', () => {
  assert.deepStrictEqual(
    distribute(['getContextPath', 'getRealPath'], 1),
    ['getContextPath、getRealPath']
  );
  assert.deepStrictEqual(
    distribute(['a', 'b', 'c'], 2),
    ['a', 'b、c']
  );
});

test('distribute: 空位为 0 时返回空数组', () => {
  assert.deepStrictEqual(distribute(['x'], 0), []);
  assert.deepStrictEqual(distribute(['x'], undefined), []);
});

test('distribute: 字符串输入被当作单元素数组', () => {
  assert.deepStrictEqual(distribute('服务器', 1), ['服务器']);
});

test('normalizeText: 忽略空白与全半角括号、顿号逗号', () => {
  assert.strictEqual(normalizeText('init ()'), normalizeText('init()'));
  assert.strictEqual(normalizeText('getContextPath ();getRealPath ()'),
                     normalizeText('getContextPath、getRealPath'));
  assert.notStrictEqual(normalizeText('转发'), normalizeText('转发(forward)'));
});

test('sameAnswer: 平台判分口径（空白/括号等价，文本内容须一致）', () => {
  assert.ok(sameAnswer('init()', 'init ()'));
  assert.ok(sameAnswer('getWriter', 'getWriter ()'));
  assert.ok(!sameAnswer('转发', '转发(forward)'));
});

test('splitPoints: 把同一空里的多个答案点拆开', () => {
  assert.deepStrictEqual(splitPoints('sendRedirect ();其他 Web 应用'), ['sendRedirect ()', '其他 Web 应用']);
  assert.deepStrictEqual(splitPoints('getContextPath ();getRealPath ()'), ['getContextPath ()', 'getRealPath ()']);
  assert.deepStrictEqual(splitPoints('getContextPath、getRealPath'), ['getContextPath', 'getRealPath']);
  assert.deepStrictEqual(splitPoints('单一答案'), ['单一答案']);
  assert.deepStrictEqual(splitPoints(''), []);
});

test('answerHit: 命中任一答案点即算对（修掉满分题被误报成不一致）', () => {
  // 平台把两个答案点写进同一空的标准答案文本里，我的答案命中其中一个 → 满分
  assert.ok(answerHit('sendRedirect', 'sendRedirect ();其他 Web 应用'));
  // 我的答案用、分隔多个点，逐点命中
  assert.ok(answerHit('getContextPath、getRealPath', 'getContextPath ();getRealPath ()'));
  // 空格与括号归一化后相等
  assert.ok(answerHit('init()', 'init ()'));
  assert.ok(answerHit('service()', 'service ()'));
  // 文本不一致 → 不算命中（标准答案是「转发(forward)」时，「转发」判 0 分）
  assert.ok(!answerHit('转发', '转发(forward)'));
  assert.ok(!answerHit('重定向', '重定向(redirect)'));
  // 实测：标准答案含两个点时，只答一个点平台同样给满分 → 仍算命中
  assert.ok(answerHit('getContextPath', 'getContextPath ();getRealPath ()'));
});

test('validateAnswers: 合法答案表无错误', () => {  const errs = validateAnswers({ choice: { '1': 'C', '20': 'false' }, fill: { '40': ['服务器'] } });
  assert.deepStrictEqual(errs, []);
});

test('validateAnswers: 能发现非法结构', () => {
  assert.ok(validateAnswers(null).length > 0);
  assert.ok(validateAnswers({ choice: { 'x': 'C' } }).some(e => e.includes('不是题号')));
  assert.ok(validateAnswers({ choice: { '1': '12' } }).some(e => e.includes('非法')));
  assert.ok(validateAnswers({ fill: { '1': [] } }).some(e => e.includes('空数组')));
  assert.ok(validateAnswers({ fill: { '1': [''] } }).some(e => e.includes('空字符串')));
});

test('parseArgs: 解析 --key value 与布尔开关', () => {
  const a = parseArgs(['--answers', 'a.json', '--submit', '--gap', '900']);
  assert.strictEqual(a.answers, 'a.json');
  assert.strictEqual(a.submit, true);
  assert.strictEqual(a.gap, '900');
});
