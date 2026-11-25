import {ID,TYPES,uid,esc,validate,blank,demo,mediaPath} from './model.js';
import {renderAtlas,button,img,field,imageField,selectField,symbol} from './view.js';
const {ApplicationV2}=foundry.applications.api;
let atlas;
const read=()=>structuredClone(game.settings.get(ID,'atlas'));
export class FatesAtlas extends ApplicationV2 {
 static DEFAULT_OPTIONS={id:ID,tag:'div',classes:['tely-fates-atlas'],window:{title:"Tely’s Fate’s Atlas",resizable:true},position:{width:1240,height:800}};
 constructor(options={}){super(options);this.view={planet:'',chapter:'',selected:'',edit:false,zoom:.85};this.scroll={left:0,top:0};this.busy=false;}
 async _renderHTML(){this.data=validate(read());return renderAtlas(this.data,this.view,game.user.isGM);}
 _replaceHTML(result,content){
  content.innerHTML=result;
  this.root=content.querySelector('.fa-root');
  const p=this.planet;this.root.querySelector('.fa-background').style.opacity=p?.fade??.2;
  this.root.querySelector('.fa-background').style.filter=`grayscale(${p?.grayscale??.8})`;
  const vp=this.root.querySelector('.fa-viewport');vp.scrollLeft=this.scroll.left;vp.scrollTop=this.scroll.top;
  vp.addEventListener('scroll',()=>{this.scroll={left:vp.scrollLeft,top:vp.scrollTop};},{passive:true});
  this.root.addEventListener('click',event=>this.click(event).catch(err=>{console.error(ID,err);ui.notifications.error(err.message);}));
  this.root.addEventListener('change',e=>{
   if(e.target.name==='planet')this.switchPlanet(e.target.value);
   if(e.target.name==='zoom')this.zoom(Number(e.target.value));
  });
  this.root.addEventListener('keydown',e=>{if(e.key==='Escape'){if(this.root.querySelector('.fa-modal'))return;if(this.view.selected){e.stopPropagation();this.view.selected='';this.refresh();}}});
  this.root.querySelectorAll('img').forEach(el=>el.addEventListener('error',()=>{el.classList.add('fa-broken');el.alt='Image unavailable';},{once:true}));
  this.bindDrag(vp);
 }
 async _onClose(options){this.dragCleanup?.();return super._onClose(options);}
 get planet(){return this.data.planets.find(p=>p.id===this.view.planet)||[...this.data.planets].sort((a,b)=>a.order-b.order)[0];}
 async refresh(){return this.render({force:true});}
 switchPlanet(id){this.view.planet=id;this.view.chapter='';this.view.selected='';this.scroll={left:0,top:0};this.refresh();}
 zoom(value){this.view.zoom=Math.max(.4,Math.min(1.5,value));this.refresh();}
 async save(next,base=this.data.revision){
  if(!game.user.isGM)throw Error('Only the GM can edit the atlas.');
  if(this.busy)throw Error('A save is already in progress. Please try again.');
  if(read().revision!==base)throw Error('Another GM updated the atlas. Close this editor and reopen it to use the latest version.');
  this.busy=true;
  try{const clean=validate(next);clean.revision=base+1;await game.settings.set(ID,'atlas',clean);this.data=clean;await this.refresh();}
  finally{this.busy=false;}
 }
 async click(event){
  const target=event.target.closest('[data-cmd]');if(!target||(this.suppressClick&&target.dataset.cmd==='select'))return;
  const cmd=target.dataset.cmd,p=this.planet,e=p?.events.find(e=>e.id===(target.dataset.id||this.view.selected));
  if(cmd==='close')return this.close();
  if(cmd==='fullscreen'){this.element.classList.toggle('fa-fullscreen');return;}
  if(cmd==='prev'||cmd==='next'){const ps=[...this.data.planets].sort((a,b)=>a.order-b.order);return this.switchPlanet(ps[Math.max(0,Math.min(ps.length-1,ps.indexOf(p)+(cmd==='next'?1:-1)))].id);}
  if(cmd==='back'){this.view.chapter='';this.view.selected='';this.scroll={left:0,top:0};return this.refresh();}
  if(cmd==='toggle-edit'){this.view.edit=!this.view.edit;return this.refresh();}
  if(cmd==='select'){
   if(e.kind==='chapter'){this.view.chapter=e.id;this.view.selected='';this.scroll={left:0,top:0};return this.refresh();}
   this.view.selected=e.id;return this.refresh();
  }
  if(cmd==='deselect'){this.view.selected='';return this.refresh();}
  if(cmd==='picture')return this.picture(e);
  if(cmd==='zoom-in'||cmd==='zoom-out')return this.zoom(this.view.zoom+(cmd==='zoom-in'?.1:-.1));
  if(cmd==='fit'){
   const events=p?.events.filter(e=>(e.parentChapter||'')===(this.view.chapter||''))||[];
   const vp=this.root.querySelector('.fa-viewport');this.scroll={left:0,top:0};
   return this.zoom(Math.min(vp.clientWidth/Math.max(1000,...events.map(e=>e.x+320)),vp.clientHeight/Math.max(600,...events.map(e=>e.y+200))));
  }
  if(cmd==='help')return this.modal('How to use Fate’s Atlas',`<p>Choose a planet at the top. Drag the empty timeline to explore and use the slider to zoom. Chapters open their own quest timelines. Select a quest to read its description, then choose Recap or click its picture for the full illustration.</p><p>GM: enable Edit atlas to add worlds and quests, drag cards to position them, and use their pencil buttons to edit. Choose predecessor quests to draw branches. Planet settings control the background’s opacity and grayscale.</p><p>All atlas content is shared with the world’s players. Locked status is a visual marker, not a secrecy or prerequisite rule. Keep spoilers out until you want players to see them.</p>`,null);
  if(!game.user.isGM)return;
  if(cmd==='add-planet'||cmd==='edit-planet')return this.editPlanet(cmd==='edit-planet'?p:null);
  if(cmd==='add-event'||cmd==='edit-event')return this.editEvent(cmd==='edit-event'?e:null);
  if(cmd==='types')return this.editTypes();
  if(cmd==='example')return game.modules.get(ID).api.loadExample();
  if(cmd==='export')return this.export();
  if(cmd==='import')return this.import();
 }
 modal(title,content,onSave,extras=''){
  this.root.querySelector('.fa-modal')?.remove();
  const layer=document.createElement('div');layer.className='fa-modal';
  layer.innerHTML=`<form class="fa-dialog"><header><h2>${esc(title)}</h2>${button('cancel','×','aria-label="Close editor"')}</header><div class="fa-dialog-body">${content}</div><p class="fa-error" role="alert"></p><footer>${extras}${button('cancel',onSave?'Cancel':'Close')}${onSave?'<button type="submit" class="fa-primary">Save</button>':''}</footer></form>`;
  this.root.append(layer);
  const form=layer.querySelector('form'),previous=document.activeElement;
  const close=()=>{layer.remove();previous?.focus();};
  layer.addEventListener('click',ev=>ev.stopPropagation());
  layer.addEventListener('keydown',ev=>{
   if(ev.key==='Escape'){ev.stopPropagation();close();}
   if(ev.key==='Tab'){
    const nodes=[...form.querySelectorAll('button,input,textarea,select')].filter(el=>!el.disabled&&el.offsetParent!==null);
    if(ev.shiftKey&&document.activeElement===nodes[0]){ev.preventDefault();nodes.at(-1).focus();}
    else if(!ev.shiftKey&&document.activeElement===nodes.at(-1)){ev.preventDefault();nodes[0].focus();}
   }
  });
  form.addEventListener('click',async ev=>{
   const b=ev.target.closest('[data-cmd]');if(!b)return;
   if(b.dataset.cmd==='cancel')close();
   if(b.dataset.cmd==='browse'){
    try{const input=form.elements[b.dataset.field];const Picker=foundry.applications.apps.FilePicker.implementation;
     new Picker({type:'image',current:input.value,callback:path=>{input.value=path;input.dispatchEvent(new Event('input',{bubbles:true}));}}).render({force:true});
    }catch(err){form.querySelector('.fa-error').textContent=err.message;}
   }
  });
  form.addEventListener('submit',async ev=>{
   ev.preventDefault();const submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;
   try{await onSave?.(new FormData(form),form);close();}catch(err){form.querySelector('.fa-error').textContent=err.message;if(submit)submit.disabled=false;}
  });
  form.querySelector('input,textarea,select,button')?.focus();return {form,close,layer};
 }
 editPlanet(existing){
  const next=structuredClone(this.data),base=next.revision,p=existing?next.planets.find(p=>p.id===existing.id):{id:uid(),name:'',subtitle:'',background:'',icon:'',fade:.22,grayscale:.8,order:next.planets.length,events:[]};
  const {form,close}=this.modal(existing?'Planet settings':'Add a planet',`${field('name','Planet name',p.name,'text','required maxlength="100"')}${field('subtitle','Subtitle',p.subtitle)}${imageField('icon','Planet symbol image (optional)',p.icon)}${imageField('background','Full-color background image',p.background)}<div class="fa-two-col">${field('fade','Background opacity (0–1)',p.fade,'number','min="0" max="1" step="0.01"')}${field('grayscale','Grayscale (0–1)',p.grayscale,'number','min="0" max="1" step="0.01"')}</div>${field('order','Planet order',p.order,'number','min="0" step="1"')}<div class="fa-bg-preview">${img(p.background)}</div><p class="fa-muted">The browser applies fading and grayscale; your original image stays full color.</p>`,async fd=>{
   Object.assign(p,Object.fromEntries(fd));p.fade=Number(p.fade);p.grayscale=Number(p.grayscale);p.order=Number(p.order);
   if(!existing)next.planets.push(p);this.view.planet=p.id;await this.save(next,base);
  },existing?button('delete','Delete planet','class="fa-danger"'): '');
  const preview=()=>{const box=form.querySelector('.fa-bg-preview');box.innerHTML=img(form.elements.background.value);box.style.opacity=form.elements.fade.value;box.style.filter=`grayscale(${form.elements.grayscale.value})`;};
  form.addEventListener('input',preview);preview();
  form.querySelector('[data-cmd=delete]')?.addEventListener('click',()=>{if(confirm(`Delete ${p.name} and all its quests? Export a backup first if needed.`)){next.planets=next.planets.filter(v=>v.id!==p.id);this.save(next,base).then(close).catch(err=>form.querySelector('.fa-error').textContent=err.message);}});
 }
 editEvent(existing){
  const next=structuredClone(this.data),base=next.revision,p=next.planets.find(p=>p.id===this.planet.id);
  const scope=p.events.filter(v=>(v.parentChapter||'')===(this.view.chapter||''));
  let newX=Math.round((this.scroll.left/this.view.zoom+160)/10)*10;const newY=Math.round((this.scroll.top/this.view.zoom+240)/10)*10;
  while(scope.some(v=>Math.abs(v.x-newX)<290&&Math.abs(v.y-newY)<180))newX+=330;
  const e=existing?p.events.find(v=>v.id===existing.id):{id:uid(),name:'',chapter:'',kind:'quest',parentChapter:this.view.chapter,description:'',thumbnail:'',picture:'',type:next.types[0].id,status:'available',x:newX,y:newY,parents:[]};
  const {form,close}=this.modal(existing?'Edit quest / chapter':'Add quest / chapter',`${field('name','Quest / chapter name',e.name,'text','required maxlength="200"')}<div class="fa-two-col">${selectField('kind','Card behavior',e.kind||'quest',[['quest','Quest — show picture and recap'],['chapter','Chapter — open a quest timeline']])}${selectField('parentChapter','Inside chapter',e.parentChapter||'',[['','Planet overview'],...p.events.filter(v=>v.kind==='chapter'&&v.id!==e.id).map(v=>[v.id,v.name])])}</div>${field('chapter','Chapter / subtitle label',e.chapter)}<div class="fa-two-col">${selectField('type','Classification profile',e.type,next.types.map(t=>[t.id,`${t.symbol} ${t.name}`]))}${selectField('status','Status',e.status,[['available','Available'],['active','In progress'],['complete','Completed'],['locked','Locked']])}</div><div class="fa-profile-preview"></div><p class="fa-muted">Classification profiles remember their icon, symbol, and color. Choose one above; no new icon upload is needed for this quest.</p>${imageField('thumbnail','Timeline card image',e.thumbnail)}${imageField('picture','Related picture (Recap image)',e.picture)}<label class="fa-field"><span>Description</span><textarea name="description" rows="5">${esc(e.description)}</textarea></label><div class="fa-two-col">${field('x','Horizontal position',e.x,'number','min="40" max="20000"')}${field('y','Vertical position',e.y,'number','min="90" max="10000"')}</div><fieldset class="fa-parents"><legend>Connect from these preceding cards</legend>${p.events.filter(v=>v.id!==e.id).map(v=>`<label data-scope="${esc(v.parentChapter||'')}"><input type="checkbox" name="parents" value="${esc(v.id)}" ${e.parents.includes(v.id)?'checked':''}> ${esc(v.name)}</label>`).join('')||'<p>No other cards yet.</p>'}</fieldset>`,async fd=>{
   const values=Object.fromEntries(fd);delete values.parents;
   if(values.kind==='chapter')values.parentChapter='';
   if(e.kind==='chapter'&&values.kind!=='chapter'&&p.events.some(v=>v.parentChapter===e.id))throw Error('Move the quests out of this chapter before changing its behavior.');
   const parents=fd.getAll('parents').filter(id=>p.events.some(v=>v.id===id&&(v.parentChapter||'')===values.parentChapter));
   Object.assign(e,values,{parents,x:Number(values.x),y:Number(values.y)});if(!existing){p.events.push(e);this.scroll.left=Math.max(0,e.x*this.view.zoom-200);}
   await this.save(next,base);
  },existing?button('delete','Delete card','class="fa-danger"'): '');
  const update=()=>{
   const chapter=form.elements.kind.value==='chapter';form.elements.parentChapter.disabled=chapter;
   const scope=chapter?'':form.elements.parentChapter.value;
   form.querySelectorAll('[data-scope]').forEach(label=>{label.hidden=label.dataset.scope!==scope;label.querySelector('input').disabled=label.hidden;});
  };
  form.elements.kind.addEventListener('change',update);form.elements.parentChapter.addEventListener('change',update);update();
  const profilePreview=()=>{const t=next.types.find(t=>t.id===form.elements.type.value)||next.types[0];const box=form.querySelector('.fa-profile-preview');box.innerHTML=`<span class="fa-profile-icon">${symbol(t)}</span><strong>${esc(t.name)}</strong><small>Saved classification profile</small>`;box.style.setProperty('--profile-color',t.color);};
  form.elements.type.addEventListener('change',profilePreview);profilePreview();
  form.querySelector('[data-cmd=delete]')?.addEventListener('click',()=>{if(confirm('Delete this card? Quests inside a deleted chapter move to the planet overview.')){
   p.events=p.events.filter(v=>v.id!==e.id);p.events.forEach(v=>{v.parents=v.parents.filter(id=>id!==e.id);if(v.parentChapter===e.id)v.parentChapter='';});
   if(this.view.chapter===e.id)this.view.chapter='';this.save(next,base).then(close).catch(err=>form.querySelector('.fa-error').textContent=err.message);
  }});
 }
 editTypes(){
  const next=structuredClone(this.data),base=next.revision;
  const row=t=>`<fieldset class="fa-type-row" data-id="${esc(t.id)}">${field('type-name','Name',t.name,'text','required')}${field('type-symbol','Symbol',t.symbol,'text','maxlength="8"')}${field('type-color','Color',t.color,'color')}${imageField(`icon-${t.id}`,'Custom symbol image (optional)',t.icon)}<label><input type="checkbox" name="remove"> Remove profile</label></fieldset>`;
  const {form}=this.modal('Quest classification profiles',`<p>Set each profile’s name, color, and icon once. Every quest assigned to that profile reuses them automatically. Updating a profile updates all its quests. Removed profiles fall back to the first remaining profile.</p><div class="fa-type-list">${next.types.map(row).join('')}</div>${button('add-type','+ Classification profile')}`,async()=>{
   const types=[...form.querySelectorAll('.fa-type-row')].filter(r=>!r.querySelector('[name=remove]').checked).map(r=>({id:r.dataset.id,name:r.querySelector('[name=type-name]').value,symbol:r.querySelector('[name=type-symbol]').value,color:r.querySelector('[name=type-color]').value,icon:r.querySelector('.fa-file-field input').value}));
   if(!types.length)throw Error('Keep at least one classification profile.');if(types.length>50)throw Error('Maximum 50 classification profiles.');next.types=types;await this.save(next,base);
  });
  form.querySelector('[data-cmd=add-type]').addEventListener('click',()=>form.querySelector('.fa-type-list').insertAdjacentHTML('beforeend',row({id:uid(),name:'New classification',symbol:'✦',color:'#e8cd85'})));
 }
 picture(e){
  if(!e)return;const path=mediaPath(e.picture||e.thumbnail);
  this.modal(e.name,`<div class="fa-picture-view">${img(path,'',e.name)||'<p>Choose a related picture in this quest’s editor.</p>'}</div><p class="fa-description">${esc(e.description)}</p>`,null);
  this.root.querySelector('.fa-dialog').classList.add('fa-picture-dialog');
 }
 export(){const blob=new Blob([JSON.stringify(this.data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='telys-fates-atlas-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 import(){
  const base=this.data.revision;
  this.modal('Import atlas backup','<p>This replaces this world’s atlas. Export a backup first. Images remain at their original file paths and must be copied separately when moving worlds.</p><input name="backup" aria-label="Atlas JSON backup" type="file" accept=".json,application/json" required><label class="fa-field"><span><input name="replace" type="checkbox" required> Replace the current atlas</span></label>',async(fd)=>{
   const f=fd.get('backup');if(f.size>10*1024*1024)throw Error('Backup exceeds 10 MB.');const next=validate(JSON.parse(await f.text()));await this.save(next,base);this.view.chapter='';this.view.selected='';await this.refresh();
  });
 }
 bindDrag(vp){
  this.dragCleanup?.();
  vp.addEventListener('pointerdown',ev=>{
   if(ev.button!==0||ev.target.closest('.fa-node-edit'))return;
   const node=ev.target.closest('.fa-node');if(node&&!this.view.edit)return;
   const e=node?this.planet.events.find(e=>e.id===node.dataset.id):null;
   const start={x:ev.clientX,y:ev.clientY,left:vp.scrollLeft,top:vp.scrollTop,ex:e?.x,ey:e?.y},base=this.data.revision;
   let moved=false;
   const move=event=>{const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.hypot(dx,dy)<5&&!moved)return;moved=true;
    if(e&&game.user.isGM){node.style.left=`${Math.max(40,start.ex+dx/this.view.zoom)}px`;node.style.top=`${Math.max(90,start.ey+dy/this.view.zoom)}px`;}
    else{vp.scrollLeft=start.left-dx;vp.scrollTop=start.top-dy;}
   };
   const up=async()=>{
    document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);
    this.dragCleanup=null;if(!moved)return;this.suppressClick=true;setTimeout(()=>this.suppressClick=false,50);
    if(e&&game.user.isGM){const next=structuredClone(this.data),edited=next.planets.find(p=>p.id===this.planet.id).events.find(v=>v.id===e.id);edited.x=Math.round(parseFloat(node.style.left)/10)*10;edited.y=Math.round(parseFloat(node.style.top)/10)*10;try{await this.save(next,base);}catch(err){ui.notifications.error(err.message);this.refresh();}}
   };
   const cancel=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);this.dragCleanup=null;};
   this.dragCleanup=cancel;document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);
  });
 }
}
class AtlasMenu extends ApplicationV2{async render(){return game.modules.get(ID).api.open();}}
Hooks.once('init',()=>{
 game.settings.register(ID,'atlas',{scope:'world',config:false,type:Object,default:blank(),onChange:()=>{if(atlas?.rendered&&!atlas.busy&&!atlas.root?.querySelector('.fa-modal'))atlas.refresh();}});
 game.settings.registerMenu(ID,'open',{name:"Fate’s Atlas",label:'Open Fate’s Atlas',hint:'Open the campaign’s illustrated timeline.',icon:'fas fa-route',type:AtlasMenu,restricted:false});
 game.keybindings.register(ID,'open',{name:'Open Fate’s Atlas',editable:[{key:'KeyF',modifiers:['Shift']}],onDown:()=>{game.modules.get(ID).api.open();return true;}});
});
Hooks.once('ready',()=>{
 game.modules.get(ID).api={open:({planetId,chapterId}={})=>{atlas??=new FatesAtlas();if(planetId)atlas.view.planet=planetId;if(chapterId)atlas.view.chapter=chapterId;return atlas.render({force:true});},exportData:()=>read(),getClassificationProfiles:()=>structuredClone(read().types),saveClassificationProfiles:async profiles=>{if(!game.user.isGM)throw Error('GM only.');atlas??=new FatesAtlas();atlas.data=validate(read());const next=structuredClone(atlas.data);if(!Array.isArray(profiles)||!profiles.length)throw Error('Provide at least one classification profile.');next.types=profiles.map(p=>({...p,id:p.id||uid()}));return atlas.save(next);},importData:async data=>{if(!game.user.isGM)throw Error('GM only.');atlas??=new FatesAtlas();atlas.data=validate(read());return atlas.save(validate(data));},loadExample:async()=>{if(!game.user.isGM)throw Error('GM only.');if(read().planets.length)throw Error('Example can only be loaded into an empty atlas.');atlas??=new FatesAtlas();atlas.data=validate(read());return atlas.save(demo());}};
});
Hooks.on('renderSettings',(_app,html)=>{
 const el=html instanceof HTMLElement?html:html?.[0];if(!el||el.querySelector('.tely-atlas-launch'))return;
 const b=document.createElement('button');b.type='button';b.className='tely-atlas-launch';b.innerHTML='<i class="fas fa-route"></i> Fate’s Atlas';b.addEventListener('click',()=>game.modules.get(ID).api.open());
 (el.querySelector('.settings-sidebar')||el.querySelector('.standard-form')||el).append(b);
});
