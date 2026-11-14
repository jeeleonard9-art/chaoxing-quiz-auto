// 逐题用真实鼠标/键盘作答超星作业，并逐题回读校验
// 用法: node scripts/answer_work.js --answers answers.json [--url <作业链接>] [--keep] [--gap 700]
//   --answers  答案表（见 references/answer_format.md）
//   --url      作业未在浏览器中打开时，用它打开
//   --keep     跳过清空，直接在现有状态上作答
//   --gap      每题之间的间隔毫秒（默认 700）
'use strict';

const fs = require('fs');
const {
  connect, openWorkPage, qidMap, questionMode, slotCount, editorSpec,
  readChoice, readEditor, resetForm, syncAll, mouseClick, typeIntoEditor
} = require('./lib');
const { distribute, validateAnswers, parseArgs } = require('./answers_util');

const args = parseArgs();
const gap = parseInt(args.gap || '700', 10);
const answersFile = args.answers || 'answers.json';

(async () => {
  if (!fs.existsSync(answersFile)) throw new Error(`答案表不存在: ${answersFile}`);
  const answers = JSON.parse(fs.readFileSync(answersFile, 'utf8'));
  const errs = validateAnswers(answers);
  if (errs.length) {
    console.error('答案表校验未通过:');
    errs.forEach(e => console.error('  - ' + e));
    process.exit(2);
  }
  const choice = answers.choice || {};
  const fill = answers.fill || {};

  const { browser, ctx } = await connect();
  const page = await openWorkPage(ctx, args.url);
  await page.bringToFront();

  const map = await qidMap(page);
  const qids = Object.values(map);
  const failures = [];

  if (!args.keep) {
    const ok = await resetForm(page, qids);
    console.log('[阶段0] 表单清空：' + (ok ? '成功' : '异常'));
    if (!ok) throw new Error('清空表单失败，中止');
  }

  // ---------------- 客观题 ----------------
  const choiceNums = Object.keys(choice).map(Number).sort((a, b) => a - b);
  for (const num of choiceNums) {
    const qid = map[String(num)];
    const want = String(choice[String(num)]);
    if (!qid) { failures.push(`第${num}题 找不到 qid`); continue; }

    const isBool = want === 'true' || want === 'false';
    const letters = isBool ? [want] : want.split('');
    let ok = false;

    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
      for (const L of letters) {
        const loc = page.locator(`div.answerBg[qid="${qid}"] span[data="${L}"]`).first();
        if (await loc.count() === 0) { failures.push(`第${num}题 找不到选项 ${L}`); break; }
        await mouseClick(page, loc);
        await page.waitForTimeout(gap);
      }
      const st = await readChoice(page, qid);
      const gotSet = (st.val || '').split('').sort().join('');
      const wantSet = letters.join('').split('').sort().join('');
      ok = isBool ? st.val === want : (gotSet === wantSet && letters.every(l => st.marked.includes(l)));
      if (!ok) {
        console.log(`  第${num}题 第${attempt}次点击未生效（值=${st.val} 标记=[${st.marked}]），重试`);
        await page.waitForTimeout(900);
      }
    }
    const label = want === 'true' ? '对' : want === 'false' ? '错' : want;
    console.log(`[客观题] 第 ${num} 题 → ${label}  ${ok ? '成功' : '失败'}`);
    if (!ok) failures.push(`第${num}题 客观题未选中`);
    await page.waitForTimeout(gap);
  }

  // ---------------- 填空题 / 主观题 ----------------
  const fillNums = Object.keys(fill).map(Number).sort((a, b) => a - b);
  for (const num of fillNums) {
    const qid = map[String(num)];
    const list = fill[String(num)];
    if (!qid) { failures.push(`第${num}题 找不到 qid`); continue; }
    const mode = await questionMode(page, qid);
    const slots = await slotCount(page, qid);
    const blanks = distribute(list, slots);
    const cont = page.locator(`#question${qid}`);

    for (let j = 1; j <= blanks.length; j++) {
      const txt = blanks[j - 1];
      const spec = await editorSpec(page, qid, j);
      let ok = false;

      for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
        if (spec.textareaName) {
          await page.evaluate((n) => {
            try { const ed = UE.getEditor(n); ed.setContent(''); ed.sync(); } catch (e) {}
          }, spec.textareaName);
        }
        if (spec.iframeIndex >= 0) {
          const fr = cont.locator('div[id$="_iframeholder"] > iframe').nth(spec.iframeIndex);
          if (await fr.count() > 0) {
            await typeIntoEditor(page, fr, txt);
          }
        }
        const got = spec.textareaName ? await readEditor(page, spec.textareaName) : { content: '' };
        ok = got.content === txt || got.textarea === txt;
        if (!ok) {
          console.log(`  第${num}题 第${j}处 第${attempt}次输入未生效（得到="${got.content}"），重试`);
          await page.waitForTimeout(900);
        }
      }
      if (!ok) failures.push(`第${num}题 第${j}处 未填入（期望 ${txt}）`);
    }
    console.log(`[${mode === 'subjective' ? '主观题' : '填空题'}] 第 ${num} 题 → ${blanks.join(' | ')}  ${failures.filter(f => f.startsWith(`第${num}题 第`)).length ? '失败' : '成功'}`);
    await page.waitForTimeout(gap);
  }

  // ---------------- 复核 ----------------
  await syncAll(page, qids);
  let bad = 0;
  console.log('\n================ 复核 ================');
  for (const num of choiceNums) {
    const st = await readChoice(page, map[String(num)]);
    const want = String(choice[String(num)]);
    const letters = (want === 'true' || want === 'false') ? [want] : want.split('');
    const gotSet = (st.val || '').split('').sort().join('');
    const wantSet = letters.join('').split('').sort().join('');
    const ok = want === 'true' || want === 'false' ? st.val === want : gotSet === wantSet;
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} 第${num}题 [${st.val}] 期望 [${want}]`);
  }
  for (const num of fillNums) {
    const qid = map[String(num)];
    const slots = await slotCount(page, qid);
    const blanks = distribute(fill[String(num)], slots);
    for (let j = 1; j <= blanks.length; j++) {
      const spec = await editorSpec(page, qid, j);
      const got = spec.textareaName ? await readEditor(page, spec.textareaName) : { content: '' };
      const ok = got.content === blanks[j - 1] || got.textarea === blanks[j - 1];
      if (!ok) bad++;
      console.log(`${ok ? '✓' : '✗'} 第${num}题 第${j}处 [${got.content}] 期望 [${blanks[j - 1]}]`);
    }
  }
  console.log(`\n复核：不一致 ${bad} 处`);
  if (failures.length) { console.log('\n--- 失败明细 ---'); failures.forEach(f => console.log(f)); }
  console.log('\n确认全绿后再执行: node scripts/submit_work.js');
  await browser.close();
  if (bad > 0 || failures.length) process.exitCode = 2;
})().catch(e => { console.error('ERR', e.message || e); process.exit(1); });
