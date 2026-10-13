// Browser regression for the actual hover/click explorer and all 2,160 mappings.
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(site,'.preview');
await mkdir(out,{recursive:true});
const data=JSON.parse(await readFile(path.join(site,'data/velocity_explorer.json'),'utf8'));
const results={groups:data.groups.length,cells:data.groups.reduce((n,g)=>n+g.cells.length,0)};
const smoke=process.argv.includes('--smoke');
const base=process.env.WEBSITE_URL || 'http://localhost:8080/compositional-motion-styles/';
if(process.env.LOCAL_RELEASES!=='0'){
  try{
    await stat(path.join(site,'.release-assets/style_00_720p.mp4'));
    for(const group of data.groups)for(const cell of group.cells){
      cell.video=new URL('_release/'+cell.video.split('/').pop(),base).pathname;
    }
  }catch(error){if(error.code!=='ENOENT')throw error;}
}
if(!smoke){
  const paths=[...new Set(data.groups.flatMap(g=>[g.reference_video,...g.cells.map(c=>c.video)]))].filter(p=>!/^https?:/.test(p)&&!p.startsWith('/'));
  const files=await Promise.all(paths.map(async p=>({path:p,size:(await stat(path.join(site,p))).size})));
  if(files.some(f=>f.size<1000))throw Error('Empty media file');
  results.assets={count:files.length,bytes:files.reduce((n,f)=>n+f.size,0)};
}
const profile=await mkdtemp(path.join(tmpdir(),'codes-velocity-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-proxy-server','--disable-dev-shm-usage','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let log='';const endpoint=await new Promise((resolve,reject)=>{chrome.stderr.on('data',b=>{log+=b;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m)resolve(m[1]);});chrome.on('exit',c=>reject(Error('Chrome exited '+c)));});
const ws=new WebSocket(endpoint);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let next=1;const pending=new Map(),errors=[];
ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id&&pending.has(m.id)){const[r,j]=pending.get(m.id);pending.delete(m.id);m.error?j(m.error):r(m.result);}});
const send=(method,params={},sessionId)=>new Promise((r,j)=>{const id=next++;pending.set(id,[r,j]);ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
try{
  const{targetId}=await send('Target.createTarget',{url:'about:blank'});
  const{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const cmd=(method,params)=>send(method,params,sessionId);
  const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(expression,timeout=15000)=>{const start=Date.now();while(Date.now()-start<timeout){const v=await evaluate(expression);if(v)return v;await wait(100);}console.error(await evaluate(`({url:location.href,ready:document.readyState,title:document.title,data:!!window.VELOCITY_EXPLORER,grid:!!document.getElementById('velocity-grid'),status:document.getElementById('velocity-status')?.textContent,selected:document.getElementById('velocity-selected')?.textContent,videos:[...document.querySelectorAll('.velocity-videos video')].map(v=>({src:v.getAttribute('src'),ready:v.readyState,paused:v.paused,error:v.error?.message}))})`),errors);throw Error('Timed out: '+expression);};
  await cmd('Page.enable');await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:base});
  await until(`document.querySelectorAll('#velocity-grid button').length===135`);
  results.publication=await evaluate(`({authors:document.querySelector('.authors').textContent,affiliation:document.querySelector('.affiliation').textContent,submissionBranding:/Anonymous|ICRA.*[Ss]ubmission/.test(document.body.innerText)})`);
  if(!results.publication.authors.includes('Heedo Woo')||!results.publication.authors.includes('Amanda Prorok')||results.publication.submissionBranding)throw Error('Public author information is incorrect');
  const headerShot=await cmd('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,'homepage.png'),Buffer.from(headerShot.data,'base64'));
  results.mappings=await evaluate(`(()=>{const d=window.VELOCITY_EXPLORER;return d.groups.map(g=>({id:g.id,cells:g.cells.length,unique:new Set(g.cells.map(c=>c.x+','+c.y)).size,reference:g.reference_video,videoCount:new Set(g.cells.map(c=>c.video+'|'+(c.video_start_s??0))).size,matched:g.cells.filter(c=>c.velocity_reference).length}));})()`);
  if(results.mappings.some(g=>g.cells!==135||g.unique!==135||g.videoCount!==135||g.matched!==(g.id===5?0:135)))throw Error('Grid mapping gap');
  const chooseGroup=async id=>evaluate(`document.querySelector('#velocity-styles [data-style="${id}"]').click()`);
  const hover=async id=>{
    const xy=await evaluate(`(()=>{const e=document.querySelector('#velocity-grid [data-cell="${id}"]');e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});
    await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',...xy});
  };
  const checkPlaying=async(group,id,mode='conditioning')=>{
    const cell=data.groups[group].cells.find(c=>c.id===id),expected=cell.video;
    const reference=mode==='matched'&&cell.velocity_reference?cell.velocity_reference.video:data.groups[group].reference_video;
    return until(`(()=>{const r=document.getElementById('velocity-rollout'),v=document.getElementById('velocity-reference');return r.getAttribute('src')===${JSON.stringify(expected)}&&v.getAttribute('src')===${JSON.stringify(reference)}&&r.videoWidth===1280&&v.videoWidth===1280&&!r.paused&&!v.paused&&!r.seeking&&r.currentTime>${(cell.video_start_s??0)+.05}&&r.currentTime<${cell.video_end_s??10}&&{rollout:r.getAttribute('src'),reference:v.getAttribute('src'),heading:document.getElementById('velocity-reference-heading').textContent,time:r.currentTime,duration:r.duration,width:r.videoWidth,height:r.videoHeight,status:document.getElementById('velocity-trial-status').textContent};})()`);
  };
  await chooseGroup(0);await hover(40);results.defaultCell=await checkPlaying(0,40);
  results.hover=[];
  for(const group of smoke?[0,5]:Array.from({length:16},(_,i)=>i)){
    await chooseGroup(group);await hover(0);results.hover.push(await checkPlaying(group,0));
    if(!smoke){for(const id of [67,134]){await hover(id);results.hover.push(await checkPlaying(group,id));}}
  }
  await chooseGroup(0);await hover(40);await checkPlaying(0,40);
  await evaluate(`document.getElementById('velocity-matched-toggle').checked=false;document.getElementById('velocity-matched-toggle').dispatchEvent(new Event('change'))`);
  results.conditioningReference=await checkPlaying(0,40,'conditioning');
  await evaluate(`document.getElementById('velocity-matched-toggle').checked=true;document.getElementById('velocity-matched-toggle').dispatchEvent(new Event('change'))`);
  results.velocityMatchedReference=await checkPlaying(0,40,'matched');
  await evaluate(`document.getElementById('velocity-matched-toggle').click()`);
  if(!smoke){
    // The last grid cell used to require seeking over 20 minutes into a bank.
    await chooseGroup(15);await hover(134);results.lastCell=await checkPlaying(15,134);
  }
  await chooseGroup(0);await hover(0);await checkPlaying(0,0);
  await evaluate(`document.querySelector('#velocity-grid [data-cell="0"]').click()`);
  await hover(1);await wait(300);
  results.pin=await evaluate(`document.querySelector('#velocity-grid [data-cell="0"]').getAttribute('aria-pressed')==='true'`);
  if(!results.pin)throw Error('Pinned selection changed on hover');
  await evaluate(`document.getElementById('velocity-pin').click()`);
  // Rapid movement must not resume stale clips or leave unresolved media state.
  for(const id of [1,2,0])await hover(id);
  results.rapidHover=await checkPlaying(0,0);
  await evaluate(`document.querySelector('#velocity-metrics [data-metric="style"]').click()`);
  results.styleMode=await evaluate(`({cells:document.querySelectorAll('#velocity-grid button').length,legend:document.getElementById('velocity-legend').innerText})`);
  await chooseGroup(0);await hover(40);await checkPlaying(0,40);
  await evaluate(`document.getElementById('velocity-pause').click()`);
  await wait(400);
  results.pause=await evaluate(`[...document.querySelectorAll('.velocity-videos video')].every(v=>v.paused)`);
  if(!results.pause)throw Error('Pause did not stop both players');
  const shot=async name=>{await evaluate(`document.getElementById('velocity-explorer').scrollIntoView({block:'start',behavior:'instant'})`);await wait(200);const r=await cmd('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));};
  await shot('desktop_style');
  await evaluate(`document.querySelector('#velocity-metrics [data-metric="command"]').click()`);
  await shot('desktop_command');
  if(!smoke){
    // A failed request must produce an explicit error and allow a clean retry.
    await chooseGroup(0);
    await evaluate(`window.VELOCITY_EXPLORER.groups[0].cells[0].video='videos/velocity_explorer_720p/missing-test-file.mp4'`);
    await hover(0);
    await until(`document.getElementById('velocity-status').textContent.startsWith('Unable to load')`);
    await evaluate(`window.VELOCITY_EXPLORER.groups[0].cells[0].video=${JSON.stringify(data.groups[0].cells[0].video)};document.getElementById('velocity-play').click()`);
    results.recovery=await checkPlaying(0,0);
    await evaluate(`document.getElementById('velocity-pin').click();document.querySelector('#velocity-grid [data-cell="0"]').focus();document.querySelector('#velocity-grid [data-cell="0"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}))`);
    results.keyboard=await checkPlaying(0,1);
  }
  await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
  await cmd('Emulation.setTouchEmulationEnabled',{enabled:true});
  await evaluate(`document.getElementById('velocity-matched-toggle').checked=true;document.getElementById('velocity-matched-toggle').dispatchEvent(new Event('change'))`);
  await chooseGroup(5);
  const point=await evaluate(`(()=>{const e=document.querySelector('#velocity-grid [data-cell="0"]');e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  results.touch=await checkPlaying(5,0,'matched');
  results.mobile=await evaluate(`({viewport:innerWidth,page:document.documentElement.scrollWidth,grid:document.getElementById('velocity-grid').scrollWidth})`);
  if(results.mobile.page>results.mobile.viewport)throw Error('Mobile page overflow');
  await shot('mobile');
  // New visible controls must preserve access to all recorded examples and baselines.
  results.navigation=await evaluate(`({dropdowns:document.querySelectorAll('select').length,disclosures:document.querySelectorAll('details').length,posters:[...document.querySelectorAll('.motion-choice img')].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src)})`);
  if(results.navigation.dropdowns||results.navigation.disclosures||results.navigation.posters.length)throw Error('Main-page navigation or poster problem');
  results.homepage=await evaluate(`({tables:document.querySelectorAll('table').length,comparisonSection:!!document.getElementById('comparisons'),comparisonLink:document.querySelector('#velocity-explorer a[href="controllers.html"]')?.getAttribute('href')})`);
  if(results.homepage.tables||results.homepage.comparisonSection||!results.homepage.comparisonLink)throw Error('Homepage has not been simplified as requested');
  results.galleries=[];
  for(const method of ['model_a']){
    if(await evaluate(`!!document.getElementById('gallery-methods')`))throw Error('Baseline choices must not appear in the coherence browser');
    const entries=await evaluate(`(()=>{const result=[];for(const b of document.querySelectorAll('#gallery-styles .motion-choice')){b.click();result.push({id:b.dataset.style,clips:document.querySelectorAll('#referenceDisplayRoot video').length});}return result;})()`);
    const expected=method==='model_a'?16:method==='u_c10'?15:17;
    if(entries.length!==expected||entries.some(e=>e.clips!==(e.id==='VQ-008'?1:3)))throw Error('Gallery coverage changed');
    await evaluate(`document.getElementById('gallery-play').click()`);
    await until(`[...document.querySelectorAll('#referenceDisplayRoot video')].every(v=>!v.paused&&v.currentTime>0.05)`);
    await evaluate(`document.getElementById('gallery-pause').click()`);
    results.galleries.push({method,groups:entries.length,clips:entries.reduce((n,e)=>n+e.clips,0)});
  }
  await evaluate(`document.getElementById('velocity-matched-toggle').checked=false;document.getElementById('velocity-matched-toggle').dispatchEvent(new Event('change'))`);
  await evaluate(`document.querySelector('#gallery-styles [data-style="C14"]').click();document.getElementById('gallery-try').click()`);
  results.galleryLink=await evaluate(`document.getElementById('velocity-reference').getAttribute('src').endsWith('reference_14.mp4')`);
  if(!results.galleryLink)throw Error('Gallery link selected the wrong controller reference');
  if(!await evaluate(`document.querySelector('#velocity-styles [data-style="14"]').getAttribute('aria-pressed')==='true'`))throw Error('Gallery-to-explorer link failed');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.getElementById('reference-motions').scrollIntoView({behavior:'instant'})`);await wait(200);
  const galleryShot=await cmd('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,'gallery.png'),Buffer.from(galleryShot.data,'base64'));
  await cmd('Page.navigate',{url:new URL('controllers.html',base).href});
  await until(`document.querySelectorAll('#matched-video-root video').length===3`);
  results.comparisons=[];
  for(const panel of ['pb_u','pb_vq']){
    await evaluate(`document.querySelector('#matched-methods [data-panel="${panel}"]').click()`);
    const count=await evaluate(`document.querySelectorAll('#matched-examples .motion-choice').length`);
    if(count!==3)throw Error('Matched examples missing');
    await evaluate(`document.querySelectorAll('#matched-examples .motion-choice')[2].click();document.getElementById('matched-play').click()`);
    await until(`[...document.querySelectorAll('#matched-video-root video')].every(v=>!v.paused&&v.currentTime>0.05)`);
    results.comparisons.push(await evaluate(`({panel:${JSON.stringify(panel)},clips:document.querySelectorAll('#matched-video-root video').length,rows:document.querySelectorAll('#matched-comparison-table tbody tr').length,conclusion:document.getElementById('matched-conclusion').textContent})`));
    await evaluate(`document.getElementById('matched-pause').click()`);
  }
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  for(const [id,name]of [['comparisons','comparisons']]){
    await evaluate(`document.getElementById(${JSON.stringify(id)}).scrollIntoView({behavior:'instant'})`);await wait(200);
    const r=await cmd('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));
  }
  await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
  results.comparisonMobile=await evaluate(`({viewport:innerWidth,page:document.documentElement.scrollWidth})`);
  if(results.comparisonMobile.page>results.comparisonMobile.viewport)throw Error('Comparison page overflows on mobile');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:new URL('technical.html',base).href});
  await until(`document.querySelectorAll('table').length===4`);
  results.technical=await evaluate(`({tables:document.querySelectorAll('table').length,links:[...document.querySelectorAll('a[download]')].length,referenceClips:document.querySelectorAll('#reference-compare-root video').length})`);
  await evaluate(`document.querySelector('#matched-methods [data-panel="pb_vq"]').click()`);
  await evaluate(`document.getElementById('reference-play').click()`);
  await until(`[...document.querySelectorAll('#reference-compare-root video')].every(v=>!v.paused&&v.currentTime>0.05)`);
  await evaluate(`document.getElementById('reference-pause').click()`);
  results.errors=errors;if(errors.length)throw Error('Runtime errors');
  await writeFile(path.join(out,smoke?'smoke_checks.json':'browser_checks.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
}finally{ws.close();chrome.kill('SIGTERM');}
