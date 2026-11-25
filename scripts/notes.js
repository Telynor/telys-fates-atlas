import {esc,mediaPath} from './model.js';
// Deliberately small Markdown renderer: source HTML is always escaped, never executed.
export function inline(text){
 const images=[];
 const protectedText=String(text).replace(/!\[([^\]\n]*)\]\(([^)\n]+)\)/g,(_all,alt,path)=>{
  const safe=mediaPath(path.trim());
  if(!safe)return esc(alt);
  const key=`\u0001${images.length}\u0001`;
  images.push(`<img class="fa-inline-image" src="${esc(safe)}" alt="${esc(alt)}" loading="lazy">`);return key;
 });
 return esc(protectedText).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*\n]+)\*/g,'<em>$1</em>').replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\u0001(\d+)\u0001/g,(_m,i)=>images[Number(i)]||'');
}
export function renderNotes(text){
 const blocks=String(text||'').replace(/\r\n?/g,'\n').split(/\n\s*\n/);
 return blocks.map(block=>{
  if(!block.trim())return '';
  const lines=block.split('\n');
  return lines.map(line=>{
   const h=line.match(/^(#{1,6})\s+(.+)$/);if(h)return `<h${Math.min(6,h[1].length+1)}>${inline(h[2])}</h${Math.min(6,h[1].length+1)}>`;
   if(/^\s*[-*]\s+/.test(line))return `<div class="fa-note-bullet">• ${inline(line.replace(/^\s*[-*]\s+/,''))}</div>`;
   return inline(line);
  }).join('<br>');
 }).map(b=>`<div class="fa-note-block">${b}</div>`).join('');
}
export function imageMarkdown(path,alt=''){
 const safe=mediaPath(path);if(!safe)throw Error('Choose a valid image path.');
 return `![${String(alt).replace(/[\]\r\n]/g,'')}](${safe.replace(/\(/g,'%28').replace(/\)/g,'%29')})`;
}
export function preserveImages(oldText,newText){
 // Preserve locally inserted artwork near its named section when remote prose changes.
 const remote=String(newText||'');let result=remote;
 const known=new Set([...remote.matchAll(/!\[[^\]\n]*\]\(([^)\n]+)\)/g)].map(m=>m[1]));
 for(const m of String(oldText||'').matchAll(/!\[[^\]\n]*\]\(([^)\n]+)\)/g)){
  if(known.has(m[1]))continue;known.add(m[1]);
  const headings=[...String(oldText).slice(0,m.index).matchAll(/^#{1,6}\s+(.+)$/gm)];
  const anchor=headings.at(-1)?.[1]?.trim();
  if(anchor){
   const headingsNow=[...result.matchAll(/^#{1,6}\s+(.+)$/gm)];const i=headingsNow.findIndex(h=>h[1].trim()===anchor);
   if(i>=0){const at=headingsNow[i+1]?.index??result.length;result=result.slice(0,at).trimEnd()+'\n\n'+m[0]+'\n\n'+result.slice(at);continue;}
  }
  result=result.trimEnd()+'\n\n'+m[0];
 }
 return result;
}
