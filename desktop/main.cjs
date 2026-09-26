const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const { createHmac, randomBytes } = require('node:crypto');
const { readFile, mkdir, writeFile } = require('node:fs/promises');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const appId = 'com.carboniq.desktop';
let mainWindow;
let setupWindow;
let serverProcess;
let serverPort;

app.setAppUserModelId(appId);
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => mainWindow?.focus() || setupWindow?.focus());

function configPath() { return process.env.CARBONIQ_DESKTOP_CONFIG_PATH || path.join(app.getPath('userData'), 'config.json'); }

function validateBaseUrl(input) {
  const url = new URL(String(input || '').trim());
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('远程模型接口必须使用 HTTPS。');
  if (url.username || url.password || url.search || url.hash) throw new Error('Base URL 不能包含账号、密码、查询或锚点。');
  return url.toString().replace(/\/$/, '');
}

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function stopServer() {
  if (!serverProcess) return;
  const child = serverProcess;
  serverProcess = null;
  child.kill();
  await new Promise((resolve) => { if (child.exitCode !== null) resolve(); else { child.once('exit', resolve); setTimeout(resolve, 3000); } });
}

async function startServer(config) {
  await stopServer();
  serverPort = await freePort();
  const script = app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'local.mjs')
    : path.join(__dirname, '..', 'server', 'local.mjs');
  serverProcess = spawn(process.execPath, [script], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', CARBONIQ_DESKTOP: '1', CARBONIQ_CONFIG_PATH: configPath(), PORT: String(serverPort) },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  serverProcess.stderr.on('data', (chunk) => { output = (output + chunk.toString()).slice(-1500); });
  const address = `http://127.0.0.1:${serverPort}`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (serverProcess.exitCode !== null) throw new Error(`本地服务未能启动：${output || '进程已退出'}`);
    try { if ((await fetch(`${address}/login`)).ok) return address; } catch { /* Starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`本地服务启动超时：${output}`);
}

async function openMain(config) {
  const address = await startServer(config);
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = new BrowserWindow({
      width: 1320, height: 860, minWidth: 900, minHeight: 650,
      title: 'CarbonIQ', show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(`http://127.0.0.1:${serverPort}/`)) event.preventDefault(); });
    mainWindow.once('ready-to-show', () => mainWindow?.show());
    mainWindow.on('closed', () => { mainWindow = null; });
  }
  const expires = String(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const signature = createHmac('sha256', config.cookieSecret).update(`v1.${expires}`).digest('base64url');
  await mainWindow.webContents.session.cookies.set({
    url: address, name: 'carboniq_session', value: `v1.${expires}.${signature}`,
    httpOnly: true, sameSite: 'strict', expirationDate: Number(expires) / 1000,
  });
  await mainWindow.loadURL(`${address}/`);
  mainWindow.show();
  setupWindow?.close();
}

function openSetup() {
  if (setupWindow && !setupWindow.isDestroyed()) { setupWindow.focus(); return; }
  setupWindow = new BrowserWindow({
    width: 560, height: 590, resizable: false, title: 'CarbonIQ · 模型配置',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  setupWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  setupWindow.loadFile(path.join(__dirname, 'setup.html'));
  setupWindow.on('closed', () => { setupWindow = null; });
}

ipcMain.handle('desktop:save-config', async (_event, input) => {
  try {
    const baseUrl = validateBaseUrl(input?.baseUrl);
    const model = String(input?.model || '').trim();
    const apiKey = String(input?.apiKey || '').trim();
    if (!model || !apiKey) throw new Error('模型 ID 和 API Key 不能为空。');
    const old = await readFile(configPath(), 'utf8').then(JSON.parse).catch(() => null);
    const config = {
      baseUrl, model, apiKey,
      accessCode: old?.accessCode || randomBytes(18).toString('base64url'),
      cookieSecret: old?.cookieSecret || randomBytes(32).toString('base64url'),
    };
    await mkdir(path.dirname(configPath()), { recursive: true });
    await writeFile(configPath(), JSON.stringify(config, null, 2), { mode: 0o600 });
    await openMain(config);
    return { ok: true };
  } catch (error) { return { ok: false, message: error.message }; }
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'CarbonIQ', submenu: [
      { label: '模型配置', click: openSetup },
      { type: 'separator' },
      { role: 'quit', label: '退出' },
    ] },
  ]));
  const config = await readFile(configPath(), 'utf8').then(JSON.parse).catch(() => null);
  if (!config) return openSetup();
  try { await openMain(config); }
  catch (error) { dialog.showErrorBox('CarbonIQ 启动失败', error.message); openSetup(); }
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { serverProcess?.kill(); });
