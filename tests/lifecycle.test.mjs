import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateOperation, calculateTransport } from '../src/lifecycle.js';

test('A4 uses only complete route rows and tonne-kilometres', () => {
  const result = calculateTransport([
    { id: 'a', material: '混凝土', origin: '工厂', destination: '工地', source: '运单', mass: '12', distance: '50', factor: '0.1' },
    { id: 'b', material: '钢材', origin: '工厂', destination: '工地', source: '运单', mass: '5', distance: '', factor: '0.1' },
  ]);
  assert.equal(result.kg, 60);
  assert.equal(result.incomplete, 1);
  assert.equal(result.rows[0].tonneKilometres, 600);
});

test('B6 is empty without energy and does not silently invent gas emissions', () => {
  const empty = calculateOperation({ annualElectricity: '', electricityFactor: '0.5306', annualGas: '', gasFactor: '', years: '30' });
  assert.equal(empty.annualKg, null);
  const partial = calculateOperation({ annualElectricity: '100000', electricityFactor: '0.5306', annualGas: '2000', gasFactor: '', years: '30' });
  assert.ok(Math.abs(partial.annualKg - 53060) < 1e-8);
  assert.equal(partial.gasIncomplete, true);
  assert.ok(Math.abs(partial.horizonKg - 1591800) < 1e-7);
});

test('B6 electricity and gas retain separate factors before summing', () => {
  const result = calculateOperation({ annualElectricity: '100', electricityFactor: '0.5', annualGas: '10', gasFactor: '2', years: '2' });
  assert.equal(result.electricityKg, 50);
  assert.equal(result.gasKg, 20);
  assert.equal(result.annualKg, 70);
  assert.equal(result.horizonKg, 140);
});
