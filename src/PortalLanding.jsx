import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import "./portal.css";

const OPEN_DURATION = 2050;
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function EdgeParticles({ phase, leftRef, rightRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    // The closed door uses CSS light only; keep the canvas completely idle until opening.
    if (phase !== "opening" || reduceMotion()) return undefined;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!context) return undefined;
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    const particles = [];
    const random = (min, max) => min + Math.random() * (max - min);
    const makeGlow = (color) => {
      const sprite = document.createElement("canvas");
      sprite.width = sprite.height = 32;
      const brush = sprite.getContext("2d");
      const glow = brush.createRadialGradient(16, 16, 0, 16, 16, 16);
      glow.addColorStop(0, `rgba(${color}, 1)`);
      glow.addColorStop(.2, `rgba(${color}, .8)`);
      glow.addColorStop(1, `rgba(${color}, 0)`);
      brush.fillStyle = glow;
      brush.fillRect(0, 0, 32, 32);
      return sprite;
    };
    const glows = [makeGlow("255, 211, 134"), makeGlow("126, 241, 207")];
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      // Decorative particles do not need high-DPI backing pixels.
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const emit = (edge, side) => {
      const y = random(0, height);
      particles.push({
        x: edge + random(-3, 3), y,
        vx: side * random(35, 135) + random(-25, 25),
        vy: random(-35, 35),
        life: 1, fade: random(.7, 1.4),
        size: random(11, 27),
        glow: Math.random() > .53 ? 0 : 1,
      });
    };
    const draw = (time) => {
      frame = requestAnimationFrame(draw);
      if (time - last < 32 || document.hidden) return;
      const dt = Math.min((time - (last || time)) / 1000, .04);
      last = time;
      context.clearRect(0, 0, width, height);
      const left = leftRef.current?.getBoundingClientRect();
      const right = rightRef.current?.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      if (left && right) {
        for (let i = 0; i < 6; i += 1) {
          emit(left.right - canvasRect.left, -1);
          emit(right.left - canvasRect.left, 1);
        }
      }
      if (particles.length > 150) particles.splice(0, particles.length - 150);
      context.globalCompositeOperation = "lighter";
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.exp(-1.8 * dt);
        p.life -= p.fade * dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const size = p.size * Math.max(.35, p.life);
        context.globalAlpha = p.life;
        context.drawImage(glows[p.glow], p.x - size / 2, p.y - size / 2, size, size);
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
    };
    frame = requestAnimationFrame(draw);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [phase, leftRef, rightRef]);

  return phase === "opening" && !reduceMotion()
    ? <canvas ref={canvasRef} className="portal-particles" aria-hidden="true" />
    : null;
}

export default function PortalLanding({ enter }) {
  const [phase, setPhase] = useState("loading");
  const [pulse, setPulse] = useState(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const spotlightRef = useRef(null);
  const pointerFrame = useRef(0);
  const pointerPosition = useRef({ x: 0, y: 0 });
  const timers = useRef([]);
  const entered = useRef(false);

  useEffect(() => {
    let alive = true;
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    Promise.all([Promise.race([document.fonts.ready, delay(1500)]), delay(520)]).then(() => {
      if (!alive) return;
      setPhase(reduceMotion() ? "ready" : "vortex");
      if (!reduceMotion()) timers.current.push(setTimeout(() => alive && setPhase("ready"), 900));
    });
    return () => { alive = false; timers.current.forEach(clearTimeout); cancelAnimationFrame(pointerFrame.current); };
  }, []);

  const finish = () => {
    if (entered.current) return;
    entered.current = true;
    enter();
  };
  const open = () => {
    if (phase !== "ready") return;
    setPhase("opening");
    timers.current.push(setTimeout(finish, reduceMotion() ? 180 : OPEN_DURATION));
  };
  const track = (event) => {
    if (phase === "opening") return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerPosition.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (pointerFrame.current) return;
    pointerFrame.current = requestAnimationFrame(() => {
      const { x, y } = pointerPosition.current;
      if (spotlightRef.current) spotlightRef.current.style.transform = `translate3d(${x - 460}px, ${y - 460}px, 0)`;
      pointerFrame.current = 0;
    });
  };
  const flash = (event) => {
    if (event.target.closest(".portal-knob")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPulse({ x: event.clientX - rect.left, y: event.clientY - rect.top, id: Date.now() });
  };

  return <main className={`portal portal--${phase}`} onPointerMove={track} onPointerDown={flash}>
    <div ref={spotlightRef} className="portal-spotlight" aria-hidden="true" />
    <div className="portal-reveal" aria-hidden="true">
      <div className="portal-reveal-halo" />
      <div className="portal-elevation">
        <svg viewBox="0 0 900 580" role="presentation" preserveAspectRatio="xMidYMid meet">
          <defs><pattern id="portal-window" x="0" y="0" width="70" height="72" patternUnits="userSpaceOnUse"><rect x="11" y="12" width="47" height="43" rx="2" fill="#5dd1a5" fillOpacity=".035" stroke="#7fe6bf" strokeOpacity=".35" strokeWidth="1" /><path d="M34 13v41" stroke="#7fe6bf" strokeOpacity=".18" /></pattern></defs>
          <path d="M104 526h692M161 500V105h578v395M143 105h614M180 82h540" fill="none" stroke="#8bf1c8" strokeOpacity=".55" strokeWidth="2" />
          <rect x="162" y="106" width="576" height="393" fill="url(#portal-window)" />
          <path d="M162 180h576M162 254h576M162 328h576M162 402h576M162 476h576M248 106v393M650 106v393" fill="none" stroke="#8bf1c8" strokeOpacity=".14" />
          <path d="M89 526h721" stroke="#c9f8dc" strokeOpacity=".2" strokeWidth="14" />
        </svg>
      </div>
      <div className="portal-reveal-copy"><span>BUILDING CARBON</span><strong>从建筑本身，<br />看清每一份排放。</strong><small>材料生产 / 运输 / 施工 / 运营</small></div>
    </div>

    <div className="portal-doors" aria-hidden="true">
      <div ref={leftRef} className="portal-door portal-door--left"><div className="portal-door-face"><span className="portal-index">01 / MATERIALS</span><span className="portal-door-word">建<span>筑</span></span><span className="portal-door-foot">材料 · 运输</span></div></div>
      <div ref={rightRef} className="portal-door portal-door--right"><div className="portal-door-face"><span className="portal-index">02 / LIFE CYCLE</span><span className="portal-door-word">碳<span>迹</span></span><span className="portal-door-foot">施工 · 运营</span></div></div>
    </div>
    <EdgeParticles phase={phase} leftRef={leftRef} rightRef={rightRef} />
    <div className="portal-top"><div className="portal-brand ciq-lockup"><img src="/carboniq-icon.svg" alt="" className="ciq-icon ciq-icon-xs"/><span className="ciq-word ciq-word-sm"><b>Carbon</b><em>IQ</em></span></div><span className="portal-top-caption">建筑碳排放分析平台</span></div>
    <div className="portal-center">
      <div className="portal-center-line" />
      <button className="portal-knob" type="button" onClick={open} disabled={phase !== "ready"} aria-label={phase === "ready" ? "按下旋钮，进入建筑碳排放分析平台" : "入口加载中"}>
        <span className="portal-vortex" />
        <span className="portal-knob-body"><span className="portal-knob-grooves" /><span className="portal-knob-core"><ArrowUpRight size={22} strokeWidth={1.5} /></span></span>
      </button>
      <span className="portal-instruction" aria-live="polite">{phase === "loading" ? "正在准备入口" : phase === "vortex" ? "入口正在开启" : phase === "opening" ? "正在进入" : "按下旋钮 · 开启分析"}</span>
    </div>
    <div className="portal-bottom"><span>材料生产 — 运输 — 施工 — 运营</span><button type="button" onClick={finish}>直接进入 <ArrowUpRight size={15} /></button></div>
    {pulse && <span key={pulse.id} className="portal-click-light" style={{ left: pulse.x, top: pulse.y }} aria-hidden="true" />}
  </main>;
}
