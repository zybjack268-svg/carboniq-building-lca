import test from "node:test";
import assert from "node:assert/strict";
import { auditMaterials, runLcaAuditSkill } from "../src/lcaAuditSkill.js";

test("audit flags missing factor provenance and points to the source row", () => {
  const rows = [
    { id: "M1", name: "混凝土", part: "主体", unit: "m³", quantity: 10, factor: 300, source: "未提供来源", sourceFile: "工程量.xlsx", sourceSheet: "材料", sourceRow: 7 },
    { id: "M2", name: "混凝土", part: "主体", unit: "m³", quantity: 5, factor: 300, source: "EPD A", sourceFile: "工程量.xlsx", sourceSheet: "材料", sourceRow: 8 },
  ];
  const audit = auditMaterials({ rows });
  assert.equal(audit.reviewCount, 2);
  assert.equal(audit.issues[0].code, "missing_factor_source");
  assert.match(audit.issues[0].location, /工程量\.xlsx \/ 材料 \/ 第 7 行/);
  assert.equal(audit.issues[1].code, "possible_duplicate");
});

test("skill invokes audit and deterministic calculation while keeping life-cycle stages separate", () => {
  const run = runLcaAuditSkill({
    rows: [{ id: "M1", name: "钢材", part: "主体", unit: "t", quantity: 2, factor: 1000, source: "EPD A" }],
    area: 100,
    routes: [{ material: "钢材", origin: "工厂", destination: "现场", source: "运单", mass: 2, distance: 50, factor: 0.1 }],
    siteRows: [],
    climate: { annualElectricity: 100, electricityFactor: 0.5, annualGas: "", gasFactor: "", years: 1 },
  });
  assert.deepEqual(run.trace.map((item) => item.status), ["completed", "completed"]);
  assert.equal(run.calculations.a1a3Kg, 2000);
  assert.equal(run.calculations.a4.partialKg, 10);
  assert.equal(run.calculations.a5.partialKg, null);
  assert.equal(run.calculations.b6.annualPartialKg, 50);
  assert.equal(run.nextAction, "explain_results");
});

test("invalid input blocks calculation instead of being silently repaired", () => {
  const run = runLcaAuditSkill({ rows: [{ id: "M1", name: "钢材", unit: "t", quantity: 0, factor: 1000, source: "EPD A" }], area: 100 });
  assert.equal(run.nextAction, "correct_input");
  assert.equal(run.calculations, null);
  assert.equal(run.trace[1].status, "skipped_invalid_input");
});
