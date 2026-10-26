'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, Camera, Check, CheckCheck, ChevronRight, Cloud, Flower2, Gift, Heart, ImagePlus, Leaf, Lightbulb, LoaderCircle, Plus, Search, Scissors, Smartphone, Sparkles, Trash2, X } from 'lucide-react';
import CraftArt from '../components/craft-art';
import { usePageTurn } from '../components/use-page-turn';
import { emptyNotebook, type Notebook, type Project, type Entry } from '../lib/notebook';
import { clearDraft, createBackup, getLastBackup, getPhoto, loadDraft, loadNotebook, markBackupExported, putPhoto, restoreBackup, saveDraft, saveNotebook, type Draft } from '../lib/storage';

const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
const uid = () => crypto.randomUUID();
type Modal = 'project'|'entry'|'summary'|'idea'|'install'|'backup'|null;
const categories = ['不限类型','编织','布艺','黏土','纸艺','木作','其他'];
const customCategoryOption='__custom_category__';

function LocalPhoto({id,alt,large=false}:{id:string;alt:string;large?:boolean}) {
 const [source,setSource]=useState(''),[failed,setFailed]=useState(false);
 useEffect(()=>{let active=true,url='';setSource('');setFailed(false);void getPhoto(id).then(blob=>{if(!active)return;if(!blob){setFailed(true);return;}url=URL.createObjectURL(blob);setSource(url);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[id]);
 return source?<img className={large?'lightbox':''} src={source} alt={alt} loading="lazy"/>:<span className="photo-placeholder" role="img" aria-label={alt}>{failed?'照片暂时无法读取':'正在打开照片…'}</span>;
}
function Dialog({title,children,onClose,busy=false}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog ref={ref} className="dialog" onCancel={e=>{if(busy)e.preventDefault();else onClose();}} onClick={e=>{if(e.target===ref.current&&!busy)onClose();}}>
  <div className="dialog-inner"><div className="dialog-head"><h2>{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose} disabled={busy}><X size={21}/></button></div>{children}</div>
 </dialog>;
}

export default function NotebookApp() {
 const [data,setData]=useState<Notebook>(emptyNotebook), [revision,setRevision]=useState(0);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [tab,setTab]=useState('book'),[filter,setFilter]=useState('all'),[query,setQuery]=useState('');
 const [selected,setSelected]=useState<string|null>(null),[modal,setModal]=useState<Modal>(null),[lightbox,setLightbox]=useState<string|null>(null);
 const [photos,setPhotos]=useState<string[]>([]),[uploading,setUploading]=useState(false);
 const [editingEntry,setEditingEntry]=useState<string|null>(null);
 const [categorySelection,setCategorySelection]=useState(categories[0]),[customCategory,setCustomCategory]=useState('');
 const [entryPage,setEntryPage]=useState(0);
 const {turn,motion}=usePageTurn();
 const swipeStart=useRef<{x:number;y:number}|null>(null),swiped=useRef(false);
 const [offlineReady,setOfflineReady]=useState(false),[offlineProblem,setOfflineProblem]=useState(false);
 const [lastBackup,setLastBackup]=useState<string|null>(null),[draftValues,setDraftValues]=useState<Record<string,string>>({}),[draftLoading,setDraftLoading]=useState(false),[draftStatus,setDraftStatus]=useState('');
 const draftScope=useRef(''),draftQueue=useRef(Promise.resolve()),draftForm=useRef<HTMLFormElement>(null),restoreInput=useRef<HTMLInputElement>(null);
 const project=data.projects.find(p=>p.id===selected);
 const categoryOptions=[...new Set([...categories,...data.projects.map(p=>p.category)])].filter(c=>c!==customCategoryOption);
 async function load() {
  setLoading(true);setError('');
  try {const result=await loadNotebook();setData(result.data);setRevision(result.revision);setLastBackup(await getLastBackup());}
  catch(err){setError(err instanceof Error?err.message:'暂时没有打开成功，请重试。');} finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 useEffect(()=>{let active=true;const failed=()=>setOfflineProblem(true);window.addEventListener('offline-cache-error',failed);if('serviceWorker' in navigator)void navigator.serviceWorker.ready.then(()=>{if(active)setOfflineReady(true);});else setOfflineProblem(true);return()=>{active=false;window.removeEventListener('offline-cache-error',failed);};},[]);
 useEffect(()=>{if(notice){const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer);}},[notice]);
 async function start(which:Modal,existingEntry?:Entry) {
  if(loading||error||draftLoading)return;setError('');setDraftLoading(true);setPhotos([]);setDraftValues({});setDraftStatus('');
  setCategorySelection(categories[0]);setCustomCategory('');
  setEditingEntry(existingEntry?.id??null);const key=which+':'+(selected??'new')+':'+(existingEntry?.id??'new');draftScope.current=key;
  try{const draft=await loadDraft(key);if(draft){setPhotos(draft.photos??[]);setDraftValues(draft.fields??{});setCategorySelection(draft.fields.category??categories[0]);setCustomCategory(draft.fields.customCategory??'');setDraftStatus('已接着上次的草稿');}else if(existingEntry){setPhotos(existingEntry.photos);setDraftValues({text:existingEntry.text,date:existingEntry.date});}setModal(which);}
  catch{setError('暂时无法读取草稿，请重新打开后再试。');}finally{setDraftLoading(false);}
 }
 function keepDraft(nextPhotos=photos) {
  const form=draftForm.current;if(!form||!draftScope.current)return;const fields:Record<string,string>={};for(const[key,value]of new FormData(form))if(typeof value==='string')fields[key]=value;
  const key=draftScope.current;setDraftStatus('正在保留草稿…');const value:Draft={fields,photos:nextPhotos};
  draftQueue.current=draftQueue.current.catch(()=>{}).then(()=>saveDraft(key,value));
  void draftQueue.current.then(()=>setDraftStatus('草稿已保存在这台手机')).catch(()=>setDraftStatus('草稿未保存，请先不要关闭页面'));
 }
 async function finishDraft() {await draftQueue.current.catch(()=>{});await clearDraft(draftScope.current);draftScope.current='';setDraftValues({});setDraftStatus('');}
 async function closeModal(){if(busy||uploading)return;if(draftForm.current){keepDraft();await draftQueue.current.catch(()=>{});}setModal(null);setError('');}
 async function persist(next:Notebook) {
  setBusy(true);setError('');
  try {const nextRevision=await saveNotebook(next,revision);setData(next);setRevision(nextRevision);setNotice('已经保存在这台手机里了');if(navigator.storage?.persist)void navigator.storage.persist().catch(()=>{});return true;}
  catch(err){setError(err instanceof Error?err.message:'保存失败，请重试。');return false;} finally{setBusy(false);}
 }
 async function saveProject(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();const form=new FormData(e.currentTarget);
  const chosenCategory=String(form.get('category')??categories[0]);
  const category=chosenCategory===customCategoryOption?String(form.get('customCategory')??'').trim():chosenCategory;
  if(!category){setError('给自定义类型起个名字，再开始记录吧。');return;}
  const next:Project={id:uid(),title:String(form.get('title')).trim(),category,status:'making',created:today(),materials:String(form.get('materials')).trim(),summary:'',entries:[]};
  if(await persist({...data,projects:[next,...data.projects]})){await finishDraft();setModal(null);setEntryPage(0);turn(()=>setSelected(next.id));}
 }
 async function saveEntry(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();if(!project)return;const form=new FormData(e.currentTarget);const text=String(form.get('text')).trim();
  if(!text&&!photos.length){setError('写一句话，或者选一张照片，就可以记录啦。');return;}
  const entry:Entry={id:editingEntry??uid(),date:String(form.get('date')),text,photos};
  if(await persist({...data,projects:data.projects.map(p=>p.id===project.id?{...p,entries:editingEntry?p.entries.map(e=>e.id===editingEntry?entry:e):[...p.entries,entry]}:p)})){await finishDraft();setModal(null);if(!editingEntry)turn(()=>setEntryPage(project.entries.length));}
 }
 async function saveSummary(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();if(!project)return;const form=new FormData(e.currentTarget);
  if(await persist({...data,projects:data.projects.map(p=>p.id===project.id?{...p,summary:String(form.get('summary')).trim(),status:form.get('completed')?'done':'making'}:p)})){await finishDraft();setModal(null);}
 }
 async function saveIdea(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();const form=new FormData(e.currentTarget);const text=String(form.get('text')).trim();if(!text)return;
  if(await persist({...data,ideas:[{id:uid(),date:today(),text},...data.ideas]})){await finishDraft();setModal(null);}
 }
 async function upload(files:FileList|null) {
  if(!files)return;setUploading(true);setError('');const added:string[]=[];
  try {
   if(files.length+photos.length>12)throw Error('每条记录最多放 12 张照片，可以分成几条记录。');
   for(const file of Array.from(files)){
    if(file.size>12*1024*1024)throw Error('这张照片超过 12MB 了，换一张小一点的试试。');
    let blob:Blob=file;
    try {const bitmap=await createImageBitmap(file);const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const context=canvas.getContext('2d');if(!context)throw Error('照片处理暂时失败');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('处理照片失败')),'image/jpeg',.85));bitmap.close();}catch{if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('手机暂时无法读取这张照片，请转成 JPG 或 PNG 后再试。');}
    const id=uid();await putPhoto(id,blob);added.push(id);
   }
  }catch(err){setError(err instanceof Error?err.message:'照片没有保存成功，请重试。');}finally{const next=[...photos,...added];setPhotos(next);keepDraft(next);setUploading(false);}
 }
 async function removeProject() {
  if(!project||!window.confirm('确定删除「'+project.title+'」和它的全部记录吗？'))return;
  if(await persist({...data,projects:data.projects.filter(p=>p.id!==project.id)}))setSelected(null);
 }
 async function exportBackup() {
  setBusy(true);setError('');
  try {const backup=await createBackup(data);const file=new File([JSON.stringify(backup)],'慢慢造物-'+today()+'.json',{type:'application/json'});
   const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   await markBackupExported();setLastBackup(new Date().toISOString());setNotice('备份已导出，请确认保存到「文件」或下载目录');
  }catch(err){setError(err instanceof Error?err.message:'备份失败，请重试。');}finally{setBusy(false);}
 }
 async function importBackup(file?:File) {
  if(!file)return;if(file.size>300*1024*1024){setError('这个文件超过 300MB，建议在空间充足的设备上恢复。');return;}
  if(!window.confirm('恢复备份会替换这台手机当前的作品和灵感。请先导出当前内容，再继续恢复。'))return;
  setBusy(true);setError('');try{const result=await restoreBackup(JSON.parse(await file.text()),revision);setData(result.data);setRevision(result.revision);setSelected(null);setPhotos([]);setNotice('文字和照片都已经恢复到这台手机了');setModal(null);}catch(err){setError(err instanceof Error?err.message:'无法读取这个备份，原来的记录没有被修改。');}finally{setBusy(false);}
 }
 const done=data.projects.filter(p=>p.status==='done').length;
 const shown=data.projects.filter(p=>(filter==='all'||p.status===filter)&&(p.title+p.category+p.materials).toLowerCase().includes(query.toLowerCase()));
 const nav=[{id:'book',icon:BookOpen,label:'我的手作本'},{id:'ideas',icon:Lightbulb,label:'灵感小罐'},{id:'gift',icon:Gift,label:'生日小笺'}];
 const changeTab=(id:string)=>{if(id===tab&&!selected)return;const direction=nav.findIndex(n=>n.id===id)<nav.findIndex(n=>n.id===tab)?'backward':'forward';turn(()=>{setTab(id);setSelected(null);setEntryPage(0);},direction);};
 const openProject=(id:string)=>turn(()=>{setEntryPage(0);setSelected(id);});
 const backToBook=()=>turn(()=>setSelected(null),'backward');
 const pageIndex=project?Math.min(entryPage,Math.max(0,project.entries.length-1)):nav.findIndex(n=>n.id===tab);
 const pageCount=project?Math.max(1,project.entries.length):nav.length;
 const flip=(direction:-1|1)=>{const next=pageIndex+direction;if(next<0||next>=pageCount)return;if(project)turn(()=>setEntryPage(next),direction===1?'forward':'backward');else changeTab(nav[next].id);};
 return <div className="app-shell journal-book">
  <div className="journal-binding" aria-hidden="true">{Array.from({length:8},(_,i)=><span key={i}/>)}</div>
  <aside className="sidebar"><a className="brand" href="./" aria-label="慢慢造物首页"><span className="brand-mark"><Leaf size={25}/></span><span>慢慢造物<small>A LITTLE MADE BY YOU</small></span></a>
   <div className="sidebar-label">CONTENTS · 手账目录</div>
   <nav>{nav.map(({id,icon:Icon,label})=><button key={id} className={'nav-item '+(tab===id?'active':'')} onClick={()=>changeTab(id)}><Icon size={19}/>{label}{id==='gift'&&<span className="tiny-dot"/>}</button>)}</nav>
   <div className="side-doodle"><Flower2 size={38} strokeWidth={1}/><p>一针一线，一点一滴。<br/>喜欢的事，都值得被记住。</p></div>
   <div className="sidebar-bottom"><button onClick={()=>setModal('install')}><Smartphone size={17}/> 把手作本装进口袋 <ChevronRight size={14}/></button><div className="made-with"><Heart size={12}/> 为盘成勤，认真准备</div></div>
  </aside>
  <div className="main-wrap"><header className="topbar"><div className="mobile-brand"><Leaf size={21}/> 慢慢造物</div><span className="breadcrumb">我的小天地 <ChevronRight size={12}/> {nav.find(n=>n.id===tab)?.label}</span><div className="top-actions"><span className="save-status"><Cloud size={15}/>{busy?'正在保存':loading?'正在打开':error?'保存需重试':'本机已保存'}</span><span className="avatar">勤</span></div></header>
   <main className={'main journal-sheet '+motion} onTouchStart={e=>{swiped.current=false;const target=e.target as Element;if(target.closest('input,textarea,select,a')||modal){swipeStart.current=null;return;}const t=e.touches[0];swipeStart.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{const start=swipeStart.current;swipeStart.current=null;if(!start)return;const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5){swiped.current=true;if(e.cancelable)e.preventDefault();flip(dx<0?1:-1);}}} onClickCapture={e=>{if(swiped.current){e.preventDefault();e.stopPropagation();swiped.current=false;}}}>
    <div className="journal-running-head"><span>{project?'CRAFT STORIES':tab==='ideas'?'LITTLE INSPIRATIONS':tab==='gift'?'A LETTER FOR YOU':'MY HANDMADE JOURNAL'}</span><time>{today().replaceAll('-',' · ')}</time></div>
    {error&&<div className="error-banner" role="alert"><span>{error}</span>{!modal&&<button onClick={()=>void load()}>重新打开</button>}</div>}
    {tab==='book'&&!selected&&<>
     <div className="page-heading"><div><div className="eyebrow">A LITTLE EVERYDAY, A LITTLE HANDMADE</div><h1>盘成勤的手作本<span className="hand-spark">✳</span></h1><p>留住动手的时光，也留住那些小小的成就感。</p></div><button className="primary" onClick={()=>start('project')} disabled={loading||!!error||draftLoading}><Plus size={18}/> 新建手作</button></div>
     {data.projects.length===0&&<section className="hero"><div className="hero-copy"><span className="tagline"><span/> 给热爱创造的你</span><h2>把喜欢的事，<br/>慢慢做成<span>。</span></h2><p>从一个小小的念头，到一件独一无二的作品。<br className="desktop"/>每一步，都有值得收藏的故事。</p><button className="hero-link" onClick={()=>start('project')} disabled={loading||!!error}>{data.projects.length?'今天，继续创造一点美好':'从第一件手作开始'} <ArrowRight size={17}/></button></div><div className="hero-art"><CraftArt/><span className="art-note">made with time & love</span></div><span className="hero-corner">NO HURRY. JUST CREATE.</span></section>}
     <section className="storage-notice"><Smartphone size={16}/><p>照片和文字保存在这台手机。{offlineReady?'断网也能打开记录。':offlineProblem?'离线打开暂未准备好，请先联网使用。':'正在准备离线打开…'}<button onClick={()=>setModal('backup')}>{(data.projects.length||data.ideas.length)&&(!lastBackup||Date.now()-new Date(lastBackup).getTime()>7*86400000)?'记得导出一份备份':'备份与恢复'} <ArrowRight size={12}/></button></p></section><div className="collection-header"><h2>我的作品<span>{data.projects.length}</span></h2><div className="stat-text"><span>{data.projects.length-done} 进行中</span><i/> <span>{done} 已完成</span></div></div>
     <div className="collection-tools"><div className="filters">{[['all','全部手作'],['making','慢慢制作中'],['done','已经完成啦']].map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div><div className="search"><Search size={16}/><input aria-label="搜索手作" placeholder="找一件手作…" value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
     {loading?<div className="loading"><LoaderCircle className="spin"/> 正在翻开你的手作本…</div>:data.projects.length===0?<div className="empty-layout"><button className="empty-create" onClick={()=>start('project')} disabled={!!error}><span className="empty-icon"><Plus size={26} strokeWidth={1.5}/></span><h3>第一件作品，会是什么呢？</h3><p>编织、黏土、布艺，或任何让你开心的小东西。<br/>不用准备好，开始就很好。</p><span className="text-cta">写下我的第一个小计划 <ArrowRight size={16}/></span></button><div className="starting-note"><span className="tape"/><span className="eyebrow">A SMALL REMINDER</span><Scissors size={27} strokeWidth={1.2}/><h3>不必完美，<br/>亲手做的就很珍贵。</h3><p>这里也欢迎歪歪的针脚、<br/>失败的小尝试，和突然冒出的灵感。</p><span className="note-flower">✻</span></div></div>:shown.length?<div className="project-grid">{shown.map((p,i)=>{const cover=p.entries.flatMap(e=>e.photos)[0];return <button key={p.id} className="project-card" onClick={()=>openProject(p.id)}><div className={'project-cover color-'+i%3}>{cover?<LocalPhoto id={cover} alt={p.title+'的过程照片'}/>:<><Scissors size={52} strokeWidth={1}/><span>亲手做，慢慢来</span></>}<span className={'status-pill '+p.status}>{p.status==='done'?<Check size={12}/>:<span/>}{p.status==='done'?'已完成':'制作中'}</span></div><div className="project-info"><small>{p.category}</small><h3>{p.title}</h3><p>{p.entries.length} 段过程 · {p.created.replaceAll('-','.')} 开始<ArrowRight size={16}/></p></div></button>;})}</div>:<div className="no-results"><Search size={28}/><p>还没有找到这件手作，换个关键词试试。</p></div>}
     <div className="footer-note"><span>✦</span> 慢一点也没关系，你的热爱自有它的节奏。<span>✦</span></div>
    </>}
    {tab==='book'&&project&&<>
     <button className="back" onClick={backToBook}><ArrowLeft size={17}/> 回到手作本</button><div className="page-heading detail-heading"><div><div className="eyebrow">{project.category} / {project.created.replaceAll('-','.')} 开始</div><h1>{project.title}</h1><p>{project.status==='done'?'这份小小的美好，已经被你做出来了。':'不着急，慢慢把想法变成手里的模样。'}</p></div><button className="primary" onClick={()=>start('entry')} disabled={busy}><Plus size={18}/> 记录新进展</button></div>
     <div className="detail-grid"><section className="timeline"><div className="section-title"><h2>制作的足迹</h2><span>{project.entries.length?String(pageIndex+1).padStart(2,'0')+' / '+String(project.entries.length).padStart(2,'0')+' 段':'新的故事，从这里开始'}</span></div>{project.entries.length===0?<div className="timeline-empty"><Camera size={36} strokeWidth={1}/><h3>给开始的这一刻，留个纪念</h3><p>拍下材料、写个想法，或记住今天的心情。</p><button className="secondary" onClick={()=>start('entry')}>添加第一条记录 <ArrowRight size={16}/></button></div>:project.entries.map((entry,index)=>index===pageIndex&&<article className="entry" key={entry.id}><div className="entry-dot"/><div className="entry-meta"><span>第 {String(index+1).padStart(2,'0')} 个脚印</span><time>{entry.date.replaceAll('-','.')}</time></div>{entry.text&&<p className="preserve">{entry.text}</p>}{entry.photos.length>0&&<div className="entry-photos">{entry.photos.map((id,i)=><button key={id} onClick={()=>setLightbox(id)} aria-label={'放大第'+(i+1)+'张照片'}><LocalPhoto id={id} alt={'第'+(index+1)+'条手作记录的照片 '+(i+1)}/></button>)}</div>}<button className="entry-edit" disabled={busy} onClick={()=>void start('entry',entry)}>修改这条记录 <ChevronRight size={13}/></button></article>)}</section><aside className="detail-side"><section className="materials"><span className="eyebrow">BEFORE WE BEGIN</span><h2><Scissors size={19}/> 材料与小计划</h2><p className="preserve">{project.materials||'还没有写下材料。记录过程中也可以随时回顾自己的小计划。'}</p></section><section className="summary-card"><CheckCheck size={26}/><h2>完成之后，留点心得</h2><p className="preserve">{project.summary||'哪里做得很开心？有什么下次想试试？把这些小收获也记下来。'}</p><button className="secondary" onClick={()=>start('summary')}>{project.summary?'修改心得':'写下心得'} <ArrowRight size={16}/></button><span className="summary-status">{project.status==='done'?'✓ 这件手作已完成':'目前正在慢慢制作中'}</span></section><button className="delete-link" onClick={()=>void removeProject()} disabled={busy}><Trash2 size={14}/> 删除这件手作</button></aside></div>
    </>}
    {tab==='ideas'&&<><div className="page-heading"><div><div className="eyebrow">LITTLE THOUGHTS, FUTURE CREATIONS</div><h1>灵感小罐<span className="hand-spark">✳</span></h1><p>先把一闪而过的念头收好，某一天它会发芽。</p></div><button className="primary" onClick={()=>start('idea')} disabled={loading||!!error}><Plus size={18}/> 收集一个灵感</button></div><div className="idea-banner"><Lightbulb size={32} strokeWidth={1.3}/><p>想做的颜色、看到的形状、突然想到的小礼物。<br/>这里不用有完整的计划，一句话就足够。</p></div>{!data.ideas.length?<button className="idea-empty" onClick={()=>start('idea')} disabled={loading||!!error}><Sparkles size={35} strokeWidth={1}/><h2>给下一个小念头，留一个位置</h2><p>点这里，存下今天的第一个灵感。</p></button>:<div className="ideas-grid">{data.ideas.map((idea,index)=><article className={'idea-card color-'+index%3} key={idea.id}><span className="idea-number">IDEA {String(data.ideas.length-index).padStart(2,'0')}</span><p className="preserve">{idea.text}</p><div><time>{idea.date.replaceAll('-','.')}</time><button aria-label="删除这个灵感" className="icon-button" disabled={busy} onClick={()=>{if(window.confirm('确定移除这个灵感吗？'))void persist({...data,ideas:data.ideas.filter(i=>i.id!==idea.id)});}}><Trash2 size={15}/></button></div></article>)}</div>}</>}
    {tab==='gift'&&<><div className="gift-heading"><span className="eyebrow">A BELATED BIRTHDAY GIFT, WITH LOVE</span><h1>给盘成勤的一封小笺</h1><p>有些心意，值得认真地补上。</p></div><section className="letter"><div className="letter-top"><span>TO. 盘成勤</span><Flower2 size={35} strokeWidth={1}/></div><h2>生日祝福晚了一点，<br/>心意没有。</h2><div className="letter-body"><p>盘成勤，生日快乐呀。</p><p>一直觉得，能把一个念头变成一件真实的小东西，是一件特别厉害、也特别可爱的事。</p><p>所以，给你准备了这个小小的角落。以后做手工时，可以拍几张照片，写下当时的想法，把从“想试试看”到“真的做出来了”的过程，都好好留下来。</p><p>不只有完成的作品值得收藏。尝试、返工、突然想通的瞬间，还有那些不太完美的细节，都是属于你的故事。</p><p>愿你一直有动手的兴致，有慢慢来的自由，也总能在喜欢的事情里，找到自己的快乐。</p><p className="letter-wish">新的一岁，继续创造小小的美好吧。</p></div><div className="letter-sign"><span>一个想认真补上祝福的朋友</span><Heart size={20} strokeWidth={1.3}/></div><div className="stamp">HANDMADE<br/><Heart size={17}/><br/>WITH LOVE</div></section><p className="gift-foot">这份礼物，会陪着新的作品一起慢慢长大。</p></>}
    <nav className="journal-pager" aria-label="手账翻页"><button onClick={()=>flip(-1)} disabled={pageIndex===0||!!motion} aria-label="上一页"><ArrowLeft size={17}/><span>上一页</span></button><div className="folio" aria-live="polite"><span>{project?'制作的足迹':'慢慢造物'}</span><strong>第 {pageIndex+1} 页 <i>/</i> {pageCount} 页</strong></div><button onClick={()=>flip(1)} disabled={pageIndex===pageCount-1||!!motion} aria-label="下一页"><span>下一页</span><ArrowRight size={17}/></button></nav><div className="swipe-hint">轻轻左右滑动，也可以翻页 <span>↔</span></div><footer className="page-footer"><span>慢慢造物 · 留住每一次创造</span><div><button onClick={()=>setModal('backup')} disabled={loading||busy}><ArrowDownToLine size={14}/>备份与恢复</button><button onClick={()=>setModal('install')}><Smartphone size={14}/> 保存到手机</button></div></footer>
   </main>
  </div>
  <nav className="mobile-nav" aria-label="手机导航">{nav.map(({id,icon:Icon,label})=><button key={id} className={tab===id?'active':''} onClick={()=>changeTab(id)}><Icon size={21}/><span>{label.replace('我的','')}</span></button>)}</nav>
  {notice&&<div className="toast" role="status"><Check size={17}/>{notice}</div>}
  {modal&&<Dialog title={{project:'开始一件新的手作',entry:'记录一个小小的进展',summary:'把收获也收藏起来',idea:'收好一个新灵感',install:'把手作本装进口袋',backup:'给记录留一份备份'}[modal]} onClose={()=>{void closeModal();}} busy={busy||uploading}>
   {error&&<div className="form-error" role="alert">{error}</div>}{['project','entry','summary','idea'].includes(modal)&&<p className="draft-status" role="status">{draftStatus||'填写的内容会自动保留为本机草稿'}</p>}
   {modal==='project'&&<form ref={draftForm} onChange={()=>keepDraft()} onSubmit={saveProject}><p className="form-intro">给它起个名字，故事就从这里开始。</p><label>作品的名字<input name="title" defaultValue={draftValues.title??''} required autoFocus maxLength={80} placeholder="比如：一只装满春天的小布包"/></label><label>属于哪一类<select name="category" defaultValue={draftValues.category??categories[0]} onChange={e=>setCategorySelection(e.target.value)}>{categoryOptions.map(c=><option key={c}>{c}</option>)}<option value={customCategoryOption}>＋ 自定义类型</option></select></label>{categorySelection===customCategoryOption&&<label>自定义类型名称<input name="customCategory" defaultValue={customCategory} onChange={e=>setCustomCategory(e.target.value)} required maxLength={30} placeholder="比如：皮具、滴胶、首饰…"/></label>}<label>材料 / 想法 <span>选填</span><textarea name="materials" defaultValue={draftValues.materials??''} maxLength={2000} rows={4} placeholder="准备用什么？有什么小小的期待？"/></label><button className="primary form-submit" disabled={busy}>{busy?<LoaderCircle className="spin" size={18}/>:<Plus size={18}/>} 开始记录</button></form>}
   {modal==='entry'&&<form ref={draftForm} onInput={()=>keepDraft()} onSubmit={saveEntry}><label>这一天<input name="date" type="date" required defaultValue={draftValues.date??today()}/></label><label>今天做了什么 <span>文字、照片，选一种也可以</span><textarea name="text" defaultValue={draftValues.text??''} autoFocus maxLength={10000} rows={5} placeholder="做到哪一步了？遇到了什么有意思的事？"/></label><div className="photo-picker"><label className="upload-button"><ImagePlus size={20}/>{uploading?'正在保存照片…':'从相册选照片'}<input type="file" accept="image/*" multiple disabled={uploading||busy} onChange={e=>{void upload(e.target.files);e.target.value='';}}/></label><label className="upload-button"><Camera size={20}/> 直接拍一张<input type="file" accept="image/*" capture="environment" disabled={uploading||busy} onChange={e=>{void upload(e.target.files);e.target.value='';}}/></label></div><p className="photo-help">每条最多 12 张 · 自动缩小照片，节省手机空间</p>{photos.length>0&&<div className="photo-previews">{photos.map(id=><div key={id}><LocalPhoto id={id} alt="待保存的过程照片"/><button type="button" aria-label="移除这张照片" disabled={uploading||busy} onClick={()=>{const next=photos.filter(i=>i!==id);setPhotos(next);keepDraft(next);}}><X size={13}/></button></div>)}</div>}<button className="primary form-submit" disabled={busy||uploading}>{busy||uploading?<LoaderCircle size={18} className="spin"/>:<Check size={18}/>} 保存这段过程</button></form>}
   {modal==='summary'&&project&&<form ref={draftForm} onInput={()=>keepDraft()} onSubmit={saveSummary}><p className="form-intro">成功的小窍门和绕过的小弯路，都值得记住。</p><label>这次的小收获<textarea name="summary" autoFocus maxLength={10000} rows={7} defaultValue={draftValues.summary??project.summary} placeholder="最喜欢哪里？学会了什么？下次想怎么做？"/></label><label className="checkbox"><input type="checkbox" name="completed" defaultChecked={Object.keys(draftValues).length?draftValues.completed==='on':project.status==='done'}/> 这件手作已经完成啦</label><button className="primary form-submit" disabled={busy}><Check size={18}/> 保存心得</button></form>}
   {modal==='idea'&&<form ref={draftForm} onInput={()=>keepDraft()} onSubmit={saveIdea}><p className="form-intro">不用想清楚，先留住它。</p><label>刚刚想到什么<textarea name="text" defaultValue={draftValues.text??''} autoFocus required maxLength={2000} rows={6} placeholder="想试试把旧衣服做成一个小零钱包…"/></label><button className="primary form-submit" disabled={busy}><Plus size={18}/> 放进灵感罐</button></form>}
   {modal==='backup'&&<div className="backup-guide"><p>完整备份包含作品、每段过程、照片和灵感。把文件保存到手机「文件」、网盘或其他安全的位置，换手机后可再导入。</p><div className="backup-last">{lastBackup?'最近导出：'+new Date(lastBackup).toLocaleString('zh-CN'):'还没有导出过备份'}<small>未保存的草稿不包含在备份中；请先保存到作品。</small></div><button className="primary form-submit" disabled={busy||loading||!!error} onClick={()=>void exportBackup()}><ArrowDownToLine size={18}/>{busy?'正在打包文字和照片…':'导出完整备份'}</button><button className="secondary form-submit" disabled={busy||loading} onClick={()=>restoreInput.current?.click()}>从备份文件恢复</button><input className="sr-only" ref={restoreInput} type="file" accept=".json,application/json" onChange={e=>{void importBackup(e.target.files?.[0]);e.target.value='';}}/><div className="install-tip">导出后，请确认文件已经保存好。清除浏览器数据、卸载浏览器或更换手机，可能会移除本机记录；网站和 GitHub 不会自动保存一份副本。</div></div>}
   {modal==='install'&&<div className="install-guide"><span className="install-icon"><Leaf size={34}/></span><p>像打开一个小应用一样，<br/>随时回到你的创作角落。</p><h3>苹果手机 · Safari 浏览器</h3><p>打开网站后，轻点底部的「分享」按钮，选择「添加到主屏幕」，再点「添加」。添加后，请在桌面图标里开始正式记录；如果看不到原浏览器的记录，可先备份、再导入。</p><h3>安卓手机 · Chrome 等浏览器</h3><p>打开右上角菜单，选择「添加到主屏幕」或「安装应用」。不同浏览器的名称可能略有不同。</p><div className="install-tip">从微信收到链接时，先用右上角菜单选择在浏览器中打开。第一次打开需要联网；页面准备好以后，断网也能记。照片和文字只保存在这台手机中，请定期导出完整备份，清除浏览器数据或更换手机前先备份。</div></div>}
  </Dialog>}
  {lightbox&&<Dialog title="手作的一个瞬间" onClose={()=>setLightbox(null)}><LocalPhoto id={lightbox} alt="放大的手作过程照片" large/></Dialog>}
 </div>;
}
