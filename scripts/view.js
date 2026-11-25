import {renderNotes} from './notes.js';
import {ID,esc,mediaPath} from './model.js';
export const button=(act,label,extra='')=>`<button type="button" data-cmd="${act}" ${extra}>${label}</button>`;
export const img=(path,cls='',alt='')=>mediaPath(path)?`<img class="${cls}" src="${esc(mediaPath(path))}" alt="${esc(alt)}" draggable="false">`:'';
export function symbol(t){return t.icon?img(t.icon,'fa-type-icon',t.name):esc(t.symbol||'✦');}
export function renderAtlas(data,state,gm) {
 const planets=[...data.planets].sort((a,b)=>a.order-b.order);
 const p=planets.find(p=>p.id===state.planet)||planets[0];
 const index=planets.indexOf(p), chapter=p?.events.find(e=>e.id===state.chapter&&e.kind==='chapter');
 const events=p?.events.filter(e=>(e.parentChapter||'')===(chapter?.id||''))||[];
 const selected=events.find(e=>e.id===state.selected);
 const types=data.types;
 const w=Math.max(1300,...events.map(e=>e.x+400)),h=Math.max(720,...events.map(e=>e.y+230));
 const connections=events.flatMap(e=>e.parents.map(id=>{
 const from=events.find(f=>f.id===id);if(!from)return '';
 const x1=from.x+230,y1=from.y+123,x2=e.x,y2=e.y+123;
 const mid=x2>x1?(x1+x2)/2:Math.max(x1,x2)+35;
 return `<path d="M${x1} ${y1} H${mid} Q${mid+8} ${y1} ${mid+8} ${y1+Math.sign(y2-y1)*8} V${y2-Math.sign(y2-y1)*8} Q${mid+8} ${y2} ${mid+16} ${y2} H${x2}"/>`;
 })).join('');
 return `<section class="fa-root ${state.edit&&gm?'fa-editing':''}" tabindex="0" aria-label="Fate's Atlas">
 <div class="fa-background">${img(p?.background)}</div><div class="fa-stars"></div><div class="fa-orbit fa-orbit-left"></div><div class="fa-orbit fa-orbit-right"></div>
 <header class="fa-header"><div class="fa-brand"><span>≋</span><div>Fate’s Atlas${chapter?`<small>${esc(chapter.name)}</small>`:''}</div></div>
 <nav class="fa-worlds" aria-label="Planets">${button('prev','◂','aria-label="Previous planet" '+(index<=0?'disabled':''))}<span class="fa-adjacent">${esc(planets[index-1]?.name)}</span><select aria-label="Planet" name="planet">${planets.map(v=>`<option value="${esc(v.id)}" ${v===p?'selected':''}>${esc(v.name)}</option>`).join('')}</select><span class="fa-adjacent">${esc(planets[index+1]?.name)}</span>${button('next','▸','aria-label="Next planet" '+(index>=planets.length-1?'disabled':''))}</nav>
 <div class="fa-header-actions">${button('help','ⓘ','aria-label="Help"')}${button('fullscreen','⛶','aria-label="Toggle fullscreen"')}${chapter?button('back','↶','aria-label="Back to chapters"'):''}${button('close','×','aria-label="Close atlas"')}</div></header>
 ${gm?`<div class="fa-tools">${button('toggle-edit',state.edit?'✓ Finish editing':'✎ Edit atlas')}${button('gma-import','Import from GM Assistant')}${data.planets.some(p=>p.events.some(e=>e.source?.service==='gmassistant'))?button('gma-resync','Resync')+button('gma-linked','Linked notes'):''}${state.edit?`${button('add-planet','+ Planet')}${p?button('edit-planet','Planet settings'):''}${p?button('add-event','+ Quest / Chapter'):''}${button('types','Classification profiles')}${button('import','Import')}${button('export','Export')}`:''}</div>`:''}
 <div class="fa-main ${selected?'fa-has-selection':''}"><div class="fa-viewport" tabindex="0" aria-label="Timeline; drag empty space to pan">
 <div class="fa-spacer" style="width:${w*state.zoom}px;height:${h*state.zoom}px"><div class="fa-board" style="width:${w}px;height:${h}px;transform:scale(${state.zoom})">
 <svg class="fa-connections" width="${w}" height="${h}" aria-hidden="true">${connections}</svg>
 <div class="fa-origin" style="top:363px">${img(p?.icon)}<span>◈ &nbsp;${esc(chapter?.name||p?.name||'Uncharted worlds')}</span></div>
 ${events.map(e=>{const t=types.find(t=>t.id===e.type)||types[0];return `<article class="fa-node ${e.id===selected?.id?'fa-selected':''} fa-status-${e.status} ${e.kind==='chapter'?'fa-chapter':''}" data-id="${esc(e.id)}" style="left:${e.x}px;top:${e.y}px;--mission:${esc(t.color)}">
 <button type="button" class="fa-card" data-cmd="select" data-id="${esc(e.id)}" aria-label="${esc(e.name)}">${img(e.thumbnail,'fa-thumbnail',e.name)||'<span class="fa-placeholder">✦</span>'}<span class="fa-card-label"><span class="fa-symbol">${symbol(t)}</span><span class="fa-quest-name">${esc(e.name)}</span><span class="fa-status">${e.status==='complete'?'✓':e.status==='locked'?'⌑':e.status==='active'?'!':e.kind==='chapter'?'›':''}</span></span></button>
 ${e.status==='active'?'<span class="fa-active-tag">In progress</span>':''}${state.edit&&gm?button('edit-event','✎',`class="fa-node-edit" data-id="${esc(e.id)}" aria-label="Edit ${esc(e.name)}"`):''}</article>`;}).join('')}
 ${!events.length?`<div class="fa-empty"><span>✧</span><h2>${p?'Your story begins here':'A galaxy of untold stories'}</h2><p>${gm?'Choose Edit atlas to add planets, chapters, and quests.':'The GM has not added any events here yet.'}</p>${gm&&!data.planets.length?button('example','Load example atlas'):''}</div>`:''}
 </div></div></div>
 ${selected?`<aside class="fa-detail"><div class="fa-detail-top"><span>${esc(selected.status==='complete'?'Completed':selected.status)}</span>${button('deselect','×','aria-label="Close quest details"')}</div><h2>${esc(selected.name)}</h2><p class="fa-detail-chapter">${esc(selected.chapter||chapter?.name||p.name)}</p><button type="button" class="fa-detail-image" data-cmd="picture" aria-label="Open related picture">${img(selected.picture||selected.thumbnail,'',selected.name)||'<span>No picture selected</span>'}</button><div class="fa-description fa-note-content">${renderNotes(selected.description)}</div>${button('picture','Recap &nbsp; ›','class="fa-recap"')}${gm&&state.edit?button('edit-event','Edit quest',`data-id="${esc(selected.id)}"`):''}</aside>`:''}</div>
 <footer class="fa-footer"><div class="fa-world-note-summary">${p?button('world-notes',`World notes (${p.events.filter(e=>e.kind!=='chapter').length})`):''}<small>${events.length} cards in ${chapter?esc(chapter.name):'planet overview'}</small></div><div class="fa-zoom">${button('zoom-out','−','aria-label="Zoom out"')}<input name="zoom" aria-label="Timeline zoom" type="range" min="0.01" max="1.5" step="0.01" value="${state.zoom}">${button('zoom-in','+','aria-label="Zoom in"')}${button('fit','Fit')}</div><span class="fa-hint">${state.edit&&gm?'Drag cards to arrange · ✎ to edit':'Drag to explore · Click a card to review'}</span></footer>
 </section>`;
}
export function field(name,label,value='',type='text',extra='') {return `<label class="fa-field"><span>${esc(label)}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
export function imageField(name,label,value=''){return `<div class="fa-field"><label for="fa-field-${esc(name)}">${esc(label)}</label><div class="fa-file-field"><input id="fa-field-${esc(name)}" name="${esc(name)}" value="${esc(value)}" placeholder="Foundry image path or https://…">${button('browse','Browse',`data-field="${esc(name)}"`)}</div></div>`;}
export function selectField(name,label,value,options){return `<div class="fa-field"><label for="fa-select-${esc(name)}">${esc(label)}</label><select id="fa-select-${esc(name)}" name="${esc(name)}">${options.map(([id,name])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(name)}</option>`).join('')}</select></div>`;}
