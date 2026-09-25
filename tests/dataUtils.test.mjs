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
  assert.deepEqual(computeMaterialScenario(rows, candidates, {}), { reduction: 0, total: 1400, rate: 0 });
  assert.equal(computeMaterialScenario(rows, candidates, { M1: 'C1' }).reduction, 200);
  assert.equal(computeMaterialScenario(rows, candidates, { M2: 'C2' }).reduction, -100);
});

test('CSV export quotes user values and prevents spreadsheet formulas', () => {
  assert.equal(quoteCsv('a,b"c'), '"a,b""c"');
  assert.equal(quoteCsv('=1+1'), '"\'=1+1"');
});
