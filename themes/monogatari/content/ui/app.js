'use strict';
(() => {
  const $ = id => document.getElementById(id), root = document.documentElement;
  let clock = null, doc = null, track = null, interval = null, raf = null, lastDraw = 0, key = '', request = 0;
  let features = [], capabilities = [], visible = true, dragging = false, size = 36;
  let primaryClock = null, fallbackClock = null;
  const timestamp = () => performance.timeOrigin + performance.now();
  const pending = new Map();
  const post = data => parent.postMessage({protocolVersion:1,...data}, '*');
  const command = (name,payload={}) => { const requestId=String(++request); pending.set(requestId,name); if(pending.size>32)pending.delete(pending.keys().next().value);post({type:'echo:workshop-ui:command',requestId,command:name,payload}); };
  const fmt = n => { n=Math.max(0,Math.floor(Number(n)||0)); return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`; };
  const position = () => { if(!clock)return 0;const elapsed=Math.max(0,Math.min(1500,performance.timeOrigin+performance.now()-clock.sampledAtMs));return Math.max(0,Math.min(clock.durationSeconds||Infinity,clock.positionSeconds+(clock.state==='playing'?elapsed*(clock.playbackRate||1)/1000:0))); };
  function render(){
    const lyrics=doc&&doc.trackId===clock?.currentTrackId?doc.lyrics:null, lines=lyrics?.lines||[], ms=position()*1000+(lyrics?.offsetMs||0);
    let index=-1; if(lyrics?.kind==='synced')for(let i=0;i<lines.length;i++)if(lines[i].timeMs<=ms)index=i;
    const active=lyrics?.kind==='synced'?lines[index]:null;
    let text=active?.text??'', empty='';
    if(!clock?.currentTrackId){text='余白';empty='等待 ECHO 播放';}
    else if(lyrics?.kind==='instrumental'){text='間奏';empty='INSTRUMENTAL';}
    else if(lyrics?.kind==='plain'){text=lyrics.plainText||lines.map(l=>l.text).join('\n');empty='未同步歌词';}
    else if(!lyrics||lyrics.kind==='empty'||!lines.length){text='余白';empty='暂无歌词';}
    else if(index<0){text='序';empty='前奏';}
    else if(!text.trim()||(active.endMs!=null&&ms>active.endMs)){text='間';empty='间奏';}
    // A document revision is not a lyric change. Repeated publications must not
    // replace the DOM, reset its scroll position or restart the fade animation.
    const nextKey=JSON.stringify([clock?.currentTrackId,text,empty]);
    if(key!==nextKey){key=nextKey;$('line').textContent=text;$('empty').textContent=empty;}
    const translation=active?.translation||'';
    if($('translation').textContent!==translation)$('translation').textContent=translation;
    $('chapter').textContent=index>=0?`VERSE ${String(index+1).padStart(2,'0')}`:'TRACK —';
    $('line').disabled=!active||!capabilities.includes('playback:control');
    const current=track?.id===clock?.currentTrackId?track:null;
    $('title').textContent=current?.title||lyrics?.title||(clock?.currentTrackId?'未知曲目':'尚未播放');$('album').textContent=current?.album||lyrics?.album||'—';$('artist').textContent=current?.artist||lyrics?.artist||'—';
    const time=`${fmt(position())} / ${fmt(clock?.durationSeconds)}`;
    if($('time').getAttribute('aria-label')!==time){$('time').setAttribute('aria-label',time);$('time').replaceChildren(...Array.from(time.replace(/ /g,'')).map(c=>{const s=document.createElement('span');s.textContent=c;return s;}));}
    $('play').textContent=clock?.state==='playing'?'PLAYING —':clock?.currentTrackId?'PAUSED —':'WAITING —';$('play').disabled=!clock?.currentTrackId||!capabilities.includes('playback:control');
    $('progress').disabled=!clock?.durationSeconds||!capabilities.includes('playback:control');if(!dragging)$('progress').value=clock?.durationSeconds?Math.round(position()/clock.durationSeconds*1000):0;
  }
  function stop(){if(raf!==null)cancelAnimationFrame(raf);raf=null;}
  function tick(now){raf=null;if(now-lastDraw>=Math.max(interval||100,33)){lastDraw=now;render();}if(interval!==null&&clock?.state==='playing'&&!document.hidden&&visible)raf=requestAnimationFrame(tick);}
  function restart(){stop();render();if(interval!==null&&clock?.state==='playing'&&!document.hidden&&visible)raf=requestAnimationFrame(tick);}
  function setClock(value){
    if(!value||!Number.isFinite(value.positionSeconds)||!Number.isFinite(value.sampledAtMs))return;
    if(primaryClock && value.sampledAtMs<primaryClock.sampledAtMs)return;
    if(primaryClock?.generation!=null&&value.generation!=null&&value.generation<primaryClock.generation&&value.sampledAtMs<=primaryClock.sampledAtMs)return;
    primaryClock=value;
    // Some host backends keep broadcasting the same stale clock anchor while
    // the ordinary playback state still progresses. Do not overwrite that
    // fallback with the stale anchor on every packet.
    if(fallbackClock&&timestamp()-value.sampledAtMs>1500&&fallbackClock.sampledAtMs>value.sampledAtMs)return;
    clock=value;
  }
  window.addEventListener('message',event=>{
    if(event.source!==parent||event.data?.protocolVersion!==1)return;
    const m=event.data;
    if(m.type==='echo:workshop-ui:ping'){post({type:'echo:workshop-ui:pong'});return;}
    if(m.type==='echo:workshop-ui:init'){features=m.features||[];capabilities=m.capabilities||[];visible=m.uiContext?.visible!==false;root.classList.toggle('reduced-motion',!!m.uiContext?.reducedMotion);}
    if(m.type==='echo:workshop-ui:clock'){setClock(m.clock);if(m.currentTrack!==undefined&&m.clock.currentTrackId===clock?.currentTrackId)track=m.currentTrack;interval=m.motion?.frameIntervalMs??null;}
    if(m.type==='echo:workshop-ui:lyrics'){if(!doc||m.trackId!==doc.trackId||m.revision>=doc.revision)doc=m;}
    if(m.type==='echo:workshop-ui:state'){
      if(m.currentTrack!==undefined)track=m.currentTrack;
      if(m.playback&&Number.isFinite(m.playback.positionSeconds)){
        const p=m.playback;
        const older=p.generation!=null&&primaryClock?.generation!=null&&p.generation<primaryClock.generation;
        if(!older){
          // State packets are a real host-provided fallback, never a synthetic
          // song timer. Preserve their anchor on identical repeat packets.
          if(!fallbackClock||['currentTrackId','state','positionSeconds','durationSeconds'].some(k=>fallbackClock[k]!==p[k]))fallbackClock={...p,playbackRate:primaryClock?.playbackRate||1,sampledAtMs:timestamp()};
          if(!primaryClock||!features.includes('clock')||timestamp()-primaryClock.sampledAtMs>1500){clock=fallbackClock;if(m.motion)interval=m.motion.frameIntervalMs??null;}
        }
      }
    }
    if(m.type==='echo:workshop-ui:result'&&pending.has(m.requestId)){pending.delete(m.requestId);$('notice').textContent=m.ok?'':`操作未完成：${m.error||'宿主未接受请求'}`;}
    restart();
  });
  $('play').onclick=()=>command('playPause');
  $('line').onclick=()=>{const lyrics=doc?.trackId===clock?.currentTrackId?doc?.lyrics:null;const ms=position()*1000+(lyrics?.offsetMs||0);const active=lyrics?.lines.filter(l=>l.timeMs<=ms).at(-1);if(active)command('seek',{positionSeconds:Math.max(0,(active.timeMs-(lyrics.offsetMs||0))/1000)});};
  $('progress').oninput=()=>{dragging=true;};$('progress').onchange=()=>{command('seek',{positionSeconds:Number($('progress').value)/1000*clock.durationSeconds});dragging=false;};$('progress').onblur=()=>{dragging=false;};
  document.querySelectorAll('button[data-palette]').forEach(b=>b.onclick=()=>{root.dataset.palette=b.dataset.palette;document.querySelectorAll('button[data-palette]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
  $('direction').onclick=()=>{const v=$('lyric-pair').classList.toggle('vertical');$('direction').setAttribute('aria-pressed',String(v));$('direction').textContent=v?'横排':'竖排';};
  $('translate').onclick=()=>{const v=root.classList.toggle('show-translation');$('translate').setAttribute('aria-pressed',String(v));};
  const resize=n=>{size=Math.max(24,Math.min(56,size+n));root.style.setProperty('--lyric-size',`${size}px`);};$('smaller').onclick=()=>resize(-4);$('larger').onclick=()=>resize(4);
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target===document.body&&!$('play').disabled){e.preventDefault();command('playPause');}});
  document.addEventListener('visibilitychange',restart);window.addEventListener('pagehide',()=>{stop();doc=null;clock=null;track=null;pending.clear();});
  render();post({type:'echo:workshop-ui:ready'});
})();
