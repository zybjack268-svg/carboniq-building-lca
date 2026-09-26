import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import storage from '../desktop/storagePort.cjs';
import models from '../desktop/modelConnection.cjs';

test('recovers the latest previous project origin and does not read project values', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'carboniq-origin-'));
  const leveldb = path.join(folder, 'Local Storage', 'leveldb');
  try {
    await mkdir(leveldb, { recursive: true });
    await writeFile(path.join(leveldb, '000003.log'), Buffer.from(
      '\0http://127.0.0.1:53742\0carboniq.project.v1\0older' +
      '\0http://127.0.0.1:65390\0carboniq.project.v1\0newer', 'latin1'));
    assert.equal(await storage.findLegacyProjectPort(folder), 65390);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('connection test saves only after visible text, retrying a truncated response', async () => {
  const input = { baseUrl: 'https://example.test/v1', model: 'test-model', apiKey: 'test-key' };
  const empty = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '' }, finish_reason: 'stop' }] }) });
  await assert.rejects(models.testModelConnection(input, empty), /没有返回可显示的文本/);
  const budgets = [];
  const retry = async (_url, options) => {
    budgets.push(JSON.parse(options.body).max_tokens);
    return { ok: true, json: async () => ({ choices: [{ message: { content: budgets.length === 2 ? 'OK' : '' }, finish_reason: budgets.length === 2 ? 'stop' : 'length' }] }) };
  };
  await models.testModelConnection(input, retry);
  assert.deepEqual(budgets, [256, 1024]);
});
