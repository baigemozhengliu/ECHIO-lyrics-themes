import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
class Element{
 constructor(){this.textContent='';this.attributes={};this.dataset={};this.style={setProperty(){}};const s=new Set();this.classList={add:x=>s.add(x),remove:x=>s.delete(x),toggle:(x,v)=>{v=v??!s.has(x);v?s.add(x):s.delete(x);return v;},contains:x=>s.has(x)};}
 setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}replaceChildren(...c){this.children=c;}get offsetWidth(){return 10;}
}
const elements=new Map(),listeners={},sent=[],parent={postMessage:m=>sent.push(m)},root=new Element();let now=0;
const document={documentElement:root,hidden:false,body:new Element(),getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement:()=>new Element(),querySelectorAll:()=>[],addEventListener:(n,f)=>listeners[n]=f};
const context={document,parent,window:{addEventListener:(n,f)=>listeners[n]=f},performance:{timeOrigin:100000,now:()=>now},requestAnimationFrame:()=>1,cancelAnimationFrame(){},console};
vm.runInNewContext(readFileSync(process.argv[2]||new URL('../themes/monogatari/content/ui/app.js',import.meta.url),'utf8'),context);
const receive=m=>listeners.message({source:parent,data:{protocolVersion:1,...m}});
const clock=(track='a',position=12,state='paused',generation=1)=>receive({type:'echo:workshop-ui:clock',clock:{currentTrackId:track,positionSeconds:position,state,generation,playbackRate:1,durationSeconds:80,sampledAtMs:100000+now},motion:{frameIntervalMs:null}});
const lyrics=(revision=1,kind='synced',text='second')=>receive({type:'echo:workshop-ui:lyrics',trackId:'a',revision,lyrics:{kind,title:'song',offsetMs:0,plainText:kind==='plain'?'plain text':null,lines:[{timeMs:0,text:'first'},{timeMs:10000,text,translation:'译文'},{timeMs:20000,text:'third'}]}});
receive({type:'echo:workshop-ui:init',capabilities:['playback:read','playback:control','lyrics:read'],features:['clock','lyrics-events']});
assert.equal(sent[0].type,'echo:workshop-ui:ready');clock();lyrics();assert.equal(elements.get('line').textContent,'second');
clock('a',22);assert.equal(elements.get('line').textContent,'third');clock('a',3);assert.equal(elements.get('line').textContent,'first');
clock('a',12);lyrics(2,'synced','replacement');assert.equal(elements.get('line').textContent,'replacement');lyrics(1);assert.equal(elements.get('line').textContent,'replacement');
clock('b',0,'paused',2);assert.equal(elements.get('line').textContent,'余白');clock('a',22,'paused',1);assert.equal(elements.get('line').textContent,'余白');
clock('a',12,'paused',3);lyrics(3,'instrumental');assert.equal(elements.get('line').textContent,'間奏');lyrics(4,'empty');assert.equal(elements.get('empty').textContent,'暂无歌词');lyrics(5,'plain');assert.equal(elements.get('line').textContent,'plain text');assert.equal(elements.get('line').disabled,true);
lyrics(6);elements.get('line').onclick();assert.equal(sent.at(-1).command,'seek');assert.equal(sent.at(-1).payload.positionSeconds,10);
elements.get('play').onclick();assert.equal(sent.at(-1).command,'playPause');
receive({type:'echo:workshop-ui:ping'});assert.equal(sent.at(-1).type,'echo:workshop-ui:pong');
clock('a',12,'paused',4);now=10000;receive({type:'echo:workshop-ui:ping'});assert.equal(elements.get('time').getAttribute('aria-label'),'00:12 / 01:20');
clock('a',12,'playing',5);now+=10000;receive({type:'echo:workshop-ui:state'});assert.equal(elements.get('time').getAttribute('aria-label'),'00:13 / 01:20');
listeners.message({source:{},data:{protocolVersion:1,type:'echo:workshop-ui:clock',clock:{currentTrackId:null}}});assert.equal(elements.get('line').textContent,'second');
console.log('PASS: handshake, seek both directions, lyric revisions, song isolation, stale generation, instrumental, empty, plain, seek command, playback command, heartbeat, paused clock, bounded extrapolation, source validation (15 cases)');
// Regression: frequent lyric revisions must not replace identical visible text.
let writes=0, saved=elements.get('line').textContent;
Object.defineProperty(elements.get('line'),'textContent',{get:()=>saved,set:v=>{saved=v;writes++;}});
lyrics(7);lyrics(8);lyrics(9);assert.equal(writes,0,'identical document revisions must not reset the lyric DOM');
assert.equal(elements.get('line').classList.contains('changed'),false,'no re-triggered fade');
// Regression: declared clock feature, but frozen primary anchor + live playback state.
clock('a',1,'playing',6);const frozen=100000+now;now+=3000;
receive({type:'echo:workshop-ui:state',playback:{currentTrackId:'a',state:'playing',positionSeconds:22,durationSeconds:80}});
assert.equal(elements.get('line').textContent,'third');
receive({type:'echo:workshop-ui:clock',clock:{currentTrackId:'a',state:'playing',positionSeconds:1,durationSeconds:80,playbackRate:1,generation:6,sampledAtMs:frozen},motion:{frameIntervalMs:null}});
assert.equal(elements.get('line').textContent,'third','repeated stale clock must not reset fallback');
receive({type:'echo:workshop-ui:state',playback:{currentTrackId:'a',state:'paused',positionSeconds:12,durationSeconds:80}});
assert.equal(elements.get('line').textContent,'second','fallback seek backwards must work');
clock('a',22,'paused',7);assert.equal(elements.get('line').textContent,'third','fresh primary clock recovers');
elements.get('direction').onclick();assert.equal(elements.get('lyric-pair').classList.contains('vertical'),true);
elements.get('direction').onclick();assert.equal(elements.get('lyric-pair').classList.contains('vertical'),false);
console.log('PASS: repeat-revision DOM stability, no fade restart, stalled clock fallback, stale clock isolation, fallback seek, primary recovery, shared translation direction (7 regressions)');
const pull=()=>sent.filter(m=>m.command==='lyrics:get').at(-1);
const reply=(q,value,ok=true)=>receive({type:'echo:workshop-ui:result',requestId:q.requestId,ok,value});
const pulled={kind:'synced',offsetMs:0,lines:[{timeMs:0,text:'pulled first'},{timeMs:10000,text:'pulled second'}]};
clock('pull-a',12,'paused',8);const a=pull();
clock('pull-b',12,'paused',9);const b=pull();
reply(a,pulled);assert.equal(elements.get('line').textContent,'余白','late response must not attach to new song');
reply(b,pulled);assert.equal(elements.get('line').textContent,'pulled second','pull-only host displays current lyric');
clock('pull-b',1,'paused',10);assert.equal(elements.get('line').textContent,'pulled first','pulled lyrics follow seek');
clock('pull-a',12,'paused',11);const a2=pull();
assert.notEqual(a2.requestId,a.requestId,'returning to a song starts a new request');
receive({type:'echo:workshop-ui:lyrics',trackId:'pull-a',revision:0,lyrics:{...pulled,lines:[{timeMs:0,text:'pushed'}]}});
reply(a2,pulled);assert.equal(elements.get('line').textContent,'pushed','push takes precedence');
clock('instrumental',0,'paused',12);reply(pull(),{kind:'instrumental',lines:[],plainText:null});
assert.equal(elements.get('line').textContent,'間奏','instrumental needs no text');
clock('failed',0,'paused',13);const failed=pull();reply(failed,pulled,false);
assert.equal(elements.get('line').textContent,'余白','failed request cannot inject lyrics');
const count=sent.length;clock('failed',1,'paused',14);assert.equal(sent.length,count,'no per-frame request loop');
clock('return',0,'paused',15);const old=pull();clock('other',0,'paused',16);clock('return',0,'paused',17);
reply(old,pulled);assert.equal(elements.get('line').textContent,'余白','previous visit response rejected');
reply(pull(),{kind:'plain',lines:[],plainText:'plain pull'});assert.equal(elements.get('line').textContent,'plain pull');
console.log('PASS: pull fallback, seek, late responses, revisit, push precedence, instrumental, failure, request deduplication, plain lyrics');

// Recreate the iframe while retaining only host-owned storage.
function settingsPage(saved){
 const nodes=new Map(), events={}, messages=[], host={postMessage:m=>messages.push(m)}, html=new Element();
 const styles={};html.style.setProperty=(k,v)=>styles[k]=v;
 const palettes=['red','yellow','black','white'].map(p=>{const b=new Element();b.dataset.palette=p;return b;});
 const dom={...document,documentElement:html,getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},querySelectorAll:()=>palettes,addEventListener:(n,f)=>events[n]=f};
 vm.runInNewContext(readFileSync(new URL('../themes/monogatari/content/ui/app.js',import.meta.url),'utf8'),{...context,document:dom,parent:host,window:{addEventListener:(n,f)=>events[n]=f}});
 const send=m=>events.message({source:host,data:{protocolVersion:1,...m}});
 const init=()=>send({type:'echo:workshop-ui:init',capabilities:['storage']});
 const respond=(q,value,ok=true)=>send({type:'echo:workshop-ui:result',requestId:q.requestId,ok,value});
 const writes=()=>messages.filter(m=>m.command==='storage:set');
 init();const read=messages.find(m=>m.command==='storage:get');
 return {nodes,html,styles,palettes,messages,init,respond,writes,restore:()=>respond(read,saved)};
}
const first=settingsPage(null);first.restore();assert.equal(first.writes().length,0);
first.palettes[2].onclick();first.nodes.get('direction').onclick();first.nodes.get('translate').onclick();first.nodes.get('larger').onclick();
assert.equal(first.writes().length,1,'serialize writes while first save is pending');
first.respond(first.writes()[0],null);
const stored=first.writes().at(-1).payload.value;
assert.deepEqual(JSON.parse(JSON.stringify(stored)),{palette:'black',vertical:true,translation:true,size:40});
first.respond(first.writes().at(-1),null);
const reopened=settingsPage(stored);reopened.restore();
assert.equal(reopened.html.dataset.palette,'black');assert.equal(reopened.palettes[2].getAttribute('aria-pressed'),'true');
assert.equal(reopened.nodes.get('lyric-pair').classList.contains('vertical'),true);
assert.equal(reopened.nodes.get('direction').textContent,'横排');
assert.equal(reopened.html.classList.contains('show-translation'),true);assert.equal(reopened.styles['--lyric-size'],'40px');
reopened.nodes.get('larger').onclick();assert.equal(reopened.styles['--lyric-size'],'44px','resize starts from restored size');
const early=settingsPage(stored);early.palettes[1].onclick();early.restore();
assert.equal(early.html.dataset.palette,'yellow','late read preserves user changes');assert.equal(early.styles['--lyric-size'],'40px','unedited values still restore');
early.init();assert.equal(early.messages.filter(m=>m.command==='storage:get').length,1);
const invalid=settingsPage({palette:'unknown',size:999,vertical:'true',translation:[]});invalid.restore();
assert.equal(invalid.html.dataset.palette,'red');assert.equal(invalid.styles['--lyric-size'],'36px');assert.equal(invalid.html.classList.contains('show-translation'),false);
console.log('PASS: settings survive iframe reopen; all four controls restore; rapid edits serialize; late reads preserve edits; invalid data uses defaults');
