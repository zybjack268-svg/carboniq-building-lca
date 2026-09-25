import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight, BarChart3, Bot, Building2, Calculator, CheckCircle2,
  ChevronRight, CircleDollarSign, CloudSun, Database, Download,
  Eye, EyeOff, FileSearch, FileSpreadsheet, FileText, Gauge, Globe2, Home, Layers3,
  Leaf, Menu, Recycle, RefreshCw, ShieldCheck, SlidersHorizontal,
  Sparkles, TrendingDown, Upload, X, Zap,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./concept.css";
import "./rework.css";
import { buildProjectContext, hasModelConfig, requestAdvisor } from "./advisorEngine";
import { computeMaterialScenario, parseCsv, parseMaterialRows, quoteCsv } from "./dataUtils";
import { calculateOperation, calculateTransport, calculateSite } from "./lifecycle";
import { parseProjectWorkbook } from "./projectImport";
import { recognizeMaterialColumns } from "./flexibleImport";
import { runLcaAuditSkill } from "./lcaAuditSkill";
import ProjectPet from "./ProjectPet";
import PortalLanding from "./PortalLanding";
import { ModelSetup } from "./AgentWorkspace";
import AgentWorkbench from "./AgentWorkbench";
import { buildAgentEvidence, parseAgentResponse, runProjectAgent } from "./agentEngine";

const CarbonTwin = React.lazy(() => import("./CarbonTwin"));
const OperationTwin = React.lazy(() => import("./OperationTwin"));

const INITIAL_MATERIALS = [
  { id: "M001", part: "主体结构", name: "C30预拌混凝土", unit: "m³", quantity: 2700, factor: 295, source: "GB/T 51366-2019 附录D" },
  { id: "M002", part: "主体结构", name: "热轧碳钢钢筋", unit: "t", quantity: 330, factor: 2340, source: "GB/T 51366-2019 附录D" },
  { id: "M003", part: "围护分隔", name: "页岩空心砖", unit: "m³", quantity: 900, factor: 204, source: "GB/T 51366-2019 附录D" },
  { id: "M004", part: "砌筑抹灰", name: "普通硅酸盐水泥", unit: "t", quantity: 60, factor: 735, source: "GB/T 51366-2019 附录D" },
  { id: "M005", part: "外窗", name: "平板玻璃", unit: "t", quantity: 30, factor: 1130, source: "GB/T 51366-2019 附录D" },
  { id: "M006", part: "外窗装饰", name: "铝板带", unit: "t", quantity: 6, factor: 28500, source: "GB/T 51366-2019 附录D" },
];

const NAV = [
  ["agent", "AI 工作台", Bot],
  ["dashboard", "项目总览", Gauge], ["twin", "建筑预览", Building2], ["upload", "材料清单", FileSearch],
  ["calculator", "材料排放", Calculator], ["materials", "材料比较", Layers3],
  ["simulator", "优化模拟器", SlidersHorizontal], ["transport", "材料运输", Recycle], ["climate", "运营能耗", CloudSun],
  ["credits", "减排价值", CircleDollarSign], ["report", "项目报告", FileText],
  ["advisor", "AI顾问", Bot],
];
const PRIMARY_NAV = NAV.filter(([id]) => !["dashboard", "upload", "credits", "advisor"].includes(id));

const colors = ["#62d8ad", "#36a989", "#2b806d", "#e1a857", "#6c83cd", "#c97460"];
const fmt = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });
const fmt3 = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 3 });
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function useLiquidPress() {
  useEffect(() => {
    const press = (event) => {
      const target = event.target.closest?.("button, a");
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--press-x", `${event.clientX - rect.left}px`);
      target.style.setProperty("--press-y", `${event.clientY - rect.top}px`);
      target.classList.remove("liquid-pressed");
      void target.offsetWidth;
      target.classList.add("liquid-pressed");
    };
    const clear = (event) => event.target.closest?.("button, a")?.classList.remove("liquid-pressed");
    document.addEventListener("pointerdown", press, { passive: true });
    document.addEventListener("animationend", clear, true);
    return () => {
      document.removeEventListener("pointerdown", press);
      document.removeEventListener("animationend", clear, true);
    };
  }, []);
}

function App() {
  useLiquidPress();
  const initialView = new URLSearchParams(window.location.search).get("view");
  const hasDirectView = NAV.some(([id]) => id === initialView);
  const [screen, setScreen] = useState(hasDirectView ? "setup" : "landing");
  const [view, setView] = useState(hasDirectView ? initialView : "agent");
  const [menu, setMenu] = useState(false);
  const [materials, setMaterials] = useState(INITIAL_MATERIALS);
  const [project, setProject] = useState({ name: "宿舍楼项目", area: 6000, floors: 6, structure: "钢筋混凝土框架" });
  const [fileName, setFileName] = useState("公开因子_估算工程量_宿舍楼.csv");
  const [notice, setNotice] = useState("已载入当前材料清单");
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState({});
  const [benchmark, setBenchmark] = useState({ intensity: "", source: "", confirmed: false });
  const [climate, setClimate] = useState({ zone: "", city: "", annualElectricity: "", electricityFactor: "0.5306", annualGas: "", gasFactor: "", years: "30" });
  const [routes, setRoutes] = useState([]);
  const [siteRows, setSiteRows] = useState([]);
  const [finance, setFinance] = useState({ carbonPrice: "", addedCost: "" });
  const [messages, setMessages] = useState([{ role: "assistant", text: "你好。配置模型后，我会结合当前宿舍楼的材料清单、碳排热点和优化情景回答问题。" }]);
  const [isReference, setIsReference] = useState(true);
  const [aiConfig, setAiConfig] = useState({ baseUrl: "", apiKey: "", model: "" });
  const [aiConnection, setAiConnection] = useState({ status: "idle", message: "尚未测试连接" });
  const [aiBusy, setAiBusy] = useState(false);
  const [agentRun, setAgentRun] = useState(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentStage, setAgentStage] = useState("idle");
  const [importBusy, setImportBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [agentError, setAgentError] = useState("");
  const [agentRetry, setAgentRetry] = useState(0);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [petAction, setPetAction] = useState(null);

  useEffect(() => {
    let active = true;
    fetch("/api/session", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((session) => {
        if (!active || !session?.serverManaged || !session.model) return;
        setAiConfig({ baseUrl: "/api", apiKey: "", model: session.model, serverManaged: true });
        setAiConnection({ status: "ready", message: "本机模型配置已加载；可在设置中测试连接。" });
        setScreen("workspace");
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const stats = useMemo(() => {
    const rows = materials.map((m) => ({ ...m, emission: number(m.quantity) * number(m.factor) }));
    const total = rows.reduce((sum, m) => sum + m.emission, 0);
    const sorted = [...rows].sort((a, b) => b.emission - a.emission);
    return { rows, total, tonnes: total / 1000, intensity: project.area > 0 ? total / project.area : 0, hotspot: sorted[0] };
  }, [materials, project.area]);

  const optimized = useMemo(() => {
    return computeMaterialScenario(stats.rows, candidates, selectedCandidates);
  }, [candidates, selectedCandidates, stats]);
  const transportResult = useMemo(() => calculateTransport(routes), [routes]);
  const siteResult = useMemo(() => calculateSite(siteRows), [siteRows]);
  const operationResult = useMemo(() => calculateOperation(climate), [climate]);
  const selectedAlternatives = candidates.filter((item) => selectedCandidates[item.materialId] === item.id);
  const auditRun = useMemo(() => runLcaAuditSkill({ rows: stats.rows, fileName, candidates, selectedCandidates, routes, siteRows, climate, area: project.area }), [stats.rows, fileName, candidates, selectedCandidates, routes, siteRows, climate, project.area]);
  const agentEvidence = useMemo(() => buildAgentEvidence({ stats, optimized, candidates, selectedCandidates, transportResult, siteResult, operationResult, isReference, auditRun }), [stats, optimized, candidates, selectedCandidates, transportResult, siteResult, operationResult, isReference, auditRun]);

  const addCandidate = (candidate) => {
    const id = `C-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCandidates((current) => [...current, { ...candidate, id }]);
    return id;
  };
  const removeCandidate = (id) => {
    setCandidates((current) => current.filter((item) => item.id !== id));
    setSelectedCandidates((current) => Object.fromEntries(Object.entries(current).filter(([, value]) => value !== id)));
  };

  const go = (next) => { setScreen(aiConnection.status === "ready" ? "workspace" : "setup"); setView(next === "dashboard" ? "agent" : next); setMenu(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const restore = () => { setMaterials(INITIAL_MATERIALS); setFileName("公开因子_估算工程量_宿舍楼.csv"); setIsReference(true); setCandidates([]); setSelectedCandidates({}); setNotice("已恢复当前材料清单"); };

  const applyImport = ({ parsed, bundle, name, area }) => {
    setAgentStage("calculating");
    setAgentRun(null);
    setMessages([]);
    setMaterials(parsed.map((row) => ({ ...row, sourceFile: name })));
    setProject((current) => bundle?.project || { ...current, area: Number(area), geometry: null });
    setRoutes(bundle?.routes || []);
    setSiteRows(bundle?.site || []);
    setClimate(bundle?.climate || { zone: "", city: "", annualElectricity: "", electricityFactor: "", annualGas: "", gasFactor: "", years: "" });
    setBenchmark(bundle?.benchmark || { intensity: "", source: "", confirmed: false });
    setCandidates(bundle?.candidates || []);
    setFileName(name); setIsReference(false); setSelectedCandidates({}); setPendingImport(null);
    setNotice(`已导入 ${parsed.length} 项材料；请继续核对因子来源和项目参数`);
    go("agent");
  };
  const confirmImport = () => {
    if (!pendingImport) return;
    if (!pendingImport.bundle?.project && !(Number(pendingImport.area) > 0)) {
      setNotice("请先填写并核对项目建筑面积，再应用识别结果。");
      return;
    }
    applyImport(pendingImport);
  };

  const importFile = async (file) => {
    if (!file) return;
    setImportBusy(true);
    setAgentStage("reading");
    setNotice("正在读取工程量清单……");
    try {
      if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error("只支持 CSV 或 XLSX 材料清单；不能从该文件生成 3D 几何");
      if (file.size > 10 * 1024 * 1024) throw new Error("文件超过 10 MB，请精简后重试");
      let parsed;
      let bundle = null;
      let recognition = null;
      if (/\.csv$/i.test(file.name)) {
        const rows = parseCsv(await file.text());
        try { parsed = parseMaterialRows(rows); }
        catch { recognition = await recognizeMaterialColumns([{ sheet: file.name, data: rows }], aiConfig); parsed = recognition.materials; }
      } else {
        const { default: readExcel } = await import("read-excel-file/browser");
        const sheets = await readExcel(file);
        try { bundle = parseProjectWorkbook(sheets); parsed = bundle.materials; }
        catch { recognition = await recognizeMaterialColumns(sheets, aiConfig); parsed = recognition.materials; }
      }
      if (recognition || !bundle?.project) {
        setPendingImport({ parsed, bundle, name: file.name, area: "", recognition });
        setAgentStage("reading");
        setNotice(`识别到 ${parsed.length} 项材料；请核对预览${recognition?.issues.length ? `，另有 ${recognition.issues.length} 行未纳入` : ""}。`);
      } else applyImport({ parsed, bundle, name: file.name });
    } catch (error) { setAgentStage(agentRun ? "complete" : "error"); setNotice(`导入失败：${error.message}`); }
    finally { setImportBusy(false); }
  };

  const update = (index, key, value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setMaterials((current) => current.map((row, i) => i === index ? { ...row, [key]: parsed } : row));
  };
  const updateAIConfig = (field, value) => {
    setAiConfig((current) => ({ ...current, [field]: value }));
    setAiConnection({ status: "idle", message: "配置已修改，请重新测试" });
  };

  const testAI = async () => {
    if (aiBusy) return false;
    setAiBusy(true);
    setAiConnection({ status: "testing", message: "正在连接模型…" });
    try {
      await requestAdvisor({ config: aiConfig, test: true });
      setAiConnection({ status: "ready", message: "连接成功，可以开始分析。" });
      return true;
    } catch (error) {
      setAiConnection({ status: "error", message: error.message });
      return false;
    } finally {
      setAiBusy(false);
    }
  };

  useEffect(() => {
    if (aiConnection.status !== "ready" || isReference) {
      setAgentRun(null);
      setAgentBusy(false);
      return;
    }
    const controller = new AbortController();
    setAgentBusy(true);
    setAgentStage("connecting");
    setAgentError("");
    const timer = setTimeout(async () => {
      const evidence = agentEvidence;
      setAgentStage("analyzing");
      try {
        const result = await runProjectAgent({ config: aiConfig, evidence, question: agentPrompt, signal: controller.signal });
        if (!controller.signal.aborted) { setAgentRun({ result, evidence, at: Date.now() }); setAgentStage(result.mode === "local" ? "error" : "complete"); if (result.mode === "local") setAgentError("模型未返回可显示的分析内容"); }
      } catch (error) {
        if (!controller.signal.aborted) {
          setAgentError(error.message);
          setAgentRun({ result: parseAgentResponse("", evidence), evidence, at: Date.now() });
          setAgentStage("error");
        }
      } finally {
        if (!controller.signal.aborted) setAgentBusy(false);
      }
    }, 700);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [aiConnection.status, aiConfig, agentEvidence, isReference, agentRetry]);

  const ask = async (text) => {
    const question = text.trim();
    if (!question || aiBusy) return;
    if (!hasModelConfig(aiConfig)) {
      setAiConnection({ status: "error", message: "请先填写 Base URL、API Key 和模型名称。" });
      return;
    }
    const history = [...messages.filter((item, index) => index > 0 && ["user", "assistant"].includes(item.role)), { role: "user", text: question }];
    setMessages((current) => [...current, { role: "user", text: question }]);
    setAiBusy(true);
    try {
      const context = buildProjectContext({ project, fileName, stats, optimized, selectedAlternatives, benchmark, isReference, transportResult, siteResult, operationResult });
      const answer = await requestAdvisor({ config: aiConfig, history, context });
      setMessages((current) => [...current, { role: "assistant", text: answer }]);
      setAiConnection({ status: "ready", message: "模型已连接" });
    } catch (error) {
      setMessages((current) => [...current, { role: "status", text: `这次未能获得模型回答：${error.message}` }]);
      setAiConnection({ status: "error", message: error.message });
    } finally {
      setAiBusy(false);
    }
  };

  const exportCsv = () => {
    const rows = [["编号", "构件", "材料名称", "单位", "数量", "碳因子", "因子来源", "A1-A3排放(kgCO2e)"], ...stats.rows.map((r) => [r.id, r.part, r.name, r.unit, r.quantity, r.factor, r.source, r.emission])];
    const blob = new Blob(["\ufeff" + rows.map((row) => row.map(quoteCsv).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${project.name}_核算结果.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  const shared = { project, setProject, fileName, notice, importFile, importBusy, pendingImport, setPendingImport, confirmImport, cancelImport: () => setPendingImport(null), restore, stats, optimized, candidates, addCandidate, removeCandidate, selectedCandidates, setSelectedCandidates, selectedAlternatives, benchmark, setBenchmark, climate, setClimate, routes, setRoutes, transportResult, siteResult, operationResult, finance, setFinance, update, go, messages, ask, aiConfig, updateAIConfig, aiConnection, aiBusy, testAI, isReference, exportCsv, agentEvidence, auditRun, agentRun, agentBusy, agentStage, agentError, rerunAgent: (question) => { if (typeof question === "string") setAgentPrompt(question); setAgentRetry((value) => value + 1); } };
  const petPage = screen === "landing" ? "landing" : view;
  const petLabel = screen === "landing" ? "项目首页" : NAV.find(([id]) => id === view)?.[1];
  const petContext = buildProjectContext({ project, fileName, stats, optimized, selectedAlternatives, benchmark, isReference, transportResult, siteResult, operationResult });
  const pet = <ProjectPet page={petPage} pageName={petLabel} action={petAction} context={petContext} config={aiConfig} connection={aiConnection} go={go} />;
  if (screen === "landing") return <PortalLanding enter={() => setScreen(aiConnection.status === "ready" ? "workspace" : "setup")} />;
  if (screen === "setup") return <ModelSetup config={aiConfig} update={updateAIConfig} connection={aiConnection} busy={aiBusy} test={testAI} enter={() => { setScreen("workspace"); setView("agent"); }} />;
  if (view === "agent") return <AgentWorkbench {...shared} openSetup={() => setScreen("setup")}/>;
  const label = NAV.find(([id]) => id === view)?.[1];
  const recordPetField = (event) => {
    if (view === "advisor" || !event.target.matches("input, select, textarea")) return;
    const title = event.target.closest("label")?.textContent?.trim().slice(0, 36) || event.target.getAttribute("aria-label") || "项目输入";
    setPetAction({ label: `更新了${title}`, at: Date.now() });
  };
  const recordPetClick = (event) => {
    const button = event.target.closest("button");
    const title = button?.textContent?.trim().slice(0, 35);
    if (title && /添加|删除|选择|选入|移除|确认|恢复|导入|计算/.test(title)) setPetAction({ label: `点击了“${title}”`, at: Date.now() });
  };
  return <><div className="shell">
    <aside className={`side ${menu ? "open" : ""}`}>
      <button className="brand" onClick={() => setScreen("landing")}><i><Leaf size={21} /></i><span><b>CarbonIQ</b><small>建筑碳排放</small></span></button>
      <div className="project"><small>当前项目</small><b>{project.name}</b><span><i />{isReference ? "内置材料清单" : "已导入材料清单"}</span></div>
      <nav>{PRIMARY_NAV.map(([id, text, Icon]) => <button className={view === id ? "active" : ""} key={id} onClick={() => go(id)}><Icon size={18} /><span>{text}</span><ChevronRight size={14} /></button>)}</nav>
      <div className="side-foot"><Database size={17} /><span><b>A1–A3 / A4 / A5 / B6</b><small>按已上传记录分阶段核算</small></span></div>
    </aside>
    {menu && <button className="backdrop" onClick={() => setMenu(false)} />}
    <main className="main">
      <button style={{ position: "fixed", right: 18, bottom: 18, zIndex: 80, border: "1px solid #a7d9b9", background: "#eaf8ee", color: "#1b7950", borderRadius: 999, padding: "9px 14px", boxShadow: "0 8px 24px #163f2522", fontSize: 11, cursor: "pointer" }} onClick={() => setScreen("setup")}>模型设置 · {aiConfig.model}</button>
      <header className="top"><button className="menu" onClick={() => setMenu(true)}><Menu size={21} /></button><div><span>工作台</span><ChevronRight size={14} /><b>{label}</b></div><section><span><FileSpreadsheet size={15} />{fileName}</span><button onClick={() => go("upload")}><Upload size={16} />导入数据</button><i>CI</i></section></header>
      <div className="content" key={view} onBlurCapture={recordPetField} onClickCapture={recordPetClick}><View id={view} {...shared} /></div>
    </main>
  </div>{pet}</>;
}

function Landing({ stats, optimized, selectedCount, enter }) {
  return <div className="landing">
    <nav className="landing-nav"><button className="logo"><i><Leaf size={21} /></i><b>CarbonIQ</b></button><div><a href="#solution">解决方案</a><a href="#flow">工作流程</a><a href="#boundary">数据说明</a></div><button className="nav-cta" onClick={enter}>进入平台 <ArrowRight size={16} /></button></nav>
    <main className="hero"><section><span className="tag"><Sparkles size={14} />宿舍楼碳排放分析</span><h1>从材料清单出发，<br /><em>比较不同方案的排放。</em></h1><p>材料生产、运输与运营能耗分阶段计算；现场施工待补。</p><div className="hero-actions"><button onClick={enter}>查看当前项目 <ArrowRight size={17} /></button><a href="#flow">查看使用流程</a></div><div className="trust"><span><CheckCircle2 size={15} />A1–A3逐项计算</span><span><CheckCircle2 size={15} />A4路线输入</span><span><CheckCircle2 size={15} />B6能流可视化</span></div></section><Console stats={stats} optimized={optimized} selectedCount={selectedCount} /></main>
    <section className="landing-numbers"><div><b>{fmt.format(stats.tonnes)}</b><span>tCO₂e · 材料生产</span></div><div><b>{fmt.format(stats.intensity)}</b><span>kgCO₂e/m²</span></div><div><b>{stats.rows.length}</b><span>项材料</span></div><div><b>{selectedCount}</b><span>项已选替代</span></div></section>
    <section className="solution" id="solution"><header><span>当前功能</span><h2>导入、计算、比较、导出</h2></header><div>{[[FileSearch,"导入材料清单","读取Excel或CSV中的材料、数量、单位和因子。"],[Calculator,"核算材料排放","查看各项材料的数量、因子与排放量。"],[Recycle,"比较材料方案","录入候选产品因子后比较相同用量下的排放。"],[Bot,"咨询AI顾问","结合当前数据回答问题，并指出缺失信息。"]].map(([Icon,title,text],i)=><article key={title}><span>0{i+1}</span><Icon size={23}/><h3>{title}</h3><p>{text}</p><ChevronRight size={17}/></article>)}</div></section>
    <section className="flow" id="flow"><span>使用流程</span><h2>四步完成当前阶段分析</h2><ol>{[["01","导入清单","Excel / CSV"],["02","核对因子","来源与单位"],["03","查看热点","材料贡献"],["04","比较方案","情景 / 报告"]].map(([i,t,s])=><li key={i}><b>{i}</b><strong>{t}</strong><small>{s}</small></li>)}</ol></section>
    <section className="boundary" id="boundary"><ShieldCheck size={23}/><div><b>分阶段核算，不混用边界</b><p>A4、A5 与 B6 只有录入完整记录后才计算。工程量和因子适用性需核实。</p></div><button onClick={enter}>查看工作台</button></section>
    <footer><span><Leaf size={16}/>CarbonIQ · 宿舍楼碳排放分析</span><small>项目数据由用户核实</small></footer>
  </div>;
}

function Console({ stats, optimized, selectedCount }) {
  return <section className="console"><header><i/><i/><i/><span>宿舍楼项目 / 概览</span><small>当前清单</small></header><main><div className="console-title"><span>材料生产排放</span><b>{fmt.format(stats.tonnes)}<small> tCO₂e</small></b><em><TrendingDown size={14}/>{selectedCount ? `已选方案变化 ${(optimized.rate*100).toFixed(1)}%` : "尚未选择替代方案"}</em></div><div className="fake-bars">{stats.rows.map((row)=><i key={row.id} style={{height:`${Math.max(8,row.emission/Math.max(1,stats.hotspot.emission)*94)}%`}} />)}</div><div className="console-stats"><div><span>排放强度</span><b>{fmt.format(stats.intensity)}</b><small>kgCO₂e/m²</small></div><div><span>最大热点</span><b>{stats.total ? (stats.hotspot.emission/stats.total*100).toFixed(1) : 0}%</b><small>{stats.hotspot.name}</small></div><div><span>材料条目</span><b>{stats.rows.length}</b><small>项</small></div></div></main><aside><Zap size={17}/><span><small>优先核查</small><b>{stats.hotspot.name}的用量和因子</b></span></aside></section>;
}

function Header({ kicker, title, text, children }) { return <header className="page-head"><div><span>{kicker}</span><h1>{title}</h1>{text && <p>{text}</p>}</div>{children && <section>{children}</section>}</header>; }
function PanelTitle({ kicker, title, note }) { return <div className="panel-title"><span><small>{kicker}</small><b>{title}</b></span>{note && <em>{note}</em>}</div>; }

function View({ id, ...props }) {
  if (id === "dashboard") return <Dashboard {...props}/>;
  if (id === "twin") return <React.Suspense fallback={<div className="panel twin-loading"><span>CARBON TWIN</span><b>正在加载 3D 建筑模型…</b></div>}><CarbonTwin {...props}/></React.Suspense>;
  if (id === "upload") return <UploadPage {...props}/>;
  if (id === "calculator") return <CalculatorPage {...props}/>;
  if (id === "materials") return <MaterialsPage {...props}/>;
  if (id === "simulator") return <SimulatorPage {...props}/>;
  if (id === "transport") return <TransportPage {...props}/>;
  if (id === "climate") return <OperationPage {...props}/>;
  if (id === "credits") return <CreditsPage {...props}/>;
  if (id === "report") return <ReportPageV2 {...props}/>;
  return <AdvisorPage {...props}/>;
}

function Dashboard({ project, stats, optimized, selectedAlternatives, benchmark, setBenchmark, transportResult, operationResult, go }) {
  const chart = stats.rows.map((r)=>({name:r.name.replace(/（.*?）/g,""),value:Math.round(r.emission/1000)}));
  const benchmarkValue=Number(benchmark.intensity);
  const comparable=benchmark.confirmed && benchmark.intensity!=="" && benchmarkValue>0 && benchmark.source.trim();
  const gap=comparable ? (stats.intensity/benchmarkValue-1)*100 : null;
  return <><Header kicker="项目总览" title={project.name} text="材料生产、运输与运营能耗分阶段呈现；尚无数据的阶段保持待输入。"><button className="outline" onClick={()=>go("transport")}><Recycle size={16}/>材料运输</button><button className="solid" onClick={()=>go("climate")}><CloudSun size={16}/>运营能流</button></Header>
    <section className="metrics"><Metric title="材料生产排放" value={fmt.format(stats.tonnes)} unit="tCO₂e" note="A1–A3" icon={Globe2} featured/><Metric title="单位面积强度" value={fmt.format(stats.intensity)} unit="kgCO₂e/m²" note={`${fmt.format(project.area)} m² 建筑面积`} icon={Gauge}/><Metric title="最大材料热点" value={`${stats.total?(stats.hotspot.emission/stats.total*100).toFixed(1):0}%`} note={stats.hotspot.name} icon={BarChart3}/><Metric title="方案变化" value={selectedAlternatives.length?fmt.format(optimized.rate*100):"—"} unit={selectedAlternatives.length?"%":""} note={selectedAlternatives.length?"基于已选候选产品":"尚未选择候选产品"} icon={TrendingDown}/></section>
    <section className="phase-overview"><button onClick={()=>go("transport")}><span>A4 / 运输</span><b>{transportResult.hasData?`${fmt3.format(transportResult.kg/1000)} tCO₂e`:"待输入"}</b><small>{transportResult.incomplete?`${transportResult.incomplete} 条路线未补齐`:"按路线核算"}</small><ArrowRight size={17}/></button><button onClick={()=>go("climate")}><span>B6 / 运营能耗</span><b>{operationResult.annualKg!==null?`${fmt3.format(operationResult.annualKg/1000)} tCO₂e/年`:"待输入"}</b><small>电力与可选燃气 · 3D 能流</small><ArrowRight size={17}/></button><div><span>A5 / 现场建造</span><b>尚未计算</b><small>不归入运营</small></div></section>
    <section className="dash-grid"><article className="panel chart"><PanelTitle kicker="材料分析" title="材料排放贡献" note="单位：tCO₂e"/><div><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{top:25,right:8,left:-20,bottom:0}}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5ece9"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:11,fill:"#61756e"}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:11,fill:"#81918c"}}/><Tooltip/><Bar dataKey="value" radius={[6,6,0,0]}>{chart.map((_,i)=><Cell key={i} fill={colors[i]}/>) }<LabelList dataKey="value" position="top" fontSize={11}/></Bar></BarChart></ResponsiveContainer></div></article><aside className="panel insight"><PanelTitle kicker="待核查" title="下一步"/><div className="priority"><b>01</b><span><strong>核查{stats.hotspot.name}</strong><p>先确认工程量、规格与碳因子来源。</p></span></div><ul><li><CheckCircle2 size={15}/>{stats.rows.length} 项材料已载入</li><li><CheckCircle2 size={15}/>逐项显示数量与因子</li><li><FileSearch size={15}/>工程量与适用性待核实</li></ul><button onClick={()=>go("materials")}>比较候选材料 <ArrowRight size={16}/></button></aside></section>
    <section className="panel benchmark-tool"><div><h2>与可比基准比较</h2><p>仅有总量或强度，不能判断排放水平。请使用同类建筑、同一 A1–A3 边界且材料覆盖相近的基准。</p></div><label>基准强度（kgCO₂e/m²）<input type="number" min="0" step="any" value={benchmark.intensity} onChange={(e)=>setBenchmark({...benchmark,intensity:e.target.value,confirmed:false})} placeholder="填写可比项目的数值"/></label><label>基准来源<input value={benchmark.source} onChange={(e)=>setBenchmark({...benchmark,source:e.target.value,confirmed:false})} placeholder="报告名称或链接"/></label><label className="benchmark-confirm"><input type="checkbox" checked={benchmark.confirmed} onChange={(e)=>setBenchmark({...benchmark,confirmed:e.target.checked})}/>我已核对边界和建筑类型可比</label><strong>{gap===null?"请填写并确认可比基准":`比所填基准${gap>=0?"高":"低"} ${fmt.format(Math.abs(gap))}%`}</strong></section>
    <MaterialTable rows={stats.rows} compact/></>;
}

function Metric({title,value,unit,note,icon:Icon,featured}) { return <article className={`metric ${featured?"featured":""}`}><header><span>{title}</span><Icon size={18}/></header><b>{value}<small>{unit}</small></b><p>{note}</p></article>; }

function UploadPage({project,setProject,fileName,notice,importFile,restore}) {
  const ref=useRef(); return <><Header kicker="数据导入" title="材料清单" text="导入包含材料、数量、单位和碳因子的 Excel 或 CSV。"><button className="outline" onClick={restore}><RefreshCw size={16}/>恢复内置清单</button></Header><section className="upload-grid"><article className="drop"><input ref={ref} hidden type="file" accept=".xlsx,.csv" onChange={(e)=>importFile(e.target.files?.[0])}/><i><Upload size={28}/></i><h2>选择材料清单</h2><p>支持 .xlsx 与 .csv；缺少数量、单位或碳因子的行会提示错误，不会补成零。</p><button className="solid" onClick={()=>ref.current?.click()}>选择文件</button><small>当前文件：{fileName}</small><a className="download-reference" href="/公开因子_估算工程量_宿舍楼.csv" download>下载内置清单</a></article><article className="panel form"><PanelTitle kicker="项目信息" title="项目基础信息"/><label>项目名称<input value={project.name} onChange={(e)=>setProject({...project,name:e.target.value})}/></label><div><label>建筑面积（m²）<input type="number" min="1" value={project.area} onChange={(e)=>setProject({...project,area:Math.max(1,number(e.target.value))})}/></label><label>地上层数<input type="number" min="1" max="20" value={project.floors} onChange={(e)=>setProject({...project,floors:Math.min(20,Math.max(1,Math.round(number(e.target.value))))})}/></label></div><label>结构形式<input value={project.structure} onChange={(e)=>setProject({...project,structure:e.target.value})}/></label><p className="notice" role="status"><Database size={16}/>{notice}</p></article></section></>;
}

function CalculatorPage({stats,update,go}) { return <><Header kicker="材料核算" title="材料排放计算" text="修改数量或碳因子，结果会立即更新。"><button className="solid" onClick={()=>go("simulator")}><SlidersHorizontal size={16}/>比较方案</button></Header><div className="formula formula-clear"><span>材料排放合计</span><b>数量 × 碳因子，逐项相加</b><strong>{fmt.format(stats.tonnes)} tCO₂e</strong></div><article className="panel table-wrap"><table><thead><tr><th>编号</th><th>构件</th><th>材料</th><th>单位</th><th>数量</th><th>碳因子</th><th>排放</th></tr></thead><tbody>{stats.rows.map((r,i)=><tr key={r.id}><td>{r.id}</td><td>{r.part}</td><td><b>{r.name}</b><small>{r.source}</small></td><td>{r.unit}</td><td><input type="number" value={r.quantity} onChange={(e)=>update(i,"quantity",e.target.value)}/></td><td><input type="number" value={r.factor} onChange={(e)=>update(i,"factor",e.target.value)}/></td><td className="emission">{fmt.format(r.emission)} kg</td></tr>)}</tbody><tfoot><tr><td colSpan="6">合计</td><td>{fmt.format(stats.total)} kgCO₂e</td></tr></tfoot></table></article></>;
}

function MaterialsPage({stats,candidates,addCandidate,removeCandidate,selectedCandidates,setSelectedCandidates,go}) {
  const [draft, setDraft] = useState({ materialId: stats.rows[0]?.id || "", name: "", factor: "", source: "", specification: "" });
  const [error, setError] = useState("");
  const baseline = stats.rows.find((row) => row.id === draft.materialId) || stats.rows[0];
  const submit = (event) => {
    event.preventDefault();
    const factor = Number(draft.factor);
    if (!baseline || !draft.name.trim() || !draft.source.trim() || !draft.specification.trim() || !Number.isFinite(factor) || factor <= 0) {
      setError("请填写候选名称、正数碳因子、数据来源及关键规格。"); return;
    }
    addCandidate({ materialId: baseline.id, name: draft.name.trim(), factor, source: draft.source.trim(), specification: draft.specification.trim() });
    setDraft({ ...draft, name: "", factor: "", source: "", specification: "" });
    setError("");
  };
  return <><Header kicker="材料比较" title="比较候选材料"><button className="solid" onClick={()=>go("simulator")}><SlidersHorizontal size={16}/>查看组合方案</button></Header>
    <section className="material-tool">
      <form className="panel tool-form" onSubmit={submit}>
        <h2>添加候选产品</h2>
        <label>替代清单项<select value={draft.materialId} onChange={(e)=>setDraft({...draft,materialId:e.target.value})}>{stats.rows.map((row)=><option key={row.id} value={row.id}>{row.name} · {row.id}</option>)}</select></label>
        <label>候选产品名称<input value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})} placeholder="填写具体产品或型号"/></label>
        <label>碳因子（kgCO₂e/{baseline?.unit}）<input type="number" min="0" step="any" value={draft.factor} onChange={(e)=>setDraft({...draft,factor:e.target.value})} placeholder="与基准材料同单位"/></label>
        <label>因子来源<input value={draft.source} onChange={(e)=>setDraft({...draft,source:e.target.value})} placeholder="EPD编号、报告名称或链接"/></label>
        <label>关键规格<input value={draft.specification} onChange={(e)=>setDraft({...draft,specification:e.target.value})} placeholder="强度等级、尺寸或性能等级"/></label>
        {error && <p className="tool-error" role="alert">{error}</p>}
        <button className="solid" type="submit">加入候选</button>
        <p className="tool-note">按相同用量比较；规格、耐久性、价格和供应可得性仍需核验。</p>
      </form>
      <div className="panel candidate-list"><h2>已录入候选</h2>{candidates.length ? candidates.map((candidate)=>{
        const row=stats.rows.find((item)=>item.id===candidate.materialId);
        if (!row) return null;
        const delta=row.quantity*(row.factor-candidate.factor)/1000;
        return <article key={candidate.id}><div><b>{candidate.name}</b><small>替代 {row.name} · {candidate.specification}</small><small>来源：{candidate.source}</small></div><div><strong className={delta<0?"worse":""}>{delta>=0?"减少":"增加"} {fmt.format(Math.abs(delta))} tCO₂e</strong><small>按 {fmt.format(row.quantity)} {row.unit} 计算</small><button onClick={()=>setSelectedCandidates((current)=>({...current,[row.id]:candidate.id}))}>{selectedCandidates[row.id]===candidate.id?"已选入方案":"选入方案"}</button><button className="text-danger" onClick={()=>removeCandidate(candidate.id)}>删除</button></div></article>;
      }) : <p className="tool-empty">还没有候选产品。录入可比的产品因子后，这里会显示差额。</p>}</div>
    </section><MaterialTable rows={stats.rows}/></>;
}

function SimulatorPage({stats,optimized,candidates,selectedCandidates,setSelectedCandidates,go}) {
  const count=Object.values(selectedCandidates).filter(Boolean).length;
  return <><Header kicker="方案比较" title="材料组合方案" text="仅替换已录入候选产品的碳因子，用量保持不变。"><button className="outline" onClick={()=>setSelectedCandidates({})}><RefreshCw size={16}/>清空选择</button></Header><section className="sim-grid"><article className="panel tool-form"><h2>选择候选产品</h2>{stats.rows.map((row)=><label key={row.id}>{row.name}<select value={selectedCandidates[row.id] || ""} onChange={(e)=>setSelectedCandidates((current)=>({...current,[row.id]:e.target.value}))}><option value="">使用基准材料</option>{candidates.filter((item)=>item.materialId===row.id).map((item)=><option value={item.id} key={item.id}>{item.name} · {fmt.format(item.factor)} kgCO₂e/{row.unit}</option>)}</select></label>)}<button className="outline" onClick={()=>go("materials")}>添加候选产品 <ArrowRight size={15}/></button></article><article className="result"><span><Leaf size={16}/>已选 {count} 项替代</span><p>材料生产排放变化</p><b>{optimized.reduction>=0?"−":"+"}{fmt.format(Math.abs(optimized.reduction/1000))}<small> tCO₂e</small></b><strong>{optimized.reduction>=0?"下降":"上升"} {fmt.format(Math.abs(optimized.rate*100))}%</strong><div><span><small>基准</small>{fmt.format(stats.tonnes)} t</span><ArrowRight/><span><small>候选方案</small>{fmt.format(optimized.total/1000)} t</span></div><p>{count ? "结果仅代表同用量、同单位的因子比较；尚未验证性能、成本和采购条件。" : "尚未选择候选产品，当前方案与基准相同。"}</p></article></section><article className="panel compare"><PanelTitle kicker="计算对比" title="A1–A3 材料生产"/><div><span>基准清单</span><i><b/></i><strong>{fmt.format(stats.tonnes)} t</strong></div><div><span>候选组合</span><i><b style={{width:`${stats.total ? Math.min(100,optimized.total/stats.total*100) : 0}%`}}/></i><strong>{fmt.format(optimized.total/1000)} t</strong></div><button onClick={()=>go("report")}>查看报告 <ArrowRight size={15}/></button></article></>;
}

function TransportPage({ routes, setRoutes, transportResult, go }) {
  const addRoute = () => setRoutes((current) => [...current, { id: crypto.randomUUID(), material: "", origin: "", destination: "", mass: "", distance: "", factor: "", source: "" }]);
  const changeRoute = (id, key, value) => setRoutes((current) => current.map((route) => route.id === id ? { ...route, [key]: value } : route));
  const removeRoute = (id) => setRoutes((current) => current.filter((route) => route.id !== id));
  return <div className="lifecycle-page">
    <Header kicker="A4 / TRANSPORT" title="材料运输" text="逐条填写从生产地到施工现场的运输路线；没有资料的路线不会被当作零排放。"><button className="solid" onClick={addRoute}><ArrowRight size={16}/>添加路线</button></Header>
    <section className="phase-ribbon"><span className="complete">A1–A3 材料生产</span><span className="active">A4 材料运输</span><span>A5 现场建造 · 待补</span><span>B6 运营能耗</span></section>
    <div className="transport-hero"><div><small>TRANSPORT LEDGER</small><h2>从出厂到现场，逐段计算。</h2><p>每条路线的排放 = 货物质量（t）× 单程距离（km）× 运输排放因子（kgCO₂e/t·km）。若因子已含空载返程，不要再次计入；否则需另列返程路线。</p></div><div className="route-graphic" aria-hidden="true"><span>生产地</span><i/><b>●</b><i/><span>施工现场</span></div><div className="hero-number"><small>已完整填写路线的 A4 小计</small><strong>{transportResult.hasData ? fmt3.format(transportResult.kg / 1000) : "—"}</strong><span>tCO₂e</span></div></div>
    {routes.length === 0 ? <div className="panel route-empty"><Layers3 size={28}/><b>尚无运输路线</b><p>先添加一条路线，再填写质量、距离和适用的运输因子。页面不会生成假路线。</p><button className="outline" onClick={addRoute}>添加第一条路线</button></div> : <div className="route-list">{routes.map((route, index) => {
      const calculated = transportResult.rows.find((row) => row.id === route.id);
      return <article className="panel route-card" key={route.id}><header><span>ROUTE {String(index + 1).padStart(2, "0")}</span><strong>{calculated ? `${fmt3.format(calculated.kg / 1000)} tCO₂e` : "待补齐"}</strong><button aria-label={`删除路线 ${index + 1}`} onClick={() => removeRoute(route.id)}><X size={17}/></button></header><div className="route-fields">
        <label>材料或批次<input value={route.material} onChange={(e) => changeRoute(route.id, "material", e.target.value)} placeholder="例如：混凝土批次"/></label>
        <label>生产地<input value={route.origin} onChange={(e) => changeRoute(route.id, "origin", e.target.value)} placeholder="生产厂或城市"/></label>
        <label>施工现场<input value={route.destination} onChange={(e) => changeRoute(route.id, "destination", e.target.value)} placeholder="目的地"/></label>
        <label>该路线累计货物质量（t）<input type="number" min="0" step="any" value={route.mass} onChange={(e) => changeRoute(route.id, "mass", e.target.value)} placeholder="多车次填累计吨数"/></label>
        <label>单程距离（km）<input type="number" min="0" step="any" value={route.distance} onChange={(e) => changeRoute(route.id, "distance", e.target.value)} placeholder="请输入公里数"/></label>
        <label>运输因子（kgCO₂e/t·km）<input type="number" min="0" step="any" value={route.factor} onChange={(e) => changeRoute(route.id, "factor", e.target.value)} placeholder="按运输方式查证"/></label>
        <label className="route-source">路线与因子来源<input value={route.source} onChange={(e) => changeRoute(route.id, "source", e.target.value)} placeholder="例如：运输单、里程记录、因子报告"/></label>
      </div><footer>{calculated ? `${fmt.format(calculated.tonneKilometres)} t·km × ${route.factor} kgCO₂e/t·km` : "填写材料、起终点、来源，以及正数质量、距离、因子后才计入小计"}</footer></article>;
    })}</div>}
    <div className="lifecycle-note"><ShieldCheck size={18}/><p>{transportResult.incomplete > 0 ? `${transportResult.incomplete} 条路线未填完整；当前数字只是已完整路线的小计。` : "运输因子、运输方式、载重率和返程处理需要与来源保持一致。"} 建造现场的机械和能源属于 A5，不计入 A4，也不属于 B6。</p><button onClick={() => go("climate")}>查看运营能耗 <ArrowRight size={15}/></button></div>
  </div>;
}

function OperationPage({ climate, setClimate, operationResult, project, go }) {
  const zones = ["严寒", "寒冷", "夏热冬冷", "夏热冬暖", "温和"];
  const change = (key, value) => setClimate((current) => ({ ...current, [key]: value }));
  const annualTonnes = operationResult.annualKg === null ? null : operationResult.annualKg / 1000;
  return <div className="lifecycle-page">
    <Header kicker="B6 / OPERATION" title="运营能耗" text="填入年度用电与可选燃气数据，观察能源流向和逐年排放。3D 仅示意能流，不表示真实设备或楼层用能。"><button className="outline" onClick={() => go("transport")}>查看 A4 运输</button></Header>
    <section className="phase-ribbon"><span className="complete">A1–A3 材料生产</span><span>A4 材料运输</span><span>A5 现场建造 · 待补</span><span className="active">B6 运营能耗</span></section>
    <div className="operation-grid"><div className="operation-visual"><React.Suspense fallback={<div className="operation-loading">正在加载运营能流模型…</div>}><OperationTwin floors={project.floors} electricityActive={operationResult.electricityKg !== null} gasActive={operationResult.gasKg !== null}/></React.Suspense><div className="operation-overlay"><span>INTERACTIVE ENERGY FLOW</span><strong>{project.name}</strong><small>拖动旋转 · 滚轮缩放</small></div><div className="operation-legend"><span><i className="electricity-dot"/>电力</span><span><i className="gas-dot"/>燃气</span><span>粒子仅示意路径，不按排放量缩放</span></div></div><aside className="operation-results"><div className="operation-total"><small>已录入能源的年度排放</small><strong>{annualTonnes === null ? "—" : fmt.format(annualTonnes)}</strong><span>tCO₂e / 年</span></div><div className="operation-result-row"><span>电力</span><b>{operationResult.electricityKg === null ? "待输入" : `${fmt.format(operationResult.electricityKg / 1000)} tCO₂/年`}</b></div><div className="operation-result-row"><span>燃气</span><b>{operationResult.gasKg === null ? "未计入" : `${fmt.format(operationResult.gasKg / 1000)} tCO₂e/年`}</b></div><div className="operation-result-row"><span>单位面积</span><b>{annualTonnes === null ? "—" : `${fmt.format(operationResult.annualKg / project.area)} kgCO₂e/(m²·年)`}</b></div><div className="operation-horizon"><small>{operationResult.years || "—"} 年恒定因子情景</small><b>{operationResult.horizonKg === null ? "—" : `${fmt.format(operationResult.horizonKg / 1000)} tCO₂e`}</b><p>仅为年度结果乘以年数；未预测逐年能耗、电网变化或设备更换。</p></div></aside></div>
    <section className="operation-inputs"><article className="panel tool-form"><h2>位置与核算年限</h2><label>项目城市<input value={climate.city} onChange={(e) => change("city", e.target.value)} placeholder="填写城市，不自动推断气候分区"/></label><label>气候分区<select value={climate.zone} onChange={(e) => change("zone", e.target.value)}><option value="">请选择</option>{zones.map((zone) => <option key={zone}>{zone}</option>)}</select></label><label>情景年限（年）<input type="number" min="1" max="100" step="1" value={climate.years} onChange={(e) => change("years", e.target.value)}/></label><p className="tool-note">气候分区用于记录项目条件，不会自动生成能耗预测。</p></article><article className="panel tool-form"><h2>年度电力</h2><label>用电量（kWh/年）<input type="number" min="0" step="any" value={climate.annualElectricity} onChange={(e) => change("annualElectricity", e.target.value)} placeholder="电费账单或能耗模型"/></label><label>排放因子（kgCO₂/kWh）<input type="number" min="0" step="any" value={climate.electricityFactor} onChange={(e) => change("electricityFactor", e.target.value)}/></label><p className="tool-note">初始因子 0.5306 为 2023 年全国平均电力二氧化碳排放因子；请按项目年份和地区核实。<a href="https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html" target="_blank" rel="noreferrer">因子来源</a></p></article><article className="panel tool-form"><h2>年度燃气（可选）</h2><label>用气量（m³/年）<input type="number" min="0" step="any" value={climate.annualGas} onChange={(e) => change("annualGas", e.target.value)} placeholder="没有数据可留空"/></label><label>排放因子（kgCO₂e/m³）<input type="number" min="0" step="any" value={climate.gasFactor} onChange={(e) => change("gasFactor", e.target.value)} placeholder="与气体类型和因子边界一致"/></label><p className="tool-note">不预设燃气因子；填写用气量但缺少因子时，不会把燃气当作零排放。</p></article></section>
    <div className="lifecycle-note"><ShieldCheck size={18}/><p>{operationResult.gasIncomplete ? "燃气数据未填完整，目前总数仅含已算出的能源。" : "当前结果仅含已录入的电力和燃气。"} 其他运营能源、维护与更换未纳入；A5 现场建造不属于运营。</p></div>
  </div>;
}

function ClimatePage({climate,setClimate,project}) {
  const zones=[["严寒地区","保温与供暖负荷"],["寒冷地区","围护与供暖负荷"],["夏热冬冷","遮阳、保温与空调负荷"],["夏热冬暖","遮阳与制冷负荷"],["温和地区","自然通风与设备能耗"]];
  const energy=Number(climate.annualElectricity);
  const factor=Number(climate.electricityFactor);
  const canCalculate=climate.annualElectricity!=="" && energy>=0 && climate.electricityFactor!=="" && factor>0;
  const annualTonnes=canCalculate ? energy*factor/1000 : null;
  return <><Header kicker="运营输入" title="气候与用电" text="由你选择项目气候分区，并输入实际或估算的年度用电量。"/><section className="climate-tool"><article className="panel tool-form"><h2>项目位置与用电</h2><label>项目城市<input value={climate.city} onChange={(e)=>setClimate({...climate,city:e.target.value})} placeholder="例如：项目所在城市"/></label><label>年度用电量（kWh）<input type="number" min="0" step="any" value={climate.annualElectricity} onChange={(e)=>setClimate({...climate,annualElectricity:e.target.value})} placeholder="从电费账单或能耗模拟取得"/></label><label>电力排放因子（kgCO₂/kWh）<input type="number" min="0" step="any" value={climate.electricityFactor} onChange={(e)=>setClimate({...climate,electricityFactor:e.target.value})}/></label><p className="tool-note">初始值 0.5306 为 2023 年全国平均电力二氧化碳排放因子。地区或年份不同，请自行调整。<a href="https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html" target="_blank" rel="noreferrer">查看来源</a></p></article><article className="panel climate-result"><small>年度用电排放</small><b>{annualTonnes===null?"待输入":fmt.format(annualTonnes)}{annualTonnes!==null&&<em> tCO₂/年</em>}</b><p>{climate.city||"未填写城市"} · {climate.zone||"未选择气候分区"}</p><p>{annualTonnes!==null&&project.area>0?`约 ${fmt.format(annualTonnes*1000/project.area)} kgCO₂/(m²·年)` : "填入全年用电量后显示单位面积结果。"}</p><p className="tool-note">这里只计算用电，不等于完整运营排放；供暖、燃气等能源尚未纳入。</p></article></section><section className="zones">{zones.map(([name,focus])=><button type="button" className={`zone-option ${climate.zone===name?"active":""}`} aria-pressed={climate.zone===name} key={name} onClick={()=>setClimate({...climate,zone:name})}><Globe2 size={20}/><span>{climate.zone===name?"已选择":"选择分区"}</span><h3>{name}</h3><p>{focus}</p></button>)}</section><p className="tool-note">分区不会自动由城市推断，也不会凭分区推算用电量。</p></>;
}

function CreditsPage({optimized,finance,setFinance,selectedAlternatives,go}) {
  const tonnes=optimized.reduction/1000;
  const price=Number(finance.carbonPrice);
  const cost=Number(finance.addedCost);
  const hasPrice=finance.carbonPrice!=="" && Number.isFinite(price) && price>=0;
  const hasCost=finance.addedCost!=="" && Number.isFinite(cost) && cost>=0;
  const valid=selectedAlternatives.length>0 && tonnes>0 && hasPrice;
  const gross=valid?tonnes*price:null;
  const net=valid&&hasCost?gross-cost:null;
  return <><Header kicker="成本输入" title="减排价值测算" text="用你设定的内部碳价和增量成本比较材料方案，不代表碳信用或市场成交价。"/><section className="credit-grid"><article className="panel tool-form"><h2>测算参数</h2><label>内部碳价（元/tCO₂e）<input type="number" min="0" step="any" value={finance.carbonPrice} onChange={(e)=>setFinance({...finance,carbonPrice:e.target.value})} placeholder="由项目方设定"/></label><label>替代方案增量成本（元）<input type="number" min="0" step="any" value={finance.addedCost} onChange={(e)=>setFinance({...finance,addedCost:e.target.value})} placeholder="没有成本资料可先留空"/></label><p className="tool-note">计算式：减排量 × 内部碳价；净值再减去增量成本。若候选方案排放增加，则不计算减排价值。</p><button className="outline" onClick={()=>go("simulator")}>选择材料方案 <ArrowRight size={15}/></button></article><article className="panel value value-live"><PanelTitle kicker="计算结果" title="方案测算"/><b>{gross===null?"待输入":`¥${fmt.format(gross)}`}</b><p>减排量：{tonnes>0?fmt.format(tonnes):"0"} tCO₂e · 已选 {selectedAlternatives.length} 项替代</p><code>{gross===null?"选择减排方案并填写内部碳价后计算":`${fmt.format(tonnes)} tCO₂e × ¥${fmt.format(price)}/tCO₂e`}</code><strong>{net===null?"增量成本未填写或尚不能计算净值":`扣除增量成本后：¥${fmt.format(net)}`}</strong></article></section></>;
}

function ReportPage({project,stats,optimized,selectedAlternatives,fileName,exportCsv,isReference,benchmark,climate}) {
  const benchmarkValue=Number(benchmark.intensity);
  const energy=Number(climate.annualElectricity), factor=Number(climate.electricityFactor);
  const electricity=climate.annualElectricity!==""&&energy>=0&&factor>0?energy*factor/1000:null;
  return <><Header kicker="分析摘要" title="项目报告" text="汇总输入、计算结果及仍需核实的项目数据。"><button className="outline" onClick={exportCsv}><Download size={16}/>导出CSV</button><button className="solid" onClick={()=>window.print()}><FileText size={16}/>打印PDF</button></Header><article className="report"><header><div><span>BUILDING CARBON BRIEF</span><h2>{project.name}</h2><p>A1–A3 材料生产</p></div><b>DORM-LCA</b></header><section className="report-metrics"><div><span>建筑面积</span><b>{fmt.format(project.area)} m²</b></div><div><span>材料生产排放</span><b>{fmt.format(stats.tonnes)} tCO₂e</b></div><div><span>排放强度</span><b>{fmt.format(stats.intensity)} kgCO₂e/m²</b></div><div><span>候选方案变化</span><b>{selectedAlternatives.length?`${fmt.format(optimized.rate*100)}%`:"未选择"}</b></div></section><section><small>01 / 数据与计算</small><h3>最大材料贡献：{stats.hotspot.name}</h3><p>清单“{fileName}”含 {stats.rows.length} 项材料。{isReference?"当前工程量为估算值；请用项目清单替换。":"导入数据的工程量、单位和因子来源仍需核实。"} 排放量 = 工程量 × 对应单位碳因子。</p></section><div className="report-cols"><section><small>02 / 候选方案</small><h3>同用量比较</h3><p>{selectedAlternatives.length?`已选 ${selectedAlternatives.length} 项候选产品，材料生产排放${optimized.reduction>=0?"减少":"增加"} ${fmt.format(Math.abs(optimized.reduction/1000))} tCO₂e。` : "尚未选择候选产品，没有减排结论。"} 产品规格、成本和可采购性未自动校核。</p></section><section><small>03 / 项目范围</small><h3>生产、运输、施工、运营</h3><p>目前只完成 A1–A3。A4 运输和 A5 施工未计算；{electricity===null?"运营用电未计算":"运营用电初步估算为 "+fmt.format(electricity)+" tCO₂/年，但不代表完整运营排放"}。</p></section></div><section><small>04 / 判断边界</small><p>{benchmark.confirmed&&benchmark.intensity!==""&&benchmarkValue>0&&benchmark.source.trim()?`当前强度与所填基准“${benchmark.source}”相比，差异为 ${fmt.format((stats.intensity/benchmarkValue-1)*100)}%。` : "未提供并确认同类型、同边界的可比基准，不能判断排放水平是否偏高。"}</p></section><footer><span>CarbonIQ · 宿舍楼碳排放分析</span><b>项目数据待核实</b></footer></article></>;
}

function ReportPageV2({ project, stats, optimized, selectedAlternatives, fileName, exportCsv, isReference, benchmark, transportResult, operationResult }) {
  const comparable = benchmark.confirmed && Number(benchmark.intensity) > 0 && benchmark.source.trim();
  return <><Header kicker="分阶段分析" title="项目报告" text="只呈现已录入数据能支持的结果；不同时间尺度不直接相加。"><button className="outline" onClick={exportCsv}><Download size={16}/>导出材料清单</button><button className="solid" onClick={() => window.print()}><FileText size={16}/>打印PDF</button></Header><article className="report lifecycle-report"><header><div><span>BUILDING CARBON BRIEF</span><h2>{project.name}</h2><p>材料生产 · 运输 · 运营能耗</p></div><b>DORM-LCA</b></header><section className="report-metrics"><div><span>A1–A3 材料生产</span><b>{fmt.format(stats.tonnes)} tCO₂e</b></div><div><span>A4 运输</span><b>{transportResult.hasData ? `${fmt3.format(transportResult.kg / 1000)} tCO₂e` : "待输入"}</b></div><div><span>A5 现场建造</span><b>未计算</b></div><div><span>B6 已录入能源</span><b>{operationResult.annualKg === null ? "待输入" : `${fmt.format(operationResult.annualKg / 1000)} tCO₂e/年`}</b></div></section><section><small>01 / 材料生产</small><h3>基准材料清单</h3><p>清单“{fileName}”共 {stats.rows.length} 项，材料生产排放 {fmt.format(stats.tonnes)} tCO₂e，强度 {fmt.format(stats.intensity)} kgCO₂e/m²。{isReference ? "当前工程量为估算值，需用项目清单替换。" : "导入数据的工程量、单位与因子来源仍需核实。"}</p><p>{selectedAlternatives.length ? `已选 ${selectedAlternatives.length} 项候选产品，同用量情景的材料生产排放变化 ${fmt.format(optimized.reduction / 1000)} tCO₂e；产品性能和可采购性未核验。` : "尚未选择候选产品。"}</p></section><div className="report-cols"><section><small>02 / 材料运输</small><h3>A4 路线核算</h3><p>{transportResult.hasData ? `已完整填写 ${transportResult.rows.length} 条路线，排放小计 ${fmt3.format(transportResult.kg / 1000)} tCO₂e。` : "尚无可计算的运输路线。"}{transportResult.incomplete ? ` 另有 ${transportResult.incomplete} 条路线未补齐。` : ""} 质量、距离和运输因子需与实际运输方式相符。</p></section><section><small>03 / 运营能耗</small><h3>B6 已录入能源</h3><p>{operationResult.annualKg === null ? "尚无可计算的年度能耗。" : `电力 ${operationResult.electricityKg === null ? "未录入" : `${fmt.format(operationResult.electricityKg / 1000)} tCO₂/年`}；燃气 ${operationResult.gasKg === null ? "未录入" : `${fmt.format(operationResult.gasKg / 1000)} tCO₂e/年`}。`} {operationResult.gasIncomplete ? "燃气信息未填完整，不能视为零排放。" : ""} 其他能源及设备更换未纳入。</p></section></div><section><small>04 / 判断边界</small><p>{comparable ? `用户确认的可比基准“${benchmark.source}”与当前 A1–A3 强度差异为 ${fmt.format((stats.intensity / Number(benchmark.intensity) - 1) * 100)}%；基准真实性仍需人工核查。` : "未提供并确认同建筑类型、同 A1–A3 边界的可比基准，不判断排放水平高低。"} A1–A4 为一次性建设阶段结果，B6 为年度结果，不直接相加；A5 尚未计算。</p></section><footer><span>CarbonIQ · 宿舍楼碳排放分析</span><b>项目数据待核实</b></footer></article></>;
}

function AdvisorPage({ stats, optimized, messages, ask, aiConfig, updateAIConfig, aiConnection, aiBusy, testAI, isReference, benchmark }) {
  const [text, setText] = useState("");
  const [showKey, setShowKey] = useState(false);
  const configured = hasModelConfig(aiConfig);
  const submit = (event) => {
    event.preventDefault();
    if (!text.trim() || aiBusy) return;
    ask(text);
    if (configured) setText("");
  };
  return <>
    <Header kicker="项目分析" title="AI顾问" text="根据当前清单和计算结果回答问题。" />
    <section className="advisor">
      <article className="panel chat advisor-chat">
        <header><i><Bot size={20}/></i><span><b>建筑碳顾问</b><small>{aiConnection.status === "ready" ? `已连接 · ${aiConfig.model}` : "等待模型配置"}</small></span></header>
        <main aria-live="polite">
          {messages.map((message, index) => <p className={message.role} key={index}>{message.text}</p>)}
          {aiBusy && aiConnection.status !== "testing" && <p className="assistant advisor-thinking">正在结合项目数据分析…</p>}
        </main>
        <div className="advisor-prompts">
          <button type="button" disabled={!configured || aiBusy} onClick={() => ask("仅根据当前清单，哪些材料的排放贡献最大？请给出计算依据，不判断是否严重。")}>当前数据分析</button>
          <button type="button" disabled={!configured || aiBusy} onClick={() => ask("当前清单中哪些字段或来源需要核实？请按优先级列出。")}>数据还缺什么</button>
          <button type="button" disabled={!configured || aiBusy} onClick={() => ask("当前数据能支持哪些结论？判断排放高低还需要怎样的可比基准？")}>判断依据</button>
        </div>
        <form onSubmit={submit}><input value={text} onChange={(event) => setText(event.target.value)} placeholder="例如：该先优化混凝土还是钢筋？" aria-label="向 AI 碳顾问提问" disabled={aiBusy} /><button className="solid" type="submit" disabled={aiBusy || !text.trim()}>{aiBusy ? "分析中" : "发送"}</button></form>
      </article>
      <div className="advisor-rail">
        <section className="panel advisor-settings">
          {aiConfig.serverManaged && <p className="server-model-note">模型 {aiConfig.model} 已在本机服务配置。API Key 不会发送到浏览器；修改配置请在服务电脑上操作。</p>}
          <div className="advisor-card-title"><span>MODEL CONNECTION</span><h2>连接你的模型</h2><p>支持 OpenAI 兼容接口。</p></div>
          <label>Base URL<input type="url" value={aiConfig.baseUrl} onChange={(event) => updateAIConfig("baseUrl", event.target.value)} placeholder="https://服务商地址/v1" autoComplete="url" spellCheck="false" disabled={aiBusy} /></label>
          <label>模型名称<input value={aiConfig.model} onChange={(event) => updateAIConfig("model", event.target.value)} placeholder="例如：你可用的模型 ID" autoComplete="off" spellCheck="false" disabled={aiBusy} /></label>
          <label>API Key<span className="advisor-secret"><input type={showKey ? "text" : "password"} value={aiConfig.apiKey} onChange={(event) => updateAIConfig("apiKey", event.target.value)} placeholder="输入你自己的密钥" autoComplete="off" spellCheck="false" disabled={aiBusy} /><button type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "隐藏密钥" : "显示密钥"}>{showKey ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
          <button className="solid advisor-test" type="button" disabled={aiBusy || !configured} onClick={testAI}>{aiConnection.status === "testing" ? "连接中…" : "测试连接"}</button>
          <p className={`advisor-connection ${aiConnection.status}`} role="status">{aiConnection.message}</p>
          <p className="advisor-privacy">密钥仅保存在当前页面。提问会将项目摘要和最多 25 项材料数据发送至你填写的接口。</p>
        </section>
        <aside className="advisor-context">
          <span>当前项目数据</span><h2>本次回答会参考</h2>
          <dl><div><dt>总排放</dt><dd>{fmt.format(stats.tonnes)} tCO₂e</dd></div><div><dt>最大贡献</dt><dd>{stats.hotspot?.name || "暂无"}</dd></div><div><dt>方案变化</dt><dd>{fmt.format(optimized.rate * 100)}%</dd></div><div><dt>比较基准</dt><dd>{benchmark.confirmed&&benchmark.intensity&&benchmark.source?"用户已确认可比":"尚未确认可比"}</dd></div><div><dt>清单状态</dt><dd>{isReference ? "估算工程量" : "用户导入，待核实"}</dd></div></dl>
          <p><ShieldCheck size={17}/>模型负责解释与建议；碳排数值由页面计算，情景减排仍需工程验证。</p>
        </aside>
      </div>
    </section>
  </>;
}

function MaterialTable({rows,compact}) { const data=[...rows].sort((a,b)=>b.emission-a.emission).slice(0,compact?5:rows.length); const total=rows.reduce((s,r)=>s+r.emission,0); return <article className="panel material-table"><PanelTitle kicker="MATERIAL LEDGER" title="重点材料清单" note="按排放量排序"/><div><table><thead><tr><th>材料</th><th>构件</th><th>工程量</th><th>碳因子</th><th>排放量</th><th>贡献</th></tr></thead><tbody>{data.map((r)=><tr key={r.id}><td><b>{r.name}</b><small>{r.id}</small></td><td>{r.part}</td><td>{fmt.format(r.quantity)} {r.unit}</td><td>{fmt.format(r.factor)}</td><td className="emission">{fmt.format(r.emission/1000)} tCO₂e</td><td>{(r.emission/total*100).toFixed(1)}%</td></tr>)}</tbody></table></div></article>; }

const root=createRoot(document.getElementById("root"));
root.render(<React.StrictMode><App/></React.StrictMode>);
if(import.meta.hot) import.meta.hot.dispose(()=>root.unmount());
