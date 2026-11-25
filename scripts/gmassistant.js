import {uid,esc} from './model.js';
import {button,field,selectField} from './view.js';
import {preserveImages} from './notes.js';
const ID='telys-fates-atlas';
const enc=encodeURIComponent;
export function connection(){return game.settings.get(ID,'gmaConnection')||{};}
export function bridgeAddress(value){
 const u=new URL(value||'http://127.0.0.1:43127');
 if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Use the local companion address, such as http://127.0.0.1:43127.');
 return u.origin;
}
export class GMAClient {
 constructor(config=connection()){this.base=bridgeAddress(config.url);this.token=config.token||'';if(!this.token)throw Error('Connect the GM Assistant companion first.');}
 async get(path,{optional=false}={}){
  let r;
  try{r=await fetch(this.base+path,{headers:{'X-Atlas-Token':this.token},cache:'no-store',signal:AbortSignal.timeout(55000)});}catch{throw Error('Cannot reach the local GM Assistant companion. Start it on this computer and check the Foundry origin and browser local-network permission.');}
  if(optional&&r.status===404)return null;
  if(r.status===429){const retry=r.headers.get('Retry-After');throw Error(`GM Assistant rate limit reached.${retry?` Try again after ${retry} seconds.`:' Wait before retrying.'}`);}
  let data;try{data=await r.json();}catch{throw Error('The companion returned an invalid response.');}
  if(!r.ok)throw Error(typeof data.error==='string'?data.error:data.error?.message||`GM Assistant request failed (${r.status}).`);
  return data;
 }
 async list(path){
  let all=[],cursor=null;const seen=new Set();
  for(let page=0;page<100;page++){
   const next=path+(path.includes('?')?'&':'?')+'limit=100'+(cursor?'&cursor='+enc(cursor):'');
   const response=await this.get(next);if(!Array.isArray(response.data))throw Error('GM Assistant returned an invalid list.');all.push(...response.data);
   if(all.length>2000)throw Error('This collection exceeds the 2,000-record import limit.');
   if(!response.page?.has_more)return all;
   cursor=response.page.next_cursor;if(!cursor||seen.has(cursor))throw Error('GM Assistant returned an invalid pagination cursor.');seen.add(cursor);
  }
  throw Error('Too many pages from GM Assistant.');
 }
 campaigns(){return this.list('/v1/campaigns');}
 sessions(campaign){return this.list(`/v1/campaigns/${enc(campaign)}/sessions?fields=id,title,played_at,order,updated_at`);}
 async document(campaign,session,format='longform'){
  if(!['longform','recap','notes','scenes'].includes(format))throw Error('Unknown notes format.');
  const base=`/v1/campaigns/${enc(campaign)}/sessions/${enc(session.id)}`;
  const parts=[];
  if(session.played_at)parts.push(`Session date: ${session.played_at}`);
  if(['longform','recap'].includes(format)){const r=await this.get(base+'/recaps/default',{optional:true});if(r?.text)parts.push('## Recap\n\n'+r.text);}
  if(['longform','notes'].includes(format)){const r=await this.get(base+'/notes');if(r?.text)parts.push('## Campaign Notes\n\n'+r.text);}
  if(['longform','scenes'].includes(format)){
   const scenes=await this.list(base+'/scenes?fields=id,title,description,key_events,order');
   if(scenes.length)parts.push('## Scene Outline\n\n'+scenes.map(s=>`### ${s.title||'Untitled scene'}\n\n${s.description||''}${s.key_events?.length?'\n\n'+s.key_events.map(e=>'- '+e).join('\n'):''}`).join('\n\n'));
  }
  const hasContent=parts.some(p=>p.startsWith('## '));
  const body=hasContent?parts.join('\n\n'):'';
  if(body.length>500000)throw Error(`The notes for ${session.title} exceed 500,000 characters.`);
  return {id:session.id,name:session.title||'Untitled session',body,format};
 }
}
export function digest(text){let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return (a>>>0).toString(16)+(b>>>0).toString(16);}
export function sourceKey(campaign,session){return `${campaign}:${session}`;}
export function sourceHash(doc){return digest(doc.name+'\n'+doc.body);}
function freePosition(planet,x,y,chapter,ignore=new Set()){
 const originalX=x,originalY=y;
 while(planet.events.some(other=>!ignore.has(other.id)&&(other.parentChapter||'')===chapter&&Math.abs(other.x-x)<260&&Math.abs(other.y-y)<155)){
  x+=300;if(x>19740){x=40;y+=190;}if(y>9850)throw Error('No free timeline space remains. Choose a different row or chapter.');
 }
 return {x,y,separated:x!==originalX||y!==originalY};
}
export function applyImport(data,docs,placements,options){
 const next=structuredClone(data);const linked=new Set(next.planets.flatMap(p=>p.events.filter(e=>e.source?.service==='gmassistant').map(e=>sourceKey(e.source.campaignId,e.source.sessionId))));
 let added=0,skipped=0,separated=0,previous=null;
 docs.forEach((doc,i)=>{
  const row=placements[i];if(!row?.include||!doc.body){skipped++;return;}
  const key=sourceKey(options.campaignId,doc.id);if(linked.has(key)){skipped++;return;}
  const planet=next.planets.find(p=>p.id===row.planetId);if(!planet)throw Error('Choose a world for every selected session.');
  const chapter=row.chapterId||'';if(chapter&&!planet.events.some(e=>e.id===chapter&&e.kind==='chapter'))throw Error('A selected chapter no longer exists.');
  let x=Number(row.x),y=Number(row.y);if(!Number.isFinite(x)||!Number.isFinite(y)||x<40||x>20000||y<90||y>10000)throw Error('Timeline positions must be between X 40–20000 and Y 90–10000.');
  const event={id:uid(),kind:'quest',name:(options.prefix||'')+doc.name,chapter:options.campaignName||'',parentChapter:chapter,description:doc.body,thumbnail:'',picture:'',type:row.type||options.type,status:options.status||'complete',x,y,parents:[],source:{service:'gmassistant',campaignId:options.campaignId,sessionId:doc.id,format:doc.format,hash:sourceHash(doc),prefix:options.prefix||'',lastSync:new Date().toISOString()}};
  if(options.separateOverlaps!==false){const position=freePosition(planet,event.x,event.y,chapter);event.x=position.x;event.y=position.y;if(position.separated)separated++;}
  if(options.connect&&previous&&previous.planetId===planet.id&&previous.chapterId===chapter)event.parents=[previous.id];
  planet.events.push(event);previous={id:event.id,planetId:planet.id,chapterId:chapter};linked.add(key);added++;
 });
 return {data:next,added,skipped,separated};
}
export function applyResync(data,documents){
 const next=structuredClone(data);let updated=0,unchanged=0;
 for(const p of next.planets)for(const e of p.events){
  if(e.source?.service!=='gmassistant')continue;
  const doc=documents.get(sourceKey(e.source.campaignId,e.source.sessionId));if(!doc)continue;
  if(e.source.hash===sourceHash(doc)){unchanged++;continue;}
  const body=preserveImages(e.description,doc.body);if(body.length>500000)throw Error(`Updated notes for ${doc.name} exceed 500,000 characters.`);e.description=body;e.name=(e.source.prefix||'')+doc.name;e.source.hash=sourceHash(doc);e.source.lastSync=new Date().toISOString();updated++;
 }
 return {data:next,updated,unchanged};
}

export const COMPANION_LAUNCH_URI='tely-fates-atlas://open-companion';
export function launchCompanionLink(){
 const link=document.createElement('a');link.href=COMPANION_LAUNCH_URI;link.style.display='none';
 document.body.append(link);link.click();link.remove();
}
export async function openCompanion(config,status,launch=launchCompanionLink){
 const base=bridgeAddress(config.url);
 if(config.token){
  try{
   const response=await fetch(base+'/open',{method:'POST',headers:{'X-Atlas-Token':config.token},cache:'no-store',signal:AbortSignal.timeout(1200)});
   if(response.ok){status.textContent='Companion window requested. Check your taskbar if it is behind Foundry.';return 'running';}
  }catch{/* A closed companion is launched through its registered Windows app link. */}
 }
 launch();
 status.textContent='Requested the companion through its Windows app link. If prompted, choose Open. If nothing opens, run Start-Windows.bat once and click Enable Atlas launch button (Windows).';
 return 'launch';
}

const formats=[['longform','Long-form: full recap + notes + scene outline'],['recap','Full recap only'],['notes','Session notes only'],['scenes','Scene outline only']];
export function openGMA(app){
 if(!game.user.isGM)return;
 const config=connection();
 const {form}=app.modal('Import from GM Assistant',`<p>Connect the local companion, select your campaign, then choose the world and timeline position for each session.</p>${field('url','Companion address',config.url||'http://127.0.0.1:43127')}${field('token','Companion pairing token',config.token||'','password','autocomplete="off"')}<p class="fa-muted">Run companion/Start-Windows.bat from this module on your computer. Use its setup window to paste your Foundry URL and read API key, then click Start companion. Copy its pairing token here.</p><div class="fa-inline-buttons">${button('open-companion','Open companion')}${button('connect-gma','Connect / Load campaigns')}${button('disconnect-gma','Disconnect')}${button('resync-gma','Resync all linked notes')}${button('manage-gma','Linked notes')}</div><label class="fa-field"><span>Campaign</span><select name="campaign" aria-label="Campaign"><option value="">Connect to load your campaigns</option></select></label>${selectField('format','Notes to fetch', 'longform',formats)}<p class="fa-gma-status" role="status"></p><details class="fa-launch-help"><summary>First-time Open companion setup</summary><p>Run companion/Start-Windows.bat once and click Enable Atlas launch button (Windows). Then Open companion can launch its setup window here, even when it is closed. An already connected companion is brought to the front. Allow the Windows app prompt if one appears.</p></details>`,null,button('fetch-gma','Fetch campaign notes','class="fa-primary"'));
 let client,campaigns=[];
 const status=form.querySelector('.fa-gma-status'),error=form.querySelector('.fa-error');
 let busy=false;
 form.addEventListener('click',async ev=>{
  const cmd=ev.target.closest('[data-cmd]')?.dataset.cmd;if(!['open-companion','connect-gma','disconnect-gma','fetch-gma','resync-gma','manage-gma'].includes(cmd)||busy)return;
  error.textContent='';busy=true;
  const buttons=[...form.querySelectorAll('[data-cmd]')].filter(b=>b.dataset.cmd!=='cancel');buttons.forEach(b=>b.disabled=true);
  try{
   if(cmd==='open-companion')return await openCompanion({url:form.elements.url.value,token:form.elements.token.value.trim()},status);
   if(cmd==='manage-gma')return manageLinkedGMA(app);
   if(cmd==='disconnect-gma'){await game.settings.set(ID,'gmaConnection',{});form.elements.token.value='';form.elements.campaign.innerHTML='<option value="">Disconnected</option>';status.textContent='Disconnected. Stop the companion window to end its connection.';client=null;return;}
   if(cmd==='connect-gma'){
    client=new GMAClient({url:form.elements.url.value,token:form.elements.token.value.trim()});status.textContent='Connecting…';campaigns=await client.campaigns();
    await game.settings.set(ID,'gmaConnection',{url:client.base,token:client.token});
    form.elements.campaign.innerHTML=campaigns.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')||'<option value="">No campaigns found</option>';
    status.textContent=`Connected. ${campaigns.length} campaign(s) available.`;
   }
   if(cmd==='resync-gma')return await resyncGMA(app,status);
   if(cmd==='fetch-gma'){
    if(!client||!form.elements.campaign.value)throw Error('Connect and choose a campaign first.');
    if(!app.data.planets.length)throw Error('Add at least one planet to the atlas first.');
    const campaign=campaigns.find(c=>c.id===form.elements.campaign.value),format=form.elements.format.value;
    status.textContent='Listing sessions…';const sessions=await client.sessions(campaign.id);const docs=[];
    for(const [i,s] of sessions.entries()){status.textContent=`Fetching ${i+1}/${sessions.length}: ${s.title}`;docs.push(await client.document(campaign.id,s,format));if(!form.isConnected)return;}
    placementGMA(app,docs,{campaignId:campaign.id,campaignName:campaign.title});
   }
  }catch(err){error.textContent=err.message;status.textContent='';}
  finally{busy=false;buttons.forEach(b=>b.disabled=false);}
 });
}
export function linkedNotes(data){
 return data.planets.flatMap(planet=>planet.events.filter(event=>event.source?.service==='gmassistant').map(event=>({planet,event,chapter:planet.events.find(c=>c.id===event.parentChapter&&c.kind==='chapter')})));
}
export function moveLinkedNotes(data,placements,{separateOverlaps=true}={}){
 const next=structuredClone(data),moved=new Set(),pending=new Set(placements.filter(row=>row.include).map(row=>row.eventId));let separated=0;
 for(const row of placements){
  if(!row.include)continue;
  if(moved.has(row.eventId))throw Error('The same linked note was selected twice.');
  const from=next.planets.find(p=>p.events.some(e=>e.id===row.eventId&&e.source?.service==='gmassistant'));
  if(!from)throw Error('A linked note no longer exists. Reopen Linked notes and try again.');
  const destination=next.planets.find(p=>p.id===row.planetId);
  if(!destination)throw Error('Choose a valid destination world.');
  const chapter=row.chapterId||'';
  if(chapter&&!destination.events.some(e=>e.id===chapter&&e.kind==='chapter'))throw Error('Choose a chapter in the destination world.');
  let x=Number(row.x),y=Number(row.y);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<40||x>20000||y<90||y>10000)throw Error('Positions must be X 40–20000 and Y 90–10000.');
  const index=from.events.findIndex(e=>e.id===row.eventId),event=from.events[index];
  if(from!==destination){from.events.splice(index,1);destination.events.push(event);}
  pending.delete(event.id);
  if(separateOverlaps){
   const position=freePosition(destination,x,y,chapter,new Set([...pending,event.id]));x=position.x;y=position.y;if(position.separated)separated++;
  }
  event.parentChapter=chapter;event.x=x;event.y=y;
  if(row.type)event.type=row.type;
  moved.add(event.id);
 }
 // Keep links between notes moved together; remove only links that now cross a world or chapter boundary.
 const scopes=new Map(next.planets.flatMap(p=>p.events.map(e=>[e.id,p.id+':'+(e.parentChapter||'')])));
 for(const p of next.planets)for(const e of p.events)e.parents=e.parents.filter(id=>!(moved.has(e.id)||moved.has(id))||scopes.get(id)===scopes.get(e.id));
 return {data:next,moved:moved.size,separated};
}
export function capturePlacementRows(container,rows){
 for(const holder of container.querySelectorAll('[data-row]')){
  const i=Number(holder.dataset.row),row=rows[i];if(!row)continue;
  const value=name=>holder.querySelector(`[name="${name}-${i}"]`);
  if(value('include')&&!value('include').matches(':disabled'))row.include=value('include').checked;
  if(value('world')&&!value('world').matches(':disabled'))row.planetId=value('world').value;
  if(value('chapter')&&!value('chapter').matches(':disabled'))row.chapterId=value('chapter').value;
  if(value('type')&&!value('type').matches(':disabled'))row.type=value('type').value;
  if(value('x')&&!value('x').matches(':disabled'))row.x=Number(value('x').value);
  if(value('y')&&!value('y').matches(':disabled'))row.y=Number(value('y').value);
 }
 return rows;
}
function chapters(planet){return [['','Planet overview'],...planet.events.filter(e=>e.kind==='chapter').map(e=>[e.id,e.name])];}
function changeRowWorld(holder,i,planet){
 const select=holder.querySelector(`[name="chapter-${i}"]`);
 select.innerHTML=chapters(planet).map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');
}
function placementGMA(app,docs,campaign){
 const base=app.data.revision,data=structuredClone(app.data),planets=data.planets;
 const existing=new Map(linkedNotes(data).map(record=>[sourceKey(record.event.source.campaignId,record.event.source.sessionId),record]));
 const initialChapter=app.planet.events.some(e=>e.id===app.view.chapter&&e.kind==='chapter')?app.view.chapter:'';
 const rows=docs.map((doc,i)=>{const record=existing.get(sourceKey(campaign.campaignId,doc.id));return {include:!!doc.body&&!record,planetId:record?.planet.id||app.planet.id,chapterId:record?record.event.parentChapter||'':initialChapter,x:record?.event.x??260+(i%59)*330,y:record?.event.y??240+Math.floor(i/59)*220,type:record?.event.type||data.types[0].id,customized:false};});
 const {form}=app.modal(`Place campaign notes — ${campaign.campaignName}`,`<p>Defaults apply immediately to sessions without individual changes. Each session’s destination below is what will be saved. Changing one session does not change the others.</p><div class="fa-two-col">${selectField('world','Default world',app.planet.id,planets.map(p=>[p.id,p.name]))}${selectField('chapter','Default chapter',initialChapter,chapters(app.planet))}${selectField('type','Default classification',data.types[0].id,data.types.map(t=>[t.id,t.name]))}${selectField('status','Quest status','complete',[['complete','Completed'],['available','Available'],['active','In progress']])}${field('startX','First horizontal position',260,'number','min="40" max="20000"')}${field('y','Vertical position',240,'number','min="90" max="10000"')}${field('spacing','Horizontal spacing',330,'number','min="260" max="2000"')}${field('prefix','Title prefix (optional)','')}</div><label><input name="connect" type="checkbox" checked> Connect consecutive imported sessions</label><label><input name="separateOverlaps" type="checkbox" checked> Separate overlapping cards automatically</label>${button('apply-defaults','Apply defaults to all selected sessions')}<p class="fa-muted">Imported notes are visible to players. Already-linked sessions show their saved location and cannot be imported again. Use Linked notes to move them without duplicating or losing content.</p><div class="fa-placement-summary" role="status"></div><div class="fa-gma-rows"></div>`,async()=>{
  capturePlacementRows(form.querySelector('.fa-gma-rows'),rows);
  const result=applyImport(data,docs,rows,{...campaign,type:form.elements.type.value,status:form.elements.status.value,prefix:form.elements.prefix.value,connect:form.elements.connect.checked,separateOverlaps:form.elements.separateOverlaps.checked});
  if(!result.added)throw Error('Select at least one unlinked session with notes. Use Linked notes to move existing imports.');
  const first=result.data.planets.flatMap(p=>p.events.filter(e=>!data.planets.some(old=>old.events.some(v=>v.id===e.id))).map(e=>({planet:p,event:e})))[0];
  if(first){app.view.planet=first.planet.id;app.view.chapter=first.event.parentChapter||'';app.view.selected=first.event.id;app.scroll={left:Math.max(0,first.event.x*app.view.zoom-100),top:Math.max(0,first.event.y*app.view.zoom-100)};}
  await app.save(result.data,base);
  const counts=new Map();for(const p of result.data.planets){const n=p.events.filter(e=>!data.planets.some(old=>old.events.some(v=>v.id===e.id))).length;if(n)counts.set(p.name,(counts.get(p.name)||0)+n);}
  ui.notifications.info(`Imported ${result.added}: ${[...counts].map(([name,n])=>name+' ('+n+')').join(', ')}. Skipped ${result.skipped}.`);
 });
 form.noValidate=true;
 const summary=()=>{const counts=new Map();rows.forEach(row=>{if(row.include)counts.set(row.planetId,(counts.get(row.planetId)||0)+1);});form.querySelector('.fa-placement-summary').textContent='Will import: '+([...counts].map(([id,n])=>`${planets.find(p=>p.id===id)?.name}: ${n}`).join(' · ')||'no sessions selected');};
 const draw=()=>{
  const list=form.querySelector('.fa-gma-rows');list.innerHTML=docs.map((doc,i)=>{
   const row=rows[i],p=planets.find(p=>p.id===row.planetId),record=existing.get(sourceKey(campaign.campaignId,doc.id));
   return `<fieldset class="fa-gma-row" data-row="${i}"><legend><label><input name="include-${i}" type="checkbox" ${row.include?'checked':''} ${!doc.body||record?'disabled':''}> ${esc(doc.name)} ${record?'— already linked':!doc.body?'— no notes':''}</label></legend>${record?`<p class="fa-saved-location">Saved in ${esc(record.planet.name)} / ${esc(record.chapter?.name||'Planet overview')} — X ${record.event.x}, Y ${record.event.y}. Use Linked notes to locate or move this entry.</p>`:''}<fieldset class="fa-two-col fa-placement-fields" ${record?'disabled':''}>${selectField('world-'+i,'World for '+doc.name,row.planetId,planets.map(p=>[p.id,p.name]))}${selectField('chapter-'+i,'Chapter for '+doc.name,row.chapterId,chapters(p))}${field('x-'+i,'X',row.x,'number','min="40" max="20000"')}${field('y-'+i,'Y',row.y,'number','min="90" max="10000"')}${selectField('type-'+i,'Classification for '+doc.name,row.type,data.types.map(t=>[t.id,t.name]))}</fieldset><details><summary>Preview fetched notes (${doc.body.length.toLocaleString()} characters)</summary><pre>${esc(doc.body)}</pre></details></fieldset>`;
  }).join('');summary();
 };
 const applyDefaults=force=>{
  capturePlacementRows(form.querySelector('.fa-gma-rows'),rows);
  const start=Number(form.elements.startX.value),spacing=Number(form.elements.spacing.value),columns=Math.max(1,Math.floor((20000-start)/Math.max(1,spacing))+1);
  let n=0;rows.forEach(row=>{if(!row.include)return;const i=n++;if(row.customized&&!force)return;Object.assign(row,{planetId:form.elements.world.value,chapterId:form.elements.chapter.value,type:form.elements.type.value,x:start+(i%columns)*spacing,y:Number(form.elements.y.value)+Math.floor(i/columns)*220,customized:false});});draw();
 };
 draw();
 form.elements.world.addEventListener('change',()=>{const p=planets.find(p=>p.id===form.elements.world.value);form.elements.chapter.innerHTML=chapters(p).map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');applyDefaults(false);});
 for(const name of ['chapter','type'])form.elements[name].addEventListener('change',()=>applyDefaults(false));
 for(const name of ['startX','spacing','y'])form.elements[name].addEventListener('input',()=>applyDefaults(false));
 form.querySelector('[data-cmd=apply-defaults]').addEventListener('click',()=>applyDefaults(true));
 const list=form.querySelector('.fa-gma-rows');
 const capture=event=>{
  const holder=event.target.closest('[data-row]');if(!holder)return;
  const i=Number(holder.dataset.row),row=rows[i],name=event.target.name.split('-')[0];
  if(name==='world'){row.chapterId='';changeRowWorld(holder,i,planets.find(p=>p.id===event.target.value));}
  if(name!=='include')row.customized=true;
  capturePlacementRows(list,rows);summary();
 };
 list.addEventListener('change',capture);list.addEventListener('input',capture);
}
export function manageLinkedGMA(app){
 if(!game.user.isGM)return;
 const data=structuredClone(app.data),base=data.revision,records=linkedNotes(data);
 if(!records.length)throw Error('No imported notes are linked yet.');
 const rows=records.map(({planet,event})=>({eventId:event.id,include:false,planetId:planet.id,chapterId:event.parentChapter||'',x:event.x,y:event.y}));
 const {form,close}=app.modal('Linked GM Assistant notes',`<p>This list shows where each linked note is actually saved. Locate opens that note and centers the timeline, including notes inside chapters or off-screen.</p>${field('filter','Filter linked notes','')}<div class="fa-two-col">${selectField('bulkWorld','Move selected notes to world',app.planet.id,data.planets.map(p=>[p.id,p.name]))}${selectField('bulkChapter','Move selected notes to chapter','',chapters(app.planet))}</div><div class="fa-inline-buttons">${button('select-visible','Select visible notes')}${button('select-none','Clear selection')}${button('move-selected','Apply world/chapter to selected notes')}</div><label><input name="separateOverlaps" type="checkbox" checked> Separate overlapping notes automatically</label><p class="fa-muted">Changes are saved only when you click Save. Moving preserves the existing note, images, classification, and GM Assistant link. Connections that cross the new world or chapter boundary are removed.</p><div class="fa-gma-rows"></div>`,async()=>{
  capturePlacementRows(form.querySelector('.fa-gma-rows'),rows);
  if(!rows.some(row=>row.include))throw Error('Select the notes to move or edit a destination first.');
  const result=moveLinkedNotes(data,rows,{separateOverlaps:form.elements.separateOverlaps.checked});await app.save(result.data,base);
  const first=rows.find(row=>row.include);if(first)await app.focusEvent(first.eventId);
  ui.notifications.info(`Updated placement for ${result.moved} linked note(s).${result.separated?` Separated ${result.separated} overlapping note(s).`:""}`);
 });
 form.noValidate=true;
 const draw=()=>{
  const filter=form.elements.filter.value.trim().toLowerCase();
  form.querySelector('.fa-gma-rows').innerHTML=records.map((record,i)=>{
   const row=rows[i],destination=data.planets.find(p=>p.id===row.planetId),match=(record.event.name+' '+record.planet.name+' '+(record.chapter?.name||'')+' '+record.event.chapter).toLowerCase().includes(filter);
   return `<fieldset class="fa-gma-row" data-row="${i}" ${match?'':'hidden'}><legend><label><input name="include-${i}" type="checkbox" ${row.include?'checked':''}> ${esc(record.event.name)}</label></legend><p class="fa-saved-location">Saved in ${esc(record.planet.name)} / ${esc(record.chapter?.name||'Planet overview')} — X ${record.event.x}, Y ${record.event.y}</p>${button('locate-linked','Locate',`data-index="${i}" aria-label="Locate ${esc(record.event.name)}"`)}<div class="fa-two-col">${selectField('world-'+i,'World for '+record.event.name,row.planetId,data.planets.map(p=>[p.id,p.name]))}${selectField('chapter-'+i,'Chapter for '+record.event.name,row.chapterId,chapters(destination))}${field('x-'+i,'X',row.x,'number','min="40" max="20000"')}${field('y-'+i,'Y',row.y,'number','min="90" max="10000"')}</div></fieldset>`;
  }).join('');
 };
 draw();
 form.elements.filter.addEventListener('input',()=>{capturePlacementRows(form.querySelector('.fa-gma-rows'),rows);draw();});
 form.elements.bulkWorld.addEventListener('change',()=>{const p=data.planets.find(p=>p.id===form.elements.bulkWorld.value);form.elements.bulkChapter.innerHTML=chapters(p).map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');});
 form.addEventListener('click',async event=>{
  const target=event.target.closest('[data-cmd]');if(!target)return;
  const cmd=target.dataset.cmd,list=form.querySelector('.fa-gma-rows');
  if(cmd==='locate-linked'){close();await app.focusEvent(records[Number(target.dataset.index)].event.id);return;}
  capturePlacementRows(list,rows);
  if(cmd==='select-visible'){list.querySelectorAll('[data-row]:not([hidden])').forEach(h=>rows[Number(h.dataset.row)].include=true);draw();}
  if(cmd==='select-none'){rows.forEach(row=>row.include=false);draw();}
  if(cmd==='move-selected'){rows.forEach(row=>{if(row.include){row.planetId=form.elements.bulkWorld.value;row.chapterId=form.elements.bulkChapter.value;}});draw();}
 });
 const capture=event=>{
  const holder=event.target.closest('[data-row]');if(!holder)return;
  const i=Number(holder.dataset.row),name=event.target.name.split('-')[0];
  if(name==='world')changeRowWorld(holder,i,data.planets.find(p=>p.id===event.target.value));
  if(name!=='include')holder.querySelector(`[name="include-${i}"]`).checked=true;
  capturePlacementRows(form.querySelector('.fa-gma-rows'),rows);
 };
 form.querySelector('.fa-gma-rows').addEventListener('change',capture);form.querySelector('.fa-gma-rows').addEventListener('input',capture);
}

let syncing=false;
export async function resyncGMA(app,existingStatus=null){
 if(!game.user.isGM)throw Error('GM only.');if(syncing)throw Error('A resync is already running.');
 const base=app.data.revision,data=structuredClone(app.data),linked=data.planets.flatMap(p=>p.events.filter(e=>e.source?.service==='gmassistant'));
 if(!linked.length)throw Error('No GM Assistant notes are linked yet. Import a campaign first.');
 const client=new GMAClient();let status=existingStatus,progress;
 if(!status){progress=app.modal('Resync linked GM Assistant notes','<p>Updating all linked source notes. Local artwork, timeline placement, classifications, and inserted images are kept.</p><p role="status" class="fa-gma-status"></p>',null);status=progress.form.querySelector('.fa-gma-status');}
 syncing=true;
 try{
  const documents=new Map();
  for(const [i,event] of linked.entries()){
   status.textContent=`Reading ${i+1}/${linked.length}: ${event.name}`;
   const source=event.source,key=sourceKey(source.campaignId,source.sessionId);if(documents.has(key))continue;
   const s=await client.get(`/v1/campaigns/${enc(source.campaignId)}/sessions/${enc(source.sessionId)}`);
   documents.set(key,await client.document(source.campaignId,s,source.format));
  }
  const result=applyResync(data,documents);
  if(result.updated)await app.save(result.data,base);
  status.textContent=`Resync complete: ${result.updated} updated, ${result.unchanged} unchanged.`;
  ui.notifications.info(`GM Assistant: ${result.updated} updated, ${result.unchanged} unchanged.`);
 }catch(err){if(progress)progress.form.querySelector('.fa-error').textContent=err.message;else throw err;}
 finally{syncing=false;}
}
