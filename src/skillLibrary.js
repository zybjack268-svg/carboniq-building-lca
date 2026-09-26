// 技能库：把各阶段智能体的专项工作抽象为可调用、可创建、可导入导出的技能。
// 内置技能对应四个工作流的既有分析；用户技能保存在本机浏览器，不上传任何服务。

export const SKILL_SCOPES = [
  { id: "overview", label: "项目全览" },
  { id: "a1", label: "A1–A3 材料清单" },
  { id: "a4", label: "A4 运输路线" },
  { id: "a5", label: "A5 施工活动" },
  { id: "b6", label: "B6 运营能源" },
];

export const USER_SKILLS_KEY = "carboniq.skills.v1";
export const USER_SKILLS_LIMIT = 60;

export const BUILTIN_SKILLS = [
  {
    id: "skill-a1-audit", builtin: true, scope: "a1", name: "材料清单数据审查",
    description: "按数据审查规则找出缺失来源、异常因子与单位风险，输出待修正清单。",
    instruction: "请审查当前 A1–A3 材料清单：逐条检查碳因子来源是否可核对、数量与单位是否匹配、因子是否明显偏离同类材料；输出按优先级排序的问题清单，每条给出位置、问题与修正动作。只引用证据中的数据，不得编造标准限值。",
  },
  {
    id: "skill-a1-hotspot", builtin: true, scope: "a1", name: "A1–A3 排放热点解读",
    description: "解释排放贡献排序，给出需要优先核实工程量与因子的材料名单。",
    instruction: "请解读 A1–A3 材料排放热点：说明前几位材料的占比与原因（用量大还是因子高），指出占比是清单内部的相对结论、不能直接判断是否超标；给出优先核查名单（先查什么、找什么证据）。",
  },
  {
    id: "skill-a1-candidates", builtin: true, scope: "a1", name: "候选方案比选建议",
    description: "基于已录入候选比较减排量与成本，指出性能与采购风险。",
    instruction: "请基于已录入的候选产品比较各方案的估计减排量与成本变化，说明比较前提是同用量、同单位因子；指出规格等效性、价格与可采购性尚未验证，提示下一步应补充哪些证据。不得替用户编造产品或价格。",
  },
  {
    id: "skill-a4-analysis", builtin: true, scope: "a4", name: "A4 运输核算分析",
    description: "解读运输路线小计与缺口，核对运输方式、距离与因子的匹配性。",
    instruction: "请分析 A4 运输核算结果：说明已完整路线的小计不能代表阶段总量，指出未补齐路线缺什么；核对每条路线的运输方式与因子单位（kgCO₂e/(t·km)）是否匹配、距离是否合理；给出补齐数据的优先顺序。",
  },
  {
    id: "skill-a5-analysis", builtin: true, scope: "a5", name: "A5 施工排放分析",
    description: "解读施工活动能耗结构，核对燃料因子口径并给出记录建议。",
    instruction: "请分析 A5 现场建造排放：说明各施工活动的能耗与排放结构，核对用量单位与因子口径是否一致（如柴油按 kg 还是 L）、来源是否可核对；指出小计只是完整活动的合计；给出改进记录与降低排放的可执行建议。",
  },
  {
    id: "skill-b6-analysis", builtin: true, scope: "b6", name: "B6 能耗与节能建议",
    description: "解读年度能源排放结构，给出节能方向与数据核实建议。",
    instruction: "请分析 B6 运营能源排放：结合电力、燃气、外购热力的占比给出 2-3 条可执行的节能方向（如高效设备、分项计量、行为管理）与数据核实建议（因子按地区年份核实）；提醒年度结果不得与一次性建设阶段直接相加。",
  },
  {
    id: "skill-overview-report", builtin: true, scope: "overview", name: "跨阶段结果汇总",
    description: "汇总各阶段已算出的结果与边界，生成项目现状小结。",
    instruction: "请汇总当前项目各阶段的结果：A1–A3 材料生产、A4 运输小计、A5 施工小计、B6 年度运营能源，分别列示并注明各自的边界与时间尺度；不同阶段的结果不得直接相加；未录入的阶段说明缺什么数据，最后给出项目现状一句话结论。",
  },
  {
    id: "skill-overview-data", builtin: true, scope: "overview", name: "数据需求清单",
    description: "对照四个工作流列出还缺哪些数据，按优先级排序。",
    instruction: "请对照四个工作流（A1–A3 材料、A4 运输、A5 施工、B6 运营）列出当前还缺的数据：每项说明需要什么、从哪里取得（如 EPD、运输单、电费账单）、优先级为什么这样排。只基于证据中已有的数据判断，不得假设用户已提供未列出的数据。",
  },
];

const trimmed = (value) => String(value ?? "").trim();

export function validateSkill(input, { existingIds = [] } = {}) {
  const errors = [];
  const name = trimmed(input?.name);
  const description = trimmed(input?.description);
  const instruction = trimmed(input?.instruction);
  const scope = trimmed(input?.scope);
  if (!name) errors.push("技能名称不能为空。");
  if (name.length > 40) errors.push("技能名称不能超过 40 字。");
  if (!description) errors.push("一句话说明不能为空。");
  if (description.length > 160) errors.push("一句话说明不能超过 160 字。");
  if (!instruction) errors.push("技能指令不能为空。");
  if (instruction.length > 4000) errors.push("技能指令不能超过 4000 字。");
  if (!SKILL_SCOPES.some((item) => item.id === scope)) errors.push("适用数据范围无效。");
  const knownIds = [...BUILTIN_SKILLS.map((item) => item.id), ...existingIds];
  if (input?.id && knownIds.includes(input.id)) errors.push(`技能 id「${input.id}」与现有技能冲突。`);
  if (errors.length) return { ok: false, errors };
  const skill = {
    id: input.id || `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    builtin: false,
    scope,
    name,
    description,
    instruction,
  };
  return { ok: true, skill };
}

// 导入：接受单个技能对象、{skills:[…]} 或数组；逐条校验，坏的跳过并说明原因。
export function importSkills(text, { existingIds = [] } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ""));
  } catch {
    return { skills: [], errors: ["不是有效的 JSON 文件。"] };
  }
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.skills)
      ? parsed.skills
      : [parsed];
  const skills = [];
  const errors = [];
  const taken = [...existingIds];
  list.slice(0, USER_SKILLS_LIMIT).forEach((item, index) => {
    const result = validateSkill(item, { existingIds: taken });
    if (result.ok) {
      skills.push(result.skill);
      taken.push(result.skill.id);
    } else {
      errors.push(`第 ${index + 1} 条未导入：${result.errors.join(" ")}`);
    }
  });
  if (!list.length) errors.push("文件里没有技能。");
  return { skills, errors };
}

export function exportSkill(skill) {
  const { id, scope, name, description, instruction } = skill;
  return JSON.stringify({ carboniqSkill: 1, id, scope, name, description, instruction }, null, 2);
}

// —— SKILL.md 式 Markdown 格式（仿 Codex：YAML frontmatter + 正文即指令） ——
const frontmatterValue = (text) => text.replace(/^["']|["']$/g, "").trim();

export function skillToMarkdown(skill) {
  return [
    "---",
    `name: ${skill.name}`,
    `description: ${skill.description}`,
    `scope: ${skill.scope}`,
    "---",
    "",
    skill.instruction,
    "",
].join("\n");
}

// 解析 SKILL.md：frontmatter 提供名称/说明/范围，正文整体作为技能指令。
export function parseMarkdownSkill(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "").trim();
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { ok: false, error: "缺少 YAML frontmatter（文件应以 --- 开头，包含 name/description/scope）。" };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (pair) meta[pair[1].toLowerCase()] = frontmatterValue(pair[2]);
  }
  const body = match[2].trim();
  const scope = (meta.scope || "overview").toLowerCase();
  if (!SKILL_SCOPES.some((item) => item.id === scope)) return { ok: false, error: `frontmatter 的 scope「${meta.scope || ""}」无效，应为 ${SKILL_SCOPES.map((item) => item.id).join(" / ")}。` };
  if (!meta.name) return { ok: false, error: "frontmatter 缺少 name。" };
  if (!body) return { ok: false, error: "正文为空：frontmatter 之后的 Markdown 正文就是技能指令。" };
  return {
    ok: true,
    skill: {
      name: meta.name,
      description: meta.description || `${meta.name}（来自 SKILL.md，未填写说明）`,
      scope,
      instruction: body,
    },
  };
}

// 统一导入入口：JSON（单个/数组/包装）或 SKILL.md 文本自动识别。
export function importSkillText(text, options = {}) {
  const source = String(text ?? "").trim();
  if (!source) return { skills: [], errors: ["文件内容为空。"] };
  if (source.startsWith("{") || source.startsWith("[")) return importSkills(source, options);
  const parsed = parseMarkdownSkill(source);
  if (!parsed.ok) return { skills: [], errors: [parsed.error] };
  const result = validateSkill(parsed.skill, { existingIds: options.existingIds || [] });
  if (!result.ok) return { skills: [], errors: result.errors };
  return { skills: [result.skill], errors: [] };
}

// 从智能体回复中提取技能草稿（carboniqSkillDraft 协议）。
// 用括号配平扫描找出包含该键的完整 JSON 对象，容忍模型输出代码围栏或多余文字。
function scanBalancedObjects(source) {
  const results = [];
  for (let start = source.indexOf("{"); start !== -1; start = source.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < source.length; i += 1) {
      const char = source[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = source.slice(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed?.carboniqSkillDraft) results.push({ start, end: i + 1, parsed });
          } catch { /* 尝试下一个起点 */ }
          break;
        }
      }
    }
  }
  return results;
}

export function extractSkillDraft(text) {
  const source = String(text ?? "").replace(/```(?:json)?/gi, "");
  if (!source.includes("carboniqSkillDraft")) return null;
  const hits = scanBalancedObjects(source);
  return hits.length ? hits[0].parsed.carboniqSkillDraft : null;
}

// 把聊天正文里的草稿 JSON（及其代码围栏）剥掉——草稿内容由界面卡片展示，不该以乱码形式出现在对话里。
export function stripSkillDraftJson(text) {
  let output = String(text ?? "");
  for (let guard = 0; guard < 5 && output.includes("carboniqSkillDraft"); guard += 1) {
    const source = output.replace(/```(?:json)?/gi, "");
    const hits = scanBalancedObjects(source);
    if (!hits.length) break;
    const { start, end } = hits[hits.length - 1];
    const before = source.slice(0, start).replace(/```(?:json)?\s*$/, "").trimEnd();
    const after = source.slice(end).replace(/^\s*```/, "").trimStart();
    output = `${before}\n${after}`.trim();
  }
  return output.replace(/```\s*```/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

const validStored = (item) => item
  && typeof item.id === "string" && item.id.startsWith("user-")
  && validateSkill(item).ok;

export function loadUserSkills() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(USER_SKILLS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(validStored).slice(0, USER_SKILLS_LIMIT);
  } catch {
    return [];
  }
}

export function saveUserSkills(list) {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    window.localStorage.setItem(USER_SKILLS_KEY, JSON.stringify(Array.isArray(list) ? list.filter(validStored).slice(0, USER_SKILLS_LIMIT) : []));
    return true;
  } catch {
    return false;
  }
}

export function allSkills(userSkills) {
  const stored = Array.isArray(userSkills) ? userSkills : loadUserSkills();
  return [...BUILTIN_SKILLS, ...stored];
}

export function scopeLabel(scope) {
  return SKILL_SCOPES.find((item) => item.id === scope)?.label || scope;
}
