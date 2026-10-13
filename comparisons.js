/* No framework or network dependency. Figures and metrics are local assets. */
(() => {
  'use strict';
  const D = window.COMPARISON_DATA;
  const R = window.GALLERY_DATA;
  if (!D || !R) return;
  const names = {model_a: 'CODES (ours)', u_c10: 'Without coarse labels', vqvae: 'VQ-VAE'};
  const displayName = s => String(s).replace('No coarse terms','Without coarse labels');
  const technical = document.body.dataset.page === 'technical';
  const $ = id => document.getElementById(id);
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const fixed = (x,n=3) => Number(x).toFixed(n);

  function table(id, headings, rows, caption, dividers={}) {
    if(!$(id))return;
    const t = el('table');
    const head = el('thead'), hr = el('tr');
    headings.forEach(h => { const th=el('th',h); th.scope='col';hr.append(th); });head.append(hr);t.append(head);
    const body=el('tbody');
    rows.forEach((row,i) => {
      if(dividers[i]) { const r=el('tr',undefined,'table-divider'), c=el('td',dividers[i]);c.colSpan=headings.length;r.append(c);body.append(r); }
      const r=el('tr'); if(String(row[0]).startsWith('CODES')) r.className='ours-row';
      row.forEach((value,j)=>{const c=el(j===0?'th':'td'); if(j===0){c.scope='row';c.style.background='inherit';c.append(el('span',displayName(value)));}else c.textContent=value;r.append(c);}); body.append(r);
    });
    t.append(body,el('caption',caption));$(id).replaceChildren(t);
  }

  function allTables() {
    table('decomposition-comparison-table',['Method','Groups K','Effective K','Locomotion K','Coverage (%)','Core switches/min'],
      D.decomposition.map(r=>[r[0],r[1],fixed(r[2],2),r[3],fixed(r[4],1),fixed(r[5],2)]),
      'Paper Table I. CODES retains 16 groups; uniform attraction and removing reconstruction leave seven and three. Its lower coverage reflects selective density support.',
      {1:'Loss ablations',5:'Alternative representations'});
    table('coherence-comparison-table',['Method','Coverage (%)','Silhouette ↑','Cross-recording AUC ↑'],
      (technical?D.coherence:D.coherence.slice(0,3)).map(r=>[r[0],fixed(r[1],1),fixed(r[2]),fixed(r[3])]),
      'Coverage is the fraction of windows assigned to a group. Both coherence metrics use the same kinematic features.',technical?{3:'Coverage and recording-balance controls'}:{});
    if($('coherence-coverage-note')){
      const dense=D.coherence.find(r=>/full coverage/i.test(r[0])),vq=D.coherence.find(r=>r[0]==='VQ-VAE');
      $('coherence-coverage-note').textContent=`At 100% coverage, CODES still has higher silhouette (${fixed(dense[2])} vs. ${fixed(vq[2])}) and cross-recording AUC (${fixed(dense[3])} vs. ${fixed(vq[3])}) than VQ-VAE.`;
    }
    table('native-comparison-table',['Dictionary','Groups K','Median planar RMSE (m/s) ↓','Completion (%) ↑','Command success (%) ↑'],
      D.native.map(r=>[r[0],r[1],fixed(r[2]),fixed(r[3],1),fixed(r[4],1)]),
      'Each method uses its own reference collection. Command success combines completion with velocity-error limits.');
  }

  function option(select,value,label) { const o=el('option',label);o.value=value;select.append(o); }
  function groups(model) { return R.methods[model].groups; }
  function samples(model,group) {
    return group.examples.map(s=>({path:s.video,label:s.label,caption:`Recording ${s.recording_id} · frames ${s.start_frame}–${s.end_frame} · 2 seconds`}));
  }
  function groupLabel(model,g) { return g.name; }
  function gallery() {
    if(!$('compare-left-model'))return;
    for(const side of ['left','right']) {
      const model=$(`compare-${side}-model`), group=$(`compare-${side}-group`), sample=$(`compare-${side}-sample`);
      Object.entries(names).forEach(([key,label])=>option(model,key,label));
      model.value=side==='left'?'model_a':'vqvae';
      const updateVideo=()=>{
        const g=groups(model.value).find(g=>g.id===group.value), s=samples(model.value,g)[Number(sample.value)];
        const v=$(`compare-${side}-video`);v.pause();v.src=s.path;v.load();
        $(`compare-${side}-source`).textContent=s.caption;
        $(`compare-${side}-heading`).textContent=names[model.value]+' · '+g.name;
      };
      const updateSamples=()=>{const g=groups(model.value).find(g=>g.id===group.value);sample.replaceChildren();samples(model.value,g).forEach((s,i)=>option(sample,String(i),s.label));updateVideo();};
      const updateGroups=()=>{group.replaceChildren();groups(model.value).forEach(g=>option(group,g.id,groupLabel(model.value,g)));updateSamples();};
      model.addEventListener('change',updateGroups);group.addEventListener('change',updateSamples);sample.addEventListener('change',updateVideo);updateGroups();
    }
  }

  function mediaCard(title,path,caption,metric='') {
    const c=el('div',undefined,'compare-card');c.append(el('h4',title));
    const v=el('video');v.src=path;v.controls=true;v.muted=true;v.loop=true;v.playsInline=true;v.preload='metadata';c.append(v,el('p',caption,'source-caption'));
    if(metric)c.append(el('p',metric,'clip-metrics'));
    return c;
  }

  function matched() {
    if(!$('matched-methods'))return;
    let panel='pb_u';
    function updateExample(id) {
      const e=D.examples.find(e=>e.panel===panel && String(e.pair_id)===id);
      const root=$('matched-video-root');root.querySelectorAll('video').forEach(v=>v.pause());
      root.replaceChildren(mediaCard('Requested recording',e.reference_video,'The same motion is supplied to both controllers.'));
      e.policies.forEach(p=>root.append(mediaCard(displayName(p.name),p.video,
        p.completed?'Completed the trial.':'Terminated early; last frame held.',
        `Planar velocity error: ${fixed(p.planar_rmse)} m/s (RMSE)`)));
      $('matched-example-note').textContent='Forward command: 0.50 m/s · Lateral and yaw-rate commands: zero';
      $('matched-playback-status').textContent='';
    }
    function updatePanel() {
      const rows=D.matched.filter(r=>r.panel===panel);
      table('matched-comparison-table',technical?['Controller','Trials','Completion (%) ↑','Mean planar RMSE (m/s) ↓','Mean yaw RMSE (rad/s) ↓','Physical distance ↓','Recording retrieval (%) ↑']:['Controller','Completion (%) ↑','Planar RMSE (m/s) ↓','Motion distance ↓','Recording retrieval (%) ↑'],
        rows.map(r=>technical?[r.method_name,r.episodes,fixed(100*r.completion_fraction,1),fixed(r.planar_rmse),fixed(r.wz_rmse),fixed(r.physical_composite_distance),fixed(100*r.recording_retrieval_fraction_all,1)]:[r.method_name,fixed(100*r.completion_fraction,1),fixed(r.planar_rmse),fixed(r.physical_composite_distance),fixed(100*r.recording_retrieval_fraction_all,1)]),
        'Recording-balanced means. Motion distance uses completed trials; retrieval counts failures as unsuccessful. The two baseline comparisons use different shared recordings.');
      $('matched-conclusion').textContent=panel==='pb_u'
        ? 'With coarse-label guidance, CODES executions are closer to the requested motion in the physical features measured here, while planar tracking is comparable. The recording-retrieval difference remains uncertain.'
        : 'Compared with VQ-VAE, CODES more often retrieves the requested source recording. The overall motion-distance difference is inconclusive, and CODES has larger lateral and yaw-rate errors.';
      if($('matched-uncertainty'))$('matched-uncertainty').textContent=panel==='pb_u'
        ? 'CODES minus without coarse labels: physical distance −0.166 (recording-bootstrap 95% interval −0.269 to −0.085); recording retrieval +7.1 percentage points (−0.6 to +16.0).'
        : 'CODES minus VQ-VAE: physical distance +0.017 (95% interval −0.080 to +0.158); recording retrieval +21.4 percentage points (+6.7 to +37.6).';
      $('matched-protocol-count').textContent=panel==='pb_u'
        ? '39 identical retained windows from 28 recordings; 1,170 trials per controller.'
        : '14 identical retained windows from 11 recordings; 420 trials per controller.';
      if($('matched-examples')){
        const items=D.examples.filter(e=>e.panel===panel).map((e,i)=>({id:String(e.pair_id),label:`Example ${i+1}`,poster:`images/style_thumbnails/matched_${panel}_${e.pair_id}.jpg`}));
        window.MotionUI.strip('matched-examples',items,updateExample,items[0].id);updateExample(items[0].id);
      }
    }
    $('matched-methods').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{panel=b.dataset.panel;$('matched-methods').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));updatePanel();}));updatePanel();
  }

  function playback(rootId,statusId,play) {
    const videos=[...$(rootId).querySelectorAll('video')];
    if(!play){videos.forEach(v=>v.pause());$(statusId).textContent='Paused.';return;}
    Promise.all(videos.map(v=>new Promise(resolve=>{
      v.pause();v.currentTime=0;
      if(v.readyState>=3) return resolve();
      let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);v.removeEventListener('canplay',finish);v.removeEventListener('error',finish);resolve();};
      const timer=setTimeout(finish,8000);v.addEventListener('canplay',finish,{once:true});v.addEventListener('error',finish,{once:true});
    }))).then(()=>Promise.all(videos.map(v=>v.play().then(()=>true).catch(()=>false))))
      .then(results=>{$(statusId).textContent=results.every(Boolean)?'Started together; independent recordings are not phase-aligned.':'Some videos could not start. Use their individual controls or check media loading.';});
  }
  window.addEventListener('DOMContentLoaded',()=>{
    allTables();gallery();matched();
    for(const [prefix,root] of [['reference','reference-compare-root'],['matched','matched-video-root']]){
      if(!$(`${prefix}-play`))continue;
      $(`${prefix}-play`).addEventListener('click',()=>playback(root,`${prefix}-playback-status`,true));
      $(`${prefix}-pause`).addEventListener('click',()=>playback(root,`${prefix}-playback-status`,false));
    }
  });
})();
