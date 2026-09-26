import { createServer } from "node:http";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, mkdir, writeFile, chmod, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const configFile = path.resolve(process.env.CARBONIQ_CONFIG_PATH || path.join(root, ".local", "config.json"));
const dist = path.join(root, "dist");
const host = process.argv.includes("--lan") ? "0.0.0.0" : "127.0.0.1";
const port = Number(process.env.PORT || 4174);
const cookieName = "carboniq_session";
const sessionSeconds = 30 * 24 * 60 * 60;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2" };

function chatEndpoint(input) {
  const url = new URL(input);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error("远程模型接口必须使用 HTTPS。");
  if (url.username || url.password || url.search || url.hash) throw new Error("Base URL 不能包含账号、密码、查询或锚点。");
  const base = url.pathname.replace(/\/+$/, "");
  url.pathname = base.endsWith("/chat/completions") ? base : `${base || "/v1"}/chat/completions`;
  return url.toString();
}

async function firstRun() {
  if (!stdin.isTTY) throw new Error(`缺少 ${configFile}。请在交互式终端运行 npm run local 完成首次配置。`);
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    console.log("首次启动：配置 OpenAI 兼容模型接口。配置只保存在本机 .local/config.json。\n");
    const baseUrl = (await prompt.question("Base URL: ")).trim();
    chatEndpoint(baseUrl);
    const model = (await prompt.question("模型 ID: ")).trim();
    const apiKey = (await prompt.question("API Key（输入会显示在终端，请确认旁边无人观看）: ")).trim();
    if (!model || !apiKey) throw new Error("模型 ID 和 API Key 不能为空。");
    const accessCode = randomBytes(18).toString("base64url");
    const config = { baseUrl, model, apiKey, accessCode, cookieSecret: randomBytes(32).toString("base64url") };
    await mkdir(path.dirname(configFile), { recursive: true, mode: 0o700 });
    await writeFile(configFile, JSON.stringify(config, null, 2), { mode: 0o600, flag: "wx" });
    await chmod(configFile, 0o600).catch(() => {});
    console.log(`\n访问码：${accessCode}\n请妥善保存。以后启动无需重输模型配置。`);
    return config;
  } finally { prompt.close(); }
}

let config;
try { config = JSON.parse(await readFile(configFile, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; config = await firstRun(); }
if (![config.accessCode, config.cookieSecret].every((value) => typeof value === "string" && value.trim())) throw new Error("本机配置不完整，请检查 .local/config.json。");
function activeModel() {
  if (Array.isArray(config.profiles)) return config.profiles.find((profile) => profile.id === config.activeProfileId) || null;
  return config.model && config.apiKey ? config : null;
}
if (!process.env.CARBONIQ_DESKTOP && !activeModel()) throw new Error("本机配置缺少模型，请检查 .local/config.json。");
if (activeModel()) chatEndpoint(activeModel().baseUrl);
async function refreshDesktopConfig() {
  if (process.env.CARBONIQ_DESKTOP === "1") config = JSON.parse(await readFile(configFile, "utf8"));
}
if (!(await stat(path.join(dist, "index.html")).catch(() => null))) throw new Error("未找到 dist/index.html，请先运行 npm run build。");

function signature(expires) { return createHmac("sha256", config.cookieSecret).update(`v1.${expires}`).digest("base64url"); }
function cookieValid(req) {
  const value = (req.headers.cookie || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const match = /^v1\.(\d+)\.([A-Za-z0-9_-]+)$/.exec(value || "");
  if (!match || Number(match[1]) <= Date.now()) return false;
  const expected = Buffer.from(signature(match[1]));
  const actual = Buffer.from(match[2]);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function send(res, status, body, contentType = "text/plain; charset=utf-8", extra = {}) {
  res.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", ...extra });
  res.end(body);
}
function json(res, status, value) { send(res, status, JSON.stringify(value), "application/json; charset=utf-8"); }
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
async function body(req, limit = 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw new Error("请求数据过大。"); chunks.push(chunk); }
  return Buffer.concat(chunks).toString("utf8");
}
const loginHtml = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CarbonIQ 访问验证</title><style>body{font:16px system-ui;background:#eef7f1;color:#173b30;display:grid;place-items:center;min-height:100vh;margin:0}main{background:white;padding:32px;border-radius:18px;width:min(340px,calc(100vw - 48px));box-shadow:0 20px 60px #1745321c}h1{font-size:24px}input,button{box-sizing:border-box;width:100%;padding:12px;margin-top:12px;border-radius:9px;font:inherit}input{border:1px solid #a9c8b8}button{background:#277b59;color:white;border:0;cursor:pointer}p{font-size:13px;color:#60796b}</style><main><h1>进入 CarbonIQ</h1><p>请输入网站所有者提供的访问码。本设备验证后 30 天内无需重复输入。</p><form method="post" action="/login"><input type="password" name="code" autocomplete="current-password" placeholder="访问码" required><button>进入网站</button></form></main></html>`;
let failedLogins = [];
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    if (req.method === "POST" && !sameOrigin(req)) return json(res, 403, { error: "跨站请求已拒绝。" });
    if (pathname === "/login" && req.method === "POST") {
      const now = Date.now(); failedLogins = failedLogins.filter((time) => now - time < 60_000);
      if (failedLogins.length >= 10) return send(res, 429, "尝试过多，请一分钟后重试。");
      const code = new URLSearchParams(await body(req, 4096)).get("code") || "";
      const supplied = Buffer.from(code); const correct = Buffer.from(config.accessCode);
      if (supplied.length !== correct.length || !timingSafeEqual(supplied, correct)) { failedLogins.push(now); return send(res, 401, "访问码不正确。请返回重试。"); }
      failedLogins = [];
      const expires = String(Date.now() + sessionSeconds * 1000);
      const secure = req.socket.encrypted ? "; Secure" : "";
      res.writeHead(303, { Location: "/", "Set-Cookie": `${cookieName}=v1.${expires}.${signature(expires)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionSeconds}${secure}`, "Cache-Control": "no-store" });
      return res.end();
    }
    if (pathname === "/login") return send(res, 200, loginHtml, "text/html; charset=utf-8");
    if (!cookieValid(req)) {
      if (pathname.startsWith("/api/")) return json(res, 401, { error: "请先输入访问码。" });
      res.writeHead(302, { Location: "/login", "Cache-Control": "no-store" }); return res.end();
    }
    if (pathname === "/api/session" && req.method === "GET") {
      await refreshDesktopConfig();
      return json(res, 200, { serverManaged: true, ...(process.env.CARBONIQ_DESKTOP === "1" ? { desktop: true } : {}), model: activeModel()?.model || "" });
    }
    if (pathname === "/api/chat/completions" && req.method === "POST") {
      if (!/application\/json/i.test(req.headers["content-type"] || "")) return json(res, 415, { error: "仅支持 JSON 请求。" });
      let payload;
      try { payload = JSON.parse(await body(req)); } catch { return json(res, 400, { error: "JSON 请求无效。" }); }
      if (!payload || !Array.isArray(payload.messages)) return json(res, 400, { error: "缺少 messages。" });
      await refreshDesktopConfig();
      const selected = activeModel();
      if (!selected) return json(res, 409, { error: "请先在模型设置中连接模型。" });
      payload.model = selected.model; payload.stream = false;
      const upstream = await fetch(chatEndpoint(selected.baseUrl), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${selected.apiKey}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(120_000), redirect: "error" });
      const answer = await upstream.text();
      if (answer.length > 4_000_000) return json(res, 502, { error: "模型响应过大。" });
      return send(res, upstream.status, answer, upstream.headers.get("content-type") || "application/json; charset=utf-8");
    }
    if (pathname.startsWith("/api/")) return json(res, 404, { error: "接口不存在。" });
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "不支持此请求方式。");
    const candidate = path.resolve(dist, `.${pathname}`);
    if (candidate !== dist && !candidate.startsWith(dist + path.sep)) return send(res, 403, "拒绝访问。");
    const file = await stat(candidate).then((entry) => entry.isFile() ? candidate : null).catch(() => null);
    const selected = file || path.join(dist, "index.html");
    const kind = types[path.extname(selected)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": kind, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "Cache-Control": selected.endsWith("index.html") ? "no-store" : "public, max-age=3600" });
    if (req.method === "HEAD") return res.end();
    createReadStream(selected).pipe(res);
  } catch (error) { console.error(error.message); json(res, 500, { error: "本地服务请求失败。" }); }
});
server.listen(port, host, () => console.log(`CarbonIQ 已启动：http://127.0.0.1:${port}/\n${host === "0.0.0.0" ? "局域网模式已开启，请仅在可信网络使用。" : "仅本机可访问。使用 --lan 可开放给同一局域网。"}`));
