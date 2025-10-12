import {createShapeModel, areaFromModel, smoothnessPenalty, predictF} from './shape.js';
import {hallMaskSoft} from './corridor.js';
import {initPath, samplePoses, transformPoints} from './path.js';
import {lossBatch} from './loss.js';
import {drawFrame} from './render.js';

const tf = window.tf;
const EM = window.errorManager;

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');

const meters = 5.0;
let res = parseInt(document.getElementById('res').value,10);
let tsteps = parseInt(document.getElementById('tsteps').value,10);
let wA=1.0,wC=8.0,wR=0.05,wP=0.1, tau=0.02;

let model, path, opt, GRID;

function makeGrid(N){
  const W = N, H = Math.round(N*2/3);
  const xs = tf.linspace(-meters/2, meters/2, W);
  const ys = tf.linspace(-meters/3, meters/3, H);
  const X = tf.tile(xs, [H]);
  const Y = tf.reshape(tf.tile(ys.expandDims(1), [1, W]), [H*W]);
  return {gridXY: tf.stack([X,Y],1), W, H, dA: (meters/W)*(meters/H)};
}

async function bootstrap(){
  const wait = (cond)=> new Promise((resolve,reject)=>{
    let n=0; const id=setInterval(()=>{
      if(cond()){ clearInterval(id); resolve(); }
      else if(++n>400){ clearInterval(id); reject(new Error('bootstrap timeout')); }
    },25);
  });
  await wait(()=>EM && EM.ready && !EM.fatal);
  model = createShapeModel();
  path = initPath(8);
  opt = tf.train.adam(1e-3);
  GRID = makeGrid(res);
  const ctr = document.getElementById('controls'); ctr.classList.remove('disabled');
  document.getElementById('reset').disabled=false;
  document.getElementById('opt').disabled=false;
  document.getElementById('reset').onclick = ()=>location.reload();
  document.getElementById('opt').onclick = ()=>loop();
  loop();
}

async function stepOnce(){
  const {gridXY,W,H,dA} = GRID;
  const hall = hallMaskSoft(gridXY, 1.0, 0.02);
  const poses = samplePoses(path, tsteps);
  const tPoints = [];
  for(let i=0;i<tsteps;i++){
    const xi = poses.x.slice([i,0],[1,1]).reshape([1,1]);
    const yi = poses.y.slice([i,0],[1,1]).reshape([1,1]);
    const pi = poses.phi.slice([i,0],[1,1]).reshape([1,1]);
    const body = transformPoints(gridXY, xi, yi, pi);
    const fBody = predictF(model, body); // use prior+mlp
    tPoints.push({fBody});
  }
  const area = await areaFromModel(model, gridXY, tau, dA);
  const fGrid = predictF(model, gridXY);
  const smooth = smoothnessPenalty(fGrid, W, H);

  const {value, grads} = tf.variableGrads(()=>{
    const {L} = lossBatch({fGrid, area, hallMask: hall, tPoints, tau, wA,wC,wR,wP, smoothPenalty: smooth});
    return L;
  });
  opt.applyGradients(grads);
  const v = await value.data(); const a = await area.data();
  document.getElementById('loss').textContent = (isFinite(v[0])?v[0]:0).toFixed(5);
  document.getElementById('area').textContent = (isFinite(a[0])?a[0]:0).toFixed(4);

  const fData = Array.from(fGrid.dataSync());
  const hData = Array.from(hall.dataSync());
  drawFrame(ctx, {W,H, cw:canvas.width, ch:canvas.height, meters, fGridData:fData, hallMaskData:hData});

  Object.values(grads).forEach(g=>g.dispose());
  [fGrid,hall,area,smooth].forEach(t=>t.dispose());
}

async function loop(){
  try{
    for(let i=0;i<20;i++){ await stepOnce(); document.getElementById('iter').textContent = String((+document.getElementById('iter').textContent)||0 + 1); }
    requestAnimationFrame(loop);
  }catch(e){
    EM.log.push({type:'loop', msg:String(e), stack:e.stack||null});
    EM.fatal=true;
  }
}

bootstrap().catch(e=>{
  EM.log.push({type:'bootstrap', msg:String(e)});
  EM.fatal=true;
});