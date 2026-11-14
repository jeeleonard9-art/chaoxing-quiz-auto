// 抽取超星作业页的全部题目、选项与作答位置
// 用法: node scripts/extract_questions.js [--url <作业链接>] [--out questions.json]
// 产出: questions.json（结构化） + questions.txt（人读版）
'use strict';

const fs = require('fs');
const path = require('path');
const { connect, openWorkPage, extractQuestions } = require('./lib');
const { parseArgs } = require('./answers_util');

const args = parseArgs();
const outFile = args.out || 'questions.json';

(async () => {
  const { browser, ctx } = await connect();
  const page = await openWorkPage(ctx, args.url);
  await page.bringToFront();

  const data = await extractQuestions(page);

  const lines = [];
  lines.push(`作业页: ${page.url()}`);
  lines.push(`共 ${data.length} 题`);
  data.forEach(q => {
    lines.push('');
    lines.push(`${q.num}. (${q.typeName}) ${q.title}`);
    if (q.options.length) {
      q.options.forEach(o => lines.push(`   ${o.letter}. ${o.text}`));
    } else if (q.blanks.length) {
      lines.push(`   [作答位置 ${q.blanks.length} 处: ${q.blanks.map(b => b.textareaName).join(', ')}]`);
    }
    if (q.note) lines.push(`   [提示] ${q.note}`);
  });
  fs.writeFileSync('questions.txt', lines.join('\n'), 'utf8');

  const result = { source: page.url(), total: data.length, questions: data };
  fs.writeFileSync(outFile, JSON.stringify(result, null, 1), 'utf8');
  console.log(JSON.stringify(result, null, 1));
  console.error(`\n[extract] ${data.length} 题 → ${path.resolve(outFile)} 与 questions.txt`);
  await browser.close();
})().catch(e => { console.error('ERR', e.message || e); process.exit(1); });
