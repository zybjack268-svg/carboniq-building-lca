import { parseMaterialRows } from "./dataUtils.js";

const clean = (value) => String(value ?? "").trim();
const headerKey = (value) => clean(value).replace(/\s/g, "").toLowerCase();
const positive = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label}必须是大于 0 的数字`);
  return number;
};

function records(data) {
  const [headers = [], ...body] = data;
  const names = headers.map(headerKey);
  return body.filter((row) => row.some((cell) => clean(cell))).map((row) => ({
    get: (...aliases) => {
      const index = names.findIndex((name) => aliases.some((alias) => name === headerKey(alias)));
      return index < 0 ? "" : row[index];
    },
  }));
}

function findSheet(sheets, ...names) {
  return sheets.find((sheet) => names.includes(clean(sheet.sheet)));
}

export function parseProjectWorkbook(sheets) {
  const materialSheet = findSheet(sheets, "材料清单", "材料", "Materials") || sheets.find((sheet) => sheet.data?.some((row) => row.some((cell) => headerKey(cell) === "材料名称")));
  if (!materialSheet) throw new Error("工作簿缺少“材料清单”表");
  const materials = parseMaterialRows(materialSheet.data).map((row) => ({ ...row, sourceSheet: materialSheet.sheet }));
  const params = records(findSheet(sheets, "项目参数", "项目几何")?.data || [])[0];
  let project = null;
  if (params) {
    const area = positive(params.get("建筑面积m2", "建筑面积㎡", "建筑面积"), "建筑面积");
    const floors = Math.round(positive(params.get("楼层数", "楼层"), "楼层数"));
    const geometryFields = [params.get("楼长m", "建筑长度m", "楼长"), params.get("楼宽m", "建筑宽度m", "楼宽"), params.get("层高m", "层高")];
    const hasGeometry = geometryFields.some((value) => clean(value));
    if (hasGeometry && geometryFields.some((value) => !clean(value))) throw new Error("楼长、楼宽和层高需要一起填写；也可全部留空，让系统按面积生成示意体量");
    const [length, width, floorHeight] = hasGeometry ? [positive(geometryFields[0], "楼长"), positive(geometryFields[1], "楼宽"), positive(geometryFields[2], "层高")] : [null, null, null];
    if (floors > 30 || (hasGeometry && (length > 200 || width > 200 || floorHeight > 8))) throw new Error("项目几何超出演示范围，请核对楼层、长宽与层高");
    const layout = clean(params.get("楼型", "布局"));
    project = {
      name: clean(params.get("项目名称")) || "导入项目", area, floors,
      buildingType: clean(params.get("建筑类型", "建筑用途", "项目类型")),
      structure: clean(params.get("结构")) || "结构未提供",
      geometry: hasGeometry ? { length, width, floorHeight, layout: /双翼/.test(layout) ? "double" : /塔楼/.test(layout) ? "tower" : "linear", source: "uploaded" } : null,
    };
  }
  const routes = records(findSheet(sheets, "A4运输")?.data || []).map((record, index) => ({
    id: `A4-${index + 1}`,
    material: clean(record.get("材料名称")), origin: clean(record.get("起点")), destination: clean(record.get("终点")),
    mode: clean(record.get("运输方式")), mass: record.get("运输质量t", "运输质量"),
    distance: record.get("运输距离km", "运输距离"), factor: record.get("运输因子kgCO2e每t公里", "运输因子"),
    source: clean(record.get("运输记录来源", "来源")),
    loadRate: record.get("载重率"), returnTrip: clean(record.get("返程处理")),
  }));
  const site = records(findSheet(sheets, "A5施工")?.data || []).map((record, index) => ({
    id: `A5-${index + 1}`,
    activity: clean(record.get("设备或活动", "设备/活动")), energy: clean(record.get("能源")),
    quantity: record.get("用量"), unit: clean(record.get("单位")),
    factor: record.get("排放因子"), factorUnit: clean(record.get("因子单位")), source: clean(record.get("来源")),
  }));
  const energy = records(findSheet(sheets, "B6运营")?.data || [])[0];
  const climate = energy ? {
    city: clean(energy.get("城市")), zone: clean(energy.get("气候分区")),
    annualElectricity: energy.get("年用电kWh"), electricityFactor: energy.get("电力因子kgCO2e每kWh"),
    annualGas: energy.get("年用气m3"), gasFactor: energy.get("燃气因子kgCO2e每m3"), years: energy.get("核算年限", "年限"),
  } : null;
  const baseline = records(findSheet(sheets, "可比基准")?.data || [])[0];
  const benchmark = baseline ? {
    intensity: baseline.get("强度kgCO2e每m2"), source: clean(baseline.get("来源")),
    confirmed: ["是", "true", "1"].includes(headerKey(baseline.get("已核实"))),
    boundary: clean(baseline.get("边界")), buildingType: clean(baseline.get("建筑类型")),
  } : null;
  const candidates = records(findSheet(sheets, "候选产品")?.data || []).map((record, index) => {
    const original = clean(record.get("原材料名称"));
    const material = materials.find((item) => item.name === original);
    if (!material) throw new Error(`候选产品第 ${index + 2} 行的原材料“${original}”不在材料清单中`);
    return {
      id: `IMP-C-${index + 1}`, materialId: material.id,
      name: clean(record.get("候选产品名称")), factor: positive(record.get("候选因子"), "候选因子"),
      specification: clean(record.get("规格")), source: clean(record.get("因子来源", "来源")),
      price: record.get("参考价格元每单位"), supply: clean(record.get("供应信息")),
      safety: clean(record.get("结构安全校验")),
    };
  });
  return { materials, project, routes, site, climate, benchmark, candidates };
}
