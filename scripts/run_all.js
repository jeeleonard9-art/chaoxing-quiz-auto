// 一键流程：抽取题目 → 逐题作答 → 提交（任务终点）
// 用法: node scripts/run_all.js --answers answers.json [--url <作业链接>] [--submit] [--gap 700]
//
// 注意：answers.json 需要由使用者（或 AI 助手）根据抽取到的题目预先准备好，
//       本脚本只负责"读取答案 → 用真实鼠标作答 → 提交"。
//       提交完成即任务结束，不再做任何核分、复盘或归纳。
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { parseArgs } = require('./answers_util');

const args = parseArgs();
const here = __dirname;
const py = process.platform === 'win32' ? 'node' : 'node';

function run(script, extra) {
  console.log(`\n===== ${script} ${extra.join(' ')} =====`);
  const r = spawnSync(py, [path.join(here, script), ...extra], { stdio: 'inherit' });
  return r.status === 0;
}

const common = [];
if (args.url) common.push('--url', String(args.url));
if (args.gap) common.push('--gap', String(args.gap));

const answers = args.answers || 'answers.json';
const ansArgs = ['--answers', String(answers), ...common];

let ok = run('extract_questions.js', common);
if (!ok) process.exit(1);

ok = run('answer_work.js', ansArgs);
if (!ok) {
  console.error('\n作答复核未通过，已中止（不提交）。请修正后重试。');
  process.exit(2);
}

if (args.submit) {
  ok = run('submit_work.js', common);
  if (!ok) process.exit(3);
  console.log('\n===== 任务完成 =====');
  console.log('作业已提交。提交为不可更改的最终结果，流程到此结束。');
} else {
  console.log('\n未指定 --submit，已停留在"已作答未提交"状态。');
  console.log('确认无误后执行: node scripts/submit_work.js');
}
