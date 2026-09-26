export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (!quoted && cell === "") quoted = true;
      else if (quoted) quoted = false;
      else throw new Error(`CSV 第 ${rows.length + 1} 行的引号格式不正确`);
    } else if (char === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("CSV 引号未闭合");
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const columns = {
  id: ["编号", "材料编号"],
  part: ["构件/用途", "构件用途", "部位", "构件"],
  name: ["材料名称", "材料"],
  unit: ["单位"],
  quantity: ["估算数量", "数量", "工程量"],
  factor: ["碳因子", "单位碳因子", "碳排放因子"],
  source: ["因子来源", "来源", "数据来源"],
  cost: ["成本单价", "单价", "成本（元）", "综合单价", "价格", "成本", "预算单价", "预算价"],
};

function columnMap(headers) {
  const normalized = headers.map((value) => String(value ?? "").replace(/\s/g, ""));
  return Object.fromEntries(Object.entries(columns).map(([key, names]) => [key, normalized.findIndex((item) => names.includes(item))]));
}

function positiveNumber(value, label, rowNumber) {
  const normalized = String(value ?? "").trim().replace(/,/g, "");
  if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`第 ${rowNumber} 行的${label}不是有效正数`);
  const result = Number(normalized);
  if (!Number.isFinite(result) || result <= 0) throw new Error(`第 ${rowNumber} 行的${label}必须大于 0`);
  return result;
}

// 成本是可选字段：缺列或留空记为 ""，只影响成本结论，不阻断排放核算。
function parseOptionalCost(value) {
  const text = String(value ?? "").trim().replace(/,/g, "").replace(/[¥￥元]/g, "");
  if (!text) return "";
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : "";
}

export function parseMaterialRows(rows) {
  const headerIndex = rows.findIndex((row) => {
    const found = columnMap(row);
    return found.name >= 0 && found.quantity >= 0;
  });
  if (headerIndex < 0) throw new Error("找不到材料名称和数量列");
  const index = columnMap(rows[headerIndex]);
  for (const key of ["name", "unit", "quantity", "factor"]) {
    if (index[key] < 0) throw new Error(`缺少${columns[key][0]}列；系统不会自动猜测碳因子`);
  }
  const parsed = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (row.every((cell) => String(cell ?? "").trim() === "")) return;
    const name = String(row[index.name] ?? "").trim();
    if (/^(合计|总计|小计)$/.test(name)) return;
    // 说明行（如模板里的填写指引）不是材料，跳过且不报错。
    if (/^说明[：:]/.test(name)) return;
    const rowNumber = headerIndex + offset + 2;
    if (!name) throw new Error(`第 ${rowNumber} 行缺少材料名称`);
    const unit = String(row[index.unit] ?? "").trim();
    if (!unit) throw new Error(`第 ${rowNumber} 行缺少单位`);
    parsed.push({
      id: `IMP-${offset + 1}`,
      sourceRow: rowNumber,
      part: index.part >= 0 ? String(row[index.part] ?? "").trim() : "未分类",
      name,
      unit,
      quantity: positiveNumber(row[index.quantity], "数量", rowNumber),
      factor: positiveNumber(row[index.factor], "碳因子", rowNumber),
      source: index.source >= 0 ? String(row[index.source] ?? "").trim() || "未提供来源" : "未提供来源",
      cost: index.cost >= 0 ? parseOptionalCost(row[index.cost]) : "",
    });
  });
  if (!parsed.length) throw new Error("清单中没有可核算的材料行");
  return parsed;
}

export function quoteCsv(value) {
  const text = String(value ?? "");
  const safe = /^[=+@\-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function computeMaterialScenario(rows, candidates, selectedCandidates) {
  const baseline = rows.reduce((sum, row) => sum + row.quantity * row.factor, 0);
  const reduction = rows.reduce((sum, row) => {
    const candidate = candidates.find((item) => item.id === selectedCandidates[row.id] && item.materialId === row.id);
    return sum + (candidate ? row.quantity * (row.factor - candidate.factor) : 0);
  }, 0);
  // 成本变化：已选候选中任一行缺成本单价时为 null，避免给出看似完整的成本结论。
  const knownCost = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0;
  let costKnown = true;
  const costDelta = rows.reduce((sum, row) => {
    const candidate = candidates.find((item) => item.id === selectedCandidates[row.id] && item.materialId === row.id);
    if (!candidate) return sum;
    if (!knownCost(row.cost) || !knownCost(candidate.cost)) { costKnown = false; return sum; }
    return sum + row.quantity * (Number(candidate.cost) - Number(row.cost));
  }, 0);
  return { reduction, total: baseline - reduction, rate: baseline ? reduction / baseline : 0, costDelta: costKnown ? costDelta : null };
}
