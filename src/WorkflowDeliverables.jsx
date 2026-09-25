import React, { Suspense, useState } from "react";
import { ArrowRight, Check, Download } from "lucide-react";
import { BUILDING_TYPES, deriveBuildingGeometry } from "./geometry.js";

const CarbonTwin = React.lazy(() => import("./CarbonTwin.jsx"));
const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function downloadReport({ project, stats, optimized, result, evidence, fileName, transportResult, siteResult, operationResult }) {
  const lines = (items, render) => items.map(render).join("");
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${escapeHtml(project.name)} · 碳排放分析报告</title><style>body{max-width:850px;margin:48px auto;padding:0 28px;font:16px/1.7 system-ui,sans-serif;color:#173b2b}h1{font-size:30px}h2{margin-top:32px;padding-bottom:8px;border-bottom:1px solid #d8e7db;color:#176b47}p,li{white-space:pre-wrap}.meta{color:#688273}.numbers{display:flex;gap:14px;flex-wrap:wrap}.numbers div{padding:16px 20px;background:#eff8f1;border-radius:12px;min-width:175px}.numbers b{display:block;font-size:21px}.note{padding:15px;border-left:3px solid #64af80;background:#f3faf4}@media print{body{margin:0;max-width:none}}</style><h1>${escapeHtml(project.name)} · 碳排放分析报告</h1><p class="meta">来源文件：${escapeHtml(fileName)} · 建筑面积：${number.format(project.area)} m² · 示意楼层：${number.format(project.floors)} 层 · 生成时间：${escapeHtml(new Date().toLocaleString("zh-CN"))}</p><div class="numbers"><div>A1–A3 基准排放<b>${number.format(stats.tonnes)} tCO₂e</b></div><div>单位面积排放<b>${number.format(stats.intensity)} kgCO₂e/m²</b></div><div>已选方案排放<b>${number.format(optimized.total / 1000)} tCO₂e</b></div></div><h2>分析摘要</h2><p>${escapeHtml(result?.summary || "模型分析尚未完成；以下仅为本地核算结果。")}</p><h2>主要热点</h2><ol>${lines(evidence.hotspots || [], (item) => `<li>${escapeHtml(item.name)}：${number.format(item.emission_kg / 1000)} tCO₂e，占当前清单 ${number.format(item.share_percent)}%</li>`)}</ol><h2>发现与建议</h2>${lines(result?.findings || [], (item) => `<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)}</p>`)}${lines(result?.actions || [], (item) => `<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.reason)}</p>`)}<h2>数据与结论边界</h2><p class="note">${escapeHtml(evidence.boundary)}\n${escapeHtml((evidence.quality_flags || []).join("；") || "仍需核对录入因子来源、产品规格和数量。")}\n3D 楼型是概念示意，未由材料清单还原真实建筑几何；候选产品的性能、价格与采购条件尚未验证。</p></html>`;
  const phaseHtml = `<h2>分阶段核算</h2><p>A4 已完成路线：${transportResult.hasData ? `${number.format(transportResult.kg / 1000)} tCO₂e` : "无数据"}；未完成路线：${transportResult.incomplete} 条。</p><p>A5 已完成活动：${siteResult.hasData ? `${number.format(siteResult.kg / 1000)} tCO₂e` : "无数据"}；未完成活动：${siteResult.incomplete} 项。</p><p>B6 已录入能源：${operationResult.annualKg !== null ? `${number.format(operationResult.annualKg / 1000)} tCO₂e/年` : "无数据"}。年度结果不与建设阶段直接相加。</p><p>3D 几何来源：${escapeHtml(deriveBuildingGeometry(project).explanation)}</p>`;
  const completeHtml = html.replace("</html>", `${phaseHtml}</html>`);
  const url = URL.createObjectURL(new Blob([completeHtml], { type: "text/html;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.name || "项目"}-碳排放分析报告.html`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function WorkflowDeliverables({ project, setProject, stats, optimized, agentEvidence, result, fileName, selectedCandidates, setSelectedCandidates, addCandidate, transportResult, siteResult, operationResult }) {
  const [adding, setAdding] = useState(false);
  const [candidateDraft, setCandidateDraft] = useState({ materialId: stats.rows[0]?.id || "", name: "", factor: "", source: "", specification: "" });
  const [candidateError, setCandidateError] = useState("");
  const draft = agentEvidence.draft_optimization;
  const selectedCount = Object.values(selectedCandidates).filter(Boolean).length;
  const geometry = deriveBuildingGeometry(project);
  const applyDraft = () => setSelectedCandidates((current) => ({ ...current, ...Object.fromEntries(draft.candidates.map((item) => [item.material_id, item.candidate_id])) }));
  const saveCandidate = (event) => {
    event.preventDefault();
    const material = stats.rows.find((item) => item.id === candidateDraft.materialId);
    const factor = Number(candidateDraft.factor);
    if (!material || !candidateDraft.name.trim() || !candidateDraft.source.trim() || !candidateDraft.specification.trim() || !Number.isFinite(factor) || factor <= 0) { setCandidateError("请填写候选名称、同单位碳因子、规格和来源。"); return; }
    addCandidate({ materialId: material.id, name: candidateDraft.name.trim(), factor, source: candidateDraft.source.trim(), specification: candidateDraft.specification.trim() });
    setCandidateDraft({ materialId: material.id, name: "", factor: "", source: "", specification: "" });
    setCandidateError(""); setAdding(false);
  };
  return <section className="cw-deliverables" aria-label="交付成果">
    <div className="cw-section-head"><div><small>DELIVERABLES</small><h2>交付成果</h2></div><span className="cw-status done">随数据更新</span></div>
    <div className="cw-delivery-body">
      <div className="cw-scenario-grid"><div><small>当前基准 · A1–A3</small><strong>{number.format(stats.tonnes)} <em>tCO₂e</em></strong></div><ArrowRight size={20}/><div><small>{selectedCount ? `已选 ${selectedCount} 项候选` : "尚未选用候选"}</small><strong>{number.format(optimized.total / 1000)} <em>tCO₂e</em></strong></div><div className="cw-scenario-delta"><small>估计减排</small><strong>{selectedCount ? number.format(optimized.reduction / 1000) : "—"} <em>{selectedCount ? "tCO₂e" : ""}</em></strong></div></div>
      <h3>自动筛选的候选方向</h3>
      {draft.candidates.length ? <><p>基于已录入且同单位可比较的候选因子生成草案。选入后立即更新对比结果；产品性能、价格及可采购性仍需核验。</p><div className="cw-candidate-list">{draft.candidates.slice(0, 5).map((item) => <article key={item.candidate_id}><div><b>{item.material} → {item.candidate}</b><small>按当前用量估计减少 {number.format(item.estimated_reduction_kg / 1000)} tCO₂e</small></div><span>{selectedCandidates[item.material_id] === item.candidate_id ? <><Check size={14}/> 已选入</> : "待选入"}</span></article>)}</div><button className="cw-primary-small" onClick={applyDraft}>一键选入草案 <ArrowRight size={15}/></button></> : <div className="cw-empty-action"><p>当前没有可比较的候选产品。补录产品因子、规格与来源后，系统会自动筛选减排方向。</p><button onClick={() => setAdding((value) => !value)}>补录候选产品 <ArrowRight size={15}/></button></div>}
      {adding && <form className="cw-candidate-form" onSubmit={saveCandidate}><label>对应材料<select value={candidateDraft.materialId} onChange={(event) => setCandidateDraft((current) => ({ ...current, materialId: event.target.value }))}>{stats.rows.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>候选产品名称<input value={candidateDraft.name} onChange={(event) => setCandidateDraft((current) => ({ ...current, name: event.target.value }))}/></label><label>同单位碳因子<input type="number" min="0" step="any" value={candidateDraft.factor} onChange={(event) => setCandidateDraft((current) => ({ ...current, factor: event.target.value }))}/></label><label>关键规格<input value={candidateDraft.specification} onChange={(event) => setCandidateDraft((current) => ({ ...current, specification: event.target.value }))}/></label><label>因子来源<input value={candidateDraft.source} onChange={(event) => setCandidateDraft((current) => ({ ...current, source: event.target.value }))}/></label>{candidateError && <p role="alert">{candidateError}</p>}<button className="cw-primary-small" type="submit">录入并重新筛选</button></form>}
      <p className="cw-limitation">{geometry.explanation} 3D 仅为体量示意，不是建筑实景或 BIM 模型；材料热点来自清单核算。</p>
    </div>
    <div className="cw-twin-embed"><div className="cw-project-controls"><div><b>3D 概念预览 · {geometry.type.label}</b><small>{geometry.source === "uploaded" ? "已按上传建筑尺寸生成" : "缺少几何尺寸；按面积推导体量"} · {geometry.length.toFixed(1)} × {geometry.width.toFixed(1)} m · {geometry.floors} 层</small></div><label>建筑用途 <select value={geometry.type.id} onChange={(event) => setProject((current) => ({ ...current, buildingType: event.target.value }))}><option value="generic">通用建筑</option>{BUILDING_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>楼层数 <input type="number" min="1" max="30" value={project.floors} onChange={(event) => { const value = Number(event.target.value); if (value >= 1 && value <= 30) setProject((current) => ({ ...current, floors: value })); }}/></label></div><Suspense fallback={<div className="cw-generating">正在加载 3D 预览…</div>}><CarbonTwin project={project} stats={stats} embedded/></Suspense></div>
    <div className="cw-delivery-body cw-report-preview"><div className="cw-report-top"><div><small>PROJECT REPORT</small><h3>{project.name} · 自动分析报告</h3><p>源文件：{fileName}</p></div><button className="cw-primary-small" onClick={() => downloadReport({ project, stats, optimized, result, evidence: agentEvidence, fileName, transportResult, siteResult, operationResult })}><Download size={15}/> 下载 HTML 报告</button></div><div className="cw-report-facts"><span>A1–A3：<b>{number.format(stats.tonnes)} tCO₂e</b></span><span>A4：<b>{transportResult.hasData ? `${number.format(transportResult.kg / 1000)} tCO₂e` : "无数据"}</b></span><span>A5：<b>{siteResult.hasData ? `${number.format(siteResult.kg / 1000)} tCO₂e` : "无数据"}</b></span><span>B6：<b>{operationResult.annualKg !== null ? `${number.format(operationResult.annualKg / 1000)} tCO₂e/年` : "无数据"}</b></span></div><h4>分析摘要</h4><p>{result?.summary || "模型分析尚未完成；可先查看本地核算结果。"}</p><h4>主要热点</h4><ol>{agentEvidence.hotspots.map((item) => <li key={item.id}>{item.name}：{number.format(item.emission_kg / 1000)} tCO₂e，占当前清单 {number.format(item.share_percent)}%</li>)}</ol><h4>结论边界</h4><p>{agentEvidence.boundary} 3D 展示为概念示意。产品替代效果需进一步核验。</p></div>
  </section>;
}
