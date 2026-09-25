import React, { useEffect, useRef, useState } from "react";
import { hasModelConfig } from "./advisorEngine.js";
import { Send, Settings2, Sparkles, X } from "lucide-react";
import { requestAdvisor } from "./advisorEngine";
import "./ProjectPet.css";

const PAGE_HELP = {
  landing: "这里是项目入口。进入工作台后，可以查看材料、运输和运营阶段的输入与结果。",
  dashboard: "这里汇总当前材料清单的排放和热点。先核对面积、数量与因子来源，再判断结果是否可用。",
  twin: "选择预设楼型，播放建造顺序，查看材料排放热点。A5 现场施工排放尚未核算。",
  upload: "这里导入 CSV 或 Excel 材料清单。导入后请检查单位、数量和因子来源。",
  calculator: "这里逐项核算材料生产 A1–A3：数量乘以匹配单位的碳因子。",
  materials: "这里录入替代材料，并核对功能、规格、因子边界和来源。系统不会自动认定最优产品。",
  simulator: "这里比较当前清单与选定替代方案。减排值只对已录入方案有效。",
  transport: "这里录入运输路线并计算 A4。缺少运输量、里程或因子的路线无法得到完整结果。",
  climate: "这里填写运营能耗并查看 B6 能源流动。气候区和年能耗由你输入。",
  credits: "这里结合自定价格与成本假设估算价值；这不等于可交易碳信用。",
  report: "这里整理项目输入、计算边界和阶段结果。导出前请核对缺失数据。",
  advisor: "这里配置 OpenAI 兼容接口并查看完整问答。配置后也可在其他页面向我提问。",
};

export default function ProjectPet({ page, pageName, action, context, config, connection, go }) {
  const mountRef = useRef(null);
  const ballRef = useRef(null);
  const lastCallRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [autoReview, setAutoReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState([]);
  const [hint, setHint] = useState(PAGE_HELP[page] || PAGE_HELP.dashboard);
  const configured = hasModelConfig(config);

  useEffect(() => {
    if (!mountRef.current || !window.EmotionBall?.create) return;
    const ball = window.EmotionBall.create(mountRef.current, {
      emotion: "02", idle: true, color: "#73d9fb", eyeColor: "#123d57", eyeScale: 1,
    });
    ballRef.current = ball;
    const follow = (event) => {
      const rect = mountRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = event.clientX - rect.left - rect.width / 2;
      const dy = event.clientY - rect.top - rect.height / 2;
      ball.setGaze(Math.max(-1, Math.min(1, dx / 210)), Math.max(-1, Math.min(1, dy / 210)));
    };
    window.addEventListener("pointermove", follow, { passive: true });
    return () => { window.removeEventListener("pointermove", follow); ball.destroy(); ballRef.current = null; };
  }, []);

  useEffect(() => {
    setHint(PAGE_HELP[page] || "这里展示当前项目数据。请先检查输入，再解读输出。");
    ballRef.current?.setEmotion("03");
    const timer = setTimeout(() => ballRef.current?.setEmotion("02"), 1400);
    return () => clearTimeout(timer);
  }, [page]);

  const query = async (question, source = "manual") => {
    if (busy || !configured) {
      setOpen(true);
      if (!configured) setHint("先到“AI 顾问”填写并测试 Base URL、密钥和模型名称。页面介绍无需模型即可查看。");
      return;
    }
    setOpen(true);
    setBusy(true);
    ballRef.current?.setEmotion("30");
    const prompt = source === "action"
      ? `用户刚在“${pageName}”完成操作：${question}。请只根据当前项目数据说明影响、缺口及下一步核验建议；无可比基准时不要断言排放严重或达标。`
      : question;
    if (source === "manual") setEntries((current) => [...current.slice(-7), { role: "user", text: question }]);
    try {
      const answer = await requestAdvisor({
        config,
        context: { ...context, current_page: pageName, page_purpose: PAGE_HELP[page], recent_action: source === "action" ? question : null },
        history: [{ role: "user", text: prompt }],
      });
      setEntries((current) => [...current.slice(-7), { role: "assistant", text: answer }]);
      setHint(source === "action" ? "已根据刚才的操作生成建议。" : "已收到模型回复。");
      ballRef.current?.setEmotion("33");
      ballRef.current?.bounce();
    } catch (error) {
      setHint(`模型暂时无法回答：${error.message}`);
      ballRef.current?.setEmotion("34");
    } finally {
      setBusy(false);
      setTimeout(() => ballRef.current?.setEmotion("02"), 2100);
    }
  };

  useEffect(() => {
    if (!action?.at) return;
    setHint(`已记录：${action.label}。${configured ? "可查看建议。" : "连接模型后可分析这一操作。"}`);
    ballRef.current?.setEmotion("31");
    if (!autoReview || !configured || connection.status !== "ready" || busy) return;
    const remaining = Math.max(0, 9000 - (Date.now() - lastCallRef.current));
    const timer = setTimeout(() => {
      lastCallRef.current = Date.now();
      query(action.label, "action");
    }, 1300 + remaining);
    return () => clearTimeout(timer);
  }, [action, autoReview, configured, connection.status]);

  const submit = (event) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question) return;
    setDraft("");
    query(question);
  };

  return <div className={`project-pet ${open ? "is-open" : ""}`}>
    {open && <section className="pet-panel" aria-label="碳排放助手">
      <header><span><Sparkles size={16} /> 项目助手</span><button type="button" aria-label="收起助手" onClick={() => setOpen(false)}><X size={17} /></button></header>
      <div className="pet-page"><small>当前页面 · {pageName}</small><p>{PAGE_HELP[page] || PAGE_HELP.dashboard}</p></div>
      <div className="pet-feed" aria-live="polite">
        {entries.length ? entries.map((item, i) => <p className={item.role} key={`${i}-${item.role}`}>{item.text}</p>) : <p className="pet-empty">修改项目输入后，我可以结合当前数据给出核验建议。也可以直接问我。</p>}
        {busy && <p className="pet-thinking">正在分析当前项目数据…</p>}
      </div>
      {hint !== (PAGE_HELP[page] || PAGE_HELP.dashboard) && <p className="pet-hint">{hint}</p>}
      {!configured && <button className="pet-config" type="button" onClick={() => { go("advisor"); setOpen(false); }}><Settings2 size={15} /> 配置模型</button>}
      <label className="pet-auto"><input type="checkbox" checked={autoReview} onChange={(event) => setAutoReview(event.target.checked)} />修改输入后自动分析 <small>开启后会向你配置的模型服务发送当前项目数据，可能产生费用</small></label>
      <form onSubmit={submit}><input aria-label="询问项目助手" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="问我当前数据或下一步怎么做" /><button type="submit" disabled={busy || !draft.trim()} aria-label="发送问题"><Send size={17} /></button></form>
      <footer>模型建议需人工核对 · <a href="https://github.com/sam70361/aora-bot" target="_blank" rel="noreferrer">aora-bot 角色来源</a></footer>
    </section>}
    {!open && page !== "advisor" && <span className="pet-bubble" role="status">{hint}</span>}
    <button className="pet-orb" type="button" onClick={() => { setOpen((value) => !value); ballRef.current?.bounce(); }} aria-label={open ? "收起项目助手" : "打开项目助手"} aria-expanded={open}>
      <span ref={mountRef} className="pet-ball" aria-hidden="true" />
      <span className="pet-orb-icon">{open ? "−" : "+"}</span>
    </button>
  </div>;
}
