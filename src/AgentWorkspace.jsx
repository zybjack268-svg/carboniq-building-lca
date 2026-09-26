import React, { useRef, useState } from "react";
import { ArrowRight, Bot, CheckCircle2, ChevronRight, Eye, EyeOff, FileSpreadsheet, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, Upload } from "lucide-react";
import "./agent.css";
import "./agent-draft.css";
import { hasModelConfig } from "./advisorEngine.js";

const fmt = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });

export function ModelSetup({ config, update, connection, busy, test, enter }) {
  const [showKey, setShowKey] = useState(false);
  const complete = hasModelConfig(config);
  const submit = async (event) => {
    event.preventDefault();
    if (await test()) enter();
  };
  if (config.serverManaged) return <main className="agent-setup"><div className="setup-glow"/><div className="setup-content"><section className="setup-copy"><span className="agent-eyebrow">LOCAL MODEL</span><h1>本机模型已配置</h1><p>模型 ID：{config.model}。API Key 保存在启动服务的电脑上，浏览器只保存访问状态。</p></section><div className="setup-card"><div className="setup-card-head"><span><Bot size={21}/></span><div><small>MODEL CONNECTION</small><h2>本机模型服务</h2></div></div><p className={`setup-status ${connection.status}`} role="status">{connection.message}</p><button className="setup-submit" type="button" disabled={busy} onClick={async () => { if (await test()) enter(); }}>{busy ? "正在验证…" : "测试连接并进入工作台"}</button><p className="setup-privacy">{config.desktop ? "需要更换 Base URL、API Key 或模型时，请使用桌面应用的“模型配置”菜单。" : "需要更换 Base URL、API Key 或模型时，请编辑本机 .local/config.json 并重新启动服务。"}</p></div></div></main>;
  return <main className="agent-setup">
    <div className="setup-glow" />
    <header><span className="setup-brand"><i>◈</i> CarbonIQ</span><span>01 / 建立分析连接</span></header>
    <div className="setup-content">
      <section className="setup-copy">
        <span className="agent-eyebrow"><Sparkles size={15}/> AI ANALYSIS WORKSPACE</span>
        <h1>让项目数据<br/><em>自己开始说话。</em></h1>
        <p>连接你的模型后，上传材料清单。系统会先执行可复核的计算与数据检查，再让模型给出判断、优化方向和下一步任务。</p>
        <ol><li><b>01</b> 接入模型</li><li><b>02</b> 导入工程数据</li><li><b>03</b> 自动生成分析任务</li></ol>
      </section>
      <form className="setup-card" onSubmit={submit}>
        <div className="setup-card-head"><span><Bot size={21}/></span><div><small>MODEL CONNECTION</small><h2>配置分析模型</h2></div></div>
        <label>Base URL<input type="url" value={config.baseUrl} onChange={(e)=>update("baseUrl",e.target.value)} placeholder="https://provider.example/v1" autoComplete="url" spellCheck="false" required disabled={busy}/></label>
        <label>模型名称<input value={config.model} onChange={(e)=>update("model",e.target.value)} placeholder="输入可用的模型 ID" autoComplete="off" spellCheck="false" required disabled={busy}/></label>
        <label>API Key<span className="setup-secret"><input type={showKey?"text":"password"} value={config.apiKey} onChange={(e)=>update("apiKey",e.target.value)} placeholder="输入你的 API Key" autoComplete="off" spellCheck="false" required disabled={busy}/><button type="button" onClick={()=>setShowKey((v)=>!v)} aria-label={showKey?"隐藏密钥":"显示密钥"}>{showKey?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>
        <button className="setup-submit" type="submit" disabled={!complete || busy}>{busy?<><LoaderCircle className="agent-spin" size={18}/> 正在验证连接</>:<>验证并进入工作台 <ArrowRight size={18}/></>}</button>
        <p className={`setup-status ${connection.status}`} role="status">{connection.message}</p>
        <p className="setup-privacy"><ShieldCheck size={16}/> 密钥只保存在当前页面内存中。分析时会将项目摘要发送至你填写的接口，刷新页面后需重新配置。</p>
        <p className="setup-privacy"><ShieldCheck size={16}/> 非标准表格识别会将最多 12 个工作表、每表前 25 行的预览发送到你配置的模型接口。请勿上传不希望发送给该服务商的数据。</p>
      </form>
    </div>
  </main>;
}

export default function AgentWorkspace({ project, stats, fileName, isReference, importFile, agentEvidence, agentRun, agentBusy, agentError, rerunAgent, go, transportResult, operationResult, setSelectedCandidates }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const result = agentRun?.result;
  const draft = agentEvidence?.draft_optimization;
  const state = agentBusy ? "running" : agentError ? "error" : result ? "done" : "idle";
  const steps = [
    ["读取材料清单", !isReference ? "done" : "waiting", `${stats.rows.length} 条材料记录`],
    ["核算与数据检查", !isReference ? "done" : "waiting", "A1-A3 工具计算"],
    ["模型分析与任务规划", state, result ? "已生成可执行建议" : "等待模型分析"],
  ];
  const accept = (file) => { if (file) importFile(file); };
  return <div className="agent-workspace">
    <header className="agent-hero">
      <div><span className="agent-eyebrow"><Sparkles size={14}/> PROJECT AGENT / LIVE WORKSPACE</span><h1>项目分析工作台</h1><p>上传数据后自动完成核算、检查、分析和任务规划。所有排放数值由计算工具产生，模型负责解释和提出建议。</p></div>
      <div className="agent-project-badge"><small>当前项目</small><strong>{project.name}</strong><span>{isReference?"示例清单 · 待导入真实数据":"已导入数据 · 来源待核验"}</span></div>
    </header>
    <section className="agent-top-grid">
      <article className={`agent-intake ${dragging?"dragging":""}`} onDragOver={(e)=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={(e)=>{e.preventDefault();setDragging(false);accept(e.dataTransfer.files?.[0]);}}>
        <input ref={fileRef} type="file" accept=".csv,.xlsx" hidden onChange={(e)=>{accept(e.target.files?.[0]);e.target.value="";}}/>
        <div className="agent-intake-icon"><Upload size={22}/></div><div><small>START WITH YOUR DATA</small><h2>{isReference?"导入工程材料清单":"已接收材料清单"}</h2><p>{isReference?"支持 CSV / XLSX，需包含材料名称、单位、工程量及碳因子。":"更新文件后会自动重新分析；也可以编辑材料数值。"} </p></div>
        <button type="button" onClick={()=>fileRef.current?.click()}>{isReference?"选择文件":"替换文件"} <ArrowRight size={16}/></button>
        <footer><FileSpreadsheet size={15}/><span>{fileName}</span></footer>
      </article>
      <article className="agent-progress"><div className="agent-panel-heading"><small>AUTOMATION FLOW</small><span className={`agent-live-dot ${state}`}/></div><h2>任务执行</h2><ol>{steps.map(([label, status, note],i)=><li key={label} className={status}><span className="agent-step-icon">{status==="done"?<CheckCircle2 size={18}/>:status==="running"?<LoaderCircle className="agent-spin" size={18}/>:i+1}</span><div><b>{label}</b><small>{note}</small></div></li>)}</ol></article>
    </section>
    <section className="agent-metrics">
      <div><small>A1-A3 材料生产</small><strong>{fmt.format(stats.tonnes)}<em> tCO₂e</em></strong><span>{isReference?"示例值":"按导入清单计算"}</span></div>
      <div><small>单位面积排放</small><strong>{fmt.format(stats.intensity)}<em> kgCO₂e/m²</em></strong><span>仅 A1-A3 边界</span></div>
      <div><small>A4 运输</small><strong>{transportResult.hasData?fmt.format(transportResult.kg/1000):"—"}<em>{transportResult.hasData?" tCO₂e":""}</em></strong><span>单列计算，不与年度值相加</span></div>
      <div><small>B6 运营能源</small><strong>{operationResult.annualKg===null?"—":fmt.format(operationResult.annualKg/1000)}<em>{operationResult.annualKg===null?"":" tCO₂e/年"}</em></strong><span>仅已录入能源</span></div>
    </section>
    <section className="agent-draft">
      <div><span className="agent-eyebrow">AUTO OPTIMIZATION / DRAFT</span><h2>候选材料自动筛选</h2><p>{draft?.candidates.length ? `已从用户录入的候选产品中，为 ${draft.candidates.length} 项材料筛选较低因子。按原工程量估算减少 ${fmt.format(draft.estimated_reduction_kg/1000)} tCO₂e。` : "尚无可计算的候选产品。录入可比产品因子后，这里会自动形成优化草案。"} 规格、成本和供应情况仍需核验。</p></div>
      {draft?.candidates.length ? <button onClick={()=>{setSelectedCandidates((current)=>({...current,...Object.fromEntries(draft.candidates.map((item)=>[item.material_id,item.candidate_id]))}));go("simulator");}}>查看并采用草案 <ArrowRight size={16}/></button> : <button onClick={()=>go("materials")}>录入候选产品 <ArrowRight size={16}/></button>}
    </section>
    <section className="agent-output">
      <div className="agent-output-head"><div><span className="agent-eyebrow"><Bot size={15}/> AGENT REPORT</span><h2>自动分析结果</h2></div><button type="button" onClick={rerunAgent} disabled={agentBusy || isReference}><RefreshCw size={16}/> 重新分析</button></div>
      {agentError && <div className="agent-error" role="alert">{agentError}</div>}
      {agentBusy && <div className="agent-empty"><LoaderCircle className="agent-spin" size={27}/><h3>正在分析项目证据</h3><p>先核算并检查数据，再由模型整理发现和任务。</p></div>}
      {!agentBusy && !result && <div className="agent-empty"><Sparkles size={27}/><h3>{isReference?"等待导入真实工程数据":"分析尚未完成"}</h3><p>{isReference?"示例清单可以浏览功能；上传数据后才会自动调用模型。":"检查模型连接后点击重新分析。"}</p></div>}
      {!agentBusy && result && <><div className="agent-summary"><span>综合判断</span><p>{result.summary||"模型未提供综合判断，请核对下方发现与任务。"}</p></div><div className="agent-result-grid"><div><h3>关键发现 <span>{result.findings.length}</span></h3>{result.findings.map((item,i)=><article className="agent-finding" key={i}><span className={`agent-level ${item.level}`}>{item.level==="high"?"优先":item.level==="medium"?"关注":"提示"}</span><h4>{item.title}</h4><p>{item.detail}</p>{item.evidence&&<small>依据：{item.evidence}</small>}</article>)}</div><div><h3>下一步任务 <span>{result.actions.length}</span></h3>{result.actions.map((item,i)=><button className="agent-action" key={i} onClick={()=>go(item.target)}><span>0{i+1}</span><div><h4>{item.title}</h4><p>{item.reason}</p>{item.data_needed&&<small>需补充：{item.data_needed}</small>}</div><ChevronRight size={17}/></button>)}</div></div></>}
    </section>
    <footer className="agent-footnote"><ShieldCheck size={16}/> AI 建议需要人工核验。没有产品 EPD、规格和成本时，不生成确定的减排承诺或采购结论。</footer>
  </div>;
}
