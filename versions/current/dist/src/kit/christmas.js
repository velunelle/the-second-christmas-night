import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import { box } from './geometry.js';
const gold=[1.9,1.12,.34], red=[1.6,.16,.28], ice=[.8,1.5,1.8], green=[.15,.8,.52];
function star(w,x,y,z,r=1){
 const sh=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,rr=i%2?r*.42:r;const px=Math.cos(a)*rr,py=Math.sin(a)*rr;if(!i)sh.moveTo(px,py);else sh.lineTo(px,py);}sh.closePath();
 const g=new THREE.ExtrudeGeometry(sh,{depth:.14,bevelEnabled:false}).translate(x,y,z);w.glow(g,gold);
}
function present(w,x,z,size,i){
 w.glow(new RoundedBoxGeometry(size,size,size,4,.045).translate(x,.17+size/2,z),i%2?[.48,.19,.12]:[.19,.23,.16]);
 for(const direction of [-1,1]){const bow=new THREE.TorusGeometry(size*.2,.035,8,24).rotateX(Math.PI/2).rotateY(direction*.5).translate(x+direction*size*.15,.24+size,z);w.glow(bow,gold);}
 w.glow(box(x-.09,x+.09,.17,.2+size,z-size/2-.01,z+size/2+.01),gold);
 w.glow(box(x-size/2-.01,x+size/2+.01,size+.18,size+.21,z-.09,z+.09),gold);w.circle(x,z,size*.7);
}
export function christmasSquare(w){
 w.groundPiece('pavement',new THREE.PlaneGeometry(58,58).rotateX(-Math.PI/2).translate(0,.16,-29));
 w.floor(-29,29,-58,0,()=>.16);
 const x=0,z=-30;
 const fir=w.models.fir;
 if(!fir)throw new Error('Detailed pine model was not prepared');
 fir.position.z=-30;fir.position.y+=.17;w.addMesh(fir,0);
 fir.traverse(o=>{if(o.isMesh&&o.material?.name==='leaves')o.layers.set(2);});
 // Ornaments follow the crown, separate from the real branching structure.
 for(let k=0;k<390;k++){
  const h=2.4+19.2*k/390,a=k*2.39996323,r=(1-h/24)*7.8*(.83+.17*Math.sin(k*7));
  const xx=Math.cos(a)*r,zz=-30+Math.sin(a)*r;
  w.glow(new THREE.SphereGeometry(.065,8,6).translate(xx,h,zz),gold,k%17===0?1:0);
  if(k%6===0){const ball=new THREE.SphereGeometry(.18+(k%3)*.04,16,12).translate(xx,h-.3,zz);w.glow(ball,k%12? [1.25,.75,.22]:[.75,.12,.17]);}
 }
 // Fine golden ribbon, not a solid conical silhouette.
 for(let k=0;k<440;k++){const h=2+19*k/440,a=h*2.3,r=(1-h/24)*7.7;w.glow(new THREE.SphereGeometry(.045,6,4).translate(Math.cos(a)*r,h,-30+Math.sin(a)*r),[1.2,.8,.28]);}
 star(w,0,22.8,-30,1.15);w.circle(0,-30,7.2);w.lamp(0,15,-30,1.6);
 for(let i=0;i<14;i++){let a=i/14*Math.PI*2;present(w,Math.cos(a)*11,-30+Math.sin(a)*11,.65+(i%3)*.3,i);}
 for(let k=0;k<32;k++){let a=k/32*Math.PI*2;w.glow(new THREE.SphereGeometry(.1,6,4).translate(Math.cos(a)*20,1.1,-30+Math.sin(a)*20),gold);}
 // Lit market stalls around the square, leaving the entrance open.
 for(const side of [-1,1])for(let k=0;k<3;k++){
  const xx=side*22,zz=-13-k*15;w.props(box(xx-2.3,xx+2.3,.2,1.25,zz-2,zz+2),.58);
  for(const dx of [-2.1,2.1])for(const dz of [-1.8,1.8])w.props(box(xx+dx-.065,xx+dx+.065,.2,3.5,zz+dz-.065,zz+dz+.065),.52);
  w.props(box(xx-2.5,xx+2.5,1.25,1.38,zz-2.2,zz+2.2),.82);
  for(let sl=-2.1;sl<=2.1;sl+=.35)w.props(box(xx+sl-.018,xx+sl+.018,.25,1.22,zz+2,zz+2.025),.3);
  for(let shelf=1.8;shelf<=2.6;shelf+=.4)w.props(box(xx-2,xx+2,shelf,shelf+.055,zz-1.8,zz-1.2),.7);
  for(let q=0;q<9;q++){const gx=xx-1.6+(q%5)*.75,gz=zz-.1+Math.floor(q/5)*.65;w.props(new THREE.CylinderGeometry(.16,.12,.35,16).translate(gx,1.56,gz),.8);}

  w.glow(box(xx-2.6,xx+2.6,3.5,3.75,zz-2.4,zz+2.4),k%2?green:red);
  for(let q=-2;q<=2;q++)w.glow(new THREE.SphereGeometry(.12,6,4).translate(xx+q,3.4,zz+2.45),gold);
  w.circle(xx,zz,2.5);w.lamp(xx,3.1,zz,.6);
  w.person(xx,.17,zz-1.1,Math.PI,false);
  w.person(xx-.6,.17,zz+3.2,0,true);w.person(xx+.65,.17,zz+3.5,-.4,true);
 }
 // Small groups around the tree, clear of presents and market counters.
 for(let i=0;i<10;i++){const a=i/10*Math.PI*2,xx=Math.cos(a)*15.5,zz=-30+Math.sin(a)*15.5;w.person(xx,.17,zz,-a+Math.PI/2,true);w.person(xx+.85,.17,zz+.65,-a-Math.PI/2,true);}
 return {claim:[-30,30,-60,0]};
}
export function christmasGarlands(w,kit){
 for(const st of kit.streets){
  const length=Math.hypot(st.to[0]-st.from[0],st.to[1]-st.from[1]);
  for(let u=40;u<length-25;u+=62){
   kit.place(kit.on(st.id,u),()=>{
    const span=st.road+st.walk*.7;
    for(let k=0;k<=32;k++){const x=-span+2*span*k/32,y=11-2.6*(1-(x/span)**2);w.glow(new THREE.SphereGeometry(.09,6,4).translate(x,y,0),k%4===0?red:gold);}
    star(w,0,7.8,0,.58);
   });
  }
 }
}

export function streetDetails(w,kit){
 for(const st of kit.streets){const length=Math.hypot(st.to[0]-st.from[0],st.to[1]-st.from[1]);
  for(let u=10;u<length-10;u+=12){if(st.id==='winter'&&Math.abs(u-260)<15)continue;kit.place(kit.on(st.id,u),()=>w.props(box(-.065,.065,.012,.018,-2.3,2.3),.85));}
 }
 for(const z of [-146,-174])for(let x=-6;x<=6;x+=1.5)w.props(box(x-.45,x+.45,.013,.019,z-1.8,z+1.8),.88);
 for(const x of [-14,14])for(let z=-165;z<=-155;z+=1.4)w.props(box(x-1.8,x+1.8,.013,.019,z-.4,z+.4),.88);
}
