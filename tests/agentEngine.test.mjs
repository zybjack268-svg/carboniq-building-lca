import test from "node:test";
import assert from "node:assert/strict";
import { buildAgentEvidence, parseAgentResponse, runProjectAgent } from "../src/agentEngine.js";

test("agent evidence only estimates savings from supplied candidates", () => {
  const rows = [
    { id: "M1", name: "混凝土", part: "主体", quantity: 10, factor: 300, unit: "m3", source: "" },
    { id: "M2", name: "钢材", part: "主体", quantity: 2, factor: 2000, unit: "t", source: "用户提供" },
  ].map((row) => ({ ...row, emission: row.quantity * row.factor }));
  const evidence = buildAgentEvidence({
    stats: { rows, total: 7000, intensity: 70 },
    optimized: { reduction: 0 },
    candidates: [
      { id: "C1", materialId: "M1", name: "候选 A", factor: 260, source: "EPD A", specification: "C30" },
      { id: "C2", materialId: "M1", name: "候选 B", factor: 240, source: "EPD B", specification: "C30" },
      { id: "C3", materialId: "M2", name: "无来源候选", factor: 1000, source: "", specification: "同规格" },
    ],
    selectedCandidates: {},
    transportResult: { hasData: false },
    operationResult: { annualKg: null },
    isReference: false,
    auditRun: { nextAction: "review_evidence", audit: { issues: [{ code: "missing_factor_source", location: "材料表 / 第 3 行", message: "缺少来源", action: "补充出处" }] }, trace: [{ tool: "audit_materials", status: "completed" }], calculations: { a1a3Kg: 7000 } },
  });
  assert.equal(evidence.total_kg, 7000);
  assert.equal(evidence.draft_optimization.candidates.length, 1);
  assert.equal(evidence.draft_optimization.candidates[0].candidate_id, "C2");
  assert.equal(evidence.draft_optimization.estimated_reduction_kg, 600);
  assert.equal(evidence.scenario.selected_count, 0);
  assert.equal(evidence.data_audit.issues[0].code, "missing_factor_source");
  assert.match(evidence.quality_flags[0], /缺少碳因子来源/);
});

test("ordinary chat text still produces a usable analysis instead of a parse failure", () => {
  const evidence = {
    hotspots: [{ name: "C30 混凝土", share_percent: 48, emission_kg: 960 }],
    quality_flags: ["钢材：缺少碳因子来源"],
  };
  const result = parseAgentResponse("建议先核对混凝土用量，再收集可比产品的 EPD。", evidence);
  assert.equal(result.mode, "text");
  assert.match(result.summary, /核对混凝土用量/);
  assert.equal(result.findings[0].title, "当前材料排放热点");
  assert.equal(result.actions.length, 2);
});

test("structured response inside a code fence retains model findings", () => {
  const body = { summary: "已分析", findings: [{ title: "热点", detail: "占比较高", level: "high" }], actions: [{ title: "核对", reason: "数据不足", target: "calculator" }] };
  const result = parseAgentResponse(`\`\`\`json\n${JSON.stringify(body)}\n\`\`\``, {});
  assert.equal(result.mode, "structured");
  assert.equal(result.findings[0].title, "热点");
  assert.equal(result.actions[0].target, "calculator");
});

test("project analysis accepts a normal Chinese answer", async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: "结论：先核对材料热点，再收集候选产品 EPD。" } }] }) };
  };
  try {
    const result = await runProjectAgent({
      config: { baseUrl: "https://example.com/v1", apiKey: "test-key", model: "test-model" },
      evidence: { hotspots: [], quality_flags: [] },
    });
    assert.equal(result.mode, "text");
    assert.match(result.summary, /材料热点/);
    assert.match(bodies[0].messages[0].content, /不要使用 JSON/);
    assert.equal(bodies.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("incomplete JSON is retried as ordinary text", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: calls === 1 ? '{"summary":"未结束' : "建议优先核对混凝土工程量。" } }] }) };
  };
  try {
    const result = await runProjectAgent({
      config: { baseUrl: "https://example.com/v1", apiKey: "test-key", model: "test-model" },
      evidence: { hotspots: [], quality_flags: [] },
    });
    assert.equal(calls, 2);
    assert.equal(result.mode, "text");
    assert.match(result.summary, /混凝土工程量/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("empty length response retries with concise evidence and larger output budget", async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ choices: [{
      finish_reason: bodies.length === 1 ? "length" : "stop",
      message: { content: bodies.length === 1 ? "" : "结论：先核对材料因子来源。" },
    }] }) };
  };
  try {
    const result = await runProjectAgent({
      config: { baseUrl: "https://example.com/v1", apiKey: "test-key", model: "test-model" },
      evidence: { total_kg: 1000, hotspots: [{ name: "混凝土" }], quality_flags: ["来源待核对"], draft_optimization: { candidates: Array(50).fill({}) } },
    });
    assert.equal(result.mode, "text");
    assert.equal(bodies.length, 2);
    assert.equal(bodies[1].max_tokens, 8192);
    assert.ok(bodies[1].messages[1].content.length < bodies[0].messages[1].content.length);
    assert.doesNotMatch(bodies[1].messages[1].content, /draft_optimization/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
