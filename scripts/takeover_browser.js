// 接管已登录的浏览器：关闭 → 建链接 → 以 CDP 端口重启 → 校验就绪
// 用法: node scripts/takeover_browser.js [--browser edge|chrome|auto] [--port 9222] [--keep-open]
//
// 原理：Chromium 136+ 禁止在"默认用户数据目录"上启用 --remote-debugging-port。
// 这里在系统临时目录建一个指向真实 profile 的符号链接（Windows 用 junction），
// 把它作为 --user-data-dir —— 路径字符串与默认值不同即可通过校验，
// 而文件读写仍落在真实 profile 上，Cookie / 登录态完整保留。
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { parseArgs } = require('./answers_util');

const args = parseArgs();
const PORT = parseInt(args.port || '9222', 10);
const WANT = (args.browser || 'auto').toLowerCase();

function home(p) { return path.join(os.homedir(), p); }

const BROWSERS = {
  edge: {
    win: [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ],
    darwin: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    linux: ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable'],
    profile: {
      win: path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data'),
      darwin: home('Library/Application Support/Microsoft Edge'),
      linux: home('.config/microsoft-edge')
    },
    proc: { win: 'msedge', darwin: 'Microsoft Edge', linux: 'microsoft-edge' }
  },
  chrome: {
    win: [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
    ],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
    profile: {
      win: path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
      darwin: home('Library/Application Support/Google/Chrome'),
      linux: home('.config/google-chrome')
    },
    proc: { win: 'chrome', darwin: 'Google Chrome', linux: 'google-chrome' }
  }
};

function pickBrowser() {
  const order = WANT === 'auto' ? ['edge', 'chrome'] : [WANT];
  for (const key of order) {
    const b = BROWSERS[key];
    if (!b) continue;
    for (const exe of b[process.platform] || []) {
      if (exe && fs.existsSync(exe)) return { key, exe, def: b };
    }
  }
  throw new Error('未找到可用的 Edge/Chrome，请手动用 --browser 指定');
}

function closeBrowser(def) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /IM ${def.proc.win}.exe /F`, { stdio: 'ignore' });
    } else {
      execSync(`pkill -f "${def.proc[process.platform]}"`, { stdio: 'ignore' });
    }
    console.log(`[1/4] 已关闭 ${def.proc[process.platform]}`);
  } catch (e) {
    console.log(`[1/4] ${def.proc[process.platform]} 未在运行`);
  }
}

function ensureLink(target, linkPath) {
  if (!fs.existsSync(target)) throw new Error(`用户数据目录不存在: ${target}`);
  try {
    if (fs.existsSync(linkPath) || fs.lstatSync(linkPath)) {
      const st = fs.lstatSync(linkPath);
      if (st.isSymbolicLink()) {
        fs.unlinkSync(linkPath);
      } else {
        fs.rmSync(linkPath, { recursive: true, force: true });
      }
    }
  } catch (e) { /* 不存在则忽略 */ }
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(target, linkPath, type);
  console.log(`[2/4] 已建链接: ${linkPath} -> ${target}`);
}

async function waitCdp(port, tries = 25) {
  for (let i = 0; i < tries; i++) {
    await new Promise(r => setTimeout(r, 800));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch (e) { /* 未就绪 */ }
  }
  return null;
}

(async () => {
  const { key, exe, def } = pickBrowser();
  const profileDir = def.profile[process.platform];
  const linkPath = path.join(os.tmpdir(), `wb-${key}-ud`);

  console.log(`浏览器: ${key} (${exe})`);
  console.log(`配置目录: ${profileDir}`);

  if (!args['keep-open']) closeBrowser(def);
  ensureLink(profileDir, linkPath);

  const argv = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${linkPath}`,
    '--profile-directory=Default',
    '--restore-last-session',
    '--no-first-run',
    '--no-default-browser-check'
  ];
  const child = spawn(exe, argv, { detached: true, stdio: 'ignore' });
  child.unref();
  console.log(`[3/4] 已以 --remote-debugging-port=${PORT} 启动`);

  const ver = await waitCdp(PORT);
  if (!ver) throw new Error(`CDP 端口 ${PORT} 未就绪`);
  console.log(`[4/4] CDP 就绪: ${ver.Browser}`);
  console.log('');
  console.log(`接入: await chromium.connectOverCDP('http://127.0.0.1:${PORT}')`);
  console.log(`标签页: curl http://127.0.0.1:${PORT}/json/list`);
  console.log('');
  console.log('提示: 完成后可关闭这个标签页；浏览器恢复普通启动方式即可，无需删除链接。');
})().catch(e => { console.error('ERR', e.message || e); process.exit(1); });
