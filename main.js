import * as tf from '@tensorflow/tfjs';
import {createShapeModel, areaFromModel, smoothnessPenalty} from './shape.js';
import {hallMaskSoft} from './corridor.js';
import {initPath, samplePoses, transformPoints} from './path.js';
import {lossBatch} from './loss.js';
import {drawFrame} from './render.js';

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');

const meters = 5.0;
let res = parseInt(document.getElementById('res').value,10);
let tsteps = parseInt(document.getElementById('tsteps').value,10);
let wA=1.0,wC=8.0,wR=0.05,wP=0.1, tau=0.02;

const model = createShapeModel();
const path = initPath(8);
const opt = tf.train.adam(1e-3);

function makeGrid(N){
  const W = N, H = Math.round(N*2/3);
  const xs = tf.linspace(-meters/2, meters/2, W);
  const ys = tf.linspace(-meters/3, meters/3, H);
  const X = xs.tile([H]);
  const Y = ys.repeat(W);
  return {gridXY: tf.stack([X,Y],1), W, H, dA: (meters/W)*(meters/H)};
}
let GRID = makeGrid(res);

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
    const fBody = model.predict(body);
    tPoints.push({fBody});
  }
  const area = await areaFromModel(model, gridXY, tau, dA);
  const fGrid = model.predict(gridXY);
  const smooth = smoothnessPenalty(fGrid, W, H);

  const {value, grads} = tf.variableGrads(()=>{
    const {L} = lossBatch({fGrid, area, hallMask: hall, tPoints, tau, wA,wC,wR,wP, smoothPenalty: smooth});
    return L;
  });
  opt.applyGradients(grads);
  value.data().then(v=>document.getElementById('loss').textContent=v[0].toFixed(5));
  area.data().then(a=>document.getElementById('area').textContent=a[0].toFixed(4));
  drawFrame(ctx, {gridXY, W,H, hall, fGrid, poses});
  Object.values(grads).forEach(g=>g.dispose());
  [fGrid,hall,area,smooth].forEach(t=>t.dispose());
}

async function stepMany(){
  for(let i=0;i<50;i++){ await stepOnce(); }
  requestAnimationFrame(stepMany);
}
stepMany();