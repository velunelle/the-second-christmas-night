// A sky dome with layered drifting clouds, a separate shaded moon sphere and batched stars.
// Clouds remain an atmospheric shader, not a heavy volumetric simulation.
import * as THREE from 'three';
import {shared,DEFINES,COMMON} from './toon.js';
import {LAYER} from './constants.js';
import {makeRandom} from './rand.js';
export function buildSky(){
 const weather={value:0};
 const cloudFunctions=/*glsl*/`
 float clouds(vec3 d){
  vec2 q=d.xz/max(d.y+.12,.16)*1.6+vec2(uTime*.006,uTime*.009);
  float a=vnoise(q)*.56+vnoise(q*2.1+4.0)*.28+vnoise(q*4.4-uTime*.012)*.16;
  vec2 q2=d.xz/max(d.y+.3,.22)*3.0+vec2(-uTime*.009,uTime*.004);
  return mix(a,a*.7+vnoise(q2)*.3,uStorm);
 }
 float cover(vec3 d){return smoothstep(mix(.52,.27,uStorm),mix(.72,.56,uStorm),clouds(d));}
 `;
 const mat=new THREE.ShaderMaterial({defines:{...DEFINES},uniforms:{...shared,uZenith:{value:new THREE.Color('#101827')},uStorm:weather},side:THREE.BackSide,depthWrite:false,
 vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);gl_Position.z=gl_Position.w*.99999;}`,
 fragmentShader:/*glsl*/`${COMMON}
 uniform vec3 uZenith;uniform float uStorm;varying vec3 vDir;${cloudFunctions}
 void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);float m=max(dot(d,uKeyDir),0.);
  vec3 c=mix(uFog,uZenith,smoothstep(0.,.6,h));float n=clouds(d),cl=smoothstep(mix(.52,.27,uStorm),mix(.72,.56,uStorm),n);
  vec3 low=mix(uFog,uMid,.19),high=mix(uZenith,uHaze,.32+.25*pow(m,8.));
  c=mix(c,mix(low,high,smoothstep(.44,.78,n)),cl*mix(.68,.97,uStorm));
  c+=uHaze*pow(m,35.)*.13*(1.-cl*.8);
  // The warmer city glow stays near the horizon, with a cool, dark zenith.
  c+=vec3(.075,.048,.022)*pow(1.-h,9.)*(1.-uStorm*.8);
  gl_FragColor=vec4(c,1.);
 }`});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(2200,48,24),mat);sky.name='atmosphere-dome';sky.layers.set(LAYER.GLOW);sky.frustumCulled=false;sky.renderOrder=-3;
 const moonMaterial=new THREE.ShaderMaterial({defines:{...DEFINES},uniforms:{...shared,uStorm:weather},depthWrite:false,
 vertexShader:`varying vec3 vNormal;varying vec3 vLocal;varying vec3 vDir;void main(){vNormal=normal;vLocal=position;vec4 world=modelMatrix*vec4(position,1.);vDir=world.xyz-cameraPosition;gl_Position=projectionMatrix*viewMatrix*world;}`,
 fragmentShader:/*glsl*/`${COMMON}
 uniform float uStorm;varying vec3 vNormal;varying vec3 vLocal;varying vec3 vDir;${cloudFunctions}
 void main(){vec3 n=normalize(vNormal),p=normalize(vLocal);float grains=vnoise(p.xy*31.)*.14+vnoise(p.xz*67.)*.065;
  float maria=smoothstep(.35,.64,vnoise(p.xy*6.1+2.3)*.7+vnoise(p.yz*12.2)*.3);
  float phase=smoothstep(-.45,.35,dot(n,normalize(vec3(-.6,.35,1.))));
  float rim=pow(1.-abs(n.z),4.);vec3 color=vec3(.92,.88,.75)*(.52+phase*.45-maria*.24+grains-rim*.12);
  float alpha=(1.-cover(normalize(vDir))*.93)*(1.-uStorm*.86);
  gl_FragColor=vec4(color*.95,alpha);
 }`,transparent:true});
 const moon=new THREE.Mesh(new THREE.SphereGeometry(20,64,40),moonMaterial);moon.name='moon-surface';moon.layers.set(LAYER.GLOW);moon.renderOrder=-1;moon.frustumCulled=false;sky.add(moon);
 const R=makeRandom(4401),positions=[],sizes=[],brightness=[];
 for(let i=0;i<1800;i++){const h=R.range(.12,1),a=R.range(0,Math.PI*2),r=Math.sqrt(1-h*h);positions.push(Math.cos(a)*r*2000,h*2000,Math.sin(a)*r*2000);sizes.push(R.range(.65,1.8));brightness.push(R.range(.16,.75));}
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geom.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1));geom.setAttribute('aBright',new THREE.Float32BufferAttribute(brightness,1));
 const starsMat=new THREE.ShaderMaterial({defines:{...DEFINES},uniforms:{...shared,uStorm:weather,uRatio:{value:3}},transparent:true,depthWrite:false,
 vertexShader:`attribute float aSize;attribute float aBright;uniform float uRatio;varying float vBright;varying vec3 vDir;void main(){vDir=position;vBright=aBright;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);gl_PointSize=aSize*uRatio;}`,
 fragmentShader:/*glsl*/`${COMMON}
 uniform float uStorm;varying float vBright;varying vec3 vDir;${cloudFunctions}
 void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;vec3 d=normalize(vDir);float alpha=(1.-smoothstep(.07,.5,r))*vBright*(1.-cover(d))*(1.-uStorm)*smoothstep(.1,.45,d.y);gl_FragColor=vec4(vec3(.78,.84,.93),alpha);}`});
 const stars=new THREE.Points(geom,starsMat);stars.name='star-field';stars.layers.set(LAYER.GLOW);stars.renderOrder=-2;stars.frustumCulled=false;sky.add(stars);
 sky.setWeather=mode=>{weather.value=mode==='rain'?1:0;};
 const normal=new THREE.Vector3(0,0,1);
 sky.update=ratio=>{moon.position.copy(shared.uKeyDir.value).multiplyScalar(1600);moon.quaternion.setFromUnitVectors(normal,shared.uKeyDir.value);starsMat.uniforms.uRatio.value=ratio;};
 sky.update(3);return sky;
}
