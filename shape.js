const tf = window.tf;
const R_PRIOR = 0.6; // Startkreis-Radius (m)
export function createShapeModel(seed=42){
  try{ tf.util.setSeed(seed); }catch(_){}
  const model = tf.sequential();
  model.add(tf.layers.dense({units:64, inputShape:[2], activation:'tanh'}));
  model.add(tf.layers.dense({units:64, activation:'tanh'}));
  model.add(tf.layers.dense({units:1}));
  return model;
}
// f = mlp(x,y) + (r0 - sqrt(x^2+y^2))  → anfänglich Kreis
export function predictF(model, xy){
  return tf.tidy(()=>{
    const mlp = model.predict(xy); // [N,1]
    const x = xy.slice([0,0],[xy.shape[0],1]);
    const y = xy.slice([0,1],[xy.shape[0],1]);
    const r = x.square().add(y.square()).sqrt();
    const prior = tf.scalar(R_PRIOR).sub(r);
    return mlp.add(prior);
  });
}
export function softInside(f, tau=0.02){ return tf.sigmoid(tf.div(f, tau)); }
export function areaFromModel(model, gridXY, tau, dA){
  return tf.tidy(()=> {
    const f = predictF(model, gridXY);
    const ind = softInside(f, tau);
    return ind.mean().mul(gridXY.shape[0]*dA);
  });
}
export function smoothnessPenalty(fOnGrid, gridW, gridH){
  return tf.tidy(()=> {
    const F = tf.reshape(fOnGrid, [gridH, gridW, 1]);
    const dx = F.slice([0,1,0],[gridH,gridW-1,1]).sub(F.slice([0,0,0],[gridH,gridW-1,1]));
    const dy = F.slice([1,0,0],[gridH-1,gridW,1]).sub(F.slice([0,0,0],[gridH-1,gridW,1]));
    return dx.abs().mean().add(dy.abs().mean());
  });
}