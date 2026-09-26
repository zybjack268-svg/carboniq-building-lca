import React, { useState } from "react";
import { BookOpen, Check, Download, FileUp, LibraryBig, Plus } from "lucide-react";
import FactorPicker from "./FactorPicker.jsx";
import Toggle from "./Toggle.jsx";
import { importCandidateFile } from "./candidateImport.js";

const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
const a1Boundary = "本报告仅涵盖 A1–A3 材料生产；运输、施工与运营需在各自工作流核算。工程量、因子来源、分母单位和产品适用性仍需人工核验。";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const hasCost = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0;

function downloadReport({ project, stats, optimized, result, fileName, selectedCount }) {
  const rows = stats.rows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${number.format(row.emission / 1000)}</td><td>${stats.total ? number.format(row.emission / stats.total * 100) : 0}%</td><td>${escapeHtml(row.source)}</td><td>${hasCost(row.cost) ? `${number.format(row.cost)} 元/${escapeHtml(row.unit)}` : "未填"}</td></tr>`).join("");
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${escapeHtml(project.name)} A1–A3 材料报告</title><style>body{max-width:900px;margin:40px auto;padding:0 24px;font:15px/1.7 system-ui,sans-serif;color:#214637}h1{color:#18593d}small{color:#6c8c77}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #dbe9df;text-align:left}.metrics{display:flex;gap:16px;flex-wrap:wrap}.metrics b{padding:14px;background:#eef8f1;border-radius:8px}p{white-space:pre-wrap}</style><h1>${escapeHtml(project.name)} · A1–A3 材料生产</h1><small>源文件：${escapeHtml(fileName)} · 建筑面积：${number.format(project.area)} m² · 生成时间：${escapeHtml(new Date().toLocaleString("zh-CN"))}</small><div class="metrics"><b>基准 ${number.format(stats.tonnes)} tCO₂e</b><b>强度 ${number.format(stats.intensity)} kgCO₂e/m²</b><b>${selectedCount ? `已选方案 ${number.format(optimized.total / 1000)} tCO₂e` : "未选择候选方案"}</b><b>${optimized.costDelta === null || optimized.costDelta === undefined ? "成本待补" : `方案成本 ${optimized.costDelta >= 0 ? "+" : "−"}${number.format(Math.abs(optimized.costDelta))} 元`}</b></div><h2>材料排放构成</h2><table><thead><tr><th>材料</th><th>tCO₂e</th><th>占比</th><th>因子来源</th><th>成本单价</th></tr></thead><tbody>${rows}</tbody></table><h2>分析摘要</h2><p>${escapeHtml(result?.summary || "模型分析未完成")}</p><h2>结论边界</h2><p>${escapeHtml(a1Boundary)} 候选方案只比较同用量、同单位的碳因子；产品性能、价格和可采购性需另行核验。</p></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.name || "项目"}-A1-A3-材料报告.html`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function MaterialLedger({ stats, updateMaterial }) {
  const [libraryError, setLibraryError] = useState("");
  const [pickerFor, setPickerFor] = useState(null);
  const pickFactor = (row) => { setLibraryError(""); setPickerFor({ id: row.id, unit: row.unit, name: row.name }); };
  const applyEntry = (entry) => {
    const target = pickerFor;
    setPickerFor(null);
    if (!target) return;
    if (String(target.unit).trim() !== String(entry.unit).trim()) {
      setLibraryError(`“${entry.name}”的因子单位是 ${entry.unit}，与材料“${target.name}”的单位「${target.unit}」不同，不能直接填入；请先统一单位或换算后再录入。`);
      return;
    }
    setLibraryError("");
    updateMaterial(target.id, { factor: entry.factor, source: entry.source });
  };
  const editCost = (row, text) => {
    const value = String(text ?? "").trim();
    if (value === "") { updateMaterial(row.id, { cost: "" }); return; }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    updateMaterial(row.id, { cost: parsed });
  };
  return <details className="cw-ledger" aria-label="材料清单核对">
    <summary><LibraryBig size={15}/> 材料清单核对（{stats.rows.length} 项）<span>可修改数量之外的因子、成本与来源；修改后立即重新计算</span></summary>
    <div className="cw-ledger-table"><table>
      <thead><tr><th>材料</th><th>构件</th><th>数量</th><th>单位</th><th>碳因子</th><th>成本单价（元）</th><th>因子来源</th><th>因子库</th></tr></thead>
      <tbody>{stats.rows.map((row) => <tr key={row.id}>
        <td><b>{row.name}</b><small>{row.id}</small></td>
        <td>{row.part}</td>
        <td>{number.format(row.quantity)}</td>
        <td>{row.unit}</td>
        <td><input type="number" min="0" step="any" value={row.factor} onChange={(event) => { const parsed = Number(event.target.value); if (event.target.value !== "" && (!Number.isFinite(parsed) || parsed <= 0)) return; updateMaterial(row.id, { factor: parsed }); }} aria-label={`${row.name} 的碳因子`}/></td>
        <td><input type="number" min="0" step="any" value={row.cost ?? ""} placeholder="选填" onChange={(event) => editCost(row, event.target.value)} aria-label={`${row.name} 的成本单价`}/></td>
        <td><input type="text" value={row.source} onChange={(event) => updateMaterial(row.id, { source: event.target.value })} aria-label={`${row.name} 的因子来源`}/></td>
        <td><button type="button" className="cw-ledger-pick" onClick={() => pickFactor(row)} title={`为“${row.name}”从因子库选用`}><BookOpen size={14}/> 选用</button></td>
      </tr>)}</tbody>
    </table></div>
    {libraryError && <p className="cw-ledger-error" role="alert">{libraryError}</p>}
    <p className="cw-ledger-note">因子库数值为公开参考值；来源已填写不代表因子适用性已核实，正式核算请以标准原文或产品 EPD 为准。成本单价为可选字段。</p>
    <FactorPicker open={Boolean(pickerFor)} category="material" title={`为“${pickerFor?.name || ""}”选用因子`} hint={`材料单位「${pickerFor?.unit || ""}」——只显示建材类因子，且单位一致才能填入。`} onSelect={applyEntry} onClose={() => setPickerFor(null)}/>
  </details>;
}

function guessMaterialId(row, materialRows) {
  const match = materialRows.find((item) => item.name === row.name)
    || materialRows.find((item) => item.name.includes(row.name) || row.name.includes(item.name));
  return match?.id || materialRows[0]?.id || "";
}

function CandidateImportPreview({ preview, stats, onConfirm, onCancel }) {
  const [links, setLinks] = useState(() => Object.fromEntries(preview.rows.map((row, index) => [index, guessMaterialId(row, stats.rows)])));
  const [errors, setErrors] = useState([]);
  const confirm = () => {
    const problems = [];
    const accepted = [];
    preview.rows.forEach((row, index) => {
      const material = stats.rows.find((item) => item.id === links[index]);
      if (!material) { problems.push(`“${row.name}”未指定对应的清单材料。`); return; }
      if (row.unit && material.unit && String(row.unit).trim() !== String(material.unit).trim()) {
        problems.push(`“${row.name}”的单位（${row.unit}）与“${material.name}”的单位（${material.unit}）不一致，已跳过；请先换算。`);
        return;
      }
      accepted.push({ row, material });
    });
    if (accepted.length) onConfirm(accepted, problems);
    else setErrors(problems.length ? problems : ["没有可导入的候选行。"]);
  };
  return <section className="cw-import-preview" aria-label="候选导入预览">
    <h2>核对候选导入结果</h2>
    <p>{preview.recognizedBy === "model" ? "本地未能识别，已由模型从文本中定位字段。数值仍以你核对为准，共" : "已在本地读取文件，共"}识别 {preview.rows.length} 条候选。请为每条指定对应的清单材料（同单位比较）。</p>
    <div className="cw-import-table"><table><thead><tr><th>候选名称</th><th>单位</th><th>碳因子</th><th>成本单价</th><th>来源</th><th>规格</th><th>对应清单材料</th></tr></thead><tbody>{preview.rows.map((row, index) => {
      const linked = stats.rows.find((item) => item.id === links[index]);
      const unitConflict = row.unit && linked && String(row.unit).trim() !== String(linked.unit).trim();
      return <tr key={index} className={unitConflict ? "cw-import-conflict" : ""}>
        <td>{row.name}</td>
        <td>{row.unit || "—"}</td>
        <td>{row.factor}</td>
        <td>{row.cost === "" ? "未提供" : `${money.format(row.cost)} 元`}</td>
        <td>{row.source || "未提供"}</td>
        <td>{row.specification || "—"}</td>
        <td><select value={links[index]} onChange={(event) => setLinks((current) => ({ ...current, [index]: event.target.value }))} aria-label={`“${row.name}”对应的清单材料`}>{stats.rows.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.unit}</option>)}</select>{unitConflict && <small className="cw-import-warn">单位与所选材料不一致</small>}</td>
      </tr>;
    })}</tbody></table></div>
    {preview.issues.length > 0 && <div className="cw-import-issues"><b>{preview.issues.length} 条提示</b>{preview.issues.slice(0, 5).map((issue, index) => <p key={index}>{issue}</p>)}</div>}
    {errors.length > 0 && <div className="cw-import-issues"><b>无法确认</b>{errors.map((issue, index) => <p key={index}>{issue}</p>)}</div>}
    <p>模型识别只转录文档中已有的数值，不会推测缺失内容；确认后候选保存在本机浏览器中。</p>
    <div className="cw-import-actions"><button type="button" onClick={onCancel}>取消</button><button type="button" onClick={confirm} disabled={!preview.rows.length}>确认导入</button></div>
  </section>;
}

export default function WorkflowDeliverables({ project, stats, optimized, agentEvidence, result, fileName, selectedCandidates, setSelectedCandidates, addCandidate, updateMaterial, aiConfig }) {
  const [adding, setAdding] = useState(false);
  const [candidateDraft, setCandidateDraft] = useState({ materialId: stats.rows[0]?.id || "", name: "", factor: "", cost: "", source: "", specification: "" });
  const [candidateError, setCandidateError] = useState("");
  const [candidatePicker, setCandidatePicker] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const [allowModel, setAllowModel] = useState(false);
  const fileRef = React.useRef(null);
  const draft = agentEvidence.draft_optimization;
  const selectedCount = Object.values(selectedCandidates).filter(Boolean).length;
  const candidates = draft.candidates.slice(0, 6);
  const maxReduction = Math.max(0, ...candidates.map((item) => item.estimated_reduction_kg));
  const rowsMissingCost = stats.rows.filter((row) => !hasCost(row.cost)).length;
  const applyDraft = () => setSelectedCandidates((current) => ({ ...current, ...Object.fromEntries(draft.candidates.map((item) => [item.material_id, item.candidate_id])) }));
  const draftMaterial = stats.rows.find((item) => item.id === candidateDraft.materialId) || stats.rows[0];
  const marginalCost = optimized.reduction > 0 && optimized.costDelta !== null && optimized.costDelta !== undefined
    ? optimized.costDelta / (optimized.reduction / 1000)
    : null;
  const applyLibraryCandidate = (entry) => {
    if (!draftMaterial) return;
    setCandidatePicker(false);
    if (String(draftMaterial.unit).trim() !== String(entry.unit).trim()) {
      setCandidateError(`“${entry.name}”的因子单位是 ${entry.unit}，与材料“${draftMaterial.name}”的单位「${draftMaterial.unit}」不同；候选比较要求同单位，请先换算。`);
      return;
    }
    setCandidateError("");
    setCandidateDraft((current) => ({
      ...current,
      name: current.name.trim() || entry.name,
      factor: String(entry.factor),
      source: current.source.trim() || entry.source,
    }));
  };
  const saveCandidate = (event) => {
    event.preventDefault();
    const material = stats.rows.find((item) => item.id === candidateDraft.materialId);
    const factor = Number(candidateDraft.factor);
    const cost = candidateDraft.cost === "" ? "" : Number(candidateDraft.cost);
    if (!material || !candidateDraft.name.trim() || !candidateDraft.source.trim() || !candidateDraft.specification.trim() || !Number.isFinite(factor) || factor <= 0
      || (candidateDraft.cost !== "" && (!Number.isFinite(cost) || cost < 0))) { setCandidateError("请填写候选名称、同单位碳因子、规格和因子来源；成本单价可选。"); return; }
    addCandidate({ materialId: material.id, name: candidateDraft.name.trim(), factor, cost, source: candidateDraft.source.trim(), specification: candidateDraft.specification.trim() });
    setCandidateDraft({ materialId: material.id, name: "", factor: "", cost: "", source: "", specification: "" });
    setCandidateError(""); setAdding(false);
  };
  const handleImportFile = async (file) => {
    if (!file) return;
    setImportBusy(true); setImportError(""); setImportNotice("");
    try {
      const preview = await importCandidateFile(file, aiConfig, allowModel);
      if (preview.rows.length) setImportPreview(preview);
      else setImportError(`未能从“${file.name}”识别出候选材料：${preview.issues[0] || "未找到候选名称和碳因子"}${preview.issues.length > 1 ? `（另有 ${preview.issues.length - 1} 条提示）` : ""}`);
    } catch (error) {
      setImportError(`导入失败：${error.message}`);
    } finally { setImportBusy(false); }
  };
  const confirmImport = (accepted, problems) => {
    accepted.forEach(({ row, material }) => {
      addCandidate({
        materialId: material.id,
        name: row.name,
        factor: row.factor,
        cost: row.cost,
        source: row.source || "未提供来源",
        specification: row.specification || "导入文件未注明规格",
      });
    });
    setImportPreview(null);
    setImportNotice(`已导入 ${accepted.length} 条候选并保存在本机浏览器${problems.length ? `；${problems.length} 条被跳过` : ""}。`);
    if (problems.length) setImportError(problems.join(" "));
  };

  return <section className="cw-deliverables" aria-label="A1 到 A3 材料交付成果">
    <div className="cw-section-head"><div><small>DELIVERABLES · A1–A3</small><h2>材料分析成果</h2></div><span className="cw-status done">随清单更新</span></div>
    <div className="cw-delivery-body">
      {updateMaterial && <MaterialLedger stats={stats} updateMaterial={updateMaterial}/>}
      <div className="cw-scenario-grid"><div><small>当前基准</small><strong>{number.format(stats.tonnes)} <em>tCO₂e</em></strong></div><div><small>{selectedCount ? `已选 ${selectedCount} 项候选` : "尚未选择候选"}</small><strong>{number.format(optimized.total / 1000)} <em>tCO₂e</em></strong></div><div className="cw-scenario-delta"><small>相对基准变化</small><strong>{selectedCount ? `${optimized.reduction >= 0 ? "−" : "+"}${number.format(Math.abs(optimized.reduction / 1000))}` : "—"} <em>{selectedCount ? "tCO₂e" : ""}</em></strong></div><div><small>方案成本变化</small><strong>{selectedCount ? (optimized.costDelta === null || optimized.costDelta === undefined ? <em>待补成本</em> : <>{optimized.costDelta >= 0 ? "+" : "−"}{money.format(Math.abs(optimized.costDelta))} <em>元</em></>) : "—"}</strong>{selectedCount && marginalCost !== null && <small>减排成本约 {money.format(Math.abs(marginalCost))} 元/tCO₂e{marginalCost <= 0 ? "（降碳同时省钱）" : ""}</small>}</div></div>
      {rowsMissingCost > 0 && <p className="cw-cost-notice" role="status">提醒：{rowsMissingCost} 项基准材料未填成本单价，成本相关结论暂时缺失；排放核算不受影响，分析会继续。可在上方“材料清单核对”中补充。</p>}
      <div className="a1-scenario-track" role="img" aria-label="基准清单与已选候选方案排放对比"><div><span>基准</span><i><b style={{ width: "100%" }}/></i><strong>{number.format(stats.tonnes)}</strong></div><div><span>已选方案</span><i><b style={{ width: `${stats.total ? Math.min(100, Math.max(0, optimized.total / stats.total * 100)) : 0}%` }}/></i><strong>{number.format(optimized.total / 1000)}</strong></div></div>
      <div className="a1-chart-head"><div><small>SAME-QUANTITY COMPARISON</small><h3>候选材料的估计变化</h3></div><span>单位：tCO₂e</span></div>
      {candidates.length ? <><div className="a1-candidate-bars">{candidates.map((item) => <button className={selectedCandidates[item.material_id] === item.candidate_id ? "selected" : ""} key={item.candidate_id} onClick={() => setSelectedCandidates((current) => ({ ...current, [item.material_id]: current[item.material_id] === item.candidate_id ? "" : item.candidate_id }))} aria-pressed={selectedCandidates[item.material_id] === item.candidate_id}>
        <span>{item.material} → {item.candidate}{item.cost_delta !== null && item.cost_delta !== undefined && <small> · 成本 {item.cost_delta >= 0 ? "+" : "−"}{money.format(Math.abs(item.cost_delta))} 元</small>}</span><i><b style={{ width: `${maxReduction ? Math.min(100, Math.max(0, item.estimated_reduction_kg / maxReduction * 100)) : 0}%` }}/></i><strong>{item.estimated_reduction_kg >= 0 ? "−" : "+"}{number.format(Math.abs(item.estimated_reduction_kg / 1000))}</strong>{selectedCandidates[item.material_id] === item.candidate_id && <Check size={15}/>}</button>)}</div><button className="cw-primary-small" onClick={applyDraft}>选入全部候选</button></> : <div className="cw-empty-action"><p>暂无同单位、可比较的候选材料。可导入候选文件（PDF / Word / Excel / CSV）或手动录入，录入后可计算估计变化。</p></div>}
      <div className="cw-candidate-actions">
        <button className="cw-primary-small a1-add-candidate" onClick={() => { setCandidateError(""); setAdding((value) => !value); }}><Plus size={15}/> {adding ? "收起录入" : "录入候选材料"}</button>
        <button className="cw-primary-small" onClick={() => fileRef.current?.click()} disabled={importBusy}><FileUp size={15}/> {importBusy ? "正在解析…" : "导入候选文件"}</button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.docx,.pdf,.txt" hidden onChange={(event) => { handleImportFile(event.target.files?.[0]); event.target.value = ""; }}/>
      </div>
      <Toggle checked={allowModel} onChange={setAllowModel} label="启动AI分析服务">若本地解析不出候选（常见于扫描版 PDF 或排版复杂的 Word），允许把文档文本预览（前 4000 字符）发送至当前模型服务{aiConfig?.baseUrl ? `（${aiConfig.baseUrl}）` : ""}用于定位字段；开关关闭时仅做本地解析。模型只转录已有数值，不会推测。</Toggle>
      {importError && <p className="cw-ledger-error" role="alert">{importError}</p>}
      {importNotice && <p className="cw-import-notice" role="status">{importNotice}</p>}
      {importPreview && <CandidateImportPreview preview={importPreview} stats={stats} onConfirm={confirmImport} onCancel={() => setImportPreview(null)}/>}
      {adding && <form className="cw-candidate-form" onSubmit={saveCandidate}><label>对应材料<select value={candidateDraft.materialId} onChange={(event) => setCandidateDraft((current) => ({ ...current, materialId: event.target.value }))}>{stats.rows.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>候选产品名称<input value={candidateDraft.name} onChange={(event) => setCandidateDraft((current) => ({ ...current, name: event.target.value }))}/></label><label>同单位碳因子<span className="cw-field-with-picker"><input type="number" min="0" step="any" value={candidateDraft.factor} onChange={(event) => setCandidateDraft((current) => ({ ...current, factor: event.target.value }))}/><button type="button" className="cw-ledger-pick" onClick={() => { setCandidateError(""); setCandidatePicker(true); }} title="从因子库选用参考值"><BookOpen size={14}/> 因子库</button></span>{draftMaterial && <small>基准材料“{draftMaterial.name}”的单位是「{draftMaterial.unit}」，因子必须同单位。</small>}</label><label>成本单价（元/{draftMaterial?.unit || "单位"}，可选）<input type="number" min="0" step="any" value={candidateDraft.cost} placeholder="留空则成本结论缺失" onChange={(event) => setCandidateDraft((current) => ({ ...current, cost: event.target.value }))}/></label><label>关键规格<input value={candidateDraft.specification} onChange={(event) => setCandidateDraft((current) => ({ ...current, specification: event.target.value }))}/></label><label>因子来源<input value={candidateDraft.source} onChange={(event) => setCandidateDraft((current) => ({ ...current, source: event.target.value }))}/></label>{candidateError && <p role="alert">{candidateError}</p>}<button className="cw-primary-small" type="submit">录入并重新筛选</button></form>}
      <p className="cw-limitation">候选变化仅按当前用量和同单位因子估计；规格、性能、价格、来源及采购条件仍须核验。</p>
    </div>
    <div className="cw-delivery-body cw-report-preview"><div className="cw-report-top"><div><small>PROJECT REPORT</small><h3>{project.name} · A1–A3 材料报告</h3><p>源文件：{fileName}</p></div><button className="cw-primary-small" onClick={() => downloadReport({ project, stats, optimized, result, fileName, selectedCount })}><Download size={15}/> 下载 HTML 报告</button></div><div className="cw-report-facts"><span>材料生产：<b>{number.format(stats.tonnes)} tCO₂e</b></span><span>排放强度：<b>{number.format(stats.intensity)} kgCO₂e/m²</b></span><span>清单：<b>{stats.rows.length} 项</b></span><span>已填成本：<b>{stats.rows.length - rowsMissingCost}/{stats.rows.length} 项</b></span></div><details className="cw-analysis-details"><summary>查看报告摘要与结论边界</summary><p>{result?.summary || "模型分析尚未完成；可先查看本地核算结果。"}</p><p>{a1Boundary}</p></details></div>
    <FactorPicker open={candidatePicker} category="material" title="为候选产品选用因子" hint={draftMaterial ? `基准材料“${draftMaterial.name}”的单位是「${draftMaterial.unit}」；只有同单位因子可直接填入。` : undefined} onSelect={applyLibraryCandidate} onClose={() => setCandidatePicker(false)}/>
  </section>;
}
