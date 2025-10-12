(function(){
  const EM = { ready:false, fatal:false, report:{}, log:[], overlay:null };
  window.errorManager = EM;
  function ensureOverlay(){
    if(EM.overlay) return;
    const el = document.createElement('div');
    el.id = 'error-overlay';
    el.innerHTML = `
      <h2>Status & Diagnose</h2>
      <div class="row" id="badges"></div>
      <pre id="status"></pre>
      <label>Maschinencode (kopierbar / markierbar):</label>
      <textarea id="code" readonly></textarea>
      <div class="row actions">
        <button id="copyBtn">Code kopieren</button>
        <button id="selectBtn">Alles markieren</button>
        <button id="hideBtn">Schließen</button>
      </div>`;
    document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(el));
    EM.overlay = el;
    const getText = ()=> el.querySelector('#code').value;
    el.querySelector('#copyBtn').onclick = async ()=>{
      try{
        await navigator.clipboard.writeText(getText());
        toast('Code in Zwischenablage kopiert.');
      }catch(e){
        console.warn('Clipboard-API fehlgeschlagen:', e);
        const ta = el.querySelector('#code'); ta.focus(); ta.select(); toast('Text markiert – bitte „Kopieren“ tippen.');
      }
    };
    el.querySelector('#selectBtn').onclick = ()=>{ const ta=el.querySelector('#code'); ta.focus(); ta.select(); toast('Text markiert.'); };
    el.querySelector('#hideBtn').onclick = ()=> el.style.display='none';
  }
  ensureOverlay();
  function toast(msg){
    let t = document.getElementById('toast');
    if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
    t.textContent = msg; t.style.display='block'; setTimeout(()=>t.style.display='none', 2000);
  }
  const badge = (label, ok, warn=false)=>`<span class="badge ${ok?'ok':(warn?'warn':'fail')}">${label}</span>`;
  function encode(obj){ try{ return "MSP-LOG:v1:"+btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }catch(_){ return "ENCODE_FAIL"; } }
  function updateOverlay(){
    if(!EM.overlay) return;
    const b = EM.overlay.querySelector('#badges');
    const s = EM.overlay.querySelector('#status');
    const c = EM.overlay.querySelector('#code');
    const R = EM.report;
    b.innerHTML = [
      badge('JS', true),
      badge('Modules', !!window.document.createElement('script').noModule===false),
      badge('TFJS', !!window.tf),
      badge(R.backend?('Backend:'+R.backend):'Backend', !!R.backend),
      badge('WebGL', R.webgl===true, R.webgl==="fallback"),
      badge('WebGL2', R.webgl2===true, R.webgl2==="fallback"),
      badge('WASM', R.wasm===true, R.wasm==="fallback"),
      badge('RAF-ok', R.raf_ok===true, R.raf_ok==="warn")
    ].join(' ');
    s.textContent = JSON.stringify(R, null, 2);
    c.value = encode({ts:Date.now(), ua:navigator.userAgent, report:R, log:EM.log});
  }
  EM.report.env = {
    ua: navigator.userAgent, platform: navigator.platform, lang: navigator.language,
    screen: { w: screen.width, h: screen.height, dpr: devicePixelRatio }
  };
  window.addEventListener('error', e=>{ EM.log.push({type:'error', msg:String(e.message||e.error), stack:(e.error&&e.error.stack)||null}); EM.fatal = true; updateOverlay(); });
  window.addEventListener('unhandledrejection', e=>{ EM.log.push({type:'unhandledrejection', msg:String(e.reason)}); EM.fatal = true; updateOverlay(); });
  (function(){ let last = performance.now(); let ok=true;
    function tick(t){ const dt=t-last; last=t; if(dt>200){ ok=false; }
      EM.report.raf_ok = ok; updateOverlay(); requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  })();
  (function(){ let gl=null, gl2=null;
    try{ const c=document.createElement('canvas'); gl=c.getContext('webgl')||c.getContext('experimental-webgl'); gl2=c.getContext('webgl2'); }catch(_){}
    EM.report.webgl = !!gl || "fallback"; EM.report.webgl2 = !!gl2 || "fallback"; EM.report.wasm = (typeof WebAssembly==='object')||"fallback";
  })();
  async function initTF(){
    try{
      if(!window.tf){ EM.report.tfLoaded=false; updateOverlay(); return; }
      EM.report.tfLoaded=true;
      const order=['webgl','wasm','cpu']; let chosen=null;
      for(const b of order){
        try{ await tf.setBackend(b); await tf.ready();
          const a=tf.tensor([1,2,3]); const r=a.square().sum(); await r.data(); a.dispose(); r.dispose();
          chosen=b; break;
        }catch(_){}
      }
      EM.report.backend = chosen||null;
      if(!chosen) EM.fatal=true;
    }catch(e){ EM.log.push({type:'tfinit', msg:String(e)}); EM.fatal=true; }
    finally{ EM.ready=true; updateOverlay(); }
  }
  function when(cond, cb, tries=400){
    const t=setInterval(()=>{ if(cond()){ clearInterval(t); cb(); } else if(--tries<=0){ clearInterval(t); EM.fatal=true; EM.log.push({type:'timeout', msg:'init timeout'}); updateOverlay(); } },25);
  }
  when(()=>document.readyState!=='loading', ()=> when(()=>!!window.tf, initTF));
})();