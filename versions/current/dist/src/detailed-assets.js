import * as THREE from 'three';
import {Tree} from '../vendor/ez-tree/tree.js';
import {TreePreset} from '../vendor/ez-tree/presets/index.js';
export async function loadDetailedAssets(){
 const loader=new THREE.TextureLoader();
 const [leaf,bark,normal,rough]=await Promise.all([
  loader.loadAsync('assets/ez-tree/pine.png'),loader.loadAsync('assets/ez-tree/bark-Color.jpg'),loader.loadAsync('assets/ez-tree/bark-NormalGL.jpg'),loader.loadAsync('assets/ez-tree/bark-Roughness.jpg')]);
 leaf.colorSpace=bark.colorSpace=THREE.SRGBColorSpace;for(const t of [leaf,bark,normal,rough])t.anisotropy=8;
 const fir=new Tree();fir.options.copy(structuredClone(TreePreset['Pine Large']));
 fir.options.seed=44166;fir.options.bark.maps={color:bark,normal,roughness:rough,ao:null};fir.options.leaves.map=leaf;fir.options.leaves.tint=0xa4ba9b;fir.options.leaves.roundedNormals=true;
 fir.generate();
 const treeBox=new THREE.Box3().setFromObject(fir);const height=treeBox.max.y-treeBox.min.y;fir.scale.setScalar(22/height);fir.position.y=-treeBox.min.y*fir.scale.y;
 return {fir,car:null,stats:{treeHeight:height,treeVertices:fir.vertexCount??null,vehicleMeshes:0}};
}
