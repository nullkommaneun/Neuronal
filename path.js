const tf = window.tf;
export function initPath(K=8){
  const params = tf.variable(tf.tensor1d(new Float32Array(3*K).fill(0)));
  return {params, K};
}
export function samplePoses(path, tSteps){
  const s = tf.linspace(0,1,tSteps).reshape([tSteps,1]);
  const W = tf.reshape(path.params, [3, -1]);
  const B = tf.linspace(0,1,W.shape[1]).reshape([1,W.shape[1]]);
  const H = s.matMul(B);
  const XYF = H.matMul(W.transpose());
  const start = tf.tensor1d([-2.0, 0.0, 0.0]);
  const end   = tf.tensor1d([ 0.0, 2.0, Math.PI/2]);
  const w = s;
  const blended = XYF.mul(tf.scalar(0.6)).add(
    start.mul(tf.scalar(1).sub(w))).add(end.mul(w).mul(tf.scalar(0.4)));
  const x=blended.slice([0,0],[tSteps,1]), y=blended.slice([0,1],[tSteps,1]), phi=blended.slice([0,2],[tSteps,1]);
  return {x,y,phi};
}
export function transformPoints(gridXY, x, y, phi){
  const c = tf.cos(phi), s = tf.sin(phi);
  const px = gridXY.slice([0,0],[gridXY.shape[0],1]).sub(x);
  const py = gridXY.slice([0,1],[gridXY.shape[0],1]).sub(y);
  const bx =  c.mul(px).add( s.mul(py).neg());
  const by =  s.mul(px).add( c.mul(py));
  return tf.concat([bx,by],1);
}