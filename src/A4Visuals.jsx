import React, { useState } from "react";
import { ArrowRight, MapPinned, Route } from "lucide-react";
import A4Network from "./A4Network.jsx";
import { hasModelConfig } from "./advisorEngine.js";
import { requestA4RoutePlan } from "./a4RoutePlanner.js";
import "./a4-visuals.css";

const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 });
const emission = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 });
const required = [
  ["material", "材料"], ["origin", "起点"], ["destination", "终点"],
  ["mass", "质量"], ["distance", "距离"], ["factor", "运输因子"], ["source", "来源"],
];

function missingFields(row) {
  return required.filter(([key]) => ["mass", "distance", "factor"].includes(key)
    ? !(Number(row[key]) > 0 && Number.isFinite(Number(row[key])))
    : !String(row[key] ?? "").trim()).map(([, label]) => label);
}

export default function A4Visuals({ routes, result, aiConfig }) {
  const [selectedId, setSelectedId] = useState(null);
  const [routePlan, setRoutePlan] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState("");
  const planSignature = JSON.stringify(result.rows.map(({ id, material, origin, destination, mass, distance, factor, kg }) => [id, material, origin, destination, mass, distance, factor, kg]));
  const activePlan = routePlan?.signature === planSignature ? routePlan : null;
  const generatePlan = async () => {
    if (planning || !result.hasData || !hasModelConfig(aiConfig)) return;
    setPlanning(true); setPlanError("");
    try {
      const plan = await requestA4RoutePlan({ config: aiConfig, rows: result.rows });
      setRoutePlan({ ...plan, signature: planSignature });
      setSelectedId(plan.highlightRouteId);
    } catch (error) {
      setPlanError(`模型方案未采用：${error.message}。当前仍显示本地路线图。`);
    } finally { setPlanning(false); }
  };
  const ranked = [...result.rows].sort((a, b) => b.kg - a.kg);
  const selected = result.rows.find((row) => row.id === selectedId) || ranked[0];
  const maxKg = ranked[0]?.kg || 0;
  const tonneKilometres = result.rows.reduce((sum, row) => sum + row.tonneKilometres, 0);
  const completeIds = new Set(result.rows.map((row) => row.id));
  const pending = routes.map((row, index) => ({ row, index })).filter(({ row }) => !completeIds.has(row.id));

  return <section className="wh-panel a4-visuals" aria-label="A4 运输过程二维示意图">
    <div className="wh-panel-head"><div><small>A4 · 本地二维可视化</small><h2>运输路径与排放热点</h2></div><span className="a4-local-badge"><MapPinned size={15}/> 本地绘制</span></div>
    <p className="a4-disclaimer">默认按记录生成本地示意图；启用智能体编排后，模型只调整已有路段的分组与展示顺序。线条不代表真实地理位置或行驶轨迹，图表不会请求外部地图服务。</p>

    <div className="a4-summary" aria-label="A4 运输统计">
      <div><span>已核算排放小计</span><strong>{result.hasData ? emission.format(result.kg / 1000) : "—"}<small> {result.hasData ? "tCO₂e" : ""}</small></strong></div>
      <div><span>完整路段</span><strong>{result.rows.length}<small> 段</small></strong></div>
      <div><span>运输周转量</span><strong>{result.hasData ? number.format(tonneKilometres) : "—"}<small> {result.hasData ? "t·km" : ""}</small></strong></div>
      <div className={pending.length ? "needs-data" : ""}><span>待补齐</span><strong>{pending.length}<small> 段</small></strong></div>
    </div>

    {result.hasData && <A4Network rows={result.rows} selectedId={selected?.id} onSelect={setSelectedId} plan={activePlan} onGenerate={generatePlan} planning={planning} planError={planError} canGenerate={hasModelConfig(aiConfig)}/>}

    {result.hasData ? <div className="a4-visual-grid">
      <div className="a4-route-board"><div className="a4-section-title"><Route size={17}/><h3>运输流程</h3><small>点击路段查看计算依据</small></div>
        <div className="a4-route-list" aria-label="已核算运输路段">
          {result.rows.map((row, index) => <button type="button" key={row.id ?? index} className={`a4-route ${selected === row ? "selected" : ""}`} aria-pressed={selected === row} onClick={() => setSelectedId(row.id)}>
            <span className="a4-route-heading"><b>{row.material}</b><strong>{emission.format(row.kg / 1000)} tCO₂e</strong></span>
            <span className="a4-track"><span className="a4-node" title={row.origin}>{row.origin}</span><span className="a4-flow-line" style={{ "--a4-stroke": `${Math.min(10, 3 + 7 * row.kg / maxKg)}px` }}><i/></span><ArrowRight className="a4-arrow" size={16}/><span className="a4-node" title={row.destination}>{row.destination}</span></span>
            <span className="a4-route-facts">{number.format(Number(row.mass))} t · {number.format(Number(row.distance))} km · {number.format(row.tonneKilometres)} t·km</span>
          </button>)}
        </div>
      </div>

      <aside className="a4-route-detail" aria-live="polite"><span className="a4-detail-kicker">当前路段 · 计算明细</span><h3>{selected.material}</h3><p className="a4-detail-path">{selected.origin} <ArrowRight size={15}/> {selected.destination}</p>
        <strong className="a4-detail-total">{emission.format(selected.kg / 1000)} <small>tCO₂e</small></strong>
        <dl><div><dt>运输质量</dt><dd>{number.format(Number(selected.mass))} t</dd></div><div><dt>单程距离</dt><dd>{number.format(Number(selected.distance))} km</dd></div><div><dt>运输因子</dt><dd>{number.format(Number(selected.factor))} kgCO₂e/(t·km)</dd></div><div><dt>因子或记录来源</dt><dd>{selected.source}</dd></div></dl>
        <p className="a4-equation">{number.format(Number(selected.mass))} t × {number.format(Number(selected.distance))} km × {number.format(Number(selected.factor))} = {number.format(selected.kg)} kgCO₂e</p>
      </aside>
    </div> : <div className="a4-empty"><Route size={25}/><strong>等待可核算的运输路段</strong><p>填写材料、起终点、质量、距离、运输因子及来源后，流程图和排放热点会在本地生成。</p></div>}

    {result.hasData && <div className="a4-hotspots"><div className="a4-section-title"><h3>路段排放对比</h3><small>按已核算排放量排序</small></div><div className="a4-bars">{ranked.map((row, index) => <button type="button" key={row.id ?? index} className="a4-bar-row" onClick={() => setSelectedId(row.id)}><span title={`${row.material}：${row.origin} → ${row.destination}`}>{row.material} · {row.origin} → {row.destination}</span><span className="a4-bar-track"><i style={{ width: `${100 * row.kg / maxKg}%` }}/></span><strong>{emission.format(row.kg / 1000)} t</strong></button>)}</div></div>}

    {pending.length > 0 && <div className="a4-pending"><strong>还有 {pending.length} 段未纳入小计</strong><p>这些记录缺少必要信息，不能当作零排放。</p><ul>{pending.slice(0, 6).map(({ row, index }) => <li key={row.id ?? index}><span>{row.material || `记录 ${index + 1}`}</span><small>待补：{missingFields(row).join("、") || "请核对记录"}</small></li>)}</ul>{pending.length > 6 && <small>另有 {pending.length - 6} 段待补齐。</small>}</div>}
  </section>;
}
