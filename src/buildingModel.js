import * as THREE from "three";

// 共享建筑模型：A5 施工场景与 B6 运营夜景使用同一套建模。
// 质感来自"暗色立面 + 自发光窗户纹理"：整栋楼的窗格烘焙进 Canvas 纹理，
// 每层取纹理的一行（repeat/offset），既有多样性又把每层立面压缩成 1 个网格。

const mulberry = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

// 生成整栋楼的窗格发光纹理（rows 行 × cols 列），部分窗亮、部分暖光。
export function createWindowFacadeTexture({ floors, cols = 9, litRatio = .5, warmRatio = .22, seed = 7 }) {
  const cell = 32;
  const colsShown = Math.max(4, cols);
  const rowsShown = Math.max(1, Math.min(floors, Math.floor(2048 / cell)));
  const canvas = document.createElement("canvas");
  canvas.width = colsShown * cell;
  canvas.height = rowsShown * cell;
  const ctx = canvas.getContext("2d");
  const rand = mulberry(seed);
  ctx.fillStyle = "#141a1f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < rowsShown; row += 1) {
    for (let col = 0; col < colsShown; col += 1) {
      const x = col * cell + 7;
      const y = row * cell + 6;
      const w = cell - 14;
      const h = cell - 13;
      if (rand() < litRatio) {
        const warm = rand() < warmRatio;
        ctx.fillStyle = warm ? "#ffe0ac" : "#dcecff";
        ctx.shadowColor = warm ? "#ffbf66" : "#a8d2ff";
        ctx.shadowBlur = 7;
      } else {
        ctx.fillStyle = "#0a0d11";
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(x, y, w, h);
      ctx.shadowBlur = 0;
    }
  }
  ctx.fillStyle = "#1d242b";
  for (let row = 0; row <= rowsShown; row += 1) ctx.fillRect(0, row * cell - 2, canvas.width, 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, rowsShown };
}

function bandMaterial({ texture, rowsShown, row, night }) {
  const map = texture.clone();
  map.needsUpdate = true;
  map.repeat.set(1, 1 / rowsShown);
  map.offset.set(0, Math.min(row, rowsShown - 1) / rowsShown);
  return new THREE.MeshStandardMaterial({
    color: 0x39424b,
    roughness: .48,
    metalness: .3,
    map,
    emissive: 0xffffff,
    emissiveMap: map,
    emissiveIntensity: night ? 1.6 : .95,
  });
}

// 创建建筑：返回分组（结构/立面按层拆分，供施工阶段切换）与屋顶细节。
export function createBuildingModel({ floors = 6, floorHeight = 2.55, length = 17, width = 7.4, night = false, seed = 7, litRatio }) {
  const group = new THREE.Group();
  const rand = mulberry(seed);
  const { texture, rowsShown } = createWindowFacadeTexture({ floors, seed, litRatio: litRatio ?? (night ? .66 : .3) });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x9aaea5, roughness: .68 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x39424b, roughness: .5, metalness: .25 });
  const structureFloors = [];
  const facadeFloors = [];

  for (let level = 1; level <= floors; level += 1) {
    const baseY = (level - 1) * floorHeight;

    const structure = new THREE.Group();
    structure.position.y = baseY;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(length + .35, .28, width + .35), concreteMat);
    slab.position.y = .14;
    slab.castShadow = slab.receiveShadow = true;
    structure.add(slab);
    const columnGeometry = new THREE.BoxGeometry(.4, floorHeight - .28, .4);
    for (const x of [-length / 2 + .9, -length / 4, 0, length / 4, length / 2 - .9]) {
      for (const z of [-width / 2 + .7, width / 2 - .7]) {
        const column = new THREE.Mesh(columnGeometry, concreteMat);
        column.position.set(x, .28 + (floorHeight - .28) / 2, z);
        column.castShadow = true;
        structure.add(column);
      }
    }
    const core = new THREE.Mesh(new THREE.BoxGeometry(2.5, floorHeight - .28, 1.9), concreteMat);
    core.position.set(length / 2 - 1.8, .28 + (floorHeight - .28) / 2, 0);
    core.castShadow = true;
    structure.add(core);
    group.add(structure);
    structureFloors.push(structure);

    const facade = new THREE.Group();
    facade.position.y = baseY;
    // 层间腰线（深色，制造立面分段感）
    const spandrel = new THREE.Mesh(new THREE.BoxGeometry(length + .18, floorHeight * .3, width + .18), edgeMat);
    spandrel.position.y = floorHeight * .18;
    spandrel.castShadow = true;
    facade.add(spandrel);
    // 发光窗带：一个盒子包四面，纹理取当前层
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(length, floorHeight * .58, width),
      bandMaterial({ texture, rowsShown, row: level - 1, night }),
    );
    glass.position.y = floorHeight * .3 + floorHeight * .29;
    facade.add(glass);
    // 竖向分隔柱
    for (const x of [-length / 2 - .06, length / 2 + .06]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(.16, floorHeight * .92, .5), edgeMat);
      pillar.position.set(x, floorHeight * .5, 0);
      facade.add(pillar);
    }
    group.add(facade);
    facadeFloors.push({ group: facade, spandrel, glass });
  }

  const roofY = floors * floorHeight;
  const roofGroup = new THREE.Group();
  roofGroup.position.y = roofY;
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(length + .5, .5, .2), edgeMat);
  parapet.position.set(0, .25, -width / 2 - .1);
  roofGroup.add(parapet);
  const parapetBack = parapet.clone();
  parapetBack.position.z = width / 2 + .1;
  roofGroup.add(parapetBack);
  const bulkhead = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.5, 2.6), edgeMat);
  bulkhead.position.set(length / 2 - 2.6, .75, 1);
  bulkhead.castShadow = true;
  roofGroup.add(bulkhead);
  for (const [x, z] of [[-length / 2 + 2, width / 2 - 1.6], [-length / 2 + 4.2, width / 2 - 1.6], [0, width / 2 - 1.6]]) {
    const acUnit = new THREE.Mesh(new THREE.BoxGeometry(1.1, .62, .9), new THREE.MeshStandardMaterial({ color: 0x5b6a72, roughness: .5, metalness: .35 }));
    acUnit.position.set(x, .31, z);
    acUnit.castShadow = true;
    roofGroup.add(acUnit);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, 1.35, 14), new THREE.MeshStandardMaterial({ color: 0x67767e, roughness: .45, metalness: .4 }));
  tank.position.set(-length / 2 + 1.6, .68, -width / 2 + 1.6);
  tank.castShadow = true;
  roofGroup.add(tank);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 2.6, 6), edgeMat);
  mast.position.set(length / 2 - 2.6, 2.8, 1);
  roofGroup.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.11, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff4040, emissive: 0xff2020, emissiveIntensity: 2 }));
  beacon.position.set(length / 2 - 2.6, 4.2, 1);
  roofGroup.add(beacon);
  group.add(roofGroup);

  // 首层入口雨棚与亮灯门厅
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.6, .14, 1.5), edgeMat);
  canopy.position.set(-length / 4, floorHeight * .8, -width / 2 - .7);
  canopy.castShadow = true;
  group.add(canopy);
  for (const x of [-length / 4 - 2, -length / 4 + 2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, floorHeight * .78, 6), edgeMat);
    post.position.set(x, floorHeight * .39, -width / 2 - 1.3);
    group.add(post);
  }

  return { group, structureFloors, facadeFloors, roofGroup, beacon, rowsShown };
}
