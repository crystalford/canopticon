/* CANOPTICON — families F (data), G (network), H (timeline), N (audio). */
const DATA=[2,1,3,2,2,1,4,3,2,5,3,2,4,6,3,2,5,4,3,6,4,2];
const YEARS=DATA.map((_,i)=>2003+i);

/* ── F. DATA ────────────────────────────────────────── */
reg('chart_cartesian','F · DATA','DATA → GEOMETRY',
 {kind:{v:0,lo:0,hi:3,int:1},reveal:{v:1,lo:.05,hi:1},grid:{v:.5,lo:0,hi:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const K=Math.round(p.kind),px=34,py=18,pw=w-px-18,ph=h-py-30;
  const mx=Math.max(...DATA);
  if(p.grid>.02){ctx.strokeStyle='rgba(155,163,170,'+(p.grid*.16)+')';ctx.lineWidth=1;
   for(let i=0;i<=4;i++){const y=py+ph-i/4*ph;ctx.beginPath();ctx.moveTo(px,y);ctx.lineTo(px+pw,y);ctx.stroke();
    lab(ctx,String(Math.round(i/4*mx)),8,y-4)}}
  const N=Math.max(1,Math.floor(DATA.length*p.reveal));
  if(K===0){const bw=pw/DATA.length;for(let i=0;i<N;i++){const bh=DATA[i]/mx*ph;
    ctx.fillStyle=DATA[i]>=5?EMB:'rgba(238,241,243,.72)';ctx.fillRect(px+i*bw+1.5,py+ph-bh,bw-3,bh)}}
  else if(K===1){ctx.strokeStyle=INK;ctx.lineWidth=1.6;ctx.beginPath();
   for(let i=0;i<N;i++){const x=px+i/(DATA.length-1)*pw,y=py+ph-DATA[i]/mx*ph;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();
   for(let i=0;i<N;i++){const x=px+i/(DATA.length-1)*pw,y=py+ph-DATA[i]/mx*ph;
    ctx.fillStyle=DATA[i]>=5?EMB:BG;ctx.strokeStyle=DATA[i]>=5?EMB:INK;ctx.lineWidth=1.2;
    ctx.beginPath();ctx.arc(x,y,2.6,0,6.3);ctx.fill();ctx.stroke()}}
  else if(K===2){ctx.beginPath();ctx.moveTo(px,py+ph);
   for(let i=0;i<N;i++){const x=px+i/(DATA.length-1)*pw,y=py+ph-DATA[i]/mx*ph;ctx.lineTo(x,y)}
   ctx.lineTo(px+(N-1)/(DATA.length-1)*pw,py+ph);ctx.closePath();
   ctx.fillStyle='rgba(216,98,74,.22)';ctx.fill();ctx.strokeStyle=EMB;ctx.lineWidth=1.5;ctx.stroke()}
  else{const r=mulberry(5);for(let i=0;i<N;i++){const x=px+i/(DATA.length-1)*pw;
   for(let j=0;j<DATA[i];j++){ctx.fillStyle='rgba(238,241,243,.6)';
    ctx.beginPath();ctx.arc(x+(r()-.5)*7,py+ph-(j+.5)/mx*ph,2.2,0,6.3);ctx.fill()}}}
  lab(ctx,['BAR','LINE','AREA','SCATTER'][K]+' · RENEWALS BY YEAR 2003–2024',10,h-14)}}),
 'Bar, line, area, scatter from one data input. The chart type is a parameter, so it can change mid-shot.');

reg('chart_radial','F · DATA','DATA → GEOMETRY',
 {kind:{v:0,lo:0,hi:2,int:1},inner:{v:.35,lo:.05,hi:.7},spread:{v:1,lo:.2,hi:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const R=Math.min(w,h)*.42,r0=R*p.inner,mx=Math.max(...DATA),K=Math.round(p.kind);
  DATA.forEach((v,i)=>{const a0=i/DATA.length*6.283*p.spread-1.57,a1=a0+6.283/DATA.length*p.spread*.86;
   const rr=r0+v/mx*(R-r0);ctx.fillStyle=v>=5?EMB:'rgba(238,241,243,.6)';
   if(K===0){ctx.beginPath();ctx.arc(w/2,h/2,rr,a0,a1);ctx.arc(w/2,h/2,r0,a1,a0,true);ctx.closePath();ctx.fill()}
   else if(K===1){ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=2.4;ctx.beginPath();
    ctx.moveTo(w/2+Math.cos(a0)*r0,h/2+Math.sin(a0)*r0);ctx.lineTo(w/2+Math.cos(a0)*rr,h/2+Math.sin(a0)*rr);ctx.stroke()}
   else{ctx.beginPath();ctx.arc(w/2+Math.cos(a0)*(r0+R)*.5,h/2+Math.sin(a0)*(r0+R)*.5,v/mx*11,0,6.3);ctx.fill()}});
  ctx.strokeStyle='rgba(155,163,170,.2)';ctx.beginPath();ctx.arc(w/2,h/2,r0,0,6.3);ctx.stroke();
  lab(ctx,['RADIAL BAR','ROSE SPOKES','POLAR SCATTER'][K],10,h-14)}}),
 'Radial encoding reads as cyclical rather than progressive — right when the subject is a repeating cycle.');

reg('chart_flow','F · DATA','DATA → GEOMETRY',
 {bands:{v:4,lo:2,hi:8,int:1},smooth:{v:.6,lo:0,hi:1},offset:{v:.5,lo:0,hi:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const B=Math.round(p.bands),N=DATA.length,r=mulberry(17);
  const series=Array.from({length:B},(_,b)=>DATA.map((v,i)=>v*(.35+r()*1.3)*(1+Math.sin(t*.35+b+i*.3)*.14)));
  const tot=DATA.map((_,i)=>series.reduce((a,s)=>a+s[i],0)),mx=Math.max(...tot);
  let base=series.map(()=>0),acc=DATA.map(()=>0);
  series.forEach((s,b)=>{ctx.beginPath();
   for(let i=0;i<N;i++){const x=i/(N-1)*w;const off=(1-p.offset)*0+ (h*.5-tot[i]/mx*h*.42);
    const y=off+(acc[i])/mx*h*.84;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
   for(let i=N-1;i>=0;i--){const x=i/(N-1)*w;const off=(h*.5-tot[i]/mx*h*.42);
    ctx.lineTo(x,off+(acc[i]+s[i])/mx*h*.84)}
   ctx.closePath();ctx.fillStyle=b===B-1?'rgba(216,98,74,.55)':'rgba(238,241,243,'+(.10+b*.09)+')';ctx.fill();
   for(let i=0;i<N;i++)acc[i]+=s[i]});
  lab(ctx,B+' BANDS · STREAM',10,h-14)}}),
 'Stream and sankey-like flows. Composition over time, where the shape of the whole is the point.');

reg('counter','F · DATA','DATA → ANIMATION',
 {target:{v:41,lo:1,hi:400,int:1},rate:{v:.4,lo:.05,hi:1},format:{v:0,lo:0,hi:2,int:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const cyc=cl01(((t*p.rate*.5)%2.2)/1.4);
  const e=1-Math.pow(1-cyc,4),v=Math.round(p.target*e);
  const F=Math.round(p.format);
  const s=F===0?String(v):F===1?v.toLocaleString():('$'+(v*1000).toLocaleString());
  ctx.font='600 '+Math.min(h*.46,w/(s.length*.62))+'px "Space Grotesk",sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=INK;ctx.fillText(s,w/2,h*.46);
  ctx.font='500 11px "JetBrains Mono",monospace';ctx.fillStyle=EMB;
  ctx.fillText('RENEWALS SINCE 2003',w/2,h*.78);ctx.textAlign='left';
  lab(ctx,'EASED · NOT LINEAR',10,h-14)}}),
 'An animated number. Trivial to build, and it carries more weight than a chart when the figure is the argument.');

reg('small_multiples','F · DATA','DATA → GEOMETRY',
 {cols:{v:6,lo:2,hi:10,int:1},highlight:{v:.5,lo:0,hi:1},reveal:{v:1,lo:.05,hi:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const C=Math.round(p.cols),R=Math.ceil(DATA.length/C);
  const cw=w/C,ch=(h-16)/R,r=mulberry(23);
  DATA.forEach((v,i)=>{if(i/DATA.length>p.reveal)return;
   const cx=(i%C)*cw,cy=Math.floor(i/C)*ch;
   ctx.strokeStyle='rgba(155,163,170,.12)';ctx.strokeRect(cx+3,cy+3,cw-6,ch-6);
   const hot=v/Math.max(...DATA)>p.highlight;
   ctx.strokeStyle=hot?EMB:'rgba(238,241,243,.5)';ctx.lineWidth=hot?1.6:1;ctx.beginPath();
   for(let j=0;j<9;j++){const x=cx+6+j/8*(cw-12),y=cy+ch-8-((j===4?v:v*(.4+r()*.8))/6)*(ch-16);
    j?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();
   lab(ctx,String(YEARS[i]),cx+6,cy+6)});
  lab(ctx,DATA.length+' PANELS · SHARED SCALE',10,h-12)}}),
 'A grid of the same chart. Comparison without a single overloaded frame.');

reg('heatmap','F · DATA','DATA → IMAGE',
 {cols:{v:12,lo:4,hi:26,int:1},contrast:{v:.5,lo:.1,hi:1},gap:{v:.3,lo:0,hi:1}},
 p=>{let n=vnoise(51);return{frame(ctx,w,h,t){bg(ctx,w,h);const C=Math.round(p.cols),R=Math.max(3,Math.round(C*h/w));
  const cw=w/C,chh=h/R,g=p.gap*Math.min(cw,chh)*.3;
  for(let y=0;y<R;y++)for(let x=0;x<C;x++){
   let v=fbm(n,x*.4,y*.4+t*.05,2,.5)*.5+.5;v=cl01((v-.5)*(1+p.contrast*3)+.5);
   ctx.fillStyle=v>.72?'rgba(216,98,74,'+(v)+')':'rgba(238,241,243,'+(v*.55)+')';
   ctx.fillRect(x*cw+g/2,y*chh+g/2,cw-g,chh-g)}
  lab(ctx,C+'×'+R+' MATRIX',10,h-14)}}},
 'Matrix and calendar views. Density across two axes, which is usually where the anomaly hides.');

reg('data_to_particles','F · DATA','DATA → GEOMETRY',
 {perUnit:{v:.4,lo:.05,hi:1},gather:{v:.6,lo:0,hi:1},jitter:{v:.4,lo:0,hi:1}},
 p=>{let ps=[],N=0;return{frame(ctx,w,h,t){
  const per=Math.round(6+p.perUnit*90),tot=DATA.reduce((a,b)=>a+b,0)*per;
  if(tot!==N){N=tot;const r=mulberry(71);ps=[];
   DATA.forEach((v,i)=>{for(let j=0;j<v*per;j++)ps.push({x:r()*w,y:r()*h,col:i,k:r()})})}
  bg(ctx,w,h,.3);const cw=w/DATA.length;
  for(const q of ps){
   const tx=q.col*cw+cw*.5+(q.k-.5)*cw*.8,ty=h*.9-(q.k)*h*.72;
   q.x+=((q.x*(1-p.gather)+tx*p.gather)-q.x)*.06+(q.k-.5)*p.jitter*1.4;
   q.y+=((q.y*(1-p.gather)+ty*p.gather)-q.y)*.06+(Math.sin(t+q.k*9))*p.jitter*.7;
   ctx.fillStyle=DATA[q.col]>=5?'rgba(216,98,74,.6)':'rgba(238,241,243,.45)';ctx.fillRect(q.x,q.y,1.4,1.4)}
  lab(ctx,N.toLocaleString()+' PARTICLES · ONE PER UNIT',10,h-14)}}},
 'One particle per unit counted. A population stops being a bar and becomes a quantity you can watch move.');

reg('data_to_field','F · DATA','DATA → FIELD',
 {influence:{v:.5,lo:.1,hi:1},resolution:{v:16,lo:8,hi:40,int:1},show:{v:0,lo:0,hi:1,int:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const R=Math.round(p.resolution),C=Math.round(R*w/h);
  const gap=w/C;
  for(let y=0;y<R;y++)for(let x=0;x<C;x++){
   const u=x/C*DATA.length,i=Math.floor(u),f=u-i;
   const v=(DATA[i]||0)*(1-f)+(DATA[i+1]||0)*f;
   const a=(v/6)*Math.PI*2*p.influence+t*.3;
   const px=x*gap+gap/2,py=y*(h/R)+h/R/2;
   if(p.show<.5){ctx.strokeStyle='rgba(155,163,170,'+(.2+v/8)+')';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(px-Math.cos(a)*gap*.35,py-Math.sin(a)*gap*.35);
    ctx.lineTo(px+Math.cos(a)*gap*.35,py+Math.sin(a)*gap*.35);ctx.stroke()}
   else{ctx.fillStyle=v>4?'rgba(216,98,74,'+(v/8)+')':'rgba(238,241,243,'+(v/14)+')';ctx.fillRect(x*gap,y*(h/R),gap,h/R)}}
  lab(ctx,'DATA AS DISPLACEMENT SOURCE',10,h-14)}}),
 'Data used as a field rather than a chart. Everything downstream — particles, type, geometry — inherits the numbers.');

reg('data_to_type','F · DATA','DATA → GEOMETRY',
 {mode:{v:0,lo:0,hi:1,int:1},weightScale:{v:.5,lo:0,hi:1},packing:{v:.5,lo:.1,hi:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const mx=Math.max(...DATA);
  if(p.mode<.5){let x=10,y=h*.24;
   DATA.forEach((v,i)=>{const s=8+v/mx*h*.30*(1+p.weightScale);
    ctx.font=(v>=5?'700 ':'400 ')+s+'px "Space Grotesk",sans-serif';
    const wd=ctx.measureText(String(YEARS[i])).width+6*p.packing;
    if(x+wd>w-10){x=10;y+=h*.3}
    ctx.fillStyle=v>=5?EMB:'rgba(238,241,243,'+(.35+v/mx*.6)+')';
    ctx.fillText(String(YEARS[i]),x,y);x+=wd})}
  else{ctx.textAlign='center';ctx.textBaseline='middle';
   DATA.forEach((v,i)=>{const s=6+v/mx*22*(1+p.weightScale);
    ctx.font='600 '+s+'px "Space Grotesk",sans-serif';
    const a=i/DATA.length*6.283-1.57,R=Math.min(w,h)*(.18+v/mx*.26)*p.packing*1.6;
    ctx.fillStyle=v>=5?EMB:'rgba(238,241,243,.7)';
    ctx.fillText(String(v),w/2+Math.cos(a)*R,h/2+Math.sin(a)*R)});ctx.textAlign='left'}
  lab(ctx,'FIGURES AS TYPOGRAPHIC COMPOSITION',10,h-14)}}),
 'Numbers set as type rather than plotted. Reading the figure and seeing the magnitude become one act.');

reg('chart_morph','F · DATA','DATA → ANIMATION',
 {rate:{v:.35,lo:.1,hi:1},hold:{v:.4,lo:0,hi:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const px=24,py=18,pw=w-42,ph=h-py-28,mx=Math.max(...DATA);
  const raw=(t*p.rate*.5)%2,c=cl01((raw>1?2-raw:raw)*(1+p.hold)-p.hold*.5);
  const bw=pw/DATA.length;
  ctx.beginPath();
  DATA.forEach((v,i)=>{const bh=v/mx*ph,x=px+i*bw,y=py+ph-bh;
   ctx.fillStyle=v>=5?'rgba(216,98,74,'+(1-c)+')':'rgba(238,241,243,'+(.7*(1-c))+')';
   ctx.fillRect(x+1.5,y,bw-3,bh)});
  ctx.strokeStyle='rgba(238,241,243,'+c+')';ctx.lineWidth=1.8;ctx.beginPath();
  DATA.forEach((v,i)=>{const x=px+i*bw+bw/2,y=py+ph-v/mx*ph;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();
  lab(ctx,'BAR → LINE '+(c*100).toFixed(0)+'% · THE TRANSITION IS THE ARGUMENT',10,h-12)}}),
 'A bar chart becoming a line chart is a claim about what the data is — discrete events or a trend.');

reg('annotated_callout','F · DATA','DATA → GEOMETRY',
 {index:{v:12,lo:0,hi:21,int:1},style:{v:0,lo:0,hi:2,int:1},reveal:{v:1,lo:0,hi:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const px=30,py=26,pw=w-48,ph=h-py-32,mx=Math.max(...DATA),bw=pw/DATA.length;
  DATA.forEach((v,i)=>{const bh=v/mx*ph;ctx.fillStyle=i===Math.round(p.index)?EMB:'rgba(238,241,243,.28)';
   ctx.fillRect(px+i*bw+1.5,py+ph-bh,bw-3,bh)});
  const i=Math.round(p.index),v=DATA[i],x=px+i*bw+bw/2,y=py+ph-v/mx*ph;
  const S=Math.round(p.style),r=cl01(p.reveal);
  ctx.strokeStyle=EMB;ctx.lineWidth=1;
  if(S===0){ctx.beginPath();ctx.moveTo(x,y-6);ctx.lineTo(x,y-6-34*r);ctx.lineTo(x+70*r,y-40*r);ctx.stroke()}
  else if(S===1){ctx.beginPath();ctx.arc(x,y,(12+v)*r,0,6.283*r);ctx.stroke()}
  else{ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(px,y);ctx.lineTo(px+pw*r,y);ctx.stroke();ctx.setLineDash([])}
  if(r>.6){ctx.font='500 11px "JetBrains Mono",monospace';ctx.fillStyle=INK;
   ctx.fillText(YEARS[i]+' · '+v+' RENEWALS',Math.min(w-140,x+8),Math.max(16,y-46))}
  lab(ctx,['LEADER LINE','CIRCLE','BASELINE'][S]+' CALLOUT',10,h-12)}}),
 'A label landing on one data point. The difference between showing data and making a claim about it.');

/* ── G. NETWORK & RELATIONAL ────────────────────────── */
function seedGraph(n,seed){const r=mulberry(seed),nodes=Array.from({length:n},(_,i)=>({i,x:r(),y:r(),vx:0,vy:0,g:Math.floor(r()*4)}));
 const edges=[];for(let i=1;i<n;i++){const j=Math.floor(r()*i);edges.push([i,j])}
 for(let k=0;k<n*.4;k++){const a=Math.floor(r()*n),b=Math.floor(r()*n);if(a!==b)edges.push([a,b])}
 return{nodes,edges}}
reg('force_layout','G · NETWORK','DATA → GEOMETRY',
 {nodes:{v:.35,lo:.05,hi:1},charge:{v:.5,lo:.1,hi:1},link:{v:.5,lo:.1,hi:1}},
 p=>{let G=null,N=0;return{frame(ctx,w,h,t){const n=Math.round(12+p.nodes*110);
  if(n!==N){N=n;G=seedGraph(n,404);G.nodes.forEach(q=>{q.x*=w;q.y*=h})}
  bg(ctx,w,h);
  for(let s=0;s<2;s++){
   for(const[a,b]of G.edges){const A=G.nodes[a],B=G.nodes[b];
    const dx=B.x-A.x,dy=B.y-A.y,d=Math.max(1,Math.hypot(dx,dy)),f=(d-60)*.0016*p.link*3;
    A.vx+=dx/d*f;A.vy+=dy/d*f;B.vx-=dx/d*f;B.vy-=dy/d*f}
   for(let i=0;i<G.nodes.length;i++)for(let j=i+1;j<G.nodes.length;j++){
    const A=G.nodes[i],B=G.nodes[j],dx=B.x-A.x,dy=B.y-A.y,d2=Math.max(80,dx*dx+dy*dy);
    const f=p.charge*180/d2;A.vx-=dx*f*.02;A.vy-=dy*f*.02;B.vx+=dx*f*.02;B.vy+=dy*f*.02}
   for(const q of G.nodes){q.vx+=(w/2-q.x)*.0012;q.vy+=(h/2-q.y)*.0012;
    q.vx*=.86;q.vy*=.86;q.x+=q.vx;q.y+=q.vy}}
  ctx.strokeStyle='rgba(155,163,170,.22)';ctx.lineWidth=.8;ctx.beginPath();
  for(const[a,b]of G.edges){ctx.moveTo(G.nodes[a].x,G.nodes[a].y);ctx.lineTo(G.nodes[b].x,G.nodes[b].y)}ctx.stroke();
  G.nodes.forEach(q=>{ctx.fillStyle=q.g===0?EMB:q.g===1?COOL:'rgba(238,241,243,.8)';
   ctx.beginPath();ctx.arc(q.x,q.y,2.4,0,6.3);ctx.fill()});
  lab(ctx,N+' NODES · '+G.edges.length+' EDGES · SEEDED randomSource',10,h-14)}}},
 'd3-force is deterministic when its random source is seeded. Precompute headless, serialise positions, then render.',1);

reg('hierarchy_layout','G · NETWORK','DATA → GEOMETRY',
 {kind:{v:0,lo:0,hi:2,int:1},depth:{v:4,lo:2,hi:6,int:1},split:{v:.5,lo:.2,hi:.8}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const K=Math.round(p.kind),D=Math.round(p.depth),r=mulberry(31);
  if(K===0){(function tree(x,y,wd,d){if(d<=0)return;
    const n=2+(r()>.6?1:0),step=wd/n;
    for(let i=0;i<n;i++){const cx=x-wd/2+step*(i+.5),cy=y+h/(D+1);
     ctx.strokeStyle='rgba(155,163,170,.4)';ctx.lineWidth=.8;
     ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(cx,cy);ctx.stroke();
     ctx.fillStyle=d===1?EMB:'rgba(238,241,243,.8)';ctx.beginPath();ctx.arc(cx,cy,2.4,0,6.3);ctx.fill();
     tree(cx,cy,step*.92,d-1)}})(w/2,14,w*.94,D)}
  else if(K===1){(function tm(x,y,wd,hh,d,vert){if(d<=0||wd<3||hh<3){
     ctx.strokeStyle='rgba(155,163,170,.35)';ctx.strokeRect(x,y,wd,hh);
     if(r()>.72){ctx.fillStyle='rgba(216,98,74,.35)';ctx.fillRect(x,y,wd,hh)}return}
    const f=p.split*(.6+r()*.8);
    if(vert){tm(x,y,wd*f,hh,d-1,!vert);tm(x+wd*f,y,wd*(1-f),hh,d-1,!vert)}
    else{tm(x,y,wd,hh*f,d-1,!vert);tm(x,y+hh*f,wd,hh*(1-f),d-1,!vert)}})(2,2,w-4,h-18,D+2,true)}
  else{(function pack(x,y,R,d){if(d<=0||R<3)return;
    ctx.strokeStyle='rgba(238,241,243,'+(.12+d*.1)+')';ctx.beginPath();ctx.arc(x,y,R,0,6.3);ctx.stroke();
    const n=2+Math.floor(r()*2);for(let i=0;i<n;i++){const a=r()*6.283,rr=R*p.split;
     pack(x+Math.cos(a)*(R-rr),y+Math.sin(a)*(R-rr),rr,d-1)}})(w/2,h/2,Math.min(w,h)*.44,D)}
  lab(ctx,['TREE','TREEMAP','CIRCLE PACK'][K]+' · DEPTH '+D,10,h-12)}}),
 'Tree, treemap, pack, partition. Containment and subordination — the shape of an organisation.',1);

reg('graph_reveal','G · NETWORK','GEOMETRY → ANIMATION',
 {rate:{v:.4,lo:.05,hi:1},order:{v:0,lo:0,hi:1,int:1},nodes:{v:.3,lo:.05,hi:1}},
 p=>{let G=null,N=0;return{frame(ctx,w,h,t){const n=Math.round(10+p.nodes*70);
  if(n!==N){N=n;G=seedGraph(n,77)}bg(ctx,w,h);
  const cyc=(t*p.rate*.35)%1.5,pr=cl01(cyc);
  const R=Math.min(w,h)*.42;
  const pos=G.nodes.map((q,i)=>[w/2+Math.cos(i/n*6.283)*R*(.5+q.x*.5),h/2+Math.sin(i/n*6.283)*R*(.5+q.y*.5)*.9]);
  const shown=Math.floor(pr*n);
  G.edges.forEach(([a,b])=>{const ord=p.order<.5?Math.max(a,b):Math.min(a,b);
   if(ord>shown)return;ctx.strokeStyle='rgba(155,163,170,.3)';ctx.lineWidth=.9;
   ctx.beginPath();ctx.moveTo(pos[a][0],pos[a][1]);ctx.lineTo(pos[b][0],pos[b][1]);ctx.stroke()});
  pos.forEach(([x,y],i)=>{if(i>shown)return;const fresh=i>shown-3;
   ctx.fillStyle=fresh?EMB:'rgba(238,241,243,.8)';ctx.beginPath();ctx.arc(x,y,fresh?4:2.4,0,6.3);ctx.fill()});
  lab(ctx,'STAGED · '+shown+' / '+n+' NODES',10,h-14)}}},
 'Staged appearance of nodes and edges. A network arriving in order is an explanation; all at once is a wall.',1);

reg('topology_shift','G · NETWORK','GEOMETRY → ANIMATION',
 {rate:{v:.3,lo:.05,hi:1},nodes:{v:.35,lo:.05,hi:1},contrast:{v:.6,lo:0,hi:1}},
 p=>{let G=null,N=0;return{frame(ctx,w,h,t){const n=Math.round(14+p.nodes*70);
  if(n!==N){N=n;G=seedGraph(n,123)}bg(ctx,w,h);
  const c=(Math.sin(t*p.rate*1.4)*.5+.5),R=Math.min(w,h)*.42;
  const pos=G.nodes.map((q,i)=>{
   const ax=w/2+Math.cos(i/n*6.283)*R,ay=h/2+Math.sin(i/n*6.283)*R;
   const cols=Math.ceil(Math.sqrt(n));
   const bx=(i%cols+.5)/cols*w,by=(Math.floor(i/cols)+.5)/Math.ceil(n/cols)*h;
   return[ax+(bx-ax)*c,ay+(by-ay)*c]});
  ctx.strokeStyle='rgba(155,163,170,'+(.14+p.contrast*.2)+')';ctx.lineWidth=.9;ctx.beginPath();
  G.edges.forEach(([a,b])=>{ctx.moveTo(pos[a][0],pos[a][1]);ctx.lineTo(pos[b][0],pos[b][1])});ctx.stroke();
  pos.forEach(([x,y],i)=>{ctx.fillStyle=i%7?'rgba(238,241,243,.85)':EMB;ctx.beginPath();ctx.arc(x,y,2.6,0,6.3);ctx.fill()});
  lab(ctx,'RING → GRID · '+(c*100).toFixed(0)+'% REORGANISED',10,h-14)}}},
 'A network reorganising itself. Same actors, different structure — dramatically the most useful network move.',1);

reg('sankey_flow','G · NETWORK','DATA → GEOMETRY',
 {nodes:{v:4,lo:2,hi:7,int:1},thickness:{v:.5,lo:.1,hi:1},curve:{v:.6,lo:0,hi:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const L=Math.round(p.nodes),r=mulberry(88);
  const cols=3,colw=w/cols;
  for(let c=0;c<cols-1;c++)for(let i=0;i<L;i++)for(let j=0;j<L;j++){
   if(r()>.42)continue;const th=(2+r()*16)*p.thickness;
   const y0=(i+.5)/L*h,y1=(j+.5)/L*h,x0=colw*(c+1)-8,x1=colw*(c+2)-colw+8+colw*c;
   ctx.strokeStyle=th>10?'rgba(216,98,74,.3)':'rgba(238,241,243,.13)';ctx.lineWidth=th;
   ctx.beginPath();ctx.moveTo(colw*c+18,y0);
   ctx.bezierCurveTo(colw*c+18+colw*p.curve,y0,colw*(c+1)+18-colw*p.curve,y1,colw*(c+1)+18,y1);ctx.stroke()}
  for(let c=0;c<cols;c++)for(let i=0;i<L;i++){
   ctx.fillStyle=INK;ctx.fillRect(colw*c+14,(i+.5)/L*h-14,4,28)}
  lab(ctx,'FLOW BETWEEN '+L+' CATEGORIES · 3 STAGES',10,h-12)}}),
 'Quantity moving between categories. Money, people, authority — where it enters and where it ends up.',1);

/* ── H. TIMELINE ────────────────────────────────────── */
reg('timeline_radial','H · TIMELINE','DATA → GEOMETRY',
 {span:{v:.85,lo:.3,hi:1},marks:{v:.6,lo:.1,hi:1},labels:{v:1,lo:0,hi:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const R=Math.min(w,h)*.40,N=Math.round(6+p.marks*40);
  ctx.strokeStyle='rgba(155,163,170,.35)';ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(w/2,h/2,R,-1.57,-1.57+6.283*p.span);ctx.stroke();
  const r=mulberry(9);
  for(let i=0;i<N;i++){const a=-1.57+i/(N-1)*6.283*p.span,big=r()>.76;
   const r0=R-(big?13:5),r1=R+(big?7:2);
   ctx.strokeStyle=big?EMB:'rgba(238,241,243,.65)';ctx.lineWidth=big?1.6:1;
   ctx.beginPath();ctx.moveTo(w/2+Math.cos(a)*r0,h/2+Math.sin(a)*r0);
   ctx.lineTo(w/2+Math.cos(a)*r1,h/2+Math.sin(a)*r1);ctx.stroke();
   if(big&&p.labels>.5){ctx.save();ctx.translate(w/2+Math.cos(a)*(R+18),h/2+Math.sin(a)*(R+18));
    ctx.rotate(a+1.57);ctx.font='7px JetBrains Mono';ctx.fillStyle='#9ba3aa';ctx.textAlign='center';
    ctx.fillText(String(2003+i),0,0);ctx.restore();ctx.textAlign='left'}}
  lab(ctx,'RADIAL · '+(p.span*100).toFixed(0)+'% OF CIRCLE',10,h-12)}}),
 'The same timeline, wrapped. Radial reads as a cycle closing; linear reads as a line continuing.');

reg('roadmap_build','H · TIMELINE','DATA → ANIMATION',
 {rate:{v:.35,lo:.05,hi:1},lanes:{v:3,lo:1,hi:5,int:1},density:{v:.5,lo:.1,hi:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const L=Math.round(p.lanes),r=mulberry(42),pr=cl01((t*p.rate*.3)%1.4);
  for(let l=0;l<L;l++){const y=(l+.7)/(L+.4)*h;
   ctx.strokeStyle='rgba(155,163,170,.15)';ctx.lineWidth=1;
   ctx.beginPath();ctx.moveTo(20,y);ctx.lineTo(w-14,y);ctx.stroke();
   const n=Math.round(2+p.density*6);
   for(let i=0;i<n;i++){const x0=20+r()*(w-120),wd=30+r()*90;
    if(x0/w>pr)continue;const vis=Math.min(wd,(pr*w-x0));
    ctx.fillStyle=l===0?'rgba(216,98,74,.7)':'rgba(238,241,243,.4)';
    ctx.fillRect(x0,y-6,Math.max(2,vis),12)}}
  lab(ctx,'LEFT-TO-RIGHT CONSTRUCTION · '+(pr*100).toFixed(0)+'%',10,h-12)}}),
 'Bars constructing left to right. Plans, phases, overlapping mandates — a schedule that assembles as it is described.');

/* ── N. AUDIO ───────────────────────────────────────── */
reg('audio_analyze','N · AUDIO','AUDIO → ANIMATION',
 {smoothing:{v:.5,lo:0,hi:1},bands:{v:32,lo:8,hi:64,int:1},drive:{v:.5,lo:0,hi:1}},
 p=>{let sm=[],n=vnoise(808);return{frame(ctx,w,h,t){bg(ctx,w,h);const B=Math.round(p.bands);
  if(sm.length!==B)sm=new Array(B).fill(0);
  const speech=Math.max(0,Math.sin(t*2.1)*.5+.5-.12)*(Math.sin(t*7.3)*.2+.8);
  for(let i=0;i<B;i++){const raw=Math.abs(fbm(n,i*.3,t*2.4,2,.6))*2*speech*(1-i/B*.6);
   sm[i]=sm[i]*(p.smoothing*.85)+raw*(1-p.smoothing*.85)}
  const bw=w/B;
  sm.forEach((v,i)=>{const bh=cl01(v)*h*.55;
   ctx.fillStyle=v>.4?EMB:'rgba(238,241,243,.5)';ctx.fillRect(i*bw+.5,h*.66-bh,bw-1,bh)});
  const amp=cl01(sm.reduce((a,b)=>a+b,0)/B*3);
  const R=14+amp*p.drive*h*.24;
  ctx.strokeStyle='rgba(216,98,74,'+(.3+amp*.6)+')';ctx.lineWidth=1.4;
  ctx.beginPath();ctx.arc(w/2,h*.84,R,0,6.3);ctx.stroke();
  lab(ctx,'NARRATION AMPLITUDE → VISUAL PARAMETER · '+amp.toFixed(2),10,h-12)}}},
 'The loop closed the other way: the narration drives the image. Cheap, and immediately makes a film feel scored.');

reg('synth_bed','N · AUDIO','— → AUDIO',
 {density:{v:.4,lo:.05,hi:1},pitch:{v:.4,lo:0,hi:1},motion:{v:.4,lo:0,hi:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const V=Math.round(2+p.density*7);
  for(let i=0;i<V;i++){const f=(.4+p.pitch*3)*(1+i*.5),ph=i*1.7;
   ctx.strokeStyle=i===0?EMB:'rgba(155,163,170,'+(.5-i*.05)+')';ctx.lineWidth=i===0?1.6:1;
   ctx.beginPath();
   for(let x=0;x<=w;x+=3){const y=h/2+Math.sin(x*.02*f+t*(1+p.motion*3)+ph)*h*(.3/(1+i*.5));
    x?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke()}
  lab(ctx,V+' VOICES · TONE.JS Offline() · NO REAL-TIME DEPENDENCY',10,h-12)}}),
 'An ambient tone bed rendered offline, so it is as reproducible as the picture.',1);

reg('sonify','N · AUDIO','DATA → AUDIO',
 {mapping:{v:0,lo:0,hi:2,int:1},rate:{v:.4,lo:.1,hi:1},range:{v:.6,lo:.1,hi:1}},
 p=>({frame(ctx,w,h,t){bg(ctx,w,h);const M=Math.round(p.mapping),mx=Math.max(...DATA);
  const head=(t*p.rate*.4)%1,idx=Math.floor(head*DATA.length);
  const bw=w/DATA.length;
  DATA.forEach((v,i)=>{const on=i===idx;
   const y=M===0?h-(v/mx)*h*p.range*.9:M===1?h/2:h-(i/DATA.length)*h*.8;
   const r=M===1?4+v*2.2*p.range:3.4;
   ctx.fillStyle=on?EMB:'rgba(238,241,243,.4)';
   ctx.beginPath();ctx.arc(i*bw+bw/2,M===1?h/2+(v-3)*11*p.range:y,on?r*1.5:r,0,6.3);ctx.fill();
   if(on){ctx.strokeStyle='rgba(216,98,74,.4)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(i*bw+bw/2,M===1?h/2+(v-3)*11*p.range:y,r*3.2,0,6.3);ctx.stroke()}});
  ctx.strokeStyle='rgba(216,98,74,.55)';ctx.beginPath();ctx.moveTo(head*w,0);ctx.lineTo(head*w,h);ctx.stroke();
  lab(ctx,['PITCH','PAN','RHYTHM'][M]+' MAPPING · '+DATA.length+' EVENTS',10,h-12)}}),
 'Data mapped to pitch, pan or rhythm. Phase 1 — but the interface is defined now so the hook exists.',1);
