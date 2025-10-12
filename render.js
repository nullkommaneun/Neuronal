export function drawFrame(ctx, {W,H}){
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  ctx.clearRect(0,0,cw,ch);
  ctx.fillStyle = '#0b0f14'; ctx.fillRect(0,0,cw,ch);
  ctx.fillStyle = '#1a2430';
  for(let i=0;i<20;i++){
    ctx.fillRect((i/20)*cw,0,1,ch);
    ctx.fillRect(0,(i/20)*ch,cw,1);
  }
}