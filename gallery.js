/* The same selection rule and presentation apply to every decomposition. */
(() => {
  const methods=window.GALLERY_DATA.methods,$=id=>document.getElementById(id);
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const descriptions={model_a:'CODES: 16 discovered groups, guided by broad behavior labels.',u_c10:'The same encoder ensemble without coarse-label guidance: 15 discovered groups.',vqvae:'A label-free VQ-VAE: 17 active codes. Each code supplies one shared input to its controller.'};
  let model='model_a',group;
  function render(id){
    group=methods[model].groups.find(g=>g.id===id);const root=$('referenceDisplayRoot');root.querySelectorAll('video').forEach(v=>v.pause());root.replaceChildren();
    $('gallery-selected').textContent=`${model==='vqvae'?group.name:group.name.replace('Group','Style group')} · ${group.examples.length} recorded example${group.examples.length===1?'':'s'}`;
    $('gallery-try').hidden=model!=='model_a';$('gallery-playback-status').textContent='';
    const grid=node('div',undefined,'reference-gallery-grid');
    for(let i=0;i<3;i++){
      const card=node('div',undefined,'ref-video-card'),example=group.examples[i];
      if(example){const video=node('video');video.src=example.video;video.controls=true;video.muted=true;video.loop=true;video.playsInline=true;video.preload='metadata';
        card.append(video,node('h4',`Recorded example ${i+1}`));
      }else{card.classList.add('empty-example');card.style.gridColumn='span 2';card.append(node('p','Only one distinct recorded window is available for this code.'));grid.append(card);break;}
      grid.append(card);
    }
    root.append(grid);
  }
  function setMethod(key){
    model=key;$('gallery-methods')?.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.method===key)));
    $('gallery-method-note').textContent=descriptions[key];
    const items=methods[key].groups.map(g=>({id:g.id,label:g.name,poster:`images/style_thumbnails/${key}_${g.id}.jpg`}));
    window.MotionUI.strip('gallery-styles',items,render,items[0].id);render(items[0].id);
  }
  window.addEventListener('DOMContentLoaded',()=>{
    if(!$('referenceDisplayRoot'))return;
    $('gallery-methods')?.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>setMethod(b.dataset.method)));
    $('gallery-play').addEventListener('click',()=>window.MotionUI.play($('referenceDisplayRoot'),$('gallery-playback-status')));
    $('gallery-pause').addEventListener('click',()=>window.MotionUI.pause($('referenceDisplayRoot'),$('gallery-playback-status')));
    $('gallery-try').addEventListener('click',()=>{window.dispatchEvent(new CustomEvent('codes-style',{detail:Number(group.id.slice(1))}));$('velocity-explorer').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
    setMethod(model);
  });
})();
