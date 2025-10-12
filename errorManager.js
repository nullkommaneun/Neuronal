(function(){
  // Minimal global
  const EM = {
    ready:false,
    fatal:false,
    report:{},
    log:[],
    startTime:performance.now(),
    overlay:null,
    encode(obj){
      try{
        const json = JSON.stringify(obj);
        const b64 = btoa(unescape(encodeURIComponent(json)));
        return "MSP-LOG:v1:" + b64;
      }catch(e){ return "ENCODE_FAIL"; }
    }
  };
  window.errorManager = EM;

  // UI Overlay
  function ensureOverlay(){
    if(EM.overlay) return;
    const el = document.createElement('div');
    el.id = 'error-overlay';
    el.innerHTML = `
      <h2>Status & Diagnose</h2>
      <div class="row" id="badges"></div>
      <pre id="status"></pre>
      <label>Maschinencode (kopierbar):</label>
      <textarea id="code" readonly></textarea>
      <div class="row">
        <button id="copyBtn">Code kopieren</button>
        <button id="hideBtn">Schließen</button>
      </div>`;
    document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(el));
    EM.overlay = el;
    el.querySelector('#copyBtn').onclick = ()=>{
      const ta = el.querySelector('#code'); ta.select(); document.execCommand('copy');
    };
    el.querySelector('#hideBtn').onclick = ()=> el.style.display='none';
  }
  ensureOverlay();

  // Helpers
  const badge = (label, ok, warn=false)=>`<span class="badge ${ok?'ok':(warn?'warn':'fail')}">${label}</span>`;

  function updateOverlay(){
    if(!EM.overlay) return;
    const b = EM.overlay.querySelector('#badges');
    const s = EM.overlay.querySelector('#status');
    const c = EM.overlay.querySelector('#code');
    const R = EM.report;

    const badgesHtml = [
      badge('JS', true),
      badge('Modules', !!window.document.createElement('script').noModule===false),
      badge('TFJS', !!window.tf),
      badge(R.backend?('Backend:'+R.backend):'Backend', !!R.backend),
      badge('WebGL', R.webgl===true, R.webgl==="fallback"),
      badge('WebGL2', R.webgl2===true, R.webgl2==="fallback"),
      badge('WASM', R.wasm===true, R.wasm==="fallback"),
      badge('RAF-ok', R.raf_ok===true, R.raf_ok==="warn")
    ].join(' ');

    b.innerHTML = badgesHtml;
    s.textContent = JSON.stringify(R, null, 2);
    c.value = EM.encode({ts:Date.now(), ua:navigator.userAgent, report:R, log:EM.log});
  }

  // Collect basics
  EM.report.env = {
    ua: navigator.userAgent,
    platform: navigator.platform,
    lang: navigator.language,
    hw: { mem: navigator.deviceMemory || null, cores: navigator.hardwareConcurrency || null },
    screen: { w: screen.width, h: screen.height, dpr: devicePixelRatio }
  };

  // Error hooks
  window.addEventListener('error', e=>{ EM.log.push({type:'error', msg:String(e.message||e.error), stack:(e.error&&e.error.stack)||null}); EM.fatal = true; updateOverlay(); });
  window.addEventListener('unhandledrejection', e=>{ EM.log.push({type:'unhandledrejection', msg:String(e.reason)}); EM.fatal = true; updateOverlay(); });

  // RAF watchdog
  (function(){
    let last = performance.now(); let ok=true;
    function tick(t){
      const dt = t - last; last = t;
      if(dt>200){ ok=false; } // UI jank/freeze
      EM.report.raf_ok = ok; updateOverlay();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  // Feature probes
  EM.report.features = {
    module: true,
    importMap: !!document.createElement('script').type === "importmap",
    bigInt: typeof BigInt!=='undefined',
    wasm: (function(){ try{ return typeof WebAssembly==='object'; }catch(_){ return false; }})()
  };

  // WebGL probes
  (function(){
    let gl=null, gl2=null;
    try{
      const c = document.createElement('canvas');
      gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      gl2 = c.getContext('webgl2');
    }catch(_){}
    EM.report.webgl = !!gl || "fallback";
    EM.report.webgl2 = !!gl2 || "fallback";
  })();

  // Try to init TFJS backend once tf is present
  async function initTF(){
    try{
      if(!window.tf){
        EM.report.tfLoaded = false; updateOverlay(); return;
      }
      EM.report.tfLoaded = true;
      // Backend selection
      const backends = ['webgl','wasm','cpu'];
      let chosen=null;
      for(const b of backends){
        try{
          await tf.setBackend(b);
          await tf.ready();
          // Small op test
          const a=tf.tensor([1,2,3]); const r=a.square().sum(); await r.data(); a.dispose(); r.dispose();
          chosen=b; break;
        }catch(_){}
      }
      EM.report.backend = chosen||null;
      if(!chosen){ EM.fatal=true; }
    }catch(e){
      EM.log.push({type:'tfinit', msg:String(e)}); EM.fatal=true;
    }finally{
      EM.ready = true; updateOverlay();
      if(!EM.fatal){
        // Enable UI
        const ctr = document.getElementById('controls');
        if(ctr){ ctr.classList.remove('disabled'); }
        const b1 = document.getElementById('reset'); const b2 = document.getElementById('opt');
        if(b1) b1.disabled=false; if(b2) b2.disabled=false;
      }
    }
  }

  // Wait until both DOM & (possibly) tf.js are loaded
  function when(cond, cb, tries=400){
    const t = setInterval(()=>{
      if(cond()){ clearInterval(t); cb(); }
      else if(--tries<=0){ clearInterval(t); EM.fatal=true; EM.log.push({type:'timeout', msg:'init timeout'}); updateOverlay(); }
    }, 25);
  }
  when(()=>document.readyState!=='loading', ()=> when(()=>!!window.tf, initTF));
})();