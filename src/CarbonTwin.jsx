import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Box, Building2, Eye, Layers3, MousePointer2, Pause, Play, Sparkles,
  RotateCcw,
} from "lucide-react";
import { deriveBuildingGeometry } from "./geometry.js";

const FLOOR_HEIGHT = 2.55;
const BUILD_STAGES = ["地基", "主体结构", "围护墙体", "门窗立面", "屋面完成"];
const MODEL_TYPES = [
  { id: "linear", label: "线性体量" },
  { id: "double", label: "双翼体量" },
  { id: "tower", label: "紧凑体量" },
];
const MATERIALS = {
  concrete: { label: "混凝土", color: "#a8bcb2" },
  steel: { label: "钢筋", color: "#637e87" },
  brick: { label: "砌体", color: "#c3ad8e" },
  glass: { label: "玻璃", color: "#72bfcd" },
  aluminum: { label: "铝构件", color: "#c3d5d0" },
};

function colorFor(key) {
  const meta = MATERIALS[key] || MATERIALS.concrete;
  return new THREE.Color(meta.color);
}

export default function CarbonTwin({ project, stats, go, embedded = false }) {
  const geometry = deriveBuildingGeometry(project);
  const buildingKind = geometry.type.id;
  const floorCount = geometry.floors;
  const floorHeight = geometry.floorHeight;
  const footprintSpan = Math.max(geometry.length, geometry.width, floorCount * floorHeight);
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const [floor, setFloor] = useState("all");
  const [explode, setExplode] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [structureOnly, setStructureOnly] = useState(false);
  const [model, setModel] = useState(geometry.layout);
  const [stage, setStage] = useState(4);
  const [builtFloors, setBuiltFloors] = useState(floorCount);
  const [playing, setPlaying] = useState(false);
  const [showCarbon, setShowCarbon] = useState(true);
  const [selected, setSelected] = useState(null);
  const ranked = [...(stats?.rows || [])].sort((a, b) => b.emission - a.emission);

  useEffect(() => { setModel(geometry.layout); setSelected(null); }, [geometry.layout, project.geometry]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setTimeout(() => {
      if (stage === 0) { setStage(1); setBuiltFloors(1); }
      else if (stage === 1 && builtFloors < floorCount) setBuiltFloors((current) => current + 1);
      else if (stage < 4) { setBuiltFloors(floorCount); setStage((current) => current + 1); }
      else setPlaying(false);
    }, stage === 1 ? 490 : 1150);
    return () => window.clearTimeout(timer);
  }, [playing, stage, builtFloors, floorCount]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b2422, .018);
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 150);
    camera.position.set(footprintSpan * 1.2, Math.max(16, floorCount * floorHeight * 1.15), footprintSpan * 1.25);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", `${floorCount} 层建筑三维示意模型`);
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .075;
    controls.target.set(0, floorCount * floorHeight / 2, 0);
    controls.minDistance = 13;
    controls.maxDistance = Math.max(80, footprintSpan * 5);
    controls.maxPolarAngle = Math.PI * .48;
    controls.autoRotate = true;
    controls.autoRotateSpeed = .52;

    scene.add(new THREE.HemisphereLight(0xc8fff0, 0x17302d, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 3.5);
    sun.position.set(12, 24, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -26;
    sun.shadow.camera.right = 26;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -10;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x4fffd0, 1.5);
    rim.position.set(-14, 9, -18);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(64, 48),
      new THREE.MeshStandardMaterial({ color: 0x123632, transparent: true, opacity: .7, roughness: .82 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(60, 30, 0x4ec7a5, 0x28534c);
    grid.position.y = .015;
    grid.material.transparent = true;
    grid.material.opacity = .28;
    scene.add(grid);

    const building = new THREE.Group();
    building.rotation.y = -.12;
    scene.add(building);
    const floorGroups = [];
    const selectable = [];

    const addBox = (parent, size, position, materialKey, name, floorNumber, options = {}) => {
      const material = new THREE.MeshPhysicalMaterial({
        color: colorFor(materialKey),
        roughness: options.roughness ?? .4,
        metalness: options.metalness ?? .05,
        transparent: options.opacity != null && options.opacity < 1,
        opacity: options.opacity ?? 1,
        transmission: options.transmission ?? 0,
        thickness: options.transmission ? .35 : 0,
        emissive: 0x000000,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...position);
      mesh.castShadow = options.castShadow !== false;
      mesh.receiveShadow = true;
      const phase = name.includes("屋面") || name.includes("楼梯间") ? 4
        : materialKey === "brick" ? 2
          : ["glass", "aluminum"].includes(materialKey) ? 3 : 1;
      mesh.userData = { materialKey, name, floor: floorNumber, phase: options.phase ?? phase };
      parent.add(mesh);
      selectable.push(mesh);
      return mesh;
    };

    addBox(building, [19.5, .42, 8.5], [0, .22, 0], "concrete", "基础底板", 0, { phase: 0, roughness: .76 });

    for (let level = 1; level <= floorCount; level += 1) {
      const group = new THREE.Group();
      group.position.y = (level - 1) * FLOOR_HEIGHT;
      group.userData = { floor: level, baseY: group.position.y };
      floorGroups.push(group);
      building.add(group);

      addBox(group, [18, .24, 7], [0, .12, 0], "concrete", `${level}层楼板`, level, { roughness: .62 });
      [-7.7, -3.85, 0, 3.85, 7.7].forEach((x) => {
        [-2.65, 2.65].forEach((z) => addBox(group, [.34, 2.35, .34], [x, 1.35, z], "concrete", `${level}层结构柱`, level));
      });
      [-7.7, -3.85, 0, 3.85, 7.7].forEach((x) => {
        addBox(group, [.08, 2.05, .08], [x, 1.35, -2.43], "steel", `${level}层柱内钢筋`, level, { metalness: .72, roughness: .24 });
      });

      addBox(group, [18, .74, .22], [0, .61, 3.38], "brick", `${level}层后侧外墙`, level, { roughness: .78 });
      addBox(group, [18, .42, .22], [0, 2.12, 3.38], "brick", `${level}层后侧墙带`, level, { roughness: .78 });
      addBox(group, [.24, 2.3, 6.55], [-8.86, 1.34, 0], "brick", `${level}层西侧山墙`, level, { roughness: .78 });
      addBox(group, [.24, 2.3, 6.55], [8.86, 1.34, 0], "brick", `${level}层东侧山墙`, level, { roughness: .78 });
      addBox(group, [18, .62, .22], [0, .55, -3.38], "brick", `${level}层前侧窗台墙`, level, { roughness: .78 });
      addBox(group, [18, .34, .22], [0, 2.18, -3.38], "brick", `${level}层前侧墙带`, level, { roughness: .78 });

      const facade = buildingKind === "education" ? { count: 4, width: 3.05, height: 1.36, y: 1.41 }
        : buildingKind === "office" ? { count: 8, width: 1.92, height: 1.72, y: 1.34 }
          : buildingKind === "healthcare" ? { count: 7, width: 1.72, height: 1.24, y: 1.48 }
            : buildingKind === "industrial" || buildingKind === "warehouse" ? { count: 4, width: 2.95, height: .68, y: 1.83 }
              : buildingKind === "commercial" && level === 1 ? { count: 4, width: 3.16, height: 1.9, y: 1.28 }
                : { count: 6, width: 1.62, height: 1.18, y: 1.42 };
      const gap = 15 / facade.count;
      Array.from({ length: facade.count }, (_, index) => -7.5 + gap * (index + .5)).forEach((x, index) => {
        addBox(group, [facade.width, facade.height, .09], [x, facade.y, -3.5], "glass", `${level}层${index + 1}号外窗玻璃`, level, { opacity: .68, transmission: .2, roughness: .08, castShadow: false });
        const edge = facade.width / 2 + .06;
        for (const y of [facade.y - facade.height / 2, facade.y + facade.height / 2]) {
          addBox(group, [facade.width + .12, .07, .13], [x, y, -3.53], "aluminum", `${level}层外窗横框`, level, { metalness: .55, roughness: .22 });
        }
        for (const offset of [-edge, edge]) {
          addBox(group, [.07, facade.height + .08, .13], [x + offset, facade.y, -3.53], "aluminum", `${level}层外窗竖框`, level, { metalness: .55, roughness: .22 });
        }
        if (buildingKind === "residential" && level > 1) {
          addBox(group, [facade.width + .25, .12, .9], [x, .65, -3.88], "concrete", `${level}层阳台板`, level);
          addBox(group, [facade.width + .25, .45, .08], [x, .91, -4.3], "glass", `${level}层阳台栏板`, level, { opacity: .45, castShadow: false });
        }
      });
      if (buildingKind === "education") {
        addBox(group, [17.8, .12, .45], [0, 2.38, -3.65], "concrete", `${level}层水平遮阳板`, level);
        if (level === 1) addBox(group, [6.2, .2, 2.2], [0, 2.31, -4.42], "concrete", "教学楼入口雨棚", level);
      }
      if (buildingKind === "healthcare") addBox(group, [17.8, .1, .5], [0, 2.31, -3.65], "aluminum", `${level}层遮阳带`, level);
      if ((buildingKind === "industrial" || buildingKind === "warehouse") && level === 1) {
        for (const x of [-5.8, 0, 5.8]) addBox(group, [3.25, 1.65, .12], [x, 1.04, -3.6], "aluminum", "装卸门示意", level);
      }
    }

    const roofGroup = floorGroups[floorCount - 1];
    addBox(roofGroup, [18.45, .28, 7.4], [0, FLOOR_HEIGHT + .08, 0], "concrete", "屋面板", floorCount, { roughness: .58 });
    if (["industrial", "warehouse"].includes(buildingKind)) {
      for (const x of [-5, 0, 5]) addBox(roofGroup, [2.5, .65, 2.8], [x, FLOOR_HEIGHT + .53, 0], "glass", "屋面采光带", floorCount, { opacity: .62, castShadow: false });
    } else {
      addBox(roofGroup, [4.4, 1.15, 2.5], [2.1, FLOOR_HEIGHT + .78, .2], "concrete", "屋面楼梯间", floorCount, { roughness: .62 });
    }

    const entrance = floorGroups[0];
    if (!["industrial", "warehouse"].includes(buildingKind)) {
      addBox(entrance, [3.5, 2.05, .12], [0, 1.2, -3.58], "glass", "首层入口玻璃幕墙", 1, { opacity: .58, transmission: .28, roughness: .06, castShadow: false });
      addBox(entrance, [3.8, .12, .22], [0, 2.27, -3.63], "aluminum", "入口铝合金门框", 1, { metalness: .62, roughness: .2 });
    }

    const secondWing = building.clone(true);
    secondWing.position.set(0, 0, 0);
    secondWing.rotation.y = .08;
    secondWing.visible = false;
    scene.add(secondWing);
    secondWing.traverse((object) => { if (object.isMesh) selectable.push(object); });

    // Particle density is a relative display of A1–A3 material contributions,
    // not an A5 construction-site emissions estimate.
    const carbonSources = [
      { key: "concrete", test: /混凝土|水泥/, color: 0xff8b72, x: -5.5, z: 2.5, phase: 1 },
      { key: "steel", test: /钢|铁/, color: 0xffc17a, x: 5.5, z: 1.6, phase: 1 },
      { key: "brick", test: /砖|砌块/, color: 0xffd997, x: -3.2, z: -4.1, phase: 2 },
      { key: "glass", test: /玻璃/, color: 0x79dbf3, x: 2.4, z: -4.2, phase: 3 },
      { key: "aluminum", test: /铝/, color: 0xd3a5ff, x: 7.2, z: -3.4, phase: 3 },
    ];
    const particlePositions = [];
    const particleColors = [];
    const particleBase = [];
    const particlePhases = [];
    const emissionsTotal = Math.max(1, stats?.total || 1);
    let seed = 7937;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    carbonSources.forEach((source) => {
      const amount = (stats?.rows || []).filter((row) => source.test.test(row.name)).reduce((sum, row) => sum + row.emission, 0);
      if (amount <= 0) return;
      const count = Math.min(520, Math.max(28, Math.round(760 * amount / emissionsTotal)));
      const color = new THREE.Color(source.color);
      for (let i = 0; i < count; i += 1) {
        const x = source.x + (random() - .5) * 5.5;
        const y = .6 + random() * Math.max(2, floorCount * floorHeight - 1);
        const z = source.z + (random() - .5) * 2.1;
        particlePositions.push(x, y, z);
        particleBase.push(y);
        particlePhases.push(source.phase);
        particleColors.push(color.r, color.g, color.b);
      }
    });
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute("color", new THREE.Float32BufferAttribute(particleColors, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
      size: .4, vertexColors: true, transparent: true, opacity: .98,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const halos = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
      size: 1.05, vertexColors: true, transparent: true, opacity: .29,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(halos, particles);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPoint = null;
    let selectedMesh = null;
    let helper = null;
    const coordinates = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(selectable, false).find((hit) => hit.object.visible);
    };
    const choose = (event) => {
      if (downPoint && Math.hypot(event.clientX - downPoint.x, event.clientY - downPoint.y) > 5) return;
      const hit = coordinates(event);
      if (!hit) return;
      if (selectedMesh) selectedMesh.material.emissiveIntensity = 0;
      selectedMesh = hit.object;
      selectedMesh.material.emissive.set(0x72f1c1);
      selectedMesh.material.emissiveIntensity = .32;
      if (helper) scene.remove(helper);
      helper = new THREE.BoxHelper(selectedMesh, 0xe6fff6);
      helper.material.transparent = true;
      helper.material.opacity = .92;
      scene.add(helper);
      setSelected({ ...selectedMesh.userData });
    };
    const hover = (event) => {
      renderer.domElement.style.cursor = coordinates(event) ? "pointer" : "grab";
    };
    const pointerDown = (event) => { downPoint = { x: event.clientX, y: event.clientY }; };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", hover);
    renderer.domElement.addEventListener("pointerup", choose);

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

    let frame;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      if (helper) helper.update();
      if (!reducedMotion && particles.visible) {
        const positions = particleGeometry.attributes.position;
        const seconds = performance.now() / 1000;
        for (let i = 0; i < particleBase.length; i += 1) {
          positions.setY(i, particlePhases[i] <= (sceneRef.current?.stage ?? 4)
            && ((sceneRef.current?.stage ?? 4) !== 1 || particleBase[i] <= (sceneRef.current?.builtFloors ?? floorCount) * floorHeight)
            ? particleBase[i] + ((seconds * (.35 + i % 5 * .07) + i * .17) % 2.2)
            : -100);
        }
        positions.needsUpdate = true;
      }
      renderer.render(scene, camera);
    };
    animate();
    sceneRef.current = { scene, camera, controls, renderer, building, secondWing, floorGroups, selectable, particles, halos, stage, builtFloors, helper: () => helper };

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", hover);
      renderer.domElement.removeEventListener("pointerup", choose);
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
  }, [floorCount, floorHeight, geometry.width, footprintSpan, stats, buildingKind]);

  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    current.controls.autoRotate = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    current.stage = stage;
    current.builtFloors = builtFloors;
    [current.building, current.secondWing].forEach((assembly) => {
      assembly.children.forEach((group) => {
        if (!group.userData.floor) return;
        const floorNumber = group.userData.floor;
        group.position.y = group.userData.baseY + (floorNumber - 1) * (explode / 100) * 1.65;
        group.visible = (floor === "all" || Number(floor) === floorNumber) && (stage !== 1 || floorNumber <= builtFloors);
      });
    });
    current.selectable.forEach((mesh) => {
      mesh.visible = mesh.userData.phase <= stage && (!structureOnly || ["concrete", "steel"].includes(mesh.userData.materialKey));
    });
    current.secondWing.visible = model === "double";
    const xScale = geometry.length / 18;
    const wingGap = Math.min(3.5, geometry.width * .2);
    const wingWidth = model === "double" ? Math.max(1, (geometry.width - wingGap) / 2) : geometry.width;
    const zScale = wingWidth / 7;
    const yScale = floorHeight / FLOOR_HEIGHT;
    const wingOffset = (wingWidth + wingGap) / 2;
    current.building.position.z = model === "double" ? -wingOffset : 0;
    current.secondWing.position.z = model === "double" ? wingOffset : 0;
    current.building.scale.set(xScale * (model === "tower" ? .72 : 1), yScale, zScale * (model === "tower" ? 1.32 : 1));
    current.secondWing.scale.set(xScale, yScale, zScale);
    current.particles.visible = showCarbon;
    current.halos.visible = showCarbon;
  }, [explode, floor, structureOnly, model, stage, builtFloors, showCarbon, geometry.length, geometry.width, floorHeight]);

  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    const narrow = current.renderer.domElement.clientWidth < 620;
    const distance = (narrow ? 1.52 : 1) * (model === "double" ? 1.12 : 1);
    if (stage === 0) {
      current.camera.position.set(15 * distance, 8 * distance, 17 * distance);
      current.controls.target.set(0, .1, 0);
    } else {
      current.camera.position.set(footprintSpan * 1.2 * distance, Math.max(16, floorCount * floorHeight * 1.15) * distance, footprintSpan * 1.25 * distance);
      current.controls.target.set(0, floorCount * floorHeight / 2, 0);
    }
    current.controls.update();
  }, [stage, model, floorCount, floorHeight, footprintSpan, geometry.width]);

  const resetCamera = () => {
    const current = sceneRef.current;
    if (!current) return;
    const distance = (current.renderer.domElement.clientWidth < 620 ? 1.52 : 1) * (model === "double" ? 1.12 : 1);
    if (stage === 0) {
      current.camera.position.set(15 * distance, 8 * distance, 17 * distance);
      current.controls.target.set(0, .1, 0);
    } else {
      current.camera.position.set(footprintSpan * 1.2 * distance, Math.max(16, floorCount * floorHeight * 1.15) * distance, footprintSpan * 1.25 * distance);
      current.controls.target.set(0, floorCount * floorHeight / 2, 0);
    }
    current.controls.update();
  };

  return <div className="twin-page twin-rework">
    <header className="twin-head">
      <div><span>建筑预览</span><h1>建筑过程预览</h1></div>
      <div className="twin-status"><i/><span><b>{project.name}</b><small>{geometry.type.label} · {floorCount} 层 · {geometry.length.toFixed(1)} × {geometry.width.toFixed(1)} m · {geometry.source === "uploaded" ? "按上传尺寸生成" : "按面积推导示意"}</small></span></div>
    </header>

    <section className="twin-models" aria-label="选择演示楼型">
      {MODEL_TYPES.map((item) => <button key={item.id} className={model === item.id ? "active" : ""} onClick={() => { setModel(item.id); setSelected(null); }} aria-pressed={model === item.id}><Building2 size={18}/>{item.label}</button>)}
      <span>{structureOnly ? "当前仅显示结构；关闭“只看结构”可查看用途立面" : geometry.type.source === "name" ? "用途按项目名称识别" : geometry.type.source === "uploaded" ? "用途来自项目参数" : "用途未提供，显示通用示意"} · 切换形体不改变核算</span>
    </section>

    <section className="twin-grid">
      <article className="twin-viewer panel">
        <div className="twin-canvas" ref={hostRef}/>
        <div className="twin-view-summary"><small>建造进度</small><b>{BUILD_STAGES[stage]}</b><span>{stage + 1} / {BUILD_STAGES.length}</span></div>
        <div className="twin-hint"><MousePointer2 size={15}/>拖动旋转 · 点击构件</div>
        <div className="twin-scan"><Sparkles size={15}/><span>{showCarbon ? "材料排放粒子" : "隐藏粒子"}</span></div>
        <div className="twin-view-controls">
          <button aria-label="重置3D视角" title="重置视角" onClick={resetCamera}><RotateCcw size={17}/></button>
          <button aria-label={autoRotate ? "暂停自动旋转" : "开启自动旋转"} title="自动旋转" onClick={() => setAutoRotate((value) => !value)}>{autoRotate ? <Pause size={17}/> : <Play size={17}/>}</button>
          <button className={showCarbon ? "active" : ""} onClick={() => setShowCarbon((value) => !value)} aria-pressed={showCarbon}><Sparkles size={17}/>排放粒子</button>
          <button className={structureOnly ? "active" : ""} onClick={() => setStructureOnly((value) => !value)} aria-pressed={structureOnly}><Layers3 size={17}/>只看结构</button>
        </div>
      </article>

      <aside className="twin-inspector panel">
        <header><span>材料排放 · A1–A3</span><b>{(stats?.tonnes || 0).toLocaleString("zh-CN", { maximumFractionDigits: 1 })} tCO₂e</b></header>
        <div className="twin-emission-list">{ranked.slice(0, 5).map((row) => <div key={row.id} className="twin-emission-row"><div><b>{row.name}</b><strong>{(row.emission / 1000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })} tCO₂e</strong></div><i><span style={{ width: `${stats?.total ? row.emission / stats.total * 100 : 0}%` }}/></i></div>)}</div>
        <p className="twin-particle-note">粒子疏密表示清单内材料的相对贡献；不是施工现场的实时排放。</p>
        <div className="twin-picked">{selected ? <><Box size={20}/><span><b>{selected.name}</b><small>{selected.floor ? `${selected.floor} 层` : "基础"} · {MATERIALS[selected.materialKey]?.label}</small></span></> : <><Eye size={20}/><span>点击模型，查看构件名称</span></>}</div>
        {!embedded && <button className="twin-next" onClick={() => go("climate")}>查看运营能耗 <Play size={16}/></button>}
      </aside>
    </section>

    <section className="twin-build panel">
      <div className="twin-build-header"><div><b>建造顺序</b><span>{playing && stage === 1 ? `主体结构 · 第 ${builtFloors} / ${floorCount} 层` : "点击阶段，或播放完整过程"}</span></div><button onClick={() => { if (playing) setPlaying(false); else { if (stage === 4) { setStage(0); setBuiltFloors(0); } setPlaying(true); } }}><span>{playing ? <Pause size={16}/> : <Play size={16}/>}</span>{playing ? "暂停" : "播放建造"}</button></div>
      <div className="twin-timeline">{BUILD_STAGES.map((name, index) => <button key={name} className={`${index <= stage ? "reached" : ""} ${index === stage ? "current" : ""}`} onClick={() => { setPlaying(false); setBuiltFloors(floorCount); setStage(index); }} aria-current={index === stage ? "step" : undefined}><span>{String(index + 1).padStart(2, "0")}</span><b>{name}</b></button>)}</div>
      <small>这里展示建造顺序；A5 现场施工排放尚未核算。</small>
    </section>

    <section className="twin-bottom panel">
      <div className="twin-floor"><span><b>查看楼层</b></span><button className={floor === "all" ? "active" : ""} onClick={() => setFloor("all")}>全部</button>{Array.from({ length: floorCount }, (_, index) => index + 1).map((value) => <button className={floor === value ? "active" : ""} onClick={() => setFloor(value)} key={value}>{value}F</button>)}</div>
      <label className="twin-explode"><span><b>楼层分解</b><b>{explode}%</b></span><input type="range" min="0" max="100" value={explode} onChange={(event) => setExplode(Number(event.target.value))}/></label>
    </section>
  </div>;
}
