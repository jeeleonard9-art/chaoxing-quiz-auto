// 最后一步：完整性自检 → 「暂时保存」→ 「提交」→ 处理确认弹窗 → 报告结果
// 用法: node scripts/submit_work.js [--url <作业链接>] [--no-save]
//
// 为什么先「暂时保存」：
//   1) 学习通有风控与偶发 bug，先落一次草稿可以避免「页面异常 / 弹窗没反应」时答案被清空；
//   2) 实测某些版本平台页面的 submitValidate() 只在 /work/validate 返回 status 2/3 时才继续，
//      正常返回（302 → status 0）没有 else 分支，直接点「提交」会毫无反应。
//      先「暂时保存」再「提交」，确认弹窗才会正常弹出并走完提交链路。
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

  // ---------- 完整性自检 ----------
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

  // ---------- 网络监听 ----------
  const net = [];
  page.on('response', async r => {
    const u = r.url();
    if (r.request().method() === 'POST' || /work\/validate/.test(u)) {
      let body = ''; try { body = (await r.text()).slice(0, 400); } catch (e) { body = '<none>'; }
      net.push({ url: u, status: r.status(), method: r.request().method(), body, at: Date.now() });
    }
  });

  // ---------- 步骤 1：暂时保存（草稿落库） ----------
  if (!args['no-save']) {
    const saveBtn = page.locator('a', { hasText: /^暂时保存$/ }).first();
    if (await saveBtn.count() === 0) {
      console.log('[步骤1] 未找到「暂时保存」按钮，跳过草稿保存');
    } else {
      let saved = false;
      for (let attempt = 1; attempt <= 3 && !saved; attempt++) {
        const before = net.length;
        await mouseClick(page, saveBtn, { hoverWait: 300 });
        for (let i = 0; i < 40; i++) {
          await page.waitForTimeout(400);
          const hit = net.slice(before).find(n => n.body && /保存成功|"status"\s*:\s*true/.test(n.body) && /addStudentWorkNewWeb/.test(n.url));
          if (hit) { saved = true; console.log(`[步骤1] 暂时保存成功（第${attempt}次尝试）`); break; }
        }
        if (!saved) {
          console.log(`  暂时保存第${attempt}次未拿到成功响应，重试`);
          await page.waitForTimeout(1200);
        }
      }
      if (!saved) {
        console.log('[步骤1] 暂时保存未确认成功，仍继续尝试提交（提交前会再次校验）');
      }
    }
  } else {
    console.log('[步骤1] 按 --no-save 跳过暂时保存');
  }

  // ---------- 步骤 2：点击「提交」 ----------
  const btn = page.locator('a.completeBtn', { hasText: /^提交$/ }).first();
  if (await btn.count() === 0) {
    throw new Error('未找到「提交」按钮（页面可能已是提交后的只读状态）');
  }
  await mouseClick(page, btn, { hoverWait: 400 });
  console.log('[步骤2] 已点击「提交」');
  await page.waitForTimeout(2500);

  const validate = net.find(n => /work\/validate/.test(n.url));
  if (validate && validate.body) {
    try {
      const st = JSON.parse(validate.body).status;
      console.log(`[步骤2] 平台校验 status=${st}（HTTP ${validate.status}）`);
      if (st === 1) throw new Error('平台返回「账号发生异常，请重新登录」，无法提交');
    } catch (e) {
      if (e.message && e.message.startsWith('平台')) throw e;
      console.log(`[步骤2] 平台校验返回无法解析: ${String(validate.body).slice(0, 120)}`);
    }
  }

  // ---------- 步骤 3：确认弹窗 ----------
  const pop = page.locator('#workpop');
  const visible = async () => await pop.count() > 0 && await pop.isVisible().catch(() => false);

  if (!(await visible())) {
    // 平台页面的 submitValidate() 在 /work/validate 返回非 2/3 时没有 else 分支，
    // 会导致「点了提交什么也没发生」。这里直接调用平台自己的 ready2Submit()：
    // 它内部会做完整性校验、syncAnswer 同步富文本，并弹出「确认提交？」。
    console.log('[步骤3] 确认框未出现，尝试调用平台自身的 ready2Submit() 兜底');
    await page.evaluate(() => { try { window.ready2Submit && window.ready2Submit(); } catch (e) { /* ignore */ } });
    await page.waitForTimeout(2000);
  }

  if (await visible()) {
    const txt = (await pop.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    console.log('[步骤3] 弹窗:', txt);

    // 护栏：平台提示还有未做完的题目时，绝不点确认
    if (/未做完|未作答|还有/.test(txt)) {
      console.error(`\n弹窗提示「${txt}」—— 存在未作答题目，拒绝确认提交。`);
      await page.screenshot({ path: 'submit_blocked.png' }).catch(() => {});
      process.exit(4);
    }
    if (!/确认提交|提交/.test(txt)) {
      console.error(`\n弹窗文案异常：「${txt}」，为安全起见不自动确认。`);
      process.exit(4);
    }

    const okBtn = page.locator('#popok');
    if (await okBtn.count() === 0) throw new Error('弹窗内未找到确认按钮 #popok');
    await mouseClick(page, okBtn, { hoverWait: 350 });
    console.log('[步骤3] 已点击确认按钮 #popok');
  } else {
    throw new Error('未能出现「确认提交？」弹窗，提交未完成（请查看 troubleshooting.md）');
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
  console.log('\n===== 任务完成 =====');
  console.log('作业已提交。提交为不可更改的最终结果，流程到此结束。');
  await browser.close();
})().catch(e => { console.error('ERR', e.message || e); process.exit(1); });
