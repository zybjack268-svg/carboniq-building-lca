import assert from 'node:assert/strict';
import test from 'node:test';
import { FACTOR_CATEGORIES, FACTOR_LIBRARY, findFactor, searchFactors } from '../src/factorLibrary.js';

test('library entries carry positive factors, units and cited sources', () => {
  const ids = new Set();
  for (const entry of FACTOR_LIBRARY) {
    assert.ok(entry.id && !ids.has(entry.id), `重复或缺失的 id：${entry.id}`);
    ids.add(entry.id);
    assert.ok(['material', 'transport', 'energy'].includes(entry.category), `${entry.id} 分类未知`);
    assert.ok(Number.isFinite(entry.factor) && entry.factor > 0, `${entry.id} 因子必须为正数`);
    assert.ok(String(entry.name).trim(), `${entry.id} 缺少名称`);
    assert.ok(String(entry.unit).trim(), `${entry.id} 缺少单位`);
    assert.ok(String(entry.source).trim(), `${entry.id} 缺少来源引用`);
  }
});

test('categories cover every library entry', () => {
  const known = new Set(FACTOR_CATEGORIES.map((category) => category.id));
  for (const entry of FACTOR_LIBRARY) assert.ok(known.has(entry.category), `${entry.id} 不在任何分类中`);
});

test('values match GB/T 51366-2019 Appendix D (building materials)', () => {
  assert.equal(findFactor('mat-c30').factor, 295);
  assert.equal(findFactor('mat-c50').factor, 385);
  assert.equal(findFactor('mat-c40'), null); // 标准未列出 C40，不得凭空补档
  assert.equal(findFactor('mat-cement').factor, 735);
  assert.equal(findFactor('mat-shale-brick').factor, 204);
  assert.equal(findFactor('mat-rebar').factor, 2340);
  assert.equal(findFactor('mat-glass').factor, 1130);
  assert.equal(findFactor('mat-alu-ingot').factor, 20300);
  assert.equal(findFactor('mat-alu-sheet').factor, 28500);
  assert.equal(findFactor('mat-eps').factor, 5020);
  assert.equal(findFactor('mat-rockwool').factor, 1980);
  assert.equal(findFactor('mat-timber'), null); // 附录D 无木材条目，不得编造
  assert.equal(findFactor('mat-mortar'), null);
});

test('Appendix D is imported in full: every entry cites the table and counts match', () => {
  const materials = searchFactors('material', '');
  assert.ok(materials.length >= 60, `附录D 全表应有 60+ 条，当前 ${materials.length} 条`);
  for (const entry of materials) assert.ok(entry.source.includes('附录D'), `${entry.id} 来源未指向附录D`);
  // 抽查此前缺失、现已补全的条目
  assert.equal(findFactor('mat-lime').factor, 1190);
  assert.equal(findFactor('mat-bof-steel').factor, 1990);
  assert.equal(findFactor('mat-steel-plate').factor, 2400);
  assert.equal(findFactor('mat-steel-galvanized').factor, 3110);
  assert.equal(findFactor('mat-gangue-hollow-brick').factor, 16);
  assert.equal(findFactor('mat-water').factor, 0.168);
});

test('values match GB/T 51366-2019 Appendix E (transportation)', () => {
  assert.equal(findFactor('trn-hdv-46t').factor, 0.057);
  assert.equal(findFactor('trn-hdv-30t').factor, 0.078);
  assert.equal(findFactor('trn-hdv-18t').factor, 0.129);
  assert.equal(findFactor('trn-mdv-8t').factor, 0.179);
  assert.equal(findFactor('trn-rail').factor, 0.01);
  const transport = searchFactors('transport', '');
  assert.equal(transport.length, 13); // 附录E 全表
  for (const entry of transport) assert.equal(entry.unit, 't·km');
});

test('energy factors match the MEE announcement and Appendix A conversion', () => {
  assert.equal(findFactor('eng-grid-2023').factor, 0.5306);
  assert.equal(searchFactors('energy', '区域').length, 7);
  assert.equal(searchFactors('energy', '').filter((entry) => entry.group === '电力·省级').length, 30); // 公告表3 全量省级因子（未含西藏）
  assert.equal(findFactor('eng-gas').factor, 2.16);
  assert.ok(!findFactor('eng-gas').note.includes('换算错误')); // 早前"2.16 是单位错误"的说法已被标准原文推翻
});

test('A5 fuel factors are converted from Appendix A with GB/T 2589 heat values', () => {
  assert.equal(findFactor('eng-diesel-kg').factor, 3.1);
  assert.equal(findFactor('eng-gasoline-kg').factor, 2.93);
  assert.equal(findFactor('eng-lpg-kg').factor, 3.11);
  assert.equal(findFactor('eng-fuel-oil-kg').factor, 3.18);
  assert.equal(findFactor('eng-coal-raw').factor, 1.86);
  for (const id of ['eng-diesel-kg', 'eng-gasoline-kg', 'eng-lpg-kg', 'eng-fuel-oil-kg', 'eng-coal-raw']) {
    assert.equal(findFactor(id).target, undefined); // 燃料不进 B6 电力/燃气选择器，供 A5 使用
    assert.ok(findFactor(id).source.includes('附录A'));
  }
});

test('search matches name, source and unit without case or space sensitivity', () => {
  assert.equal(searchFactors('material', 'c30')[0].id, 'mat-c30');
  assert.ok(searchFactors('material', '51366').length >= 5);
  assert.ok(searchFactors('transport', 't·km').length >= 4);
  assert.ok(searchFactors('energy', '天然气').some((entry) => entry.id === 'eng-gas'));
});

test('search stays inside the requested category and tolerates empty queries', () => {
  for (const entry of searchFactors('transport', '')) assert.equal(entry.category, 'transport');
  assert.ok(searchFactors('material', '').length >= 60);
  assert.equal(searchFactors('energy', '不存在的关键词').length, 0);
});

test('energy entries declare which B6 field they apply to', () => {
  assert.equal(findFactor('eng-grid-2023').target, 'electricity');
  assert.equal(findFactor('eng-gas').target, 'gas');
  // 电力/燃气/热力选择器按 target 过滤；燃料类因子（无 target）只出现在 A5 的能源选择器里
  for (const entry of searchFactors('energy', '')) {
    if (entry.group === '燃料') assert.equal(entry.target, undefined);
    else assert.ok(['electricity', 'gas', 'heat'].includes(entry.target));
  }
  assert.equal(findFactor('missing-id'), null);
});
