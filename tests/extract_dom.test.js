// 离线 DOM 测试：用纯合成夹具验证抽题逻辑
// 需要本机有 Edge/Chrome；找不到浏览器时自动跳过（CI 未必装浏览器）
//
// 夹具 tests/fixtures/mock_work.html 是手工构造的**合成**页面，
// 不含任何真实课程、真实题目、真实答案或账号信息：
// 5 道占位题（单选 / 多选 / 判断 / 填空 / 简答 各 1 道），
// 复刻超星作业页的 DOM 结构特征，用于验证解析与定位逻辑。
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

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

// 把本地路径转成 file:// URL。
// 用 node:url 的 pathToFileURL 统一处理编码：目录含空格或中文时，
// 手写拼接会因 URL 编码不一致导致路由拦截匹配失败。
function toFileUrl(p) {
  return pathToFileURL(p).href;
}

test('从合成夹具中抽取全部题目结构', async (t) => {
  const pw = loadPlaywright();
  if (!pw) { t.skip('playwright-core 不可用（需 Node 20+），跳过 DOM 测试'); return; }
  const exe = findBrowser();
  if (!exe) { t.skip('本机未找到 Edge/Chrome，跳过 DOM 测试'); return; }
  if (!fs.existsSync(FIXTURE)) { t.skip('缺少测试夹具'); return; }

  let browser;
  try {
    browser = await pw.chromium.launch({ executablePath: exe, headless: true });
  } catch (e) {
    // 沙箱/权限/浏览器起不来都是环境限制，降级为跳过而不是让流水线变红
    t.skip(`无法启动无头浏览器（${String(e.message || e).slice(0, 120)}）`);
    return;
  }

  try {
    const page = await browser.newPage();
    // 只放行顶层文档：任何子资源请求一律 abort，避免 file:// 下出现带主机名的路径卡住解析
    const fileUrl = toFileUrl(FIXTURE);
    await page.route('**/*', route =>
      route.request().url() === fileUrl ? route.continue() : route.abort());
    await page.goto(fileUrl, { waitUntil: 'commit', timeout: 30000 }).catch(() => {});
    await page.waitForSelector('h3.mark_name', { state: 'attached', timeout: 30000 });

    const qs = await extractQuestions(page);

    // 题量与题型：单选 / 多选 / 判断 / 填空 / 简答 各 1 道
    assert.strictEqual(qs.length, 5, '应抽出 5 道占位题');
    assert.deepStrictEqual(qs.map(q => q.typeName),
      ['单选题', '多选题', '判断题', '填空题', '主观题(type=4)']);
    assert.deepStrictEqual(qs.map(q => q.mode),
      ['choice', 'choice', 'choice', 'blank', 'subjective']);

    // 题号连续、题干通用化
    assert.deepStrictEqual(qs.map(q => q.num), [1, 2, 3, 4, 5]);
    qs.forEach(q => assert.ok(q.title.length > 0, `第${q.num}题应有题干`));

    // 客观题：选项字母齐全；判断题用 true/false
    for (const q of qs.filter(x => x.mode === 'choice')) {
      assert.ok(q.options.length > 0, `第${q.num}题应有选项`);
      assert.ok(q.options.every(o => o.letter), `第${q.num}题选项字母缺失`);
      assert.ok(q.options.every(o => o.text), `第${q.num}题选项文本缺失`);
    }
    assert.deepStrictEqual(qs[0].options.map(o => o.letter), ['A', 'B', 'C', 'D']);
    assert.deepStrictEqual(qs[1].options.map(o => o.letter), ['A', 'B', 'C']);
    assert.deepStrictEqual(qs[2].options.map(o => o.letter), ['true', 'false']);

    // 填空题：空位数与编辑器一一对应，iframe 序号在容器范围内
    const blank = qs.find(q => q.mode === 'blank');
    assert.strictEqual(blank.slots, 2);
    assert.strictEqual(blank.platformSlots, 2);
    assert.strictEqual(blank.blanks.length, 2);
    assert.deepStrictEqual(blank.blanks.map(b => b.textareaName),
      ['answerEditor1000000041', 'answerEditor1000000042']);
    for (const bl of blank.blanks) {
      assert.ok(bl.iframeIndex >= 0, `第${bl.index}空未定位到编辑器`);
      assert.ok(bl.iframeIndex < bl.iframeCount, `第${bl.index}空编辑器序号越界`);
      const spec = await editorSpec(page, blank.qid, bl.index);
      assert.strictEqual(spec.textareaName, bl.textareaName);
      assert.ok(spec.iframeIndex >= 0 && spec.iframeIndex < spec.iframeCount);
    }

    // 简答题：单个编辑器，textarea 名为 answer<qid>；平台不提供 tiankongsize，需填 1 处
    const subj = qs.find(q => q.mode === 'subjective');
    assert.strictEqual(subj.slots, 1, '简答题需要填 1 处');
    assert.strictEqual(subj.platformSlots, 0, '简答题平台不提供 tiankongsize');
    assert.strictEqual(subj.blanks.length, 1);
    assert.strictEqual(subj.blanks[0].textareaName, 'answer100000005');
    const subjSpec = await editorSpec(page, subj.qid, 1);
    assert.strictEqual(subjSpec.textareaName, 'answer100000005');

    // 题干里出现「标签」字样时应给出剥离提示
    assert.ok(qs.filter(q => q.note).length > 0, '题干含被剥离标签时应给出提示');
  } finally {
    await browser.close();
  }
});
