import * as THREE from 'three';
import {content,T} from './content.js';
import {buildCinematicShots,sampleShot} from './cinematics.js';
export function setupExperience({camera,renderer,walker,city,sound,ui,onQuality,fireworks,festival}){
 const $=id=>document.getElementById(id);let toastTimer;
 const toast=text=>{$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3800);};
 const state={active:false,paused:false,time:0,duration:72,forcedDoor:null,started:false};
 const resetInput=()=>{walker.joystick={x:0,y:0};walker.keys.clear();walker.running=false;};
 const enter=()=>{state.started=true;document.body.classList.add('entered');ui.intro.classList.add('gone');sound.start();festival.init();window.citySong?.attach(sound);window.citySong?.start();ui.hint.classList.add('show');setTimeout(()=>ui.hint.classList.remove('show'),6000);};
 const syncMode=()=>{$('walk-mode').textContent=walker.mode==='auto'?'自由漫游':'自动漫步';};
 $('enter-free').addEventListener('click',()=>{enter();walker.setMode('free');syncMode();});
 // Analog movement. Pointer capture makes release outside the base safe, including multi-touch with looking.
 const stick=$('joystick'),thumb=$('stick-thumb');let stickPointer=null;
 function stickMove(e){if(e.pointerId!==stickPointer)return;const r=stick.getBoundingClientRect(),radius=r.width*.36;let x=(e.clientX-r.left-r.width/2)/radius,y=(e.clientY-r.top-r.height/2)/radius;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}if(Math.hypot(x,y)<.12){x=0;y=0;}walker.joystick={x,y:-y};thumb.style.transform=`translate(${x*radius}px,${y*radius}px)`;}
 stick.addEventListener('pointerdown',e=>{if(stickPointer!==null||state.active)return;e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);walker.setMode('free');syncMode();stickMove(e);});
 stick.addEventListener('pointermove',stickMove);
 const release=e=>{if(stickPointer!==e.pointerId)return;stickPointer=null;walker.joystick={x:0,y:0};thumb.style.transform='';};
 for(const name of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(name,release);
 $('sprint').addEventListener('click',()=>{walker.running=!walker.running;$('sprint').setAttribute('aria-pressed',String(walker.running));});
 addEventListener('blur',()=>{resetInput();stickPointer=null;thumb.style.transform='';});
 $('walk-mode').addEventListener('click',()=>{resetInput();walker.setMode(walker.mode==='auto'?'free':'auto');syncMode();});syncMode();
 $('settings-toggle').addEventListener('click',()=>{const panel=$('settings');panel.hidden=!panel.hidden;$('settings-toggle').setAttribute('aria-expanded',String(!panel.hidden));});
 $('credits-toggle').addEventListener('click',()=>{$('credits').hidden=!$('credits').hidden;});
 $('fullscreen').addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();if(screen.orientation?.lock)await screen.orientation.lock('landscape');}catch{toast('可以直接横过手机游玩；此浏览器未允许锁定横屏。');}});
 const ratioInput=$('render-ratio');
 function setPicture(options){const r=onQuality(options);$('ratio-value').textContent=r.ratio+' 倍';$('render-size').textContent=r.width+' × '+r.height+' 像素';}
 ratioInput.addEventListener('change',()=>setPicture({ratio:+ratioInput.value}));ratioInput.addEventListener('input',()=>{$('ratio-value').textContent=ratioInput.value+' 倍';});
 for(const b of document.querySelectorAll('[data-ratio]'))b.addEventListener('click',()=>{ratioInput.value=b.dataset.ratio;setPicture({ratio:+b.dataset.ratio});});
 $('reflection-rate').addEventListener('change',()=>setPicture({reflectionFPS:+$('reflection-rate').value}));
 $('reflection-quality').addEventListener('change',()=>setPicture({reflection:+$('reflection-quality').value}));$('shadow-quality').addEventListener('change',()=>setPicture({shadow:+$('shadow-quality').value}));
 addEventListener('resize',()=>{$('render-size').textContent=Math.round(innerWidth*(+ratioInput.value))+' × '+Math.round(innerHeight*(+ratioInput.value))+' 像素';});
 $('render-size').textContent=Math.round(innerWidth*3)+' × '+Math.round(innerHeight*3)+' 像素';
 const shots=buildCinematicShots(city);state.duration=shots.reduce((n,s)=>n+s.duration,0);state.shots=shots;
 let lastChapter=-1,lastBell=-1,finale=false;
 const fade=document.createElement('div');fade.id='shot-fade';Object.assign(fade.style,{position:'fixed',inset:'0',background:'#09141d',pointerEvents:'none',opacity:'0'});$('tour-ui').prepend(fade);
 const recordCanvas=document.createElement('canvas'),recordContext=recordCanvas.getContext('2d',{alpha:false});let captionState={index:0,opacity:1,remaining:0,countdown:false};
 function linesFor(ctx,text,width){const lines=[];for(const raw of text.split('\n')){let row='';for(const ch of raw){if(row&&ctx.measureText(row+ch).width>width){lines.push(row);row=ch;}else row+=ch;}lines.push(row);}return lines;}
 function drawRecording(){const source=renderer.domElement;if(recordCanvas.width!==source.width||recordCanvas.height!==source.height){recordCanvas.width=source.width;recordCanvas.height=source.height;}const g=recordContext,w=recordCanvas.width,h=recordCanvas.height;g.drawImage(source,0,0,w,h);g.fillStyle='#030a1244';g.fillRect(0,0,w,h*.055);g.fillRect(0,h*.945,w,h*.055);const font=Math.max(15,Math.min(w*.025,h*.048));g.font='500 '+font+'px "Noto Serif SC",serif';const poem=content.poems[captionState.index],rows=linesFor(g,poem.text,w*.83),line=font*1.65,x=w*.06,y=h*.88-(rows.length-1)*line-font;g.save();g.globalAlpha=Math.max(0,captionState.opacity);g.fillStyle='#f2f6ff';g.shadowColor='#000';g.shadowBlur=font*.6;rows.forEach((row,i)=>g.fillText(row,x,y+i*line));g.font='500 '+font*.48+'px "Noto Serif SC",serif';g.fillText(poem.credit?'—— '+poem.credit:'',x,y+rows.length*line);g.restore();if(captionState.countdown){g.textAlign='center';g.font='400 '+h*.12+'px Georgia';g.fillStyle='#eaf5ff';g.fillText(String(captionState.remaining).padStart(2,'0'),w*.86,h*.3);g.textAlign='left';}}
 let recorder=null,chunks=[],recording=false,recordTimer=null,downloadUrl=null;
 function finishRecord(){if(recorder?.state==='recording')recorder.stop();}
 function stop(){fireworks.reset();festival.cancel();$('countdown').hidden=true;state.active=false;state.paused=false;state.forcedDoor=null;document.body.classList.remove('cinematic');$('tour-ui').hidden=true;resetInput();walker.setMode('free');walker.pos.set(0,0,35);walker.eyeY=1.85;walker.yaw=0;walker.pitch=.12;walker.lookYaw=walker.lookPitch=0;camera.fov=64;camera.updateProjectionMatrix();syncMode();finishRecord();}
 function start(){if(!state.started)enter();fireworks.reset();festival.cancel();lastChapter=-1;lastBell=-1;finale=false;window.citySong?.restart();window.citySong?.resume();resetInput();state.active=true;state.paused=false;state.time=0;document.body.classList.add('cinematic');$('tour-ui').hidden=false;$('settings').hidden=true;$('tour-pause').textContent='暂停镜头';$('download-video').hidden=true;}
 $('cinema').addEventListener('click',start);$('enter-tour').addEventListener('click',start);$('tour-exit').addEventListener('click',stop);$('tour-pause').addEventListener('click',()=>{state.paused=!state.paused;$('tour-pause').textContent=state.paused?'继续镜头':'暂停镜头';if(state.paused){festival.cancel();window.citySong?.pause();}else window.citySong?.resume();});
 $('record').addEventListener('click',()=>{
  if(recording){finishRecord();return;}
  if(!renderer.domElement.captureStream||!window.MediaRecorder){toast('这个浏览器不支持页面录制，请使用手机的系统录屏。');return;}
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
  if(!mime){toast('这个浏览器没有可用的录制编码，请使用系统录屏。');return;}
  try{
   drawRecording();const stream=recordCanvas.captureStream(30);for(const track of sound.recordDestination?.stream.getAudioTracks()??[])stream.addTrack(track.clone());recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:Math.max(20000000,Math.round(recordCanvas.width*recordCanvas.height*30*.16))});chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onstop=()=>{clearTimeout(recordTimer);stream.getTracks().forEach(t=>t.stop());recording=false;$('record').textContent='录制画面';if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(new Blob(chunks,{type:mime}));const a=$('download-video');a.href=downloadUrl;a.download=content.title+'-电影漫游.'+(mime.includes('mp4')?'mp4':'webm');a.hidden=false;toast('视频已准备好，点击「保存漫游视频」。');};
   start();drawRecording();recorder.start(1000);recording=true;$('record').textContent='停止录制';toast('从第一镜开始录制，包含诗句、钟声与环境声。官方播放器音乐请用系统录屏。');
  }catch{toast('录制未能启动，请使用手机的系统录屏。');}
 });
 return {
 state,
 update(dt){
  if(!state.started)return true;
  if(!state.active)return false;
  if(!state.paused)state.time=Math.min(state.duration,state.time+dt);
  let t=state.time,index=0;while(index<shots.length-1&&t>shots[index].duration){t-=shots[index].duration;index++;}
  const s=shots[index],v=THREE.MathUtils.clamp(t/s.duration,0,1);
  sampleShot(camera,s,v);state.forcedDoor=s.roomDoor&&v>.59?s.roomDoor:null;
  if(index!==lastChapter){lastChapter=index;$('shot-title').textContent=content.poems[index].text;$('shot-credit').textContent=content.poems[index].credit?'—— '+content.poems[index].credit:'';$('shot-number').textContent=String(index+1).padStart(2,'0')+' / 06';
   if(index>0&&index<5)fireworks.trigger({position:[index%2?80:-85,210,-260],type:index%2?'willow':'chrysanthemum',size:8});
  }
  const countdown=index===5&&t<12;const remaining=countdown?12-Math.floor(t):0;$('countdown').hidden=index!==5;
  if(index===5){$('countdown-number').textContent=countdown?String(remaining):'00';if(countdown&&!state.paused&&remaining!==lastBell){lastBell=remaining;festival.bell(12-remaining);}if(!countdown&&!finale){finale=true;festival.celebrate();fireworks.setShow(true);}}
  $('tour-progress').firstElementChild.style.width=state.time/state.duration*100+'%';fade.style.opacity=Math.max(0,1-t/.16,1-(s.duration-t)/.16).toFixed(3);
  captionState={index,opacity:Math.min(1,t/.45,(s.duration-t)/.25),remaining,countdown:index===5};
  if(state.time>=state.duration){state.paused=true;finishRecord();$('tour-pause').textContent='已播放完';}
  return true;
 },afterRender(){if(recording)drawRecording();},toast};
}
