import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNotebook, isImage } from '../lib/notebook.ts';

test('valid records retain stages and summaries', () => {
  const state = { projects: [{ id: 'one', title: '手作包', category: '布艺', status: 'done', created: '2026-10-25', materials: '棉布', summary: '下次把针脚缝密一些', entries: [{ id: 'two', date: '2026-10-25', text: '裁好布了', photos: ['123e4567-e89b-42d3-a456-426614174000'] }] }], ideas: [] };
  assert.deepEqual(validateNotebook(state), state);
});
test('rejects foreign photo paths and oversized records', () => {
  const project = { id: 'one', title: '包', category: '布艺', status: 'making', created: '2026-10-25', materials: '', summary: '', entries: [] };
  assert.throws(() => validateNotebook({ projects: [{...project, entries: [{id:'x', date:'2026-10-25', text:'', photos:['https://evil.test/a']}]}], ideas:[] }));
  assert.throws(() => validateNotebook({projects:[{...project, title:'a'.repeat(81)}], ideas:[]}));
  assert.throws(() => validateNotebook({projects:[{...project,status:'unknown'}],ideas:[]}));
});
test('requires raster signature and declared type to match', () => {
  assert.equal(isImage(new Uint8Array([255,216,255,224]), 'image/jpeg'), true);
  assert.equal(isImage(new TextEncoder().encode('<svg/onload=alert(1)>'), 'image/jpeg'), false);
  assert.equal(isImage(new Uint8Array([255,216,255,224]), 'image/png'), false);
});
