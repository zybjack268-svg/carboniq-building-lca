import { computeMaterialScenario } from "./dataUtils.js";
import { calculateOperation, calculateSite, calculateTransport } from "./lifecycle.js";

export const LCA_AUDIT_SKILL = Object.freeze({
  id: "building-lca-data-audit",
  purpose: "核查材料清单证据，调用确定性核算工具，并指出需要用户补正的项目数据。",
  tools: ["audit_materials", "calculate_lca"],
  rules: [
    "每条问题必须指向原文件、工作表或材料行；找不到时至少给出材料编号。",
    "因子来源缺失、重复材料和单位适用性未核实只能标为待核查，不能自行补数或删行。",
    "排放值只使用程序工具计算；模型不得改写工具输出。",
    "A1-A3、A4、A5 与年度 B6 分开呈现，未录入的阶段不视为零。",
  ],
});

const clean = (value) => String(value ?? "").trim();
const location = (row, fileName) => [clean(row.sourceFile || fileName), clean(row.sourceSheet), row.sourceRow ? `第 ${row.sourceRow} 行` : clean(row.id)].filter(Boolean).join(" / ");
const sourceMissing = (value) => !clean(value) || /^(未提供|待核实|未知|暂无|无)(来源)?$/u.test(clean(value));

export function auditMaterials({ rows, fileName = "" }) {
  const issues = [];
  const seen = new Map();
  for (const row of rows) {
    const ref = location(row, fileName);
    const key = [row.name, row.unit, row.part].map((value) => clean(value).toLowerCase().replace(/\s+/g, "")).join("|");
    if (!clean(row.name) || !clean(row.unit) || !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0 || !Number.isFinite(Number(row.factor)) || Number(row.factor) <= 0) {
      issues.push({ code: "invalid_material", severity: "blocker", rowId: row.id, location: ref, message: "材料名称、单位、正数工程量或正数碳因子不完整。", action: "核对原始清单并重新导入。" });
    }
    if (sourceMissing(row.source)) {
      issues.push({ code: "missing_factor_source", severity: "review", rowId: row.id, location: ref, message: `${clean(row.name) || "该材料"}当前未关联可追溯的碳因子来源。`, action: "检查原文件其他工作表或补充因子出处、版本及适用边界。" });
    }
    if (seen.has(key) && clean(row.name)) {
      issues.push({ code: "possible_duplicate", severity: "review", rowId: row.id, location: ref, message: `${clean(row.name)}与${seen.get(key)}的材料名称、用途和单位相同，可能重复计量。`, action: "核对是否为不同构件或批次；不要直接删除。" });
    } else if (key) seen.set(key, ref);
  }
  return {
    materialCount: rows.length,
    issues,
    blockingCount: issues.filter((issue) => issue.severity === "blocker").length,
    reviewCount: issues.filter((issue) => issue.severity === "review").length,
    limitations: ["材料清单未独立证明因子分母单位、产品规格及 A1-A3 边界一致；这些仍需人工核对。"],
  };
}

export function calculateLca({ rows, candidates = [], selectedCandidates = {}, routes = [], siteRows = [], climate = {}, area }) {
  const materials = computeMaterialScenario(rows, candidates, selectedCandidates);
  const transport = calculateTransport(routes);
  const site = calculateSite(siteRows);
  const operation = calculateOperation(climate);
  return {
    a1a3Kg: materials.total + materials.reduction,
    a1a3IntensityKgPerM2: Number(area) > 0 ? (materials.total + materials.reduction) / Number(area) : null,
    selectedScenario: materials,
    a4: { partialKg: transport.hasData ? transport.kg : null, incomplete: transport.incomplete },
    a5: { partialKg: site.hasData ? site.kg : null, incomplete: site.incomplete },
    b6: { annualPartialKg: operation.annualKg, gasIncomplete: operation.gasIncomplete },
  };
}

export function runLcaAuditSkill(input) {
  const audit = auditMaterials(input);
  const calculations = audit.blockingCount ? null : calculateLca(input);
  return {
    skill: LCA_AUDIT_SKILL.id,
    audit,
    calculations,
    nextAction: audit.blockingCount ? "correct_input" : audit.reviewCount ? "review_evidence" : "explain_results",
    trace: [
      { tool: "audit_materials", status: "completed", issueCount: audit.issues.length },
      { tool: "calculate_lca", status: calculations ? "completed" : "skipped_invalid_input" },
    ],
  };
}
