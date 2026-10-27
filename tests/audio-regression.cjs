const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.FLORA_TEST_URL||'http://127.0.0.1:4317';

(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.FLORA_BROWSER_CHANNEL||'msedge'});
 const results={};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:960},hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Exercise the missing API that left oscillators running in the previous version.
  await page.addInitScript(()=>Object.defineProperty(AudioParam.prototype,'cancelAndHoldAtTime',{value:undefined,configurable:true}));
  await page.goto(base);
  await page.evaluate(()=>{setParam('attack',0);setParam('release',0);setParam('space',0);});
  const silent=async(label)=>{
   await page.waitForFunction(()=>voices.size===0&&liveVoices.size===0,{},{timeout:2500});
   await page.waitForTimeout(160);
   const rms=await page.evaluate(()=>{const b=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(b);return Math.sqrt(b.reduce((s,v)=>s+v*v,0)/b.length);});
   assert(rms<.00001,`${label}: actual output still sounding, RMS ${rms}`);results[label]=rms;
  };
  await page.keyboard.down('a');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>voices.size),1);await page.keyboard.up('a');await silent('keyboard release');
  const note=page.locator('[data-note="0"]');
  const point=await note.evaluate(n=>{const p=n.ownerSVGElement.createSVGPoint();p.x=0;p.y=-108;const q=p.matrixTransform(n.parentNode.getScreenCTM());return{x:q.x,y:q.y};});
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.waitForTimeout(70);await page.mouse.move(2,2);await page.mouse.up();await silent('pointer release outside flower');
  await page.touchscreen.tap(point.x,point.y);await silent('touch release');
  await note.dispatchEvent('pointerdown',{button:0,pointerId:71});await page.waitForTimeout(50);await note.dispatchEvent('lostpointercapture',{pointerId:71});await silent('lost pointer capture');
  await note.dispatchEvent('pointerdown',{button:0,pointerId:72});await page.waitForTimeout(50);await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:72})));await silent('window pointer release fallback');
  await note.focus();await page.keyboard.down('Space');await page.waitForTimeout(60);await page.keyboard.up('Space');await silent('focused note release');
  await page.keyboard.down('s');await page.waitForTimeout(60);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('s');await silent('window loses focus');
  await page.getByRole('button',{name:'Hold the bloom',exact:false}).click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>voices.size),3);
  await page.getByRole('button',{name:'Hold the bloom',exact:false}).click();await silent('held chord switched off');
  await page.getByRole('button',{name:'Hold the bloom',exact:false}).click();await page.waitForTimeout(80);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await silent('leaving page');
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.waitForTimeout(60);await page.mouse.up();await silent('center and notes recover after page exit cleanup');

  // Record the actual output during rapid preset/waveform changes and extreme controls.
  await page.evaluate(()=>{
   window.captureStats={peak:0,nonFinite:0,samples:0};window.testRecorder=audio.createScriptProcessor(1024,1,1);
   testRecorder.onaudioprocess=e=>{for(const x of e.inputBuffer.getChannelData(0)){captureStats.peak=Math.max(captureStats.peak,Math.abs(x));if(!Number.isFinite(x))captureStats.nonFinite++;captureStats.samples++;}};
   analyser.connect(testRecorder);testRecorder.connect(audio.destination);
  });
  for(const k of ['a','s','d','f','g','h','j','k'])await page.keyboard.down(k);
  await page.waitForTimeout(120);
  for(let i=0;i<24;i++){
   await page.evaluate(i=>{$('preset').value=['night','glass','moss','first'][i%4];applyPalette();chooseWave(['square','triangle','sawtooth','sine'][i%4]);setParam('cutoff',i%2?100:0);setParam('resonance',100);setParam('detune',100);$('volume').value=100;updateAudio();},i);
   await page.waitForTimeout(25);
  }
  await page.waitForTimeout(150);
  results.stress=await page.evaluate(()=>captureStats);assert(results.stress.samples>20000);assert(results.stress.peak>.001);assert(results.stress.peak<.95,`output clipped: ${results.stress.peak}`);assert.equal(results.stress.nonFinite,0);
  await page.evaluate(()=>{testRecorder.disconnect();analyser.disconnect(testRecorder);testRecorder.onaudioprocess=null;setParam('release',0);setParam('space',0);});
  for(const k of ['a','s','d','f','g','h','j','k'])await page.keyboard.up(k);
  await page.waitForFunction(()=>voices.size===0&&liveVoices.size===0,{},{timeout:2500});
  await page.waitForTimeout(2850);await silent('all oscillators cleaned up after stress');
  await page.getByRole('button',{name:'Sound enabled',exact:false}).click();await page.waitForFunction(()=>audio===null);
  await page.keyboard.down('a');await page.waitForTimeout(80);await page.keyboard.up('a');await silent('audio restarts cleanly');
  assert.equal(errors.length,0,errors.join('\n'));
  await page.close();

  // Render production envelope/crossfade functions to PCM to detect amplitude jumps.
  const offline=await browser.newPage();await offline.goto(base);
  results.offline=await offline.evaluate(async()=>{
   Object.defineProperty(AudioParam.prototype,'cancelAndHoldAtTime',{value:undefined,configurable:true});
   async function render(mode){
    audio=new OfflineAudioContext(1,48000,48000);filter=audio.createGain();filter.connect(audio.destination);
    values={...values,tune:50,detune:0,attack:mode==='release'?100:0,release:0};waveform='sine';
    const v=makeVoice(0,57);voices.set('offline',v);
    const suspension=audio.suspend(mode==='release'?.08:.217);const rendering=audio.startRendering();await suspension;const boundary=audio.currentTime;
    if(mode==='release')releaseVoice('offline');else if(mode==='abrupt')v.oscs.forEach(o=>o.type='triangle');else crossfadeWave(v,'triangle',boundary);
    await audio.resume();const b=(await rendering).getChannelData(0),at=Math.round(boundary*48000);let jump=0,tail=0,peakBefore=0;
    for(let i=at-3;i<at+128;i++)jump=Math.max(jump,Math.abs(b[i]-b[i-1]));
    for(let i=at-1000;i<at;i++)peakBefore=Math.max(peakBefore,Math.abs(b[i]));
    for(let i=24000;i<b.length;i++)tail=Math.max(tail,Math.abs(b[i]));
    voices.clear();liveVoices.clear();return{jump,tail,peakBefore};
   }
   return{release:await render('release'),abrupt:await render('abrupt'),crossfade:await render('crossfade')};
  });
  assert(results.offline.release.peakBefore>.0001);assert(results.offline.release.tail<.000001);assert(results.offline.release.jump<.002);
  assert(results.offline.crossfade.jump<results.offline.abrupt.jump*.7,JSON.stringify(results.offline));
  console.log(JSON.stringify({status:'passed',results},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
