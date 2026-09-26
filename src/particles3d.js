import * as THREE from "three";

// 共享粒子工具：软光斑贴图 + 固定容量对象池，供 A5 施工与 B6 运营两个 3D 场景复用。
let spriteTexture = null;

export function softSpriteTexture() {
  if (spriteTexture) return spriteTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.3, "rgba(255,255,255,.85)");
  gradient.addColorStop(0.65, "rgba(255,255,255,.28)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  spriteTexture = new THREE.CanvasTexture(canvas);
  spriteTexture.colorSpace = THREE.SRGBColorSpace;
  return spriteTexture;
}

export function createParticlePool({ count, color, size, opacity = 1, additive = true }) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) positions[i * 3 + 1] = -1000;
  // 注意：BufferAttribute 直接引用 positions 数组（Float32BufferAttribute 会拷贝），
  // 这样 spawn/advance 对数组的写入才能通过 needsUpdate 上传到 GPU。
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color, size, map: softSpriteTexture(), transparent: true, opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, positions, life: new Float32Array(count), maxLife: new Float32Array(count), velocity: new Float32Array(count * 3), cursor: 0, count };
}

export function spawnParticle(pool, x, y, z, velocity, life, spread = 0, rand = Math.random) {
  const index = pool.cursor;
  pool.cursor = (pool.cursor + 1) % pool.count;
  pool.positions[index * 3] = x + (rand() - .5) * spread;
  pool.positions[index * 3 + 1] = y;
  pool.positions[index * 3 + 2] = z + (rand() - .5) * spread;
  pool.velocity[index * 3] = velocity[0] + (rand() - .5) * .35;
  pool.velocity[index * 3 + 1] = velocity[1] + rand() * .3;
  pool.velocity[index * 3 + 2] = velocity[2] + (rand() - .5) * .35;
  pool.life[index] = life;
  pool.maxLife[index] = life;
}

export function advanceParticles(pool, delta, { drag = .99, rise = 0, gravity = 0 } = {}) {
  const attribute = pool.points.geometry.attributes.position;
  for (let i = 0; i < pool.count; i += 1) {
    if (pool.life[i] <= 0) continue;
    pool.life[i] -= delta;
    pool.velocity[i * 3 + 1] += (rise - gravity) * delta;
    pool.velocity[i * 3] *= drag;
    pool.velocity[i * 3 + 2] *= drag;
    pool.positions[i * 3] += pool.velocity[i * 3] * delta;
    pool.positions[i * 3 + 1] += pool.velocity[i * 3 + 1] * delta;
    pool.positions[i * 3 + 2] += pool.velocity[i * 3 + 2] * delta;
    if (pool.life[i] <= 0) pool.positions[i * 3 + 1] = -1000;
  }
  attribute.needsUpdate = true;
}

export function liveCount(pool) {
  let total = 0;
  for (let i = 0; i < pool.count; i += 1) if (pool.life[i] > 0) total += 1;
  return total;
}
