import test from "node:test";
import assert from "node:assert/strict";
import { hasModelConfig, modelRequestHeaders, resolveChatEndpoint } from "../src/advisorEngine.js";

test("server-managed model uses the local proxy without exposing a key", () => {
  const config = { baseUrl: "/api", model: "test-model", apiKey: "", serverManaged: true };
  assert.equal(hasModelConfig(config), true);
  assert.equal(resolveChatEndpoint(config.baseUrl), "/api/chat/completions");
  assert.deepEqual(modelRequestHeaders(config), { "Content-Type": "application/json" });
});
