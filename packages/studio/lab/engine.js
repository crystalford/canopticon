/* CANOPTICON — resolver, composition engine, cache. Deterministic. No Math.random. */
const F=window.FILM;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const smooth=t=>t*t*(3-2*t);

/* ── creative state resolution ─────────────────────────── */
function resolveAt(pos){
  const cp=F.controlPoints,out={};
  let i=0;while(i<cp.length-2&&cp[i+1].at<pos)i++;
  const a=cp[i],b=cp[i+1],span=b.at-a.at;
  const t=smooth(clamp(span?(pos-a.at)/span:0,0,1));
  for(const k in a.v)out[k]=a.v[k]+(b.v[k]-a.v[k])*t;
  Object.assign(out,F.identity);
  const held=[];
  for(const inv of F.invariants){
    const v=out[inv.param];
    if(inv.min!=null&&v<inv.min){out[inv.param]=inv.min;held.push(inv.param+' floored '+inv.min.toFixed(2));}
    if(inv.max!=null&&v>inv.max){out[inv.param]=inv.max;held.push(inv.param+' capped '+inv.max.toFixed(2));}
  }
  out._held=held;return out;
}

/* ── composition engine ────────────────────────────────── */
const LADDER=[
  {max:.30,tier:'GROUNDED',base:['document_surface','document_layout','camera_move']},
  {max:.52,tier:'ANNOTATED',base:['document_surface','annotation','text_stagger']},
  {max:.70,tier:'DECOMPOSED',base:['text_layout','glyph_to_points','particle_seek']},
  {max:1.01,tier:'DISSOLVED',base:['noise_field','flow_field','particle_flow','particle_trail']}
];
const MOTIF_CHAIN={time:['timeline_linear','text_stagger'],institution:['document_surface','camera_move'],uncertainty:['glyph_to_points','particle_flow']};

function compose(scene){
  const st=resolveAt(scene.pos),notes=[],ruleHits=[];
  let abstraction=st.abstraction;
  // rule precedence: hard rules first
  if(scene.act==='act_1'&&abstraction>.30){abstraction=.30;ruleHits.push({id:'r1',msg:'abstraction clamped to 0.30 in Act I'});}
  if(scene.fn==='evidence'&&abstraction>.60){abstraction=.60;ruleHits.push({id:'r4',msg:'evidence scene held at 0.60'});}
  const pin=F.overrides.find(o=>o.sceneId===scene.id&&o.type==='pin');

  const rung=LADDER.find(l=>abstraction<l.max);
  let chain=rung.base.slice();
  // motif continuity outranks anti-repetition
  const motifs=[];
  for(const e of scene.entities){
    const m=F.motifs.find(x=>x.id===e);if(!m)continue;
    const si=clamp(Math.floor(abstraction*m.states.length),0,m.states.length-1);
    motifs.push({id:m.id,concept:m.concept,state:m.states[si],si});
    for(const p of MOTIF_CHAIN[e])if(!chain.includes(p))chain.push(p);
  }
  // density adds compositing depth; restraint caps chain length
  if(st.visualDensity>.55&&!chain.includes('blend'))chain.push('blend');
  if(st.visualDensity>.75&&!chain.includes('nest'))chain.push('nest');
  if(st.typographicWeight>.55&&!chain.includes('variable_axis'))chain.push('variable_axis');
  const ceiling=Math.round(4+(1-st.restraint)*2+st.experimentalism*4);
  if(chain.length>ceiling){notes.push('restraint ceiling '+ceiling+' — '+(chain.length-ceiling)+' dropped');chain=chain.slice(0,ceiling);}
  if(pin){chain=['document_surface','document_layout','annotation'];notes.push('pinned — composition bypassed');}

  const nodes=chain.map((p,i)=>{
    const params={
      seed:1000+scene.n*17+i,
      density:+(st.visualDensity).toFixed(3),
      energy:+(st.motionEnergy).toFixed(3),
      abstraction:+abstraction.toFixed(3),
      human:+(st.humanPresence).toFixed(3)
    };
    if(pin)Object.assign(params,{density:.35,energy:.1,abstraction:.15});
    return{prim:p,params,hash:hash(p+JSON.stringify(params)),cost:COST[p]||4};
  });
  const cost=nodes.reduce((a,n)=>a+n.cost,0);
  const det=nodes.some(n=>n.prim==='shader_surface')?'L2-GPU':'L2';
  return{scene,state:st,abstraction,tier:rung.tier,nodes,motifs,ruleHits,notes,pin,cost,det};
}
const COST={noise_field:6,flow_field:7,particle_flow:14,particle_seek:12,particle_trail:9,glyph_to_points:5,text_layout:2,text_stagger:2,document_surface:3,document_layout:3,annotation:2,camera_move:1,timeline_linear:4,blend:2,nest:5,variable_axis:1,shader_surface:11};

function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0');}

/* ── compile / cache ───────────────────────────────────── */
const CACHE={snapshot:null,history:[]};
function composeAll(){return F.scenes.map(compose);}
function dryRun(){
  const comps=composeAll(),prev=CACHE.snapshot;
  let hit=0,miss=0;const perScene=comps.map(c=>{
    const before=prev&&prev[c.scene.id];
    let h=0,m=0,reasons=[];
    c.nodes.forEach(n=>{
      const was=before&&before.find(x=>x.prim===n.prim);
      if(was&&was.hash===n.hash){n.cached=true;h++}
      else{n.cached=false;m++;if(was)reasons.push(n.prim+' params changed');else reasons.push(n.prim+' new in chain')}
    });
    if(before)before.forEach(x=>{if(!c.nodes.find(n=>n.prim===x.prim))reasons.push(x.prim+' removed')});
    hit+=h;miss+=m;
    return{...c,hits:h,misses:m,reasons,status:!prev?'new':m?'recompute':'hit'};
  });
  return{comps:perScene,hit,miss,total:hit+miss,fresh:!prev};
}
function commit(run){
  const snap={};run.comps.forEach(c=>snap[c.scene.id]=c.nodes.map(n=>({prim:n.prim,hash:n.hash})));
  CACHE.snapshot=snap;
  CACHE.history.unshift({at:new Date(),miss:run.miss,total:run.total,ms:(400+run.miss*310+(run.fresh?1800:0))/1000});
  CACHE.history=CACHE.history.slice(0,6);
}
Object.assign(window,{resolveAt,compose,composeAll,dryRun,commit,CACHE,hash,clamp,LADDER});
