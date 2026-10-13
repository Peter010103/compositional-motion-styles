/* Lightweight visual motion chooser shared by the gallery and velocity explorer. */
(() => {
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  window.MotionUI={
    strip(rootId,items,onChoose,initial){
      const root=document.getElementById(rootId);root.replaceChildren();root.className='motion-browser';
      const previous=node('button','‹','strip-arrow'),next=node('button','›','strip-arrow'),rail=node('div',undefined,'motion-strip');
      previous.type=next.type='button';previous.setAttribute('aria-label','Previous motion group');next.setAttribute('aria-label','Next motion group');
      let selected=initial;
      const buttons=items.map(item=>{
        const b=node('button',undefined,'motion-choice');b.type='button';b.dataset.style=item.id;b.setAttribute('aria-label',item.label);b.setAttribute('aria-pressed','false');
        const img=node('img');img.src=item.poster;img.alt='';img.loading='lazy';img.width=160;img.height=90;b.append(img,node('span',item.label));
        b.addEventListener('click',()=>choose(item.id));rail.append(b);return b;
      });
      function mark(id,scroll=true){
        selected=id;const index=items.findIndex(item=>item.id===id);
        buttons.forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===index));b.tabIndex=i===index?0:-1;});
        previous.disabled=index<=0;next.disabled=index>=items.length-1;
        const b=buttons[index];if(scroll&&b){const br=b.getBoundingClientRect(),rr=rail.getBoundingClientRect();if(br.left<rr.left||br.right>rr.right)rail.scrollBy({left:br.left-rr.left-(rr.width-br.width)/2,behavior:'instant'});}
      }
      function choose(id){mark(id);onChoose(id);}
      function step(delta){const index=items.findIndex(item=>item.id===selected),item=items[index+delta];if(item)choose(item.id);}
      previous.addEventListener('click',()=>step(-1));next.addEventListener('click',()=>step(1));
      rail.addEventListener('keydown',e=>{let id;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);id=selected;}else if(e.key==='Home'||e.key==='End'){e.preventDefault();id=items[e.key==='Home'?0:items.length-1].id;choose(id);}if(id!==undefined)buttons[items.findIndex(item=>item.id===id)].focus({preventScroll:true});});
      root.append(previous,rail,next);mark(initial,false);return {select:mark};
    },
    async play(root,status){
      const videos=[...root.querySelectorAll('video')];status.textContent='Loading clips…';
      const results=await Promise.all(videos.map(v=>{v.currentTime=0;return v.play().then(()=>true).catch(()=>false);}));
      status.textContent=results.every(Boolean)?'Playing recorded examples. Their motion phases are not aligned.':'Use the individual video controls to play any clips that did not start.';
    },
    pause(root,status){root.querySelectorAll('video').forEach(v=>v.pause());status.textContent='Paused.';}
  };
})();
