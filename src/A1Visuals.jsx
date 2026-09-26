import React, { useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { groupByPart, pareto, sensitivity } from "./analysis.js";

const format = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });
const TABS = [["contribution", "排放贡献"], ["part", "构件构成"], ["pareto", "帕累托曲线"], ["sensitivity", "灵敏度"]];

export default function A1Visuals({ stats }) {
  const [tab, setTab] = useState("contribution");
  const ranked = [...stats.rows].filter((row) => Number.isFinite(row.emission) && row.emission >= 0).sort((a, b) => b.emission - a.emission);
  const top = ranked.slice(0, 6);
  const remainder = ranked.slice(6).reduce((sum, row) => sum + row.emission, 0);
  const chart = remainder > 0 ? [...top, { id: "other", name: "其他材料", emission: remainder }] : top;
  const topThree = ranked.slice(0, 3).reduce((sum, row) => sum + row.emission, 0);
  const missingSource = ranked.filter((row) => !row.source?.trim() || /未提供|未知|待补|无来源/.test(row.source));
  const missingShare = stats.total ? missingSource.reduce((sum, row) => sum + row.emission, 0) / stats.total * 100 : 0;
  const parts = groupByPart(stats.rows);
  const maxPart = parts[0]?.emission || 0;
  const paretoData = pareto(stats.rows, 7).map((item) => ({ ...item, tonnes: item.emission / 1000, cumulative: Math.round(item.cumulativeShare * 1000) / 10 }));
  const { total, swings, step } = sensitivity(stats.rows, 0.1);
  const topSwings = swings.slice(0, 5);

  return <div className="a1-visuals">
    <div className="a1-chart-head"><div><small>A1–A3 / MATERIAL ANALYSIS</small><h3>材料排放分析</h3></div><span>单位：tCO₂e</span></div>
    <div className="a1-tabs" role="tablist" aria-label="分析视角">{TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</div>

    {tab === "contribution" && <>
      <div className="a1-bars" role="img" aria-label="各材料 A1 到 A3 排放量横向条形图">
        {chart.map((row, index) => <div className="a1-bar-row" key={row.id}>
          <span title={row.name}>{row.name}</span><div className="a1-bar-track"><i style={{ width: `${stats.total ? Math.max(0, Math.min(100, row.emission / stats.total * 100)) : 0}%`, background: index === 0 ? "#2d9464" : index < 3 ? "#78bf91" : "#b7dcc3" }}/></div><b>{format.format(row.emission / 1000)}</b>
        </div>)}
        {!chart.length && <p className="a1-empty">当前清单没有可计算的排放数据。</p>}
      </div>
      <div className="a1-evidence-grid">
        <div><small>前三项材料占比</small><strong>{stats.total ? format.format(topThree / stats.total * 100) : 0}%</strong><span>优先核查这些材料的工程量与因子</span></div>
        <div className={missingSource.length ? "needs-review" : ""}><small>因子来源待补</small><strong>{missingSource.length} / {ranked.length} 项</strong><span>{missingSource.length ? `涉及当前排放量的 ${format.format(missingShare)}%` : "已填写来源；仍需核验适用性"}</span></div>
      </div>
      {missingSource.length > 0 && <details className="a1-missing"><summary>查看待补来源的材料</summary><ul>{missingSource.map((row) => <li key={row.id}>{row.name} · {format.format(row.emission / 1000)} tCO₂e</li>)}</ul></details>}
      <p className="a1-chart-note">按清单工程量 × 单位碳因子计算；条形长度占当前 A1–A3 总量。来源已填写不代表因子已验证。</p>
    </>}

    {tab === "part" && <>
      <div className="a1-bars" role="img" aria-label="各构件 A1 到 A3 排放量横向条形图">
        {parts.map((item, index) => <div className="a1-bar-row" key={item.part}>
          <span title={item.part}>{item.part}</span><div className="a1-bar-track"><i style={{ width: `${maxPart ? Math.max(2, item.emission / maxPart * 100) : 0}%`, background: index === 0 ? "#2d9464" : index < 3 ? "#78bf91" : "#b7dcc3" }}/></div><b>{format.format(item.emission / 1000)}</b>
        </div>)}
        {!parts.length && <p className="a1-empty">当前清单没有可计算的排放数据。</p>}
      </div>
      <p className="a1-chart-note">按清单“构件/用途”列汇总同一 A1–A3 边界内的排放；缺少该列时全部归入“未分类”。构件分组只影响查看方式，不改变总量。</p>
    </>}

    {tab === "pareto" && <>
      <div className="a1-pareto" role="img" aria-label="材料排放帕累托图：柱形为排放量，折线为累计占比">
        <ResponsiveContainer width="100%" height={235}>
          <ComposedChart data={paretoData} margin={{ top: 18, right: 8, left: -16, bottom: 2 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5ece9"/>
            <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} height={56} angle={-16} textAnchor="end" tick={{ fontSize: 10, fill: "#61756e" }}/>
            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#81918c" }}/>
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#b08947" }}/>
            <Tooltip formatter={(value, name) => name === "累计占比" ? `${value}%` : `${format.format(value)} tCO₂e`}/>
            <Bar yAxisId="left" dataKey="tonnes" name="排放量" radius={[6, 6, 0, 0]}>{paretoData.map((item, index) => <Cell key={item.id} fill={index === 0 ? "#2d9464" : index < 3 ? "#78bf91" : "#b7dcc3"}/>)}</Bar>
            <Line yAxisId="right" type="monotone" dataKey="cumulative" name="累计占比" stroke="#e1a857" strokeWidth={2} dot={{ r: 3, fill: "#e1a857" }}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="a1-chart-note">材料按排放量降序排列，折线是累计占比。前几项累计接近 80% 时，说明核查应集中在这些材料上；曲线越平缓，排放越分散。</p>
    </>}

    {tab === "sensitivity" && <>
      <div className="a1-tornado" role="img" aria-label="各材料参数 ±10% 偏差对 A1–A3 总量的影响">
        {topSwings.map((item) => <div className="a1-tornado-row" key={item.id}>
          <span title={item.name}>{item.name}</span>
          <div className="a1-tornado-track"><i className="a1-tornado-center"/><i className="a1-tornado-band" style={{ width: `${Math.min(100, item.swingShare * 200)}%` }}/></div>
          <b>±{format.format(item.swingShare * 100)}%</b>
        </div>)}
        {!topSwings.length && <p className="a1-empty">当前清单没有可计算的排放数据。</p>}
      </div>
      <p className="a1-chart-note">假设单项的工程量或碳因子存在 ±{Math.round(step * 100)}% 偏差（线性模型下两者对总量的影响相同），总量 {format.format(total / 1000)} tCO₂e 会相应摆动图中百分比。摆动最大的项目，就是最值得优先核实的数据。</p>
    </>}
  </div>;
}
