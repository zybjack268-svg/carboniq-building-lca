// A1–A3 材料清单的本地分析函数。全部为确定性计算，只依赖传入的行数据。

const finite = (value) => Number.isFinite(Number(value));

function validRows(rows) {
  return rows.filter((row) => finite(row.emission) && Number(row.emission) >= 0);
}

// 按构件/用途分组汇总，返回降序列表和占比（0~1）。
export function groupByPart(rows) {
  const valid = validRows(rows);
  const total = valid.reduce((sum, row) => sum + Number(row.emission), 0);
  const grouped = new Map();
  for (const row of valid) {
    const part = String(row.part ?? "").trim() || "未分类";
    grouped.set(part, (grouped.get(part) || 0) + Number(row.emission));
  }
  return [...grouped.entries()]
    .map(([part, emission]) => ({ part, emission, share: total ? emission / total : 0 }))
    .sort((a, b) => b.emission - a.emission);
}

// 帕累托排序：按排放降序返回累计占比；超过 limit 的合并为“其他材料”。
export function pareto(rows, limit = 8) {
  const valid = validRows(rows).sort((a, b) => Number(b.emission) - Number(a.emission));
  const total = valid.reduce((sum, row) => sum + Number(row.emission), 0);
  const head = valid.slice(0, limit);
  const result = [];
  let cumulative = 0;
  for (const row of head) {
    cumulative += Number(row.emission);
    result.push({ id: row.id, name: row.name, emission: Number(row.emission), cumulativeShare: total ? cumulative / total : 0 });
  }
  const rest = valid.slice(limit);
  if (rest.length) {
    cumulative += rest.reduce((sum, row) => sum + Number(row.emission), 0);
    result.push({ id: "other", name: `其他材料（${rest.length} 项）`, emission: rest.reduce((sum, row) => sum + Number(row.emission), 0), cumulativeShare: total ? cumulative / total : 0 });
  }
  return result;
}

// 灵敏度：假设单项数量或因子存在 ±step 偏差（线性模型下两者对总量的影响相同），
// 返回各项对 A1–A3 总量造成的对称摆动幅度，按影响降序。
export function sensitivity(rows, step = 0.1) {
  const valid = validRows(rows).sort((a, b) => Number(b.emission) - Number(a.emission));
  const total = valid.reduce((sum, row) => sum + Number(row.emission), 0);
  const swings = valid.map((row) => ({
    id: row.id,
    name: row.name,
    emission: Number(row.emission),
    swing: Number(row.emission) * step,
    swingShare: total ? Number(row.emission) * step / total : 0,
  }));
  return { total, swings, step };
}
