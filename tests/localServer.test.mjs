import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  server.close();
  await once(server, "close");
  return port;
}

test("local site gates pages and proxy; cookie survives restart without exposing the key", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "carboniq-local-"));
  const configPath = path.join(folder, "config.json");
  const port = await freePort();
  const upstream = createServer(async (req, res) => {
    assert.equal(req.headers.authorization, "Bearer test-secret-key");
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(request.model, "test-model");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const upstreamPort = upstream.address().port;
  await writeFile(configPath, JSON.stringify({ baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, model: "test-model", apiKey: "test-secret-key", accessCode: "long-test-access-code", cookieSecret: "test-cookie-secret" }));
  let child;
  const launch = async () => {
    child = spawn(process.execPath, ["server/local.mjs"], { cwd: path.resolve("."), env: { ...process.env, CARBONIQ_CONFIG_PATH: configPath, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
    const endpoint = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 50; i += 1) {
      try { await fetch(`${endpoint}/api/session`); return endpoint; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
    }
    throw new Error("local server failed to start");
  };
  try {
    const endpoint = await launch();
    assert.equal((await fetch(`${endpoint}/api/session`)).status, 401);
    assert.equal((await fetch(`${endpoint}/`, { redirect: "manual" })).headers.get("location"), "/login");
    const login = await fetch(`${endpoint}/login`, { method: "POST", body: new URLSearchParams({ code: "long-test-access-code" }), redirect: "manual" });
    assert.equal(login.status, 303);
    const cookie = login.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly; SameSite=Strict/);
    assert.doesNotMatch(cookie, /test-secret-key/);
    const session = await fetch(`${endpoint}/api/session`, { headers: { Cookie: cookie } });
    assert.deepEqual(await session.json(), { serverManaged: true, model: "test-model" });
    const model = await fetch(`${endpoint}/api/chat/completions`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ model: "attacker-model", messages: [{ role: "user", content: "hello" }] }) });
    assert.equal((await model.json()).choices[0].message.content, "ok");
    child.kill(); await once(child, "exit");
    await launch();
    assert.equal((await fetch(`${endpoint}/api/session`, { headers: { Cookie: cookie } })).status, 200);
  } finally {
    child?.kill();
    upstream.close();
    await rm(folder, { recursive: true, force: true });
  }
});

test("desktop starts without a model and loads the selected saved profile", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "carboniq-desktop-"));
  const configPath = path.join(folder, "config.json");
  const port = await freePort();
  const endpoint = `http://127.0.0.1:${port}`;
  const base = { profiles: [], activeProfileId: null, accessCode: "desktop-test-code", cookieSecret: "desktop-test-secret" };
  let expectedModel = "second-model";
  const upstream = createServer((req, res) => {
    assert.equal(req.headers.authorization, `Bearer ${expectedModel === "second-model" ? "second-key" : "first-key"}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: expectedModel } }] }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  let child;
  const launch = async () => {
    child = spawn(process.execPath, ["server/local.mjs"], { cwd: path.resolve("."), env: { ...process.env, CARBONIQ_DESKTOP: "1", CARBONIQ_CONFIG_PATH: configPath, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
    for (let i = 0; i < 50; i += 1) {
      try { await fetch(`${endpoint}/login`); return; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
    }
    throw new Error("desktop server failed to start");
  };
  try {
    await writeFile(configPath, JSON.stringify(base));
    await launch();
    const login = await fetch(`${endpoint}/login`, { method: "POST", body: new URLSearchParams({ code: base.accessCode }), redirect: "manual" });
    const cookie = login.headers.get("set-cookie");
    assert.deepEqual(await (await fetch(`${endpoint}/api/session`, { headers: { Cookie: cookie } })).json(), { serverManaged: true, desktop: true, model: "" });
    const missing = await fetch(`${endpoint}/api/chat/completions`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ messages: [] }) });
    assert.equal(missing.status, 409);
    child.kill(); await once(child, "exit");
    base.profiles = [
      { id: "one", baseUrl: `http://127.0.0.1:${upstream.address().port}/v1`, model: "first-model", apiKey: "first-key" },
      { id: "two", baseUrl: `http://127.0.0.1:${upstream.address().port}/v1`, model: "second-model", apiKey: "second-key" },
    ];
    base.activeProfileId = "two";
    await writeFile(configPath, JSON.stringify(base));
    await launch();
    assert.deepEqual(await (await fetch(`${endpoint}/api/session`, { headers: { Cookie: cookie } })).json(), { serverManaged: true, desktop: true, model: "second-model" });
    const answer = await fetch(`${endpoint}/api/chat/completions`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) });
    assert.equal((await answer.json()).choices[0].message.content, "second-model");
    expectedModel = "first-model";
    base.activeProfileId = "one";
    await writeFile(configPath, JSON.stringify(base));
    assert.deepEqual(await (await fetch(`${endpoint}/api/session`, { headers: { Cookie: cookie } })).json(), { serverManaged: true, desktop: true, model: "first-model" });
    const switched = await fetch(`${endpoint}/api/chat/completions`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "hi again" }] }) });
    assert.equal((await switched.json()).choices[0].message.content, "first-model");
  } finally {
    child?.kill(); upstream.close(); await rm(folder, { recursive: true, force: true });
  }
});
