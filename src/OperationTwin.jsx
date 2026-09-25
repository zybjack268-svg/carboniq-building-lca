import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const FLOOR = 1.85;

export default function OperationTwin({ floors, electricityActive, gasActive }) {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const count = Math.min(20, Math.max(1, Math.round(Number(floors) || 1)));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071b24);
    scene.fog = new THREE.FogExp2(0x071b24, 0.019);
    const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 110);
    camera.position.set(17, Math.max(11, count * 1.45), 21);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.setAttribute("aria-label", `${count} 层宿舍楼运营能流示意，不代表真实建筑几何`);
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, count * FLOOR / 2, 0);
    controls.minDistance = 12;
    controls.maxDistance = 55;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.autoRotate = !reducedMotion;
    controls.autoRotateSpeed = 0.36;

    scene.add(new THREE.HemisphereLight(0x8ceef1, 0x10272d, 2.4));
    const key = new THREE.DirectionalLight(0xa9ffff, 2.5);
    key.position.set(12, 22, 15);
    scene.add(key);
    const warm = new THREE.PointLight(0xffb369, 32, 30);
    warm.position.set(-10, 5, 3);
    scene.add(warm);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(46, 39), new THREE.MeshStandardMaterial({ color: 0x0a2931, metalness: 0.36, roughness: 0.56 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const grid = new THREE.GridHelper(44, 28, 0x227b83, 0x154750);
    grid.position.y = 0.015;
    grid.material.transparent = true;
    grid.material.opacity = 0.32;
    scene.add(grid);

    const building = new THREE.Group();
    building.rotation.y = -0.08;
    scene.add(building);
    const dark = new THREE.MeshPhysicalMaterial({ color: 0x183e4b, metalness: 0.56, roughness: 0.24, transparent: true, opacity: 0.88 });
    const edge = new THREE.MeshBasicMaterial({ color: 0x61dce5, transparent: true, opacity: 0.75 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x2296a8, emissive: 0x0a596a, emissiveIntensity: 0.75, metalness: 0.35, roughness: 0.13, transparent: true, opacity: 0.85 });
    const light = new THREE.MeshBasicMaterial({ color: 0xb4fcf1, transparent: true, opacity: 0.72 });
    const box = (parent, dimensions, position, material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
      mesh.position.set(...position);
      parent.add(mesh);
      return mesh;
    };
    for (let level = 0; level < count; level += 1) {
      const y = level * FLOOR;
      box(building, [13.2, 0.13, 5.8], [0, y + 0.08, 0], dark);
      box(building, [13.2, 0.08, 5.8], [0, y + FLOOR - 0.04, 0], edge);
      [-6.45, 6.45].forEach((x) => box(building, [0.18, FLOOR, 5.8], [x, y + FLOOR / 2, 0], dark));
      [-5.45, -3.25, -1.05, 1.15, 3.35, 5.55].forEach((x, index) => {
        box(building, [1.7, 1.08, 0.11], [x, y + 0.96, -2.95], glass);
        box(building, [1.48, 0.03, 0.13], [x, y + 0.43, -3.02], index % 3 === 0 ? light : edge);
      });
      box(building, [13.2, 0.19, 0.2], [0, y + 0.14, -2.96], edge);
      box(building, [13.2, 0.19, 0.2], [0, y + FLOOR - 0.14, -2.96], edge);
    }
    box(building, [13.8, 0.28, 6.3], [0, count * FLOOR + 0.13, 0], dark);
    box(building, [2.1, 0.17, 2.2], [3.7, count * FLOOR + 0.35, 0.3], light);

    const makeFlow = (from, to, color, countParticles) => {
      const start = new THREE.Vector3(...from);
      const end = new THREE.Vector3(...to);
      const curve = new THREE.CubicBezierCurve3(start, start.clone().add(new THREE.Vector3(2.3, 3.1, -1)), end.clone().add(new THREE.Vector3(-2.3, 2.3, 2)), end);
      const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.105, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false }));
      scene.add(glow);
      const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.026, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.67, blending: THREE.AdditiveBlending, depthWrite: false }));
      scene.add(line);
      const geometry = new THREE.SphereGeometry(0.105, 8, 8);
      const particles = Array.from({ length: countParticles }, (_, index) => {
        const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.94, blending: THREE.AdditiveBlending, depthWrite: false }));
        mesh.position.copy(curve.getPoint(index / countParticles));
        scene.add(mesh);
        return mesh;
      });
      return { glow, line, particles, curve };
    };
    const electricity = makeFlow([-11.3, 0.4, -1.8], [-4.3, Math.min(count * FLOOR * 0.73, count * FLOOR - 0.5), -2.8], 0x5deaf4, 28);
    const gas = makeFlow([10.8, 0.4, 3.6], [4.9, Math.min(count * FLOOR * 0.38, count * FLOOR - 0.4), 2.8], 0xffb36a, 18);
    const sourceGeometry = new THREE.CylinderGeometry(0.42, 0.64, 0.9, 8);
    const sourceA = new THREE.Mesh(sourceGeometry, new THREE.MeshBasicMaterial({ color: 0x2ca3b0 }));
    sourceA.position.set(-11.3, 0.45, -1.8);
    scene.add(sourceA);
    const sourceB = new THREE.Mesh(sourceGeometry, new THREE.MeshBasicMaterial({ color: 0xa66b3d }));
    sourceB.position.set(10.8, 0.45, 3.6);
    scene.add(sourceB);

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame;
    const animate = (time) => {
      frame = requestAnimationFrame(animate);
      const t = reducedMotion ? 0 : time * 0.00011;
      for (const [flow, active, speed] of [[electricity, sceneRef.current?.electricityActive, 1], [gas, sceneRef.current?.gasActive, 0.75]]) {
        flow.line.visible = Boolean(active);
        flow.glow.visible = Boolean(active);
        flow.particles.forEach((particle, index) => {
          particle.visible = Boolean(active);
          if (active) particle.position.copy(flow.curve.getPoint((index / flow.particles.length + t * speed) % 1));
        });
      }
      controls.update();
      renderer.render(scene, camera);
    };
    sceneRef.current = { electricityActive, gasActive };
    animate(0);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose());
        else object.material?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, [count]);

  useEffect(() => {
    if (sceneRef.current) Object.assign(sceneRef.current, { electricityActive, gasActive });
  }, [electricityActive, gasActive]);

  return <div className="operation-twin-canvas" ref={hostRef}/>;
}
