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
export function applyImport(data,docs,placements,options){
 const next=structuredClone(data);const linked=new Set(next.planets.flatMap(p=>p.events.filter(e=>e.source?.service==='gmassistant').map(e=>sourceKey(e.source.campaignId,e.source.sessionId))));
 let added=0,skipped=0,previous=null;
 docs.forEach((doc,i)=>{
  const row=placements[i];if(!row?.include||!doc.body){skipped++;return;}
  const key=sourceKey(options.campaignId,doc.id);if(linked.has(key)){skipped++;return;}
  const planet=next.planets.find(p=>p.id===row.planetId);if(!planet)throw Error('Choose a world for every selected session.');
  const chapter=row.chapterId||'';if(chapter&&!planet.events.some(e=>e.id===chapter&&e.kind==='chapter'))throw Error('A selected chapter no longer exists.');
  let x=Number(row.x),y=Number(row.y);if(!Number.isFinite(x)||!Number.isFinite(y)||x<40||x>20000||y<90||y>10000)throw Error('Timeline positions must be between X 40–20000 and Y 90–10000.');
  const event={id:uid(),kind:'quest',name:(options.prefix||'')+doc.name,chapter:options.campaignName||'',parentChapter:chapter,description:doc.body,thumbnail:'',picture:'',type:row.type||options.type,status:options.status||'complete',x,y,parents:[],source:{service:'gmassistant',campaignId:options.campaignId,sessionId:doc.id,format:doc.format,hash:sourceHash(doc),prefix:options.prefix||'',lastSync:new Date().toISOString()}};
  if(options.connect&&previous&&previous.planetId===planet.id&&previous.chapterId===chapter)event.parents=[previous.id];
  planet.events.push(event);previous={id:event.id,planetId:planet.id,chapterId:chapter};linked.add(key);added++;
 });
 return {data:next,added,skipped};
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
const formats=[['longform','Long-form: full recap + notes + scene outline'],['recap','Full recap only'],['notes','Session notes only'],['scenes','Scene outline only']];
export function openGMA(app){
 if(!game.user.isGM)return;
 const config=connection();
 const {form}=app.modal('Import from GM Assistant',`<p>Connect the local companion, select your campaign, then choose the world and timeline position for each session.</p>${field('url','Companion address',config.url||'http://127.0.0.1:43127')}${field('token','Companion pairing token',config.token||'','password','autocomplete="off"')}<p class="fa-muted">Run companion/Start-Windows.bat from this module on your computer. Enter your read API key in that companion window. Paste its pairing token here.</p><div class="fa-inline-buttons">${button('connect-gma','Connect / Load campaigns')}${button('disconnect-gma','Disconnect')}${button('resync-gma','Resync all linked notes')}</div><label class="fa-field"><span>Campaign</span><select name="campaign" aria-label="Campaign"><option value="">Connect to load your campaigns</option></select></label>${selectField('format','Notes to fetch', 'longform',formats)}<p class="fa-gma-status" role="status"></p>`,null,button('fetch-gma','Fetch campaign notes','class="fa-primary"'));
 let client,campaigns=[];
 const status=form.querySelector('.fa-gma-status'),error=form.querySelector('.fa-error');
 let busy=false;
 form.addEventListener('click',async ev=>{
  const cmd=ev.target.closest('[data-cmd]')?.dataset.cmd;if(!['connect-gma','disconnect-gma','fetch-gma','resync-gma'].includes(cmd)||busy)return;
  error.textContent='';busy=true;
  const buttons=[...form.querySelectorAll('[data-cmd]')].filter(b=>b.dataset.cmd!=='cancel');buttons.forEach(b=>b.disabled=true);
  try{
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
function placementGMA(app,docs,campaign){
 const base=app.data.revision;const data=structuredClone(app.data);const planets=data.planets;
 const existing=new Set(planets.flatMap(p=>p.events.filter(e=>e.source?.service==='gmassistant').map(e=>sourceKey(e.source.campaignId,e.source.sessionId))));
 const rows=docs.map((doc,i)=>({include:!!doc.body&&!existing.has(sourceKey(campaign.campaignId,doc.id)),planetId:app.planet.id,chapterId:app.view.chapter||'',x:260+(i%59)*330,y:240+Math.floor(i/59)*220,type:data.types[0].id}));
 const {form}=app.modal(`Place campaign notes — ${campaign.campaignName}`,`<p>Each session becomes one linked quest card. Set the defaults, then adjust any session’s world, chapter, classification, and position below.</p><div class="fa-two-col">${selectField('world','Default world',app.planet.id,planets.map(p=>[p.id,p.name]))}${selectField('chapter','Default chapter',app.view.chapter||'',[['','Planet overview'],...app.planet.events.filter(e=>e.kind==='chapter').map(e=>[e.id,e.name])])}${selectField('type','Default classification',data.types[0].id,data.types.map(t=>[t.id,t.name]))}${selectField('status','Quest status','complete',[['complete','Completed'],['available','Available'],['active','In progress']])}${field('startX','First horizontal position',260,'number','min="40" max="20000"')}${field('y','Vertical position',240,'number','min="90" max="10000"')}${field('spacing','Horizontal spacing',330,'number','min="260" max="2000"')}${field('prefix','Title prefix (optional)','')}</div><label><input name="connect" type="checkbox" checked> Connect consecutive imported sessions</label>${button('apply-defaults','Apply defaults to selected sessions')}<p class="fa-muted">Imported notes will be visible to your players in the atlas. Already linked and empty sessions are skipped. Resync replaces linked source text while preserving artwork, placement, profiles, and inserted images.</p><div class="fa-gma-rows"></div>`,async()=>{
  const result=applyImport(data,docs,rows,{...campaign,type:form.elements.type.value,status:form.elements.status.value,prefix:form.elements.prefix.value,connect:form.elements.connect.checked});
  if(!result.added)throw Error('Select at least one session with notes that is not already linked.');
  await app.save(result.data,base);ui.notifications.info(`Imported ${result.added} session(s); skipped ${result.skipped}.`);
 });
 form.noValidate=true;
 const draw=()=>{
  const list=form.querySelector('.fa-gma-rows');list.innerHTML=docs.map((doc,i)=>{
   const row=rows[i],p=planets.find(p=>p.id===row.planetId),linked=existing.has(sourceKey(campaign.campaignId,doc.id));
   return `<fieldset class="fa-gma-row" data-row="${i}"><legend><label><input name="include-${i}" type="checkbox" ${row.include?'checked':''} ${!doc.body||linked?'disabled':''}> ${esc(doc.name)} ${linked?'— already linked':!doc.body?'— no notes':''}</label></legend><div class="fa-two-col">${selectField('world-'+i,'World for '+doc.name,row.planetId,planets.map(p=>[p.id,p.name]))}${selectField('chapter-'+i,'Chapter for '+doc.name,row.chapterId,[['','Planet overview'],...p.events.filter(e=>e.kind==='chapter').map(e=>[e.id,e.name])])}${field('x-'+i,'X',row.x,'number','min="40" max="20000"')}${field('y-'+i,'Y',row.y,'number','min="90" max="10000"')}${selectField('type-'+i,'Classification for '+doc.name,row.type,data.types.map(t=>[t.id,t.name]))}</div><details><summary>Preview fetched notes (${doc.body.length.toLocaleString()} characters)</summary><pre>${esc(doc.body)}</pre></details></fieldset>`;
  }).join('');
 };
 draw();
 form.elements.world.addEventListener('change',()=>{const p=planets.find(p=>p.id===form.elements.world.value);form.elements.chapter.innerHTML='<option value="">Planet overview</option>'+p.events.filter(e=>e.kind==='chapter').map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');});
 form.querySelector('[data-cmd=apply-defaults]').addEventListener('click',()=>{
  let n=0;rows.forEach(row=>{if(!row.include)return;Object.assign(row,{planetId:form.elements.world.value,chapterId:form.elements.chapter.value,type:form.elements.type.value,x:Number(form.elements.startX.value)+(n%Math.max(1,Math.floor((20000-Number(form.elements.startX.value))/Number(form.elements.spacing.value))+1))*Number(form.elements.spacing.value),y:Number(form.elements.y.value)+Math.floor(n++/Math.max(1,Math.floor((20000-Number(form.elements.startX.value))/Number(form.elements.spacing.value))+1))*220});});draw();
 });
 form.querySelector('.fa-gma-rows').addEventListener('change',event=>{
  const holder=event.target.closest('[data-row]');if(!holder)return;const i=Number(holder.dataset.row),row=rows[i],name=event.target.name.split('-')[0],value=event.target.value;
  if(name==='include')row.include=event.target.checked;
  if(name==='world'){row.planetId=value;row.chapterId='';draw();}
  if(name==='chapter')row.chapterId=value;
  if(name==='type')row.type=value;
  if(name==='x'||name==='y')row[name]=Number(value);
 });
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
