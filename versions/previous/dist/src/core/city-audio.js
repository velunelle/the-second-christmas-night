// Low-level, nonverbal street ambience, made once and looped. No speech is intelligible.
// Positional conversation beds, occasional shoes/bags, distant traffic and a shop bell.
export class CityAmbience {
 constructor(sound){
  this.sound=sound;this.ctx=sound.ctx;this.volume=.65;this.inside=false;this.level=.4;this.last=-1;
  const c=this.ctx;this.bus=new GainNode(c,{gain:.65});this.filter=new BiquadFilterNode(c,{type:'lowpass',frequency:4200});this.bus.connect(this.filter).connect(sound.master);
  const chatter=this.murmur(16.7);
  this.sources=[[44,-120,1],[-14,24,.45],[14,-50,.45],[125,-175,.65],[0,-160,.55]].map(([x,z,power],i)=>{
   const gain=new GainNode(c,{gain:0}),pan=new StereoPannerNode(c,{pan:0}),src=new AudioBufferSourceNode(c,{buffer:chatter,loop:true,playbackRate:.94+i*.025});
   src.connect(gain).connect(pan).connect(this.bus);src.start(0,i*1.3);return {x,z,power,gain,pan};
  });
  const traffic=new AudioBufferSourceNode(c,{buffer:sound.rainBuffer(7.3,{bed:true,hp:60,lp:380}),loop:true});traffic.connect(new GainNode(c,{gain:.12})).connect(this.bus);traffic.start();
  this.timer=setInterval(()=>this.event(),420);
 }
 murmur(seconds){
  const c=this.ctx,sr=c.sampleRate,n=Math.round(seconds*sr),b=c.createBuffer(1,n,sr),d=b.getChannelData(0);
  // Overlapping formant-shaped voiced grains, softened and too distant to form words.
  for(let voice=0;voice<5;voice++)for(let at=Math.random();at<seconds;at+=.7+Math.random()*1.8){
   const pitch=95+Math.random()*100,formant=500+Math.random()*1000,count=2+Math.floor(Math.random()*4);
   for(let syllable=0;syllable<count;syllable++){
    const start=Math.round((at+syllable*.18)*sr),length=Math.round(sr*(.10+Math.random()*.07));
    for(let j=0;j<length&&start+j<n;j++){
     const t=j/sr,env=Math.sin(Math.PI*j/length)**2;let value=0;
     for(let k=1;k<=7;k++){const f=pitch*k;value+=Math.sin(2*Math.PI*f*t+voice)*Math.exp(-(((f-formant)/650)**2))/k;}
     d[start+j]+=value*env*.075;
    }
   }
  }
  // Soft low pass keeps the individual grains behind the street rather than in one's ear.
  let a=0,b0=0;const k=1-Math.exp(-2*Math.PI*1600/sr);
  for(let i=0;i<n;i++){a+=(d[i]-a)*k;b0+=(a-b0)*k;d[i]=b0;}
  let energy=0,peak=0;for(const v of d){energy+=v*v;peak=Math.max(peak,Math.abs(v));}
  const gain=Math.min(.065/Math.sqrt(energy/n||1),.4/(peak||1));for(let i=0;i<n;i++)d[i]*=gain;
  return b;
 }
 setVolume(v){this.volume=Math.max(0,Math.min(1,v));this.bus.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.25);}
 listener(position,quaternion,indoors,weather){
  const t=this.ctx.currentTime;if(t-this.last<.1)return;this.last=t;
  const rightX=1-2*(quaternion.y**2+quaternion.z**2),rightZ=2*(quaternion.x*quaternion.z-quaternion.w*quaternion.y);
  let density=0;
  for(const s of this.sources){const dx=s.x-position.x,dz=s.z-position.z,d=Math.hypot(dx,dz),gain=s.power/(1+(d/38)**2)*(weather==='rain'?.62:1)*(indoors?.26:1);density+=gain;
   s.gain.gain.setTargetAtTime(gain*.75,t,.25);s.pan.pan.setTargetAtTime(Math.max(-.85,Math.min(.85,(dx*rightX+dz*rightZ)/Math.max(d,1))),t,.2);
  }
  if(indoors!==this.inside){if(indoors)this.bell();this.inside=indoors;this.filter.frequency.setTargetAtTime(indoors?1100:4200,t,.5);}
  this.level=Math.min(1,density);this.filter.Q.value=.4;
 }
 event(){
  if(document.hidden||this.ctx.state!=='running'||this.sound.muted||this.volume===0||Math.random()>.5*this.level)return;
  const c=this.ctx,t=c.currentTime,pan=new StereoPannerNode(c,{pan:Math.random()*1.6-.8});pan.connect(this.bus);
  for(let i=0;i<2;i++){
   const src=new AudioBufferSourceNode(c,{buffer:this.sound.noise}),filter=new BiquadFilterNode(c,{type:'lowpass',frequency:700+Math.random()*500}),gain=new GainNode(c,{gain:0}),at=t+i*.27;
   src.connect(filter).connect(gain).connect(pan);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.04*this.level,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+.13);src.start(at,Math.random(),.16);
   src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();if(i===1)pan.disconnect();};
  }
 }
 bell(){const c=this.ctx,t=c.currentTime;for(const [f,offset] of [[1318.5,0],[1760,.09]]){const o=new OscillatorNode(c,{frequency:f}),g=new GainNode(c,{gain:0});o.connect(g).connect(this.bus);g.gain.setValueAtTime(.035,t+offset);g.gain.exponentialRampToValueAtTime(.0001,t+offset+.8);o.start(t+offset);o.stop(t+offset+.9);o.onended=()=>{o.disconnect();g.disconnect();};}}
}
