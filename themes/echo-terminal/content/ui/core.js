/* Pure host-state adapter. No network, local file access or generated audio. */
(function (root) {
  'use strict';
  const finite = Number.isFinite;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const two = v => String(v).padStart(2, '0');
  const format = seconds => {
    const n = Math.max(0, finite(seconds) ? seconds : 0);
    return `${two(Math.floor(n / 60))}:${two(Math.floor(n % 60))}`;
  };
  const stamp = ms => format(ms / 1000) + '.' + two(Math.floor(Math.max(0, ms) % 1000 / 10));
  class Receiver {
    constructor() {
      this.clock = null; this.primary = null; this.fallback = null;
      this.track = null; this.docs = new Map(); this.audio = null; this.levels = null;
      this.audioAt = 0; this.features = []; this.capabilities = []; this.visible = true;
      this.frameInterval = 100; this.generation = null; this.reducedMotion = false;
      this.canPrevious = true; this.canNext = true; this.epoch = 0;
      this.pendingAudio = null; this.audioAvailable = false;
    }
    get id() { return this.clock?.currentTrackId ?? null; }
    acceptPlayback(p, now, primary) {
      if (!p || !finite(p.positionSeconds) || !finite(p.durationSeconds)) return false;
      if (primary && !finite(p.sampledAtMs)) return false;
      if (finite(p.generation) && finite(this.generation) && p.generation < this.generation) return false;
      if (primary && this.primary && p.sampledAtMs < this.primary.sampledAtMs) return false;
      const changed = p.currentTrackId !== this.id;
      if (changed) {
        this.primary = null; this.fallback = null; this.track = null;
        this.audio = null; this.audioAvailable = false; this.levels = null; this.audioAt = 0; this.epoch++;
      }
      if (finite(p.generation)) this.generation = p.generation;
      const clean = { ...p, positionSeconds: Math.max(0, p.positionSeconds),
        durationSeconds: Math.max(0, p.durationSeconds), playbackRate: finite(p.playbackRate) ? p.playbackRate : (this.primary?.playbackRate || 1) };
      if (primary) {
        this.primary = clean;
        if (!(this.fallback && now - p.sampledAtMs > 1500 && this.fallback.sampledAtMs > p.sampledAtMs)) this.clock = clean;
      } else {
        if (!this.fallback || ['currentTrackId','state','positionSeconds','durationSeconds'].some(k => clean[k] !== this.fallback[k])) {
          this.fallback = { ...clean, sampledAtMs: now };
        }
        if (!this.primary || !this.features.includes('clock') || now - this.primary.sampledAtMs > 1500 || clean.state !== this.primary.state) this.clock = this.fallback;
      }
      if (this.pendingAudio?.message.trackId === this.id && now - this.pendingAudio.at < 1500) {
        this.acceptAudio(this.pendingAudio.message, this.pendingAudio.at);
        this.pendingAudio = null;
      }
      return true;
    }
    acceptAudio(m, now) {
      if ('audio' in m) {
        this.audioAvailable = !!m.audio;
        // A null snapshot is a temporary absence, not a new device configuration.
        // Keep the last real metadata for this track; a track change clears it.
        if (m.audio) this.audio = { ...m.audio };
      }
      this.levels = m.levels || null; this.audioAt = now;
    }
    position(now) {
      const c = this.clock;
      if (!c) return 0;
      const elapsed = clamp(now - c.sampledAtMs, 0, 1500);
      return clamp(c.positionSeconds + (c.state === 'playing' ? elapsed * c.playbackRate / 1000 : 0), 0, c.durationSeconds || Infinity);
    }
    setLyrics(id, lyrics, revision = 0) {
      if (!id || id !== this.id) return false;
      const old = this.docs.get(id);
      if (old && revision < old.revision) return false;
      if (!lyrics || !['synced','plain','empty','instrumental'].includes(lyrics.kind)) lyrics = null;
      if (lyrics) lyrics = { ...lyrics, offsetMs: finite(lyrics.offsetMs) ? lyrics.offsetMs : 0,
        lines: Array.isArray(lyrics.lines) ? lyrics.lines.filter(l => finite(l.timeMs) && typeof l.text === 'string').slice(0,10000).sort((a,b) => a.timeMs-b.timeMs) : [] };
      this.docs.set(id, { lyrics, revision });
      while (this.docs.size > 2) this.docs.delete(this.docs.keys().next().value);
      return true;
    }
    receive(m, now) {
      if (m.protocolVersion !== 1) return false;
      if (m.type === 'echo:workshop-ui:init') {
        this.features = Array.isArray(m.features) ? m.features : [];
        this.capabilities = Array.isArray(m.capabilities) ? m.capabilities : [];
        this.visible = m.uiContext?.visible !== false;
        this.reducedMotion = !!m.uiContext?.reducedMotion;
      }
      if (m.type === 'echo:workshop-ui:clock' || m.type === 'echo:workshop-ui:state') {
        const p = m.clock || m.playback;
        if (p && !this.acceptPlayback(p, now, !!m.clock)) return false;
        if (m.currentTrack !== undefined && (!m.currentTrack || m.currentTrack.id === this.id)) this.track = m.currentTrack;
        if (m.motion && ('frameIntervalMs' in m.motion)) this.frameInterval = m.motion.frameIntervalMs === null ? null : Math.max(40, Number(m.motion.frameIntervalMs) || 100);
        if (m.playback?.canGoPrevious !== undefined) this.canPrevious = !!m.playback.canGoPrevious;
        if (m.playback?.canGoNext !== undefined) this.canNext = !!m.playback.canGoNext;
        if (m.uiContext) this.visible = m.uiContext.visible !== false;
      }
      if (m.type === 'echo:workshop-ui:lyrics') this.setLyrics(m.trackId, m.lyrics, finite(m.revision) ? m.revision : 0);
      if (m.type === 'echo:workshop-ui:audio' && m.trackId) {
        if (m.trackId === this.id) this.acceptAudio(m, now);
        else this.pendingAudio = { message: m, at: now };
      }
      return true;
    }
    meter(now) {
      if (!this.capabilities.includes('audio:spectrum') || this.clock?.state !== 'playing' || now - this.audioAt > 1500) return { peak: null, rms: null };
      const db = x => finite(x) ? clamp(x, -60, 0) : null;
      return { peak: db(this.levels?.peakDb), rms: db(this.levels?.rmsDb) };
    }
    lyricView(now) {
      const lyrics = this.docs.get(this.id)?.lyrics;
      const empty = (text, label) => ({index:-1, total:lyrics?.lines?.length||0, text, label, rows:[], plain:false});
      if (!this.id) return empty('等待播放', 'WAITING FOR ECHO');
      if (!lyrics) return empty('等待歌词', 'WAITING FOR LYRICS');
      if (lyrics.kind === 'instrumental') return empty('纯音乐', 'INSTRUMENTAL');
      if (lyrics.kind === 'empty') return empty('暂无歌词', 'NO LYRICS');
      if (lyrics.kind === 'plain') return {...empty(lyrics.plainText || lyrics.lines.map(l=>l.text).join('\n') || '暂无歌词', 'UNSYNCED TEXT'), plain:true};
      const ms = this.position(now)*1000 + lyrics.offsetMs;
      let index=-1,lo=0,hi=lyrics.lines.length-1;
      while(lo<=hi){const mid=(lo+hi)>>1;if(lyrics.lines[mid].timeMs<=ms){index=mid;lo=mid+1;}else hi=mid-1;}
      if (!lyrics.lines.length) return empty('暂无歌词','NO LYRICS');
      const line=lyrics.lines[index];
      const rest = line && (!line.text.trim() || (finite(line.endMs) && ms > line.endMs));
      return {index,total:lyrics.lines.length,text:index<0?'前奏':rest?'间奏':line.text,
        label:index<0?'PRELUDE':rest?'INTERLUDE':'RECEIVING / TEXT',plain:false,
        rows:[index-2,index-1,index,index+1].map(i=>i>=0&&i<lyrics.lines.length?{...lyrics.lines[i],index:i,seek:Math.max(0,(lyrics.lines[i].timeMs-lyrics.offsetMs)/1000)}:null)};
    }
  }
  const api = { Receiver, format, stamp, clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TelegraphCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
