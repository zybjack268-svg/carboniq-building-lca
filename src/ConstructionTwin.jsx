import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Pause, Play, RotateCcw, MousePointer2 } from "lucide-react";
import { deriveBuildingGeometry } from "./geometry.js";
import { createBuildingModel, createWindowFacadeTexture } from "./buildingModel.js";
import { createParticlePool, spawnParticle, advanceParticles, softSpriteTexture } from "./particles3d.js";

const BUILD_STAGES = ["地基", "主体结构", "围护墙体", "门窗立面", "屋面完成"];
const SITE_X = 32;
const SITE_Z = 24;
const BUILD_L = 17;
const BUILD_W = 7.4;

const CATEGORY_MATCHERS = [
  { key: "soil", test: /土方|挖掘|挖机|机械|卡车|运输|装卸|回填/i },
  { key: "crane", test: /塔吊|塔式|起重|吊装/i },
  { key: "power", test: /电|焊|照明/i },
];

const seededRandom = (seed) => {
  let value = seed;
  return () => { value = (value * 16807) % 2147483647; return (value - 1) / 2147483646; };
};

function makeMast(height) {
  const group = new THREE.Group();
  const postGeometry = new THREE.CylinderGeometry(.07, .07, height, 6);
  const steel = new THREE.MeshStandardMaterial({ color: 0xe8b83a, roughness: .42, metalness: .35 });
  for (const [x, z] of [[-.55, -.55], [.55, -.55], [-.55, .55], [.55, .55]]) {
    const post = new THREE.Mesh(postGeometry, steel);
    post.position.set(x, height / 2, z);
    post.castShadow = true;
    group.add(post);
  }
  const segments = Math.max(2, Math.round(height / 1.3));
  const braces = new THREE.InstancedMesh(new THREE.BoxGeometry(.055, 1.62, .055), steel, segments * 4);
  const rungs = new THREE.InstancedMesh(new THREE.BoxGeometry(1.16, .05, .05), steel, (segments + 1) * 4);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const positions = [[-.55, -.55], [.55, -.55], [-.55, .55], [.55, .55]];
  let index = 0;
  for (let s = 0; s < segments; s += 1) {
    const y = (s + .5) * (height / segments);
    positions.forEach(([x, z], face) => {
      euler.set(0, face % 2 ? 0 : Math.PI / 2, face < 2 ? Math.PI / 4 : -Math.PI / 4);
      quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(1, 1, 1));
      braces.setMatrixAt(index, matrix);
      index += 1;
    });
  }
  braces.instanceMatrix.needsUpdate = true;
  braces.castShadow = true;
  group.add(braces);
  index = 0;
  for (let s = 0; s <= segments; s += 1) {
    const y = s * (height / segments);
    positions.forEach(([x, z], face) => {
      euler.set(0, face % 2 ? 0 : Math.PI / 2, 0);
      quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(1, 1, 1));
      rungs.setMatrixAt(index, matrix);
      index += 1;
    });
  }
  rungs.instanceMatrix.needsUpdate = true;
  group.add(rungs);
  return group;
}

function makeTowerCrane(mastHeight) {
  const crane = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf0b429, roughness: .4, metalness: .32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x33383d, roughness: .55, metalness: .3 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(3, .6, 3), new THREE.MeshStandardMaterial({ color: 0x8f958f, roughness: .9 }));
  base.position.y = .3;
  base.castShadow = base.receiveShadow = true;
  crane.add(base);
  const mast = makeMast(mastHeight);
  mast.position.y = .6;
  crane.add(mast);
  const slewing = new THREE.Group();
  slewing.position.y = mastHeight + .6;
  crane.add(slewing);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.15, 1.05), yellow);
  cab.position.set(.95, .58, 0);
  cab.castShadow = true;
  slewing.add(cab);
  const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(.06, .62, .86), new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: .1, transparent: true, opacity: .85 }));
  cabGlass.position.set(1.5, .66, 0);
  slewing.add(cabGlass);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, .28, 1.5), yellow);
  deck.position.set(.2, -.1, 0);
  slewing.add(deck);
  const counterJib = new THREE.Mesh(new THREE.BoxGeometry(5.4, .16, .9), yellow);
  counterJib.position.set(-2.9, .3, 0);
  counterJib.castShadow = true;
  slewing.add(counterJib);
  for (const [x, size] of [[-3.6, 1], [-4.6, .8]]) {
    const weight = new THREE.Mesh(new THREE.BoxGeometry(.8, 1, size), dark);
    weight.position.set(x, .62, 0);
    slewing.add(weight);
  }
  const jib = new THREE.Group();
  const jibLength = 16;
  for (const z of [-.42, .42]) {
    const chord = new THREE.Mesh(new THREE.BoxGeometry(jibLength, .12, .1), yellow);
    chord.position.set(jibLength / 2 + 1.6, .3, z);
    chord.castShadow = true;
    jib.add(chord);
  }
  const topChord = new THREE.Mesh(new THREE.BoxGeometry(jibLength, .1, .1), yellow);
  topChord.position.set(jibLength / 2 + 1.6, .95, 0);
  jib.add(topChord);
  const braces = new THREE.InstancedMesh(new THREE.BoxGeometry(.05, 1.05, .05), yellow, 26);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  for (let i = 0; i < 13; i += 1) {
    const x = 2 + i * (jibLength - 1) / 12;
    for (const z of [-.42, .42]) {
      euler.set(0, 0, Math.PI / 3.2);
      quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(x + .55, .62, z), quaternion, new THREE.Vector3(1, 1, 1));
      braces.setMatrixAt(i * 2, matrix);
      euler.set(0, 0, -Math.PI / 3.2);
      quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(x + .55, .62, z), quaternion, new THREE.Vector3(1, 1, 1));
      braces.setMatrixAt(i * 2 + 1, matrix);
    }
  }
  braces.instanceMatrix.needsUpdate = true;
  jib.add(braces);
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 6.4, 5), dark);
  tie.position.set(6.6, 3.2, 0);
  tie.rotation.z = Math.PI / 2.45;
  jib.add(tie);
  const apex = new THREE.Mesh(new THREE.ConeGeometry(.16, 2.2, 6), yellow);
  apex.position.set(0, 2.1, 0);
  slewing.add(apex);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff2222, emissiveIntensity: 1.6 }));
  beacon.position.set(0, 3.3, 0);
  slewing.add(beacon);
  slewing.add(jib);
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(.55, .22, .7), dark);
  jib.add(trolley);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1, 5), dark);
  const hook = new THREE.Group();
  hook.add(new THREE.Mesh(new THREE.BoxGeometry(.34, .3, .34), dark));
  const load = new THREE.Group();
  const rebarMaterial = new THREE.MeshStandardMaterial({ color: 0x8a959c, roughness: .35, metalness: .62 });
  for (let i = 0; i < 3; i += 1) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 4.4, 5), rebarMaterial);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0, (i - 1) * .14);
    bar.castShadow = true;
    load.add(bar);
  }
  hook.add(load);
  trolley.add(cable);
  trolley.add(hook);
  crane.userData = { slewing, trolley, cable, hook, beacon };
  return crane;
}

function makeTruck(bodyColor) {
  const truck = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: .38, metalness: .25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2e3338, roughness: .6 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.6, .32, 1.7), dark);
  chassis.position.set(0, .78, 0);
  chassis.castShadow = true;
  truck.add(chassis);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(3, .95, 1.7), paint);
  bed.position.set(-.85, 1.42, 0);
  bed.castShadow = true;
  truck.add(bed);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.05, 1.72), paint);
  cab.position.set(1.72, 1.42, 0);
  cab.castShadow = true;
  truck.add(cab);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(.1, .5, 1.4), new THREE.MeshStandardMaterial({ color: 0xb9dcea, roughness: .12, transparent: true, opacity: .85 }));
  glass.position.set(2.34, 1.6, 0);
  truck.add(glass);
  const wheels = [];
  const wheelGeometry = new THREE.CylinderGeometry(.48, .48, .34, 12);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x181b1e, roughness: .92 });
  for (const x of [-1.55, .35, 1.95]) {
    for (const z of [-.86, .86]) {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, .48, z);
      wheel.castShadow = true;
      truck.add(wheel);
      wheels.push(wheel);
    }
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffb02e, emissive: 0xff9500, emissiveIntensity: 1.5 }));
  beacon.position.set(1.72, 2.02, 0);
  truck.add(beacon);
  truck.userData = { wheels, beacon };
  return truck;
}

function makeExcavator() {
  const machine = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf0b429, roughness: .42, metalness: .3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2e3338, roughness: .75 });
  for (const z of [-.72, .72]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(3.1, .62, .5), dark);
    track.position.set(0, .34, z);
    track.castShadow = true;
    machine.add(track);
  }
  const house = new THREE.Group();
  house.position.y = .96;
  machine.add(house);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 1.7), yellow);
  body.position.y = .5;
  body.castShadow = true;
  house.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1, .95, .95), new THREE.MeshStandardMaterial({ color: 0x35505c, roughness: .2 }));
  cab.position.set(-.7, .78, .35);
  house.add(cab);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .5, 6), dark);
  stack.position.set(.9, 1.2, -.4);
  house.add(stack);
  const boom = new THREE.Group();
  boom.position.set(1.15, .55, 0);
  house.add(boom);
  const boomArm = new THREE.Mesh(new THREE.BoxGeometry(2.6, .34, .3), yellow);
  boomArm.position.set(1.2, .38, 0);
  boomArm.castShadow = true;
  boom.add(boomArm);
  const stick = new THREE.Group();
  stick.position.set(2.35, .72, 0);
  boom.add(stick);
  const stickArm = new THREE.Mesh(new THREE.BoxGeometry(1.7, .26, .24), yellow);
  stickArm.position.set(.75, 0, 0);
  stick.add(stickArm);
  const bucket = new THREE.Mesh(new THREE.BoxGeometry(.55, .4, .62), dark);
  bucket.position.set(1.75, -.2, 0);
  bucket.rotation.z = -.5;
  bucket.castShadow = true;
  stick.add(bucket);
  machine.userData = { house, boom, stick, stack };
  return machine;
}

function makeWorker(color) {
  const worker = new THREE.Group();
  const vest = new THREE.Mesh(new THREE.CapsuleGeometry(.16, .34, 3, 8), new THREE.MeshStandardMaterial({ color, roughness: .7 }));
  vest.position.y = .52;
  worker.add(vest);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: .5 }));
  helmet.position.y = .82;
  worker.add(helmet);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(.2, .38, .16), new THREE.MeshStandardMaterial({ color: 0x2f3a44, roughness: .8 }));
  legs.position.y = .19;
  worker.add(legs);
  return worker;
}

// 夜间照明塔灯
function makeFloodlight(withLight = true) {
  const tower = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 6.5, 6), new THREE.MeshStandardMaterial({ color: 0x3c4247, roughness: .6, metalness: .4 }));
  pole.position.y = 3.25;
  tower.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, .5, .3), new THREE.MeshStandardMaterial({ color: 0x2e3338, roughness: .5 }));
  head.position.y = 6.6;
  tower.add(head);
  const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .4), new THREE.MeshStandardMaterial({ color: 0xfff3c8, emissive: 0xffe9a8, emissiveIntensity: 3.2 }));
  lamp.position.set(0, 6.6, .17);
  tower.add(lamp);
  const light = new THREE.PointLight(0xffe6b0, 55, 26, 2);
  light.position.set(0, 6.2, .6);
  tower.add(light);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(1.4, .12, .12), new THREE.MeshStandardMaterial({ color: 0x3c4247 }));
  cross.position.y = .12;
  tower.add(cross);
  return tower;
}

export default function ConstructionTwin({ project, siteResult, embedded = false }) {
  const geometry = deriveBuildingGeometry(project);
  const floorCount = geometry.floors;
  const floorHeight = geometry.floorHeight;
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const [stage, setStage] = useState(4);
  const [builtFloors, setBuiltFloors] = useState(floorCount);
  const [playing, setPlaying] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [selected, setSelected] = useState(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setTimeout(() => {
      if (stage === 0) { setStage(1); setBuiltFloors(1); }
      else if (stage === 1 && builtFloors < floorCount) setBuiltFloors((current) => current + 1);
      else if (stage < 4) { setBuiltFloors(floorCount); setStage((current) => current + 1); }
      else setPlaying(false);
    }, stage === 1 ? 420 : 1100);
    return () => window.clearTimeout(timer);
  }, [playing, stage, builtFloors, floorCount]);

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
    const random = seededRandom(20260925);

    // 夜幕场景：暗色背景让发光粒子与灯光成为主角（与参考夜景风格一致）
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1210);
    scene.fog = new THREE.FogExp2(0x0b1210, .013);
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 400);
    camera.position.set(30, 21, 33);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "施工现场三维示意模型，包含塔吊、车辆与排放粒子");
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .08;
    controls.target.set(0, 3.2, 0);
    controls.minDistance = 12;
    controls.maxDistance = 120;
    controls.maxPolarAngle = Math.PI * .47;
    controls.autoRotate = true;
    controls.autoRotateSpeed = .45;

    scene.add(new THREE.HemisphereLight(0x9fc4b8, 0x141f1a, .85));
    const moon = new THREE.DirectionalLight(0xbfd8e8, 1.15);
    moon.position.set(-24, 30, -16);
    scene.add(moon);
    const sun = new THREE.DirectionalLight(0xffe0b0, 1.6);
    sun.position.set(22, 34, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.camera.far = 120;
    scene.add(sun);

    // —— 场地 ——
    const site = new THREE.Group();
    scene.add(site);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(SITE_X * 2 + 14, SITE_Z * 2 + 14), new THREE.MeshStandardMaterial({ color: 0x272b25, roughness: .95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    site.add(ground);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(BUILD_L + 12, .12, BUILD_W + 9), new THREE.MeshStandardMaterial({ color: 0x333832, roughness: .92 }));
    slab.position.set(0, .06, 0);
    slab.receiveShadow = true;
    site.add(slab);
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x181c20, roughness: .94 });
    for (const [w, d, x, z] of [[SITE_X * 2 + 6, 4.6, 0, SITE_Z - 1.4], [SITE_X * 2 + 6, 4.6, 0, -SITE_Z + 1.4], [4.6, SITE_Z * 2 - 6, SITE_X - 1.4, 0], [4.6, SITE_Z * 2 - 6, -SITE_X + 1.4, 0]]) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(w, .1, d), roadMaterial);
      road.position.set(x, .05, z);
      road.receiveShadow = true;
      site.add(road);
    }
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, .02, .16), new THREE.MeshStandardMaterial({ color: 0x9fb4a8, roughness: .6 }), 36);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    let dashIndex = 0;
    for (let i = 0; i < 9; i += 1) {
      const x = -SITE_X + 4 + i * (SITE_X * 2 - 8) / 8;
      euler.set(0, Math.PI / 2, 0); quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(x, .11, SITE_Z - 1.4), quaternion, new THREE.Vector3(1, 1, 1));
      dashes.setMatrixAt(dashIndex++, matrix);
      matrix.compose(new THREE.Vector3(x, .11, -SITE_Z + 1.4), quaternion, new THREE.Vector3(1, 1, 1));
      dashes.setMatrixAt(dashIndex++, matrix);
      euler.set(0, 0, 0); quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(SITE_X - 1.4, .11, x * .72), quaternion, new THREE.Vector3(1, 1, 1));
      dashes.setMatrixAt(dashIndex++, matrix);
      matrix.compose(new THREE.Vector3(-SITE_X + 1.4, .11, x * .72), quaternion, new THREE.Vector3(1, 1, 1));
      dashes.setMatrixAt(dashIndex++, matrix);
    }
    dashes.instanceMatrix.needsUpdate = true;
    site.add(dashes);

    // 围挡
    const fenceCount = Math.round((SITE_X * 2 + SITE_Z * 2) / 2.2);
    const fence = new THREE.InstancedMesh(new THREE.BoxGeometry(2.05, 1.9, .08), new THREE.MeshStandardMaterial({ color: 0x2c5070, roughness: .6, metalness: .1 }), fenceCount);
    let fenceIndex = 0;
    const placeFence = (x, z, rotated) => {
      if (fenceIndex >= fenceCount) return;
      euler.set(0, rotated ? Math.PI / 2 : 0, 0);
      quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(x, 1.05, z), quaternion, new THREE.Vector3(1, 1, 1));
      fence.setMatrixAt(fenceIndex, matrix);
      fenceIndex += 1;
    };
    for (let x = -SITE_X + 1; x < SITE_X; x += 2.2) { placeFence(x, SITE_Z + 1.4, false); placeFence(x, -SITE_Z - 1.4, false); }
    for (let z = -SITE_Z + 1; z < SITE_Z; z += 2.2) { placeFence(SITE_X + 1.4, z, true); placeFence(-SITE_X - 1.4, z, true); }
    fence.instanceMatrix.needsUpdate = true;
    site.add(fence);

    // 周边城市（夜窗亮灯）
    const cityTexture = createWindowFacadeTexture({ floors: 20, cols: 6, litRatio: .42, seed: 99 });
    for (const [x, z, w, d, h] of [[-46, 6, 14, 12, 26], [44, -10, 16, 14, 32], [10, -40, 20, 12, 18], [-24, -42, 12, 10, 22], [48, 18, 12, 16, 24], [-48, -26, 10, 10, 16]]) {
      const map = cityTexture.texture.clone();
      map.needsUpdate = true;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 5)));
      const cityMat = new THREE.MeshStandardMaterial({ color: 0x232a30, roughness: .7, metalness: .2, map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .85 });
      const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cityMat);
      building.position.set(x, h / 2, z);
      site.add(building);
    }
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x2e2418, roughness: .9 });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x1f3d2b, roughness: .85 });
    for (let i = 0; i < 10; i += 1) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.09, .13, 1.4, 5), trunkMaterial);
      trunk.position.set(-SITE_X + 3 + i * ((SITE_X - 6) / 4.5), .7, SITE_Z + 4.4);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(.85, 2, 7), leafMaterial);
      leaf.position.copy(trunk.position);
      leaf.position.y = 2.2;
      leaf.castShadow = true;
      site.add(trunk, leaf);
    }

    // —— 在建建筑（共享模型） ——
    const buildGroup = new THREE.Group();
    site.add(buildGroup);
    const pit = new THREE.Mesh(new THREE.BoxGeometry(BUILD_L + 6, 1.5, BUILD_W + 6), new THREE.MeshStandardMaterial({ color: 0x211a12, roughness: .98 }));
    pit.position.set(0, -.72, 0);
    buildGroup.add(pit);
    const pileCaps = new THREE.Group();
    for (const x of [-6.4, -2.2, 2.2, 6.4]) {
      for (const z of [-2.2, 2.2]) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, .4, 1.1), new THREE.MeshStandardMaterial({ color: 0x4a544e, roughness: .85 }));
        cap.position.set(x, .12, z);
        pileCaps.add(cap);
      }
    }
    buildGroup.add(pileCaps);
    const rebarCages = new THREE.Group();
    const rebarGeometry = new THREE.CylinderGeometry(.035, .035, 1.7, 4);
    for (let i = 0; i < 14; i += 1) {
      const cage = new THREE.Mesh(rebarGeometry, new THREE.MeshStandardMaterial({ color: 0x77828a, roughness: .35, metalness: .62 }));
      cage.position.set(-7 + (i % 7) * 2.3, .5, i < 7 ? -1.6 : 1.6);
      rebarCages.add(cage);
    }
    buildGroup.add(rebarCages);
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(BUILD_L + 2.4, .5, BUILD_W + 2.2), new THREE.MeshStandardMaterial({ color: 0x8b9c94, roughness: .75 }));
    foundation.position.set(0, .28, 0);
    foundation.castShadow = foundation.receiveShadow = true;
    buildGroup.add(foundation);

    const model = createBuildingModel({ floors: floorCount, floorHeight, length: BUILD_L, width: BUILD_W, night: false, seed: 42, litRatio: .22 });
    buildGroup.add(model.group);

    // 脚手架
    const scaffold = new THREE.Group();
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xb8bfc6, roughness: .5, metalness: .4 });
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.045, .045, 1, 5), poleMaterial, 44);
    let poleIndex = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i += 1) {
        const x = -BUILD_L / 2 + 1 + i * (BUILD_L - 2) / 5;
        euler.set(0, 0, 0); quaternion.setFromEuler(euler);
        matrix.compose(new THREE.Vector3(x, 1, side * (BUILD_W / 2 + 1.5)), quaternion, new THREE.Vector3(1, 8, 1));
        poles.setMatrixAt(poleIndex++, matrix);
      }
    }
    for (let i = 0; i < 6; i += 1) {
      const z = -BUILD_W / 2 + 1 + i * (BUILD_W - 2) / 5;
      euler.set(0, 0, 0); quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(-BUILD_L / 2 - 1.5, 1, z), quaternion, new THREE.Vector3(1, 8, 1));
      poles.setMatrixAt(poleIndex++, matrix);
      matrix.compose(new THREE.Vector3(BUILD_L / 2 + 1.5, 1, z), quaternion, new THREE.Vector3(1, 8, 1));
      poles.setMatrixAt(poleIndex++, matrix);
    }
    poles.count = poleIndex;
    poles.instanceMatrix.needsUpdate = true;
    scaffold.add(poles);
    const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(BUILD_L + 3.4, .07, .5), new THREE.MeshStandardMaterial({ color: 0x7d6540, roughness: .9 }), 15);
    for (let i = 0; i < 5; i += 1) {
      const y = (i + 1) * 3.4;
      euler.set(0, 0, 0); quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(0, y, BUILD_W / 2 + 1.5), quaternion, new THREE.Vector3(1, 1, 1));
      planks.setMatrixAt(i * 3, matrix);
      euler.set(0, Math.PI / 2, 0); quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(-BUILD_L / 2 - 1.5, y, 0), quaternion, new THREE.Vector3(1, 1, BUILD_L / (BUILD_L + 3.4)));
      planks.setMatrixAt(i * 3 + 1, matrix);
      matrix.compose(new THREE.Vector3(BUILD_L / 2 + 1.5, y, 0), quaternion, new THREE.Vector3(1, 1, BUILD_L / (BUILD_L + 3.4)));
      planks.setMatrixAt(i * 3 + 2, matrix);
    }
    planks.instanceMatrix.needsUpdate = true;
    scaffold.add(planks);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(BUILD_L + 3, 9), new THREE.MeshStandardMaterial({ color: 0x1d6b47, roughness: .9, transparent: true, opacity: .32, side: THREE.DoubleSide }));
    net.position.set(0, 6.5, BUILD_W / 2 + 1.6);
    scaffold.add(net);
    site.add(scaffold);

    // —— 机械 ——
    const craneMastHeight = floorCount * floorHeight + 7;
    const crane = makeTowerCrane(craneMastHeight);
    crane.position.set(-BUILD_L / 2 - 6.5, 0, BUILD_W / 2 + 2.5);
    crane.rotation.y = .5;
    site.add(crane);
    const excavator = makeExcavator();
    excavator.position.set(-BUILD_L / 2 - 5, 0, -BUILD_W / 2 - 3);
    excavator.rotation.y = 2.4;
    site.add(excavator);
    const soilPile = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.6, 9), new THREE.MeshStandardMaterial({ color: 0x4a3b26, roughness: .95 }));
    soilPile.position.set(-BUILD_L / 2 - 1.5, .8, -BUILD_W / 2 - 3.6);
    soilPile.castShadow = true;
    site.add(soilPile);
    const dumpTruck = makeTruck(0xd98032);
    site.add(dumpTruck);
    const mixerTruck = makeTruck(0xc9d3d8);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(.72, .55, 2.1, 12), new THREE.MeshStandardMaterial({ color: 0xdfe6e8, roughness: .35, metalness: .2 }));
    drum.rotation.z = Math.PI / 2.6;
    drum.position.set(-.85, 1.9, 0);
    drum.castShadow = true;
    mixerTruck.add(drum);
    mixerTruck.userData.drum = drum;
    site.add(mixerTruck);

    // 板房、发电机、料具、工人
    for (const [x, z, color] of [[SITE_X - 7, SITE_Z - 8, 0x9fb4b0], [SITE_X - 10.2, SITE_Z - 8, 0x8ba39f]]) {
      const office = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 2.2), new THREE.MeshStandardMaterial({ color, roughness: .7, emissive: 0x2a3c38, emissiveIntensity: .35 }));
      office.position.set(x, 1.3, z);
      office.castShadow = true;
      site.add(office);
      const door = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.8, .06), new THREE.MeshStandardMaterial({ color: 0x22303a, roughness: .6 }));
      door.position.set(x - .8, .9, z + 1.12);
      site.add(door);
    }
    const generator = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1), new THREE.MeshStandardMaterial({ color: 0xc9a83a, roughness: .5, metalness: .3 }));
    generator.position.set(SITE_X - 12.6, .55, SITE_Z - 8);
    generator.castShadow = true;
    site.add(generator);
    const brickStack = new THREE.Group();
    const brickGeometry = new THREE.BoxGeometry(.55, .28, .3);
    const brickMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: .9 });
    for (let i = 0; i < 18; i += 1) {
      const brick = new THREE.Mesh(brickGeometry, brickMaterial);
      brick.position.set((i % 3) * .6 - .6 + (random() - .5) * .05, Math.floor(i / 9) * .3 + .14, Math.floor(i / 3) % 3 * .34 - .34);
      brick.rotation.y = (random() - .5) * .1;
      brick.castShadow = true;
      brickStack.add(brick);
    }
    brickStack.position.set(BUILD_L / 2 + 4.5, 0, BUILD_W / 2 + 3);
    site.add(brickStack);
    const workers = [];
    for (let i = 0; i < 9; i += 1) {
      const worker = makeWorker(i % 3 === 0 ? 0xf0a032 : 0xe8632c);
      worker.position.set(-8 + (i % 5) * 3.8 + random(), 0, (i < 5 ? -6.5 : 6.2) + random() * 2);
      worker.rotation.y = random() * Math.PI * 2;
      site.add(worker);
      workers.push(worker);
    }
    const floodA = makeFloodlight();
    floodA.position.set(BUILD_L / 2 + 5, 0, BUILD_W / 2 + 6);
    floodA.rotation.y = Math.PI * .78;
    site.add(floodA);
    const floodB = makeFloodlight(false);
    floodB.position.set(-BUILD_L / 2 - 3, 0, BUILD_W / 2 + 7.5);
    floodB.rotation.y = Math.PI * .62;
    site.add(floodB);

    // —— 排放粒子（软光斑 + 加性发光，暗背景下醒目） ——
    const exhaust = createParticlePool({ count: 380, color: 0xdfe9ee, size: 1.5, opacity: .68, additive: true });
    const dust = createParticlePool({ count: 360, color: 0xe8c27a, size: 2.9, opacity: .62, additive: true });
    const sparks = createParticlePool({ count: 180, color: 0xffc46a, size: .8, opacity: 1, additive: true });
    const carbonGlow = createParticlePool({ count: 280, color: 0x63ffbc, size: 1.2, opacity: .95, additive: true });
    site.add(exhaust.points, dust.points, sparks.points, carbonGlow.points);

    // —— 拾取 ——
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickables = [];
    const label = (root, text) => root.traverse((object) => { if (object.isMesh) { object.userData.pick = text; pickables.push(object); } });
    label(crane, "塔式起重机 · 塔吊");
    label(excavator, "液压挖掘机 · 土方机械");
    label(dumpTruck, "自卸卡车 · 土方运输");
    label(mixerTruck, "混凝土搅拌运输车");
    generator.userData.pick = "柴油发电机 · 临时用电";
    pickables.push(generator);
    const downPoint = { x: 0, y: 0 };
    const choose = (event) => {
      if (Math.hypot(event.clientX - downPoint.x, event.clientY - downPoint.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickables, false).find((entry) => entry.object.visible);
      setSelected(hit ? { name: hit.object.userData.pick } : null);
    };
    const onDown = (event) => { downPoint.x = event.clientX; downPoint.y = event.clientY; };
    renderer.domElement.addEventListener("pointerdown", onDown);
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

    const emitters = {
      excavatorExhaust: new THREE.Vector3(-BUILD_L / 2 - 4.1, 2.3, -BUILD_W / 2 - 3.4),
      generatorExhaust: new THREE.Vector3(SITE_X - 12.6, 1.6, SITE_Z - 8),
      dustA: new THREE.Vector3(-BUILD_L / 2 - 2.6, .5, -BUILD_W / 2 - 3.4),
      dustB: new THREE.Vector3(0, .6, 0),
      weld: new THREE.Vector3(4, floorCount * floorHeight * .5 + 1.4, BUILD_W / 2 - .3),
    };

    const clock = new THREE.Clock();
    let frame;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(.05, clock.getDelta());
      const time = clock.elapsedTime;
      const current = sceneRef.current || {};
      const activeStage = current.stage ?? stage;
      const particlesOn = current.showParticles ?? true;
      const topY = Math.max(.4, (current.builtFloors ?? builtFloors) * floorHeight);
      controls.update();

      // 塔吊
      const slewing = crane.userData.slewing;
      slewing.rotation.y = Math.sin(time * .12) * .9 + .4;
      const trolleyX = 6 + Math.sin(time * .21) * 5;
      crane.userData.trolley.position.set(trolleyX, .12, 0);
      const hookDrop = Math.min(craneMastHeight - 4, 5 + Math.sin(time * .3) * 3 + Math.max(0, topY - 4) * .5);
      crane.userData.cable.scale.set(1, hookDrop, 1);
      crane.userData.cable.position.set(0, -hookDrop / 2, 0);
      crane.userData.hook.position.set(0, .15 - hookDrop, 0);
      crane.userData.hook.rotation.y = Math.sin(time * .4) * .3;
      crane.userData.beacon.material.emissiveIntensity = 1.2 + Math.sin(time * 4) * .9;
      model.beacon.material.emissiveIntensity = 1.4 + Math.sin(time * 2.4) * 1;

      // 卡车环路
      const loop = (group, offset, speed, wheels) => {
        const t = (time * speed + offset) % 1;
        const hx = SITE_X - 3.6;
        const hz = SITE_Z - 3.6;
        const r = 3.4;
        const straightX = hx - r, straightZ = hz - r;
        let distance = t * (8 * straightX + 8 * straightZ + 2 * Math.PI * r);
        let x; let z; let angle;
        const corner = (cx, cz, a0) => { const a = a0 + (distance / (Math.PI * r / 2)) * (Math.PI / 2); x = cx + Math.cos(a) * r; z = cz + Math.sin(a) * r; angle = a + Math.PI / 2; };
        const segX = straightX * 2 + Math.PI * r;
        const segZ = straightZ * 2 + Math.PI * r;
        if (distance < segX) { x = -straightX + distance; z = -hz; angle = 0; }
        else {
          distance -= segX;
          if (distance < Math.PI * r / 2) corner(straightX, -straightZ, 0);
          else {
            distance -= Math.PI * r / 2;
            if (distance < segZ) { x = hx; z = -straightZ + distance; angle = Math.PI / 2; }
            else {
              distance -= segZ;
              if (distance < Math.PI * r / 2) corner(straightX, straightZ, Math.PI / 2);
              else {
                distance -= Math.PI * r / 2;
                if (distance < segX) { x = straightX - distance; z = hz; angle = Math.PI; }
                else {
                  distance -= segX;
                  if (distance < Math.PI * r / 2) corner(-straightX, straightZ, Math.PI);
                  else {
                    distance -= Math.PI * r / 2;
                    x = -hx; z = straightZ - distance; angle = -Math.PI / 2;
                  }
                }
              }
            }
          }
        }
        group.position.set(x, 0, z);
        group.rotation.y = -angle;
        wheels.forEach((wheel) => { wheel.rotation.z += delta * 6; });
      };
      const truckVisible = activeStage <= 1;
      dumpTruck.visible = truckVisible;
      mixerTruck.visible = activeStage >= 1 && activeStage <= 3;
      if (truckVisible) loop(dumpTruck, 0, .012, dumpTruck.userData.wheels);
      if (mixerTruck.visible) loop(mixerTruck, .5, .009, mixerTruck.userData.wheels);
      if (mixerTruck.userData.drum) mixerTruck.userData.drum.rotation.y += delta * 2.4;

      // 挖掘机
      const digging = activeStage === 0 ? 1 : activeStage === 1 ? .4 : 0;
      excavator.visible = digging > 0;
      if (digging > 0) {
        excavator.userData.house.rotation.y = Math.sin(time * .5) * .55 * digging;
        excavator.userData.boom.rotation.z = Math.sin(time * .9) * .16 * digging - .06;
        excavator.userData.stick.rotation.z = Math.sin(time * .9 + 1.4) * .22 * digging;
      }

      // 粒子：发射率 ∝ 各活动排放占比；尾气跟随卡车
      const rates = current.particleRates || { soil: .34, crane: .33, power: .33 };
      if (!reducedMotion && particlesOn) {
        const accumulator = current.accumulator || (current.accumulator = { exhaust: 0, dust: 0, spark: 0, glow: 0 });
        accumulator.exhaust += (rates.soil * 85 + rates.power * 28) * delta;
        while (accumulator.exhaust > 1) {
          accumulator.exhaust -= 1;
          if (truckVisible && random() < .45) {
            const truckPos = dumpTruck.position;
            spawnParticle(exhaust, truckPos.x + 2.2 * Math.cos(-dumpTruck.rotation.y), 1.7, truckPos.z + 2.2 * Math.sin(-dumpTruck.rotation.y), [.05, 1.1, 0], 2.3, .3, random);
          } else {
            spawnParticle(exhaust, emitters.excavatorExhaust.x, emitters.excavatorExhaust.y, emitters.excavatorExhaust.z, [.08, 1.15, 0], 2.3, .35, random);
          }
          if (random() < .3) spawnParticle(exhaust, emitters.generatorExhaust.x, emitters.generatorExhaust.y, emitters.generatorExhaust.z, [.02, .9, 0], 2.1, .25, random);
        }
        accumulator.dust += rates.soil * 64 * digging * delta;
        while (accumulator.dust > 1) {
          accumulator.dust -= 1;
          const source = random() < .5 ? emitters.dustA : emitters.dustB;
          spawnParticle(dust, source.x, source.y, source.z, [(random() - .5) * 1.4, .75, (random() - .5) * .8], 1.9, 2, random);
        }
        accumulator.spark += rates.power * (activeStage >= 1 && activeStage <= 3 ? 60 : 0) * delta;
        while (accumulator.spark > 1) {
          accumulator.spark -= 1;
          spawnParticle(sparks, emitters.weld.x, emitters.weld.y, emitters.weld.z, [(random() > .5 ? 1.5 : -1.5), 2, .5], .55, .2, random);
        }
        accumulator.glow += (rates.crane * 42 + rates.power * 8) * delta;
        while (accumulator.glow > 1) {
          accumulator.glow -= 1;
          if (crane.visible && random() < .68) {
            const hookWorld = crane.userData.hook.getWorldPosition(new THREE.Vector3());
            spawnParticle(carbonGlow, hookWorld.x, Math.max(.6, hookWorld.y), hookWorld.z, [0, .8, 0], 2.6, .7, random);
          } else {
            spawnParticle(carbonGlow, emitters.weld.x, emitters.weld.y + 1, emitters.weld.z, [0, .6, 0], 2.4, .8, random);
          }
        }
        advanceParticles(exhaust, delta, { drag: .985, rise: .4 });
        advanceParticles(dust, delta, { drag: .955, rise: -.06 });
        advanceParticles(sparks, delta, { drag: .92, gravity: 3.2 });
        advanceParticles(carbonGlow, delta, { drag: .995, rise: .2 });
      }

      workers.forEach((worker, index) => {
        worker.position.y = Math.abs(Math.sin(time * 2 + index)) * .05;
      });
      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = {
      scene, camera, controls, renderer,
      building: { model, pit, pileCaps, rebarCages, foundation },
      machinery: { crane, excavator, soilPile, scaffold, dumpTruck, mixerTruck },
      stage, builtFloors,
      showParticles: true,
      particleRates: { soil: .34, crane: .33, power: .33 },
    };

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
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
  }, [floorCount, floorHeight]);

  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    current.stage = stage;
    current.builtFloors = builtFloors;
    const { model, pit, pileCaps, rebarCages, foundation } = current.building;
    const { crane, excavator, soilPile, scaffold, dumpTruck, mixerTruck } = current.machinery;
    pit.visible = stage === 0;
    pileCaps.visible = stage <= 1;
    rebarCages.visible = stage === 0;
    foundation.visible = stage >= 1;
    model.structureFloors.forEach((group, index) => {
      const level = index + 1;
      group.visible = stage >= 1 && level <= (stage === 1 ? builtFloors : floorCount);
    });
    model.facadeFloors.forEach(({ group, spandrel, glass }) => {
      group.visible = stage >= 2;
      spandrel.visible = stage >= 2;
      glass.visible = stage >= 3;
    });
    model.roofGroup.visible = stage >= 4;
    crane.visible = stage >= 1;
    scaffold.visible = stage >= 2 && stage <= 3;
    excavator.visible = stage === 0 || stage === 1;
    dumpTruck.visible = stage <= 1;
    mixerTruck.visible = stage >= 1 && stage <= 3;
    soilPile.scale.setScalar(stage === 0 ? 1 : Math.max(.3, 1 - (stage - 1) * .28));
  }, [stage, builtFloors, floorCount]);

  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    const rows = siteResult?.rows || [];
    const totals = { soil: 0, crane: 0, power: 0 };
    let sum = 0;
    rows.forEach((row) => {
      const match = CATEGORY_MATCHERS.find((category) => category.test.test(row.activity || ""));
      if (!match) return;
      totals[match.key] += row.kg;
      sum += row.kg;
    });
    if (sum <= 0) { totals.soil = 1; totals.crane = 1; totals.power = 1; sum = 3; }
    current.particleRates = { soil: totals.soil / sum, crane: totals.crane / sum, power: totals.power / sum };
    current.controls.autoRotate = autoRotate;
  }, [siteResult, autoRotate]);

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.showParticles = showParticles;
  }, [showParticles]);

  const resetCamera = () => {
    const current = sceneRef.current;
    if (!current) return;
    current.camera.position.set(30, 21, 33);
    current.controls.target.set(0, 3.2, 0);
    current.controls.update();
  };

  return <div className="twin-page twin-rework">
    <header className="twin-head">
      <div><span>A5 现场建造</span><h1>施工过程数字孪生</h1></div>
      <div className="twin-status"><i/><span><b>{project.name}</b><small>{geometry.type.label} · {floorCount} 层 · 夜间施工示意</small></span></div>
    </header>

    <section className="twin-grid">
      <article className="twin-viewer panel">
        <div className="twin-canvas" ref={hostRef}/>
        <div className="twin-view-summary"><small>施工进度</small><b>{BUILD_STAGES[stage]}</b><span>{stage + 1} / {BUILD_STAGES.length}</span></div>
        <div className="twin-hint"><MousePointer2 size={15}/>拖动旋转 · 点击机械</div>
        <div className="twin-view-controls">
          <button aria-label="重置3D视角" title="重置视角" onClick={resetCamera}><RotateCcw size={17}/></button>
          <button aria-label={autoRotate ? "暂停自动旋转" : "开启自动旋转"} title="自动旋转" onClick={() => setAutoRotate((value) => !value)}>{autoRotate ? <Pause size={17}/> : <Play size={17}/>}</button>
          <button className={showParticles ? "active" : ""} onClick={() => setShowParticles((value) => !value)} aria-pressed={showParticles}>排放粒子</button>
        </div>
      </article>

      <aside className="twin-inspector panel">
        <header><span>A5 · 现场建造</span><b>{siteResult?.hasData ? `${(siteResult.kg / 1000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })} tCO₂e` : "待录入"}</b></header>
        <div className="twin-emission-list">{(siteResult?.rows || []).slice(0, 5).map((row) => <div key={row.id} className="twin-emission-row"><div><b>{row.activity}</b><strong>{(row.kg / 1000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })} tCO₂e</strong></div><i><span style={{ width: `${siteResult.kg ? row.kg / siteResult.kg * 100 : 0}%` }}/></i></div>)}</div>
        <div className="twin-legend">
          <span><i style={{ background: "#c9a25e" }}/>土方扬尘（密度 ∝ 土方机械排放占比）</span>
          <span><i style={{ background: "#b9c6cc" }}/>机械与发电机尾气</span>
          <span><i style={{ background: "#ffb04a" }}/>电焊火花（临时用电）</span>
          <span><i style={{ background: "#51f0a8" }}/>吊装作业碳排辉点（跟随塔吊）</span>
        </div>
        <p className="twin-particle-note">粒子密度按各施工活动排放占比示意，不代表实时监测值；A5 排放取自施工活动记录，与模型几何没有自动对应关系。</p>
        <div className="twin-picked">{selected ? <span><b>{selected.name}</b><small>点击"重置视角"可回到全景</small></span> : <span><b>场景元素</b><small>塔吊 · 挖掘机 · 自卸卡车 · 搅拌车 · 发电机 · 照明塔灯 · 工人</small></span>}</div>
      </aside>
    </section>

    <section className="twin-build panel">
      <div className="twin-build-header"><div><b>施工顺序</b><span>{playing && stage === 1 ? `主体结构 · 第 ${builtFloors} / ${floorCount} 层` : "点击工序，或播放完整过程"}</span></div><button onClick={() => { if (playing) setPlaying(false); else { if (stage === 4) { setStage(0); setBuiltFloors(0); } setPlaying(true); } }}><span>{playing ? <Pause size={16}/> : <Play size={16}/>}</span>{playing ? "暂停" : "播放施工"}</button></div>
      <div className="twin-timeline">{BUILD_STAGES.map((name, index) => <button key={name} className={`${index <= stage ? "reached" : ""} ${index === stage ? "current" : ""}`} onClick={() => { setPlaying(false); setBuiltFloors(floorCount); setStage(index); }} aria-current={index === stage ? "step" : undefined}><span>{String(index + 1).padStart(2, "0")}</span><b>{name}</b></button>)}</div>
      <small>机械与粒子随工序联动：地基阶段挖掘机和土方车作业，主体阶段塔吊吊装与搅拌车进场，围护与立面阶段出现脚手架和焊接火花，夜间照明塔灯常亮。</small>
    </section>
    {fallback && <p role="alert">当前浏览器无法启动 WebGL，无法显示三维施工示意。</p>}
  </div>;
}
