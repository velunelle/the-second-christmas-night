import * as THREE from 'three';
// Arc-length sampling and tangent look-ahead follow the technique in Three.js's
// MIT webgl_geometry_extrude_splines example. Paths and shot design are city-specific.
export function buildCinematicShots(city){
 const paths=[
 {duration:12,path:[[0,220,110],[0,140,-30],[0,78,-190],[0,88,-320]],fov:82,bank:.03},
 {duration:9,path:[[-135,4.7,-160],[-50,4.5,-160],[0,5,-160],[65,4.5,-160],[145,6,-160]],fov:84,bank:-.035},
 {duration:8,path:[[0,5,-340],[0,4.5,-230],[0,5,-130],[0,5,-50]],fov:86,bank:.025},
 {duration:7,path:Array.from({length:25},(_,i)=>{const a=i/24*Math.PI-Math.PI;return [44+Math.cos(a)*17,8+Math.sin(a)*2,-120+Math.sin(a)*17];}),subject:[44,11,-120],fov:76,bank:.08},
 {duration:6,path:[[0,7,-200],[0,45,-200],[0,115,-200],[0,225,-200]],subject:[44,15,-120],fov:78,bank:-.06},
 {duration:16,path:Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*.75-Math.PI/2;return [Math.cos(a)*150,360+Math.sin(a*2)*8,-240+Math.sin(a)*150];}),subject:[0,225,-245],fov:74,bank:.06}
 ];
 const door=city?.doors?.filter(d=>d.x<0&&d.z>0).sort((a,b)=>Math.abs(a.z-24)-Math.abs(b.z-24))[0];
 if(door){const sign=Math.sign(door.x)||-1;paths[2].roomDoor=door;paths[2].roomCurve=new THREE.CatmullRomCurve3([[door.x-sign*9,2,door.z],[door.x-sign*2,1.9,door.z],[door.x+sign*4.2,1.9,door.z]].map(p=>new THREE.Vector3(...p)));paths[2].roomLook=new THREE.Vector3(door.x+sign*8,2,door.z);}
 return paths.map((s,i)=>{const curve=new THREE.CatmullRomCurve3(s.path.map(p=>new THREE.Vector3(...p)),false,'centripetal');curve.arcLengthDivisions=2000;curve.updateArcLengths();return {...s,index:i,curve,length:curve.getLength(),speed:curve.getLength()/s.duration};});
}
const position=new THREE.Vector3(),ahead=new THREE.Vector3(),tangent=new THREE.Vector3(),roll=new THREE.Quaternion(),axis=new THREE.Vector3(0,0,1);
export function sampleShot(camera,shot,u){
 const inside=shot.roomCurve&&u>.65,curve=inside?shot.roomCurve:shot.curve,localU=inside?(u-.65)/.35:shot.roomCurve?u/.65:u;
 curve.getPointAt(localU,position);camera.position.copy(position);
 if(inside)ahead.copy(shot.roomLook);else if(shot.subject)ahead.fromArray(shot.subject);else{curve.getTangentAt(Math.min(.99999,localU),tangent);ahead.copy(position).addScaledVector(tangent,35);}
 camera.up.set(0,1,0);camera.lookAt(ahead);roll.setFromAxisAngle(axis,shot.bank*Math.sin(Math.PI*u));camera.quaternion.multiply(roll);
 camera.fov=shot.fov+Math.sin(Math.PI*u)*4;camera.updateProjectionMatrix();return camera;
}
