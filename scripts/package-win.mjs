import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') throw new Error('Windows 安装包必须在 Windows 上构建。');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const electronDist = path.join(root, 'node_modules', 'electron', 'dist');
const electronExe = path.join(electronDist, 'electron.exe');
const builder = path.join(root, 'node_modules', 'electron-builder', 'cli.js');

function run(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: root, stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${path.basename(executable)} 退出，状态码 ${code}`)));
  });
}

if (!existsSync(electronExe)) await run(process.execPath, [path.join(root, 'node_modules', 'electron', 'install.js')]);
if (!existsSync(electronExe)) throw new Error('未找到 Electron 运行时。');

await run(process.execPath, [builder, '--win', '--dir', '--x64', `--config.electronDist=${electronDist}`]);

const cacheRoot = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'nsis', 'nsis-3.0.4.1');
const cachedNsis = cacheRoot && path.join(cacheRoot, 'Bin', 'makensis.exe');
const makensis = process.env.CARBONIQ_MAKENSIS || (cachedNsis && existsSync(cachedNsis) ? cachedNsis : 'makensis.exe');
const source = path.join(root, 'release', 'win-unpacked');
const output = path.join(root, 'release', 'CarbonIQ-Setup-0.2.0-x64.exe');
await run(makensis, [`/DSOURCE_DIR=${source}`, `/DOUTPUT_FILE=${output}`, path.join(root, 'installer', 'CarbonIQ.nsi')], {
  env: { ...process.env, ...(cacheRoot && makensis === cachedNsis ? { NSISDIR: cacheRoot } : {}) },
});
console.log(`安装包已生成：${output}`);
