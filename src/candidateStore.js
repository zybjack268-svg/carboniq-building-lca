// 候选材料本地持久化：只存浏览器 localStorage，不上传任何服务。
const KEY = "carboniq.candidates.v1";
const LIMIT = 500;

const valid = (item) => item
  && typeof item === "object"
  && typeof item.id === "string"
  && typeof item.materialId === "string"
  && cellName(item)
  && Number.isFinite(Number(item.factor))
  && Number(item.factor) > 0;

const cellName = (item) => typeof item.name === "string" && item.name.trim();

export function loadStoredCandidates() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(valid).map((item) => ({
      ...item,
      cost: Number.isFinite(Number(item.cost)) && item.cost !== "" && item.cost !== null && item.cost !== undefined ? Number(item.cost) : "",
    }));
  } catch {
    return [];
  }
}

export function saveStoredCandidates(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Array.isArray(list) ? list.slice(0, LIMIT) : []));
  } catch {
    // 存储被禁用或已满时静默跳过：内存中的候选仍然可用。
  }
}

export function clearStoredCandidates() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // 同上
  }
}
