import assert from 'node:assert/strict';
import test from 'node:test';
import { computeMaterialScenario, parseCsv, parseMaterialRows, quoteCsv } from '../src/dataUtils.js';

test('CSV supports quoted commas, escaped quotes and CRLF', () => {
  const rows = parseCsv('材料名称,单位,数量,碳因子,因子来源\r\n"混凝土,C30",m³,2,295,"报告""A"""\r\n');
  assert.equal(rows[1][0], '混凝土,C30');
  assert.equal(rows[1][4], '报告"A"');
  assert.equal(parseMaterialRows(rows)[0].quantity, 2);
});

test('missing or invalid factor cannot silently become zero', () => {
  assert.throws(() => parseMaterialRows(parseCsv('材料名称,单位,数量,碳因子\n钢筋,t,2,\n')), /碳因子/);
  assert.throws(() => parseMaterialRows(parseCsv('材料名称,单位,数量\n钢筋,t,2\n')), /缺少碳因子列/);
  assert.throws(() => parseMaterialRows(parseCsv('材料名称,单位,数量,碳因子\n钢筋,t,-2,2340\n')), /数量/);
  assert.throws(() => parseMaterialRows(parseCsv('材料名称,单位,数量,碳因子\n,t,2,2340\n')), /材料名称/);
});

test('material scenario uses only selected candidate and allows increases', () => {
  const rows = [{ id: 'M1', quantity: 10, factor: 100 }, { id: 'M2', quantity: 2, factor: 200 }];
  const candidates = [{ id: 'C1', materialId: 'M1', factor: 80 }, { id: 'C2', materialId: 'M2', factor: 250 }];
  assert.deepEqual(computeMaterialScenario(rows, candidates, {}), { reduction: 0, total: 1400, rate: 0, costDelta: 0 });
  assert.equal(computeMaterialScenario(rows, candidates, { M1: 'C1' }).reduction, 200);
  assert.equal(computeMaterialScenario(rows, candidates, { M2: 'C2' }).reduction, -100);
});

test('optional cost column parses when present and stays empty when missing', () => {
  const withCost = parseMaterialRows(parseCsv('材料名称,单位,数量,碳因子,成本单价,因子来源\n混凝土,m³,2,295,420.5,标准\n钢筋,t,1,2340,,标准\n砌块,m³,3,204,"1,800元",来源A\n'));
  assert.equal(withCost[0].cost, 420.5);
  assert.equal(withCost[1].cost, '');
  assert.equal(withCost[2].cost, 1800);
  const noColumn = parseMaterialRows(parseCsv('材料名称,单位,数量,碳因子\n钢筋,t,2,2340\n'));
  assert.equal(noColumn[0].cost, '');
});

test('scenario cost delta sums selected pairs and nulls out when cost missing', () => {
  const rows = [
    { id: 'M1', quantity: 10, factor: 100, cost: 50 },
    { id: 'M2', quantity: 2, factor: 200, cost: '' },
  ];
  const candidates = [
    { id: 'C1', materialId: 'M1', factor: 80, cost: 60 },
    { id: 'C2', materialId: 'M2', factor: 150, cost: 300 },
  ];
  // 只选 M1：成本差 = 10 × (60 − 50) = 100 元
  assert.equal(computeMaterialScenario(rows, candidates, { M1: 'C1' }).costDelta, 100);
  // 选中的 M2 缺基准成本 → 成本结论不可得
  assert.equal(computeMaterialScenario(rows, candidates, { M2: 'C2' }).costDelta, null);
  // 全选时同样不可得
  assert.equal(computeMaterialScenario(rows, candidates, { M1: 'C1', M2: 'C2' }).costDelta, null);
  // 无候选时无成本要求
  assert.equal(computeMaterialScenario(rows, candidates, {}).costDelta, 0);
});

test('CSV export quotes user values and prevents spreadsheet formulas', () => {
  assert.equal(quoteCsv('a,b"c'), '"a,b""c"');
  assert.equal(quoteCsv('=1+1'), '"\'=1+1"');
});

test('template note rows and cost header synonyms parse without error', () => {
  const csv = '说明：本表为示范格式；成本单价为可选列，不填不影响排放核算。\n材料名称,单位,数量,碳因子,预算单价\n钢筋,t,2,2340,4300\n';
  const rows = parseMaterialRows(parseCsv(csv));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cost, 4300);
  assert.equal(rows[0].name, '钢筋');
});
