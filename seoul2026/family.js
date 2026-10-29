/* 家人即時位置 family.js — 共用元件（gyeongbok.html、coex.html）
   中繼：ntfy.sh（免費、免註冊、CORS: Access-Control-Allow-Origin: *，2026-10-29 從 box 實測兩個 client 互傳成功）
   房間 = 網址 ?room=<長亂數>；只有拿到連結的人才看得到。只有頁面開著＋開關打開時才送位置。
   用法：FamilyMap.init(leafletMap)                                                         */
(function(){
const RELAY='https://ntfy.sh/';
const DEF={dad:['爸爸','🍎'],ching:['Ching','🐻'],mom:['媽媽','']};
const PICK=['🌸','🐰','🐱','🦊','🌷','🍓','🐼','🦋','🌻','🐶','🍑','⭐'];
const css=`.fam-bar{position:fixed;right:10px;top:calc(76px + env(safe-area-inset-top));z-index:640;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
.fam-bar button{border:0;border-radius:24px;min-height:46px;padding:0 14px;font:700 16px var(--sans,system-ui);background:#fffef9;color:#10272c;box-shadow:0 6px 18px rgba(21,43,45,.18)}
.fam-bar button.on{background:#dfe9df;color:#2f5a3c}.fam-bar button.off{background:#f2dcd6;color:#a84f40}
.fam-m{display:flex;flex-direction:column;align-items:center;pointer-events:auto}
.fam-m .e{width:46px;height:46px;border-radius:50%;background:#fffef9;border:3px solid #c56f45;display:grid;place-items:center;font-size:28px;box-shadow:0 3px 8px rgba(0,0,0,.3)}
.fam-m.old .e{opacity:.55;border-color:#9aa}.fam-m .n{margin-top:2px;background:rgba(16,39,44,.85);color:#fff;border-radius:10px;padding:1px 7px;font:700 12px var(--sans,system-ui);white-space:nowrap}
#famDlg{position:fixed;inset:0;z-index:2000;background:rgba(16,39,44,.45);display:none;align-items:flex-end;justify-content:center}
#famDlg.show{display:flex}#famDlg .bx{background:#f6f3ec;width:100%;max-width:520px;border-radius:24px 24px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));font:17px/1.6 var(--sans,system-ui);color:#10272c;max-height:88dvh;overflow:auto}
#famDlg h3{font-family:var(--serif,serif);margin:0 0 8px;font-size:22px}#famDlg input{width:100%;font-size:20px;padding:10px;border-radius:12px;border:1px solid #d9ddd5}
#famDlg .pk{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}#famDlg .pk button{width:56px;height:56px;font-size:30px;border-radius:14px;border:2px solid #d9ddd5;background:#fff}
#famDlg .pk button.sel{border-color:#c56f45;background:#f3dfd1}#famDlg .ok{width:100%;min-height:52px;border:0;border-radius:16px;background:#c56f45;color:#fff;font:700 19px var(--sans,system-ui);margin-top:10px}
#famDlg .note{font-size:14px;color:#6c7d7d;margin-top:10px}#famDlg .lk{display:flex;gap:6px;margin:6px 0}#famDlg .lk button{flex:1;min-height:44px;border-radius:12px;border:1px solid #d9ddd5;background:#efe6d3;font-size:15px}`;
function rid(){const a=new Uint8Array(18);crypto.getRandomValues(a);return Array.from(a,b=>'abcdefghijkmnpqrstuvwxyz23456789'[b%32]).join('')}
const FM={members:{},markers:{},init(map,opt){
  opt=opt||{};this.map=map;const q=new URLSearchParams(location.search);
  let room=q.get('room')||localStorage.getItem('fam_room');if(!room){room=opt.defaultRoom||rid()}localStorage.setItem('fam_room',room);this.room=room;
  let id=(q.get('me')||localStorage.getItem('fam_me')||'').toLowerCase();this.id=id;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  const bar=document.createElement('div');bar.className='fam-bar';bar.innerHTML='<button id="famAll">👨‍👩‍👧 家人</button><button id="famTog">📡 分享：關</button>';document.body.appendChild(bar);
  const dlg=document.createElement('div');dlg.id='famDlg';dlg.innerHTML='<div class="bx"></div>';document.body.appendChild(dlg);
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.classList.remove('show')});
  document.getElementById('famAll').onclick=()=>this.fit();
  document.getElementById('famTog').onclick=()=>{if(!this.id||!this.name()||!this.emoji()){this.setup(true);return}this.setShare(!this.sharing)};
  this.sub();
  if(!this.id||!this.emoji()||localStorage.getItem('fam_share')==null)this.setup(false);else this.setShare(localStorage.getItem('fam_share')!=='0');
  setInterval(()=>this.redraw(),30000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&this.sharing)this.send(true)});
},
name(){return localStorage.getItem('fam_name_'+this.id)||(DEF[this.id]||[])[0]||''},
emoji(){return localStorage.getItem('fam_emoji_'+this.id)||(DEF[this.id]||[])[1]||''},
link(who){const u=new URL(location.href.split('?')[0].split('#')[0]);u.searchParams.set('room',this.room);u.searchParams.set('me',who);return u.toString()},
setup(thenShare){const dlg=document.getElementById('famDlg'),bx=dlg.querySelector('.bx');let em=this.emoji()||'🌸';
  const isNew=!DEF[this.id]&&!this.id;
  bx.innerHTML=`<h3>📍 家人位置</h3><div>我是：</div>
  <div class="lk">${Object.keys(DEF).map(k=>`<button data-w="${k}" style="${k===this.id?'background:#f3dfd1;border-color:#c56f45':''}">${DEF[k][1]||'🌸'} ${DEF[k][0]}</button>`).join('')}</div>
  <div style="margin-top:8px">名字</div><input id="famName" value="${this.name()}" placeholder="例如：媽媽">
  <div style="margin-top:10px">選一個圖案</div><div class="pk">${['🍎','🐻',...PICK].map(e=>`<button class="${e===em?'sel':''}">${e}</button>`).join('')}</div>
  <button class="ok" id="famOk">✅ 好了，開始分享我的位置</button>
  <div class="lk" style="margin-top:12px"><button id="famL1">🔗 複製爸爸連結</button><button id="famL2">🔗 複製媽媽連結</button></div>
  <div class="note">🔒 隱私：只有拿到這個連結的家人看得到。只有這個網頁開著、開關是「開」的時候才會送出位置；關掉網頁就停止。位置約 12 小時後自動刪除。房間代號：${this.room.slice(0,6)}…</div>`;
  bx.querySelectorAll('.lk button[data-w]').forEach(b=>b.onclick=()=>{this.id=b.dataset.w;localStorage.setItem('fam_me',this.id);this.setup(thenShare)});
  bx.querySelectorAll('.pk button').forEach(b=>b.onclick=()=>{em=b.textContent;bx.querySelectorAll('.pk button').forEach(x=>x.classList.toggle('sel',x===b))});
  const cp=(t,b)=>{(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{b.textContent='✅ 已複製'}).catch(()=>prompt('複製這個連結',t))};
  bx.querySelector('#famL1').onclick=e=>cp(this.link('dad'),e.target);bx.querySelector('#famL2').onclick=e=>cp(this.link('mom'),e.target);
  bx.querySelector('#famOk').onclick=()=>{if(!this.id){this.id='p'+rid().slice(0,5)}localStorage.setItem('fam_me',this.id);
    localStorage.setItem('fam_name_'+this.id,bx.querySelector('#famName').value.trim()||'家人');localStorage.setItem('fam_emoji_'+this.id,em);dlg.classList.remove('show');this.setShare(true)};
  dlg.classList.add('show')},
setShare(on){this.sharing=on;localStorage.setItem('fam_share',on?'1':'0');const b=document.getElementById('famTog');
  b.textContent=on?`${this.emoji()} 分享中：開`:'📡 分享：關';b.className=on?'on':'off';
  if(on){if(this.wid==null&&navigator.geolocation)this.wid=navigator.geolocation.watchPosition(p=>{this.pos=[p.coords.latitude,p.coords.longitude,Math.round(p.coords.accuracy)];this.send(false)},()=>{},{enableHighAccuracy:true,maximumAge:5000,timeout:20000})}
  else{if(this.wid!=null)navigator.geolocation.clearWatch(this.wid);this.wid=null;this.publish({id:this.id,off:1})}},
send(force){if(!this.sharing||!this.pos)return;const now=Date.now(),l=this.last;
  if(!force&&l&&now-l.t<15000&&Math.hypot((l.p[0]-this.pos[0])*111e3,(l.p[1]-this.pos[1])*88e3)<25&&now-l.t<60000)return;
  if(!force&&l&&now-l.t<8000)return;this.last={t:now,p:this.pos};
  this.publish({id:this.id,n:this.name(),e:this.emoji(),la:+this.pos[0].toFixed(6),ln:+this.pos[1].toFixed(6),a:this.pos[2],t:Math.round(now/1000)})},
publish(o){fetch(RELAY+this.room,{method:'POST',body:JSON.stringify(o)}).catch(()=>{})},
sub(){try{const es=new EventSource(RELAY+this.room+'/sse?since=2h');es.onmessage=ev=>{try{const m=JSON.parse(ev.data);if(m.event&&m.event!=='message')return;const o=JSON.parse(m.message);this.onMsg(o)}catch(e){}};this.es=es}catch(e){}},
onMsg(o){if(!o||!o.id)return;if(o.off){const m=this.members[o.id];if(m){m.off=1;this.redraw()}return}if(typeof o.la!=='number')return;
  const cur=this.members[o.id];if(cur&&cur.t>o.t)return;this.members[o.id]=o;this.redraw()},
ago(t){const m=Math.max(0,Math.round((Date.now()/1000-t)/60));return m<1?'剛剛':m<60?m+' 分鐘前':Math.round(m/60)+' 小時前'},
redraw(){for(const id in this.members){const o=this.members[id];const old=(Date.now()/1000-o.t)>600||o.off;
  const self=id===this.id;const html=`<div class="fam-m ${old?'old':''}"><div class="e">${o.e||'📍'}</div><div class="n">${o.n||id}${self?'（我）':''} · ${o.off?'已關閉':this.ago(o.t)}</div></div>`;
  const ic=L.divIcon({className:'',html,iconSize:[120,70],iconAnchor:[60,23]});
  if(this.markers[id]){this.markers[id].setLatLng([o.la,o.ln]).setIcon(ic)}else{this.markers[id]=L.marker([o.la,o.ln],{icon:ic,zIndexOffset:900}).addTo(this.map)}}},
fit(){const pts=Object.values(this.members).map(o=>[o.la,o.ln]);if(this.pos)pts.push([this.pos[0],this.pos[1]]);
  if(!pts.length){alert('還沒有家人分享位置。按「分享」打開，或把連結傳給爸爸媽媽。');this.setup(false);return}
  if(pts.length===1)this.map.setView(pts[0],17);else this.map.fitBounds(pts,{padding:[70,70],maxZoom:17})}
};
window.FamilyMap=FM;})();
