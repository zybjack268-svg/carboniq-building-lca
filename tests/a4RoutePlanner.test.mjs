import test from "node:test";
import assert from "node:assert/strict";
import { requestA4RoutePlan, validateA4RoutePlan } from "../src/a4RoutePlanner.js";

const rows = [
  { id: "A4-1", material: "钢筋", origin: "钢厂", destination: "中转仓", mass: 40, kg: 100 },
  { id: "A4-2", material: "钢筋", origin: "中转仓", destination: "工地", mass: 40, kg: 20 },
  { id: "A4-3", material: "混凝土", origin: "搅拌站", destination: "工地", mass: 120, kg: 50 },
];

test("A4 model plan can only group and order existing continuous routes", () => {
  assert.deepEqual(validateA4RoutePlan({ chains: [["A4-1", "A4-2"], ["A4-3"]], highlightRouteId: "A4-1" }, rows),
    { chains: [["A4-1", "A4-2"], ["A4-3"]], highlightRouteId: "A4-1" });
});

test("A4 model plan rejects invented, duplicate or omitted routes", () => {
  assert.throws(() => validateA4RoutePlan({ chains: [["A4-1", "A4-X"], ["A4-2"], ["A4-3"]], highlightRouteId: "A4-1" }, rows), /不存在或重复/);
  assert.throws(() => validateA4RoutePlan({ chains: [["A4-1"], ["A4-1"], ["A4-3"]], highlightRouteId: "A4-1" }, rows), /不存在或重复/);
  assert.throws(() => validateA4RoutePlan({ chains: [["A4-1"], ["A4-2"]], highlightRouteId: "A4-1" }, rows), /遗漏/);
});

test("A4 model plan rejects false continuity or nonexistent focus", () => {
  assert.throws(() => validateA4RoutePlan({ chains: [["A4-1", "A4-3"], ["A4-2"]], highlightRouteId: "A4-1" }, rows), /不连续/);
  assert.throws(() => validateA4RoutePlan({ chains: [["A4-1", "A4-2"], ["A4-3"]], highlightRouteId: "A4-1" }, [rows[0], { ...rows[1], mass: 20 }, rows[2]]), /不连续/);
  assert.throws(() => validateA4RoutePlan({ chains: [["A4-1", "A4-2"], ["A4-3"]], highlightRouteId: "A4-X" }, rows), /不存在/);
});

test("A4 planner accepts a checked model response without letting the model supply geometry or totals", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
      chains: [["A4-1", "A4-2"], ["A4-3"]], highlightRouteId: "A4-1",
      inventedDistance: 9999,
    }) } }] }) };
  };
  try {
    const plan = await requestA4RoutePlan({ config: { baseUrl: "http://127.0.0.1:9999/v1", model: "test", apiKey: "test" }, rows });
    assert.deepEqual(plan, { chains: [["A4-1", "A4-2"], ["A4-3"]], highlightRouteId: "A4-1" });
    assert.equal(requestBody.messages[1].content.includes("钢厂"), true);
    assert.equal(requestBody.messages[1].content.includes("inventedDistance"), false);
  } finally { globalThis.fetch = originalFetch; }
});
