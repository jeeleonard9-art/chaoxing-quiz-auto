// 公共工具：CDP 连接、作业页定位、题目结构读取、表单读写、鼠标模拟
// 依赖：playwright-core（仅用于连接已有浏览器，不下载浏览器内核）
'use strict';

const CDP_URL = process.env.CDP_URL || process.env.CHAOXING_CDP_URL || 'http://127.0.0.1:9222';

function requirePlaywright() {
  // playwright-core 1.6x 在 Node < 20 上是 process.exit(1) 直接退出（try/catch 拦不住），
  // 所以先看版本再 require，给出可读的提示。
  const major = +process.versions.node.split('.')[0];
  if (major < 20) {
    throw new Error(
      `Node.js 版本过低：当前 ${process.versions.node}，playwright-core 1.6x 要求 Node 20+。\n` +
      '请升级 Node 后重试。'
    );
  }
  try {
    return require('playwright-core');
  } catch (e) {
    throw new Error(
      '缺少依赖 playwright-core。请先在本目录执行：\n' +
      '  npm install\n' +
      '（或 npm i playwright-core --no-audit --no-fund）'
    );
  }
}

/** 连接已开启远程调试端口的浏览器 */
async function connect(cdpUrl = CDP_URL) {
  const { chromium } = requirePlaywright();
  const browser = await chromium.connectOverCDP(cdpUrl);
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error('浏览器没有可用上下文');
  return { browser, ctx, chromium };
}

/** 在已打开的标签页中查找超星作业页 */
async function findPage(ctx, patterns = ['/work/dowork']) {
  const pages = ctx.pages();
  for (const p of patterns) {
    const hit = pages.find(x => x.url().includes(p));
    if (hit) return hit;
  }
  return null;
}

/**
 * 打开（或复用）作业页。
 * @param ctx  browser context
 * @param url  超星作业 URL；为空则只找已打开的页面
 */
async function openWorkPage(ctx, url) {
  const existing = await findPage(ctx, ['/work/dowork', '/work/view']);
  if (existing) return existing;
  if (!url) throw new Error('未找到已打开的超星作业页，请用 --url 传入作业链接');
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  return page;
}

/** 题号 -> qid 映射 */
async function qidMap(page) {
  return await page.evaluate(() => {
    const o = {};
    document.querySelectorAll('h3.mark_name').forEach(h3 => {
      const m = h3.innerText.trim().match(/^(\d+)\./);
      if (!m) return;
      const c = h3.closest('[id^=question]');
      if (c) o[m[1]] = c.id.replace('question', '');
    });
    return o;
  });
}

/** 题型：0 单选 / 1 多选 / 2 填空 / 3 判断 / 4+ 主观（编辑器） */
async function questionType(page, qid) {
  return await page.evaluate((q) => {
    const i = document.querySelector('#answertype' + q);
    return i ? i.value : null;
  }, qid);
}

/** 该题是客观题（带选项）还是主观题（编辑器） */
async function questionMode(page, qid) {
  return await page.evaluate((q) => {
    const opts = document.querySelectorAll(`div.answerBg[qid="${q}"]`);
    if (opts.length) return 'choice';
    if (document.querySelector(`textarea[name="answerEditor${q}1"]`)) return 'blank';
    if (document.querySelector(`textarea[name="answer${q}"]`)) return 'subjective';
    return 'unknown';
  }, qid);
}

/** 填空题空位数；主观题返回 1 */
async function slotCount(page, qid) {
  return await page.evaluate((q) => {
    const i = document.querySelector(`input[name="tiankongsize${q}"]`);
    if (i) return parseInt(i.value || '0', 10);
    if (document.querySelector(`textarea[name="answer${q}"]`)) return 1;
    return 0;
  }, qid);
}

/**
 * 该题第 index 个编辑器（1 起）的 textarea 名与对应 iframe 在题目容器内的序号。
 *
 * 注意超星的 DOM 结构：textarea 与编辑器容器 div 是**兄弟节点**，
 * 都在 .textDIV 之下，所以要从 textarea 的祖先里找 iframe，不能用 closest('.edui-default')。
 */
async function editorSpec(page, qid, index) {
  return await page.evaluate(({ q, i }) => {
    const cont = document.querySelector('#question' + q);
    const iframes = cont ? [...cont.querySelectorAll('div[id$="_iframeholder"] > iframe')] : [];
    const pick = (name) => {
      const ta = document.querySelector(`textarea[name="${name}"]`);
      if (!ta) return null;
      let node = ta.parentElement;
      for (let up = 0; up < 4 && node; up++, node = node.parentElement) {
        const f = node.querySelector('div[id$="_iframeholder"] > iframe');
        if (f) {
          const idx = iframes.indexOf(f);
          return { textareaName: name, iframeIndex: idx >= 0 ? idx : 0, iframeCount: iframes.length };
        }
      }
      // 兜底：容器内只有一个编辑器时，用第 0 个
      return { textareaName: name, iframeIndex: iframes.length === 1 ? 0 : -1, iframeCount: iframes.length };
    };
    const blank = pick('answerEditor' + q + i);
    if (blank) return blank;
    const subjective = pick('answer' + q);
    if (subjective) return subjective;
    return { textareaName: null, iframeIndex: -1, iframeCount: iframes.length };
  }, { q: qid, i: index });
}

/** 读取客观题平台实际写入的值 + 被勾选的选项 */
async function readChoice(page, qid) {
  return await page.evaluate((q) => {
    const i = document.querySelector('#answer' + q);
    const marked = [...document.querySelectorAll('.choice' + q + '.check_answer')].map(e => e.getAttribute('data'));
    return { val: i ? i.value : null, marked };
  }, qid);
}

/** 读取编辑器内容（纯文本 + textarea 文本） */
async function readEditor(page, textareaName) {
  return await page.evaluate((name) => {
    try {
      const ed = UE.getEditor(name);
      const ta = document.querySelector(`textarea[name="${name}"]`);
      const strip = s => (s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      return { content: strip(ed.getContent()), textarea: strip(ta ? ta.value : '') };
    } catch (e) {
      const ta = document.querySelector(`textarea[name="${name}"]`);
      const strip = s => (s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      return { content: strip(ta ? ta.value : ''), textarea: strip(ta ? ta.value : '') };
    }
  }, textareaName);
}

/** 清空整张表单，返回是否清干净 */
async function resetForm(page, qids) {
  return await page.evaluate((qids) => {
    qids.forEach(q => { const i = document.querySelector('#answer' + q); if (i) i.value = ''; });
    document.querySelectorAll('.check_answer').forEach(e => e.classList.remove('check_answer'));
    document.querySelectorAll('div.answerBg').forEach(e => {
      e.setAttribute('aria-checked', 'false'); e.setAttribute('aria-pressed', 'false');
    });
    document.querySelectorAll('textarea[name^="answerEditor"], textarea[name^="answer"]').forEach(t => {
      if (!/^answer(Editor)?\d/.test(t.name)) return;
      try { const ed = UE.getEditor(t.name); ed.setContent(''); ed.sync(); } catch (e) {}
    });
    const objOk = qids.every(q => { const i = document.querySelector('#answer' + q); return !i || !i.value; });
    const edOk = [...document.querySelectorAll('textarea[name^="answerEditor"], textarea[name^="answer"]')]
      .filter(t => /^answer(Editor)?\d/.test(t.name))
      .every(t => {
        try { return UE.getEditor(t.name).getContent().replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() === ''; }
        catch (e) { return true; }
      });
    const markOk = document.querySelectorAll('.check_answer').length === 0;
    return objOk && edOk && markOk;
  }, qids);
}

/** 把编辑器内容同步进 textarea（提交接口只序列化表单，不 sync 会丢答案） */
async function syncAll(page, qids) {
  return await page.evaluate((qids) => {
    qids.forEach(q => {
      const type = (document.querySelector('#answertype' + q) || {}).value;
      const names = [];
      if (type === '2' || type === '9' || type === '10') {
        const n = parseInt(((document.querySelector(`input[name="tiankongsize${q}"]`) || {}).value) || '0', 10);
        for (let j = 1; j <= n; j++) names.push('answerEditor' + q + j);
      } else {
        names.push('answer' + q);
      }
      names.forEach(n => { try { const ed = UE.getEditor(n); ed.sync(); } catch (e) {} });
    });
    return true;
  }, qids);
}

/** 鼠标移动并点击某元素（先滚动到视野中心，规避顶部吸顶栏遮挡） */
async function mouseClick(page, locator, opts = {}) {
  const dx = opts.dx || 0, dy = opts.dy || 0;
  await locator.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await page.waitForTimeout(opts.scrollWait || 260);
  const box = await locator.boundingBox();
  if (!box) return false;
  const x = box.x + box.width / 2 + dx, y = box.y + box.height / 2 + dy;
  await page.mouse.move(x, y);
  await page.waitForTimeout(opts.hoverWait || 180);
  await page.mouse.click(x, y);
  return true;
}

/** 在编辑器 iframe 内用真实键盘输入 */
async function typeIntoEditor(page, iframeLocator, text, opts = {}) {
  await iframeLocator.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(opts.scrollWait || 260);
  const box = await iframeLocator.boundingBox();
  if (!box) return false;
  await page.mouse.move(box.x + 20, box.y + 16);
  await page.waitForTimeout(opts.hoverWait || 160);
  await page.mouse.click(box.x + 20, box.y + 16);
  await page.waitForTimeout(opts.focusWait || 260);
  await page.keyboard.type(text, { delay: opts.typeDelay || 45 });
  await page.waitForTimeout(opts.settleWait || 300);
  return true;
}

/**
 * 抽取作业页的全部题目结构（纯页面侧逻辑，可离线对存档 HTML 做校验）
 */
async function extractQuestions(page) {
  const map = await qidMap(page);
  const data = await page.evaluate((qids) => {
    const TYPE_NAME = { '0': '单选题', '1': '多选题', '2': '填空题', '3': '判断题' };
    const out = [];
    qids.forEach(([num, qid]) => {
      const h3 = [...document.querySelectorAll('h3.mark_name')]
        .find(x => x.innerText.trim().startsWith(num + '.'));
      const cont = h3 ? (h3.closest('[id^=question]') || h3.parentElement) : null;
      const title = h3 ? h3.innerText.replace(/\s+/g, ' ').trim() : '';
      const type = (document.querySelector('#answertype' + qid) || {}).value;
      const slotsEl = document.querySelector(`input[name="tiankongsize${qid}"]`);
      const slots = slotsEl ? parseInt(slotsEl.value || '0', 10) : 0;
      const isSubjective = !slots && !!document.querySelector(`textarea[name="answer${qid}"]`);

      const options = cont ? [...cont.querySelectorAll('div.answerBg')].map(d => {
        const span = d.querySelector('[data]');
        return {
          letter: span ? span.getAttribute('data') : null,
          text: (d.querySelector('.answer_p') || d).innerText.replace(/\s+/g, ' ').trim()
        };
      }) : [];

      const blanks = [];
      const count = slots > 0 ? slots : (isSubjective ? 1 : 0);
      const iframes = cont ? [...cont.querySelectorAll('div[id$="_iframeholder"] > iframe')] : [];
      const findIframeIndex = (ta) => {
        if (!ta) return -1;
        let node = ta.parentElement;
        for (let up = 0; up < 4 && node; up++, node = node.parentElement) {
          const f = node.querySelector('div[id$="_iframeholder"] > iframe');
          if (f) { const i = iframes.indexOf(f); return i >= 0 ? i : 0; }
        }
        return iframes.length === 1 ? 0 : -1;
      };
      for (let j = 1; j <= count; j++) {
        const name = slots > 0 ? 'answerEditor' + qid + j : 'answer' + qid;
        const ta = document.querySelector(`textarea[name="${name}"]`);
        const iframeIndex = findIframeIndex(ta);
        blanks.push({ index: j, textareaName: name, iframeIndex, iframeCount: iframes.length });
      }

      out.push({
        num: parseInt(num, 10), qid, type,
        typeName: TYPE_NAME[type] || `主观题(type=${type})`,
        mode: options.length ? 'choice' : (slots > 0 ? 'blank' : (isSubjective ? 'subjective' : 'unknown')),
        title, slots, options, blanks
      });
    });
    return out;
  }, Object.entries(map));

  data.forEach(q => {
    if (/标签/.test(q.title) || /和标签/.test(q.title) || /\("|'\("/.test(q.title)) {
      q.note = '题干中有尖括号标签被服务端剥离（如 <servlet-mapping>），需按上下文还原';
    }
  });
  return data;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = {
  CDP_URL, connect, findPage, openWorkPage, qidMap, questionType, questionMode,
  slotCount, editorSpec, readChoice, readEditor, resetForm, syncAll,
  mouseClick, typeIntoEditor, sleep, extractQuestions
};
