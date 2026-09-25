import test from "node:test";
import assert from "node:assert/strict";
import { visibleModelText, emptyModelResponseMessage } from "../src/modelResponse.js";
import { requestAdvisor } from "../src/advisorEngine.js";

test("reads visible text from compatible chat and text-part responses", () => {
  assert.equal(visibleModelText({ choices: [{ message: { content: "回答" } }] }), "回答");
  assert.equal(visibleModelText({ choices: [{ message: { content: [{ type: "output_text", text: "分析" }] } }] }), "分析");
  assert.equal(visibleModelText({ output_text: "结果" }), "结果");
  assert.match(emptyModelResponseMessage({ choices: [{ finish_reason: "length" }] }), /输出额度/);
});

test("connection check retries once when a reasoning model uses its output budget", async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => bodies.length === 1
        ? { choices: [{ finish_reason: "length", message: { content: "" } }] }
        : { choices: [{ finish_reason: "stop", message: { content: "连接成功" } }] },
    };
  };
  try {
    const answer = await requestAdvisor({ config: { baseUrl: "https://example.com/v1", apiKey: "test-key", model: "test-model" }, test: true });
    assert.equal(answer, "连接成功");
    assert.deepEqual(bodies.map((body) => body.max_tokens), [512, 1024]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
