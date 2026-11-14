// 最后一步：校验完整性 → 鼠标点击「提交」→ 处理确认弹窗 → 报告结果
// 用法: node scripts/submit_work.js [--url <作业链接>]
// 注意：提交后不可再修改同一份答卷，务必先跑 answer_work.js 确认复核全绿。
'use strict';

const {
  connect, openWorkPage, qidMap, questionMode, slotCount, editorSpec,
  readChoice, readEditor, syncAll, mouseClick
} = require('./lib');
const { parseArgs } = require('./answers_util');

const args = parseArgs();

(async () => {
  const { browser, ctx } = await connect();
  const page = await openWorkPage(ctx, args.url);
  await page.bringToFront();

  const map = await qidMap(page);
  const qids = Object.values(map);

  // 提交前把编辑器内容同步进 textarea（提交接口只序列化表单）
  await syncAll(page, qids);

  // 提交前完整性自检
  const missing = [];
  for (const [num, qid] of Object.entries(map)) {
    const mode = await questionMode(page, qid);
    if (mode === 'choice') {
      const st = await readChoice(page, qid);
      if (!st.val) missing.push(`第${num}题 未作答`);
    } else {
      const slots = await slotCount(page, qid);
      for (let j = 1; j <= slots; j++) {
        const spec = await editorSpec(page, qid, j);
        if (!spec.textareaName) continue;
        const got = await readEditor(page, spec.textareaName);
        if (!got.content && !got.textarea) missing.push(`第${num}题 第${j}处 未作答`);
      }
    }
  }
  if (missing.length) {
    console.error('存在未作答的题目，已中止提交：');
    missing.forEach(m => console.error('  - ' + m));
    process.exit(3);
  }
  console.log(`[自检] ${Object.keys(map).length} 题全部有作答`);

  const net = [];
  page.on('response', async r => {
    if (r.request().method() === 'POST' || /work\/validate/.test(r.url())) {
      let body = ''; try { body = (await r.text()).slice(0, 300); } catch (e) { body = '<none>'; }
      net.push({ url: r.url(), status: r.status(), body });
    }
  });

  // 步骤 1：点击「提交」
  const btn = page.locator('a.completeBtn', { hasText: /^提交$/ }).first();
  if (await btn.count() === 0) {
    throw new Error('未找到「提交」按钮（页面可能已是提交后的只读状态）');
  }
  await mouseClick(page, btn, { hoverWait: 400 });
  console.log('[步骤1] 已点击「提交」');
  await page.waitForTimeout(2500);

  // 校验接口结果
  const validate = net.find(n => /work\/validate/.test(n.url));
  if (validate && validate.body) {
    try {
      const st = JSON.parse(validate.body).status;
      if (st === 1) throw new Error('平台返回「账号发生异常，请重新登录」，无法提交');
      if (st === 2) throw new Error('平台要求输入验证码，无法自动提交，请手动完成');
      console.log(`[步骤1] 平台校验 status=${st}`);
    } catch (e) {
      if (e.message && e.message.startsWith('平台')) throw e;
    }
  }

  // 步骤 2：确认弹窗
  const pop = page.locator('#workpop');
  const visible = await pop.count() > 0 && await pop.isVisible().catch(() => false);
  if (visible) {
    const txt = await pop.innerText().catch(() => '');
    console.log('[步骤2] 弹窗:', txt.replace(/\s+/g, ' ').trim());
    const okBtn = page.locator('#popok');
    if (await okBtn.count() === 0) throw new Error('弹窗内未找到确认按钮 #popok');
    await mouseClick(page, okBtn, { hoverWait: 350 });
    console.log('[步骤2] 已点击确认按钮');
  } else {
    console.log('[步骤2] 无确认弹窗（可能已直接提交）');
  }

  await page.waitForTimeout(4500);
  const state = await page.evaluate(() => ({
    url: location.href,
    head: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200)
  }));
  console.log('\n当前 URL:', state.url);
  console.log('页面摘要:', state.head);
  console.log('\n网络记录:');
  net.forEach(n => console.log(JSON.stringify(n).slice(0, 400)));
  console.log('\n提交完成。可执行 node scripts/check_result.js 核验逐题得分。');
  await browser.close();
})().catch(e => { console.error('ERR', e.message || e); process.exit(1); });
