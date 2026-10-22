/* ECHO plug-in panel. Decoding is performed by the official offline PCM API. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),{Receiver,format,stamp,clamp}=TelegraphCore;
  const model=new Receiver();model.capabilities=['playback:read','playback:control','lyrics:read'];
  const host=null;const visual=new TelegraphVisualization.Visualization();let showTranslation=false,targetFps=0,raf=null,lastDraw=-Infinity,fitDirty=true;
  let alive=true,visible=true,timer=null,pollTimer=null,polling=false,trackToken=0,revision=0,lastKey='',dragging=false,lyricPoll=0,sequence=0,lastApplied=0;
  let decode=null,hostReady=false,subscriptions=[],lastIndex=-1;
  const now=()=>performance.timeOrigin+performance.now();
  const set=(id,value)=>{const el=$(id),text=String(value??'—');if(el.textContent!==text)el.textContent=text;};
  let noticeTimer=null,lyricsTimer=null;
  function clearNotice(){if(noticeTimer){clearTimeout(noticeTimer);noticeTimer=null;}set('notice','');}
  function notice(text,hold=4500){if(noticeTimer){clearTimeout(noticeTimer);noticeTimer=null;}set('notice',text||'');if(text)noticeTimer=setTimeout(()=>{noticeTimer=null;if(alive)set('notice','');},hold);}
  const segments=Array.from({length:18},()=>{const node=document.createElement('div');node.className='seg';node.appendChild(document.createElement('i'));$('segments').appendChild(node);return node;});
  function updateRow(id,row,control){const el=$(id),button=el.querySelector('button');el.querySelector('time').textContent=row?stamp(row.timeMs):'';button.textContent=row?.text||'';button.disabled=!row||!control;button.onclick=row?()=>seek(row.seek):null;el.querySelector('.line-no').textContent=row?String(row.index+1).padStart(3,'0'):'';}
  function clockText(){const d=new Date(),pad=x=>String(x).padStart(2,'0');set('wall-clock',`TC-${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}:${pad(Math.floor(d.getMilliseconds()/10))}`);}
  function render(){
    if(!alive)return;const t=now(),pos=model.position(t),duration=model.clock?.durationSeconds||0,view=model.lyricView(t),control=hostReady&&!!model.id&&model.capabilities.includes('playback:control');
    const key=JSON.stringify([model.id,view.index,view.text,view.label,view.rows]);
    if(key!==lastKey){lastKey=key;set('current-lyric',view.text);fitDirty=true;set('lyric-label','TEXT');set('line-number',view.index>=0?String(view.index+1).padStart(3,'0'):'—');
      $('current-lyric').classList.toggle('plain',view.plain);$('current-lyric').classList.toggle('long',view.text.length>36);
      $('current-lyric').disabled=!view.rows[2]||!control;const current=view.rows[2];$('current-lyric').onclick=current?()=>seek(current.seek):null;
      set('lyric-time',current?stamp(current.timeMs):'—');
      updateRow('history-2',view.rows[0],control);updateRow('history-1',view.rows[1],control);updateRow('future',view.rows[3],control);
      if(!model.reducedMotion){const advance=view.index===lastIndex+1&&lastIndex>=0;
        $('current-lyric').animate?.([{opacity:.45,transform:advance?'translateY(10px)':'none'},{opacity:1,transform:'none'}],{duration:260,easing:'ease-out'});
        if(advance)for(const id of ['history-2','history-1','future'])$(id).animate?.([{transform:'translateY(12px)',opacity:.3},{transform:'none',opacity:.52}],{duration:260,easing:'ease-out'});
      }lastIndex=view.index;
    }
    set('lyric-count',`${String(Math.max(0,view.index+1)).padStart(3,'0')} / ${String(view.total).padStart(3,'0')}`);
    const playing=model.clock?.state==='playing';set('status',!model.id?'WAITING':playing?'PLAYING':model.clock?.state==='paused'?'PAUSED':'STOPPED');
    $('play').disabled=!control;$('previous').disabled=!control||!model.canPrevious;$('next').disabled=!control||!model.canNext;
    $('play').classList.toggle('is-playing',playing);$('play').setAttribute('aria-label',playing?'暂停':'播放');
    $('seek').disabled=!control||!duration;
    const ratio=dragging?Number($('seek').value)/1000:(duration?clamp(pos/duration,0,1):0);if(!dragging)$('seek').value=Math.round(ratio*1000);
    segments.forEach((seg,i)=>seg.firstChild.style.width=`${clamp(ratio*18-i,0,1)*100}%`);
    set('elapsed','CURRENT '+format(pos));set('remaining','REMAIN '+format(Math.max(0,duration-pos)));set('total','TOTAL '+format(duration));$('seek').setAttribute('aria-valuetext',`${format(pos)} / ${format(duration)}`);
    const tr=model.track;set('title',tr?.title||'尚未播放');set('artist',tr?.artist||'—');set('album',tr?.album||'—');set('track-number',tr?.trackNo?String(tr.trackNo).padStart(2,'0'):'—');
    set('codec',tr?.codec?.toUpperCase()||'—');set('sample-rate',tr?.sampleRate?`${Number((tr.sampleRate/1000).toFixed(2))} KHZ`:'—');set('bit-depth',tr?.bitDepth?`${tr.bitDepth} BIT`:'—');
    for(const id of ['title','artist','album','device'])$(id).title=$(id).textContent;
    const snapshot=visual.snapshot(model.id,playing,t),env=snapshot.waveform;
    const peaks=snapshot.channels.map(c=>c.peakDb).filter(Number.isFinite);
    const level={left:snapshot.channels[0]?.rmsDb,right:snapshot.channels[1]?.rmsDb,peak:peaks.length?Math.max(...peaks):null};
    set('wave-note',env?'':playing?'WAVEFORM UNAVAILABLE':'NO INPUT');
    set('window-start',env?('−'+((env.samples.length-1)/env.sampleRate*1000).toFixed(1)+' ms'):'—');
    const audio=model.audio;
    set('clock-mode',audio?.outputBackend||'—');$('clock-mode').title='宿主报告的实际输出后端';set('device',audio?.outputDevice||'—');$('device').title=audio?(model.audioAvailable?'宿主报告的输出设备':'最近一次有效输出信息，等待宿主更新'):'等待宿主输出信息';set('mode',audio?.outputMode||audio?.outputBackend||'—');
    set('output',audio?.deviceSampleRate?`${Number((audio.deviceSampleRate/1000).toFixed(2))} KHZ`:'—');
    set('channels',audio?.channels?String(audio.channels):'—');
    if(audio?.codec)set('codec',audio.codec.toUpperCase());
    if(audio?.sampleRate)set('sample-rate',`${Number((audio.sampleRate/1000).toFixed(2))} KHZ`);
    if(audio?.bitDepth)set('bit-depth',`${audio.bitDepth} BIT`);
    const fill=x=>Number.isFinite(x)?clamp((x+60)/60*100,0,100):0;
    $('level-a').style.height=fill(level?.left)+'%';$('level-b').style.height=fill(level?.right)+'%';$('peak-mark').style.bottom=fill(level?.peak)+'%';$('peak-mark').hidden=!Number.isFinite(level.peak);
    $('channel-a').title=`L / NATIVE OUTPUT RMS ${Number.isFinite(level?.left)?level.left.toFixed(1):'−∞'} dBFS`;$('channel-b').title=`R / NATIVE OUTPUT RMS ${Number.isFinite(level?.right)?level.right.toFixed(1):'−∞'} dBFS`;
    clockText();drawWave(env,pos);const translated=showTranslation?(view.rows[2]?.translation||''):'';set('translation',translated);$('translation').hidden=!translated;if(fitDirty){fitDirty=false;fitLyrics();}
  }
  const canvas=$('wave-canvas'),ctx=canvas.getContext('2d');let width=1,height=1;
  const observer=new ResizeObserver(()=>{const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);const scale=Math.min(2,devicePixelRatio||1),w=Math.round(width*scale),h=Math.round(height*scale);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;ctx.setTransform(scale,0,0,scale,0,0);render();}});observer.observe(canvas);
  function drawWave(env){ctx.clearRect(0,0,width,height);const lineWidth=Math.max(.7,1.4*Math.min(innerWidth/1600,innerHeight/900));
    if(window.TelegraphDisplayFX?.strokeWave){window.TelegraphDisplayFX.strokeWave(ctx,env?.samples,width,height,lineWidth);return;}
    ctx.lineWidth=lineWidth;ctx.strokeStyle='#ffe42a';ctx.beginPath();
    if(!env){ctx.moveTo(0,height/2);ctx.lineTo(width,height/2);}else{const samples=env.samples;for(let i=0;i<samples.length;i++){const x=i/(samples.length-1)*width,y=Math.round((height/2-samples[i]*(height/2-2))*2)/2;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}}
    ctx.stroke();}
  function schedule(){if(!alive||!visible||document.hidden){if(raf!==null)cancelAnimationFrame(raf);raf=null;return;}if(raf!==null)return;raf=requestAnimationFrame(t=>{raf=null;const spacing=model.reducedMotion?100:(targetFps?1000/targetFps:0);if(t-lastDraw>=spacing-.5){lastDraw=t;render();}schedule();});}
  function fitLyrics(){const el=$('current-lyric'),box=el.parentElement;if(!box)return;const u=Math.min(innerWidth/1600,(innerHeight-44)/900);let size=(el.classList.contains('plain')?22:36)*u;el.style.fontSize=size+'px';for(let i=0;i<10&&(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1);i++){size*=.88;el.style.fontSize=size+'px';}}
  // Native lyrics-view protocol only: no panel bridge, polling, or automatic PCM read.
  let request=0,lyricEpoch=0,requestedTrack=null,lastAudioEvent=0,watchdog=null;
  const audioOptions={waveformSamples:2048,intervalMs:16,spectrum:false,levels:true};
  $('translation-toggle').onclick=()=>{showTranslation=!showTranslation;fitDirty=true;$('translation-toggle').setAttribute('aria-pressed',String(showTranslation));$('translation-toggle').title=showTranslation?'隐藏翻译':'显示翻译';$('translation-toggle').setAttribute('aria-label',$('translation-toggle').title);render();};
  $('fps-toggle').onclick=()=>{targetFps=targetFps===0?60:targetFps===60?30:0;audioOptions.intervalMs=targetFps===30?33:16;set('fps-toggle',targetFps?'FPS '+targetFps:'FPS MAX');$('fps-toggle').title='界面绘制上限：'+(targetFps||'屏幕刷新率')+'；请求音频间隔 '+audioOptions.intervalMs+' ms，实际数据频率受宿主限制';post({type:'echo:workshop-ui:audio-configure',audioVisualization:audioOptions});schedule();};
  if(window.denpaFontReady){
    window.denpaFontReady.then(()=>{if(!alive)return;document.documentElement.style.setProperty('--el-font',"IBM3270,'Microsoft YaHei','Yu Gothic',monospace");document.documentElement.dataset.fontLoaded='IBM3270';fitDirty=true;}).catch(error=>{console.error('IBM3270 注册失败',error);});
  }
  const pending=new Map();
  const post=message=>parent.postMessage({protocolVersion:1,...message},'*');
  function cancelPending(epoch){for(const [id,item] of pending){if(item.epoch!==epoch)continue;clearTimeout(item.timeout);pending.delete(id);}}
  function command(name,payload={}){
    if(!hostReady||!alive)return;
    const requestId=String(++request);
    if(pending.size>=16)return;
    const timeout=setTimeout(()=>{const item=pending.get(requestId);if(!item)return;pending.delete(requestId);if(alive&&item.name!=='audio:getVisualization'&&item.name!=='lyrics:get')notice('ECHO 未响应操作。');},8000);
    pending.set(requestId,{name,trackId:payload.trackId,epoch:lyricEpoch,timeout});
    post({type:'echo:workshop-ui:command',requestId,command:name,payload});
  }
  const seek=seconds=>command('seek',{positionSeconds:Math.max(0,seconds)});
  $('seek').oninput=()=>{dragging=true;};
  $('seek').onchange=()=>{dragging=false;seek(Number($('seek').value)/1000*(model.clock?.durationSeconds||0));};
  $('seek').onblur=()=>{dragging=false;};
  // Handle the first pointer press ourselves; native range focus must not consume it.
  let seekPointer=null,lastSeekValue=null;
  function previewSeek(event){const input=$('seek'),rect=input.getBoundingClientRect();input.value=Math.round(clamp((event.clientX-rect.left)/Math.max(1,rect.width),0,1)*1000);render();}
  function commitSeek(){const value=Number($('seek').value);if(value!==lastSeekValue){lastSeekValue=value;seek(value/1000*(model.clock?.durationSeconds||0));}}
  $('seek').onpointerdown=event=>{if($('seek').disabled||event.button!==0)return;event.preventDefault();seekPointer=event.pointerId;lastSeekValue=null;dragging=true;$('seek').setPointerCapture(event.pointerId);previewSeek(event);commitSeek();};
  $('seek').onpointermove=event=>{if(event.pointerId!==seekPointer)return;event.preventDefault();previewSeek(event);};
  $('seek').onpointerup=event=>{if(event.pointerId!==seekPointer)return;event.preventDefault();previewSeek(event);commitSeek();seekPointer=null;dragging=false;if($('seek').hasPointerCapture(event.pointerId))$('seek').releasePointerCapture(event.pointerId);};
  $('seek').onpointercancel=()=>{seekPointer=null;dragging=false;};
  $('seek').onlostpointercapture=()=>{seekPointer=null;dragging=false;};
  $('play').onclick=()=>command('playPause');
  $('previous').onclick=()=>command('previous');$('next').onclick=()=>command('next');
  const back=()=>{if(model.features.includes('lyrics-interaction'))post({type:'echo:workshop-ui:interaction',action:'back'});};
  $('exit').onclick=back;
  function requestLyrics(force=false){if(!model.id||!hostReady||!model.capabilities.includes('lyrics:read'))return;if(!force&&(requestedTrack===model.id||model.features.includes('lyrics-events')))return;requestedTrack=model.id;command('lyrics:get',{trackId:model.id});}
  function onMessage(event){
    if(event.source!==parent||event.data?.protocolVersion!==1||!alive)return;
    const m=event.data;
    if(m.type==='echo:workshop-ui:ping'){post({type:'echo:workshop-ui:pong'});return;}
    if(m.type==='echo:workshop-ui:result'){
      const item=pending.get(m.requestId);if(!item)return;clearTimeout(item.timeout);pending.delete(m.requestId);
      if(item.epoch!==lyricEpoch)return;
      if(m.ok&&item.name==='lyrics:get')model.setLyrics(item.trackId,m.value,++revision);
      if(m.ok&&item.name==='audio:getVisualization'&&item.trackId===model.id&&m.value?.trackId===model.id)visual.accept(m.value,model.id,now());
      if(m.ok){if(item.name!=='audio:getVisualization')clearNotice();}else if(item.name!=='audio:getVisualization'&&item.name!=='lyrics:get')notice('ECHO 未能完成操作。');schedule();return;
    }
    if(!['echo:workshop-ui:init','echo:workshop-ui:clock','echo:workshop-ui:state','echo:workshop-ui:lyrics','echo:workshop-ui:audio'].includes(m.type))return;
    const previousEpoch=model.epoch,previousEpochValue=lyricEpoch;
    if(!model.receive(m,now()))return;
    if(m.type==='echo:workshop-ui:init'){hostReady=true;clearNotice();post({type:'echo:workshop-ui:audio-configure',audioVisualization:audioOptions});}
    if(previousEpoch!==model.epoch){lyricEpoch=previousEpochValue+1;requestedTrack=null;lastKey='';lastIndex=-1;lastAudioEvent=0;dragging=false;seekPointer=null;lastSeekValue=null;visual.reset();cancelPending(previousEpochValue);clearNotice();clearTimeout(lyricsTimer);lyricsTimer=setTimeout(()=>{lyricsTimer=null;if(alive&&model.id&&!model.docs.has(model.id))requestLyrics(true);},2500);}
    if(m.type==='echo:workshop-ui:lyrics'&&m.trackId===model.id)clearTimeout(lyricsTimer);
    if(m.type==='echo:workshop-ui:audio'&&model.capabilities.includes('audio:spectrum')){if(visual.accept(m,model.id,now()))lastAudioEvent=now();}
    visible=model.visible;requestLyrics();schedule();
  }
  window.addEventListener('message',onMessage);
  document.addEventListener('visibilitychange',()=>{schedule();if(!document.hidden)render();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();back();}if(event.code==='Space'&&event.target===document.body&&hostReady){event.preventDefault();command('playPause');}});
  function recoverAudio(){
    if(!alive)return;
    if(hostReady&&visible&&!document.hidden&&model.clock?.state==='playing'&&model.capabilities.includes('audio:spectrum')&&now()-lastAudioEvent>400&&![...pending.values()].some(item=>item.name==='audio:getVisualization'))command('audio:getVisualization',{...audioOptions,trackId:model.id});
    watchdog=setTimeout(recoverAudio,500);
  }
  window.addEventListener('resize',()=>{fitDirty=true;});
  window.addEventListener('pagehide',()=>{alive=false;if(raf!==null)cancelAnimationFrame(raf);clearTimeout(timer);clearTimeout(watchdog);clearTimeout(noticeTimer);clearTimeout(lyricsTimer);observer.disconnect();window.removeEventListener('message',onMessage);for(const item of pending.values())clearTimeout(item.timeout);pending.clear();});
  render();post({type:'echo:workshop-ui:ready',audioVisualization:audioOptions});recoverAudio();schedule();
})();
