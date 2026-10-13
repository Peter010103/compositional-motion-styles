/* CODES velocity explorer: fixed conditioning reference, optional comparison recording. */
(() => {
  'use strict';
  const D = window.VELOCITY_EXPLORER;
  if (!D) return;
  const $ = id => document.getElementById(id);
  const node = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const signed = x => x === 0 ? '0' : (x > 0 ? '+' : '−') + Math.abs(x).toFixed(2).replace(/0$/, '');
  const format = x => x === null ? 'Not available' : Number(x).toFixed(3);
  let group, selected, pinned = false, hoverTimer, generation = 0, lastButton, styleStrip;
  let segment = null, segmentFrame = null, segmentControls, segmentSeek, segmentTime, segmentPlay;
  let metric='command';
  const colors = ['#edf1f5', '#a8cddd', '#4e97b7', '#185a7b'];
  // Paper Figure 2: COSINE_CMAP, 256-entry LUT; AsinhNorm(width=.12), [-.1, 1].
  const styleStops = [[140,59,42], [215,154,123], [244,242,237], [184,216,207], [42,157,143], [23,78,90]];
  const styleLow = Math.asinh(-.1/.12), styleHigh = Math.asinh(1/.12);
  function styleColor(value) {
    if (value === null) return '#eceff2';
    const normalized = Math.max(0, Math.min(1, (Math.asinh(value/.12)-styleLow)/(styleHigh-styleLow)));
    const t = Math.min(255, Math.floor(normalized*256))/255*5, i = Math.min(4, Math.floor(t)), f = t-i;
    return `rgb(${styleStops[i].map((v,j) => Math.round(v+f*(styleStops[i+1][j]-v))).join(',')})`;
  }
  function updateLegend() {
    const style = metric === 'style', root = $('velocity-legend'); root.replaceChildren();
    $('velocity-metric-explanation').textContent=style
      ? 'How similar is the executed motion to the controller reference? Higher cosine scores mean more similar encoded motion; they are not perceptual ratings.'
      : 'How often does the robot complete the trial and follow the velocity command? Darker cells mean more of the three trials meet the error limits.';
    if (style) {
      root.append(node('span', 'Reference cosine'));
      const bar = node('span', undefined, 'velocity-gradient'); root.append(node('span', '−0.1'), bar, node('span', '1.0'));
      root.append(node('span', 'Gray: no scored windows', 'small-note'));
    } else {
      root.append(node('span', 'Trials meeting command limits:'));
      colors.forEach((color,i) => { const item=node('span',undefined,'velocity-key'); const swatch=node('i'); swatch.style.background=color; item.append(swatch,document.createTextNode(`${i}/3`)); root.append(item); });
    }
    const support=node('span',undefined,'velocity-key');support.append(node('i',undefined,'support-swatch'),document.createTextNode('Velocities represented in the recordings'));root.append(support);
  }
  function renderGrid() {
    const root=$('velocity-grid'); root.replaceChildren();
    root.style.gridTemplateColumns=`var(--grid-label-width, 36px) repeat(${D.xs.length}, minmax(0, 1fr))`;
    root.append(node('span','vᵧ','velocity-tick'));
    D.xs.forEach((x,i) => root.append(node('span', signed(x), 'velocity-tick velocity-x-tick'+(i%2?' minor-tick':''))));
    for (const y of D.ys) {
      root.append(node('span', signed(y), 'velocity-tick'));
      for (const x of D.xs) {
        const cell=group.cells.find(c => c.x === x && c.y === y);
        const b=node('button', undefined, 'velocity-cell'); b.type='button'; b.dataset.cell=cell.id;
        b.style.background=metric === 'style' ? styleColor(cell.cosine) : colors[cell.successes];
        if (cell.recorded_support) b.classList.add('recorded');
        b.setAttribute('aria-label',`Style ${group.id}, forward ${signed(x)} m/s, lateral ${signed(y)} m/s. Command success ${cell.successes} of 3; reference cosine ${format(cell.cosine)}.`);
        b.setAttribute('aria-pressed', String(selected?.id === cell.id));
        if (selected?.id === cell.id) { b.classList.add('selected'); lastButton=b; }
        b.addEventListener('pointerenter',e => {if(e.pointerType === 'touch' || pinned)return;clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>{if(!pinned)select(cell,b,true);},160);});
        b.addEventListener('pointerleave',()=>clearTimeout(hoverTimer));
        b.addEventListener('focus',()=>{if(!pinned)select(cell,b,true);});
        b.addEventListener('click',()=>{clearTimeout(hoverTimer);setPinned(true);select(cell,b,true);});
        b.addEventListener('keydown', e => {
          const dx={ArrowLeft:-1,ArrowRight:1}[e.key] || 0, dy={ArrowUp:-1,ArrowDown:1}[e.key] || 0;
          if (!dx && !dy) return; e.preventDefault();
          const nx=D.xs[D.xs.indexOf(x)+dx], ny=D.ys[D.ys.indexOf(y)+dy];
          const next=group.cells.find(c=>c.x===nx && c.y===ny);if(next){const target=root.querySelector(`[data-cell="${next.id}"]`);select(next,target,true);target.focus({preventScroll:true});}
        });
        root.append(b);
      }
    }
    updateLegend();
  }
  function setPinned(value) {
    clearTimeout(hoverTimer);
    pinned=value; $('velocity-pin').textContent=pinned ? 'Resume hover' : 'Keep this cell';
    $('velocity-pin').setAttribute('aria-pressed',String(pinned));
  }
  function referenceFor(cell) {
    const matched=$('velocity-matched-toggle').checked && cell.velocity_reference;
    if(matched)return {path:cell.velocity_reference.video, heading:'Velocity-matched recording',
      note:`Recorded forward ${signed(cell.velocity_reference.recorded_velocity[0])} m/s · lateral ${signed(cell.velocity_reference.recorded_velocity[1])} m/s. Display comparison only.`};
    const fallback=$('velocity-matched-toggle').checked && !cell.velocity_reference;
    return {path:group.reference_video, heading:fallback?'Controller reference (no zero-yaw match)':'Controller-conditioning reference',
      note:fallback?'No recording in this style meets the zero-yaw condition. Showing the actual policy reference.':'This recorded motion conditions the controller at every cell in this style.'};
  }
  function rolloutMedia(cell) {
    // Banks are opt-in. The ordinary site keeps using the original clips until
    // the externally hosted pilot is verified and its manifest is enabled.
    const bank = window.VELOCITY_BANKS?.banks?.find(b => b.style === group.id);
    const clip = bank?.segments.find(s => s.cell === cell.id);
    return clip ? {path:bank.src, start:clip.start_s, end:clip.end_s}
      : {path:cell.video, start:cell.video_start_s ?? 0, end:cell.video_end_s ?? null};
  }
  function configureRollout(media) {
    const video = $('velocity-rollout'); video.pause();
    segment = media.end === null ? null : {start:media.start, end:media.end};
    video.loop = !segment; video.controls = !segment;
    segmentControls.hidden = !segment;
    if (segment) {
      segmentSeek.max = String(segment.end-segment.start);
      video.dataset.segmentStart = segment.start; video.dataset.segmentEnd = segment.end;
    } else {
      delete video.dataset.segmentStart; delete video.dataset.segmentEnd;
    }
    updateSegmentControls();
  }
  function updateSegmentControls() {
    if (!segment) return;
    const video = $('velocity-rollout'), duration = segment.end-segment.start;
    const elapsed = Math.max(0, Math.min(duration, video.currentTime-segment.start));
    segmentSeek.value = elapsed; segmentTime.textContent = `${elapsed.toFixed(1)} / ${duration.toFixed(0)} s`;
    segmentPlay.textContent = video.paused ? 'Play' : 'Pause';
  }
  function setupSegmentControls() {
    const video = $('velocity-rollout');
    segmentControls = node('div', undefined, 'video-segment-controls'); segmentControls.hidden = true;
    segmentPlay = node('button', 'Play'); segmentPlay.type = 'button';
    segmentSeek = node('input'); segmentSeek.type = 'range'; segmentSeek.min = '0'; segmentSeek.step = '.01';
    segmentSeek.setAttribute('aria-label', 'Time within the selected rollout');
    segmentTime = node('span');
    segmentControls.append(segmentPlay, segmentSeek, segmentTime); video.after(segmentControls);
    segmentPlay.addEventListener('click', () => {
      setPinned(true);
      if (video.paused) video.play().catch(() => { $('velocity-status').textContent = 'Press Play both to retry.'; });
      else video.pause();
    });
    segmentSeek.addEventListener('input', () => {
      if (!segment || video.readyState < 1) return;
      setPinned(true);
      video.currentTime = Math.min(segment.end-1/30, segment.start+Number(segmentSeek.value));
      updateSegmentControls();
    });
    const constrain = () => {
      if (!segment || video.readyState < 1 || video.seeking) return;
      if (video.currentTime < segment.start-.001 || video.currentTime >= segment.end-.001) video.currentTime = segment.start;
      updateSegmentControls();
    };
    const stopFrames = () => {
      if (segmentFrame !== null) video.cancelVideoFrameCallback?.(segmentFrame);
      segmentFrame = null;
    };
    const frame = (_now, meta) => {
      segmentFrame = null;
      if (!segment || video.paused) return;
      // Loop on the final frame, before the next command's first frame appears.
      if (meta.mediaTime >= segment.end-1/30-.001) video.currentTime = segment.start;
      updateSegmentControls();
      segmentFrame = video.requestVideoFrameCallback(frame);
    };
    video.addEventListener('playing', () => {
      stopFrames(); constrain();
      if (segment && video.requestVideoFrameCallback) segmentFrame = video.requestVideoFrameCallback(frame);
      updateSegmentControls();
    });
    video.addEventListener('pause', () => { stopFrames(); updateSegmentControls(); });
    video.addEventListener('timeupdate', constrain);
    video.addEventListener('seeked', constrain);
    video.addEventListener('seeking', () => {
      if (segment && (video.currentTime < segment.start-.001 || video.currentTime >= segment.end)) video.currentTime = segment.start;
    });
    video.addEventListener('ended', () => {
      if (segment) { video.currentTime = segment.start; video.play().catch(() => {}); }
    });
  }
  async function prepareVideo(video, path, token, start=0) {
    video.pause();
    if(video.getAttribute('src') !== path){video.src=path;video.load();}
    if(video.readyState < 1) await new Promise((resolve,reject)=>{
      let timer;
      const clean=()=>{clearTimeout(timer);video.removeEventListener('loadedmetadata',ready);video.removeEventListener('error',failed);video.removeEventListener('emptied',changed);};
      const ready=()=>{clean();resolve();}, failed=()=>{clean();reject(Error('Video could not load.'));}, changed=()=>{if(token!==generation){clean();resolve();}};
      video.addEventListener('loadedmetadata',ready,{once:true});video.addEventListener('error',failed,{once:true});video.addEventListener('emptied',changed,{once:true});
      timer=setTimeout(()=>{clean();reject(Error('Video loading timed out.'));},15000);
    });
    if(token !== generation)return;
    if(video.error)throw Error('Video could not load.');
    video.currentTime=start;
  }
  async function playSelected() {
    const token=++generation, videos=[$('velocity-reference'),$('velocity-rollout')], reference=referenceFor(selected), media=rolloutMedia(selected);
    configureRollout(media);
    $('velocity-status').textContent='Loading selected clips…';
    try {
      await Promise.all(videos.map((v,i)=>prepareVideo(v,i ? media.path : reference.path,token,i ? media.start : 0)));
      if(token !== generation)return;
      const outcomes=await Promise.all(videos.map(v=>v.play().then(()=>true).catch(()=>false)));
      if(token !== generation)return;
      if(videos.some(v=>v.error))throw Error('Video could not load.');
      $('velocity-status').textContent=outcomes.every(Boolean) ? 'Playing. The two-second reference repeats; motion phases are not aligned.' : 'Clips loaded. Press Play both or use the video controls.';
    } catch(error) {
      if(token === generation)$('velocity-status').textContent='Unable to load this preview. Press Play both to retry.';
    }
  }
  function select(cell, button, autoplay) {
    if(selected?.id === cell.id && lastButton === button){
      if(autoplay && ($('velocity-reference').paused || $('velocity-rollout').paused))playSelected();
      return;
    }
    clearTimeout(hoverTimer); selected=cell;
    if(lastButton){lastButton.classList.remove('selected');lastButton.setAttribute('aria-pressed','false');}
    lastButton=button;if(button){button.classList.add('selected');button.setAttribute('aria-pressed','true');}
    $('velocity-selected').textContent=`Style ${group.id} · Forward ${signed(cell.x)} m/s · Lateral ${signed(cell.y)} m/s`;
    $('velocity-cell-metrics').textContent=`Command limits met: ${cell.successes}/3 trials · Mean reference cosine: ${format(cell.cosine)}${cell.cosine_trials<3 ? ` (${cell.cosine_trials} scored trials)` : ''}`;
    const reference=referenceFor(cell);$('velocity-reference-heading').textContent=reference.heading==='Controller-conditioning reference'?'Controller reference':reference.heading;$('velocity-reference-note').textContent=reference.note;
    $('velocity-reference-explanation').hidden=!$('velocity-matched-toggle').checked;
    $('velocity-reference-explanation').textContent='Only the comparison video changes. The execution and cosine score still use the fixed controller reference.';
    $('velocity-trial-metrics').textContent=`Shown trial: planar RMSE ${format(cell.shown_planar_rmse)} m/s · yaw RMSE ${format(cell.shown_yaw_rmse)} rad/s`;
    const stop=$('velocity-trial-status'); stop.classList.toggle('trial-failed',!cell.shown_completed);
    stop.textContent=cell.shown_completed ? 'Completed 15 seconds' : `Terminated early${cell.shown_stop_s!==null ? ` at ${cell.shown_stop_s.toFixed(2)} s` : ''} — last alive state held`;
    $('velocity-rollout').dataset.completed=String(cell.shown_completed);
    if(autoplay)playSelected(); else {
      const token=++generation, media=rolloutMedia(cell); configureRollout(media);
      $('velocity-reference').src=reference.path;
      prepareVideo($('velocity-rollout'),media.path,token,media.start).catch(() => {
        if(token === generation)$('velocity-status').textContent='Unable to load this preview. Press Play both to retry.';
      });
      $('velocity-status').textContent='Hover over a cell to preview it, or tap to keep it selected.';
    }
  }
  window.addEventListener('DOMContentLoaded',()=>{
    if(!$('velocity-styles'))return;
    setupSegmentControls();
    const changeGroup=id=>{
      const previous=selected;
      clearTimeout(hoverTimer);setPinned(false);group=D.groups.find(g=>g.id===Number(id));selected=null;lastButton=null;
      [$('velocity-reference'),$('velocity-rollout')].forEach(v=>v.pause());renderGrid();
      const cell=group.cells.find(c=>c.x===(previous?.x??.5) && c.y===(previous?.y??0));select(cell,$('velocity-grid').querySelector(`[data-cell="${cell.id}"]`),false);
    };
    styleStrip=window.MotionUI.strip('velocity-styles',D.groups.map(g=>({id:g.id,label:`Style ${g.id}`,poster:`images/style_thumbnails/controller_${g.id}.jpg`})),changeGroup,0);
    const setMetric=value=>{metric=value;$('velocity-metrics').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.metric===metric)));renderGrid();};
    $('velocity-metrics').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>setMetric(b.dataset.metric)));
    document.querySelectorAll('[data-show-metric]').forEach(a=>a.addEventListener('click',()=>setMetric(a.dataset.showMetric)));
    window.addEventListener('codes-style',e=>{if(D.groups.some(g=>g.id===e.detail)){styleStrip.select(e.detail);changeGroup(e.detail);}});
    $('velocity-matched-toggle').addEventListener('change',()=>{if(selected){const b=lastButton;lastButton=null;select(selected,b,true);}});
    $('velocity-pin').addEventListener('click',()=>setPinned(!pinned));
    $('velocity-play').addEventListener('click',()=>{setPinned(true);playSelected();});
    $('velocity-pause').addEventListener('click',()=>{++generation;setPinned(true);[$('velocity-reference'),$('velocity-rollout')].forEach(v=>v.pause());$('velocity-status').textContent='Paused.';});
    changeGroup(0);
  });
})();
