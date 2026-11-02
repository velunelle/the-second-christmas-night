import { christmasSquare, christmasGarlands, streetDetails } from './kit/christmas.js';
import { metro } from './kit/underground.js';
import { terrace } from './kit/terrace.js';
import { solarSystem } from './kit/sculptures.js';
export const DISTRICT = {
 name:'雪落未眠城', en:'CHRISTMAS · NOCTURNE', seed:261102,fill:false,
 streets:[
 {id:'winter',from:[0,100],to:[0,-550],road:7,walk:6,back:false,bridges:2,adWalls:0.025,traffic:false,shops:[
 {u:76,side:-1,width:14,kind:'bookshop',brand:'letters',sign:'led'},
 {u:98,side:1,width:14,kind:'tea',brand:'moon',sign:'theme',theme:'moon'},
 {u:123,side:-1,width:12,kind:'florist',brand:'flowers',sign:'polka'},
 {u:150,side:1,width:14,kind:'bakery',brand:'bread',sign:'dusk'},
 {u:183,side:-1,width:12,kind:'diner',brand:'late',sign:'fogged'}]},
 {id:'echo',from:[-230,-160],to:[270,-160],road:6,walk:6,back:false,bridges:1,adWalls:0.02,traffic:false,shops:[
 {u:330,side:1,width:14,kind:'dessert',brand:'dessert',sign:'cake-case'},
 {u:355,side:1,width:14,kind:'cafe',brand:'stay',sign:'cafe-cups',islands:true}]},
 {id:'return',from:[0,-370],to:[-250,-490],road:5,walk:5,back:false,bridges:0,adWalls:0,traffic:false}],
 route:[[-2,45],[-2,-156],[140,-156]],
 place:{cn:'雪落未眠城',en:'SNOWFALL NOCTURNE'},metroLine:{number:7,name:'冬夜线',toward:'雪原',last:'末班列车'},
 words:{vertical:['书信','月台','花店','未眠','冬夜'],single:['雪','夜','愿','灯','礼'],horizontal:['雪落未眠城 SNOWFALL NOCTURNE','雪原 SNOWFIELD','慢慢走 TAKE YOUR TIME','圣诞快乐 MERRY CHRISTMAS','冬夜站 WINTER STATION','末班列车 LAST TRAIN','欢迎 WELCOME','茶室 TEA ROOM','书店 BOOKS','花店 FLORIST','面包 BAKERY','咖啡 CAFÉ'],offices:['冬夜档案馆 WINTER ARCHIVE','月光大厦 MOONLIGHT']},
 brands:[
 {key:'letters',name:'圣诞来信',en:'UNSENT LETTERS',color:'#e4bd75',case:'still-life'},
 {key:'moon',name:'月台茶室',en:'MOONLIGHT TEA',color:'#94dcc8',case:'moon-river'},
 {key:'flowers',name:'迟开的花',en:'LATE BLOOM',color:'#ed9cad',case:'flower-field'},
 {key:'bread',name:'留一盏灯',en:'ONE LIGHT ON',color:'#e5c99e',case:'dusk-bakery'},
 {key:'late',name:'冬夜小馆',en:'WINTER TABLE',color:'#d5c5bc',case:'rain-window'},
 {key:'dessert',name:'雪白来信',en:'WHITE LETTER',color:'#deb9f3',case:'cake-rows'},
 {key:'stay',name:'片刻',en:'STAY A WHILE',color:'#c8c0d8',case:'pixel-cafe'}],
 build(w,kit){
 kit.place(kit.beside('winter',220,1,1),()=>christmasSquare(w));
 christmasGarlands(w,kit);
 streetDetails(w,kit);
 kit.place(kit.beside('winter',290,-1,1),()=>metro(w,{name:'冬夜站 WINTER STATION',signs:{gates:'末班列车 LAST TRAIN',welcome:'欢迎 WELCOME'},shops:[{kind:'florist',name:'花店 FLORIST'},{kind:'bakery',name:'面包 BAKERY'}]}));
 kit.place(kit.beside('echo',120,-1,1),()=>terrace(w,{width:30,depth:24,name:'snow-terrace'}));

 },
 holograms:{rings:[],globes:[],signs:[{x:-9.5,y:3.1,z:-80,text:'圣诞快乐 MERRY CHRISTMAS',rotY:Math.PI/2}]},
 music:{x:0,z:-80,track:'isle',everywhere:0.25,near:30,far:100}
};
