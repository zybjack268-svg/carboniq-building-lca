export const BUILDING_TYPES = [
  { id: "education", label: "教学建筑", pattern: /教学|学校|学院|教室|实验楼|培训|校园/ },
  { id: "healthcare", label: "医疗建筑", pattern: /医院|医疗|门诊|诊所|病房|卫生院/ },
  { id: "office", label: "办公建筑", pattern: /办公|写字楼|行政楼|科研楼/ },
  { id: "residential", label: "居住建筑", pattern: /住宅|公寓|宿舍|居住|居民楼/ },
  { id: "industrial", label: "工业厂房", pattern: /厂房|工厂|车间|生产线|工业/ },
  { id: "warehouse", label: "仓储建筑", pattern: /仓库|仓储|物流|配送中心/ },
  { id: "commercial", label: "商业建筑", pattern: /商场|商业|零售|购物中心|店铺/ },
];

export function classifyBuildingType(project) {
  const explicit = String(project?.buildingType || "").trim();
  if (explicit) {
    if (explicit === "generic") return { id: "generic", label: "通用建筑", source: "uploaded" };
    const found = BUILDING_TYPES.find((item) => item.id === explicit || item.label === explicit || item.pattern.test(explicit));
    return { id: found?.id || "generic", label: found?.label || explicit, source: "uploaded" };
  }
  const found = BUILDING_TYPES.find((item) => item.pattern.test(String(project?.name || "")));
  return found ? { id: found.id, label: found.label, source: "name" } : { id: "generic", label: "通用建筑", source: "unspecified" };
}

export function deriveBuildingGeometry(project) {
  const floors = Math.min(30, Math.max(1, Math.round(Number(project?.floors) || 1)));
  const type = classifyBuildingType(project);
  const provided = project?.geometry;
  const explicit = provided && [provided.length, provided.width, provided.floorHeight].every((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  if (explicit) return {
    floors, type,
    length: Number(provided.length), width: Number(provided.width), floorHeight: Number(provided.floorHeight),
    layout: ["linear", "double", "tower"].includes(provided.layout) ? provided.layout : "linear",
    source: "uploaded",
    explanation: `尺寸来自上传文件；${type.source === "name" ? "建筑用途按项目名称识别" : type.source === "uploaded" ? "建筑用途来自项目参数" : "建筑用途未提供，使用通用示意"}。立面与构件细节为示意，非 BIM。`,
  };
  const floorArea = Number(project?.area) > 0 ? Number(project.area) / floors : 500;
  const aspect = type.id === "industrial" || type.id === "warehouse" ? 2.8 : type.id === "office" ? 1.5 : 2.2;
  const width = Math.sqrt(floorArea / aspect);
  return {
    floors, type, length: width * aspect, width, floorHeight: type.id === "industrial" || type.id === "warehouse" ? 5 : 3,
    layout: "linear", source: "assumed",
    explanation: `文件未提供完整建筑尺寸；按面积、层数和假设长宽比 ${aspect} 推导体量。${type.source === "name" ? "用途按项目名称识别" : type.source === "uploaded" ? "用途来自项目参数" : "用途未提供"}，需核对。`,
  };
}
