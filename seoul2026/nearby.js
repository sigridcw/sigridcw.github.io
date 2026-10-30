/* 「我旁邊有什麼」nearby.js — 只放真正的景點（古蹟、寺廟、紀念碑、博物館、公園、公共藝術、地標建築），不放店家。
   資料：OSM Overpass（tourism=attraction|museum|artwork|viewpoint、historic=*、amenity=place_of_worship 有名字、leisure=park 有名字）
         ＋ 維基百科 geosearch（zh 優先、用 zh-tw 字形；沒有中文就用 ko/en 原文）。快取在 localStorage 24 小時。
   用法：Nearby.init(map,{pre:[[lat,lng,icon,中文名,韓文名,一句話,冷知識],...]})                                   */
(function(){
const css=`.nb-pin{display:flex;align-items:center;gap:3px;background:rgba(255,254,249,.95);border:1.5px solid #789681;border-radius:12px;padding:2px 6px 2px 3px;font:600 11px var(--sans,system-ui);color:#10272c;box-shadow:0 2px 6px rgba(0,0,0,.2);white-space:nowrap;cursor:pointer}
.nb-pin i{font-style:normal;font-size:15px}.nb-pin.live{border-color:#c56f45;border-style:dashed}.nbz .nb-pin span{display:none}
#nbCard{position:fixed;left:0;right:0;bottom:0;z-index:1500;background:#fffef9;border-radius:24px 24px 0 0;box-shadow:0 -10px 40px rgba(21,43,45,.3);padding:16px 18px calc(18px + env(safe-area-inset-bottom));font:17px/1.65 var(--sans,system-ui);color:#10272c;transform:translateY(110%);transition:transform .25s;max-height:70dvh;overflow:auto}
#nbCard.show{transform:none}#nbCard h2{font-family:var(--serif,serif);font-size:23px;margin:2px 0}#nbCard .ko{color:#6c7d7d;font-size:15px}#nbCard h4{color:#c56f45;margin:12px 0 2px}#nbCard .x{float:right;border:0;border-radius:50%;width:46px;height:46px;font-size:22px;background:#f3dfd1}
#nbCard .src{font-size:12px;color:#6c7d7d;margin-top:10px}#nbCard a{color:#c56f45}
#nbBtn{position:fixed;left:10px;top:calc(76px + env(safe-area-inset-top));z-index:640;border:0;border-radius:24px;min-height:46px;padding:0 14px;font:700 16px var(--sans,system-ui);background:#fffef9;box-shadow:0 6px 18px rgba(21,43,45,.18)}#nbBtn.on{background:#dfe9df}`;
const ICON=k=>k.historic==='tomb'?'👑':k.historic?'🏛️':k.amenity==='place_of_worship'?(k.religion==='buddhist'?'🛕':k.religion==='christian'?'⛪':'🙏'):k.tourism==='museum'?'🖼️':k.tourism==='artwork'?'🗿':k.tourism==='viewpoint'?'🔭':k.leisure==='park'?'🌳':'⭐';
const KIND=k=>k.historic==='tomb'?'王陵／古墓':k.historic==='memorial'||k.historic==='monument'?'紀念碑':k.historic?'古蹟':k.amenity==='place_of_worship'?'宗教場所':k.tourism==='museum'?'博物館／美術館':k.tourism==='artwork'?'公共藝術':k.tourism==='viewpoint'?'觀景點':k.leisure==='park'?'公園':'景點';
const BAD=/카페|커피|cafe|coffee|베이커리|디저트|기념품|뷰티|올리브영|shop|store|mall|몰|호텔|hotel|주차|parking|카지노|casino|치과|병원|테니스/i;
const NB={layer:null,on:true,shown:{},init(map,opt){opt=opt||{};this.map=map;const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  this.layer=L.layerGroup().addTo(map);const c=document.createElement('div');c.id='nbCard';document.body.appendChild(c);
  const b=document.createElement('button');b.id='nbBtn';b.className='on';b.textContent='🏛️ 附近景點';document.body.appendChild(b);
  b.onclick=()=>{this.on=!this.on;b.classList.toggle('on',this.on);this.on?this.layer.addTo(map):map.removeLayer(this.layer);if(this.on)this.live(true)};
  (opt.pre||[]).forEach(p=>this.add(p[0],p[1],p[2],p[3],{ko:p[4],one:p[5],fun:p[6],src:p[7]||'實地資料已查證'},false));
  const z=()=>document.getElementById('map').classList.toggle('nbz',map.getZoom()<16);map.on('zoomend',z);z();
  if(navigator.geolocation)navigator.geolocation.watchPosition(p=>{this.me=[p.coords.latitude,p.coords.longitude];this.live(false)},()=>{},{enableHighAccuracy:true,maximumAge:10000,timeout:30000});
  map.on('moveend',()=>{clearTimeout(this.mt);this.mt=setTimeout(()=>{if(map.getZoom()>=16)this.live(false,map.getCenter())},1500)})},
key(la,ln){return 'nb_'+la.toFixed(3)+'_'+ln.toFixed(3)},
add(la,ln,ic,zh,d,live){const k=zh+Math.round(la*2e3)+Math.round(ln*2e3);if(this.shown[k])return;this.shown[k]=1;
  const m=L.marker([la,ln],{icon:L.divIcon({className:'',html:`<div class="nb-pin ${live?'live':''}"><i>${ic}</i><span>${zh}</span></div>`,iconSize:null,iconAnchor:[12,12]}),zIndexOffset:-100}).addTo(this.layer);
  m.on('click',()=>this.card(zh,d,la,ln))},
card(zh,d,la,ln){const c=document.getElementById('nbCard');
  c.innerHTML=`<button class="x">✕</button><div class="ko">${d.kind||'🏛️ 附近景點'}</div><h2>${zh}</h2><div class="ko">${d.ko||''}</div>${d.one?`<h4>這是什麼</h4><p>${d.one}</p>`:''}${d.fun?`<h4>💡 冷知識</h4><p>${d.fun}</p>`:''}
  <div class="nav" style="display:flex;gap:8px;margin-top:12px"><a style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:#03c75a;color:#fff;text-decoration:none;font-weight:700" target="_blank" href="https://map.naver.com/p/search/${encodeURIComponent(d.ko||zh)}">🧭 Naver</a><a style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:#10272c;color:#fff;text-decoration:none;font-weight:700" target="_blank" href="https://maps.apple.com/?daddr=${la},${ln}&dirflg=w">🍎 Apple</a></div><div class="src">${d.src||''}</div>`;
  c.querySelector('.x').onclick=()=>c.classList.remove('show');c.classList.add('show')},
async live(force,center){if(!this.on)return;const p=center?[center.lat,center.lng]:this.me;if(!p)return;const k=this.key(p[0],p[1]);
  if(!force&&this.lastK===k)return;this.lastK=k;try{const c=JSON.parse(localStorage.getItem(k)||'null');if(c&&Date.now()-c.t<864e5&&c.d.length){c.d.forEach(x=>this.add(x[0],x[1],x[2],x[3],x[4],true));return}}catch(e){}
  const all=[],save=()=>{try{localStorage.setItem(k,JSON.stringify({t:Date.now(),d:all}))}catch(e){}};
  const put=arr=>{arr.forEach(x=>{if(all.some(y=>Math.abs(y[0]-x[0])<4e-4&&Math.abs(y[1]-x[1])<4e-4&&(y[3]===x[3]||y[2]==='📖')))return;all.push(x);this.add(x[0],x[1],x[2],x[3],x[4],true)});save()};
  this.wiki(p[0],p[1]).then(put).catch(()=>{});this.osm(p[0],p[1]).then(put).catch(()=>{})},
tfetch(u,o,ms){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);return fetch(u,Object.assign({signal:c.signal},o||{})).finally(()=>clearTimeout(t))},
async wiki(la,ln){const r=await this.tfetch(`https://zh.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${la}|${ln}&ggsradius=400&ggslimit=15&prop=extracts|coordinates&exintro=1&explaintext=1&exsentences=2&variant=zh-tw&format=json&origin=*`,null,10000);const w=await r.json();const out=[];
  if(w&&w.query)Object.values(w.query.pages).forEach(pg=>{if(!pg.coordinates||BAD.test(pg.title))return;out.push([pg.coordinates[0].lat,pg.coordinates[0].lon,'📖',pg.title,{kind:'📖 維基百科',one:(pg.extract||'').slice(0,160),src:'資料：中文維基百科（即時）'}])});return out},
async osm(la,ln){const R=400;const q=`[out:json][timeout:15];(nwr(around:${R},${la},${ln})[tourism~"^(attraction|museum|artwork|viewpoint)$"][name];nwr(around:${R},${la},${ln})[historic][name];nwr(around:${R},${la},${ln})[amenity=place_of_worship][name][wikidata];nwr(around:${R},${la},${ln})[leisure=park][name];);out center tags 40;`;
  let o=null;for(const u of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']){try{const r=await this.tfetch(u,{method:'POST',body:'data='+encodeURIComponent(q)},14000);if(r.ok){o=await r.json();break}}catch(e){}}
  const out=[];if(o&&o.elements)o.elements.forEach(e=>{const t=e.tags||{};const nm=t['name:zh-Hant']||t['name:zh']||t.name;if(!nm||BAD.test(nm+' '+(t.name||'')))return;
    if(t.amenity==='place_of_worship'&&!t.wikidata)return;const a=e.lat??e.center?.lat,b=e.lon??e.center?.lon;
    out.push([a,b,ICON(t),nm,{kind:ICON(t)+' '+KIND(t),ko:t.name!==nm?t.name:(t['name:en']||''),one:t['description:zh']||t.description||(t['name:en']?'英文名：'+t['name:en']:''),src:'資料：OpenStreetMap（即時）'}])});return out.slice(0,30)}
};window.Nearby=NB;})();
