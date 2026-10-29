/* 每天走過的路 tracks.js — 錄下自己的 GPS 路線（gyeongbok.html、coex.html），存本機＋同步到 textdb.dev
   只在 family.js「分享：開」時錄。點：[緯度,經度,unix秒]；移動 >15m 或每 60 秒留一點；精度 >80m 丟掉。
   雲端 key = sha256(房間|日期|成員) → 沒有房間連結猜不到。每 2 分鐘、切到背景、關頁時上傳。          */
(function(){
const API='https://textdb.dev/api/data/';
const sdate=t=>new Date((t||Date.now())+9*3600e3).toISOString().slice(0,10); // 首爾日期
const dist=(a,b,c,d)=>{const p=Math.PI/180,x=Math.sin((c-a)*p/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2)**2;return 2*6371e3*Math.asin(Math.sqrt(x))};
async function h(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('')}
async function dayKey(room,date,id){return 'sq26w-'+(await h('walk|'+room+'|'+date+'|'+id)).slice(0,40)}
async function idxKey(room){return 'sq26i-'+(await h('walkidx|'+room)).slice(0,40)}
async function get(k){const r=await fetch(API+k+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('get '+r.status);const t=await r.text();if(!t)return null;let v=JSON.parse(t);if(typeof v==='string')v=JSON.parse(v);return v}
async function put(k,v,keep){const r=await fetch(API+k,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(v),keepalive:!!keep});if(!r.ok)throw new Error('put '+r.status)}
// 合併兩組點：有時間的照時間排序去重；沒時間的（舊足跡補傳）放在 raw
function merge(a,b){a=a||{};b=b||{};const m=new Map();[...(a.p||[]),...(b.p||[])].forEach(x=>m.set(x[2],x));
  const raw=(b.raw&&b.raw.length>(a.raw||[]).length)?b.raw:(a.raw||[]);
  return {id:b.id||a.id,n:b.n||a.n,e:b.e||a.e,d:b.d||a.d,p:[...m.values()].sort((x,y)=>x[2]-y[2]),raw}}
const LK=(id,d)=>'walk_'+id+'_'+d;
const T={dayKey,idxKey,get,put,merge,sdate,dist,
loadLocal(id,d){try{return JSON.parse(localStorage.getItem(LK(id,d))||'null')}catch(e){return null}},
saveLocal(id,d,v){try{localStorage.setItem(LK(id,d),JSON.stringify(v))}catch(e){}},
localDays(id){const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('walk_'+id+'_'))out.push(k.slice(('walk_'+id+'_').length))}return out.sort()},
async addToIndex(room,id,n,e,d){const k=await idxKey(room);let ix=null;try{ix=await get(k)}catch(x){}ix=ix||{m:{},days:{}};ix.m=ix.m||{};ix.days=ix.days||{};
  const had=ix.m[id]&&ix.m[id].n===n&&ix.m[id].e===e&&(ix.days[d]||[]).includes(id);if(had)return;
  ix.m[id]={n,e};ix.days[d]=[...new Set([...(ix.days[d]||[]),id])];await put(k,ix)},
// 上傳某天：讀雲端→合併→寫回
async upload(room,id,d,keep){const loc=this.loadLocal(id,d);if(!loc||(!(loc.p||[]).length&&!(loc.raw||[]).length))return 0;
  const k=await dayKey(room,d,id);let rem=null;try{rem=await get(k)}catch(x){}const m=merge(rem,loc);await put(k,m,keep);this.saveLocal(id,d,Object.assign(m,{up:(m.p||[]).length}));
  await this.addToIndex(room,id,m.n,m.e,d);return (m.p||[]).length+(m.raw||[]).length},
// ===== 錄音機 =====
start(){const F=window.FamilyMap;if(!F||this.on)return;this.on=1;let last=null,wid=null,dirty=false;
  const rec=p=>{if(!F.sharing||!F.id)return;const c=p.coords;if(c.accuracy>80)return;const t=Math.round((p.timestamp||Date.now())/1000),d=sdate(t*1000);
    let v=this.loadLocal(F.id,d)||{id:F.id,d,p:[]};v.n=F.name();v.e=F.emoji();v.p=v.p||[];const l=v.p[v.p.length-1];
    if(l&&dist(l[0],l[1],c.latitude,c.longitude)<=15&&t-l[2]<60)return;if(l&&t<=l[2])return;
    v.p.push([+c.latitude.toFixed(6),+c.longitude.toFixed(6),t]);this.saveLocal(F.id,d,v);dirty=true;this.cur=d};
  const tick=()=>{const on=F.sharing&&F.id;if(on&&wid==null&&navigator.geolocation)wid=navigator.geolocation.watchPosition(rec,()=>{},{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
    if(!on&&wid!=null){navigator.geolocation.clearWatch(wid);wid=null}};
  this.flush=async keep=>{if(!dirty||!F.id||!F.sharing)return;dirty=false;try{await this.upload(F.room,F.id,this.cur||sdate(),keep)}catch(e){dirty=true}};
  this._rec=rec;tick();setInterval(tick,5000);setInterval(()=>this.flush(),120000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')this.flush(true)});
  window.addEventListener('pagehide',()=>this.flush(true))},
// ===== 補傳舊足跡（gyeongbok.html 的 localStorage.gbTrail，沒有時間戳）＋本機每天的紀錄 =====
async backfill(date){const F=window.FamilyMap;if(!F||!F.id)throw new Error('noid');let n=0;
  const tr=JSON.parse(localStorage.gbTrail||'[]');if(tr.length&&date){let v=this.loadLocal(F.id,date)||{id:F.id,d:date,p:[]};v.n=F.name();v.e=F.emoji();
    v.raw=tr.map(x=>[+(+x[0]).toFixed(6),+(+x[1]).toFixed(6)]);this.saveLocal(F.id,date,v)}
  for(const d of this.localDays(F.id))n+=await this.upload(F.room,F.id,d);return n}
};
window.Tracks=T;})();
