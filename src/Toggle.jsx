import React from "react";

// 果冻开关：拨动时滑块沿拨动方向先压扁再回弹，轨道同步轻微形变。
// 纯展示状态由 .on 类驱动，实际状态仍由受控的 checkbox 承载（可访问性保留）。
export default function Toggle({ checked, onChange, label, children, disabled }) {
  return <label className={`ciq-toggle ${checked ? "on" : ""} ${disabled ? "disabled" : ""}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)}/>
    <span className="ciq-switch" aria-hidden="true"><i className="ciq-knob"/></span>
    <span className="ciq-toggle-text">{label && <b>{label}</b>}{children}</span>
  </label>;
}
