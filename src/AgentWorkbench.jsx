import React, { useEffect, useRef, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";
import { ArrowUp, Check, FileSpreadsheet, Leaf, Paperclip, Settings2, ShieldCheck, Sparkles } from "lucide-react";
import WorkflowDeliverables from "./WorkflowDeliverables.jsx";
import "./agent-workbench.css";

const fmt = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });

function Orb({ state = "working", size = 20 }) {
  const label = { breathing: "等待项目数据", searching: "正在读取文件", connecting: "正在连接模型", composing: "正在生成回答", solving: "正在核算数据", weaving: "正在整理方案", working: "正在分析项目" }[state] || "项目状态";
  return <ThinkingOrb state={state} size={size} theme="light" className="cw-green-orb" aria-label={label}/>;
}

function Stage({ label, detail, state, orb }) {
  return <li className={`cw-stage ${state}`}><span className="cw-stage-mark">{state === "active" ? <Orb state={orb}/> : state === "done" ? <Check size={15}/> : <span/>}</span><span><b>{label}</b><small>{detail}</small></span></li>;
}

function ImportPreview({ pending, setPending, confirm, cancel }) {
  const rows = pending.parsed.slice(0, 8);
  return <section className="cw-import-preview" aria-label="导入识别预览">
    <h2>核对导入结果</h2>
    <p>{pending.recognition ? `模型定位了“${pending.recognition.sheet}”第 ${pending.recognition.headerRow} 行的表头。` : "已按已知表头读取材料清单。"} 共识别 {pending.parsed.length} 项材料。模型只识别字段，排放量由程序计算。</p>
    <div className="cw-import-table"><table><thead><tr><th>材料</th><th>数量</th><th>单位</th><th>碳因子</th><th>来源</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.quantity}</td><td>{row.unit}</td><td>{row.factor}</td><td>{row.source}</td></tr>)}</tbody></table></div>
    {pending.parsed.length > rows.length && <small>仅预览前 {rows.length} 项；确认后可在材料清单查看全部数据。</small>}
    {pending.recognition?.issues.length > 0 && <div className="cw-import-issues"><b>{pending.recognition.issues.length} 行未纳入计算</b>{pending.recognition.issues.slice(0, 5).map((issue, index) => <p key={index}>{issue}</p>)}</div>}
    {!pending.bundle?.project && <label>建筑面积（m²，文件未可靠提供，须人工填写）<input type="number" min="1" step="any" value={pending.area} onChange={(event) => setPending((current) => ({ ...current, area: event.target.value }))}/></label>}
    <p>请核对材料、数量、单位、因子及来源。缺失或不适用的因子不会由模型补造。</p>
    <div className="cw-import-actions"><button type="button" onClick={cancel}>取消</button><button type="button" onClick={confirm} disabled={!pending.bundle?.project && !(Number(pending.area) > 0)}>确认并计算</button></div>
  </section>;
}

function AuditPanel({ run, reopenFile }) {
  if (!run) return null;
  const issues = run.audit.issues;
  return <section className="cw-audit-panel" aria-label="数据审查结果">
    <div className="cw-audit-head"><div><small>DATA AUDIT SKILL</small><h2>材料清单核查</h2></div><span>{issues.length ? `${issues.length} 项待核对` : "基础检查完成"}</span></div>
    <p>已执行材料审查和本地核算工具。{run.nextAction === "correct_input" ? "存在阻断项，核算已暂停。" : run.nextAction === "review_evidence" ? "核算已完成，但以下证据仍需确认。" : "未发现自动规则可定位的问题。"}</p>
    <div className="cw-audit-trace">{run.trace.map((step) => <span key={step.tool}>{step.tool === "audit_materials" ? "审查材料" : "计算阶段排放"}：{step.status === "completed" ? "已完成" : "因输入无效暂停"}</span>)}</div>
    {issues.length > 0 && <ol>{issues.slice(0, 6).map((issue, index) => <li key={`${issue.rowId}-${issue.code}-${index}`}><b>{issue.message}</b><small>{issue.location}</small><p>{issue.action}</p></li>)}</ol>}
    {issues.length > 6 && <small>另有 {issues.length - 6} 项，请在原清单中继续核对。</small>}
    <p className="cw-audit-limit">{run.audit.limitations[0]}</p>
    {issues.length > 0 && <button type="button" onClick={reopenFile}>修正原文件后重新上传</button>}
  </section>;
}

export default function AgentWorkbench({
  project, setProject, stats, optimized, fileName, notice, isReference, importFile, importBusy,
  pendingImport, setPendingImport, confirmImport, cancelImport,
  agentEvidence, auditRun, agentRun, agentBusy, agentStage, agentError, selectedCandidates,
  rerunAgent,
  setSelectedCandidates, addCandidate, aiConfig, openSetup, transportResult, siteResult, operationResult,
  messages, ask, aiBusy,
}) {
  const inputRef = useRef(null);
  const threadEndRef = useRef(null);
  const [prompt, setPrompt] = useState("");
  const [dragging, setDragging] = useState(false);
  const result = agentRun?.result;
  const draft = agentEvidence?.draft_optimization;
  const chat = messages.filter((message) => message.role !== "system" && message.text);
  useEffect(() => { if (chat.length) threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [chat.length]);

  const submit = () => {
    const question = prompt.trim();
    if (!question || isReference || agentBusy || aiBusy) return;
    setPrompt("");
    ask(question);
  };
  const dropFile = (file) => { if (file) importFile(file); };
  const stageIndex = agentStage === "reading" ? 0 : agentStage === "calculating" ? 1 : agentStage === "connecting" || agentStage === "analyzing" ? 2 : agentStage === "complete" || agentStage === "error" ? 4 : 0;
  const stageState = (index) => index < stageIndex ? "done" : index === stageIndex && (agentBusy || importBusy) ? "active" : index <= stageIndex && !agentBusy && !importBusy ? "done" : "waiting";

  return <div className="cw-page">
    <header className="cw-topbar">
      <div className="cw-brand"><span><Leaf size={18}/></span><b>CarbonIQ</b><small>建筑碳排放分析</small></div>
      <div className="cw-top-actions"><span className="cw-model"><i/> {aiConfig.model}</span><button className="cw-icon-button" onClick={openSetup} aria-label="模型设置"><Settings2 size={18}/></button></div>
    </header>
    <main className={`cw-main ${isReference ? "cw-main-empty" : "cw-main-thread"}`}>
      <input ref={inputRef} type="file" accept=".csv,.xlsx" hidden onChange={(event) => { dropFile(event.target.files?.[0]); event.target.value = ""; }}/>
      {pendingImport && <ImportPreview pending={pendingImport} setPending={setPendingImport} confirm={confirmImport} cancel={cancelImport}/>}
      {!isReference && <AuditPanel run={auditRun} reopenFile={() => inputRef.current?.click()}/>}
      {isReference ? <section className="cw-onboard" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); dropFile(event.dataTransfer.files?.[0]); }}>
        <div className="cw-onboard-orb"><Orb state={importBusy ? "searching" : "breathing"} size={64}/></div>
        <span className="cw-kicker">CARBONIQ · PROJECT AGENT</span>
        <h1>上传项目数据，开始自动分析</h1>
        <p>Agent 将读取清单与项目参数，按建筑用途、尺寸和楼层生成不同的 3D 体量示意，并完成核算、建议与报告。Excel 可在“项目参数”表填写建筑类型。</p>
        <button className={`cw-upload-zone ${dragging ? "dragging" : ""}`} onClick={() => inputRef.current?.click()} disabled={importBusy}><FileSpreadsheet size={24}/><span><b>{importBusy ? "正在读取文件…" : "选择材料清单或拖到这里"}</b><small>支持 CSV / XLSX · 最大 10 MB</small></span><Paperclip size={17}/></button>
        <small className="cw-onboard-notice" role="status">{notice}</small>
      </section> : <>
        <div className="cw-session-head"><div><span className="cw-kicker">PROJECT SESSION</span><h1>{project.name}</h1><p>自动工作流已由文件上传触发。后续问题会接在本次分析下方。</p>{notice.startsWith("导入失败") && <p className="cw-error" role="alert">{notice}</p>}</div><button onClick={() => inputRef.current?.click()}><Paperclip size={16}/> 更换文件</button></div>
        <div className="cw-thread" aria-live="polite">
          <div className="cw-turn user"><span className="cw-turn-label">你 · 已上传文件</span><div className="cw-user-bubble"><FileSpreadsheet size={18}/><span>{fileName}</span></div></div>
          <div className="cw-turn assistant"><div className="cw-assistant-avatar"><Orb state={agentBusy ? agentStage === "connecting" ? "connecting" : "solving" : "breathing"}/></div><div className="cw-assistant-content"><span className="cw-turn-label">CarbonIQ Agent · 项目工作流</span>
            <div className="cw-agent-card"><div className="cw-agent-card-title"><div><small>LIVE WORKFLOW</small><h2>{agentBusy ? "正在分析项目" : agentError ? "已完成本地核算，模型建议待重试" : "项目分析已完成"}</h2></div><span className={`cw-status ${agentBusy ? "running" : agentError ? "partial" : "done"}`}>{agentBusy ? "执行中" : agentError ? "部分完成" : "已完成"}</span></div>
              <ol className="cw-stage-list">
                <Stage label="读取材料清单" detail={`${stats.rows.length} 条材料已导入`} state={stageState(0)} orb="searching"/>
                <Stage label="核算与数据检查" detail={`A1–A3：${fmt.format(stats.tonnes)} tCO₂e；热点与缺口已整理`} state={stageState(1)} orb="solving"/>
                <Stage label="请求模型分析" detail={agentStage === "connecting" ? "正在连接已配置的模型" : agentBusy ? "模型正在处理项目摘要" : agentError ? "模型未返回可用建议" : "已收到模型结果"} state={agentError ? "error" : stageState(2)} orb={agentStage === "connecting" ? "connecting" : "working"}/>
                <Stage label="筛选候选方案" detail={draft?.candidates.length ? `找到 ${draft.candidates.length} 项可比较候选` : "目前没有已录入的可比候选"} state={stageState(3)} orb="weaving"/>
                <Stage label="整理交付成果" detail="3D 概念预览与可下载报告" state={stageState(4)} orb="composing"/>
              </ol>
              <p className="cw-process-note">这里显示实际执行步骤和可核对的数据，不展示模型的内部推理文本。</p>
            </div>
            {agentError && <p className="cw-error" role="status">模型建议未完成：{agentError}。以下保留本地核算结果。<button type="button" onClick={() => rerunAgent()} disabled={agentBusy}>重新分析</button></p>}
            {agentBusy && <div className="cw-thinking"><Orb state={agentStage === "connecting" ? "connecting" : "solving"} size={64}/><div><b>{agentStage === "connecting" ? "正在连接模型" : "模型正在分析材料热点和数据缺口"}</b><small>收到回答后会在这里继续生成建议和成果</small></div></div>}
            {!agentBusy && result && <><div className="cw-analysis-bubble"><span>{result.mode === "local" ? "本地核算结果" : "模型分析 · 基于项目数据"}</span><p>{result.summary}</p><div className="cw-core-metrics"><div><small>A1–A3</small><b>{fmt.format(stats.tonnes)} tCO₂e</b></div><div><small>A4 / A5</small><b>{transportResult.hasData ? fmt.format(transportResult.kg / 1000) : "—"} / {siteResult.hasData ? fmt.format(siteResult.kg / 1000) : "—"} tCO₂e</b></div><div><small>B6 年度</small><b>{operationResult.annualKg !== null ? fmt.format(operationResult.annualKg / 1000) : "—"} tCO₂e/年</b></div></div>
                <div className="cw-analysis-grid"><div><h3>关键发现</h3>{result.findings.map((item, index) => <article key={index}><b>{item.title}</b><p>{item.detail}</p>{item.evidence && <small>{item.evidence}</small>}</article>)}</div><div><h3>下一步建议</h3>{result.actions.map((item, index) => <article key={index}><b>{item.title}</b><p>{item.reason}</p>{item.data_needed && <small>需补充：{item.data_needed}</small>}</article>)}</div></div>
              </div><WorkflowDeliverables project={project} setProject={setProject} stats={stats} optimized={optimized} agentEvidence={agentEvidence} result={result} fileName={fileName} selectedCandidates={selectedCandidates} setSelectedCandidates={setSelectedCandidates} addCandidate={addCandidate} transportResult={transportResult} siteResult={siteResult} operationResult={operationResult}/></>}
          </div></div>
          {chat.map((message, index) => <div className={`cw-turn ${message.role === "user" ? "user" : "assistant"}`} key={`${index}-${message.role}`}><span className="cw-turn-label">{message.role === "user" ? "你" : message.role === "status" ? "连接状态" : "CarbonIQ Agent"}</span>{message.role === "user" ? <div className="cw-user-bubble text">{message.text}</div> : <div className={`cw-chat-reply ${message.role === "status" ? "error" : ""}`}><p>{message.text}</p></div>}</div>)}
          {aiBusy && <div className="cw-turn assistant"><div className="cw-assistant-avatar"><Orb state="composing"/></div><div className="cw-chat-reply pending"><Orb state="composing" size={64}/><span>正在结合当前项目数据回复…</span></div></div>}
          <div ref={threadEndRef}/>
        </div>
        <section className="cw-chat-composer" aria-label="继续提问"><div className="cw-chat-composer-head"><Sparkles size={16}/><b>继续与项目 Agent 对话</b><span>会参考当前清单与已选方案</span></div><textarea aria-label="输入后续问题" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：哪些材料值得优先替换？缺少哪些证据？" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }}/><div className="cw-chat-composer-bottom"><span>Enter 发送 · Shift + Enter 换行</span><button onClick={submit} disabled={!prompt.trim() || agentBusy || aiBusy}>发送 <ArrowUp size={16}/></button></div></section>
        <div className="cw-assumptions"><div><b>项目参数</b><small>清单可能不含面积；请核对示例默认值。</small></div><label>项目名称<input value={project.name} onChange={(event) => setProject((current) => ({ ...current, name: event.target.value }))}/></label><label>建筑面积 m²<input type="number" min="1" value={project.area} onChange={(event) => { const value = Number(event.target.value); if (value > 0) setProject((current) => ({ ...current, area: value })); }}/></label><label>示意楼层<input type="number" min="1" max="30" value={project.floors} onChange={(event) => { const value = Number(event.target.value); if (value >= 1 && value <= 30) setProject((current) => ({ ...current, floors: value })); }}/></label></div>
      </>}
      <footer className="cw-footer"><ShieldCheck size={15}/> 模型建议不能替代产品 EPD、造价和工程适用性审查。</footer>
    </main>
  </div>;
}
