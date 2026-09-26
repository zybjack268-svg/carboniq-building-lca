import React, { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, BookOpen, CheckCircle2, FileSpreadsheet, Paperclip, Plus, Settings2, Sparkles, Trash2 } from "lucide-react";
import { animateExpand, animateShrink, captureAnchor, popAnchor } from "./pageFx.js";

// 技能库自绘书图标：右页是独立图层，悬停时绕书脊 3D 翻页（样式见 workflow-hub.css）。
function BookSkillIcon() {
  return <svg className="ciq-book" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 6.6C10.6 5.2 8.6 4.5 6.2 4.5c-1.2 0-2.2.16-3 .4V19c.8-.24 1.8-.4 3-.4 2.4 0 4.4.7 5.7 2.1 1.3-1.4 3.3-2.1 5.7-2.1 1.1 0 2.1.16 3 .4V5.02c-.8-.24-1.8-.4-3-.4-2.4 0-4.4.7-5.7 2.1Z"/>
    <path d="M12 6.6v13.9" opacity=".5"/>
    <g className="ciq-book-flip">
      <path d="M12 6.6c1.3-1.4 3.3-2.1 5.7-2.1 1.1 0 2.1.16 3 .4V19c-.8-.24-1.8-.4-3-.4-2.4 0-4.4.7-5.7 2.1V6.6Z" fill="currentColor" fillOpacity=".12"/>
      <path d="M14.6 9.3c.9-.22 1.9-.34 3-.34" opacity=".5"/>
      <path d="M14.6 12.1c.9-.22 1.9-.34 3-.34" opacity=".5"/>
    </g>
  </svg>;
}
import AgentWorkbench from "./AgentWorkbench.jsx";
import A4Visuals from "./A4Visuals.jsx";
import ConstructionTwin from "./ConstructionTwin.jsx";
import FactorPicker from "./FactorPicker.jsx";
import FlowerAvatar from "./FlowerAvatar.jsx";
import OperationTwin from "./OperationTwin.jsx";
import SkillLibrary from "./SkillLibrary.jsx";
import Toggle from "./Toggle.jsx";
import { BUILTIN_SKILLS, SKILL_SCOPES, extractSkillDraft, loadUserSkills, saveUserSkills, scopeLabel, stripSkillDraftJson, validateSkill } from "./skillLibrary.js";
import { hasModelConfig, requestAdvisor } from "./advisorEngine.js";
import { readPhaseFile } from "./phaseImport.js";
import { siteUnitCompatible } from "./lifecycle.js";
import { BUILDING_TYPES, deriveBuildingGeometry } from "./geometry.js";
import "./workflow-hub.css";

const phases = [
  { id: "a1", code: "A1–A3", name: "材料生产", intro: "上传材料清单，智能体核对字段、审查数据、解释排放热点与候选方案。", input: "CSV / XLSX 材料清单" },
  { id: "a4", code: "A4", name: "运输", intro: "录入从供应地到施工现场的路线，核算完整路线并分析缺口。", input: "运输路线 CSV / XLSX，或逐项填写" },
  { id: "a5", code: "A5", name: "建造过程", intro: "录入现场设备和施工活动的能源消耗，单独核算建造排放。", input: "施工活动 CSV / XLSX，或逐项填写" },
  { id: "b6", code: "B6", name: "运营能源", intro: "录入年度用电和燃气数据，得到年度结果与假设说明。", input: "运营能源 CSV / XLSX，或逐项填写" },
];
const rowFields = {
  a4: [["material", "材料或构件"], ["origin", "出发地"], ["destination", "施工现场"], ["mass", "运输质量 t", "number"], ["distance", "单程距离 km", "number"], ["factor", "运输因子 kgCO₂e/(t·km)", "number"], ["source", "记录或因子来源"]],
  a5: [["activity", "设备或施工活动"], ["energy", "能源"], ["quantity", "用量", "number"], ["unit", "用量单位"], ["factor", "排放因子", "number"], ["factorUnit", "因子单位"], ["source", "因子来源"]],
  b6: [["city", "城市"], ["zone", "气候分区"], ["annualElectricity", "年用电 kWh", "number"], ["electricityFactor", "电力因子 kgCO₂e/kWh", "number"], ["annualGas", "年燃气 m³", "number"], ["gasFactor", "燃气因子 kgCO₂e/m³", "number"], ["annualHeat", "年购热 GJ", "number"], ["heatFactor", "热力因子 kgCO₂e/GJ", "number"], ["years", "分析年数", "number"]],
};
const format = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 });

function PhaseWorkflow({ phase, aiConfig, onBack, openSetup, rows, setRows, result, climate, setClimate, analysis, setAnalysis, project, setProject, stats }) {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [allowModelRecognition, setAllowModelRecognition] = useState(false);
  const isEnergy = phase.id === "b6";
  const value = isEnergy ? climate : null;
  const hasData = isEnergy ? result.annualKg !== null : result.hasData;
  const incomplete = isEnergy ? result.gasIncomplete : result.incomplete;
  const amount = isEnergy ? result.annualKg : result.kg;
  const signature = JSON.stringify(isEnergy ? climate : rows);
  const geometry = phase.id === "a5" ? deriveBuildingGeometry(project) : null;
  const updateRow = (id, field, next) => setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: next } : row));
  const [picker, setPicker] = useState(null);
  // 因子库按钮只出现在可从参考库选值的字段上：A4 运输因子、B6 电力/燃气因子。
  const libraryField = (field) => phase.id === "a4" && field === "factor" ? { category: "transport", title: "选用运输排放因子", hint: "单位 kgCO₂e/(t·km)，取自 GB/T 51366-2019 附录E。标准默认运距：混凝土 40km、其他建材 500km；选用后如来源为空会自动填入库中来源。", filter: (entry) => entry.category === "transport" }
    : phase.id === "a5" && field === "factor" ? { category: "energy", title: "选用能源排放因子", hint: "柴油、汽油等按千克（kg）计，电力按千瓦时（kWh）计；请让用量单位与因子口径一致。选用后如来源为空会自动填入库中来源。", filter: (entry) => entry.category === "energy" }
    : phase.id === "b6" && field === "electricityFactor" ? { category: "energy", title: "选用电力排放因子", filter: (entry) => entry.target === "electricity" }
    : phase.id === "b6" && field === "gasFactor" ? { category: "energy", title: "选用燃气排放因子", filter: (entry) => entry.target === "gas" }
    : phase.id === "b6" && field === "heatFactor" ? { category: "energy", title: "选用热力排放因子", hint: "外购市政热力按 GJ 计；缺省值 110 kgCO₂e/GJ 来自发改办气候〔2011〕1041号体系，优先采用当地官方数据。", filter: (entry) => entry.target === "heat" }
    : null;
  const fieldInput = (field, label, type, row) => {
    const lib = libraryField(field);
    const input = <input type={type || "text"} min={type ? "0" : undefined} step={type ? "any" : undefined} value={(row ? row[field] : climate[field]) ?? ""} onChange={(event) => { const next = event.target.value; if (row) updateRow(row.id, field, next); else setClimate((current) => ({ ...current, [field]: next })); }}/>;
    return <label key={field}>{label}{lib ? <span className="wh-field-row">{input}<button type="button" className="wh-lib-pick" title="从因子库选用参考值" onClick={() => setPicker({ ...lib, field, row })}><BookOpen size={13}/></button></span> : input}</label>;
  };
  const applyLibraryEntry = (entry) => {
    if (!picker) return;
    setPicker(null);
    if (picker.row) {
      setRows((current) => current.map((row) => row.id === picker.row.id ? {
        ...row,
        [picker.field]: String(entry.factor),
        ...(phase.id === "a5" ? { factorUnit: `kgCO₂e/${entry.unit}`, unit: row.unit || entry.unit } : {}),
        source: String(row.source ?? "").trim() ? row.source : entry.source,
      } : row));
    } else setClimate((current) => ({ ...current, [picker.field]: String(entry.factor) }));
  };
  const addRow = () => setRows((current) => [...current, { id: crypto.randomUUID(), ...Object.fromEntries(rowFields[phase.id].map(([field]) => [field, ""])) }]);
  const importFile = async (file) => {
    if (!file) return;
    setBusy(true); setNotice("正在读取阶段数据…");
    try {
      const parsed = await readPhaseFile(file, phase.id, aiConfig, allowModelRecognition);
      if (isEnergy) setClimate((current) => ({ ...current, ...parsed.rows[0] }));
      else setRows(parsed.rows);
      setFileName(file.name);
      setAnalysis(null);
      setNotice(`已从“${parsed.sheet}”${parsed.recognizedByModel ? "经模型定位字段后" : ""}识别 ${parsed.rows.length} 条记录。请核对单位、因子和来源，再运行工作流。`);
      setAllowModelRecognition(false);
    } catch (error) { setNotice(`导入失败：${error.message}`); }
    finally { setBusy(false); }
  };
  const run = async () => {
    if (!hasData || busy || !hasModelConfig(aiConfig)) return;
    setBusy(true); setNotice("智能体正在分析本阶段数据…");
    const evidence = isEnergy ? {
      annual_electricity_kg: result.electricityKg, annual_gas_kg: result.gasKg, annual_heat_kg: result.heatKg,
      annual_total_kg: result.annualKg, gas_incomplete: result.gasIncomplete, heat_incomplete: result.heatIncomplete,
      years: result.years, entered_data: climate,
    } : {
      complete_count: result.rows.length, incomplete_count: result.incomplete,
      partial_total_kg: result.kg, complete_rows: result.rows.slice(0, 30),
      omitted_complete_rows: Math.max(0, result.rows.length - 30),
    };
    try {
      const answer = await requestAdvisor({ config: aiConfig, context: {
        workflow: phase.code, workflow_name: phase.name, source_file: fileName || "页面逐项填写",
        instruction: phase.id === "b6"
          ? `只分析 ${phase.code} 运营能源阶段。数值来自本地确定性计算；结合电力、燃气、热力的排放占比，给出 2-3 条可执行的节能方向与数据核实建议（如高效设备、分项计量、因子核实），并提醒年度结果不得与一次性建设阶段相加。不得编造标准限值或因子。`
          : `只分析 ${phase.code} 阶段。数值来自本地确定性计算；完整记录的小计不可称为整个阶段总量。指出数据缺口和下一步，不编造因子或标准。`,
        evidence,
      }, history: [{ role: "user", text: question.trim() || `请完成 ${phase.code} 工作流：解释核算结果、数据问题和下一步。` }] });
      setAnalysis({ signature, answer }); setNotice("本阶段分析已完成。");
    } catch (error) { setNotice(`模型分析未完成：${error.message}。本地核算结果仍可查看。`); }
    finally { setBusy(false); }
  };
  return <div className="wh-page"><header className="wh-top"><button onClick={onBack}><ArrowLeft size={17}/> 全部工作流</button><span className="ciq-lockup"><img src="/carboniq-icon.svg" alt="" className="ciq-icon ciq-icon-sm"/><span className="ciq-word ciq-word-sm"><b>Carbon</b><em>IQ</em></span></span><button onClick={openSetup}><Settings2 size={16}/>{aiConfig.model || "连接模型"}</button></header>
    <main className="wh-detail"><div className="wh-detail-intro"><span>{phase.code} / INDEPENDENT WORKFLOW</span><h1>{phase.name}</h1><p>{phase.intro}</p></div>
      <section className="wh-panel"><div className="wh-panel-head"><div><small>01 · 提供数据</small><h2>{isEnergy ? "年度能源记录" : phase.id === "a4" ? "运输路线" : "现场施工活动"}</h2></div><button onClick={() => fileRef.current?.click()} disabled={busy}><Paperclip size={15}/> 导入文件</button></div>
        <input ref={fileRef} type="file" accept=".csv,.xlsx" hidden onChange={(event) => { importFile(event.target.files?.[0]); event.target.value = ""; }}/>
        <p className="wh-help">支持 {phase.input}。导入只填写表单，用户核对后才运行；缺失字段不会由模型猜测。</p>
        <Toggle checked={allowModelRecognition} onChange={setAllowModelRecognition} label="启动AI分析服务" disabled={busy}>如果本地无法识别表头，允许把最多 12 张工作表、每张前 25 行且每行前 24 列的预览发送至当前模型服务{aiConfig.baseUrl ? `（${aiConfig.baseUrl}）` : ""}，只用于定位字段；开关关闭时文件只在本地解析。</Toggle>
        {isEnergy ? <div className="wh-fields">{rowFields.b6.map(([field, label, type]) => fieldInput(field, label, type, null))}</div>
          : <>{rows.map((row, index) => <div className="wh-row" key={row.id}><div className="wh-row-title"><b>记录 {index + 1}</b><button onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} aria-label={`删除记录 ${index + 1}`}><Trash2 size={15}/></button></div><div className="wh-fields">{rowFields[phase.id].map(([field, label, type]) => fieldInput(field, label, type, row))}</div>{phase.id === "a5" && row.unit && row.factorUnit && !siteUnitCompatible(row.unit, row.factorUnit) && <p className="wh-warning" role="status">用量单位与因子单位不匹配；本条不会计入排放小计。请换算后再核算。</p>}</div>)}<button className="wh-add" onClick={addRow}><Plus size={16}/> 添加{phase.id === "a4" ? "路线" : "活动"}</button></>}
      </section>
      {phase.id === "a4" && <A4Visuals routes={rows} result={result} aiConfig={aiConfig}/>}
      {phase.id === "b6" && <section className="wh-panel wh-construction-model" aria-label="B6 运营能耗三维示意"><div className="wh-panel-head"><div><small>02 · OPERATION MODEL</small><h2>运营能耗数字孪生</h2></div><strong>{hasData ? `${format.format(amount / 1000)} tCO₂e/年` : "待输入"}</strong></div><p className="wh-help">夜景建筑能流示意：金色为电力、蓝色为燃气、橙色为市政热力；粒子密度按各能源年度排放占比。下方附排放构成与情景年限图表。</p><Suspense fallback={<div className="cw-generating">正在加载运营能耗三维示意…</div>}><OperationTwin project={project} climate={climate} operationResult={result}/></Suspense></section>}
      <section className="wh-panel wh-result"><div className="wh-panel-head"><div><small>{phase.id === "a4" ? "03" : "02"} · 本地核算与模型解释</small><h2>{phase.code} 阶段结果</h2></div><strong>{hasData ? `${format.format(amount / 1000)} tCO₂e${isEnergy ? "/年" : ""}` : "待输入"}</strong></div>
        <p>{isEnergy ? "仅计算已录入的年度电力、燃气与外购热力；不得与一次性建设阶段直接相加。" : `仅合计 ${result.rows.length} 条完整记录${incomplete ? `；${incomplete} 条尚未补齐` : ""}，不能代表阶段全部排放。`}</p>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={`可补充希望智能体重点分析的 ${phase.code} 问题…`}/>
        <button className="wh-run" onClick={run} disabled={!hasData || busy || !hasModelConfig(aiConfig)}><Sparkles size={16}/>{busy ? "正在处理…" : "运行智能体分析"}</button>
        <p className="wh-help">运行后会把本阶段已录入的数据与本地核算小计发送到当前配置的模型服务，用于生成解释和建议。</p>
        {!hasModelConfig(aiConfig) && <p className="wh-warning">需要先连接模型，才能运行智能体分析。</p>}
        {notice && <p role="status" className="wh-notice">{notice}</p>}
        {analysis?.signature === signature && <article className="wh-analysis"><span className="wh-phase-answer-avatar"><FlowerAvatar size={32}/></span><div><b>智能体分析 · {phase.code}</b><p>{analysis.answer}</p></div></article>}
        {analysis && analysis.signature !== signature && <p className="wh-warning">数据已更改，请重新运行分析以获得最新结论。</p>}
      </section>
      {phase.id === "a5" && <section className="wh-panel wh-construction-model" aria-label="A5 建造过程三维示意"><div className="wh-panel-head"><div><small>03 · CONSTRUCTION MODEL</small><h2>施工过程数字孪生</h2></div></div><p className="wh-help">可旋转的施工场地：塔吊、挖掘机、运输车辆随工序联动；粒子密度按各活动排放占比示意。几何来自项目参数推导，不能代表施工现场，也不会自动生成 A5 排放量。</p><div className="cw-project-controls"><div><b>{geometry.type.label}</b><small>{geometry.explanation}</small></div><label>建筑用途 <select value={geometry.type.id} onChange={(event) => setProject((current) => ({ ...current, buildingType: event.target.value }))}><option value="generic">通用建筑</option>{BUILDING_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>楼层数 <input type="number" min="1" max="30" value={project.floors} onChange={(event) => { const value = Number(event.target.value); if (value >= 1 && value <= 30) setProject((current) => ({ ...current, floors: value })); }}/></label></div><Suspense fallback={<div className="cw-generating">正在加载施工三维示意…</div>}><ConstructionTwin project={project} siteResult={result} embedded/></Suspense></section>}
    </main>
    <FactorPicker open={Boolean(picker)} category={picker?.category} filter={picker?.filter} title={picker?.title} hint={picker?.hint} onSelect={applyLibraryEntry} onClose={() => setPicker(null)}/>
  </div>;
}

export default function WorkflowHub(props) {
  const [active, setActive] = useState(null);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [workflowAnalyses, setWorkflowAnalyses] = useState({});
  useEffect(() => () => props.onWorkflowChange?.(null), []);
  const [messages, setMessages] = useState([{ role: "assistant", text: "你好，我是 CarbonIQ 智能体。你可以直接提问，也可以选择 A1–A3、A4、A5 或 B6 工作流。每个阶段独立核算，缺少数据时我会说明需要补什么。" }]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [userSkills, setUserSkills] = useState(loadUserSkills);
  const [skillDraft, setSkillDraft] = useState(null);
  const phaseAnchor = useRef(null);
  const overlayRef = useRef(null);
  const skillAnchor = useRef(null);
  const [closing, setClosing] = useState(false);
  useEffect(() => { saveUserSkills(userSkills); }, [userSkills]);
  const select = (id, event) => { phaseAnchor.current = captureAnchor(event); props.onWorkflowChange?.(id); setActive(id); };
  useLayoutEffect(() => {
    if (active && overlayRef.current) animateExpand(overlayRef.current, phaseAnchor.current);
  }, [active]);
  const closePhase = () => {
    if (closing || !active) return;
    setClosing(true);
    const finish = () => { popAnchor(phaseAnchor.current); setActive(null); setClosing(false); props.onWorkflowChange?.(null); };
    animateShrink(overlayRef.current, phaseAnchor.current).then(finish);
  };
  const saveDraft = () => {
    if (!skillDraft) return;
    const result = validateSkill(skillDraft, { existingIds: userSkills.map((item) => item.id) });
    if (!result.ok) { setMessages((current) => [...current, { role: "status", text: `技能草稿未保存：${result.errors.join(" ")}` }]); return; }
    setUserSkills((current) => [...current, result.skill]);
    setSkillDraft(null);
    setMessages((current) => [...current, { role: "assistant", text: `技能「${result.skill.name}」已保存到技能库（本机浏览器）。你可以在顶栏「技能库」里随时运行它。` }]);
  };
  const send = async () => {
    const question = prompt.trim();
    if (!question || busy) return;
    setPrompt(""); setMessages((current) => [...current, { role: "user", text: question }]);
    if (!hasModelConfig(props.aiConfig)) { setMessages((current) => [...current, { role: "status", text: "请先连接模型，再继续对话。" }]); return; }
    setBusy(true);
    try {
      const answer = await requestAdvisor({ config: props.aiConfig, context: {
        mode: "workflow_selection", project_data: "用户尚未选择工作流或提供阶段数据；不得引用示例清单的数值",
        available_workflows: phases.map(({ code, name, intro }) => ({ code, name, intro })),
        skill_library: {
          hint: "项目内置技能库（顶栏「技能库」按钮打开）。技能 = 名称 + 适用数据范围 + 运行时发给模型的专项指令；技能运行时会自动附带当前项目对应范围的数据快照。",
          scopes: SKILL_SCOPES.map((scope) => `${scope.id}：${scope.label}`),
          builtin_skills: BUILTIN_SKILLS.map((skill) => `${skill.name}（${scopeLabel(skill.scope)}）`),
          user_skills: userSkills.map((skill) => skill.name),
          creation_protocol: "技能创建是两步对话：第一步（意图澄清），当用户表达想创建技能但没有说清楚要解决什么问题、适用哪个阶段时，不要输出任何 JSON，也不要直接甩模板——先用自然语言简要说明技能库支持的数据范围（a1 材料 / a4 运输 / a5 施工 / b6 能源 / overview 全览，可引用内置技能作为例子），再提出 1-3 个针对性问题（例如：这个技能要解决什么问题？期望它输出什么？主要给谁用？），等用户回答。第二步（起草），只有当用户意图已经足够明确（能命名技能、能确定范围、能描述分析要求）时，才输出一个 JSON 代码块：{\"carboniqSkillDraft\":{\"name\":\"不超过40字\",\"scope\":\"a1|a4|a5|b6|overview 之一\",\"description\":\"不超过160字\",\"instruction\":\"运行时发给模型的专项指令，须要求只引用数据快照、不得编造因子\"}}，JSON 之外只写一句简短说明（界面上会出现确认卡片，用户点保存后入库）。判断不了意图是否明确时，宁可先追问一轮。",
        },
      }, history: [...messages.filter((message) => message.role !== "status"), { role: "user", text: question }] });
      const draft = extractSkillDraft(answer);
      if (draft) {
        const result = validateSkill(draft);
        if (result.ok) setSkillDraft(result.skill);
      }
      const display = draft ? stripSkillDraftJson(answer) : answer;
      setMessages((current) => [...current, { role: "assistant", text: display.trim() || "我为技能起草了一份配置，请在下方卡片确认并保存。" }]);
    } catch (error) { setMessages((current) => [...current, { role: "status", text: `模型暂未回复：${error.message}` }]); }
    finally { setBusy(false); }
  };
  return <div className="wh-page"><header className="wh-top"><div className="wh-top-left"><span className="ciq-lockup"><img src="/carboniq-icon.svg" alt="" className="ciq-icon ciq-icon-sm"/><span className="ciq-word ciq-word-sm"><b>Carbon</b><em>IQ</em></span></span><small>{props.aiConnection.status === "ready" ? `模型已连接 · ${props.aiConfig.model}` : "模型未连接"}</small></div><div className="wh-top-actions"><button onClick={(event) => { skillAnchor.current = captureAnchor(event); setSkillsOpen(true); }}><BookSkillIcon/> 技能库</button><button onClick={props.openSetup}><span className="ciq-settings-ico"><Settings2 size={16}/></span> 模型设置</button></div></header>
    <main className="wh-home"><div className="wh-hero"><div className="ciq-lockup ciq-lockup-hero"><img src="/carboniq-icon.svg" alt="CarbonIQ 图标" className="ciq-icon"/><span className="ciq-word"><b>Carbon</b><em>IQ</em></span></div><p className="ciq-tagline">建筑全生命周期碳排放分析智能体</p></div>
      <section className="wh-chat" aria-label="与 CarbonIQ 智能体对话"><div className="wh-chat-head"><FlowerAvatar size={26}/><b>项目智能体</b><small>可协助选择工作流、解释数据需求</small></div><div className="wh-messages" aria-live="polite">{messages.map((message, index) => message.role !== "user" ? <div key={index} className="wh-message-row assistant"><span className="wh-answer-avatar"><FlowerAvatar size={32}/></span><div className={`wh-message ${message.role}`}>{message.text}</div></div> : <div key={index} className="wh-message user">{message.text}</div>)}{busy && <div className="wh-message-row assistant"><span className="wh-answer-avatar"><FlowerAvatar size={32} working/></span><div className="wh-message assistant">正在思考…</div></div>}{skillDraft && <div className="wh-draft-card"><div className="wh-draft-head"><Sparkles size={15}/><b>智能体起草的技能</b><small>确认后保存到技能库（本机浏览器）</small></div><b className="wh-draft-name">{skillDraft.name}</b><small>{scopeLabel(skillDraft.scope)} · {skillDraft.description}</small><details><summary>查看技能指令</summary><p>{skillDraft.instruction}</p></details><div className="wh-draft-actions"><button onClick={saveDraft}>保存到技能库</button><button className="wh-draft-dismiss" onClick={() => setSkillDraft(null)}>忽略</button></div></div>}</div><div className="wh-compose"><textarea aria-label="输入你的问题" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：我只有运输清单，应该先做哪个阶段？" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }}/><button onClick={send} disabled={!prompt.trim() || busy}><ArrowUp size={17}/><span>发送</span></button></div></section>
      <div className="wh-workflow-heading"><div><span>AVAILABLE WORKFLOWS</span><h2>选择一个工作流</h2></div><small>阶段结果各自独立，按需调用</small></div><div className="wh-grid">{phases.map((phase, index) => <button key={phase.id} className="wh-card" onClick={(event) => select(phase.id, event)}><span className="wh-card-index">0{index + 1} / {phase.code}</span><h3>{phase.name}</h3><p>{phase.intro}</p><small><FileSpreadsheet size={14}/>{phase.input}</small><span className="wh-card-link">进入工作流 <ArrowRight size={16}/></span></button>)}</div>
      {skillsOpen && <SkillLibrary onClose={() => setSkillsOpen(false)} anchorEl={skillAnchor.current} userSkills={userSkills} onUserSkillsChange={setUserSkills} aiConfig={props.aiConfig} openSetup={props.openSetup} stats={props.stats} optimized={props.optimized} candidates={props.candidates} selectedCandidates={props.selectedCandidates} transportResult={props.transportResult} siteResult={props.siteResult} operationResult={props.operationResult} climate={props.climate} project={props.project} isReference={props.isReference}/>}
      {active && <div className="wh-phase-overlay" ref={overlayRef}>
        {active === "a1"
          ? <AgentWorkbench {...props} onBack={closePhase} openSetup={props.openSetup}/>
          : <PhaseWorkflow key={active} phase={phases.find((item) => item.id === active)} aiConfig={props.aiConfig} onBack={closePhase} openSetup={props.openSetup} rows={active === "a4" ? props.routes : props.siteRows} setRows={active === "a4" ? props.setRoutes : props.setSiteRows} result={active === "a4" ? props.transportResult : active === "a5" ? props.siteResult : props.operationResult} climate={props.climate} setClimate={props.setClimate} analysis={workflowAnalyses[active]} setAnalysis={(next) => setWorkflowAnalyses((current) => ({ ...current, [active]: next }))} project={props.project} setProject={props.setProject} stats={props.stats}/>}
      </div>}
      <footer className="wh-footer"><CheckCircle2 size={15}/> 智能体解释数据与建议；排放数值由本地计算并保留可核对的输入。</footer>
    </main></div>;
}
