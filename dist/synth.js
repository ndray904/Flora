'use strict';
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const params=[
 {id:'tune',name:'Tune',description:'Move the whole flower up or down by an octave. Each step is one semitone.',format:v=>`${Math.round((v-50)*.24)>0?'+':''}${Math.round((v-50)*.24)} st`},
 {id:'detune',name:'Detune',description:'Let two oscillators drift gently apart for a wider, warmer voice.',format:v=>`${Math.round(v*.4)} ct`},
 {id:'cutoff',name:'Cutoff',description:'Open the flower to let more brightness into your sound.',format:v=>{const hz=100*Math.pow(100,v/100);return hz>=1000?`${(hz/1000).toFixed(1)} kHz`:`${Math.round(hz)} Hz`;}},
 {id:'resonance',name:'Resonance',description:'Emphasize the edge of the filter, from soft color to a ringing glow.',format:v=>`${(v*.14).toFixed(1)} Q`},
 {id:'attack',name:'Attack',description:'Choose how slowly a new note opens, from a soft touch to a gradual bloom.',format:v=>`${(.015+Math.pow(v/100,2)*3).toFixed(2)} s`},
 {id:'release',name:'Release',description:'Let a note linger after you lift your finger. Longer tails drift into the air.',format:v=>`${(.15+Math.pow(v/100,2)*6).toFixed(2)} s`},
 {id:'motion',name:'Motion',description:'Breathe life into the tone with a gentle, repeating movement of the filter.',format:v=>`${(v*.08).toFixed(2)} Hz`},
 {id:'space',name:'Space',description:'Set the balance of reverberation. Give the bloom a room of its own.',format:v=>`${Math.round(v*.65)} %`}
];
const palettes={
 first:{values:[50,18,69,12,24,48,16,36],wave:'sine',description:'A soft, open tone.<br>A little room to grow.'},
 moss:{values:[38,29,39,23,43,65,9,30],wave:'triangle',description:'Low, earthy, and unhurried.<br>A voice from the forest floor.'},
 glass:{values:[50,11,87,34,7,56,30,65],wave:'triangle',description:'Clear edges, long reflections.<br>Light through a glass roof.'},
 night:{values:[50,40,49,22,49,76,11,72],wave:'sawtooth',description:'A warm, dusky atmosphere.<br>Made for the quiet hours.'}
};
let values=Object.fromEntries(params.map((p,i)=>[p.id,palettes.first.values[i]]));
let selected='cutoff',waveform='sine',octave=3,root=0,latched=false;
let audio,filter,master,dry,wet,analyser,lfo,lfoDepth,compressor,audioClosing;
const voices=new Map(),liveVoices=new Set(),heldKeys=new Set(),pointerReleases=new Map();
const WAVE_FADE=.055;
const sliderEls=new Map(),noteEls=[],noteKeys=['a','s','d','f','g','h','j','k'];
const scale=[0,2,4,7,9,12,14,16],noteNames=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const svg=$('flower');
function el(tag,attrs={},parent=svg){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.appendChild(n);return n;}
function textAt(parent,text,x,y,attrs={}){const t=el('text',{x,y,'text-anchor':'middle',...attrs},parent);t.textContent=text;return t;}
function makeFlower(){
 svg.innerHTML='<defs><radialGradient id="petal-fill" cx="50%" cy="70%" r="90%"><stop offset="0" stop-color="#dee2cc"/><stop offset=".75" stop-color="#f4f2e9"/><stop offset="1" stop-color="#f8f6ed"/></radialGradient><radialGradient id="selected-fill" cx="50%" cy="70%" r="90%"><stop offset="0" stop-color="#e3dfc8"/><stop offset="1" stop-color="#faf6e8"/></radialGradient><filter id="handle-shadow" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#51472c" flood-opacity=".18"/></filter></defs>';
 const center=el('g',{transform:'translate(450 450)'});
 [358,365,374].forEach((r,i)=>el('circle',{r,class:i===1?'ring-fine':'ring-line'},center));
 for(let i=0;i<80;i++){const a=i*Math.PI/40;const r=i%5===0?364:369;el('line',{x1:Math.sin(a)*r,y1:-Math.cos(a)*r,x2:Math.sin(a)*373,y2:-Math.cos(a)*373,class:'ring-fine'},center);}
 for(let j=0;j<8;j++){
  const ornament=el('g',{transform:`rotate(${j*45+22.5})`,class:'ornament'},center);
  for(let k=0;k<12;k++){const r=156+k*15;el('path',{d:`M ${-r*.23} ${-r} Q 0 ${-r+52} ${r*.23} ${-r}`},ornament);}
  el('path',{d:'M0-190 Q-8-245 0-310 Q8-245 0-190Z'},ornament);
  el('circle',{cy:-332,r:5,fill:'#f2efe5',stroke:'#7f896e','stroke-width':1},ornament);
  el('path',{d:'M0-338V-354 M-7-346H7'},ornament);
 }
 params.forEach((p,i)=>{
  const angle=i*45;
  const g=el('g',{transform:`rotate(${angle})`,class:`petal-group${p.id===selected?' selected':''}`,tabindex:0,role:'slider','aria-label':p.name,'aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':values[p.id],'aria-valuetext':p.format(values[p.id]),'aria-orientation':'vertical','data-param':p.id},center);
  el('path',{d:'M0-91 C-103-136-115-242 0-352 C115-242 103-136 0-91Z',class:'outer-petal'},g);
  for(let v=0;v<5;v++){const r=128+v*15;el('path',{d:`M0 ${-r} Q${-68+v*2} ${-r-18} ${-73+v*3} ${-205-v*10} M0 ${-r} Q${68-v*2} ${-r-18} ${73-v*3} ${-205-v*10}`,class:'vein'},g);}
  el('path',{d:'M0-158V-324',class:'vein'},g);
  for(let t=0;t<=10;t++){const y=-181-t*10;el('line',{x1:t%5===0?-10:-7,y1:y,x2:-4,y2:y,class:'slider-tick'},g);el('line',{x1:4,y1:y,x2:t%5===0?10:7,y2:y,class:'slider-tick'},g);}
  el('line',{x1:0,y1:-181,x2:0,y2:-281,class:'slider-track'},g);
  const progress=el('line',{x1:0,y1:-181,x2:0,y2:-181-values[p.id],class:'slider-progress'},g);
  const handle=el('g',{transform:`translate(0 ${-181-values[p.id]})`},g);
  el('circle',{r:10,class:'slider-handle'},handle);el('circle',{r:2.4,class:'slider-handle-core'},handle);
  el('rect',{x:-28,y:-304,width:56,height:145,class:'slider-target','aria-hidden':true},g);
  const a=angle*Math.PI/180,x=Math.sin(a)*405,y=-Math.cos(a)*405;
  const label=textAt(center,p.name.toUpperCase(),x,y,{class:`petal-label${p.id===selected?' selected':''}`});
  const reading=textAt(center,p.format(values[p.id]),x,y+18,{class:'petal-reading'});
  sliderEls.set(p.id,{g,progress,handle,label,reading});
  let dragging=false;
  function move(e){const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const local=pt.matrixTransform(g.getScreenCTM().inverse());setParam(p.id,Math.max(0,Math.min(100,-local.y-181)));}
  g.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();selectParam(p.id);g.focus({preventScroll:true});dragging=true;g.setPointerCapture(e.pointerId);move(e);});
  g.addEventListener('pointermove',e=>{if(dragging)move(e);});
  g.addEventListener('pointerup',()=>dragging=false);g.addEventListener('pointercancel',()=>dragging=false);g.addEventListener('lostpointercapture',()=>dragging=false);
  g.addEventListener('focus',()=>selectParam(p.id));
  g.addEventListener('keydown',e=>{let v=values[p.id];if(e.key==='ArrowUp'||e.key==='ArrowRight')v+=e.shiftKey?10:1;else if(e.key==='ArrowDown'||e.key==='ArrowLeft')v-=e.shiftKey?10:1;else if(e.key==='Home')v=0;else if(e.key==='End')v=100;else if(e.key==='PageUp')v+=10;else if(e.key==='PageDown')v-=10;else return;e.preventDefault();setParam(p.id,v);});
 });
 for(let i=0;i<8;i++){
  const g=el('g',{transform:`rotate(${i*45})`},center);
  const note=el('path',{d:'M0-42 C-38-67-35-109 0-158 C35-109 38-67 0-42Z',class:'note-petal',tabindex:0,role:'button','aria-label':`Play note ${i+1}, keyboard ${noteKeys[i].toUpperCase()}`,'data-note':i},g);
  el('path',{d:'M0-53V-142 M0-70Q-19-85-19-109 M0-70Q19-85 19-109',class:'note-vein'},g);
  const label=textAt(g,'',0,-120,{class:'note-label',transform:`rotate(${-i*45} 0 -120)`});
  noteEls.push({note,label});
  note.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();const key=`pointer-${e.pointerId}`;pointerReleases.set(e.pointerId,()=>releaseVoice(key));playNote(i,key);try{note.setPointerCapture(e.pointerId);}catch{/* The window release handler also covers browsers without SVG capture. */}});
  note.addEventListener('lostpointercapture',releasePointer);
  note.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();playNote(i,`focus-${i}`);}});
  note.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();releaseVoice(`focus-${i}`);}});
  note.addEventListener('blur',()=>releaseVoice(`focus-${i}`));
 }
 const heart=el('g',{class:'heart',tabindex:0,role:'button','aria-label':'Play center chord, C, E, and G'},center);
 el('circle',{r:45,class:'heart-fill'},heart);el('circle',{r:36,class:'heart-ring'},heart);el('circle',{r:25,class:'heart-ring'},heart);
 for(let i=0;i<24;i++){const a=i*Math.PI/12;el('circle',{cx:Math.sin(a)*39,cy:Math.cos(a)*39,r:1.3,class:'heart-dots'},heart);}
 for(let i=0;i<12;i++){const a=i*Math.PI/6;el('circle',{cx:Math.sin(a)*29,cy:Math.cos(a)*29,r:1.1,class:'heart-dots'},heart);}
 el('path',{d:'M-4-8L9 0-4 8Z',class:'heart-symbol'},heart);
 const heartHolds=new Set();
 function startHeart(){if(latched){if(voices.has('chord-0'))releaseChord();else playChord();}else playChord();}
 heart.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();heartHolds.add(e.pointerId);pointerReleases.set(e.pointerId,()=>{heartHolds.delete(e.pointerId);if(!latched&&!heartHolds.size)releaseChord();});startHeart();try{heart.setPointerCapture(e.pointerId);}catch{/* Window-level release remains available. */}});
 heart.addEventListener('lostpointercapture',releasePointer);
 heart.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();startHeart();}});
 heart.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!latched)releaseChord();}});
 heart.addEventListener('blur',()=>{if(!latched)releaseChord();});
 updateNoteLabels();updateSelected();
}
function setParam(id,v,updateSound=true){values[id]=Math.max(0,Math.min(100,Math.round(v)));const p=params.find(p=>p.id===id),s=sliderEls.get(id);s.g.setAttribute('aria-valuenow',values[id]);s.g.setAttribute('aria-valuetext',p.format(values[id]));s.progress.setAttribute('y2',-181-values[id]);s.handle.setAttribute('transform',`translate(0 ${-181-values[id]})`);s.reading.textContent=p.format(values[id]);if(selected===id)updateSelected();if(updateSound)updateAudio();}
function selectParam(id){selected=id;for(const[key,s]of sliderEls){s.g.classList.toggle('selected',key===id);s.label.classList.toggle('selected',key===id);}updateSelected();}
function updateSelected(){const p=params.find(p=>p.id===selected),parts=p.format(values[selected]).split(' ');$('selected-name').textContent=p.name;$('selected-value').replaceChildren(document.createTextNode(parts[0]+' '));const span=document.createElement('span');span.textContent=parts[1]||'';$('selected-value').append(span);$('value-fill').style.width=values[selected]+'%';$('selected-description').textContent=p.description;}
function updateNoteLabels(){noteEls.forEach(({note,label},i)=>{const midi=12*(octave+1)+root+scale[i];label.textContent=noteNames[midi%12];note.setAttribute('aria-label',`Play ${noteNames[midi%12]}${Math.floor(midi/12)-1}, keyboard ${noteKeys[i].toUpperCase()}`);});document.querySelector('.heart')?.setAttribute('aria-label',`Play ${noteNames[root]} major chord`);}
async function ensureAudio(){
 if(audioClosing)await audioClosing;
 if(!audio){
  const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)throw new Error('Web Audio is unavailable in this browser.');audio=new AudioCtx();
  filter=audio.createBiquadFilter();filter.type='lowpass';dry=audio.createGain();wet=audio.createGain();master=audio.createGain();analyser=audio.createAnalyser();analyser.fftSize=1024;
  filter.frequency.value=Math.min(audio.sampleRate*.45,100*Math.pow(100,values.cutoff/100));filter.Q.value=.4+values.resonance*.14;
  dry.gain.value=1-values.space*.004;wet.gain.value=values.space*.0065;master.gain.value=Number($('volume').value)/100*.4;
  compressor=audio.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=18;compressor.ratio.value=10;compressor.attack.value=.003;compressor.release.value=.2;
  const ceiling=audio.createWaveShaper(),curve=new Float32Array(8193);
  for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<=.6?a:.6+.3*(1-Math.exp(-(a-.6)/.3)));}
  ceiling.curve=curve;ceiling.oversample='2x';
  const reverb=audio.createConvolver(),length=Math.floor(audio.sampleRate*2.8),impulse=audio.createBuffer(2,length,audio.sampleRate);
  for(let ch=0;ch<2;ch++){const d=impulse.getChannelData(ch);for(let i=0;i<length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/length,3);}
  reverb.buffer=impulse;filter.connect(dry);dry.connect(master);filter.connect(reverb);reverb.connect(wet);wet.connect(master);master.connect(compressor);compressor.connect(ceiling);ceiling.connect(analyser);analyser.connect(audio.destination);
  lfo=audio.createOscillator();lfoDepth=audio.createGain();lfo.frequency.value=Math.max(.01,values.motion*.08);lfoDepth.gain.value=values.motion*4;lfo.connect(lfoDepth);lfoDepth.connect(filter.detune);lfo.start();updateAudio();
 }
 if(audio.state==='suspended')await audio.resume();
 $('audio-toggle').classList.add('enabled');$('audio-label').textContent='Sound enabled';return audio;
}
function updateAudio(glide=.045){
 if(!audio||audio.state==='closed')return;
 const t=audio.currentTime;
 filter.frequency.setTargetAtTime(Math.min(audio.sampleRate*.45,100*Math.pow(100,values.cutoff/100)),t,glide);
 filter.Q.setTargetAtTime(.4+values.resonance*.14,t,glide);
 dry.gain.setTargetAtTime(1-values.space*.004,t,glide);wet.gain.setTargetAtTime(values.space*.0065,t,glide);
 master.gain.setTargetAtTime(Number($('volume').value)/100*.4,t,.03);
 lfo.frequency.setTargetAtTime(Math.max(.01,values.motion*.08),t,.1);lfoDepth.gain.setTargetAtTime(values.motion*4,t,.1);
 for(const v of voices.values()){
  if(v.pending)continue;
  if(v.bank.type!==waveform)crossfadeWave(v,waveform,t);
  for(const bank of v.banks)bank.oscs.forEach((osc,i)=>{osc.frequency.setTargetAtTime(noteFrequency(v.midi),t,glide);osc.detune.setTargetAtTime((i===0?-1:1)*values.detune*.2,t,glide);});
 }
}
function noteFrequency(midi){return 440*Math.pow(2,(midi+Math.round((values.tune-50)*.24)-69)/12);}
function bankLevel(bank,t){const f=bank.fade;if(!f)return 1;const x=Math.max(0,Math.min(1,(t-f.start)/(f.end-f.start)));return f.from+(f.to-f.from)*x;}
function fadeBank(bank,to,t,duration){
 const from=bankLevel(bank,t),previous=bank.fade;
 bank.gain.gain.cancelScheduledValues(t);
 // Recreate a truncated ramp before starting the next ramp, including during a rapid switch.
 if(previous&&t<previous.end)bank.gain.gain.linearRampToValueAtTime(from,t);else bank.gain.gain.setValueAtTime(from,t);
 bank.gain.gain.linearRampToValueAtTime(to,t+duration);
 bank.fade={from,to,start:t,end:t+duration};
}
function stopBank(bank,t){if(bank.stopAt!==undefined&&bank.stopAt<=t)return;bank.stopAt=t;bank.oscs.forEach(osc=>{try{osc.stop(t);}catch{/* A previously stopped oscillator is already silent. */}});}
function makeBank(v,type,t,initial=1){
 const gain=audio.createGain(),oscs=[audio.createOscillator(),audio.createOscillator()];
 const bank={type,gain,oscs,fade:{from:initial,to:initial,start:t,end:t+.001}};
 gain.gain.setValueAtTime(initial,t);gain.connect(v.gain);v.banks.add(bank);
 let ended=0;
 oscs.forEach((osc,i)=>{osc.type=type;osc.frequency.value=noteFrequency(v.midi);osc.detune.value=(i===0?-1:1)*values.detune*.2;osc.connect(gain);osc.onended=()=>{osc.disconnect();if(++ended===oscs.length){gain.disconnect();v.banks.delete(bank);if(!v.banks.size){v.gain.disconnect();liveVoices.delete(v);}}};osc.start(t);});
 return bank;
}
function crossfadeWave(v,type,t){
 for(const bank of v.banks){const end=Math.min(bank.stopAt??Infinity,t+WAVE_FADE+.01);fadeBank(bank,0,t,Math.max(.001,end-t-.005));stopBank(bank,end);}
 v.bank=makeBank(v,type,t,0);v.oscs=v.bank.oscs;fadeBank(v.bank,1,t,WAVE_FADE);
}
function makeVoice(index,midi,t=audio.currentTime){
 const gain=audio.createGain(),attack=.015+Math.pow(values.attack/100,2)*3;
 const v={midi,index,gain,banks:new Set(),started:t,attackEnd:t+attack,peak:.12};
 gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(v.peak,v.attackEnd);gain.connect(filter);
 v.bank=makeBank(v,waveform,t);v.oscs=v.bank.oscs;liveVoices.add(v);return v;
}
let audioRequest=0;
async function playNote(index,key,midiOverride){
 if(voices.has(key))return;
 const request=++audioRequest;
 const pending={pending:true,index,request};voices.set(key,pending);
 try{
  const context=await ensureAudio();if(voices.get(key)!==pending)return;
  if(context!==audio||context.state!=='running'){voices.delete(key);refreshPlaying();return;}
  const midi=midiOverride??12*(octave+1)+root+scale[index];voices.set(key,makeVoice(index,midi));refreshPlaying();
 }
 catch(e){if(voices.get(key)===pending)voices.delete(key);$('announcement').textContent=e.message;$('audio-label').textContent='Sound unavailable';refreshPlaying();}
}
function releaseVoice(key,releaseOverride){
 const v=voices.get(key);if(!v)return;
 voices.delete(key);
 if(v.gain&&audio&&audio.state!=='closed'){
  const t=audio.currentTime,release=releaseOverride??(.15+Math.pow(values.release/100,2)*6);
  const level=v.peak*Math.max(0,Math.min(1,(t-v.started)/(v.attackEnd-v.started)));
  try{
   v.gain.gain.cancelScheduledValues(t);
   if(t<v.attackEnd)v.gain.gain.linearRampToValueAtTime(level,t);else v.gain.gain.setValueAtTime(level,t);
   v.gain.gain.linearRampToValueAtTime(0,t+release);
  }finally{
   // Oscillators always have a finite stop time, independently of UI bookkeeping.
   for(const bank of v.banks)stopBank(bank,t+release+.02);
  }
 }
 refreshPlaying();
}
function playChord(){[0,4,7].forEach((n,i)=>playNote([0,2,3][i],`chord-${i}`,12*(octave+1)+root+n));}
function releaseChord(){[0,1,2].forEach(i=>releaseVoice(`chord-${i}`));}
function releasePointer(e){const release=pointerReleases.get(e.pointerId);if(release){pointerReleases.delete(e.pointerId);release();}}
function releaseAll(releaseOverride){for(const key of [...voices.keys()])releaseVoice(key,releaseOverride);heldKeys.clear();const releases=[...pointerReleases.values()];pointerReleases.clear();for(const release of releases)release();}
async function disableAudio(){
 const context=audio;if(!context)return;
 releaseAll(.025);latched=false;$('latch').setAttribute('aria-pressed','false');
 master.gain.setTargetAtTime(0,context.currentTime,.005);
 audioClosing=(async()=>{await new Promise(resolve=>setTimeout(resolve,50));await context.close();if(audio===context){audio=null;analyser=null;}liveVoices.clear();})();
 try{await audioClosing;}finally{audioClosing=null;}
 $('audio-toggle').classList.remove('enabled');$('audio-label').textContent='Enable sound';
}
function refreshPlaying(){noteEls.forEach(({note},i)=>{const on=[...voices.values()].some(v=>v.index===i&&!v.pending);note.classList.toggle('playing',on);document.querySelectorAll('kbd')[i].classList.toggle('pressed',on);});const chord=[...voices.keys()].some(k=>k.startsWith('chord-'));document.querySelector('.heart')?.classList.toggle('playing',chord);$('play-status').textContent=voices.size?'YOUR SOUND IS IN BLOOM':'TOUCH THE HEART TO PLAY';$('scope-status').textContent=voices.size?'IN BLOOM':'AT REST';}
function chooseWave(wave,updateSound=true){waveform=wave;document.querySelectorAll('.wave').forEach(b=>{const active=b.dataset.wave===wave;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});$('wave-name').textContent=wave==='sawtooth'?'Sawtooth':wave[0].toUpperCase()+wave.slice(1);document.querySelector('.wave-caption span:last-child').textContent={sine:'PURE TONE',triangle:'SOFT HARMONICS',sawtooth:'RICH HARMONICS',square:'HOLLOW TONE'}[wave];if(updateSound)updateAudio();}
function applyPalette(){const palette=palettes[$('preset').value];params.forEach((p,i)=>setParam(p.id,palette.values[i],false));chooseWave(palette.wave,false);updateAudio(.09);$('preset-description').innerHTML=palette.description;$('announcement').textContent=`${$('preset').selectedOptions[0].text} palette loaded`;}
document.querySelectorAll('.wave').forEach(b=>b.addEventListener('click',()=>chooseWave(b.dataset.wave)));
$('preset').addEventListener('change',applyPalette);$('reset').addEventListener('click',applyPalette);
$('root').addEventListener('change',()=>{releaseAll();root=Number($('root').value);updateNoteLabels();if(latched)playChord();});
function shiftOctave(d){const next=Math.max(1,Math.min(6,octave+d));if(next===octave)return;releaseAll();octave=next;$('octave').textContent=octave;updateNoteLabels();if(latched)playChord();}
$('oct-down').addEventListener('click',()=>shiftOctave(-1));$('oct-up').addEventListener('click',()=>shiftOctave(1));
$('volume').addEventListener('input',()=>{$('volume-value').textContent=$('volume').value+'%';updateAudio();});
$('latch').addEventListener('click',()=>{latched=!latched;$('latch').setAttribute('aria-pressed',latched);if(latched)playChord();else releaseChord();});
$('audio-toggle').addEventListener('click',async()=>{const button=$('audio-toggle');button.disabled=true;try{if(audio?.state==='running')await disableAudio();else await ensureAudio();}catch(e){$('announcement').textContent=e.message;$('audio-label').textContent='Sound unavailable';}finally{button.disabled=false;}});
window.addEventListener('pointerup',releasePointer,true);window.addEventListener('pointercancel',releasePointer,true);
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.target.matches('input,select,textarea')||$('help').open)return;const index=noteKeys.indexOf(e.key.toLowerCase());if(index<0)return;e.preventDefault();heldKeys.add(e.key.toLowerCase());playNote(index,`key-${index}`);});
document.addEventListener('keyup',e=>{const index=noteKeys.indexOf(e.key.toLowerCase());if(index<0)return;heldKeys.delete(e.key.toLowerCase());releaseVoice(`key-${index}`);});
window.addEventListener('blur',()=>{for(const key of [...voices.keys()])if(!key.startsWith('chord-')||!latched)releaseVoice(key);heldKeys.clear();for(const release of pointerReleases.values())release();pointerReleases.clear();});
function leavePage(){releaseAll(.03);latched=false;$('latch').setAttribute('aria-pressed','false');}
document.addEventListener('visibilitychange',()=>{if(document.hidden)leavePage();});window.addEventListener('pagehide',leavePage);
$('help-button').addEventListener('click',()=>{$('help').showModal();$('help-button').setAttribute('aria-expanded','true');});$('close-help').addEventListener('click',()=>$('help').close());$('help').addEventListener('close',()=>$('help-button').setAttribute('aria-expanded','false'));
makeFlower();
const canvas=$('scope'),ctx=canvas.getContext('2d'),buffer=new Uint8Array(1024);let lastFrame=0;
function drawScope(now){requestAnimationFrame(drawScope);if(now-lastFrame<40)return;lastFrame=now;ctx.clearRect(0,0,400,150);ctx.strokeStyle='#c6cbbb';ctx.lineWidth=1;ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(0,75);ctx.lineTo(400,75);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#78836a';ctx.lineWidth=1.8;ctx.beginPath();if(analyser&&audio.state==='running'){analyser.getByteTimeDomainData(buffer);for(let i=0;i<buffer.length;i++){const x=i/(buffer.length-1)*400,y=75+(buffer[i]-128)/128*66;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}}else{ctx.moveTo(0,75);ctx.lineTo(400,75);}ctx.stroke();}
requestAnimationFrame(drawScope);
