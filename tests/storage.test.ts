import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadNotebook, saveNotebook, putPhoto, getPhoto, createBackup, restoreBackup, loadDraft, saveDraft, clearDraft } from '../lib/storage.ts';
const photo='123e4567-e89b-42d3-a456-426614174000';
const data={projects:[{id:'one',title:'第一个小包',category:'布艺',status:'making' as const,created:'2026-10-25',materials:'棉布',summary:'',entries:[{id:'two',date:'2026-10-25',text:'裁好了',photos:[photo]}]}],ideas:[]};
test('durably saves records and rejects stale overwrite',async()=>{
 const first=await loadNotebook();assert.equal(first.revision,0);
 const revision=await saveNotebook(data,0);assert.equal(revision,1);
 assert.deepEqual((await loadNotebook()).data,data);
 await assert.rejects(()=>saveNotebook({projects:[],ideas:[]},0),/另一个页面/);
 assert.equal((await loadNotebook()).data.projects.length,1);
});
test('backup and restore round trip includes actual photo bytes',async()=>{
 const blob=new Blob([new Uint8Array([255,216,255,224])],{type:'image/jpeg'});
 await putPhoto(photo,blob);
 const backup=await createBackup(data);
 assert.ok(backup.photos[photo].startsWith('data:image/jpeg;base64,'));
 const revision=await saveNotebook({projects:[],ideas:[]},1);
 const restored=await restoreBackup(backup,revision);
 assert.equal(restored.revision,3);assert.deepEqual((await loadNotebook()).data,data);
 assert.deepEqual(new Uint8Array(await (await getPhoto(photo))!.arrayBuffer()),new Uint8Array(await blob.arrayBuffer()));
});
test('rejects damaged backups without modifying the current notebook',async()=>{
 const before=await loadNotebook();
 await assert.rejects(()=>restoreBackup({format:'slowmade-v1',data,photos:{}},before.revision),/缺少照片/);
 await assert.rejects(()=>restoreBackup({format:'other',data,photos:{}},before.revision));
 assert.deepEqual(await loadNotebook(),before);
});
test('keeps drafts separate from saved work and clears only the requested draft',async()=>{
 await saveDraft('entry-one',{fields:{text:'写到一半',date:'2026-10-25'},photos:[photo]});
 assert.equal((await loadDraft('entry-one'))?.fields.text,'写到一半');
 await clearDraft('entry-one');assert.equal(await loadDraft('entry-one'),null);
});
