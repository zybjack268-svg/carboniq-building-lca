import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { X } from "lucide-react";
import "./concept.css";
import "./rework.css";
import { animateExpand, animateShrink, captureAnchor, popAnchor } from "./pageFx.js";
import { buildProjectContext, hasModelConfig, requestAdvisor } from "./advisorEngine";
import { computeMaterialScenario, parseCsv, parseMaterialRows } from "./dataUtils";
import { calculateOperation, calculateTransport, calculateSite } from "./lifecycle";
import { parseProjectWorkbook } from "./projectImport";
import { recognizeMaterialColumns } from "./flexibleImport";
import { runLcaAuditSkill } from "./lcaAuditSkill";
import PortalLanding from "./PortalLanding";
import { ModelSetup } from "./ModelSetup";
import WorkflowHub from "./WorkflowHub";
import { buildAgentEvidence, parseAgentResponse, runProjectAgent } from "./agentEngine";
import { loadStoredCandidates, saveStoredCandidates } from "./candidateStore";
import { loadStoredProject, saveStoredProject, clearStoredProject } from "./projectStore";

const INITIAL_MATERIALS = [
  { id: "M001", part: "主体结构", name: "C30预拌混凝土", unit: "m³", quantity: 2700, factor: 295, source: "GB/T 51366-2019 附录D", cost: 420 },
  { id: "M002", part: "主体结构", name: "热轧碳钢钢筋", unit: "t", quantity: 330, factor: 2340, source: "GB/T 51366-2019 附录D", cost: 4300 },
  { id: "M003", part: "围护分隔", name: "页岩空心砖", unit: "m³", quantity: 900, factor: 204, source: "GB/T 51366-2019 附录D", cost: 180 },
  { id: "M004", part: "砌筑抹灰", name: "普通硅酸盐水泥", unit: "t", quantity: 60, factor: 735, source: "GB/T 51366-2019 附录D", cost: 480 },
  { id: "M005", part: "外窗", name: "平板玻璃", unit: "t", quantity: 30, factor: 1130, source: "GB/T 51366-2019 附录D", cost: 2600 },
  { id: "M006", part: "外窗装饰", name: "铝板带", unit: "t", quantity: 6, factor: 28500, source: "GB/T 51366-2019 附录D", cost: 21000 },
];

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

// 错误边界：任何渲染崩溃都在页面上显示具体错误，并提供清除本机数据的自救入口。
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    this.setState((current) => ({ error: { message: String(error?.message || error), stack: String(error?.stack || info?.componentStack || "").slice(0, 900) } }));
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f7fbf9", color: "#21402f", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 640, width: "100%", border: "1px solid #e2c9b8", borderRadius: 16, background: "#fffaf5", padding: "26px 30px" }}>
        <b style={{ fontSize: 16, color: "#a75a3d" }}>界面遇到错误，已停止渲染</b>
        <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.7, color: "#6d5a48", overflowWrap: "anywhere" }}>{this.state.error.message}</p>
        <details style={{ marginTop: 12 }}><summary style={{ cursor: "pointer", fontSize: 12, color: "#94764a" }}>技术详情</summary><pre style={{ marginTop: 8, fontSize: 10.5, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "#8a723e" }}>{this.state.error.stack}</pre></details>
        <button type="button" onClick={() => { try { ["carboniq.project.v1", "carboniq.skills.v1", "carboniq.candidates.v1"].forEach((key) => window.localStorage.removeItem(key)); } catch {} window.location.reload(); }} style={{ marginTop: 18, padding: "10px 16px", border: 0, borderRadius: 9, background: "#a75a3d", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>清除本机保存的数据并重新加载</button>
        <p style={{ margin: "10px 0 0", fontSize: 11, color: "#a08d78" }}>清除操作只删除这台浏览器里保存的项目数据与技能，不影响代码；也可以把上面的错误信息发给开发者。</p>
      </div>
    </div>;
  }
}

function App() {
  useLiquidPress();
  const showIntro = new URLSearchParams(window.location.search).get("intro") === "1";
  const [screen, setScreen] = useState(showIntro ? "landing" : "workspace");
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  // 恢复上次的项目状态（材料、阶段数据、候选与方案）；没有存档时用内置演示清单。
  const storedProject = loadStoredProject();
  const [materials, setMaterials] = useState(storedProject?.materials || INITIAL_MATERIALS);
  const [project, setProject] = useState(storedProject?.project || { name: "宿舍楼项目", area: 6000, floors: 6, structure: "钢筋混凝土框架" });
  const [fileName, setFileName] = useState(storedProject?.fileName || "公开因子_估算工程量_宿舍楼.csv");
  const [notice, setNotice] = useState(storedProject ? "已恢复上次的项目状态（本机浏览器保存）" : "已载入当前材料清单");
  const [candidates, setCandidates] = useState(loadStoredCandidates);
  useEffect(() => { saveStoredCandidates(candidates); }, [candidates]);
  const [selectedCandidates, setSelectedCandidates] = useState(storedProject?.selectedCandidates || {});
  const [benchmark, setBenchmark] = useState(storedProject?.benchmark || { intensity: "", source: "", confirmed: false });
  const [climate, setClimate] = useState(storedProject?.climate || { zone: "", city: "", annualElectricity: "", electricityFactor: "0.5306", annualGas: "", gasFactor: "", annualHeat: "", heatFactor: "", years: "30" });
  const [routes, setRoutes] = useState(storedProject?.routes || []);
  const [siteRows, setSiteRows] = useState(storedProject?.siteRows || []);
  const [messages, setMessages] = useState([{ role: "assistant", text: "你好。配置模型后，我会结合当前宿舍楼的材料清单、碳排热点和优化情景回答问题。" }]);
  const [isReference, setIsReference] = useState(storedProject?.isReference ?? true);
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
  const [allowA1Recognition, setAllowA1Recognition] = useState(false);

  // 项目状态变化后延迟 800ms 保存，避免高频输入反复写 localStorage。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveStoredProject({ materials, project, fileName, isReference, candidates, selectedCandidates, routes, siteRows, climate, benchmark });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [materials, project, fileName, isReference, candidates, selectedCandidates, routes, siteRows, climate, benchmark]);

  useEffect(() => {
    let active = true;
    fetch("/api/session", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((session) => {
        if (!active || !session?.serverManaged) return;
        setAiConfig({ baseUrl: "/api", apiKey: "", model: session.model, serverManaged: true, desktop: Boolean(session.desktop) });
        setAiConnection(session.model ? { status: "ready", message: "本机模型配置已加载；可在设置中测试连接。" } : { status: "idle", message: "尚未连接模型，本地核算功能可直接使用。" });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => window.carboniqDesktop?.onProfileChanged?.(({ model }) => {
    setAiConfig({ baseUrl: "/api", apiKey: "", model, serverManaged: true, desktop: true });
    setAiConnection({ status: "ready", message: "已切换到当前模型。" });
  }), []);

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
  const materialAuditRun = useMemo(() => runLcaAuditSkill({ rows: stats.rows, fileName, candidates, selectedCandidates, routes: [], siteRows: [], climate: {}, area: project.area }), [stats.rows, fileName, candidates, selectedCandidates, project.area]);
  const materialEvidence = useMemo(() => ({
    ...buildAgentEvidence({ stats, optimized, candidates, selectedCandidates,
      transportResult: { hasData: false, kg: 0, incomplete: 0 },
      siteResult: { hasData: false, kg: 0, incomplete: 0 },
      operationResult: { annualKg: null, gasIncomplete: false }, isReference, auditRun: materialAuditRun }),
    boundary: "本工作流仅分析 A1–A3 材料生产；A4 运输、A5 建造、B6 运营需分别运行各自工作流。",
  }), [stats, optimized, candidates, selectedCandidates, isReference, materialAuditRun]);

  const addCandidate = (candidate) => {
    const id = `C-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCandidates((current) => [...current, { ...candidate, id }]);
    return id;
  };
  const removeCandidate = (id) => {
    setCandidates((current) => current.filter((item) => item.id !== id));
    setSelectedCandidates((current) => Object.fromEntries(Object.entries(current).filter(([, value]) => value !== id)));
  };

  const applyImport = ({ parsed, bundle, name, area }) => {
    setAgentStage("calculating");
    setAgentRun(null);
    setMessages([]);
    setMaterials(parsed.map((row) => ({ ...row, sourceFile: name })));
    setProject((current) => bundle?.project || { ...current, area: Number(area), geometry: null });
    setRoutes(bundle?.routes || []);
    setSiteRows(bundle?.site || []);
    setClimate(bundle?.climate || { zone: "", city: "", annualElectricity: "", electricityFactor: "", annualGas: "", gasFactor: "", annualHeat: "", heatFactor: "", years: "" });
    setBenchmark(bundle?.benchmark || { intensity: "", source: "", confirmed: false });
    setCandidates(bundle?.candidates || []);
    setFileName(name); setIsReference(false); setSelectedCandidates({}); setPendingImport(null);
    setNotice(`已导入 ${parsed.length} 项材料；请继续核对因子来源和项目参数`);
    setScreen("workspace");
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
      if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error("只支持 CSV 或 XLSX 材料清单");
      if (file.size > 10 * 1024 * 1024) throw new Error("文件超过 10 MB，请精简后重试");
      let parsed;
      let bundle = null;
      let recognition = null;
      if (/\.csv$/i.test(file.name)) {
        const rows = parseCsv(await file.text());
        try { parsed = parseMaterialRows(rows); }
        catch {
          if (!allowA1Recognition) throw new Error("本地无法识别表头。打开「启动AI分析服务」后可由模型辅助定位字段，或核对表头格式后重试");
          recognition = await recognizeMaterialColumns([{ sheet: file.name, data: rows }], aiConfig); parsed = recognition.materials;
        }
      } else {
        const { default: readExcel } = await import("read-excel-file/browser");
        const sheets = await readExcel(file);
        try { bundle = parseProjectWorkbook(sheets); parsed = bundle.materials; }
        catch {
          if (!allowA1Recognition) throw new Error("本地无法识别表头。打开「启动AI分析服务」后可由模型辅助定位字段，或核对表头格式后重试");
          recognition = await recognizeMaterialColumns(sheets, aiConfig); parsed = recognition.materials;
        }
      }
      if (recognition || !bundle?.project) {
        setPendingImport({ parsed, bundle, name: file.name, area: "", recognition });
        setAgentStage("reading");
        setNotice(`识别到 ${parsed.length} 项材料；请核对预览${recognition?.issues.length ? `，另有 ${recognition.issues.length} 行未纳入` : ""}。`);
      } else applyImport({ parsed, bundle, name: file.name });
    } catch (error) { setAgentStage(agentRun ? "complete" : "error"); setNotice(`导入失败：${error.message}`); }
    finally { setImportBusy(false); }
  };

  const updateMaterial = (id, patch) => {
    setMaterials((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
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
    if (isReference || activeWorkflow !== "a1") {
      setAgentRun(null);
      setAgentBusy(false);
      return;
    }
    if (aiConnection.status !== "ready") {
      setAgentRun({ result: parseAgentResponse("", materialEvidence), evidence: materialEvidence, at: Date.now() });
      setAgentStage("complete");
      setAgentError("");
      setAgentBusy(false);
      return;
    }
    const controller = new AbortController();
    setAgentBusy(true);
    setAgentStage("connecting");
    setAgentError("");
    const timer = setTimeout(async () => {
      const evidence = materialEvidence;
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
  }, [aiConnection.status, aiConfig, materialEvidence, isReference, activeWorkflow, agentRetry]);

  const ask = async (text) => {
    const question = text.trim();
    if (!question || aiBusy) return;
    if (!hasModelConfig(aiConfig)) {
      setAiConnection({ status: "error", message: "请先填写 Base URL、API Key 和模型名称。" });
      setMessages((current) => [...current, { role: "status", text: "模型尚未配置；本地核算与图表仍可查看。请先在右上角完成模型设置，再使用对话。" }]);
      return;
    }
    const history = [...messages.filter((item, index) => index > 0 && ["user", "assistant"].includes(item.role)), { role: "user", text: question }];
    setMessages((current) => [...current, { role: "user", text: question }]);
    setAiBusy(true);
    try {
      const context = buildProjectContext({ project, fileName, stats, optimized, selectedAlternatives, benchmark, isReference, transportResult, siteResult, operationResult });
      if (activeWorkflow === "a1") {
        context.boundary = "当前 A1–A3 工作流只分析材料生产；运输、现场建造和运营分别由其他工作流处理。";
        delete context.transport_a4;
        delete context.construction_a5;
        delete context.operational_energy_b6;
      }
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

  // 模型设置：从触发按钮展开为覆盖层，完成或关闭时向按钮收缩还原
  const setupAnchor = useRef(null);
  const setupWrapRef = useRef(null);
  const openSetup = (event) => {
    if (window.carboniqDesktop?.openSetup) { window.carboniqDesktop.openSetup(); return; }
    setupAnchor.current = captureAnchor(event); setScreen("setup");
  };
  useLayoutEffect(() => {
    if (screen === "setup" && setupWrapRef.current && setupAnchor.current) animateExpand(setupWrapRef.current, setupAnchor.current);
  }, [screen]);
  const beginSetupExit = () => {
    const wrap = setupWrapRef.current;
    const finish = () => { popAnchor(setupAnchor.current); setScreen("workspace"); };
    if (wrap && setupAnchor.current) animateShrink(wrap, setupAnchor.current).then(finish);
    else finish();
  };

  const shared = { project, setProject, fileName, notice, importFile, importBusy, pendingImport, setPendingImport, confirmImport, cancelImport: () => setPendingImport(null), stats, optimized, candidates, addCandidate, removeCandidate, selectedCandidates, setSelectedCandidates, selectedAlternatives, climate, setClimate, routes, setRoutes, siteRows, setSiteRows, transportResult, siteResult, operationResult, updateMaterial, messages, ask, aiConfig, updateAIConfig, aiConnection, aiBusy, testAI, isReference, allowA1Recognition, setAllowA1Recognition, agentEvidence: materialEvidence, auditRun: materialAuditRun, agentRun, agentBusy, agentStage, agentError, onWorkflowChange: setActiveWorkflow, rerunAgent: (question) => { if (typeof question === "string") setAgentPrompt(question); setAgentRetry((value) => value + 1); } };
  if (screen === "landing") return <PortalLanding enter={() => setScreen("workspace")}/>;
  return <>
    <WorkflowHub {...shared} openSetup={openSetup}/>
    {screen === "setup" && setupAnchor.current && <div className="setup-overlay anchored" ref={setupWrapRef}>
      <button type="button" className="setup-close" onClick={beginSetupExit} aria-label="返回首页"><X size={20}/> 返回首页</button>
      <ModelSetup config={aiConfig} update={updateAIConfig} connection={aiConnection} busy={aiBusy} test={testAI} enter={beginSetupExit}/>
    </div>}
  </>;
}

const root = createRoot(document.getElementById("root"));
root.render(<React.StrictMode><AppErrorBoundary><App/></AppErrorBoundary></React.StrictMode>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
