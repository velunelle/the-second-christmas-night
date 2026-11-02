import * as THREE from 'three';
import {buildRain as makeRain,RAIN_LEVELS as rainLevels} from './rain.js';
import {buildRain as makeSnow,RAIN_LEVELS as snowLevels} from './snow.js';
export const RAIN_LEVELS=snowLevels;
export function buildRain(){
 const rain=makeRain(),snow=makeSnow(),group=new THREE.Group();group.add(rain.group,snow.group);
 // Both weather volumes receive the same shelter and ground data.
 for(const key of ['uCover','uCoverY','uLift','uLiftY','uFwd'])rain.uniforms[key].value=snow.uniforms[key].value;
 let mode='snow',level=1;rain.group.visible=false;
 return {group,get uniforms(){return (mode==='rain'?rain:snow).uniforms;},get mode(){return mode;},get level(){return level;},name(){return mode==='rain'?rainLevels[0].name:snowLevels[level].name;},
  setMode(m){mode=m;rain.group.visible=m==='rain';snow.group.visible=m==='snow';},
  setLevel(i){level=i;rain.setLevel(i);snow.setLevel(i);},
  setRoads(roads){rain.setRoads(roads);snow.setRoads(roads);},resize(camera,h){rain.resize(camera,h);snow.resize(camera,h);}
 };
}
