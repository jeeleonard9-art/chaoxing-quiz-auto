// 提交后核验：打开作业详情页(work/view)，逐题对比「我的答案 / 正确答案 / 得分」
// 用法: node scripts/check_result.js
'use strict';

const { connect, findPage } = require('./lib');
const { sameAnswer, answerHit, parseArgs } = require('./answers_util');

const args = parseArgs();

(async () => {
  const { browser, ctx } = await connect();
  let page = await findPage(ctx, ['/work/view', '/work/prompt', '/work/dowork']);
  if (!page) throw new Error('未找到超星作业页');
  await page.bringToFront();

  // 从 prompt 页跳到 view 详情页
  if (page.url().includes('/work/prompt')) {
    const url = page.url().replace('/work/prompt?', '/work/view?');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
  }
  await page.waitForTimeout(1500);

  const res = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('h3.mark_name').forEach(h3 => {
      const title = h3.innerText.replace(/\s+/g, ' ').trim();
      const cont = h3.closest('[id^=question]') || h3.parentElement;
      const t = cont ? cont.innerText.replace(/\s+/g, ' ').trim() : '';
      const iMine = t.indexOf('我的答案'), iRight = t.indexOf('正确答案');
      const iParse = t.indexOf('答案解析'), iAi = t.indexOf('AI讲解');
      const cut = iParse > iRight ? iParse : (iAi > iRight ? iAi : t.length);
      let mine = iMine >= 0 ? t.slice(iMine + 4, iRight > iMine ? iRight : t.length) : '';
      mine = mine.replace(/[:：]/g, '').trim().replace(/^[\d.]+分\s*/, '').trim();
      let right = iRight >= 0 ? t.slice(iRight + 4, cut) : '';
      right = right.replace(/[:：]/g, '').replace(/[\d.]+分\s*$/, '').trim();
      const score = parseFloat((t.match(/([\d.]+)分/) || [])[1] || '0');
      const expl = iParse >= 0 ? t.slice(iParse, iAi > iParse ? iAi : t.length).replace(/^答案解析[:：]\s*/, '').trim() : '';
      out.push({ num: parseInt(title), title, mine, right, score, expl: expl.slice(0, 220) });
    });
    const total = document.body.innerText.replace(/\s+/g, ' ').match(/作业\s*([\d.]+)分/);
    return { out, total: total ? total[1] : null, url: location.href };
  });

  let bad = 0, sum = 0;
  res.out.forEach(q => {
    sum += q.score;
    // 按平台判分口径比对：平台可能把多个答案点写进同一空的标准答案文本，
    // 只要我的每个点都能命中其中一个点，就算对（否则会把满分题误报成不一致）。
    const ok = answerHit(q.mine, q.right) || sameAnswer(q.mine, q.right);
    if (!ok) {
      bad++;
      console.log(`\n✗ 第${q.num}题  得分 ${q.score}\n   题干: ${q.title}\n   我的答案: [${q.mine}]\n   正确答案: [${q.right}]`);
      if (q.expl) console.log(`   解析: ${q.expl}`);
    }
  });
  console.log('\n==============================');
  console.log(`总题数 ${res.out.length}，答案不一致 ${bad} 题，逐题得分合计 ${sum.toFixed(1)}`);
  if (res.total) console.log(`页面显示总分: ${res.total} 分`);
  if (bad > 0) {
    console.log('\n修正建议：把上面的「正确答案」措辞更新到 answers.json，');
    console.log('再从课程作业列表重新发起一次作答（同一次作答无法修改，重复进入会提示"作答状态异常！"）。');
  } else if (res.out.length) {
    console.log('\n全部答案与平台标准答案一致 ✓');
  }
  await browser.close();
})().catch(e => { console.error('ERR', e.message || e); process.exit(1); });
