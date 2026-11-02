// A walk through a rainy city of the future at night, in cyan-blue and white, drawn in three flat tones. The
// district (district.js) says what the city is; this sets up the renderer and the passes each frame needs: the
// moon's shadow map, the mirror image for the wet street, then the scene, ink lines, bloom and a last grade.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { shared, N_LAMP, N_BB, N_PT } from './core/toon.js';
import { LAYER } from './core/constants.js';
import { buildRain, RAIN_LEVELS } from './core/weather.js';
import { buildSky } from './core/sky.js';
import { buildTraffic } from './core/traffic.js';
import { buildTrees } from './core/trees.js';
import { buildPeople } from './core/people.js';
import { Walker } from './core/walker.js';
import { Soundscape } from './core/audio.js';
import { FinishPass } from './core/post.js';
import { loadTuning, applyTuning } from './core/tuning.js';
import { buildAtlas, fontFamily } from './kit/atlas.js';
import { loadIcons, setIcons } from './kit/icons.js';
import { buildCatalog } from './kit/catalog.js';
import { buildCity, districtWords } from './kit/city.js';
import { buildHolograms } from './kit/holograms.js';
import { makeInfoBoard } from './kit/infoBoard.js';
import { musicBeat, THEMES } from './kit/signs.js';
import {loadDetailedAssets,roadTraffic} from './detailed-assets.js';
import {weatherTuning} from './weather-presets.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import { setupExperience } from './experience.js';
import { DISTRICT } from './district.js';
import {content,applyDistrictText} from './content.js';
import {buildFireworks} from './core/fireworks.js';
import {FestivalAudio} from './core/festival-audio.js';
import {buildCinematicShots} from './cinematics.js';

const tuning = await loadTuning();applyDistrictText(DISTRICT);
const progress=(completed,message)=>window.reportCityLoad?.(completed,message);
THREE.DefaultLoadingManager.onProgress=(url,loaded,total)=>{progress(window.cityLoading?.completed??0,'资源 '+loaded+' / '+total+' · '+(url.split('/').pop().split('?')[0]));};
// the district's name on the page and over the way in
document.title = DISTRICT.name ?? "夜雨城";
document.querySelector('#intro h1').textContent = DISTRICT.name;
document.querySelector('#intro .eyebrow').textContent=content.english;

const ui = {
  intro: document.getElementById('intro'),
  status: document.getElementById('status'),
  hint: document.getElementById('hint'),
  mode: document.getElementById('mode'),
  rain: document.getElementById('rain'),
  sound: document.getElementById('sound'),
  pace: document.getElementById('pace'),
  music: document.getElementById('music'),
};
const nextFrame = () => new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 100); });
const say = async (msg) => { ui.status.textContent = msg; await nextFrame(); };

// ---------------------------------------------------------------- renderer

const W = () => Math.max(1, innerWidth), H = () => Math.max(1, innerHeight);
const MOBILE = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
let renderRatio=3;
const PR=3;
let reflectionScale=1,reflectionFPS=0,lastReflection=-Infinity;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, W() / H(), 0.1, 2600);
for (const l of [LAYER.SOLID, LAYER.GLOW, LAYER.AIR, LAYER.GROUND, LAYER.INSIDE]) camera.layers.enable(l);

const sound=new Soundscape(),festival=new FestivalAudio(sound),fireworks=buildFireworks({sound,pixelRatio:PR});scene.add(fireworks.group);

// ---------------------------------------------------------------- the world

await say('写下招牌上的字…');
const atlas = await buildAtlas(districtWords(DISTRICT), tuning.fonts);
// the icons drawn into some signs (kit/icons.js), and the fonts of the themed signs (kit/signs.js THEMES)
setIcons(await loadIcons());
await Promise.all(DISTRICT.streets.flatMap((st) => st.shops || []).filter((sh) => sh.sign === 'theme')
  .map((sh) => fontFamily((typeof sh.theme === 'object' ? sh.theme : THEMES[sh.theme ?? (sh.kind === 'tea' ? 'moon' : 'icecream')])?.font, sh.name ?? DISTRICT.brands?.find((b) => b.key === sh.brand)?.name ?? '')));
const catalog = buildCatalog(atlas, DISTRICT.brands);progress(1,'招牌与字体已准备');

// the mirror for the wet street (drawn each frame, see renderReflection)
const reflRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
const reflection = { texture: reflRT.texture, matrix: new THREE.Matrix4() };

await say('立起玻璃高楼…');
// the cat sculpture (made in Blender: blender/build_cat_statue.py); if it won't load, one of simple shapes
const cat = await new GLTFLoader().loadAsync('assets/cat_statue.glb')
  .then((g) => g.scene.getObjectByProperty('isMesh', true).geometry, () => null);
// the district's own models (district.models: { name: 'assets/models/....glb' }), for holograms and sculptures
await say('载入松针、树皮与城市车辆…');
const details=await loadDetailedAssets();
const models = Object.fromEntries(await Promise.all(Object.entries(DISTRICT.models || {}).map(([name, url]) =>
  new GLTFLoader().loadAsync(url).then((g) => [name, g.scene], (e) => { console.warn(`model ${name} (${url}) did not load`, e); return [name, null]; }))));
models.fir=details.fir;progress(2,'松针、材质与车辆已载入');
const city = buildCity(DISTRICT, { atlas, catalog, reflection, statues: { cat }, models });
scene.add(city.group);progress(3,'街区与室内已建造');
await say('种树，摆上长椅…');
const trees = buildTrees(city.trees, PR);
scene.add(trees.group);
const people = buildPeople(city.people, { lanes: city.lanes });
scene.add(people.group);progress(4,'树木与行人已准备');
await say('点亮全息投影…');
const H0 = DISTRICT.holograms || {};
const holos = buildHolograms(atlas, { ...H0, signs: [...(H0.signs || []), ...city.holoSigns] });
scene.add(holos.group);
const sky = buildSky();
scene.add(sky);
const traffic = roadTraffic(details.car,city.streets);
scene.add(traffic.group);
const assetAmbient=new THREE.HemisphereLight(0xffe7b8,0x273445,2.0);scene.add(assetAmbient);
const assetKey=new THREE.DirectionalLight(0xffe4af,3.0);assetKey.position.set(-25,55,40);scene.add(assetKey);
const treeLight=new THREE.PointLight(0xffd18c,85,45,2);treeLight.position.set(44,6,-112);scene.add(treeLight);
scene.fog=new THREE.FogExp2(0x151c27,.00085);

// the rain shelters' boards: the time, the weather, the district's own place and metro line
const boards = makeInfoBoard(city.infoBoards, { place: DISTRICT.place, line: DISTRICT.metroLine });
if (boards.mesh) { boards.mesh.layers.set(LAYER.GLOW); scene.add(boards.mesh); }
await say('雪开始落了…');
const rain = buildRain();
scene.add(rain.group);progress(5,'天空与天气已准备');

window.__buildQA={city,scene,shared,details,traffic,people,sky,fireworks,shots:buildCinematicShots(city),streets:DISTRICT.streets,shops:DISTRICT.streets.flatMap(s=>s.shops||[])};
let renderer;
const graphicsAttempts=[];
for(const preference of ['high-performance','default','low-power']){
 try { renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:preference,failIfMajorPerformanceCaveat:false});break; }
 catch(error){graphicsAttempts.push({preference,message:error.message});}
}
window.__graphicsDiagnostics={attempts:graphicsAttempts,available:!!renderer};
if(!renderer) throw new Error('WebGL 2 unavailable in this browser');
renderer.setPixelRatio(PR);renderer.setSize(W(),H());renderer.toneMapping=THREE.NoToneMapping;renderer.setClearColor(shared.uFog.value);document.body.prepend(renderer.domElement);
const environmentRoom=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);const assetEnvironment=pmrem.fromScene(environmentRoom,.04);scene.environment=assetEnvironment.texture;environmentRoom.dispose();pmrem.dispose();progress(6,'图形环境已启动');

// ---------------------------------------------------------------- the moon's shadow map

// One square map, an orthographic view along the moonlight over the stretch of street just ahead of the viewer
// (its long side along the street nearest them), drawn again only when that stretch moves on (every 20 m) or
// another street is nearer, so the edges never crawl.
const SHADOW = 8192;
const shadowRT = new THREE.WebGLRenderTarget(SHADOW, SHADOW, { format: THREE.RedFormat });
shadowRT.depthTexture = new THREE.DepthTexture(SHADOW, SHADOW, THREE.UnsignedIntType);
shadowRT.depthTexture.minFilter = shadowRT.depthTexture.magFilter = THREE.NearestFilter;
const shadowCam = new THREE.OrthographicCamera(-80, 80, 430, -90, 1, 1600);
shadowCam.layers.set(LAYER.SOLID);
const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
shared.uShadowMap.value = shadowRT.depthTexture;
shared.uShadowTexel.value.set(1 / SHADOW, 1 / SHADOW);
let shadowAt = null;
const fwd = new THREE.Vector3(),shadowTarget=new THREE.Vector3();
function updateShadow() {
  camera.getWorldDirection(fwd);
  const p = camera.position, road = city.nearestRoads(p.x, p.z, 1)[0];
  // along the nearest road, the way one looks down it (or, with no road, the way one looks)
  let dx = road ? road.dx : fwd.x, dz = road ? road.dz : fwd.z;
  if (dx * fwd.x + dz * fwd.z < 0) { dx = -dx; dz = -dz; }
  const n = Math.hypot(dx, dz) || 1;
  dx /= n; dz /= n;
  const along = Math.round((p.x * dx + p.z * dz - 110) / 20) * 20, across = Math.round((p.x * -dz + p.z * dx) / 20) * 20;
  const key = `${road ? city.roads.indexOf(road) : -1}:${Math.sign(dx)}:${Math.sign(dz)}:${along}:${across}`;
  if (key === shadowAt) return;
  shadowAt = key;
  const target = shadowTarget.set(dx * along - dz * across, 0, dz * along + dx * across);
  shadowCam.position.copy(target).addScaledVector(shared.uKeyDir.value, 800);
  shadowCam.up.set(dx, 0, dz);
  shadowCam.lookAt(target);
  shadowCam.updateMatrixWorld();
  shared.uShadowMatrix.value.copy(BIAS).multiply(shadowCam.projectionMatrix).multiply(shadowCam.matrixWorldInverse);
  scene.overrideMaterial = depthOnly;
  renderer.setRenderTarget(shadowRT);
  renderer.clear();
  renderer.render(scene, shadowCam);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = null;
}

// ---------------------------------------------------------------- the mirror for the wet street

const reflCam = new THREE.PerspectiveCamera();
reflCam.layers.set(LAYER.SOLID);
reflCam.layers.enable(LAYER.GLOW);
const tmp = { f: new THREE.Vector3(), u: new THREE.Vector3(), t: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), plane: new THREE.Plane(), clip: new THREE.Vector4(), q: new THREE.Vector4() };
function renderReflection() {
  // the camera mirrored in the street (y = 0), looking up at the city from beneath it
  Object.assign(reflCam, { fov: camera.fov, aspect: camera.aspect, near: camera.near, far: camera.far });
  reflCam.updateProjectionMatrix();
  tmp.f.set(0, 0, -1).applyQuaternion(camera.quaternion);
  tmp.u.set(0, 1, 0).applyQuaternion(camera.quaternion);
  // (down in a sunken plaza, the mirror is its floor: the district may say, mirrorAt)
  const h = camera.position.y < -0.3 ? city.mirrorAt?.(camera.position) ?? 0 : 0;
  shared.uReflY.value = h;
  reflCam.position.set(camera.position.x, 2 * h - camera.position.y, camera.position.z);
  reflCam.up.set(tmp.u.x, -tmp.u.y, tmp.u.z);
  tmp.t.copy(camera.position).add(tmp.f);
  reflCam.lookAt(tmp.t.x, 2 * h - tmp.t.y, tmp.t.z);
  reflCam.updateMatrixWorld();
  // nothing below the street drawn in it: its near plane tilted onto the street (an oblique frustum, as
  // three.js's Reflector does it)
  if (camera.position.y > h + 0.02) {
    tmp.plane.set(tmp.up, -h).applyMatrix4(reflCam.matrixWorldInverse);
    const e = reflCam.projectionMatrix.elements, cp = tmp.clip.set(tmp.plane.normal.x, tmp.plane.normal.y, tmp.plane.normal.z, tmp.plane.constant);
    tmp.q.set((Math.sign(cp.x) + e[8]) / e[0], (Math.sign(cp.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    cp.multiplyScalar(2 / cp.dot(tmp.q));
    e[2] = cp.x; e[6] = cp.y; e[10] = cp.z + 1; e[14] = cp.w;
  }
  reflection.matrix.copy(BIAS).multiply(reflCam.projectionMatrix).multiply(reflCam.matrixWorldInverse);
  renderer.setRenderTarget(reflRT);
  renderer.clear();
  renderer.render(scene, reflCam);
  renderer.setRenderTarget(null);
}

// ---------------------------------------------------------------- choosing the lights near the viewer

// The shaders take the nearest lamps and emitters only; these are chosen each frame, those ahead of the
// viewer first (one ahead is seen, together with its pool of light, much further off than one behind).
const lampScores=city.lamps.map(item=>({item,score:0})), emitterScores=city.emitters.map(item=>({item,score:0})),pointScores=holos.lights.map(item=>({item,score:0}));
function pickLights() {
  camera.getWorldDirection(fwd);
  const p = camera.position;
  const score = (o, reach) => {
    const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
    const ahead = (dx * fwd.x + dz * fwd.z) / Math.max(d, 1e-3);
    return (d / Math.sqrt(reach)) * (ahead > -0.2 ? 1 : 1.8);
  };
  const lamps=lampScores;for(const r of lamps)r.score=score(r.item,20);lamps.sort((a,b)=>a.score-b.score);
  for (let i = 0; i < N_LAMP; i++) {
    const l = lamps[i]?.item;
    shared.uLamp.value[i].set(l ? l.x : 0, l ? l.y : 0, l ? l.z : 0, l ? l.power ?? 1.5 : 0);
  }
  const em=emitterScores;for(const r of em)r.score=score(r.item,r.item.reach);em.sort((a,b)=>a.score-b.score);
  for (let i = 0; i < N_BB; i++) {
    const e = em[i]?.item;
    shared.uBb.value[i].set(e ? e.x : 0, e ? e.y : 0, e ? e.z : 0, e ? e.power : 0);
    shared.uBbN.value[i].set(e ? e.nx : 0, e ? e.ny : 0, e ? e.nz : 1, e ? e.reach : 1);
    shared.uBbTint.value[i] = e ? e.tint : 0;
  }
  const pts=pointScores;for(const r of pts)r.score=(r.item.x-p.x)**2+(r.item.z-p.z)**2;pts.sort((a,b)=>a.score-b.score);
  for (let i = 0; i < N_PT; i++) {
    const h = pts[i]?.item;
    shared.uPt.value[i].set(h ? h.x : 0, h ? h.y : 0, h ? h.z : 0, h ? h.power : 0);
    shared.uPtR.value[i] = h ? h.reach : 1;
  }
}

// ---------------------------------------------------------------- post

const rt = new THREE.WebGLRenderTarget(W() * PR, H() * PR, { type: THREE.HalfFloatType, samples: 4 });
rt.depthTexture = new THREE.DepthTexture(W() * PR, H() * PR);
const composer = new EffectComposer(renderer, rt);
// Explicit targets already use device pixels. Reset logical dimensions before addPass
// so passes never allocate a second multiplication (3 × 3) at startup.
composer.setSize(W(), H());
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.42, 0.45, 1.0);
const bloomSetSize = bloom.setSize.bind(bloom);
bloom.setSize = (w, h) => bloomSetSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
// (indoors its faintest, widest spill cut off, so that the surfaces round a light keep their flat tones; uFloor:
// how faint is too faint, set each frame, see the loop)
{
  const m = bloom.compositeMaterial;
  m.uniforms.uFloor = { value: 0 };
  m.fragmentShader = 'uniform float uFloor;\n' + m.fragmentShader.replace(/\}\s*$/,
    '  gl_FragColor.rgb *= smoothstep(uFloor, uFloor * 2.0, max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)));\n}');
  m.needsUpdate = true;
}
composer.addPass(bloom);
// the bloom's glow not added over the frame by its own last pass, but in the finish, with the ink lines, the
// vignette and the grain, all in one pass (core/post.js)
{
  const quad = bloom.fsQuad, draw = quad.render.bind(quad);
  quad.render = (r) => { if (quad.material !== bloom.blendMaterial) draw(r); };
}
const finish = new FinishPass(camera), outline = finish;
finish.uniforms.tBloom.value = bloom.renderTargetsHorizontal[0].texture;
composer.addPass(finish);

function resize() {
  camera.aspect = W() / H();
  camera.updateProjectionMatrix();
  renderer.setSize(W(), H());
  composer.setSize(W(), H());
  reflRT.setSize(Math.round(W() * renderer.getPixelRatio() * reflectionScale), Math.round(H() * renderer.getPixelRatio() * reflectionScale));
  rain.resize(camera, H() * renderer.getPixelRatio());fireworks.resize(renderer.getPixelRatio(),H());
  finish.uniforms.uAspect.value = W() / H();
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- the tunable look (tuning.json)

const tuned = { rain, bloom, outline, finish, sky, renderer, catalog };
applyTuning(tuning, tuned);progress(7,'光影与反射已准备');

// the rain's roofs and raised ground (see core/rain.js): the raised ground is few and set once; the roofs and the
// roads nearest the viewer are chosen each frame
city.lifts.slice(0, 6).forEach((l, i) => {
  rain.uniforms.uLift.value[i].set(l.x0, l.x1, l.z0, l.z1);
  rain.uniforms.uLiftY.value[i] = l.y;
});
const coverScores=city.covers.map(item=>({item,x:(item.x0+item.x1)/2,z:(item.z0+item.z1)/2,score:0}));
function pickCovers() {
  const p=camera.position,near=coverScores;
  for(const r of near)r.score=(r.x-p.x)**2+(r.z-p.z)**2;
  near.sort((a,b)=>a.score-b.score);
  for (let i = 0; i < 6; i++) {
    const c = near[i]?.item;
    rain.uniforms.uCover.value[i].set(c ? c.x0 : 0, c ? c.x1 : 0, c ? c.z0 : 0, c ? c.z1 : 0);
    rain.uniforms.uCoverY.value[i] = c ? c.y : 0;
  }
  rain.setRoads(city.nearestRoads(p.x, p.z));
  camera.getWorldDirection(fwd);
  const n = Math.hypot(fwd.x, fwd.z) || 1;
  rain.uniforms.uFwd.value.set(fwd.x / n, fwd.z / n);
}

// ---------------------------------------------------------------- the viewer, and the controls


if (DISTRICT.music) sound.setTrack(DISTRICT.music.track ?? 'galaxy');
const walker = new Walker(camera, renderer.domElement, {
  colliders: city.colliders,
  floors: city.floors,
  sights: city.sights,
  route: city.route,
  baseAt: city.baseAt,
  bounds: city.bounds,
  onStep: (run) => sound.step(run),
  onModeChange: (mode) => { ui.mode.textContent = mode === 'auto' ? '沿着灯光，慢慢走' : '自由漫游'; },
});
walker.onModeChange('auto');
// the choices: how hard it rains, the sliders (kept in this browser, if it can be)
const STORE = `rain-city:${DISTRICT.name || 'city'}`;
const choice = { rain: 1,weather:'snow',ambience:.65 };
try { Object.assign(choice, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch { /* storage unavailable */ }
const keep = () => { try { localStorage.setItem(STORE, JSON.stringify(choice)); } catch { /* storage unavailable */ } };
function applyChoice() {
  rain.setLevel(choice.rain);
  sound.setWeather?.(choice.weather || 'snow',choice.rain);
  ui.rain.textContent = rain.name();
  ui.sound.style.opacity = sound.muted ? 0.4 : '';
  ui.sound.textContent = sound.muted ? '静音' : '声音';
}
function selectWeather(mode){
 choice.weather=mode;rain.setMode(mode);const t=weatherTuning(tuning,mode);applyTuning(t,tuned);
 sky.setWeather(mode);people.setWeather(mode);
 scene.fog.color.set(t.air.fog);scene.fog.density=t.air.density;assetAmbient.intensity=mode==='rain'?.85:2.0;assetKey.intensity=mode==='rain'?.8:3.0;treeLight.intensity=mode==='rain'?35:85;
 for(const m of ['snow','rain']){document.getElementById('weather-'+m).setAttribute('aria-pressed',String(m===mode));}
 applyChoice();keep();
}
for(const m of ['snow','rain'])document.getElementById('weather-'+m).addEventListener('click',()=>selectWeather(m));
selectWeather(choice.weather==='rain'?'rain':'snow');
// the sliders: how fast one walks (a walk's speed to half again a run's), how loud the music; kept with the rest
for (const [el, key, set] of [[ui.pace, 'pace', (v) => { walker.pace = v; }], [ui.music, 'music', (v) => sound.setMusicVolume(v)], [document.getElementById('ambience'), 'ambience', (v) => sound.setCityVolume(v)]]) {
  choice[key] = Number.isFinite(choice[key]) ? THREE.MathUtils.clamp(choice[key], 0, 1) : 0.5;
  el.value = choice[key];
  set(choice[key]);
  el.addEventListener('input', () => { choice[key] = +el.value; set(choice[key]); keep(); });
  el.addEventListener('change', () => el.blur());               // (the keys back to walking)
  el.addEventListener('keydown', (e) => e.stopPropagation());
}
document.getElementById('music-row').hidden = !DISTRICT.music;   // (no place for music: no slider for it)
const cycleRain = () => { choice.rain = (choice.rain + 1) % RAIN_LEVELS.length; keep(); applyChoice(); };
const toggleSound = () => { sound.toggle(); applyChoice(); };
ui.rain.addEventListener('click', cycleRain);
ui.sound.addEventListener('click', toggleSound);
addEventListener('keydown', (e) => {
  if (e.repeat || e.target instanceof HTMLInputElement) return;
  if (e.code === 'KeyR') cycleRain();
  if (e.code === 'KeyM') toggleSound();
});

camera.position.set(-2,3.6,45);camera.lookAt(0,18,-160);
const experience=setupExperience({camera,renderer,walker,city,sound,ui,fireworks,festival,onQuality:({ratio=renderRatio,reflection=reflectionScale,shadow=shadowRT.width,reflectionFPS:requestedReflectionFPS=reflectionFPS}={})=>{
 reflectionFPS=requestedReflectionFPS;lastReflection=-Infinity;
 renderRatio=ratio;reflectionScale=reflection;renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);
 if(shadow!==shadowRT.width){shadowRT.setSize(shadow,shadow);shared.uShadowTexel.value.set(1/shadow,1/shadow);shadowAt=null;}
 resize();return {width:Math.round(W()*ratio),height:Math.round(H()*ratio),ratio};
}});

progress(8,'电影镜头与声音已准备');

// ---------------------------------------------------------------- the loop

// what is drawn only from near enough (each lot within its reach; in the wet street's mirror, if less far, refl)
const lots = [...city.lots, ...trees.lots];
const viewer = { x: 0, z: 0 };
function showLots(refl) {
  for (const r of lots) {
    const near = Math.hypot(camera.position.x - r.x, camera.position.z - r.z) < (refl ? r.refl ?? r.reach : r.reach);
    for (const m of r.meshes) m.visible = near;
  }
  for (const m of city.underMeshes) m.visible = !refl;
}

let time = 0, last = performance.now();
function frame(now) {
  const actualDt=document.hidden?0:Math.min(.5,(now-last)/1000),dt=Math.min(.05,actualDt);
  last = now;
  time += dt;
  shared.uTime.value = time;

  if(!experience.update(actualDt)) walker.update(dt, []);
  viewer.x = camera.position.x; viewer.z = camera.position.z;
  holos.update(time);fireworks.update(experience.state.active&&experience.state.paused?0:dt,time,camera,renderRatio);
  traffic.update(time);
  details.fir.update(time*.25);
  // music, if the district has a place for it (district.music: { x, z, track }): softly all about, full near it
  if (DISTRICT.music) {
    const m = DISTRICT.music, d = Math.hypot(camera.position.x - m.x, camera.position.z - m.z);
    sound.setMusic((m.everywhere ?? 0.15) + (1 - (m.everywhere ?? 0.15)) * (1 - THREE.MathUtils.smoothstep(d, m.near ?? 20, m.far ?? 60)));
    musicBeat.value += (sound.musicLoudness() - musicBeat.value) * (1 - Math.exp(-dt * 10));
  }
  boards.update(time, rain.name());
  people.update(time, viewer);
  trees.update(time, viewer);
  sound.setListener(camera.position, camera.quaternion);
  pickCovers();
  // indoors (under a room's ceiling, or below the street but in a sunken plaza open to the sky: uHoles) the
  // bloom's faint spill is cut off, so the room's things keep their flat tones; and the rain's sound is muffled
  {
    const p = camera.position, open = city.holes.some((h) => h.open && h.contains(p.x, p.z));
    const room = (p.y < -1 && !open) || city.covers.some((c) => c.room && p.y < c.y && p.x > c.x0 && p.x < c.x1 && p.z > c.z0 && p.z < c.z1);
    sound.setIndoors(room);
    const u = bloom.compositeMaterial.uniforms.uFloor;
    u.value += ((room ? tuning.post.bloomFloor ?? 0.1 : 0) - u.value) * (1 - Math.exp(-dt * 4));
  }
  // the automatic doors: open as one comes near, closed (and in the way) otherwise; drawn only from near enough
  for (const d of city.doors) {
    const dist = Math.hypot(camera.position.x - d.x, camera.position.z - d.z);
    d.open += ((dist < 3.4 || experience.state.forcedDoor === d ? 1 : 0) - d.open) * (1 - Math.exp(-dt * 5));
    const e = d.open * d.open * (3 - 2 * d.open);
    for (const l of d.leaves) {
      l.mesh.visible = dist < 120;
      l.mesh.position.set(l.x + d.ax * l.dir * e * l.travel, l.mesh.position.y, l.z + d.az * l.dir * e * l.travel);
    }
    d.collider.y1 = d.open > 0.7 ? -100 : d.top;
  }
  sky.position.copy(camera.position);sky.update(renderer.getPixelRatio());

  updateShadow();
  pickLights();
  if(!reflectionFPS||now-lastReflection>=1000/reflectionFPS){
    showLots(true);renderReflection();lastReflection=now;
  }
  showLots(false);
  finish.uniforms.uTime.value = time;
  composer.render(dt);experience.afterRender();
  requestAnimationFrame(frame);
}

// for looking at the city from a given place (screenshots, checks): ?at=x,y,z&to=x,y,z puts the camera there, still;
// ?skip leaves out the way in
const params = new URLSearchParams(location.search);
const pose = { at: params.get('at')?.split(',').map(Number), to: params.get('to')?.split(',').map(Number) };
function lookFrom(at, to) {
  walker.update = () => {};
  camera.position.set(...at);
  camera.lookAt(...to);
}
if (pose.at?.length === 3 && pose.to?.length === 3) lookFrom(pose.at, pose.to);

await say('编译画面与光影…');
await renderer.compileAsync(scene,camera);
frame(performance.now());progress(9,'城市已准备 · 100%');
ui.intro.classList.add('ready');
window.__worldReady=true;
document.getElementById('enter-free').disabled=false;document.getElementById('enter-tour').disabled=false;
ui.status.textContent='第十二个圣诞夜，等你进入。';
document.getElementById('opening')?.contentWindow.postMessage({type:'city:ready'},location.origin);
if (params.has('skip') || pose.at) ui.intro.classList.add('gone');
// for poking at from the console
window.__city = { details,traffic,selectWeather,experience, city, camera, walker, shared, scene, renderer, composer, bloom, finish, tuning, atlas, catalog, renderReflection, showLots, people, trees, holos, traffic,
  apply: () => applyTuning(tuning, tuned),
  // the camera put at [x, y, z] looking at [x, y, z], the stroll stopped (as ?at= &to=)
  look: (at, to) => lookFrom(at, to),
  // the street's own level, or the floor, at (x, z): what one would stand on there
  groundAt: (x, z) => walker.groundAt(x, z) };
