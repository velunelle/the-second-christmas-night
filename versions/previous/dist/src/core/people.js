// Street population: stable world routes, companions, winter coats and articulated steps.
// Bodies, legs, scarves and umbrellas are instanced; density does not multiply draw calls.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {propsMaterial,glowMaterial} from './toon.js';
import {LAYER,CURB} from './constants.js';
import {makeRandom} from './rand.js';
import {canopyGeometry,rimGeometry} from './umbrella.js';
const tagged=(g,a)=>{g.setAttribute('aAlbedo',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(a),1));return g;};
function bodyGeometry(){return mergeGeometries([
 tagged(new THREE.CylinderGeometry(.18,.25,.73,14).translate(0,1.08,0),.65),
 tagged(new THREE.SphereGeometry(.125,16,12).scale(.9,1.12,1).translate(0,1.63,0),.88),
 tagged(new THREE.SphereGeometry(.139,16,10,0,Math.PI*2,0,Math.PI*.52).translate(0,1.67,0),.48),
 ...[-1,1].map(s=>tagged(new THREE.CapsuleGeometry(.065,.47,4,10).rotateZ(s*.12).translate(s*.25,1.06,0),.56)),
 tagged(new THREE.CylinderGeometry(.077,.077,.11,10).translate(0,1.49,0),.85)
]);}
function legGeometry(){return mergeGeometries([
 tagged(new THREE.CapsuleGeometry(.066,.54,4,10).translate(0,-.32,0),.35),
 tagged(new THREE.BoxGeometry(.145,.14,.25).translate(0,-.68,-.045),.25)
]);}
export function buildPeople(statics,{lanes=[],perLane,layer=LAYER.GLOW}={}){
 const R=makeRandom(41),walkers=[];
 for(const lane of lanes){const count=perLane??Math.ceil(lane.len/5.5);let previous;
  for(let i=0;i<count;i++){
   const companion=i%4===1&&previous;
   const w={lane,across:companion?THREE.MathUtils.clamp(previous.across+.65,lane.a0,lane.a1):R.range(lane.a0,lane.a1),
    dir:companion?previous.dir:(R.chance(.5)?-1:1),speed:companion?previous.speed:R.range(.8,1.5),
    off:companion?previous.off+.25:R.range(0,lane.len),phase:R.range(0,10),scale:R.chance(.09)?.74:R.range(.94,1.06),umbrella:R.chance(.38)};
   walkers.push(w);previous=w;
  }
 }
 const capacity=Math.max(1,walkers.length+statics.length),group=new THREE.Group();group.name='street-population';
 const batch=(name,g,mat)=>{const m=new THREE.InstancedMesh(g,mat,capacity);m.name=name;m.count=0;m.layers.set(layer);m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(m);return m;};
 const bodies=batch('winter-coats',bodyGeometry(),propsMaterial());
 const left=batch('left-steps',legGeometry(),propsMaterial()),right=batch('right-steps',legGeometry(),propsMaterial());
 const scarfGeometry=new THREE.TorusGeometry(.14,.045,8,18).rotateX(Math.PI/2).translate(0,1.49,0);
 const n=scarfGeometry.attributes.position.count;scarfGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(n*3).fill(1),3));scarfGeometry.setAttribute('aBlink',new THREE.Float32BufferAttribute(new Float32Array(n),1));
 const scarves=batch('winter-scarves',scarfGeometry,glowMaterial());
 const umbrella=mergeGeometries([tagged(canopyGeometry(.62,.32).translate(.05,1.98,-.05),.7),tagged(new THREE.CylinderGeometry(.012,.012,1.0,6).translate(.12,1.66,-.08),.45)]);
 const umbrellas=batch('umbrellas',umbrella,propsMaterial());
 const rim=rimGeometry(.62,.32,.009).translate(.05,1.98,-.05),nr=rim.attributes.position.count;
 rim.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(nr*3).fill(1),3));rim.setAttribute('aBlink',new THREE.Float32BufferAttribute(new Float32Array(nr),1));
 const rims=batch('umbrella-rims',rim,glowMaterial());
 const accents=[[.65,.32,.14],[.24,.42,.37],[.58,.24,.25],[.7,.61,.42]],color=new THREE.Color();
 for(let i=0;i<capacity;i++){scarves.setColorAt(i,color.fromArray(accents[i%4]));rims.setColorAt(i,color.setRGB(.5,.39,.24));}
 const matrix=new THREE.Matrix4(),legMatrix=new THREE.Matrix4(),local=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),scale=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 let weather='snow',nb=0,nu=0;
 const place=(x,y,z,heading,size,step,umb)=>{
  pos.set(x,y,z);q.setFromAxisAngle(up,heading);scale.setScalar(size);matrix.compose(pos,q,scale);
  bodies.setMatrixAt(nb,matrix);scarves.setMatrixAt(nb,matrix);
  for(const [mesh,side] of [[left,-1],[right,1]]){local.makeRotationX(Math.sin(step)*.28*side);local.setPosition(side*.095,.78,0);legMatrix.multiplyMatrices(matrix,local);mesh.setMatrixAt(nb,legMatrix);}
  if(umb){umbrellas.setMatrixAt(nu,matrix);rims.setMatrixAt(nu,matrix);nu++;}nb++;
 };
 return {group,walkers,stats:{walkers:walkers.length,stationary:statics.length,batches:group.children.length,visible:0},setWeather(mode){weather=mode;},
 update(t,viewer){
  nb=nu=0;
  for(const w of walkers){const L=w.lane,along=((w.off+t*w.speed*w.dir)%L.len+L.len)%L.len;
   const x=L.x+L.dx*along+L.nx*w.across,z=L.z+L.dz*along+L.nz*w.across;
   if((x-viewer.x)**2+(z-viewer.z)**2>260**2)continue;
   const step=t*w.speed*7+w.phase;
   place(x,CURB+Math.abs(Math.sin(step))*.018,z,Math.atan2(-L.dx*w.dir,-L.dz*w.dir),w.scale,step,weather==='rain'||w.umbrella);
  }
  for(let i=0;i<statics.length;i++){const p=statics[i];if((p.x-viewer.x)**2+(p.z-viewer.z)**2>260**2)continue;
   place(p.x,p.y,p.z,p.rot+Math.sin(t*.35+i)*.025,1,0,p.umbrella&&(weather==='rain'||i%3===0));
  }
  for(const m of [bodies,left,right,scarves])m.count=nb;
  umbrellas.count=rims.count=nu;
  for(const m of group.children)m.instanceMatrix.needsUpdate=true;
  this.stats.visible=nb;
 }};
}
