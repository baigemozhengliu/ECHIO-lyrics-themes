/* Generated from EL/parameters.json. */
(function(root){
'use strict';
const config={"schema":"retro-display-fx/el-parameters/v1","source":"user screenshot 2026-10-20","renderer":"el-industrial-calibrated.html","parameters":{"core":1.8,"sharp":1,"tight":0.72,"tightRadius":1.5,"warm":0.45,"warmRadius":3,"outer":0.69,"outerRadius":15,"grain":0.9,"grainSize":1.5,"density":0.15,"yellow":0.84},"enabled":{"showCore":true,"showGlow":true,"showGrain":true},"reserved_not_active":["sharp","density"]},p={...config.parameters},enabled={...config.enabled};
let noiseKey='',noiseUrl='';
let coreColor='rgb(255,228,42)';
const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');svg.style.cssText='position:absolute;width:0;height:0;pointer-events:none';document.body.appendChild(svg);
// One scene mask, one optical pass. Black occluders become holes, never luminous rectangles.
function apply(){
 const g=Math.round(177+p.yellow*61),b=Math.round(18+p.yellow*28),boost=Math.min(.32,Math.max(0,(p.core-1)*.23));
 coreColor=`rgb(255,${g},${b})`;
 const layers=[[p.outerRadius,p.outer*.18,'184,48,8'],[p.warmRadius*1.8,p.warm*.14,'224,92,12'],[p.warmRadius,p.warm*.33,'255,143,16'],[p.tightRadius*2.2,p.tight*.40,'255,185,28'],[p.tightRadius,p.tight*.66,'255,220,51']];
 const s=document.documentElement.style;for(const n of ['--amber','--amber2','--fx-core'])s.setProperty(n,coreColor);
 let nodes='<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 0" result="mask"/>';
 let merge='';
 if(enabled.showGlow)layers.forEach(([radius,alpha,color],i)=>{nodes+=`<feGaussianBlur in="mask" stdDeviation="${radius}" result="blur${i}"/><feFlood flood-color="rgb(${color})" flood-opacity="${alpha}"/><feComposite in2="blur${i}" operator="in" result="glow${i}"/>`;merge+=`<feMergeNode in="glow${i}"/>`;});
 if(enabled.showGrain){
 const r=document.querySelector('.panel').getBoundingClientRect(),noise=document.createElement('canvas');noise.width=Math.ceil(r.width);noise.height=Math.ceil(r.height);const c=noise.getContext('2d');
 const cacheKey=[r.width,r.height,p.grain,p.grainSize].join(',');if(noiseKey!==cacheKey){
 for(let y=0;y<noise.height;y+=p.grainSize)for(let x=0;x<noise.width;x+=p.grainSize){const v=Math.sin(x*127.1+y*311.7)*43758.5453,h=v-Math.floor(v);if(h<.52*p.grain){c.fillStyle=`rgba(255,158,32,${(.16+.30*h)*p.grain})`;c.fillRect(x,y,Math.max(.65,p.grainSize*.37),Math.max(.65,p.grainSize*.37));}}
 noiseKey=cacheKey;noiseUrl=noise.toDataURL();}
 nodes+=`<feComponentTransfer in="mask" result="inside"><feFuncA type="linear" slope="255" intercept="-25"/></feComponentTransfer><feComponentTransfer in="mask" result="solid"><feFuncA type="linear" slope="255" intercept="-80"/></feComponentTransfer>`;
 [[-2,0],[2,0],[0,-2],[0,2],[-4,-4],[4,4]].forEach(([x,y],i)=>{nodes+=`<feOffset in="solid" dx="${x}" dy="${y}" result="neighbor${i}"/>`;});
 nodes+='<feMerge result="near">'+Array.from({length:6},(_,i)=>`<feMergeNode in="neighbor${i}"/>`).join('')+'</feMerge><feComposite in="near" in2="inside" operator="out" result="edge"/>';
 nodes+=`<feImage href="${noiseUrl}" x="0" y="0" width="${r.width}" height="${r.height}" preserveAspectRatio="none"/><feComposite in2="edge" operator="in" result="grain"/>`;merge+='<feMergeNode in="grain"/>';
 }
 if(enabled.showCore){nodes+=`<feFlood flood-color="${coreColor}" flood-opacity="${Math.min(1,p.core)}"/><feComposite in2="mask" operator="in" result="core"/>`;merge+='<feMergeNode in="core"/>';if(boost){nodes+=`<feFlood flood-color="rgb(255,${Math.min(255,g+24)},${b+35})" flood-opacity="${boost}"/><feComposite in2="mask" operator="in" result="boost"/>`;merge+='<feMergeNode in="boost"/>';}}
 svg.innerHTML=`<defs><filter id="el-scene" x="-5%" y="-8%" width="110%" height="116%" color-interpolation-filters="sRGB">${nodes}<feMerge>${merge}</feMerge></filter></defs>`;
 document.documentElement.dataset.displayFx='el-unified-scene';
}
// Original global grain remains above the completed optics, not inside the emission mask.
const panel=document.querySelector('.panel'),grain=document.createElement('div');grain.className='el-global-grain';grain.setAttribute('aria-hidden','true');document.body.appendChild(grain);
function resize(){const r=panel.getBoundingClientRect();Object.assign(grain.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
 const d=devicePixelRatio||1,step=Math.max(2,Math.round(2.5*d)),tile=document.createElement('canvas');tile.width=tile.height=step;const c=tile.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,step,step);c.fillStyle=coreColor;const dot=Math.max(1,Math.round(1.6*d));c.fillRect(Math.floor((step-dot)/2),Math.floor((step-dot)/2),dot,dot);
 panel.style.setProperty('--level-tile',`url("${tile.toDataURL()}")`);panel.style.setProperty('--level-step',step/d+'px');
}
let lastSize='';const observer=new ResizeObserver(()=>{resize();const r=panel.getBoundingClientRect(),key=r.width+','+r.height;if(key!==lastSize){lastSize=key;apply();}});observer.observe(panel);window.addEventListener('resize',resize);
// Waveform is geometry only; it receives exactly the same material as text, rules and dots.
function strokeWave(ctx,samples,width,height,lineWidth=1){ctx.save();ctx.filter='none';ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.strokeStyle=coreColor;ctx.lineWidth=lineWidth;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();const n=samples?.length||0;if(n<2){ctx.moveTo(0,height/2);ctx.lineTo(width,height/2);}else for(let i=0;i<n;i++){const x=i/(n-1)*width,y=Math.round((height/2-samples[i]*(height/2-2))*2)/2;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();ctx.restore();}
root.TelegraphDisplayFX={parameters:p,enabled,reserved:config.reserved_not_active,get coreColor(){return coreColor},defaults:structuredClone(config),apply,resize,strokeWave};apply();resize();
})(globalThis);
