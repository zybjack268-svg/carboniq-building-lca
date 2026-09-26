import React, { useEffect, useRef } from "react";

// 惯性滑块：拖动时数值实时跟随指针；松手后按 recent 速度做指数衰减滑行，
// 平滑减速到停止，不发生跳变。到达边界或有新按下时立即接管。
export default function SpringSlider({ value, onChange, min = 0, max = 100, ariaLabel, disabled = false }) {
  const trackRef = useRef(null);
  const dragRef = useRef({ dragging: false, startX: 0, startValue: 0, samples: [] });
  const glideRef = useRef({ raf: 0, velocity: 0, current: value, lastT: 0 });
  const latestRef = useRef(value);

  useEffect(() => { latestRef.current = value; }, [value]);
  useEffect(() => () => cancelAnimationFrame(glideRef.current.raf), []);

  const clamp = (v) => Math.min(max, Math.max(min, v));
  const emit = (v) => { latestRef.current = v; onChange(Math.round(v)); };
  const pct = Math.round(((latestRef.current - min) / (max - min)) * 100);

  const stopGlide = () => cancelAnimationFrame(glideRef.current.raf);

  const onPointerDown = (event) => {
    if (disabled) return;
    const track = trackRef.current;
    stopGlide();
    track.setPointerCapture?.(event.pointerId);
    dragRef.current = { dragging: true, startX: event.clientX, startValue: latestRef.current, samples: [{ t: performance.now(), x: event.clientX }] };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag.dragging) return;
    const width = Math.max(1, trackRef.current.clientWidth);
    const raw = drag.startValue + ((event.clientX - drag.startX) / width) * (max - min);
    emit(clamp(raw));
    drag.samples.push({ t: performance.now(), x: event.clientX });
    if (drag.samples.length > 8) drag.samples.shift();
  };

  const onPointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag.dragging) return;
    drag.dragging = false;
    // 用最近 60ms 内的样本估计松手速度（px/ms → 单位/秒）
    const now = performance.now();
    const recent = drag.samples.filter((sample) => now - sample.t <= 80);
    let velocity = 0;
    if (recent.length >= 2) {
      const first = recent[0];
      const last = recent[recent.length - 1];
      const span = last.t - first.t;
      if (span >= 16) velocity = ((last.x - first.x) / span) * 1000;
    }
    const width = Math.max(1, trackRef.current.clientWidth);
    glideRef.current.velocity = (velocity / width) * (max - min);
    glideRef.current.current = latestRef.current;
    glideRef.current.lastT = performance.now();
    if (Math.abs(glideRef.current.velocity) < 12) return;
    const glide = () => {
      const g = glideRef.current;
      const now = performance.now();
      const dt = Math.min(0.05, (now - g.lastT) / 1000);
      g.lastT = now;
      g.current += g.velocity * dt;
      g.velocity *= Math.exp(-dt / 0.16);
      if (g.current <= min || g.current >= max) {
        emit(clamp(g.current));
        cancelAnimationFrame(g.raf);
        return;
      }
      emit(g.current);
      if (Math.abs(g.velocity) < 10) { cancelAnimationFrame(g.raf); return; }
      g.raf = requestAnimationFrame(glide);
    };
    glideRef.current.raf = requestAnimationFrame(glide);
  };

  const onKeyDown = (event) => {
    const step = (max - min) / 50;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") { stopGlide(); emit(clamp(latestRef.current - step)); event.preventDefault(); }
    if (event.key === "ArrowRight" || event.key === "ArrowUp") { stopGlide(); emit(clamp(latestRef.current + step)); event.preventDefault(); }
  };

  return <div
    ref={trackRef}
    className={`ciq-slider ${disabled ? "disabled" : ""}`}
    role="slider"
    tabIndex={disabled ? -1 : 0}
    aria-label={ariaLabel}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={Math.round(latestRef.current)}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerUp}
    onKeyDown={onKeyDown}
  >
    <i className="ciq-slider-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}/>
    <i className="ciq-slider-knob" style={{ left: `${Math.max(0, Math.min(100, pct))}%` }}/>
  </div>;
}
