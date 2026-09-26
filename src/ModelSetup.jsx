import React, { useState } from "react";
import { ArrowRight, Bot, Eye, EyeOff, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import "./agent.css";
import { hasModelConfig } from "./advisorEngine.js";

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
