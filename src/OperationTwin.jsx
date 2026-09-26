import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MousePointer2, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { deriveBuildingGeometry } from "./geometry.js";
import { createBuildingModel, createWindowFacadeTexture } from "./buildingModel.js";
import { createParticlePool, spawnParticle, advanceParticles } from "./particles3d.js";
import { hasModelConfig, requestAdvisor } from "./advisorEngine.js";

// B6 运营能耗数字孪生：夜景建筑 + 三色能流粒子（电力/燃气/市政热力）+ 构成与逐年图表。
// 粒子密度按各能源年度排放占比示意；数值全部来自本地核算，不由模型生成。

const STREAMS = [
  { key: "electricity", label: "电力", color: 0xffc95e, css: "#ffc95e", size: 1.05 },
  { key: "gas", label: "燃气", color: 0x7ec8ff, css: "#7ec8ff", size: .85 },
  { key: "heat", label: "市政热力", color: 0xff8a50, css: "#ff8a50", size: 1 },
];

export default function OperationTwin({ project, climate, operationResult, areaKnown = false }) {
  const geometry = deriveBuildingGeometry(project);
  const floorCount = geometry.floors;
  const floorHeight = geometry.floorHeight;
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showStreams, setShowStreams] = useState(true);
  const [fallback, setFallback] = useState(false);

  const electricityKg = operationResult?.electricityKg ?? null;
  const gasKg = operationResult?.gasKg ?? null;
  const heatKg = operationResult?.heatKg ?? null;
  const annualKg = operationResult?.annualKg ?? null;
  const shares = (() => {
    const total = (electricityKg ?? 0) + (gasKg ?? 0) + (heatKg ?? 0);
    if (total <= 0) return { electricity: 0, gas: 0, heat: 0 };
    return {
      electricity: (electricityKg ?? 0) / total,
      gas: (gasKg ?? 0) / total,
      heat: (heatKg ?? 0) / total,
    };
  })();
  const hasData = annualKg !== null && annualKg > 0;
  const tonnes = annualKg === null ? null : annualKg / 1000;
  const intensity = hasData && areaKnown && Number(project?.area) > 0 ? annualKg / project.area : null;
  const horizon = operationResult?.years || Number(climate?.years) || 0;
  const breakdown = STREAMS.map((stream) => ({
    name: stream.label,
    value: Number(((operationResult?.[stream.key === "electricity" ? "electricityKg" : stream.key === "gas" ? "gasKg" : "heatKg"]) ?? 0) / 1000),
    fill: stream.css,
  })).filter((item) => item.value > 0);
  const horizonData = hasData && horizon >= 1
    ? Array.from({ length: Math.min(Math.round(horizon), 50) }, (_, index) => ({
        year: `${index + 1}`,
        累计排放: Number((tonnes * (index + 1)).toFixed(1)),
      }))
    : [];

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setFallback(true);
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f14);
    scene.fog = new THREE.FogExp2(0x0a0f14, .016);
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 400);
    camera.position.set(24, 15, 28);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "运营能耗三维示意：夜景建筑与三色能流粒子");
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .08;
    controls.target.set(0, floorCount * floorHeight * .42, 0);
    controls.minDistance = 10;
    controls.maxDistance = 110;
    controls.maxPolarAngle = Math.PI * .48;
    controls.autoRotate = true;
    controls.autoRotateSpeed = .5;

    scene.add(new THREE.HemisphereLight(0x51708c, 0x0c1013, .7));
    const moon = new THREE.DirectionalLight(0xa8c4de, .9);
    moon.position.set(-18, 26, -12);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -34;
    moon.shadow.camera.right = 34;
    moon.shadow.camera.top = 34;
    moon.shadow.camera.bottom = -34;
    scene.add(moon);

    const BUILD_L = 17;
    const BUILD_W = 7.4;
    const site = new THREE.Group();
    scene.add(site);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x11161b, roughness: .95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    site.add(ground);
    const grid = new THREE.GridHelper(90, 45, 0x1e3a44, 0x14222a);
    grid.position.y = .02;
    grid.material.transparent = true;
    grid.material.opacity = .4;
    site.add(grid);
    const podium = new THREE.Mesh(new THREE.BoxGeometry(BUILD_L + 8, .16, BUILD_W + 6), new THREE.MeshStandardMaterial({ color: 0x1b2129, roughness: .9 }));
    podium.position.y = .08;
    podium.receiveShadow = true;
    site.add(podium);
    const green = new THREE.Mesh(new THREE.BoxGeometry(BUILD_L + 20, .1, 3), new THREE.MeshStandardMaterial({ color: 0x14231a, roughness: .95 }));
    green.position.set(0, .04, BUILD_W / 2 + 6.5);
    site.add(green);

    // 周边城市夜景
    const cityTexture = createWindowFacadeTexture({ floors: 20, cols: 6, litRatio: .4, seed: 5 });
    for (const [x, z, w, d, h] of [[-30, -8, 10, 9, 20], [28, 10, 12, 10, 26], [6, -30, 14, 10, 15], [-22, -28, 9, 9, 18], [32, -14, 9, 10, 22], [-34, 14, 8, 8, 13]]) {
      const map = cityTexture.texture.clone();
      map.needsUpdate = true;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(Math.max(1, Math.round(w / 5)), Math.max(1, Math.round(h / 4)));
      const cityMat = new THREE.MeshStandardMaterial({ color: 0x1c2228, roughness: .72, metalness: .2, map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .8 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cityMat);
      box.position.set(x, h / 2, z);
      site.add(box);
    }

    // 主建筑：全亮夜景
    const model = createBuildingModel({ floors: floorCount, floorHeight, length: BUILD_L, width: BUILD_W, night: true, seed: 11, litRatio: .7 });
    site.add(model.group);

    // 建筑核心暖光，让夜景有"活着"的感觉
    const coreLight = new THREE.PointLight(0xffd9a0, 40, 30, 2);
    coreLight.position.set(0, floorCount * floorHeight * .5, 0);
    site.add(coreLight);

    // —— 能流粒子 ——
    const pools = {};
    for (const stream of STREAMS) {
      const count = stream.key === "electricity" ? 700 : 320;
      pools[stream.key] = createParticlePool({ count, color: stream.color, size: stream.size, opacity: .95, additive: true });
      site.add(pools[stream.key].points);
    }

    const facadeTop = floorCount * floorHeight;
    // 排放点位：电力沿各层立面随机取点；燃气在低层通风口；热力在屋顶热交换站
    const emitElectricity = (rand) => {
      const level = 1 + Math.floor(rand() * floorCount);
      const side = rand();
      let x; let z;
      if (side < .45) { x = (rand() - .5) * (BUILD_L - 1); z = -BUILD_W / 2 - .1; }
      else if (side < .7) { x = (rand() - .5) * (BUILD_L - 1); z = BUILD_W / 2 + .1; }
      else if (side < .85) { x = -BUILD_L / 2 - .1; z = (rand() - .5) * (BUILD_W - 1); }
      else { x = BUILD_L / 2 + .1; z = (rand() - .5) * (BUILD_W - 1); }
      return { x, y: (level - .5) * floorHeight, z };
    };
    const gasVents = [
      { x: -BUILD_L / 4, y: floorHeight * .9, z: BUILD_W / 2 + .3 },
      { x: BUILD_L / 6, y: floorHeight * .9, z: BUILD_W / 2 + .3 },
    ];
    const heatStack = { x: BUILD_L / 2 - 2.6, y: facadeTop + 1.8, z: 1 };

    const clock = new THREE.Clock();
    let frame;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(.05, clock.getDelta());
      const time = clock.elapsedTime;
      const current = sceneRef.current || {};
      const streamsOn = current.streamsOn ?? true;
      const rates = current.streamRates || { electricity: 0, gas: 0, heat: 0 };
      controls.update();
      model.beacon.material.emissiveIntensity = 1.5 + Math.sin(time * 2.2);

      if (!reducedMotion && streamsOn) {
        const accumulator = current.accumulator || (current.accumulator = { electricity: 0, gas: 0, heat: 0 });
        // 电力能流：金色粒子沿立面各层升起
        accumulator.electricity += rates.electricity * 64 * delta;
        while (accumulator.electricity > 1) {
          accumulator.electricity -= 1;
          const point = emitElectricity(Math.random);
          spawnParticle(pools.electricity, point.x, point.y, point.z, [(Math.random() - .5) * .25, 1.15 + Math.random() * .5, (Math.random() - .5) * .25], 3.2, .3);
        }
        // 燃气能流：蓝色粒子从低层通风口
        accumulator.gas += rates.gas * 44 * delta;
        while (accumulator.gas > 1) {
          accumulator.gas -= 1;
          const vent = gasVents[Math.random() < .5 ? 0 : 1];
          spawnParticle(pools.gas, vent.x, vent.y, vent.z, [0, 1.3, .25], 2.8, .35);
        }
        // 热力能流：橙色粒子从屋顶热交换站
        accumulator.heat += rates.heat * 44 * delta;
        while (accumulator.heat > 1) {
          accumulator.heat -= 1;
          spawnParticle(pools.heat, heatStack.x, heatStack.y, heatStack.z, [(Math.random() - .5) * .3, 1.5, (Math.random() - .5) * .3], 3, .3);
        }
        advanceParticles(pools.electricity, delta, { drag: .996, rise: .12 });
        advanceParticles(pools.gas, delta, { drag: .994, rise: .1 });
        advanceParticles(pools.heat, delta, { drag: .994, rise: .12 });
      }
      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = { scene, camera, controls, renderer, streamsOn: true, streamRates: { electricity: 0, gas: 0, heat: 0 } };

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, [floorCount, floorHeight]);

  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    current.streamRates = shares;
    current.controls.autoRotate = autoRotate;
  }, [shares, autoRotate]);

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.streamsOn = showStreams;
  }, [showStreams]);

  const resetCamera = () => {
    const current = sceneRef.current;
    if (!current) return;
    current.camera.position.set(24, 15, 28);
    current.controls.target.set(0, floorCount * floorHeight * .42, 0);
    current.controls.update();
  };

  const format = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });

  return <div className="twin-page twin-rework">
    <header className="twin-head">
      <div><span>B6 运营能源</span><h1>运营能耗数字孪生</h1></div>
      <div className="twin-status"><i/><span><b>{project?.name || "项目"}</b><small>{floorCount} 层 · 夜间能流示意</small></span></div>
    </header>

    <section className="twin-grid">
      <article className="twin-viewer panel">
        <div className="twin-canvas" ref={hostRef}/>
        <div className="twin-view-summary"><small>年度排放</small><b>{hasData ? `${format.format(tonnes)} tCO₂e/年` : "待输入"}</b><span>{STREAMS.filter((s) => shares[s.key] > 0).map((s) => s.label).join(" · ") || "未录入能源"}</span></div>
        <div className="twin-hint"><MousePointer2 size={15}/>拖动旋转 · 滚轮缩放</div>
        <div className="twin-view-controls">
          <button aria-label="重置3D视角" title="重置视角" onClick={resetCamera}><RotateCcw size={17}/></button>
          <button aria-label={autoRotate ? "暂停自动旋转" : "开启自动旋转"} title="自动旋转" onClick={() => setAutoRotate((value) => !value)}>{autoRotate ? <Pause size={17}/> : <Play size={17}/>}</button>
          <button className={showStreams ? "active" : ""} onClick={() => setShowStreams((value) => !value)} aria-pressed={showStreams}><Sparkles size={15}/>能流粒子</button>
        </div>
      </article>

      <aside className="twin-inspector panel">
        <header><span>B6 · 年度能源排放</span><b>{hasData ? `${format.format(tonnes)} tCO₂e` : "待输入"}</b></header>
        <div className="twin-emission-list">
          {STREAMS.map((stream) => {
            const value = stream.key === "electricity" ? electricityKg : stream.key === "gas" ? gasKg : heatKg;
            const active = value !== null && value > 0;
            return <div key={stream.key} className="twin-emission-row"><div><b><i className="twin-stream-dot" style={{ background: stream.css }}/>{stream.label}</b><strong>{value === null ? "未录入" : `${format.format(value / 1000)} tCO₂e/年`}</strong></div><i><span style={{ width: `${(shares[stream.key] || 0) * 100}%`, background: stream.css }}/></i></div>;
          })}
        </div>
        <div className="b6-facts">
          <div><small>单位面积强度</small><b>{intensity !== null ? `${format.format(intensity)} kgCO₂e/(m²·年)` : "—"}</b></div>
          <div><small>{horizon || "—"} 年情景累计</small><b>{hasData && horizon >= 1 ? `${format.format(tonnes * horizon)} tCO₂e` : "—"}</b></div>
        </div>
        <div className="twin-legend">
          {STREAMS.map((stream) => <span key={stream.key}><i style={{ background: stream.css }}/>{stream.label}能流（密度 ∝ 排放占比）</span>)}
        </div>
        <p className="twin-particle-note">粒子为持续上升的能流：电力沿立面、燃气经低层通风口、热力经屋顶热交换站。密度按已录入能源的排放占比示意，不代表实时监测值；电网与燃气因子请按项目年份与地区核实。</p>
      </aside>
    </section>

    <section className="b6-charts" aria-label="运营能耗图表">
      <article className="panel b6-chart-panel">
        <header><small>ANNUAL BREAKDOWN</small><h3>年度排放构成</h3><span>单位：tCO₂e/年</span></header>
        {breakdown.length ? <div className="b6-chart-body"><ResponsiveContainer width="100%" height={210}>
          <BarChart data={breakdown} margin={{ top: 14, right: 12, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5ece9"/>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#61756e" }}/>
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#81918c" }}/>
            <Tooltip formatter={(value) => `${format.format(value)} tCO₂e/年`}/>
            <Bar dataKey="value" radius={[7, 7, 0, 0]} maxBarSize={64}>{breakdown.map((item) => <Cell key={item.name} fill={item.fill}/>)}</Bar>
          </BarChart>
        </ResponsiveContainer></div> : <p className="b6-chart-empty">录入年度用电、燃气或购热量后，这里会显示各能源的排放构成。</p>}
      </article>
      <article className="panel b6-chart-panel">
        <header><small>HORIZON SCENARIO</small><h3>情景年限累计排放</h3><span>{horizon >= 1 ? `${Math.min(Math.round(horizon), 50)} 年 · 恒定因子` : "未设定年限"}</span></header>
        {horizonData.length ? <div className="b6-chart-body"><ResponsiveContainer width="100%" height={210}>
          <BarChart data={horizonData} margin={{ top: 14, right: 12, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5ece9"/>
            <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#81918c" }} interval={Math.max(0, Math.ceil(horizonData.length / 10) - 1)}/>
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#81918c" }}/>
            <Tooltip formatter={(value) => `${format.format(value)} tCO₂e`} labelFormatter={(label) => `第 ${label} 年末累计`}/>
            <Bar dataKey="累计排放" fill="#2d9464" radius={[4, 4, 0, 0]} maxBarSize={26}/>
          </BarChart>
        </ResponsiveContainer><p className="b6-chart-note">仅为年度结果 × 年数的恒定情景；未预测逐年能耗变化、电网因子变化或设备更换。</p></div> : <p className="b6-chart-empty">填入能源数据并设定情景年限后，这里显示逐年累计排放。</p>}
      </article>
    </section>
    {fallback && <p role="alert">当前浏览器无法启动 WebGL，无法显示三维能耗示意。</p>}
  </div>;
}
