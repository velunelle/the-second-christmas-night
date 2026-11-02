/**
 * City adaptation of https://github.com/toddegray/fireworks
 * Original shell physics, types, launch particles, pooled geometry and sharp trails:
 * Copyright (c) 2026 Todd Gray, MIT. See accompanying toddegray-fireworks LICENSE.
 * Changes: factory/shared render loop, deterministic RNG, world coordinates, caller DPR,
 * correct city depth/layers, non-adaptive shell density, softer star cores, pooled smoke,
 * explicit choreography controls and shared Soundscape output with cancellable nodes.
 * No standalone renderer, camera, AudioContext, DOM listeners or requestAnimationFrame.
 */
import * as THREE from 'three';
export function buildFireworks({sound=null,onBoom=null,capacity=42000,seed=12012026,pixelRatio=3,smoke=true}={}){
 let rngSeed=seed>>>0;
 const random=()=>{rngSeed|=0;rngSeed=(rngSeed+0x6d2b79f5)|0;let t=Math.imul(rngSeed^(rngSeed>>>15),1|rngSeed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
 const rand=(a,b)=>a+random()*(b-a),pick=a=>a[(random()*a.length)|0],chance=p=>random()<p;
 const group=new THREE.Group();group.name='christmas-fireworks';group.layers.set(2);
 const stats={liveParticles:0,liveSmoke:0,rockets:0,bursts:0,capacityDrops:0,capacity:Math.max(1024,Math.floor(capacity)),drawBatches:smoke?3:2,show:false};
 let now=0,cameraRef=null,show=false,nextCue=0,cue=0;
// ---- colors (metal-salt palettes) ----------------------------------------
const C = {
  red: [255, 60, 55], deepred: [235, 30, 60], orange: [255, 120, 30],
  gold: [255, 200, 70], yellow: [255, 235, 120], green: [90, 255, 120],
  emerald: [30, 220, 110], blue: [70, 130, 255], cyan: [110, 225, 255],
  purple: [185, 95, 255], pink: [255, 120, 200], white: [255, 245, 225],
};
const PALETTES = [
  [C.gold], [C.red], [C.green], [C.blue], [C.purple], [C.cyan], [C.pink], [C.emerald],
  [C.red, C.gold], [C.blue, C.white], [C.green, C.gold], [C.purple, C.pink],
  [C.cyan, C.white], [C.orange, C.gold], [C.red, C.white],
  [C.red, C.green, C.blue], [C.gold, C.pink, C.cyan],
];

// ---- particle pool (structure-of-arrays) ---------------------------------
const MAX = Math.max(1024,Math.floor(capacity));
const pos = new Float32Array(MAX * 3), ppos = new Float32Array(MAX * 3);
const col = new Float32Array(MAX * 3), siz = new Float32Array(MAX);
const vel = new Float32Array(MAX * 3), base = new Float32Array(MAX * 3), bsz = new Float32Array(MAX);
const life = new Float32Array(MAX), maxl = new Float32Array(MAX);
const drg = new Float32Array(MAX), grv = new Float32Array(MAX), wnd = new Float32Array(MAX);
const twk = new Uint8Array(MAX), pha = new Float32Array(MAX), flk = new Float32Array(MAX);
const spl = new Float32Array(MAX), spd_ = new Uint8Array(MAX);
let count = 0;

// per-particle position history (ring buffer) for sharp line trails.
// Each particle has its own trail LENGTH (frames), so a chrysanthemum leaves a
// long comet tail while a peony is nearly a clean dot — that's what makes the
// shell types look genuinely different rather than the same ball scaled up.
const TL = 12;
const hist = new Float32Array(MAX * TL * 3);
const ptl = new Uint8Array(MAX);   // trail length per particle, in frames (1..TL-1)
let frameN = 0;

// heads: additive points with a hot core + faint halo baked into the shape (no blur pass)
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1).setUsage(THREE.DynamicDrawUsage));
const mat = new THREE.ShaderMaterial({
  uniforms:{uRatio:{value:pixelRatio}},toneMapped:false,
  transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    attribute float aSize; attribute vec3 aColor; varying vec3 vColor;uniform float uRatio;
    void main(){ vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      gl_PointSize = clamp(aSize * (150.0 / max(-mv.z,1.0)), 0.6, 8.0)*uRatio;
      gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `
    precision highp float; varying vec3 vColor;
    void main(){
      vec2 uv=gl_PointCoord-.5;float r=length(uv);if(r>.5)discard;
      float halo=exp(-r*r*24.0),core=1.0-smoothstep(.06,.23,r);
      gl_FragColor=vec4(vColor*(.65+.45*core),halo);
    }`,
});
const heads=new THREE.Points(geo,mat);heads.name='firework-stars';heads.frustumCulled=false;heads.layers.set(2);group.add(heads);

// trails: a short additive line from each star's previous position to current
const lpos = new Float32Array(MAX * 6), lcol = new Float32Array(MAX * 6);
const lgeo = new THREE.BufferGeometry();
lgeo.setAttribute("position", new THREE.BufferAttribute(lpos, 3).setUsage(THREE.DynamicDrawUsage));
lgeo.setAttribute("color", new THREE.BufferAttribute(lcol, 3).setUsage(THREE.DynamicDrawUsage));
const lines = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({
  vertexColors: true, transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending,
}));
lines.name='firework-trails';lines.frustumCulled=false;lines.layers.set(2);group.add(lines);

function spawn(x, y, z, vx, vy, vz, rgb, lifeSec, o = {}) {
  if (count >= MAX){stats.capacityDrops++;return;}
  const i = count++, i3 = i * 3;
  pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z;
  ppos[i3] = x; ppos[i3 + 1] = y; ppos[i3 + 2] = z;
  for (let k = 0; k < TL; k++) { const h = (i * TL + k) * 3; hist[h] = x; hist[h + 1] = y; hist[h + 2] = z; }
  vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
  base[i3] = rgb[0] / 255; base[i3 + 1] = rgb[1] / 255; base[i3 + 2] = rgb[2] / 255;
  life[i] = lifeSec; maxl[i] = lifeSec;
  bsz[i] = o.size ?? 5; drg[i] = o.drag ?? 1.2; grv[i] = o.grav ?? 1; wnd[i] = o.wind ?? 1;
  twk[i] = o.twinkle ? 1 : 0; pha[i] = rand(0, 6.28); flk[i] = rand(7, 14);
  spl[i] = o.splitIn ?? 0; spd_[i] = 0;
  ptl[i] = Math.max(1, Math.min(TL - 1, o.trail ?? 2));
}
function copyP(a, b) {
  const a3 = a * 3, b3 = b * 3;
  for (let k = 0; k < 3; k++) { pos[b3 + k] = pos[a3 + k]; ppos[b3 + k] = ppos[a3 + k]; vel[b3 + k] = vel[a3 + k]; base[b3 + k] = base[a3 + k]; }
  bsz[b] = bsz[a]; life[b] = life[a]; maxl[b] = maxl[a]; drg[b] = drg[a]; grv[b] = grv[a];
  wnd[b] = wnd[a]; twk[b] = twk[a]; pha[b] = pha[a]; flk[b] = flk[a]; spl[b] = spl[a]; spd_[b] = spd_[a];
  for (let k = 0; k < TL * 3; k++) hist[b * TL * 3 + k] = hist[a * TL * 3 + k];
  ptl[b] = ptl[a];
}

// ---- shell types ---------------------------------------------------------
function uDir() { const u = rand(-1, 1), t = rand(0, 6.283), s = Math.sqrt(1 - u * u); return [Math.cos(t) * s, u, Math.sin(t) * s]; }
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3();

// Real aerial-shell specs. Star count, burst radius, rise height and burn time
// all scale with shell DIAMETER (inches) — the actual pyrotechnic relationship.
// stars: real counts packed on the shell's surface; rise: ~100 ft/inch; w: how
// common that size is in a show (small shells frequent, 12" finale shells rare).
// Sizes deliberately kept in a tight band so bursts read as consistent, with only
// gentle variety. Rise (height) still varies widely so the sky fills top to bottom.
const SHELLS = [
  { in: 3,  stars: [140, 190],  spread: [33, 38], rise: [42, 66],  life: [1.4, 2.0], w: 5.0 },
  { in: 4,  stars: [180, 240],  spread: [35, 40], rise: [48, 78],  life: [1.5, 2.1], w: 6.0 },
  { in: 5,  stars: [230, 310],  spread: [37, 43], rise: [54, 90],  life: [1.7, 2.3], w: 5.0 },
  { in: 6,  stars: [300, 400],  spread: [40, 46], rise: [60, 100], life: [1.9, 2.5], w: 4.0 },
  { in: 8,  stars: [400, 540],  spread: [43, 50], rise: [68, 110], life: [2.1, 2.8], w: 2.0 },
  { in: 10, stars: [540, 720],  spread: [47, 54], rise: [76, 118], life: [2.4, 3.1], w: 1.0 },
  { in: 12, stars: [720, 950],  spread: [51, 58], rise: [84, 126], life: [2.7, 3.5], w: 0.6 },
];
function pickShell(minIn) {
  const pool = minIn ? SHELLS.filter((s) => s.in >= minIn) : SHELLS;
  let tw = 0; for (const s of pool) tw += s.w;
  let r = random() * tw;
  for (const s of pool) { r -= s.w; if (r <= 0) return s; }
  return pool[pool.length - 1];
}

function burst(x, y, z, pal, type, shell) {
  shell = shell || pickShell();
  const stars = rand(shell.stars[0], shell.stars[1]) | 0;   // real star count for this size
  const spread = rand(shell.spread[0], shell.spread[1])*1.8;    // burst radius scales with size
  const dur = () => rand(shell.life[0], shell.life[1]);
  const dsize = 6.4;                                          // uniform star size; distance/perspective handles apparent size
  const col1=()=>pick(pal),N=n=>Math.max(6,n|0); // Fixed shell detail; no adaptive thinning.

  if (type === "peony") {
    const n = N(stars);
    for (let k = 0; k < n; k++) { const d = uDir(), v = spread * rand(0.9, 1.02); spawn(x, y, z, d[0] * v, d[1] * v, d[2] * v, col1(), dur(), { size: dsize, drag: 1.5, trail: 2 }); }   // clean dots, no tail
  } else if (type === "chrysanthemum") {
    const n = N(stars), c = col1();
    for (let k = 0; k < n; k++) { const d = uDir(), v = spread * rand(0.85, 1.0); spawn(x, y, z, d[0] * v, d[1] * v, d[2] * v, c, dur() * 1.25, { size: dsize, drag: 1.05, trail: 10 }); }   // long comet tails
  } else if (type === "willow") {
    const c = pick([C.gold, C.orange, C.yellow]), n = N((stars * 0.7) | 0);
    for (let k = 0; k < n; k++) { const d = uDir(), v = spread * 0.55 * rand(0.8, 1.0); spawn(x, y, z, d[0] * v, d[1] * v, d[2] * v, c, dur() * 1.3, { size: dsize, drag: 0.6, grav: 1.0, wind: 1.6, trail: 11 }); }   // weeping, gentle drooping tails
  } else if (type === "ring") {
    const n = N(Math.min(stars, 30 + shell.in * 18)), c = col1();
    _a.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
    _b.crossVectors(_a, _v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1))).normalize();
    for (let k = 0; k < n; k++) { const ang = (k / n) * 6.283, cx = Math.cos(ang), sy = Math.sin(ang);
      spawn(x, y, z, (_a.x * cx + _b.x * sy) * spread, (_a.y * cx + _b.y * sy) * spread, (_a.z * cx + _b.z * sy) * spread, c, dur(), { size: dsize, drag: 1.1, trail: 3 }); }
  } else if (type === "crossette") {
    const n = N(Math.max(12, (stars * 0.12) | 0)), c = col1();   // few big comets, each splits
    for (let k = 0; k < n; k++) { const d = uDir(), v = spread * 0.85 * rand(0.8, 1.0); spawn(x, y, z, d[0] * v, d[1] * v, d[2] * v, c, dur(), { size: dsize, drag: 0.9, splitIn: rand(0.55, 0.85), trail: 7 }); }
  } else if (type === "palm") {
    const n = N(6 + (shell.in | 0)), c = pick([C.gold, C.orange]);   // a handful of thick fronds
    for (let k = 0; k < n; k++) { const a = rand(0, 6.283), r = rand(0.2, 0.7), v = spread * 1.25 * rand(0.85, 1.05);
      spawn(x, y, z, Math.cos(a) * r * v, (1 - r) * v + rand(6, 14), Math.sin(a) * r * v, c, dur() * 1.15, { size: dsize, drag: 0.55, grav: 1.2, wind: 1.2, trail: 10 }); }
  } else if (type === "glitter") {
    const n = N(stars), c = col1();
    for (let k = 0; k < n; k++) { const d = uDir(), v = spread * 0.6 * random(); spawn(x, y, z, d[0] * v, d[1] * v, d[2] * v, c, dur(), { size: dsize, twinkle: true, grav: 0.7, trail: 3 }); }
  } else if (type === "dahlia") {                          // fewer, larger stars that reach farther
    const n = N((stars * 0.5) | 0), c = col1();
    for (let k = 0; k < n; k++) { const d = uDir(), v = spread * 1.25 * rand(0.92, 1.05); spawn(x, y, z, d[0] * v, d[1] * v, d[2] * v, c, dur() * 1.2, { size: dsize, drag: 0.9, trail: 8 }); }
  } else if (type === "pistil") {                          // cored shell: outer color + contrasting center
    const outer = col1(), inner = pick([C.white, C.gold, C.cyan, C.pink]);
    const no = N((stars * 0.7) | 0);
    for (let k = 0; k < no; k++) { const d = uDir(), v = spread * rand(0.9, 1.02); spawn(x, y, z, d[0] * v, d[1] * v, d[2] * v, outer, dur(), { size: dsize, drag: 1.5, trail: 3 }); }
    const ni = N((stars * 0.35) | 0);
    for (let k = 0; k < ni; k++) { const d = uDir(), v = spread * 0.45 * rand(0.8, 1.0); spawn(x, y, z, d[0] * v, d[1] * v, d[2] * v, inner, dur() * 0.9, { size: dsize, drag: 1.7, trail: 2 }); }
  } else if (type === "spider") {                          // fast thin legs that shoot out then droop
    const n = N((stars * 0.5) | 0), c = col1();
    for (let k = 0; k < n; k++) { const d = uDir(), v = spread * 1.6 * rand(0.95, 1.05); spawn(x, y, z, d[0] * v, d[1] * v, d[2] * v, c, dur() * 0.9, { size: dsize, drag: 2.3, grav: 0.9, trail: 8 }); }
  } else if (type === "kamuro") {                          // dense gold glitter that hangs and drapes
    const c = pick([C.gold, C.yellow]), n = N((stars * 0.9) | 0);
    for (let k = 0; k < n; k++) { const d = uDir(), v = spread * 0.7 * rand(0.85, 1.0); spawn(x, y, z, d[0] * v, d[1] * v, d[2] * v, c, dur() * 1.4, { size: dsize, twinkle: true, drag: 0.55, grav: 1.0, wind: 1.5, trail: 11 }); }
  } else if (type === "multibreak") {
    const idx = SHELLS.indexOf(shell), sub = SHELLS[Math.max(0, idx - 2)];   // breaks into smaller shells
    burst(x, y, z, pal, pick(["peony", "chrysanthemum", "ring"]), shell);
    const b = 2 + (random() * 3 | 0);
    for (let k = 0; k < b; k++) { const dx = rand(-16, 16), dy = rand(-12, 8), dz = rand(-6, 6), p2 = pick(PALETTES);
      timers.push({ at: now + rand(0.35, 0.9), fn: () => burst(x + dx, y + dy, z + dz, p2, pick(["peony", "glitter", "ring"]), sub) }); }
  }
  if(type!=='multibreak'){boom(x,y,z,type,shell.in);smokeBurst(x,y,z,shell.in);stats.bursts++;}
}
function crossetteSplit(i) {
  const i3 = i * 3; _v.set(vel[i3], vel[i3 + 1], vel[i3 + 2]);
  _up.set(0, 1, 0); if (Math.abs(_v.y) > 0.9 * _v.length()) _up.set(1, 0, 0);
  _a.crossVectors(_v, _up).normalize(); _b.crossVectors(_v, _a).normalize();
  const rgb = [base[i3] * 255, base[i3 + 1] * 255, base[i3 + 2] * 255], sp = 16;
  for (const s of [1, -1]) for (const P of [_a, _b])
    spawn(pos[i3], pos[i3 + 1], pos[i3 + 2], vel[i3] * 0.3 + P.x * s * sp, vel[i3 + 1] * 0.3 + P.y * s * sp, vel[i3 + 2] * 0.3 + P.z * s * sp, rgb, rand(0.6, 1.0), { size: 4.5 });
}

// ---- rockets -------------------------------------------------------------
const GY = 9;   // gentle gravity so stars fizzle out in the air, not plummet off-screen
const rockets = [], timers = [];
// The RING (the shell that bursts into a circle outline) is deliberately kept OUT
// of these lists — it's added as a rare accent only ~4% of the time in launch().
const TYPES = ["peony", "chrysanthemum", "chrysanthemum", "willow", "willow", "kamuro", "kamuro",
  "crossette", "palm", "spider", "dahlia", "pistil", "glitter"];
const FINALE_TYPES = ["willow", "willow", "kamuro", "kamuro", "crossette", "palm", "chrysanthemum", "peony"];
const FEATURE_TYPES = ["willow", "kamuro", "crossette", "palm", "chrysanthemum", "dahlia"];
const LIFTS = ["spark", "spark", "spark", "dim", "colored", "faint"];   // ascent tails vary per rocket
function launch(x,z,shell,palette,type,baseY=110,targetY=null){
 shell=shell||pickShell();const apexY=targetY??baseY+rand(shell.rise[0],shell.rise[1]);
 const pal=palette||pick(PALETTES);
 rockets.push({x,y:baseY,z,vx:rand(-1.3,1.3),vy:Math.sqrt(2*GY*Math.max(15,apexY-baseY)),vz:rand(-1.3,1.3),
  type:type||(chance(.04)?'ring':pick(TYPES)),palette:pal,shell,lift:pick(LIFTS),liftCol:pick(pal)});
}

// Translucent puffs are a separate preallocated Points batch, so their silhouettes
// darken/reveal naturally against moonlight rather than adding opaque white discs.
const SMAX=384,smokePos=new Float32Array(SMAX*3),smokeSize=new Float32Array(SMAX),smokeAlpha=new Float32Array(SMAX);
const smokeAge=new Float32Array(SMAX),smokeLife=new Float32Array(SMAX),smokeBase=new Float32Array(SMAX),smokePhase=new Float32Array(SMAX);let smokeCount=0;
const smokeGeo=new THREE.BufferGeometry();smokeGeo.setAttribute('position',new THREE.BufferAttribute(smokePos,3).setUsage(THREE.DynamicDrawUsage));smokeGeo.setAttribute('aSize',new THREE.BufferAttribute(smokeSize,1).setUsage(THREE.DynamicDrawUsage));smokeGeo.setAttribute('aAlpha',new THREE.BufferAttribute(smokeAlpha,1).setUsage(THREE.DynamicDrawUsage));
const smokeMat=new THREE.ShaderMaterial({uniforms:{uRatio:{value:pixelRatio},uHeight:{value:900*pixelRatio},uTime:{value:0}},transparent:true,depthWrite:false,depthTest:true,toneMapped:false,
 vertexShader:`attribute float aSize;attribute float aAlpha;uniform float uHeight;varying float vAlpha;varying vec3 vSeed;void main(){vAlpha=aAlpha;vSeed=position;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*uHeight/max(-mv.z,1.),1.,700.);gl_Position=projectionMatrix*mv;}`,
 fragmentShader:`precision highp float;uniform float uTime;varying float vAlpha;varying vec3 vSeed;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
 void main(){vec2 uv=gl_PointCoord-.5;float r=length(uv);if(r>.5)discard;float n=noise(uv*7.+vSeed.xz*.13+uTime*.02)*.65+noise(uv*15.+vSeed.xy*.04)*.35;float density=(1.-smoothstep(.12,.5,r))*(.3+.7*n);gl_FragColor=vec4(mix(vec3(.14,.17,.21),vec3(.39,.34,.27),n),density*vAlpha);}`});
const smokePoints=new THREE.Points(smokeGeo,smokeMat);smokePoints.name='firework-smoke';smokePoints.layers.set(2);smokePoints.frustumCulled=false;if(smoke)group.add(smokePoints);
function smokeBurst(x,y,z,inches){if(!smoke)return;const n=6+Math.floor(inches*.8);for(let k=0;k<n&&smokeCount<SMAX;k++){
 const i=smokeCount++,j=i*3,d=uDir();smokePos[j]=x+d[0]*rand(2,9);smokePos[j+1]=y+d[1]*rand(2,9);smokePos[j+2]=z+d[2]*rand(2,9);
 smokeAge[i]=0;smokeLife[i]=rand(6,10);smokeBase[i]=rand(3,6);smokePhase[i]=rand(0,6.283);
}}
function updateSmoke(dt){for(let i=0;i<smokeCount;){smokeAge[i]+=dt;if(smokeAge[i]>=smokeLife[i]){const j=--smokeCount;if(i!==j){smokePos.set(smokePos.subarray(j*3,j*3+3),i*3);smokeAge[i]=smokeAge[j];smokeLife[i]=smokeLife[j];smokeBase[i]=smokeBase[j];smokePhase[i]=smokePhase[j];}continue;}
 const j=i*3,t=smokeAge[i],v=t/smokeLife[i];smokePos[j]+=dt*(1.6+Math.sin(smokePhase[i])*.4);smokePos[j+1]+=dt*.8;smokeSize[i]=smokeBase[i]+t*1.5;smokeAlpha[i]=(1-Math.exp(-t*4))*.055*Math.pow(1-v,1.3);i++;
 }
 smokeGeo.setDrawRange(0,smokeCount);smokeGeo.attributes.position.needsUpdate=smokeGeo.attributes.aSize.needsUpdate=smokeGeo.attributes.aAlpha.needsUpdate=true;smokeMat.uniforms.uTime.value=now;
}

// Audio goes through the existing Soundscape master/mute/recording graph.
const audioNodes=new Set();
function boom(x,y,z,type,inches=6){
 const position=[x,y,z];if(onBoom){onBoom({position,type,size:inches});return;}
 const ac=sound?.ctx;if(!ac||!sound.master||sound.muted||!sound.noise)return;
 const dx=x-(cameraRef?.position.x??0),dy=y-(cameraRef?.position.y??2),dz=z-(cameraRef?.position.z??0),distance=Math.hypot(dx,dy,dz);
 const t=ac.currentTime+distance/343,mag=(.16+inches*.01)/(1+(distance/350)**2);
 const src=ac.createBufferSource();src.buffer=sound.noise;
 const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=145+rand(0,40);
 const gain=ac.createGain(),pan=ac.createStereoPanner();let panValue=dx/Math.max(distance,1);if(cameraRef?.quaternion){const q=cameraRef.quaternion,rx=1-2*(q.y*q.y+q.z*q.z),rz=2*(q.x*q.z-q.w*q.y);panValue=(dx*rx+dz*rz)/Math.max(distance,1);}pan.pan.value=Math.max(-.8,Math.min(.8,panValue));
 gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(mag,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+.7);
 src.connect(lp).connect(gain).connect(pan).connect(sound.master);src.start(t);src.stop(t+.75);audioNodes.add(src);src.onended=()=>{audioNodes.delete(src);src.disconnect();lp.disconnect();gain.disconnect();pan.disconnect();};
 const osc=ac.createOscillator(),og=ac.createGain();osc.frequency.setValueAtTime(88,t);osc.frequency.exponentialRampToValueAtTime(38,t+.3);og.gain.setValueAtTime(mag*.55,t);og.gain.exponentialRampToValueAtTime(.0001,t+.4);osc.connect(og).connect(sound.master);osc.start(t);osc.stop(t+.45);audioNodes.add(osc);osc.onended=()=>{audioNodes.delete(osc);osc.disconnect();og.disconnect();};
}
function shellOf(inches){return SHELLS.reduce((best,s)=>Math.abs(s.in-inches)<Math.abs(best.in-inches)?s:best,SHELLS[0]);}
function trigger(options={},typeArg,extra={}){
 if(Array.isArray(options)||options?.isVector3)options={...extra,position:options,type:typeArg};
 const p=options.position??[options.x??0,options.y??210,options.z??-260],x=p.x??p[0],y=p.y??p[1],z=p.z??p[2];
 if(![x,y,z].every(Number.isFinite))throw new TypeError('Firework position must contain three finite coordinates');
 if(options.seed!==undefined)rngSeed=options.seed>>>0;
 const type=options.type??'chrysanthemum';if(![...TYPES,'ring','multibreak'].includes(type))throw new RangeError('Unknown firework shell: '+type);
 const palette=options.palette??[C.gold,C.white],shell=shellOf(options.size??8);
 if(!Array.isArray(palette)||!palette.length||palette.some(rgb=>!Array.isArray(rgb)||rgb.length<3||!rgb.every(Number.isFinite)))throw new TypeError('Firework palette must contain RGB triples in 0–255');
 if(options.launch)launch(x,z,shell,palette,type,options.baseY??Math.max(90,y-75),y);else burst(x,y,z,palette,type,shell);
 stats.liveParticles=count;stats.liveSmoke=smokeCount;stats.rockets=rockets.length;return stats;
}
function directShow(){
 if(now<nextCue)return;
 // Matched blue/ivory and gold shells across genuine world space. First cue is
 // immediate when the caller starts the show after the twelve-second countdown.
 const palettes=[[C.gold,C.white],[C.blue,C.white],[C.gold,C.cyan]],pal=palettes[cue%palettes.length];
 const z=-245-(cue%3)*55,y=235+(cue%4)*14;
 if(cue%7===0){trigger({position:[-88,y,z],type:'kamuro',size:10,palette:pal});trigger({position:[88,y+12,z-20],type:'chrysanthemum',size:10,palette:pal});}
 else if(cue%7===5){trigger({position:[0,235,z-35],type:'multibreak',size:12,palette:pal});}
 else trigger({position:[rand(-125,125),y,z],type:pick(FEATURE_TYPES),size:cue%3===0?10:8,palette:pal,launch:cue%4===2});
 nextCue=now+(cue%7===5?1.8:rand(.85,1.35));cue++;
}
let windX=0,windZ=0;let windSign=chance(.5)?1:-1;
function upload(){
 geo.setDrawRange(0,count);geo.attributes.position.needsUpdate=geo.attributes.aColor.needsUpdate=geo.attributes.aSize.needsUpdate=true;
 lgeo.setDrawRange(0,count*2);lgeo.attributes.position.needsUpdate=lgeo.attributes.color.needsUpdate=true;
 stats.liveParticles=count;stats.liveSmoke=smokeCount;stats.rockets=rockets.length;stats.show=show;
}

function resize(ratio=3,height=900){
 if(!Number.isFinite(ratio)||ratio<=0||!Number.isFinite(height)||height<=0)throw new RangeError('Positive ratio and viewport height required');
 pixelRatio=ratio;mat.uniforms.uRatio.value=ratio;smokeMat.uniforms.uRatio.value=ratio;smokeMat.uniforms.uHeight.value=height*ratio;
}
function update(dt,time,camera,ratio){
 if(!Number.isFinite(dt)||dt<0)return;cameraRef=camera??cameraRef;if(ratio!==undefined&&ratio!==pixelRatio)resize(ratio,cameraRef?.userData?.viewportHeight??900);
 if(dt===0)return;dt=Math.min(dt,.1);now+=dt;
  // gentle, steady breeze in ONE horizontal direction — no depth drift, never reverses
  const gust = 2.4 + 0.8 * Math.sin(now * 0.05) + 0.4 * Math.sin(now * 0.13);
  windX = windSign * gust;
  windZ = 0;
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= now) { timers[i].fn(); timers.splice(i, 1); }
  if(show)directShow();

  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i]; r.vy -= GY * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
    // ascent tail differs per rocket: bright gold sparks, dim, colored, or nearly dark
    let emit = true, tcol = C.gold, tsize = 4, tlife = rand(0.18, 0.4);
    if (r.lift === "dim") { emit = chance(0.5); tsize = 3; tlife = rand(0.12, 0.28); }
    else if (r.lift === "faint") { emit = chance(0.25); tsize = 2.5; tcol = C.orange; tlife = rand(0.1, 0.22); }
    else if (r.lift === "colored") { tcol = r.liftCol; tsize = 3.5; }
    if (emit) spawn(r.x, r.y, r.z, rand(-3, 3), rand(-3, 2), rand(-3, 3), tcol, tlife, { size: tsize, drag: 1.8, grav: 0.5 });
    if (r.vy <= 0) { burst(r.x, r.y, r.z, r.palette, r.type, r.shell); rockets.splice(i, 1); }
  }

  const writeSlot = frameN % TL;   // current position is recorded here every frame
  for (let i = 0; i < count;) {
    const i3 = i * 3;
    ppos[i3] = pos[i3]; ppos[i3 + 1] = pos[i3 + 1]; ppos[i3 + 2] = pos[i3 + 2];
    let vx = vel[i3], vy = vel[i3 + 1], vz = vel[i3 + 2];
    vy -= GY * grv[i] * dt; vx += windX * wnd[i] * dt; vz += windZ * wnd[i] * dt;
    const damp = Math.exp(-drg[i] * dt); vx *= damp; vy *= damp; vz *= damp;
    vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
    pos[i3] += vx * dt; pos[i3 + 1] += vy * dt; pos[i3 + 2] += vz * dt;
    life[i] -= dt;
    if (spl[i] > 0 && spd_[i] === 0) { spl[i] -= dt; if (spl[i] <= 0) { spd_[i] = 1; crossetteSplit(i); } }
    // bottom of the scene is the ground: stars burn out as they near it, gone below it
    if (life[i] <= 0 || pos[i3 + 1] < 0) { const j = count - 1; if (i !== j) copyP(j, i); count--; continue; }

    const lr = life[i] / maxl[i];
    let bright = 1.75 * Math.min(1, lr * 1.6);
    if (twk[i]) { if (lr < 0.85) bright *= 0.08 + 0.92 * Math.abs(Math.sin(now * 26 + pha[i])); }
    else if (lr < 0.3) bright *= 0.3 + 0.7 * Math.abs(Math.sin(now * flk[i] + pha[i]));
    if (pos[i3 + 1] < 14) bright *= Math.max(0, pos[i3 + 1] / 14);   // fade out at ground level
    const cr = base[i3] * bright, cg = base[i3 + 1] * bright, cb = base[i3 + 2] * bright;
    col[i3] = cr; col[i3 + 1] = cg; col[i3 + 2] = cb;
    siz[i] = bsz[i] * (0.5 + 0.5 * lr);
    // sharp trail: line from this star's position `ptl` frames ago to now.
    // trail length is per-type, so willows/chrysanthemums streak, peonies don't.
    const readSlot = ((frameN - ptl[i]) % TL + TL) % TL;
    const rb = (i * TL + readSlot) * 3, wb = (i * TL + writeSlot) * 3, l6 = i * 6;
    lpos[l6] = hist[rb]; lpos[l6 + 1] = hist[rb + 1]; lpos[l6 + 2] = hist[rb + 2];
    lpos[l6 + 3] = pos[i3]; lpos[l6 + 4] = pos[i3 + 1]; lpos[l6 + 5] = pos[i3 + 2];
    lcol[l6] = 0; lcol[l6 + 1] = 0; lcol[l6 + 2] = 0;                    // tail fades to black
    lcol[l6 + 3] = cr * 0.75; lcol[l6 + 4] = cg * 0.75; lcol[l6 + 5] = cb * 0.75;
    hist[wb] = pos[i3]; hist[wb + 1] = pos[i3 + 1]; hist[wb + 2] = pos[i3 + 2];  // record for future frames
    i++;
  }

  geo.setDrawRange(0, count);
  geo.attributes.position.needsUpdate = true; geo.attributes.aColor.needsUpdate = true; geo.attributes.aSize.needsUpdate = true;
  lgeo.setDrawRange(0, count * 2);
  lgeo.attributes.position.needsUpdate = true; lgeo.attributes.color.needsUpdate = true;


 updateSmoke(dt);upload();frameN++;
}
function reset(nextSeed=seed){
 now=0;frameN=0;count=0;smokeCount=0;show=false;nextCue=0;cue=0;rngSeed=nextSeed>>>0;windSign=chance(.5)?1:-1;rockets.length=timers.length=0;
 for(const node of audioNodes){try{node.stop();}catch{}}audioNodes.clear();stats.bursts=stats.capacityDrops=0;smokeGeo.setDrawRange(0,0);upload();
}
function setShow(enabled){const next=!!enabled;if(next&&!show)nextCue=now;show=next;stats.show=show;}
function finite(){
 for(let i=0;i<count;i++)if(!Number.isFinite(pos[i*3]+pos[i*3+1]+pos[i*3+2]+vel[i*3]+vel[i*3+1]+vel[i*3+2]+life[i]+siz[i]))return false;
 for(let i=0;i<smokeCount;i++)if(!Number.isFinite(smokePos[i*3]+smokePos[i*3+1]+smokePos[i*3+2]+smokeAlpha[i]))return false;
 return true;
}
function dispose(){reset();geo.dispose();mat.dispose();lgeo.dispose();lines.material.dispose();smokeGeo.dispose();smokeMat.dispose();group.clear();}
geo.setDrawRange(0,0);lgeo.setDrawRange(0,0);smokeGeo.setDrawRange(0,0);
return {group,update,resize,trigger,setShow,reset,stats,dispose,finite};
}
