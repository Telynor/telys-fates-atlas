export const ID = 'telys-fates-atlas';
export const TYPES = [
  {id:'trailblaze',name:'Trailblaze',symbol:'✦',color:'#e8cd85'},
  {id:'continuance',name:'Continuance',symbol:'❖',color:'#e9a776'},
  {id:'companion',name:'Companion',symbol:'♧',color:'#c79bfa'},
  {id:'adventure',name:'Adventure',symbol:'◇',color:'#7cb9f3'},
  {id:'event',name:'Event',symbol:'✧',color:'#89d7bd'}
];
export const uid = () => crypto.randomUUID();
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mediaPath(value) {
  const s = String(value ?? '').trim();
  if (!s || /[\u0000-\u001f]/.test(s) || s.startsWith('//') || s.startsWith('\\')) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return '';
  return s;
}
export const blank = () => ({schema:1,revision:0,types:structuredClone(TYPES),planets:[]});
const text = (s,max=500) => String(s ?? '').slice(0,max);
const number = (v,min,max,fallback=0) => Number.isFinite(Number(v)) ? Math.max(min,Math.min(max,Number(v))) : fallback;
export function validate(raw) {
  if (!raw || raw.schema !== 1 || !Array.isArray(raw.planets)) throw Error('This is not a Fate’s Atlas schema 1 export.');
  if (raw.planets.length > 100) throw Error('Maximum 100 planets.');
  const used = new Set();
  const id = v => {v=text(v,100); if(!v || used.has(v)) throw Error('Missing or duplicate ID.'); used.add(v); return v;};
  const types = (Array.isArray(raw.types) && raw.types.length ? raw.types : TYPES).slice(0,50).map(t=>({id:id(t.id),name:text(t.name,80),symbol:text(t.symbol,8),icon:mediaPath(t.icon),color:/^#[a-f0-9]{6}$/i.test(t.color)?t.color:'#e8cd85'}));
  const planets=raw.planets.map(p=>{
    if(!Array.isArray(p.events) || p.events.length>2000) throw Error('Invalid planet events (maximum 2000).');
    const result={id:id(p.id),name:text(p.name,100),subtitle:text(p.subtitle,300),icon:mediaPath(p.icon),background:mediaPath(p.background),fade:number(p.fade,0,1,.2),grayscale:number(p.grayscale,0,1,.8),order:number(p.order,0,10000),events:p.events.map(e=>({id:id(e.id),name:text(e.name,200),chapter:text(e.chapter,100),kind:e.kind==='chapter'?'chapter':'quest',parentChapter:text(e.parentChapter,100),description:text(e.description,500000),source:cleanSource(e.source),thumbnail:mediaPath(e.thumbnail),picture:mediaPath(e.picture),type:types.some(t=>t.id===e.type)?e.type:types[0].id,status:['available','active','complete','locked'].includes(e.status)?e.status:'available',x:number(e.x,40,20000,100),y:number(e.y,90,10000,260),parents:Array.isArray(e.parents)?e.parents.map(v=>text(v,100)).slice(0,100):[]}))};
    const ids=new Set(result.events.map(e=>e.id));
    result.events.forEach(e=>{if(e.kind==='chapter') e.parentChapter=''; else if(!result.events.some(c=>c.id===e.parentChapter&&c.kind==='chapter')) e.parentChapter='';e.parents=[...new Set(e.parents)].filter(v=>ids.has(v)&&v!==e.id);});
    return result;
  });
  return {schema:1,revision:number(raw.revision,0,Number.MAX_SAFE_INTEGER),types,planets};
}
export function demo() {
 const d=blank();
 d.planets=[{id:uid(),name:'Your first world',subtitle:'An illustrated chronicle of your campaign',background:'',icon:'',fade:.22,grayscale:.8,order:0,events:[]}];
 const p=d.planets[0];
 const a={id:uid(),name:'The journey begins',chapter:'CHAPTER I',description:'Edit this quest to choose its timeline thumbnail and the separate picture opened when clicked. Drag the cards in Edit mode to arrange your story.',thumbnail:`modules/${ID}/assets/journey.svg`,picture:`modules/${ID}/assets/journey.svg`,type:'trailblaze',status:'complete',x:260,y:240,parents:[]};
 const b={...a,id:uid(),name:'A world of possibilities',chapter:'CHAPTER II',status:'active',x:670,parents:[a.id]};
 const c={...a,id:uid(),name:'A familiar face',chapter:'COMPANION STORY',type:'companion',status:'available',x:670,y:520,parents:[a.id]};
 const e={...a,id:uid(),name:'Beyond the horizon',chapter:'CHAPTER III',status:'available',x:1080,parents:[b.id]};
 p.events=[a,b,c,e];return d;
}

function cleanSource(source){
 if(!source||source.service!=='gmassistant')return undefined;
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(source.campaignId)||!/^[A-Za-z0-9_-]{1,128}$/.test(source.sessionId))throw Error('Invalid GM Assistant source identifiers.');
 return {service:'gmassistant',campaignId:source.campaignId,sessionId:source.sessionId,format:['longform','recap','notes','scenes'].includes(source.format)?source.format:'longform',hash:text(source.hash,100),prefix:text(source.prefix,200),lastSync:text(source.lastSync,100)};
}
