import assert from 'node:assert/strict';
import test from 'node:test';
import { groupByPart, pareto, sensitivity } from '../src/analysis.js';

const rows = [
  { id: 'M1', part: '主体结构', name: '混凝土', emission: 500 },
  { id: 'M2', part: '主体结构', name: '钢筋', emission: 300 },
  { id: 'M3', part: '围护', name: '玻璃', emission: 100 },
  { id: 'M4', part: '', name: '未标注构件', emission: 100 },
  { id: 'M5', part: '围护', name: '异常行', emission: Number.NaN },
];

test('groupByPart merges by part, sorts and computes shares', () => {
  const grouped = groupByPart(rows);
  assert.deepEqual(grouped.map((item) => item.part), ['主体结构', '围护', '未分类']);
  assert.equal(grouped[0].emission, 800);
  assert.equal(grouped[1].share, 0.1);
  // 无效行不参与计算
  assert.equal(grouped.reduce((sum, item) => sum + item.emission, 0), 1000);
});

test('pareto ranks rows and merges the tail into one bucket', () => {
  const ranked = pareto(rows, 2);
  assert.deepEqual(ranked.map((item) => item.name), ['混凝土', '钢筋', '其他材料（2 项）']);
  assert.equal(ranked[1].cumulativeShare, 0.8);
  assert.equal(ranked[2].cumulativeShare, 1);
});

test('pareto handles an empty or all-invalid list', () => {
  assert.deepEqual(pareto([]), []);
  assert.deepEqual(pareto([{ emission: 'x' }]), []);
});

test('sensitivity gives symmetric swings equal to step × item emission', () => {
  const { total, swings } = sensitivity(rows, 0.1);
  assert.equal(total, 1000);
  assert.equal(swings[0].name, '混凝土');
  assert.equal(swings[0].swing, 50);
  assert.equal(swings[0].swingShare, 0.05);
  assert.deepEqual(swings.map((item) => item.name), ['混凝土', '钢筋', '玻璃', '未标注构件']);
});

test('sensitivity tolerates an empty list', () => {
  assert.deepEqual(sensitivity([]), { total: 0, swings: [], step: 0.1 });
});
