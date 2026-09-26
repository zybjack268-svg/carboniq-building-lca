import React, { useEffect, useMemo, useState } from "react";
import { Database, Search, X } from "lucide-react";
import { searchFactors } from "./factorLibrary.js";
import "./factor-library.css";

// 可复用的碳因子库选择器：open 控制显示，category 决定分类，
// filter 可进一步收窄条目（如 B6 电力/燃气），onSelect 返回所选条目。
export default function FactorPicker({ open, category, filter, title, hint, onSelect, onClose }) {
  const [query, setQuery] = useState("");
  useEffect(() => { if (open) setQuery(""); }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const results = useMemo(
    () => searchFactors(category, query).filter((entry) => (filter ? filter(entry) : true)),
    [category, query, filter],
  );
  if (!open) return null;
  return <div className="fl-backdrop" onClick={onClose}>
    <section className="fl-dialog" role="dialog" aria-modal="true" aria-label={title || "碳因子库"} onClick={(event) => event.stopPropagation()}>
      <header className="fl-head">
        <div><small>REFERENCE FACTOR LIBRARY</small><h2>{title || "碳因子库"}</h2><p>{hint || "选择后自动填入因子与来源。库中数值为公开参考值，选用前请核对单位边界与适用性。"}</p></div>
        <button type="button" className="fl-close" onClick={onClose} aria-label="关闭因子库"><X size={17}/></button>
      </header>
      <div className="fl-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、单位或来源…" aria-label="搜索因子库" autoFocus/></div>
      <div className="fl-list">
        {results.map((entry) => <button type="button" key={entry.id} className="fl-item" onClick={() => onSelect(entry)}>
          <span className="fl-item-main">
            <span className="fl-item-name">{entry.name}<em>{entry.group}</em></span>
            <span className="fl-item-source">来源：{entry.source}</span>
            {entry.note && <span className="fl-item-note" title={entry.note}>{entry.note}</span>}
          </span>
          <span className="fl-item-value"><b>{entry.factor}</b><small>{entry.unit}</small></span>
        </button>)}
        {!results.length && <p className="fl-empty">没有匹配的因子。换个关键词，或按你自己的来源手动填写。</p>}
      </div>
      <p className="fl-foot"><Database size={13}/> 建材与运输因子已对照 GB/T 51366-2019 附录A/D/E 核实，能源因子来自生态环境部公告；仍不代替产品 EPD 和按项目实际核定的因子。</p>
    </section>
  </div>;
}
