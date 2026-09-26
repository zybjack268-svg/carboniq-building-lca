import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILTIN_SKILLS, SKILL_SCOPES, allSkills, exportSkill, extractSkillDraft, importSkillText, importSkills, loadUserSkills, parseMarkdownSkill, saveUserSkills, skillToMarkdown, stripSkillDraftJson, validateSkill } from '../src/skillLibrary.js';

test('every builtin skill has complete fields and a known scope', () => {
  const ids = new Set();
  for (const skill of BUILTIN_SKILLS) {
    assert.ok(skill.id.startsWith('skill-'), `${skill.id} 内置 id 前缀不符`);
    assert.ok(!ids.has(skill.id), `${skill.id} 重复`);
    ids.add(skill.id);
    assert.ok(skill.builtin);
    assert.ok(SKILL_SCOPES.some((scope) => scope.id === skill.scope), `${skill.id} 范围未知`);
    assert.ok(skill.name.length <= 40 && skill.description.length <= 160 && skill.instruction.length <= 4000);
    assert.ok(skill.instruction.length >= 20, `${skill.id} 指令太短`);
  }
  // 四个工作流 + 全览都有覆盖
  for (const scope of SKILL_SCOPES.map((item) => item.id)) {
    assert.ok(BUILTIN_SKILLS.some((skill) => skill.scope === scope), `范围 ${scope} 没有内置技能`);
  }
});

test('validateSkill trims fields, caps lengths and rejects bad scope or id collisions', () => {
  const good = validateSkill({ name: ' 我的技能 ', description: ' 测试说明 ', instruction: ' 请做测试分析。 ', scope: 'a1' });
  assert.equal(good.ok, true);
  assert.equal(good.skill.name, '我的技能');
  assert.ok(good.skill.id.startsWith('user-'));
  assert.equal(good.skill.builtin, false);
  assert.equal(validateSkill({ name: '', description: 'x', instruction: 'y', scope: 'a1' }).ok, false);
  assert.equal(validateSkill({ name: 'x'.repeat(41), description: 'x', instruction: 'y', scope: 'a1' }).ok, false);
  assert.equal(validateSkill({ name: 'x', description: 'x', instruction: 'y', scope: 'nope' }).ok, false);
  const clash = validateSkill({ id: BUILTIN_SKILLS[0].id, name: 'x', description: 'x', instruction: 'y', scope: 'a1' });
  assert.equal(clash.ok, false);
  assert.match(clash.errors.join(), /冲突/);
});

test('importSkills accepts object, wrapper and array forms, skipping invalid entries', () => {
  const base = { name: '导入技能', description: '说明', instruction: '指令内容。', scope: 'b6' };
  const single = importSkills(JSON.stringify(base));
  assert.equal(single.skills.length, 1);
  const wrapped = importSkills(JSON.stringify({ skills: [base, base] }));
  assert.equal(wrapped.skills.length, 2);
  assert.notEqual(wrapped.skills[0].id, wrapped.skills[1].id);
  const array = importSkills(JSON.stringify([base, { name: '坏技能' }, 'not-an-object']));
  assert.equal(array.skills.length, 1);
  assert.equal(array.errors.length, 2);
  const bad = importSkills('not json');
  assert.equal(bad.skills.length, 0);
  assert.match(bad.errors[0], /JSON/);
});

test('exportSkill roundtrips through importSkills', () => {
  const skill = validateSkill({ name: '往返技能', description: '说明', instruction: '指令。', scope: 'overview' }).skill;
  const roundtrip = importSkills(exportSkill(skill));
  assert.equal(roundtrip.skills.length, 1);
  assert.equal(roundtrip.skills[0].name, '往返技能');
  assert.equal(roundtrip.skills[0].scope, 'overview');
});

test('user skill storage guards non-browser environments', () => {
  assert.deepEqual(loadUserSkills(), []);
  assert.equal(saveUserSkills([{ id: 'user-x' }]), false);
  assert.deepEqual(allSkills([]), BUILTIN_SKILLS);
  const merged = allSkills([{ id: 'user-a', name: 'A', description: 's', instruction: 'i', scope: 'a4', builtin: false }]);
  assert.equal(merged.length, BUILTIN_SKILLS.length + 1);
  assert.equal(merged[merged.length - 1].id, 'user-a');
});

test('SKILL.md markdown roundtrips and validates frontmatter', () => {
  const skill = validateSkill({ name: 'MD 技能', description: 'Markdown 说明', instruction: '这是正文指令。', scope: 'a5' }).skill;
  const md = skillToMarkdown(skill);
  assert.ok(md.startsWith('---'));
  assert.ok(md.includes('name: MD 技能'));
  const parsed = parseMarkdownSkill(md);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.skill.name, 'MD 技能');
  assert.equal(parsed.skill.scope, 'a5');
  assert.equal(parsed.skill.instruction, '这是正文指令。');
  const roundtrip = importSkillText(md);
  assert.equal(roundtrip.skills.length, 1);
  assert.equal(roundtrip.skills[0].name, 'MD 技能');
});

test('parseMarkdownSkill rejects missing frontmatter, bad scope or empty body', () => {
  assert.equal(parseMarkdownSkill('没有 frontmatter 的文本').ok, false);
  assert.equal(parseMarkdownSkill('---\nname: X\nscope: nope\n---\n指令').ok, false);
  assert.equal(parseMarkdownSkill('---\nname: X\nscope: a1\n---\n').ok, false);
});

test('importSkillText auto-detects JSON and markdown', () => {
  const json = importSkillText(JSON.stringify({ name: 'J', description: 's', instruction: 'i', scope: 'a4' }));
  assert.equal(json.skills.length, 1);
  const md = importSkillText('---\nname: M\ndescription: s\nscope: overview\n---\n指令正文');
  assert.equal(md.skills.length, 1);
  assert.equal(md.skills[0].scope, 'overview');
  assert.equal(md.skills.length, 1);
  assert.equal(md.skills[0].scope, 'overview');
});

test('extractSkillDraft finds the draft JSON inside chatty replies', () => {
  const reply = '好的，我起草了一个技能：\n```json\n{"carboniqSkillDraft":{"name":"幕墙核对","scope":"a1","description":"d","instruction":"i"}}\n```\n确认后保存即可。';
  const draft = extractSkillDraft(reply);
  assert.ok(draft);
  assert.equal(draft.name, '幕墙核对');
  assert.equal(extractSkillDraft('没有草稿的普通回答'), null);
  assert.equal(extractSkillDraft('{"carboniqSkillDraft":{"name": broken'), null);
});

test('stripSkillDraftJson removes the draft JSON and stray fences from chat text', () => {
  const messy = '好的，我起草了一个技能：\n```json\n{"carboniqSkillDraft":{"name":"X","scope":"a1","description":"d","instruction":"i"}}\n```\n确认后保存即可。';
  const clean = stripSkillDraftJson(messy);
  assert.ok(!clean.includes('carboniqSkillDraft'));
  assert.ok(clean.includes('好的，我起草了一个技能：'));
  assert.ok(clean.includes('确认后保存即可。'));
  assert.ok(!clean.includes('```'));
});
