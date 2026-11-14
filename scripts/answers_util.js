// 纯函数工具：答案分配、文本归一化、答案表校验
// 独立成模块，便于单元测试（tests/）在不连浏览器的情况下验证。
'use strict';

/**
 * 把答案数组分配到平台实际提供的空位。
 * 平台空位少于答案个数时，多余的答案用「、」合并进最后一个空位。
 * 例：['getContextPath','getRealPath'] 分配到 1 个空位 → ['getContextPath、getRealPath']
 */
function distribute(answers, slots) {
  if (!slots || slots <= 0) return [];
  const list = Array.isArray(answers) ? answers : [answers];
  if (list.length <= slots) return list.slice();
  const head = list.slice(0, slots - 1);
  head.push(list.slice(slots - 1).join('、'));
  return head;
}

/** 归一化文本，用于比对"我的答案"与"正确答案"（忽略空白与全半角括号、顿号逗号） */
function normalizeText(s) {
  return (s || '')
    .replace(/[\s　]/g, '')
    .replace(/[（）()]/g, '')
    .replace(/[，,、；;]/g, '');
}

/** 判断两份答案是否等价 */
function sameAnswer(a, b) {
  return normalizeText(a) === normalizeText(b);
}

/**
 * 把一段文本拆成"答案点"。超星会把同一空里的多个答案点写进标准答案文本，
 * 例如「sendRedirect ();其他 Web 应用」实际是两个点。
 */
function splitPoints(s) {
  return String(s == null ? '' : s)
    .split(/[;；,，、]/)
    .map(x => x.trim())
    .filter(Boolean);
}

/**
 * 按平台的判分口径比对：把两边都拆成答案点，**我的答案命中其中任意一个点即算对**。
 *
 * 依据实测：
 *   - 标准答案「sendRedirect ();其他 Web 应用」（两个点），我答「sendRedirect」→ 满分 1.8
 *   - 标准答案「getContextPath ();getRealPath ()」，我答「getContextPath、getRealPath」→ 满分 1.8
 *   - 标准答案「转发(forward)」，我答「转发」→ 0 分
 *
 * 注意判定用的是「归一化后相等」而不是「包含」：
 * 「转发」并不包含「转发(forward)」，平台判 0 分。
 */
function answerHit(mine, right) {
  const mp = splitPoints(mine);
  const rp = splitPoints(right);
  if (!mp.length || !rp.length) return false;
  return mp.some(m => rp.some(r => normalizeText(m) === normalizeText(r)));
}

/**
 * 校验答案表结构。
 * @param {object} answers { choice:{}, fill:{} }
 * @returns {string[]} 问题列表
 */
function validateAnswers(answers) {
  const errs = [];
  if (!answers || typeof answers !== 'object') {
    errs.push('答案表必须是一个 JSON 对象，形如 { "choice": {...}, "fill": {...} }');
    return errs;
  }
  const choice = answers.choice || {};
  const fill = answers.fill || {};
  for (const [k, v] of Object.entries(choice)) {
    if (!/^\d+$/.test(k)) errs.push(`choice 的键 "${k}" 不是题号`);
    if (typeof v !== 'string' || !v.length) errs.push(`第${k}题的选项答案为空`);
    if (typeof v === 'string' && !/^[A-Za-z]+$/.test(v)) {
      errs.push(`第${k}题的选项答案 "${v}" 非法（应为字母；判断题用 true/false）`);
    }
  }
  for (const [k, v] of Object.entries(fill)) {
    if (!/^\d+$/.test(k)) errs.push(`fill 的键 "${k}" 不是题号`);
    if (!Array.isArray(v) || !v.length) errs.push(`第${k}题的填空答案为空数组`);
    else if (v.some(x => typeof x !== 'string' || !x.trim())) {
      errs.push(`第${k}题的填空答案含有空字符串`);
    }
  }
  return errs;
}

/** 解析命令行参数 --key value / --flag */
function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

module.exports = { distribute, normalizeText, sameAnswer, splitPoints, answerHit, validateAnswers, parseArgs };
