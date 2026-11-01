/* Shared decorative ASCII backdrop. One canvas for every cabinet route. */
(() => {
  const shell = document.querySelector('.app-shell');
  const workspace = shell?.querySelector('main.workspace');
  if (!workspace || workspace.querySelector('[data-cabinet-ascii]')) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'cabinet-ascii-background';
  canvas.setAttribute('data-cabinet-ascii', '');
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  if (!context) return;
  workspace.prepend(canvas);

  const ramp = ' .:-=+*#%@';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lowData = window.navigator?.connection?.saveData === true;
  const cursor = { x:0, y:0, tx:0, ty:0, active:false, strength:0 };
  let width=0, height=0, cell=16, cols=0, rows=0, time=0, ink='#d6c4ba';
  let frame=0, last=null, resizeTimer=0, pageActive=true;
  const shown = () => pageActive && !document.hidden && !shell.hidden && workspace.getClientRects().length > 0;
  const noise = (x,y,t) => (Math.sin(x*1.7+t*.6)+Math.sin(y*2.3-t*.4)+Math.sin((x+y)*1.1+t*.25)+Math.sin(Math.hypot(x-6,y-4)*1.9-t*.7))/8+.5;

  function paint(delta=0) {
    if (!width || !height) return;
    time += delta*1.68;
    context.clearRect(0,0,width,height);
    context.fillStyle=ink;
    const ease=delta?1-Math.pow(.88,delta*60):1;
    cursor.x+=(cursor.tx-cursor.x)*ease;cursor.y+=(cursor.ty-cursor.y)*ease;
    cursor.strength+=((cursor.active?1:0)-cursor.strength)*ease;
    for(let gy=0;gy<rows;gy++)for(let gx=0;gx<cols;gx++){
      const x=gx*cell+cell/2,y=gy*cell+cell/2;
      let lum=Math.pow(noise(gx*.35+time*.22,gy*.35,time),1.7);
      if(cursor.strength>.001){const d2=(x-cursor.x)**2+(y-cursor.y)**2;if(d2<78400)lum=Math.min(1,lum+Math.exp(-d2/19600)*.7*cursor.strength);}
      const glyph=ramp[Math.floor(lum*(ramp.length-1))];if(glyph===' ')continue;
      // Quiet area under headings; opaque cards/tables retain their own surfaces.
      const quiet=1-.72*Math.exp(-(((x-width*.45)/(width*.45))**2+((y-height*.18)/(height*.24))**2));
      context.globalAlpha=(.25+lum*.75)*quiet;
      context.fillText(glyph,x,y);
    }
    context.globalAlpha=1;
  }
  function tick(now){
    frame=0;if(!shown()||reduced.matches||lowData)return;
    if(last===null||now-last>=40){paint(last===null?0:Math.min((now-last)/1000,.08));last=now;}
    frame=window.requestAnimationFrame(tick);
  }
  function sync(){
    if(frame)window.cancelAnimationFrame(frame);frame=0;last=null;
    if(!shown())return;
    if(reduced.matches||lowData)paint();else frame=window.requestAnimationFrame(tick);
  }
  function resize(){
    if(!shown()){sync();return;}
    const rect=workspace.getBoundingClientRect();
    const left=Math.max(0,rect.left);
    width=Math.max(0,Math.min(window.innerWidth,rect.right)-left);
    height=Math.max(0,window.innerHeight);
    canvas.style.left=left+'px';canvas.style.width=width+'px';
    const ratio=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    context.setTransform(ratio,0,0,ratio,0,0);
    cell=Math.max(width<600?18:16,Math.sqrt(width*height/6500));
    cols=Math.ceil(width/cell);rows=Math.ceil(height/cell);
    context.font=`${cell*.85}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    context.textAlign='center';context.textBaseline='middle';
    ink=window.getComputedStyle(canvas).color;
    paint();sync();
  }
  function queueResize(){window.clearTimeout(resizeTimer);resizeTimer=window.setTimeout(()=>{resizeTimer=0;resize();},150);}
  function visibility(){if(shown())resize();else sync();}
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('resize',queueResize,{passive:true});
  window.addEventListener('pagehide',()=>{pageActive=false;sync();});
  window.addEventListener('pageshow',()=>{pageActive=true;visibility();});
  reduced.addEventListener?.('change',sync);
  if('ResizeObserver' in window)new window.ResizeObserver(queueResize).observe(workspace);
  if('MutationObserver' in window){
    new window.MutationObserver(visibility).observe(shell,{attributes:true,attributeFilter:['hidden','class']});
    new window.MutationObserver(()=>{if(shown()){ink=window.getComputedStyle(canvas).color;paint();}}).observe(document.documentElement,{attributes:true,attributeFilter:['class','data-theme']});
  }
  workspace.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'||reduced.matches||lowData)return;
    const rect=canvas.getBoundingClientRect();
    if(!cursor.active&&cursor.strength<.001){cursor.x=event.clientX-rect.left;cursor.y=event.clientY-rect.top;}
    cursor.tx=event.clientX-rect.left;cursor.ty=event.clientY-rect.top;cursor.active=true;
  },{passive:true});
  workspace.addEventListener('pointerleave',()=>{cursor.active=false;},{passive:true});
  visibility();
})();
