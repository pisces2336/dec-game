type Tab = 'core' | 'machines' | 'research' | 'archive';
type State = {
  entropy: number; // remaining entropy: player aims to reduce it
  energy: number;
  matter: number;
  insight: number;
  fragments: number;
  totalErased: number;
  cycles: number;
  tick: number;
  upgrades: Record<string, number>;
  research: string[];
  tab: Tab;
  lastSave: number;
};
const KEY = 'void-protocol-save-v1';
const initial = (): State => ({ entropy: 1e9, energy: 120, matter: 60, insight: 0, fragments: 0, totalErased: 0, cycles: 0, tick: 0, upgrades: {}, research: [], tab: 'core', lastSave: Date.now() });
let state: State = load();
let toastTimer = 0;
function load(): State {
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...initial(), ...JSON.parse(raw), tab: 'core' }; } catch {}
  return initial();
}
function save() { state.lastSave = Date.now(); localStorage.setItem(KEY, JSON.stringify(state)); }
const $ = (id: string) => document.getElementById(id)!;
const fmt = (n: number) => {
  if (!Number.isFinite(n)) return '∞';
  if (Math.abs(n) < 1000) return n.toLocaleString('ja-JP', { maximumFractionDigits: 2 });
  const units = ['','K','M','B','T','Qa','Qi','Sx','Sp','Oc','No'];
  let x = Math.abs(n), i = 0; while (x >= 1000 && i < units.length - 1) { x /= 1000; i++; }
  return (n < 0 ? '-' : '') + x.toLocaleString('en-US', { maximumFractionDigits: 2 }) + units[i];
};
const pct = (n: number, max: number) => Math.max(0, Math.min(100, n / max * 100));
const cost = (id: string, base: number) => base * Math.pow(1.65, state.upgrades[id] || 0);
const count = (id: string) => state.upgrades[id] || 0;
const researchDone = (id: string) => state.research.includes(id);
function notify(s: string) { $('toast').textContent = s; $('toast').classList.add('show'); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => $('toast').classList.remove('show'), 2200); }
function erase(amount: number) {
  const actual = Math.min(state.entropy, Math.max(0, amount));
  state.entropy -= actual; state.totalErased += actual;
  state.insight += Math.sqrt(actual) * (researchDone('deep') ? 1.6 : 1);
  if (state.entropy <= 0) { state.entropy = 0; notify('特異点到達。アーカイブから次元を再構築できます。'); }
}
const machines = [
  { id:'drone', name:'消去ドローン', icon:'⌁', desc:'微細な情報粒子を自動消去する。', base:18, energy:1.2, matter:0, power:2.5, unlock:0 },
  { id:'compiler', name:'反存在コンパイラ', icon:'⌘', desc:'存在データを反存在へ変換。', base:85, energy:4, matter:1, power:13, unlock:0 },
  { id:'accelerator', name:'因果加速器', icon:'⟁', desc:'因果律を歪め、消去速度を跳ね上げる。', base:360, energy:12, matter:3, power:72, unlock:0 },
  { id:'singularity', name:'人工特異点', icon:'◉', desc:'局所宇宙を吸収し続ける。', base:1800, energy:32, matter:8, power:420, unlock:0 },
  { id:'nullifier', name:'ヌル・エンジン', icon:'⟡', desc:'存在の定義そのものを抹消する。', base:9000, energy:85, matter:22, power:2600, unlock:0 },
];
const studies = [
  {id:'deep',name:'深層観測',icon:'◌',desc:'消去から得る洞察 +60%。',cost:80,req:0},
  {id:'efficiency',name:'熱力学逆転',icon:'♨',desc:'機械のエネルギー消費 -25%。',cost:220,req:0},
  {id:'matter',name:'物質錬成',icon:'◆',desc:'物質の自動生成を解禁。',cost:480,req:0},
  {id:'cascade',name:'連鎖崩壊',icon:'⛓',desc:'全機械の消去出力 ×2.5。',cost:1200,req:0},
  {id:'fracture',name:'次元亀裂',icon:'✳',desc:'フラグメント獲得量 ×2。',cost:3600,req:0},
  {id:'offline',name:'時間の残響',icon:'◷',desc:'オフライン進行を最大8時間まで有効化。',cost:8000,req:0},
  {id:'autobuy',name:'自己複製設計',icon:'⟳',desc:'毎秒、購入可能な最安機械を自動購入。',cost:18000,req:0},
  {id:'void',name:'虚無の理解',icon:'☷',desc:'消去出力 ×10。終焉が加速する。',cost:50000,req:0},
];
function power() {
  const raw = machines.reduce((s,m) => s + count(m.id)*m.power, 0);
  return raw * (researchDone('cascade') ? 2.5 : 1) * (researchDone('void') ? 10 : 1) * (1 + count('lens')*.18);
}
function energyUse() { return machines.reduce((s,m)=>s+count(m.id)*m.energy,0)*(researchDone('efficiency')?.75:1); }
function matterUse() { return machines.reduce((s,m)=>s+count(m.id)*m.matter,0); }
function render() {
  $('entropy').textContent = fmt(state.entropy);
  $('energy').textContent = fmt(state.energy);
  $('matter').textContent = fmt(state.matter);
  $('insight').textContent = fmt(state.insight);
  $('fragments').textContent = fmt(state.fragments);
  $('rate').textContent = fmt(power()) + ' / 秒';
  $('entropybar').style.width = pct(state.entropy,1e9) + '%';
  $('energybar').style.width = pct(state.energy,Math.max(120,energyUse()*8)) + '%';
  $('matterbar').style.width = pct(state.matter,Math.max(60,matterUse()*8)) + '%';
  $('erased').textContent = fmt(state.totalErased);
  $('cycles').textContent = String(state.cycles);
  $('tick').textContent = fmt(state.tick);
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===state.tab));
  if (state.tab==='core') renderCore();
  if (state.tab==='machines') renderMachines();
  if (state.tab==='research') renderResearch();
  if (state.tab==='archive') renderArchive();
}
function renderCore() {
  $('panel').innerHTML = `
    <div class="section-head"><div><div class="eyebrow">PRIMARY DIRECTIVE</div><h2>存在を減算せよ</h2><p>宇宙の情報量を削り、エントロピーをゼロへ導く。</p></div><span class="pill danger">LIVE</span></div>
    <div class="core-wrap"><div class="core-orbit orbit-a"></div><div class="core-orbit orbit-b"></div><button class="core-button" id="pulse" aria-label="手動消去"><span class="core-glyph">∅</span><small>NULL</small></button><div class="core-caption">手動消去 <span>クリックで減算</span></div></div>
    <div class="action-grid"><button class="action" id="compress"><span>⌬</span><b>情報圧縮</b><small>消去 1,000 / 物質 8</small></button><button class="action" id="convert"><span>◈</span><b>エネルギー変換</b><small>物質 10 → エネルギー 35</small></button><button class="action" id="sacrifice"><span>♢</span><b>洞察を犠牲にする</b><small>洞察 25 → 消去出力を一時強化</small></button></div>
    <div class="log"><div class="eyebrow">SYSTEM LOG</div><div id="logs"><p>▸ VOID PROTOCOL initialized.</p><p>▸ 減算対象を検出。手動操作または機械を起動してください。</p></div></div>`;
  $('pulse').addEventListener('click',()=>{erase(10+count('lens')*3);state.energy=Math.max(0,state.energy-.1);log('手動減算を実行。エントロピー -'+fmt(10+count('lens')*3));render();});
  $('compress').addEventListener('click',()=>{if(state.matter<8){notify('物質が不足しています');return;}state.matter-=8;erase(1000);state.energy+=8;log('情報圧縮完了。1,000単位を減算。');render();});
  $('convert').addEventListener('click',()=>{if(state.matter<10){notify('物質が不足しています');return;}state.matter-=10;state.energy+=35;notify('エネルギー +35');render();});
  $('sacrifice').addEventListener('click',()=>{if(state.insight<25){notify('洞察が不足しています');return;}state.insight-=25;state.energy+=20;erase(500);notify('洞察を変換しました');render();});
}
function log(s:string){const el=$('logs');if(el){el.innerHTML='<p>▸ '+s+'</p>'+el.innerHTML;while(el.children.length>6)el.lastElementChild?.remove();}}
function renderMachines() {
  $('panel').innerHTML='<div class="section-head"><div><div class="eyebrow">AUTOMATION ARRAY</div><h2>機械群</h2><p>資源を投じて、宇宙の減算を自動化する。</p></div><span class="pill">'+fmt(power())+'/s</span></div><div class="machine-list">'+machines.map(m=>{
    const c=cost(m.id,m.base),owned=count(m.id),can=state.energy>=m.energy&&state.matter>=m.matter&&state.insight>=c;
    return `<article class="machine"><div class="machine-icon">${m.icon}</div><div class="machine-info"><div class="machine-title"><h3>${m.name}</h3><span class="owned">× ${owned}</span></div><p>${m.desc}</p><div class="machine-meta"><span>出力 ${fmt(m.power)} / 秒</span><span>電力 ${m.energy}</span><span>物質 ${m.matter}</span></div></div><button class="buy" data-buy="${m.id}" ${can?'':'disabled'}><b>建造</b><small>洞察 ${fmt(c)}</small></button></article>`;
  }).join('')+'</div><div class="hint">機械は毎秒エネルギーを消費します。電力が枯渇すると出力が停止します。</div>';
  document.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(b=>b.addEventListener('click',()=>buyMachine(b.dataset.buy!)));
}
function buyMachine(id:string){const m=machines.find(x=>x.id===id)!;const c=cost(id,m.base);if(state.energy<m.energy||state.matter<m.matter||state.insight<c)return;state.energy-=m.energy;state.matter-=m.matter;state.insight-=c;state.upgrades[id]=(state.upgrades[id]||0)+1;notify(m.name+'を建造');render();}
function renderResearch(){
  $('panel').innerHTML='<div class="section-head"><div><div class="eyebrow">KNOWLEDGE SINGULARITY</div><h2>研究室</h2><p>洞察を消費して宇宙の法則を書き換える。</p></div><span class="pill">'+fmt(state.insight)+' INS</span></div><div class="research-grid">'+studies.map(s=>{
    const done=researchDone(s.id),can=state.insight>=s.cost;
    return `<article class="study ${done?'complete':''}"><div class="study-icon">${s.icon}</div><div class="study-top"><h3>${s.name}</h3><span>${done?'✓ 完了':'研究 '+fmt(s.cost)+' INS'}</span></div><p>${s.desc}</p><button class="study-btn" data-study="${s.id}" ${done||!can?'disabled':''}>${done?'研究済み':can?'研究を開始':'洞察が不足'}</button></article>`;
  }).join('')+'</div>';
  document.querySelectorAll<HTMLButtonElement>('[data-study]').forEach(b=>b.addEventListener('click',()=>{const s=studies.find(x=>x.id===b.dataset.study)!;if(researchDone(s.id)||state.insight<s.cost)return;state.insight-=s.cost;state.research.push(s.id);notify('研究完了：'+s.name);render();}));
}
function renderArchive(){
  $('panel').innerHTML=`<div class="section-head"><div><div class="eyebrow">DIMENSIONAL ARCHIVE</div><h2>次元アーカイブ</h2><p>宇宙を完全に減算した後、残滓を持って新しい次元を開始する。</p></div><span class="pill">${state.cycles} CYCLE</span></div>
  <div class="archive-hero"><div class="archive-symbol">⟲</div><h3>次元再構築</h3><p>エントロピーをゼロにすると再構築可能。フラグメントは恒久的な強化に使われます。</p><div class="fragment-preview">獲得予定 <strong>+ ${fmt(Math.floor(Math.sqrt(state.totalErased/1e6)*(researchDone('fracture')?2:1)))}</strong> FRAG</div><button id="rebuild" class="primary" ${state.entropy>0?'disabled':''}>次元を再構築する</button></div>
  <div class="archive-upgrades"><h3>恒久強化</h3><article class="machine"><div class="machine-icon">✦</div><div class="machine-info"><h3>虚無レンズ × ${count('lens')}</h3><p>手動消去量と機械出力を恒久的に +18%。価格はフラグメント 5 ×購入数倍率。</p></div><button id="lens" class="buy" ${state.fragments<5*Math.pow(2,count('lens'))?'disabled':''}><b>強化</b><small>${5*Math.pow(2,count('lens'))} FRAG</small></button></article></div>`;
  $('rebuild').addEventListener('click',()=>{if(state.entropy>0)return;const gain=Math.floor(Math.sqrt(state.totalErased/1e6)*(researchDone('fracture')?2:1));state.fragments+=gain;state.cycles++;state.entropy=1e9;state.energy=120+state.fragments*2;state.matter=60+state.fragments;state.insight=0;state.totalErased=0;state.upgrades={lens:count('lens')};state.research=[];notify('次元再構築。フラグメント +'+gain);save();render();});
  $('lens').addEventListener('click',()=>{const c=5*Math.pow(2,count('lens'));if(state.fragments<c)return;state.fragments-=c;state.upgrades.lens=count('lens')+1;notify('虚無レンズを強化');render();});
}
document.querySelectorAll<HTMLElement>('[data-tab]').forEach(el=>el.addEventListener('click',()=>{state.tab=el.dataset.tab as Tab;render();}));
function tick(){
  state.tick++;
  const p=power(),use=energyUse();
  const effective=state.energy>0?Math.min(1,state.energy/Math.max(use,0.01)):0;
  erase(p*effective);
  state.energy=Math.max(0,state.energy-use/10);
  if(researchDone('matter'))state.matter+=.35;
  if(state.tick%10===0)state.energy+=2;
  if(researchDone('autobuy')&&state.tick%5===0){const m=machines.find(x=>state.insight>=cost(x.id,x.base)&&state.energy>=x.energy&&state.matter>=x.matter);if(m)buyMachine(m.id);}
  if(state.tick%5===0)save();
  if(state.tick%2===0)render();
}
const app=$('app');
app.innerHTML=`
<div class="app-shell">
<header class="topbar"><a class="brand" href="#"><span class="brand-mark">∅</span><span>VOID <b>PROTOCOL</b><small>UNIVERSE DELETION SYSTEM</small></span></a><div class="top-status"><span class="live-dot"></span> SYSTEM ONLINE <span class="version">v1.0.0</span></div><button id="save" class="top-button">↧ SAVE</button><button id="reset" class="top-button danger-text">↺ RESET</button></header>
<div class="dashboard"><aside class="sidebar"><div class="side-label">STATUS MONITOR</div><div class="resource"><div class="resource-head"><span>◉ エントロピー</span><b id="entropy">—</b></div><div class="bar"><i id="entropybar"></i></div><small>宇宙に残る情報量</small></div><div class="resource"><div class="resource-head"><span>ϟ エネルギー</span><b id="energy">—</b></div><div class="bar energy"><i id="energybar"></i></div><small>機械の稼働資源</small></div><div class="resource"><div class="resource-head"><span>◆ 物質</span><b id="matter">—</b></div><div class="bar matter"><i id="matterbar"></i></div><small>機械建造に必要</small></div><div class="resource insight"><div class="resource-head"><span>✧ 洞察</span><b id="insight">—</b></div><small>研究・機械建造の通貨</small></div><div class="resource fragment"><div class="resource-head"><span>✦ フラグメント</span><b id="fragments">—</b></div><small>次元を超えた恒久資源</small></div><div class="side-divider"></div><div class="side-label">ERASURE RATE</div><div class="rate-card"><strong id="rate">0 / 秒</strong><span>自動減算速度</span></div><div class="side-label stats-label">RUN STATISTICS</div><div class="stat"><span>累計消去</span><b id="erased">0</b></div><div class="stat"><span>次元サイクル</span><b id="cycles">0</b></div><div class="stat"><span>稼働時間</span><b id="tick">0</b><small>秒</small></div></aside>
<main class="main"><nav class="tabs"><button data-tab="core" class="active"><span>⊙</span> コア</button><button data-tab="machines"><span>⌘</span> 機械群</button><button data-tab="research"><span>✧</span> 研究</button><button data-tab="archive"><span>⟲</span> アーカイブ</button></nav><section id="panel" class="panel"></section></main></div>
<footer><span>VOID PROTOCOL <b>·</b> THE END IS A BEGINNING</span><span>LOCAL SAVE ENABLED <i></i></span></footer>
</div><div id="toast" class="toast"></div>`;
$('save').addEventListener('click',()=>{save();notify('セーブしました');});
$('reset').addEventListener('click',()=>{if(confirm('セーブデータを完全に削除して最初から開始しますか？')){localStorage.removeItem(KEY);state=initial();render();notify('データをリセットしました');}});
const style=document.createElement('style');
style.textContent=`
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+JP:wght@400;500;700&display=swap');
:root{color-scheme:dark;--bg:#080912;--panel:#10121e;--panel2:#141725;--line:#25293b;--text:#e8eaf5;--muted:#777f9b;--cyan:#61e5e4;--violet:#a18bff;--red:#ff6685}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 75% 0%,#17142c 0,transparent 42%),var(--bg);color:var(--text);font-family:'Noto Sans JP',sans-serif;font-size:13px}button{font:inherit;cursor:pointer;color:inherit}.app-shell{max-width:1440px;margin:auto;padding:0 30px}.topbar{height:82px;display:flex;align-items:center;border-bottom:1px solid var(--line);gap:18px}.brand{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;font:600 17px 'IBM Plex Mono',monospace;letter-spacing:2px}.brand b{color:var(--cyan)}.brand small{display:block;font:9px 'IBM Plex Mono';color:var(--muted);letter-spacing:1.6px;margin-top:5px}.brand-mark{width:38px;height:38px;border:1px solid #4b4b78;border-radius:11px;display:grid;place-items:center;color:var(--violet);font-size:24px;background:#16152a}.top-status{margin-left:auto;color:#7d87a2;font:10px 'IBM Plex Mono';letter-spacing:1px}.live-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#5de4ad;box-shadow:0 0 9px #5de4ad;margin-right:8px}.version{border:1px solid var(--line);padding:4px 7px;margin-left:8px}.top-button{border:1px solid var(--line);background:#111321;padding:8px 12px;font:10px 'IBM Plex Mono';letter-spacing:1px;border-radius:5px}.top-button:hover{border-color:var(--cyan)}.danger-text{color:var(--red)}.dashboard{display:grid;grid-template-columns:260px minmax(0,1fr);gap:22px;padding:24px 0 35px;min-height:calc(100vh - 130px)}.sidebar{border:1px solid var(--line);background:#0d0f19;border-radius:9px;padding:20px;height:max-content}.side-label,.eyebrow{font:10px 'IBM Plex Mono';letter-spacing:1.7px;color:#858ba8}.resource{margin-top:22px}.resource-head{display:flex;justify-content:space-between;align-items:center;font-size:12px}.resource-head span{color:#a8aec5}.resource-head b{font:500 13px 'IBM Plex Mono';color:#e5e9ff}.bar{height:4px;background:#222538;border-radius:4px;margin:10px 0 7px;overflow:hidden}.bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#5b87ff,#67e8e1);transition:width .25s}.bar.energy i{background:linear-gradient(90deg,#8d73ff,#c4a7ff)}.bar.matter i{background:linear-gradient(90deg,#e2a45b,#ffe09b)}.resource small{font-size:10px;color:#666f8c}.resource.insight .resource-head b{color:var(--violet)}.resource.fragment .resource-head b{color:#f5c875}.side-divider{height:1px;background:var(--line);margin:23px 0}.rate-card{margin-top:13px;padding:14px;background:#141529;border:1px solid #302b50;border-radius:6px}.rate-card strong{font:600 20px 'IBM Plex Mono';color:var(--cyan);display:block}.rate-card span{font-size:10px;color:var(--muted);display:block;margin-top:5px}.stats-label{margin-top:25px}.stat{display:flex;align-items:center;justify-content:space-between;margin-top:13px;color:#969db8;font-size:11px}.stat b{font:12px 'IBM Plex Mono';color:#e0e4f5}.stat small{color:var(--muted);margin-left:-25px}.main{min-width:0}.tabs{display:flex;border:1px solid var(--line);background:#0e101a;border-radius:8px;padding:5px;gap:4px}.tabs button{flex:1;background:transparent;border:0;color:#858ba5;padding:12px 8px;border-radius:5px;font-size:12px}.tabs button span{margin-right:7px;font-size:16px}.tabs button.active{background:#202139;color:#c8c0ff;box-shadow:inset 0 0 0 1px #37345b}.panel{margin-top:18px;border:1px solid var(--line);background:linear-gradient(145deg,#111320,#0e1019);border-radius:9px;padding:26px;min-height:600px}.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.section-head h2{margin:8px 0;font-size:22px;font-weight:500;letter-spacing:.3px}.section-head p{margin:0;color:#838ba7;font-size:12px}.pill{border:1px solid #35314f;border-radius:30px;padding:6px 10px;font:10px 'IBM Plex Mono';color:#b7a8ff;white-space:nowrap}.pill.danger{border-color:#522b42;color:#ff819c}.core-wrap{height:330px;position:relative;display:grid;place-items:center;margin:8px 0}.core-orbit{position:absolute;border:1px solid #292747;border-radius:50%;width:255px;height:255px}.orbit-a{border-style:dashed;animation:spin 38s linear infinite}.orbit-b{width:195px;height:195px;border-color:#343052;animation:spin 25s linear infinite reverse}.core-button{position:relative;width:150px;height:150px;border-radius:50%;border:1px solid #6d5cb5;background:radial-gradient(circle at 50% 45%,#3c306c,#17152e 56%,#0b0c17);box-shadow:0 0 55px #7a5cff24,inset 0 0 28px #9c7aff20;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:.2s}.core-button:hover{transform:scale(1.04);box-shadow:0 0 60px #9b80ff45}.core-glyph{font-size:52px;color:#c3b5ff;text-shadow:0 0 25px #9c82ff}.core-button small{font:10px 'IBM Plex Mono';letter-spacing:3px;color:#8d7ac8;margin-top:3px}.core-caption{position:absolute;bottom:5px;color:#aaa6ca;font-size:12px}.core-caption span{color:#6c7290;margin-left:8px;font-size:10px}.action-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.action{border:1px solid var(--line);background:#141624;border-radius:7px;padding:16px 10px;display:flex;flex-direction:column;align-items:center;gap:7px}.action:hover{border-color:#55517d;background:#1a1b2e}.action>span{font-size:23px;color:var(--violet)}.action b{font-size:12px;font-weight:500}.action small{font-size:10px;color:#777f9c}.log{border-top:1px solid var(--line);margin-top:24px;padding-top:17px}.log p{color:#747d99;font:10px 'IBM Plex Mono';margin:9px 0}.machine-list{display:grid;gap:10px;margin-top:24px}.machine{display:flex;gap:15px;align-items:center;padding:16px;border:1px solid var(--line);background:#141624;border-radius:7px}.machine-icon{width:44px;height:44px;border-radius:8px;background:#202039;display:grid;place-items:center;font-size:23px;color:#b6a7ff;flex-shrink:0}.machine-info{flex:1;min-width:0}.machine-title{display:flex;align-items:center;gap:10px}.machine-title h3,.machine-info h3{font-size:13px;font-weight:500;margin:0}.owned{font:11px 'IBM Plex Mono';color:var(--cyan)}.machine-info p{margin:6px 0;color:#858ca5;font-size:11px}.machine-meta{display:flex;flex-wrap:wrap;gap:12px;color:#656e8b;font:10px 'IBM Plex Mono'}.buy{min-width:100px;border:1px solid #46406d;background:#211e38;border-radius:5px;padding:9px;color:#c6baff}.buy b,.buy small{display:block}.buy b{font-size:11px}.buy small{font:9px 'IBM Plex Mono';margin-top:4px;color:#9b8bd0}.buy:disabled,.study-btn:disabled,.primary:disabled{opacity:.35;cursor:not-allowed}.hint{padding:14px;margin-top:15px;border:1px dashed #30334a;border-radius:6px;color:#737b96;font-size:11px}.research-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:24px}.study{padding:18px;border:1px solid var(--line);background:#141624;border-radius:7px}.study.complete{border-color:#315a54;background:#111e1d}.study-icon{font-size:22px;color:#a99aff}.study-top{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:9px}.study-top h3{font-size:13px;font-weight:500;margin:0}.study-top span{font:9px 'IBM Plex Mono';color:#a69bda}.study p{font-size:11px;color:#858ca5;min-height:32px;line-height:1.7}.study-btn{width:100%;padding:9px;background:#25213d;border:1px solid #403864;color:#c5b9ff;border-radius:5px;font-size:11px}.study.complete .study-btn{background:#1c332e;border-color:#315a54;color:#83dfbd}.archive-hero{text-align:center;border:1px solid #302b4b;background:radial-gradient(ellipse at center,#1a1730,#11121e 68%);border-radius:8px;padding:32px;margin-top:24px}.archive-symbol{font-size:54px;color:#b1a0ff;text-shadow:0 0 25px #8b74ff;animation:spin 20s linear infinite}.archive-hero h3{font-size:18px;font-weight:500;margin:14px}.archive-hero p{color:#858ca5;font-size:11px;max-width:440px;margin:0 auto;line-height:1.8}.fragment-preview{margin:22px;color:#8c84b5;font:11px 'IBM Plex Mono'}.fragment-preview strong{font-size:20px;color:#f0c978;margin-left:8px}.primary{border:1px solid #6e5bb0;background:#352b5a;color:#e0d7ff;padding:12px 22px;border-radius:5px;font-size:12px}.archive-upgrades{margin-top:24px}.archive-upgrades h3{font-size:13px;font-weight:500;margin-bottom:12px}.archive-upgrades .machine{margin-top:10px}footer{border-top:1px solid var(--line);height:48px;display:flex;justify-content:space-between;align-items:center;color:#626a85;font:9px 'IBM Plex Mono';letter-spacing:1px}footer b{color:#a19aff;margin:0 6px}footer i{display:inline-block;width:5px;height:5px;border-radius:50%;background:#58d9a7;margin-left:7px}.toast{position:fixed;bottom:25px;left:50%;transform:translate(-50%,20px);opacity:0;pointer-events:none;padding:12px 18px;border:1px solid #4c4772;background:#19182b;color:#d8d0ff;border-radius:7px;font-size:12px;transition:.2s;z-index:10}.toast.show{opacity:1;transform:translate(-50%,0)}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:900px){.app-shell{padding:0 14px}.dashboard{grid-template-columns:1fr}.sidebar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:15px}.side-label,.side-divider,.stats-label{grid-column:1/-1}.resource{margin-top:0}.side-divider{margin:4px 0}.rate-card{margin-top:0}.stat{margin-top:3px}.top-status{display:none}.panel{padding:17px;min-height:520px}.core-wrap{height:290px}}@media(max-width:520px){.topbar{height:70px;gap:8px}.brand{font-size:14px;letter-spacing:1px}.brand-mark{width:32px;height:32px}.brand small{font-size:7px}.top-button{padding:7px;font-size:9px}.tabs button{padding:10px 3px;font-size:10px}.tabs button span{display:block;margin:0 0 3px}.section-head h2{font-size:19px}.core-wrap{height:260px}.core-orbit{width:220px;height:220px}.orbit-b{width:170px;height:170px}.core-button{width:130px;height:130px}.action-grid{grid-template-columns:1fr}.action{flex-direction:row;justify-content:flex-start;text-align:left;padding:12px}.action>span{width:35px;text-align:center}.action b{min-width:125px}.action small{margin-left:auto}.machine{padding:12px;gap:9px}.machine-icon{width:34px;height:34px;font-size:18px}.machine-meta{gap:7px;font-size:9px}.buy{min-width:78px;padding:8px 5px}.research-grid{grid-template-columns:1fr}.study p{min-height:0}.archive-hero{padding:20px 12px}footer{font-size:8px;letter-spacing:.4px}}`;
document.head.appendChild(style);
render();
setInterval(tick,1000);
