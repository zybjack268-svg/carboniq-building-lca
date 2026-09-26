import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsv } from '../src/dataUtils.js';
import { mapCandidateColumns, parseCandidateRows, parseCandidateText } from '../src/candidateImport.js';

test('candidate columns map by header keywords', () => {
  const mapping = mapCandidateColumns(['产品名称', '单位', '碳排放因子', '单价', '来源', '型号']);
  assert.equal(mapping.name, 0);
  assert.equal(mapping.unit, 1);
  assert.equal(mapping.factor, 2);
  assert.equal(mapping.cost, 3);
  assert.equal(mapping.source, 4);
  assert.equal(mapping.specification, 5);
});

test('parseCandidateRows reads csv candidates and skips invalid rows', () => {
  const csv = '候选名称,单位,碳因子,成本单价,来源,规格\n再生骨料混凝土 C30,m³,260,350,CPCD 2022,28天强度C30\nXPS 挤塑板,t,3700,,厂商资料,\n小计,,,,,\n坏行,,abc,,,\n';
  const { rows, issues, headerRow } = parseCandidateRows(parseCsv(csv));
  assert.equal(headerRow, 1);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].factor, 260);
  assert.equal(rows[0].cost, 350);
  assert.equal(rows[1].cost, '');
  assert.ok(issues.some((issue) => issue.includes('2 行') === false) || issues.length >= 1);
  assert.ok(issues.join().includes('有效碳因子'));
});

test('parseCandidateText handles pipe and multi-space tables from PDF/Word text', () => {
  const pipeText = '候选材料清单\n名称 | 单位 | 碳因子 | 成本 | 来源\n再生铝窗 | m² | 194 | 800 | EPD-123\n';
  const piped = parseCandidateText(pipeText);
  assert.equal(piped.rows.length, 1);
  assert.equal(piped.rows[0].factor, 194);
  assert.equal(piped.rows[0].cost, 800);

  const spacedText = '替代产品表\n名称      单位      因子      来源\n低碳混凝土  m³  268  报告B\n';
  const spaced = parseCandidateText(spacedText);
  assert.equal(spaced.rows.length, 1);
  assert.equal(spaced.rows[0].name, '低碳混凝土');
  assert.equal(spaced.rows[0].factor, 268);
});

test('parseCandidateText reports a helpful issue when no header exists', () => {
  const result = parseCandidateText('这是一段没有表格的文字。\n只有一句话。');
  assert.deepEqual(result.rows, []);
  assert.ok(result.issues[0].includes('表头'));
});

test('parsed candidates never carry a non-positive factor', () => {
  const csv = '名称,单位,因子\n负数行,m³,-5,来源\n零行,m³,0,来源\n正常行,m³,300,来源\n';
  const { rows } = parseCandidateRows(parseCsv(csv));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, '正常行');
});
