import test from "node:test";
import assert from "node:assert/strict";
import { parseMappedPhaseRows, parsePhaseRows, readPhaseFile } from "../src/phaseImport.js";
import { calculateTransport, calculateSite, calculateOperation } from "../src/lifecycle.js";

test("A4 standalone sheet maps its own columns and keeps incomplete routes out of totals", () => {
  const { rows } = parsePhaseRows([{ sheet: "A4运输", data: [
    ["材料名称", "起点", "终点", "运输质量t", "运输距离km", "运输因子", "来源"],
    ["混凝土", "厂", "工地", 10, 20, 0.1, "运输记录"],
    ["钢材", "厂", "工地", 5, "", 0.1, "运输记录"],
  ] }], "a4");
  assert.equal(rows.length, 2);
  assert.equal(calculateTransport(rows).kg, 20);
  assert.equal(calculateTransport(rows).incomplete, 1);
});

test("A5 standalone sheet and B6 annual sheet remain independent", () => {
  const a5 = parsePhaseRows([{ sheet: "A5施工", data: [
    ["设备或活动", "能源", "用量", "单位", "排放因子", "因子单位", "来源"],
    ["塔吊", "电力", 100, "kWh", 0.5, "kgCO2e/kWh", "抄表"],
  ] }], "a5").rows;
  assert.equal(calculateSite(a5).kg, 50);
  const b6 = parsePhaseRows([{ sheet: "B6运营", data: [
    ["年用电kWh", "电力因子kgCO2e每kWh"], [1000, 0.5],
  ] }], "b6").rows[0];
  assert.equal(calculateOperation(b6).annualKg, 500);
  const gasOnly = parsePhaseRows([{ sheet: "燃气", data: [
    ["年燃气m3", "燃气因子kgCO2e每m3"], [200, 2],
  ] }], "b6").rows[0];
  assert.equal(calculateOperation(gasOnly).annualKg, 400);
});

test("phase import rejects unrelated headers instead of inventing values", () => {
  assert.throws(() => parsePhaseRows([{ sheet: "notes", data: [["备注"], ["请帮我填因子"]] }], "a4"), /未找到/);
});

test("model mapping only copies existing source cells", () => {
  const sheets = [{ sheet: "路线", data: [["物料", "吨", "公里", "系数"], ["钢材", 2, 50, 0.2]] }];
  const mapped = parseMappedPhaseRows(sheets, "a4", { sheetIndex: 0, headerRow: 0, columns: { material: 0, mass: 1, distance: 2, factor: 3 } });
  assert.equal(mapped.rows[0].mass, "2");
  assert.equal(mapped.rows[0].source, "");
  assert.equal(calculateTransport(mapped.rows).hasData, false);
  assert.throws(() => parseMappedPhaseRows(sheets, "a4", { sheetIndex: 0, headerRow: 0, columns: { material: 0, mass: 1, distance: 1, factor: 3 } }), /无效/);
});

test("unknown headers stay local unless model recognition is explicitly selected", async () => {
  const file = { name: "routes.csv", size: 40, text: async () => "物料,吨,公里,系数\n钢材,2,50,0.2" };
  const config = { baseUrl: "http://127.0.0.1:9999/v1", apiKey: "test-only", model: "test" };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ sheetIndex: 0, headerRow: 0, columns: { material: 0, mass: 1, distance: 2, factor: 3 } }) } }] }) };
  };
  try {
    await assert.rejects(readPhaseFile(file, "a4", config, false), /未找到/);
    assert.equal(calls, 0);
    const mapped = await readPhaseFile(file, "a4", config, true);
    assert.equal(calls, 1);
    assert.equal(mapped.recognizedByModel, true);
    assert.equal(mapped.rows[0].mass, "2");
  } finally { globalThis.fetch = originalFetch; }
});
