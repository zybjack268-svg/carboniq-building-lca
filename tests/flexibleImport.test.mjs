import test from "node:test";
import assert from "node:assert/strict";
import { parseMappedMaterials, recognizeMaterialColumns } from "../src/flexibleImport.js";

const sheets = [{ sheet: "任意清单", data: [
  ["说明：仅供测试"],
  ["名称", "用量", "计量单位", "生产因子", "依据"],
  ["混凝土", "2", "m³", "300", "EPD-A"],
  ["待补充材料", 0, "t", 0, ""],
  ["合计", "", "", "", ""],
] }];
const mapping = { sheetIndex: 0, headerRow: 1, columns: { name: 0, quantity: 1, unit: 2, factor: 3, source: 4 } };

test("mapped import uses source cells and exposes skipped rows", () => {
  const result = parseMappedMaterials(sheets, mapping);
  assert.equal(result.materials.length, 1);
  assert.equal(result.materials[0].quantity * result.materials[0].factor, 600);
  assert.equal(result.materials[0].source, "EPD-A");
  assert.equal(result.issues.length, 1);
});

test("invalid or missing model column mapping cannot become a calculation", () => {
  assert.throws(() => parseMappedMaterials(sheets, { ...mapping, columns: { ...mapping.columns, factor: null } }), /列无效/);
  assert.throws(() => parseMappedMaterials(sheets, { ...mapping, columns: { ...mapping.columns, factor: 1 } }), /列无效/);
});

test("model identifies columns but cannot create material values", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.match(body.messages[1].content, /任意清单/);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(mapping) } }] }) };
  };
  try {
    const result = await recognizeMaterialColumns(sheets, { baseUrl: "https://example.com/v1", apiKey: "test", model: "test" });
    assert.equal(result.materials[0].name, "混凝土");
    assert.equal(result.materials[0].factor, 300);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
