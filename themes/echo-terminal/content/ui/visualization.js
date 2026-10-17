(function(root){
  'use strict';
  class Visualization {
    constructor(){this.reset();}
    reset(){this.trackId=null;this.at=0;this.waveform=null;this.channels=[];this.source=null;}
    accept(message,trackId,now){
      if(!trackId||message.trackId!==trackId)return false;
      this.trackId=trackId;this.at=now;this.source=message.levels?.source??null;
      this.channels=(Array.isArray(message.levels?.channels)?message.levels.channels:[]).slice(0,32).map(c=>({rmsDb:Number.isFinite(c?.rmsDb)?c.rmsDb:null,peakDb:Number.isFinite(c?.peakDb)?c.peakDb:null}));
      const w=message.waveform;
      this.waveform=w?.source==='native_post_dsp'&&w.channels===1&&Number.isFinite(w.sampleRate)&&w.sampleRate>0&&Array.isArray(w.samples)&&w.samples.length>1&&w.samples.length<=2048&&w.samples.every(Number.isFinite)?{samples:w.samples.slice(),sampleRate:w.sampleRate}:null;
      return true;
    }
    snapshot(trackId,playing,now){return playing&&trackId===this.trackId&&now-this.at<1500?{waveform:this.waveform,channels:this.source==='native_post_dsp'?this.channels:[]}:{waveform:null,channels:[]};}
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={Visualization};else root.TelegraphVisualization={Visualization};
})(globalThis);
