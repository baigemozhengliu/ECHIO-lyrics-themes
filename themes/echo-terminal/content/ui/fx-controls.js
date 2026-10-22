/* Native lyrics-view storage bridge; per-mode material parameters and negative lettering. */
(()=>{'use strict';
const fx=TelegraphDisplayFX,key='terminal.display-fx.v1';
const META={
 el:{specs:[['core','核心亮度',.5,1.8,.01],['yellow','主体偏黄',0,1,.01],['tight','贴边光强度',0,2,.01],['tightRadius','贴边半径',.5,7,.1],['warm','暖光强度',0,1.7,.01],['warmRadius','暖光半径',2,28,.1],['outer','外晕强度',0,1.2,.01],['outerRadius','外晕半径',4,50,.1],['grain','边缘颗粒',0,1.5,.01],['grainSize','颗粒点距',.8,5,.1]],flags:[['showCore','核心'],['showGlow','光晕'],['showGrain','边缘颗粒']]},
 vfd:{specs:[['core','核心亮度',.3,2.2,.01],['exposure','发光层曝光 EV',0,3,.05],['near','贴边光强',0,2,.01],['nearRadius','贴边半径',.2,8,.1],['mid','中层荧光',0,1.5,.01],['midRadius','中层半径',1,25,.5],['far','远场扩散',0,1,.01],['farRadius','远场半径',4,50,1],['glassDepth','玻璃深度',0,1,.01],['unlit','周边格栅增亮',0,1,.01],['mesh','全局格栅可见度',0,.6,.01],['reflection','玻璃反射',0,.8,.01],['hue','冰青程度',0,1,.01],['density','单元亮度差异',0,.5,.01],['pitch','像素点距',1.5,10,.5],['gap','单元间隙',.2,2,.05],['pixelBoost','细线保留',0,1,.01],['pixelContrast','像素核心对比',.3,1,.01]],flags:[['glass','玻璃'],['grid','格栅显示'],['glow','光晕'],['ghost','轻微重影']]},
 crt:{specs:[['pitch','扫描线间距',1.2,6,.1],['scan','扫描线强度',0,.85,.01],['green','荧光色相',95,150,1],['glow','光晕半径',0,30,1],['bright','发光亮度',.3,2.5,.05]],flags:[]}
};
const modes=new Map([['el',{label:'EL',parameters:fx.parameters,enabled:fx.enabled,defaults:fx.defaults,apply:()=>{fx.apply();fx.resize();}}]]);
let mode='el';document.documentElement.dataset.fxMode='el';
const trigger=document.createElement('button');trigger.className='fx-trigger';trigger.type='button';trigger.setAttribute('aria-label','FX 调整');trigger.innerHTML='<span>FX 调整</span>';document.body.append(trigger);
const dialog=document.createElement('dialog');dialog.className='fx-dialog';dialog.setAttribute('aria-labelledby','fx-title');dialog.innerHTML=`<header><div><small>DISPLAY / MATERIAL</small><h2 id="fx-title">FX 调整</h2></div><button type="button" data-close aria-label="关闭调整">×</button></header><section class="fx-modes" aria-label="屏幕材质"><button data-mode="el" aria-pressed="true">EL</button><button data-mode="vfd" disabled title="正在载入">VFD</button><button data-mode="crt" disabled title="正在载入">CRT</button></section><div class="fx-switches"></div><div class="fx-sliders"></div><footer><span role="status" id="fx-save">等待连接 ECHO</span><button type="button" data-reset>恢复默认</button></footer>`;document.body.append(dialog);
const slidersEl=dialog.querySelector('.fx-sliders'),flagsEl=dialog.querySelector('.fx-switches'),status=t=>dialog.querySelector('#fx-save').textContent=t;
function current(){return modes.get(mode)||modes.get('el')}
function buildControls(){
 const entry=current(),meta=META[mode]||META.el;
 slidersEl.innerHTML='';
 for(const [name,label,min,max,step] of meta.specs){const row=document.createElement('label');row.className='fx-slider';row.innerHTML=`<span>${label}</span><output></output><input type="range" data-param="${name}" min="${min}" max="${max}" step="${step}" aria-label="${label}">`;slidersEl.append(row);}
 flagsEl.innerHTML='';
 for(const [name,label] of meta.flags){const row=document.createElement('label');row.innerHTML=`<input type="checkbox" data-flag="${name}">${label}`;flagsEl.append(row);}
 flagsEl.hidden=meta.flags.length===0;
 reflect();
}
function reflect(){
 const entry=current();if(!entry)return;
 for(const input of slidersEl.querySelectorAll('[data-param]')){const v=entry.parameters[input.dataset.param];input.value=v;input.previousElementSibling.value=Number(v).toFixed(2);}
 for(const input of flagsEl.querySelectorAll('[data-flag]'))input.checked=!!entry.enabled[input.dataset.flag];
 for(const button of dialog.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
}
let renderTimer;function redraw(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>current()?.apply(),80);}
let ready=false,seq=0,revision=0,saveTimer,saving=false,queued=false;const pending=new Map();
function request(command,payload){return new Promise((resolve,reject)=>{const requestId='fx-'+(++seq),timer=setTimeout(()=>{pending.delete(requestId);reject(Error('timeout'));},6000);pending.set(requestId,{resolve,reject,timer});parent.postMessage({protocolVersion:1,type:'echo:workshop-ui:command',requestId,command,payload},'*');});}
function snapshot(){const parameters={},enabled={};for(const [id,entry] of modes){if(entry.parameters)parameters[id]={...entry.parameters};if(entry.enabled)enabled[id]={...entry.enabled};}return {schemaVersion:2,defaultsRevision:2,mode,parameters,enabled};}
async function save(){clearTimeout(saveTimer);queued=true;if(!ready){status('等待连接；参数尚未保存');return;}if(saving)return;saving=true;try{while(queued){queued=false;status('保存中…');await request('storage:set',{key,value:snapshot()});}status('已保存 · 下次打开自动恢复');}catch{status('保存失败 · 关闭面板可重试');}finally{saving=false;}}
function changed(){revision++;reflect();redraw();clearTimeout(saveTimer);saveTimer=setTimeout(save,350);status('已调整');}
dialog.addEventListener('input',e=>{const entry=current();if(!entry)return;if(e.target.dataset.param){entry.parameters[e.target.dataset.param]=Number(e.target.value);changed();}else if(e.target.dataset.flag&&entry.enabled){entry.enabled[e.target.dataset.flag]=e.target.checked;changed();}});
dialog.querySelector('[data-reset]').onclick=()=>{const entry=current();if(!entry)return;Object.assign(entry.parameters,entry.defaults.parameters);Object.assign(entry.enabled,entry.defaults.enabled);changed();};
function close(){clearTimeout(renderTimer);current()?.apply();save();dialog.close();trigger.focus();}
trigger.onclick=()=>{reflect();dialog.showModal();};dialog.querySelector('[data-close]').onclick=close;
document.addEventListener('keydown',e=>{if(dialog.open&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}},true);
dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
function loadSaved(saved){
 if(!saved)return false;
 if(saved.schemaVersion===2){for(const [id,meta] of Object.entries(META)){const entry=modes.get(id);if(!entry)continue;if(saved.parameters?.[id])for(const [name,,min,max] of meta.specs){const v=saved.parameters[id][name];if(typeof v==='number'&&Number.isFinite(v))entry.parameters[name]=Math.max(min,Math.min(max,v));}if(saved.enabled?.[id]&&entry.enabled)for(const [name] of meta.flags)if(typeof saved.enabled[id][name]==='boolean')entry.enabled[name]=saved.enabled[id][name];}if(saved.defaultsRevision===void 0||saved.defaultsRevision<2){const v=modes.get('vfd');if(v){if(saved.defaultsRevision===void 0&&v.parameters.pitch===3)v.parameters.pitch=1.5;if(v.parameters.exposure===1.1)v.parameters.exposure=2.5;}}mode=modes.has(saved.mode)?saved.mode:'el';return true;}
 if(saved.schemaVersion===1){const entry=modes.get('el');if(saved.parameters)for(const [name,,min,max] of META.el.specs){const v=saved.parameters[name];if(typeof v==='number'&&Number.isFinite(v))entry.parameters[name]=Math.max(min,Math.min(max,v));}if(saved.enabled)for(const [name] of META.el.flags)if(typeof saved.enabled[name]==='boolean')entry.enabled[name]=saved.enabled[name];mode='el';return true;}
 return false;
}
window.addEventListener('message',async e=>{if(e.source!==parent||e.data?.protocolVersion!==1)return;const m=e.data;if(m.type==='echo:workshop-ui:result'){const item=pending.get(m.requestId);if(!item)return;clearTimeout(item.timer);pending.delete(m.requestId);m.ok?item.resolve(m.value):item.reject(Error('storage'));}
 if(m.type==='echo:workshop-ui:init'&&!ready){ready=true;const initialRevision=revision;try{const saved=await request('storage:get',{key});if(revision===initialRevision&&loadSaved(saved)){document.documentElement.dataset.fxMode=mode;buildControls();current().apply();reflect();status('已恢复保存参数');}else{mode='el';document.documentElement.dataset.fxMode='el';buildControls();current().apply();status('默认参数');}if(queued||revision!==initialRevision)save();}catch{status('参数读取失败 · 当前使用本次设置');if(queued)save();}}
});
// Draw dark glyphs again above all emission; do not repeat the luminous label background.
const negatives=[document.querySelector('#line-number'),document.querySelector('#translation-toggle')].map(source=>{const copy=source.cloneNode(true);copy.removeAttribute('id');copy.setAttribute('aria-hidden','true');copy.tabIndex=-1;copy.className='fx-negative';document.body.append(copy);return {source,copy};});
function copyStyles(a,b){const s=getComputedStyle(a);for(const prop of s)b.style.setProperty(prop,s.getPropertyValue(prop));b.style.background='transparent';b.style.backgroundImage='none';b.style.color='#000';b.style.textShadow='none';b.style.boxShadow='none';b.style.filter='none';b.style.borderColor='transparent';for(let i=0;i<a.children.length;i++)copyStyles(a.children[i],b.children[i]);}
function position(){const r=document.querySelector('.status-bar').getBoundingClientRect();Object.assign(trigger.style,{left:r.left+r.width*.62+'px',top:r.top+'px',width:r.width*.38+'px',height:r.height+'px'});
 for(const {source,copy} of negatives){copy.innerHTML=source.innerHTML;copyStyles(source,copy);const r=source.getBoundingClientRect();Object.assign(copy.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',margin:'0',zIndex:'6',pointerEvents:'none',display:source.id==='translation-toggle'&&source.getAttribute('aria-pressed')!=='true'?'none':getComputedStyle(source).display});}}
const ro=new ResizeObserver(position);ro.observe(document.querySelector('.panel'));for(const {source} of negatives){const mo=new MutationObserver(position);mo.observe(source,{subtree:true,childList:true,characterData:true,attributes:true});}window.addEventListener('resize',position);window.denpaFontReady?.then(position);position();buildControls();
rootInterface();function rootInterface(){window.TelegraphFXPanel={registerRenderer(id,renderer){if(!['vfd','crt'].includes(id)||typeof renderer?.apply!=='function'||!renderer.parameters||!renderer.enabled||!renderer.defaults)throw Error('Invalid renderer');modes.set(id,renderer);const button=dialog.querySelector(`[data-mode="${id}"]`);button.disabled=false;button.textContent=id.toUpperCase();button.title='';if(mode===id)buildControls();},open(){trigger.click();},getState:snapshot};dialog.querySelector('.fx-modes').onclick=e=>{const id=e.target.dataset.mode;if(!modes.has(id))return;mode=id;document.documentElement.dataset.fxMode=id;buildControls();changed();};}
})();
