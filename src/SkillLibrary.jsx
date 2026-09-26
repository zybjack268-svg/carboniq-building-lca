import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Download, Play, Plus, Settings2, Trash2, Upload, X } from "lucide-react";
import { hasModelConfig, requestAdvisor } from "./advisorEngine.js";
import { allSkills, importSkillText, loadUserSkills, saveUserSkills, scopeLabel, skillToMarkdown, validateSkill, SKILL_SCOPES, USER_SKILLS_LIMIT } from "./skillLibrary.js";
import { animateExpand, animateShrink, popAnchor } from "./pageFx.js";
import "./skill-library.css";

const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });

// 按数据范围从当前项目状态收集证据；数值全部来自本地计算。
function buildEvidence(scope, props) {
  const { stats, optimized, candidates, selectedCandidates, transportResult, siteResult, operationResult, climate, project, isReference } = props;
  const topRows = [...(stats?.rows || [])].sort((a, b) => b.emission - a.emission).slice(0, 8)
    .map((row) => ({ name: row.name, part: row.part, quantity: row.quantity, unit: row.unit, factor: row.factor, emission_kg: Math.round(row.emission), source: row.source, cost_entered: row.cost === "" || row.cost === null || row.cost === undefined ? null : row.cost }));
  const boundary = "各阶段结果保留各自边界与时间尺度，不得直接相加；数据由本地确定性计算得出，不是模型生成。";
  if (scope === "a1") {
    return {
      workflow: "A1–A3 材料生产", boundary,
      list_status: isReference ? "内置演示清单（工程量为估算值）" : "用户导入清单",
      material_count: stats.rows.length,
      total_kg: Math.round(stats.total),
      intensity_kg_per_m2: Number((stats.intensity || 0).toFixed(2)),
      scenario_reduction_kg: Math.round(optimized.reduction || 0),
      rows: topRows,
      candidate_count: candidates.length,
      selected_count: Object.values(selectedCandidates).filter(Boolean).length,
    };
  }
  if (scope === "a4") {
    return {
      workflow: "A4 材料运输", boundary,
      complete_count: transportResult.rows.length,
      incomplete_count: transportResult.incomplete,
      partial_total_kg: Number(transportResult.kg.toFixed(2)),
      rows: transportResult.rows.slice(0, 15).map((row) => ({ material: row.material, origin: row.origin, destination: row.destination, mass_t: row.mass, distance_km: row.distance, factor: row.factor, source: row.source, kg: Number(row.kg.toFixed(2)) })),
    };
  }
  if (scope === "a5") {
    return {
      workflow: "A5 现场建造", boundary,
      complete_count: siteResult.rows.length,
      incomplete_count: siteResult.incomplete,
      partial_total_kg: Number(siteResult.kg.toFixed(2)),
      rows: siteResult.rows.slice(0, 15).map((row) => ({ activity: row.activity, energy: row.energy, quantity: row.quantity, unit: row.unit, factor: row.factor, factor_unit: row.factorUnit, source: row.source, kg: Number(row.kg.toFixed(2)) })),
    };
  }
  if (scope === "b6") {
    return {
      workflow: "B6 运营能源", boundary,
      electricity_kg: operationResult.electricityKg,
      gas_kg: operationResult.gasKg,
      heat_kg: operationResult.heatKg === null || operationResult.heatKg === undefined ? null : Number(operationResult.heatKg.toFixed(2)),
      annual_kg: operationResult.annualKg,
      gas_incomplete: operationResult.gasIncomplete || false,
      heat_incomplete: operationResult.heatIncomplete || false,
      years: operationResult.years,
      entered_data: climate,
    };
  }
  return {
    workflow: "项目全览", boundary,
    project: { name: project.name, area_m2: project.area, floors: project.floors, building_type: project.buildingType || "未注明" },
    a1_materials: { count: stats.rows.length, total_kg: Math.round(stats.total), intensity: Number((stats.intensity || 0).toFixed(2)), top: topRows.slice(0, 4).map((row) => ({ name: row.name, emission_kg: row.emission_kg })) },
    a1_candidates: { count: candidates.length, selected: Object.values(selectedCandidates).filter(Boolean).length, scenario_reduction_kg: Math.round(optimized.reduction || 0) },
    a4_transport: { complete: transportResult.rows.length, incomplete: transportResult.incomplete, partial_kg: Number(transportResult.kg.toFixed(2)) },
    a5_construction: { complete: siteResult.rows.length, incomplete: siteResult.incomplete, partial_kg: Number(siteResult.kg.toFixed(2)) },
    b6_operation: { electricity_kg: operationResult.electricityKg, gas_kg: operationResult.gasKg, heat_kg: operationResult.heatKg === null || operationResult.heatKg === undefined ? null : Number(operationResult.heatKg.toFixed(2)), annual_kg: operationResult.annualKg },
  };
}

function scopeHasData(scope, props) {
  const { stats, transportResult, siteResult, operationResult } = props;
  if (scope === "a1") return (stats?.rows || []).length > 0;
  if (scope === "a4") return Boolean(transportResult?.hasData);
  if (scope === "a5") return Boolean(siteResult?.hasData);
  if (scope === "b6") return operationResult?.annualKg !== null && operationResult?.annualKg !== undefined;
  return (stats?.rows || []).length > 0 || transportResult?.hasData || siteResult?.hasData || (operationResult?.annualKg !== null && operationResult?.annualKg !== undefined);
}

export default function SkillLibrary({ onClose, anchorEl, userSkills: userSkillsProp, onUserSkillsChange, ...props }) {
  const { aiConfig, openSetup } = props;
  const [localSkills, setLocalSkills] = useState(loadUserSkills);
  const userSkills = userSkillsProp ?? localSkills;
  const setUserSkills = (updater) => {
    const next = typeof updater === "function" ? updater(userSkills) : updater;
    if (onUserSkillsChange) onUserSkillsChange(next);
    else { setLocalSkills(next); saveUserSkills(next); }
  };
  const [runningId, setRunningId] = useState(null);
  const [result, setResult] = useState(null);
  const [followUp, setFollowUp] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", scope: "a1", description: "", instruction: "" });
  const [formError, setFormError] = useState("");
  const [closing, setClosing] = useState(false);
  const fileRef = useRef(null);
  const surfaceRef = useRef(null);
  const backdropRef = useRef(null);
  const modelReady = hasModelConfig(aiConfig);

  useEffect(() => { if (!onUserSkillsChange) saveUserSkills(userSkills); }, [userSkills, onUserSkillsChange]);
  useLayoutEffect(() => {
    if (surfaceRef.current) animateExpand(surfaceRef.current, anchorEl);
    if (backdropRef.current) backdropRef.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out", fill: "both" });
  }, []);
  const beginClose = () => {
    if (closing) return;
    setClosing(true);
    backdropRef.current?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: "ease-in", fill: "forwards" });
    const finish = () => { popAnchor(anchorEl); onClose?.(); };
    if (surfaceRef.current) animateShrink(surfaceRef.current, anchorEl).then(finish);
    else finish();
  };
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") beginClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  });
  const skills = useMemo(() => allSkills(userSkills), [userSkills]);

  const run = async (skill, question = "") => {
    if (runningId || !scopeHasData(skill.scope, props)) return;
    setRunningId(skill.id);
    setError("");
    setNotice("");
    try {
      const evidence = buildEvidence(skill.scope, props);
      const answer = await requestAdvisor({
        config: aiConfig,
        context: { skill: { name: skill.name, instruction: skill.instruction }, evidence },
        history: [{ role: "user", text: question.trim() || `请执行技能「${skill.name}」。` }],
      });
      setResult({ name: skill.name, answer });
    } catch (err) {
      setError(`技能「${skill.name}」未完成：${err.message}`);
    } finally {
      setRunningId(null);
    }
  };

  const create = (event) => {
    event.preventDefault();
    const result = validateSkill(form, { existingIds: userSkills.map((item) => item.id) });
    if (!result.ok) { setFormError(result.errors.join(" ")); return; }
    setUserSkills((current) => [...current, result.skill].slice(0, USER_SKILLS_LIMIT));
    setForm({ name: "", scope: "a1", description: "", instruction: "" });
    setFormError("");
    setCreating(false);
    setNotice(`技能「${result.skill.name}」已创建并保存在本机浏览器。`);
  };

  const importFile = async (file) => {
    if (!file) return;
    setError(""); setNotice("");
    try {
      const text = await file.text();
      const outcome = importSkillText(text, { existingIds: userSkills.map((item) => item.id) });
      if (outcome.skills.length) {
        setUserSkills((current) => [...current, ...outcome.skills].slice(0, USER_SKILLS_LIMIT));
        setNotice(`已导入 ${outcome.skills.length} 个技能并保存在本机浏览器。`);
      }
      if (outcome.errors.length) setError(outcome.errors.join(" "));
    } catch (err) {
      setError(`导入失败：${err.message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const exportOne = (skill) => {
    const blob = new Blob([skillToMarkdown(skill)], { type: "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SKILL-${skill.name}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const removeOne = (id) => {
    setUserSkills((current) => current.filter((item) => item.id !== id));
    setNotice("技能已删除。");
  };

  return <div className="sk-backdrop" ref={backdropRef} onClick={beginClose}>
  <section className="sk-library" role="dialog" aria-modal="true" aria-label="技能库" onClick={(event) => event.stopPropagation()} ref={surfaceRef}>
    <div className="cw-section-head"><div><small>SKILL LIBRARY</small><h2>技能库</h2></div>
      <div className="sk-actions">
        <button type="button" onClick={() => { setCreating((value) => !value); setFormError(""); }}><Plus size={15}/> 新建技能</button>
        <button type="button" onClick={() => fileRef.current?.click()}><Upload size={15}/> 导入技能</button>
        {onClose && <button type="button" className="sk-close" aria-label="关闭技能库" onClick={beginClose}><X size={16}/></button>}
        <input ref={fileRef} type="file" accept=".json,.md,.txt,.markdown" hidden onChange={(event) => importFile(event.target.files?.[0])}/>
      </div>
    </div>
    <p className="sk-intro">技能是给智能体的专项工作指令：选择一个技能，它会带着当前项目的数据快照执行。内置技能对应四个工作流的既有分析；你也可以创建自己的技能，或从 JSON 文件导入，所有用户技能只保存在本机浏览器。</p>
    {!modelReady && <p className="sk-model-note">技能运行需要先连接模型。<button type="button" onClick={openSetup}><Settings2 size={14}/> 连接模型</button></p>}
    {creating && <form className="sk-form" onSubmit={create}>
      <div className="sk-form-head"><b>新建技能</b><button type="button" aria-label="收起" onClick={() => setCreating(false)}><X size={15}/></button></div>
      <div className="sk-form-grid">
        <label>技能名称<input value={form.name} maxLength={40} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="例如：幕墙碳足迹专项核对"/></label>
        <label>适用数据<select value={form.scope} onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value }))}>{SKILL_SCOPES.map((scope) => <option key={scope.id} value={scope.id}>{scope.label}</option>)}</select></label>
      </div>
      <label>一句话说明<input value={form.description} maxLength={160} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="这张卡片上展示的一句介绍"/></label>
      <label>技能指令（运行时发给模型的专项要求）<textarea value={form.instruction} maxLength={4000} rows={4} onChange={(event) => setForm((current) => ({ ...current, instruction: event.target.value }))} placeholder="例如：请核对清单中每一项的因子单位与来源，输出按风险排序的核对表……"/></label>
      {formError && <p role="alert">{formError}</p>}
      <button className="sk-primary" type="submit">保存技能</button>
    </form>}
    {notice && <p className="sk-notice" role="status">{notice}</p>}
    {error && <p className="sk-error" role="alert">{error}</p>}
    <div className="sk-grid">
      {skills.map((skill) => {
        const hasData = scopeHasData(skill.scope, props);
        const busy = runningId === skill.id;
        return <article key={skill.id} className="sk-card">
          <header><small>{scopeLabel(skill.scope)}{skill.builtin ? " · 内置" : " · 我的"}</small><h3>{skill.name}</h3></header>
          <p>{skill.description}</p>
          <div className="sk-card-foot">
            <button type="button" className="sk-run" disabled={!modelReady || busy || !hasData} onClick={() => run(skill)}>{busy ? "运行中…" : <><Play size={14}/> 运行</>}</button>
            {!skill.builtin && <button type="button" className="sk-icon" title="导出为 SKILL.md" onClick={() => exportOne(skill)}><Download size={15}/></button>}
            {!skill.builtin && <button type="button" className="sk-icon sk-danger" title="删除" onClick={() => removeOne(skill.id)}><Trash2 size={15}/></button>}
          </div>
          {!hasData && <small className="sk-hint">需要先在{scopeLabel(skill.scope)}录入数据</small>}
        </article>;
      })}
    </div>
    {result && <div className="sk-result">
      <div className="sk-result-head"><div><small>技能结果</small><h3>{result.name}</h3></div><button type="button" aria-label="关闭结果" onClick={() => setResult(null)}><X size={15}/></button></div>
      <div className="sk-result-body">{result.answer}</div>
      <div className="sk-followup">
        <input value={followUp} onChange={(event) => setFollowUp(event.target.value)} placeholder="想追问什么？例如：只看前两项，再细一点" aria-label="追问"/>
        <button type="button" disabled={!followUp.trim() || runningId !== null || !modelReady} onClick={() => { const skill = skills.find((item) => item.name === result.name); if (skill) run(skill, followUp); }}>追问</button>
      </div>
    </div>}
  </section>
  </div>;
}
