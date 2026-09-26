import React, { useId, useMemo, useState } from "react";
import { ArrowRight, GitBranch, MapPin, Sparkles, WandSparkles } from "lucide-react";
import "./a4-network.css";

const MAX_EDGES = 12;
const fmt = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 });

function graphLayout(rows, selectedId) {
  const shown = rows.slice(0, MAX_EDGES);
  const selected = rows.find((row) => row.id === selectedId);
  if (selected && !shown.includes(selected)) shown.splice(MAX_EDGES - 1, 1, selected);
  const names = [...new Set(shown.flatMap((row) => [row.origin, row.destination]))];
  const outgoing = new Map(names.map((name) => [name, []]));
  const inCount = new Map(names.map((name) => [name, 0]));
  shown.forEach((row) => {
    outgoing.get(row.origin).push(row.destination);
    inCount.set(row.destination, inCount.get(row.destination) + 1);
  });

  // Longest path through the acyclic portion keeps shared destinations after transfer nodes.
  const remaining = new Map(inCount);
  const depth = new Map(names.map((name) => [name, 0]));
  const queue = names.filter((name) => remaining.get(name) === 0);
  for (let i = 0; i < queue.length; i += 1) {
    const origin = queue[i];
    outgoing.get(origin).forEach((destination) => {
      depth.set(destination, Math.max(depth.get(destination), Math.min(5, depth.get(origin) + 1)));
      remaining.set(destination, remaining.get(destination) - 1);
      if (remaining.get(destination) === 0) queue.push(destination);
    });
  }
  // Cycles cannot be placed in a strict left-to-right order; retain their stable input order.
  names.filter((name) => remaining.get(name) > 0).forEach((name) => {
    if (depth.get(name) === 0 && inCount.get(name) > 0) depth.set(name, 1);
  });

  const layers = new Map();
  names.forEach((name) => {
    const column = depth.get(name);
    if (!layers.has(column)) layers.set(column, []);
    layers.get(column).push(name);
  });
  const maxDepth = Math.max(1, ...layers.keys());
  const height = Math.max(380, Math.max(...[...layers.values()].map((layer) => layer.length)) * 116 + 72);
  const points = new Map();
  layers.forEach((layer, column) => layer.forEach((name, index) => {
    points.set(name, {
      x: 106 + column * 766 / maxDepth,
      y: height * (index + 1) / (layer.length + 1),
      kind: inCount.get(name) === 0 ? "起点" : outgoing.get(name).length === 0 ? "终点" : "中转",
    });
  }));
  return { shown, points, height, hiddenCount: rows.length - shown.length };
}

function geometry(from, to, lane) {
  const forward = to.x > from.x + 145;
  const x1 = from.x + (forward ? 72 : 18);
  const x2 = to.x - (forward ? 72 : 18);
  const y1 = from.y + lane;
  const y2 = to.y + lane;
  const bend = forward ? Math.max(58, (x2 - x1) * 0.48) : 104;
  const c1x = x1 + bend;
  const c2x = forward ? x2 - bend : x2 + bend;
  const path = `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
  const midX = (x1 + 3 * c1x + 3 * c2x + x2) / 8;
  const midY = (y1 + y2) / 2;
  return { path, midX, midY };
}

export default function A4Network({ rows, selectedId, onSelect, plan, onGenerate, planning, planError, canGenerate }) {
  const prefix = useId().replace(/[^a-z0-9_-]/gi, "");
  const orderedRows = useMemo(() => {
    if (!plan) return rows;
    const byId = new Map(rows.map((row) => [row.id, row]));
    const planned = plan.chains.flat().map((id) => byId.get(id)).filter(Boolean);
    const plannedIds = new Set(planned.map((row) => row.id));
    return [...planned, ...rows.filter((row) => !plannedIds.has(row.id))];
  }, [rows, plan]);
  const { shown, points, height, hiddenCount } = useMemo(() => graphLayout(orderedRows, selectedId), [orderedRows, selectedId]);
  const [focusedNode, setFocusedNode] = useState(null);
  const maxKg = Math.max(1, ...shown.map((row) => row.kg));
  const activeIds = new Set(focusedNode ? shown.filter((row) => row.origin === focusedNode || row.destination === focusedNode).map((row) => row.id) : shown.map((row) => row.id));
  const selected = shown.find((row) => row.id === selectedId) || shown[0];
  const edges = shown.map((row, index) => {
    const from = points.get(row.origin);
    const to = points.get(row.destination);
    const parallel = shown.slice(0, index).filter((other) => other.origin === row.origin && other.destination === row.destination).length;
    return { row, index, ...geometry(from, to, parallel * 8) };
  });

  return <div className="a4-network" aria-label="A4 运输节点和排放示意图">
    <div className="a4-network-header">
      <div className="a4-network-title"><div className="a4-network-icon"><GitBranch size={19}/></div><div><small>TRANSPORT FLOW / A4</small><h3>材料运输路径</h3></div></div>
      <div className="a4-network-header-meta"><span>{points.size} 个节点</span><span>{shown.length} 条路段</span><span>{plan ? "智能体编排" : "本地编排"}</span></div>
    </div>
    <div className="a4-network-controls"><p>同名地点汇合为一个节点。连线和数值只取自已核算记录；位置和线长不代表真实地理距离。</p><button type="button" onClick={onGenerate} disabled={!canGenerate || planning}><WandSparkles size={15}/>{planning ? "智能体编排中…" : plan ? "重新编排" : "智能体编排路线图"}</button></div>
    <p className="a4-network-message">点击编排后，会将最多 24 条完整记录的材料、起终点、质量、距离及本地排放小计发送到已配置的模型服务；缺失记录和因子来源不参与编排。{!canGenerate ? "请先连接模型。" : ""}</p>
    {planError && <p className="a4-network-message warning" role="status">{planError}</p>}
    {plan && <p className="a4-network-message success" role="status">已校验模型方案：每条路段只使用一次，相连路段的材料、质量和首尾地点一致。是否为同一批货仍需核对物流凭证；排放由本地核算。</p>}
    <div className="a4-network-legend" aria-hidden="true"><span><i className="a4-legend-node"/>供应地 / 中转 / 工地</span><span><i className="a4-legend-line"/>运输方向</span><span><i className="a4-legend-particle"/>排放粒子</span></div>
    <div className="a4-network-scroll">
      <svg viewBox={`0 0 980 ${height}`} role="img" aria-label={`运输流程图，共 ${shown.length} 条运输段、${points.size} 个节点`}>
        <defs>
          <pattern id={`${prefix}-grid`} width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#e2eee6"/></pattern>
          <marker id={`${prefix}-arrow`} markerWidth="8" markerHeight="8" refX="6.7" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" fill="#6daf8a"/></marker>
          <marker id={`${prefix}-arrow-active`} markerWidth="8" markerHeight="8" refX="6.7" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" fill="#d7964f"/></marker>
        </defs>
        <rect width="980" height={height} fill={`url(#${prefix}-grid)`}/>
        {edges.map(({ row, index, path, midX, midY }) => {
          const isSelected = row.id === selected?.id;
          const pathId = `${prefix}-edge-${index}`;
          const particleCount = 1 + Math.round(row.kg / maxKg * 4);
          return <g key={`${row.id}-${index}`} className={`a4-network-edge${isSelected ? " selected" : ""}${!activeIds.has(row.id) ? " dimmed" : ""}`}>
            <path d={path} className="a4-network-track"/>
            <path id={pathId} d={path} className="a4-network-route" markerEnd={`url(#${prefix}-arrow${isSelected ? "-active" : ""})`}/>
            <path d={path} className="a4-network-hit" role="button" tabIndex="0" aria-label={`${row.material}：${row.origin}到${row.destination}，${fmt.format(row.kg / 1000)}吨二氧化碳当量`} onClick={() => onSelect(row.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(row.id); } }}/>
            {Array.from({ length: particleCount }, (_, particle) => <circle key={particle} className="a4-network-particle" r={isSelected ? 4 : 3}>
              <animateMotion dur={`${2.8 + index % 3 * 0.45}s`} begin={`${-particle * 0.62}s`} repeatCount="indefinite"><mpath href={`#${pathId}`}/></animateMotion>
            </circle>)}
            {isSelected && <g transform={`translate(${midX} ${midY - 21})`} className="a4-network-edge-label"><rect x="-57" y="-12" width="114" height="24" rx="12"/><text textAnchor="middle" dominantBaseline="central">{fmt.format(row.kg / 1000)} tCO₂e</text></g>}
          </g>;
        })}
        {[...points].map(([name, point]) => <g key={name} className={`a4-network-node${focusedNode === name ? " active" : ""}`} transform={`translate(${point.x} ${point.y})`} role="group" tabIndex="0" aria-label={`${point.kind}：${name}`} onMouseEnter={() => setFocusedNode(name)} onMouseLeave={() => setFocusedNode(null)} onFocus={() => setFocusedNode(name)} onBlur={() => setFocusedNode(null)}>
          <rect x="-72" y="-29" width="144" height="58" rx="13" className="a4-network-node-shadow"/>
          <rect x="-72" y="-32" width="144" height="58" rx="13" className="a4-network-node-card"/>
          <circle cx="-53" cy="-13" r="8" className="a4-network-node-dot"/>
          <text x="-39" y="-9" className="a4-network-node-type">{point.kind}</text>
          <text x="-54" y="12" className="a4-network-node-name">{name.length > 9 ? `${name.slice(0, 8)}…` : name}</text>
        </g>)}
      </svg>
    </div>
    {plan && <div className="a4-network-chains"><div className="a4-network-chains-head"><strong>智能体编排的候选运输链</strong><span>基于前 {plan.chains.flat().length} 条完整记录</span></div><div className="a4-network-chain-list">{plan.chains.slice(0, 8).map((ids, index) => {
      const items = ids.map((id) => rows.find((row) => row.id === id));
      const places = [items[0].origin, ...items.map((item) => item.destination)];
      return <div className="a4-network-chain" key={`${ids[0]}-${index}`}><span className="a4-network-chain-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{items[0].material}</strong><p>{places.join(" → ")}</p></div><span className="a4-network-chain-metric">{ids.length} 段 · {fmt.format(items.reduce((sum, item) => sum + item.kg, 0) / 1000)} tCO₂e</span></div>;
    })}</div>{plan.chains.length > 8 && <small>其余 {plan.chains.length - 8} 条链已参与图面编排。</small>}</div>}
    <div className="a4-network-bottom">
      <div className="a4-network-current"><MapPin size={15}/><span>当前路段</span><strong>{selected.material}</strong><span className="a4-network-current-path">{selected.origin} <ArrowRight size={13}/> {selected.destination}</span></div>
      <div className="a4-network-current-number"><Sparkles size={15}/><strong>{fmt.format(selected.kg / 1000)} tCO₂e</strong></div>
    </div>
    {hiddenCount > 0 && <p className="a4-network-limit">为保持图面可读，最多显示前 {MAX_EDGES} 段和当前选中段；所有完整记录仍参与排放统计。</p>}
  </div>;
}
