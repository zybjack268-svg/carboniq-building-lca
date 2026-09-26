// 项目状态本地持久化：只存浏览器 localStorage，不上传任何服务。
// 材料清单、A4 路线、A5 活动、B6 能源、项目参数、候选与已选方案在刷新后自动恢复。
const KEY = "carboniq.project.v1";

export function loadStoredProject() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (!state || typeof state !== "object") return null;
    if (!Array.isArray(state.materials) || !state.materials.length) return null;
    return state;
  } catch {
    return null;
  }
}

export function saveStoredProject(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      materials: state.materials,
      project: state.project,
      fileName: state.fileName,
      isReference: state.isReference,
      candidates: state.candidates,
      selectedCandidates: state.selectedCandidates,
      routes: state.routes,
      siteRows: state.siteRows,
      climate: state.climate,
      benchmark: state.benchmark,
      savedAt: Date.now(),
    }));
  } catch {
    // 存储被禁用或已满时静默跳过：内存中的状态仍然可用。
  }
}

export function clearStoredProject() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // 同上
  }
}
