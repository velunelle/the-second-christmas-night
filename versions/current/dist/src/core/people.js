// Soft, camera-facing winter silhouettes. One instanced batch for the whole population.
import * as THREE from 'three';
import {LAYER,CURB} from './constants.js';
import {makeRandom} from './rand.js';
function silhouette(umbrella){
 const cv=document.createElement('canvas');cv.width=512;cv.height=1024;const g=cv.getContext('2d');
 const gradient=g.createLinearGradient(0,150,0,1024);gradient.addColorStop(0,'#e4e8f5');gradient.addColorStop(.5,'#aeb9ca');gradient.addColorStop(1,'#718393');g.fillStyle=gradient;g.shadowColor='#dce8ff';g.shadowBlur=11;
 g.beginPath();g.arc(256,294,46,0,Math.PI*2);g.fill();g.beginPath();g.moveTo(228,352);g.quadraticCurveTo(202,361,197,440);g.lineTo(170,719);g.quadraticCurveTo(251,752,341,719);g.lineTo(315,435);g.quadraticCurveTo(307,360,282,352);g.closePath();g.fill();
 g.lineCap='round';g.strokeStyle=gradient;g.lineWidth=32;for(const s of [-1,1]){g.beginPath();g.moveTo(256+s*52,388);g.quadraticCurveTo(256+s*101,502,256+s*91,620);g.stroke();g.lineWidth=33;g.beginPath();g.moveTo(256+s*28,713);g.lineTo(256+s*35,991);g.stroke();}
 if(umbrella){g.shadowBlur=7;g.beginPath();g.moveTo(29,213);g.quadraticCurveTo(256,-27,483,213);g.quadraticCurveTo(431,197,377,218);g.quadraticCurveTo(319,198,256,220);g.quadraticCurveTo(196,198,136,218);g.quadraticCurveTo(81,197,29,213);g.fill();g.lineWidth=5;g.beginPath();g.moveTo(270,187);g.lineTo(270,547);g.stroke();}
 const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
export function buildPeople(statics,{lanes=[],perLane,layer=LAYER.GLOW}={}){
 const R=makeRandom(41),walkers=[];
 for(const lane of lanes)for(let i=0,n=perLane??Math.ceil(lane.len/14);i<n;i++)walkers.push({lane,across:R.range(lane.a0,lane.a1),dir:R.chance(.5)?1:-1,speed:R.range(.8,1.4),off:R.range(0,lane.len),scale:R.range(.88,1.07),phase:R.range(0,6.28)});
 const standing=statics.filter((p,i)=>Math.hypot(p.x-44,p.z+120)<25||i%3===0),group=new THREE.Group();group.name='winter-silhouettes';
 const mat=new THREE.ShaderMaterial({uniforms:{uSnow:{value:silhouette(false)},uRain:{value:silhouette(true)},uWet:{value:0},uTime:{value:0}},transparent:true,depthWrite:false,depthTest:true,
 vertexShader:`varying vec2 vUv;varying float vDistance;varying float vSeed;void main(){vUv=uv;vec4 anchor=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);float s=length(instanceMatrix[0].xyz);vec3 right=normalize(vec3(viewMatrix[0][0],0.,viewMatrix[2][0]));vec3 p=anchor.xyz+right*position.x*s+vec3(0.,position.y*s,0.);vDistance=length(cameraPosition-anchor.xyz);vSeed=anchor.x+anchor.z;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 fragmentShader:`uniform sampler2D uSnow,uRain;uniform float uWet,uTime;varying vec2 vUv;varying float vDistance,vSeed;void main(){vec4 c=mix(texture2D(uSnow,vUv),texture2D(uRain,vUv),uWet);float a=c.a*.38*(1.-smoothstep(95.,165.,vDistance))*(.88+.12*sin(uTime*.7+vSeed));if(a<.008)discard;gl_FragColor=vec4(c.rgb,a);}`});
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.3,2.25).translate(0,1.125,0),mat,Math.max(1,walkers.length+standing.length));mesh.name='pedestrian-shadows';mesh.layers.set(layer);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(mesh);
 const matrix=new THREE.Matrix4(),stats={walkers:walkers.length,stationary:standing.length,batches:1,visible:0};
 const place=(n,x,y,z,s)=>{matrix.makeScale(s,s,s).setPosition(x,y,z);mesh.setMatrixAt(n,matrix);};
 return {group,walkers,stats,setWeather(mode){mat.uniforms.uWet.value=mode==='rain'?1:0;},update(t,viewer){let n=0;mat.uniforms.uTime.value=t;
  for(const w of walkers){const L=w.lane,u=((w.off+t*w.speed*w.dir)%L.len+L.len)%L.len,x=L.x+L.dx*u+L.nx*w.across,z=L.z+L.dz*u+L.nz*w.across;if((x-viewer.x)**2+(z-viewer.z)**2>165**2)continue;place(n++,x,CURB+Math.sin(t*w.speed*6+w.phase)*.018,z,w.scale);}
  for(const p of standing)if((p.x-viewer.x)**2+(p.z-viewer.z)**2<=165**2)place(n++,p.x,p.y,p.z,1);
  mesh.count=n;mesh.instanceMatrix.needsUpdate=true;stats.visible=n;
 }};
}
