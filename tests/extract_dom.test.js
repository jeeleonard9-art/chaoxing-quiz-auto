// 离线 DOM 测试：用脱敏后的真实页面存档验证抽题逻辑
// 需要本机有 Edge/Chrome；找不到浏览器时自动跳过（CI 未必装浏览器）
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { extractQuestions, editorSpec } = require('../scripts/lib');

const FIXTURE = path.join(__dirname, 'fixtures', 'mock_work.html');

// playwright-core 1.6x 要求 Node 20+，且在低版本上是 process.exit(1) 直接退出，
// 因此必须先看版本再 require，否则 try/catch 拦不住、整条流水线会红。
function loadPlaywright() {
  const major = +process.versions.node.split('.')[0];
  if (major < 20) return null;
  try {
    return require('playwright-core');
  } catch (e) {
    return null;
  }
}

function findBrowser() {
  const home = os.homedir();
  const cands = process.platform === 'win32' ? [
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ] : process.platform === 'darwin' ? [
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ] : [
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'
  ];
  return cands.find(c => c && fs.existsSync(c)) || null;
}

test('从真实页面存档中抽取全部题目结构', async (t) => {
  const pw = loadPlaywright();
  if (!pw) { t.skip('playwright-core 不可用（需 Node 20+），跳过 DOM 测试'); return; }
  const exe = findBrowser();
  if (!exe) { t.skip('本机未找到 Edge/Chrome，跳过 DOM 测试'); return; }
  if (!fs.existsSync(FIXTURE)) { t.skip('缺少测试夹具'); return; }

  const browser = await pw.chromium.launch({ executablePath: exe, headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith('file://') || u.startsWith('data:')) return route.continue();
      return route.abort();
    });
    await page.goto('file:///' + FIXTURE.replace(/\\/g, '/'), { waitUntil: 'load', timeout: 30000 });

    const qs = await extractQuestions(page);
    assert.strictEqual(qs.length, 57, '应抽出 57 题');
    assert.strictEqual(qs.filter(q => q.typeName === '单选题').length, 19);
    assert.strictEqual(qs.filter(q => q.typeName === '判断题').length, 20);
    assert.strictEqual(qs.filter(q => q.typeName === '填空题').length, 18);

    // 客观题：选项字母齐全，判断题用 true/false
    for (const q of qs.filter(x => x.mode === 'choice')) {
      assert.ok(q.options.length > 0, `第${q.num}题应有选项`);
      assert.ok(q.options.every(o => o.letter), `第${q.num}题选项字母缺失`);
      assert.ok(q.options.every(o => o.text), `第${q.num}题选项文本缺失`);
    }
    const tf = qs.find(q => q.num === 20);
    assert.deepStrictEqual(tf.options.map(o => o.letter), ['true', 'false']);

    // 填空题：编辑器与 iframe 一一对应且序号在容器范围内
    for (const q of qs.filter(x => x.mode === 'blank')) {
      assert.strictEqual(q.blanks.length, q.slots, `第${q.num}题空位数不符`);
      for (const bl of q.blanks) {
        assert.ok(bl.iframeIndex >= 0, `第${q.num}题第${bl.index}空未定位到编辑器`);
        assert.ok(bl.iframeIndex < bl.iframeCount, `第${q.num}题第${bl.index}空编辑器序号越界`);
        const spec = await editorSpec(page, q.qid, bl.index);
        assert.strictEqual(spec.textareaName, bl.textareaName);
        assert.ok(spec.iframeIndex >= 0 && spec.iframeIndex < spec.iframeCount);
      }
    }

    // 已知 quirk：第 55 题题干有两处下划线，平台只建 1 个空位
    const q55 = qs.find(q => q.num === 55);
    assert.strictEqual(q55.slots, 1);
    assert.ok(q55.note, '题干标签被剥离时应给出提示');

    // 被服务端剥离的标签应触发提示
    assert.ok(qs.filter(q => q.note).length > 0);
  } finally {
    await browser.close();
  }
});
