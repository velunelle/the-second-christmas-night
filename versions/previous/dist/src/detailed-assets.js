import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Tree} from '../vendor/ez-tree/tree.js';
import {TreePreset} from '../vendor/ez-tree/presets/index.js';
import {LAYER} from './core/constants.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export async function loadDetailedAssets(){
 const loader=new THREE.TextureLoader();
 const [leaf,bark,normal,rough,vehicle]=await Promise.all([
  loader.loadAsync('assets/ez-tree/pine.png'),loader.loadAsync('assets/ez-tree/bark-Color.jpg'),loader.loadAsync('assets/ez-tree/bark-NormalGL.jpg'),loader.loadAsync('assets/ez-tree/bark-Roughness.jpg'),new GLTFLoader().loadAsync('assets/models/city-car.glb')]);
 leaf.colorSpace=bark.colorSpace=THREE.SRGBColorSpace;for(const t of [leaf,bark,normal,rough])t.anisotropy=8;
 const fir=new Tree();fir.options.copy(structuredClone(TreePreset['Pine Large']));
 fir.options.seed=44166;fir.options.bark.maps={color:bark,normal,roughness:rough,ao:null};fir.options.leaves.map=leaf;fir.options.leaves.tint=0xa4ba9b;fir.options.leaves.roundedNormals=true;
 fir.generate();
 const treeBox=new THREE.Box3().setFromObject(fir);const height=treeBox.max.y-treeBox.min.y;fir.scale.setScalar(22/height);fir.position.y=-treeBox.min.y*fir.scale.y;
 const car=vehicle.scene;let box=new THREE.Box3().setFromObject(car),size=box.getSize(new THREE.Vector3());
 if(size.x>size.z)car.rotation.y=Math.PI/2;
 box=new THREE.Box3().setFromObject(car);size=box.getSize(new THREE.Vector3());const k=4.8/size.z;car.scale.setScalar(k);box=new THREE.Box3().setFromObject(car);const center=box.getCenter(new THREE.Vector3());car.position.set(-center.x,-box.min.y,-center.z);
 const materialCache=new WeakMap();
 car.traverse(o=>{if(!o.isMesh)return;const convert=m=>{if(materialCache.has(m))return materialCache.get(m);const glass=/glass/i.test(m.name);const converted=new THREE.MeshStandardMaterial({name:m.name,color:m.color,map:m.map,normalMap:m.normalMap,roughnessMap:m.roughnessMap,metalnessMap:m.metalnessMap,aoMap:m.aoMap,emissive:m.emissive,emissiveMap:m.emissiveMap,emissiveIntensity:Math.min(m.emissiveIntensity||1,1.3),roughness:glass?.12:Math.max(.23,m.roughness||.3),metalness:glass?0:Math.min(.7,m.metalness||0),transparent:glass,opacity:glass?.38:1,depthWrite:!glass,side:m.side});materialCache.set(m,converted);return converted;};o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);});
 return {fir,car,stats:{treeHeight:height,treeVertices:fir.vertexCount??null,vehicleMeshes:car.getObjectsByProperty('isMesh',true).length}};
}
export function roadTraffic(model,streets){
 const group=new THREE.Group(),cars=[];
 for(const st of streets.filter(s=>s.id==='winter'||s.id==='echo'))for(let i=0;i<4;i++)cars.push({st,dir:i%2?1:-1,phase:i*.223+st.index*.07,speed:5.5+i*.7,matrix:new THREE.Matrix4()});
 const parked=[[5.4,15],[-5.4,-55],[5.4,-280]],count=cars.length+parked.length;
 // Bake component transforms once, then batch by shared material and vertex layout.
 // Every original triangle and texture is retained; cars no longer need one draw per GLB node.
 model.updateMatrixWorld(true);const components=[],batches=new Map();let originalParts=0;
 model.traverse(o=>{if(!o.isMesh)return;originalParts++;
  const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);
  const layout=Object.entries(geometry.attributes).map(([k,a])=>k+':'+a.itemSize+':'+a.normalized).sort().join(',');
  const materialKey=Array.isArray(o.material)?o.material.map(m=>m.uuid).join(','):o.material.uuid;
  const key=materialKey+'|'+layout+'|'+!!geometry.index;
  if(!batches.has(key))batches.set(key,{material:o.material,geometries:[]});batches.get(key).geometries.push(geometry);
 });
 for(const {material,geometries} of batches.values()){
  const merged=geometries.length===1?geometries[0]:mergeGeometries(geometries,Array.isArray(material));
  for(const geometry of merged?[merged]:geometries){
   const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.frustumCulled=false;
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.layers.set(LAYER.GLOW);group.add(mesh);components.push({mesh});
  }
  if(merged&&geometries.length>1)geometries.forEach(g=>g.dispose());
 }
 const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1),up=new THREE.Vector3(0,1,0),mat=new THREE.Matrix4();
 const parkedMatrices=parked.map(([x,z])=>new THREE.Matrix4().compose(new THREE.Vector3(x,0,z),new THREE.Quaternion().setFromAxisAngle(up,x>0?Math.PI:0),scale));
 return {group,cars,drawParts:components.length,originalParts,update(t){
  for(const c of cars){const {st,dir}=c,u=((c.phase*st.len+t*c.speed)%(st.len-25))+12,along=dir>0?u:st.len-u,across=dir*2.8;
   position.set(st.from[0]+st.dx*along+st.nx*across,0,st.from[1]+st.dz*along+st.nz*across);rotation.setFromAxisAngle(up,Math.atan2(-st.dx*dir,-st.dz*dir));c.matrix.compose(position,rotation,scale);
  }
  components.forEach(({mesh})=>{cars.forEach((c,i)=>mesh.setMatrixAt(i,c.matrix));if(!mesh.userData.parkedReady){parkedMatrices.forEach((m,i)=>mesh.setMatrixAt(cars.length+i,m));mesh.userData.parkedReady=true;}mesh.instanceMatrix.needsUpdate=true;});
 }};
}
