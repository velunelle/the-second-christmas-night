export const DEFAULT_CONTENT={title:'第十二个圣诞夜',english:'THE TWELFTH CHRISTMAS NIGHT',tagline:'在第十二声钟响里，与你相见。',poems:[
{text:'很多节日\n与我无关\n但与我们有关\n与想见你的心有关\n与我想要对你生命中\n一个平凡的红绿相间的日子\n做点什么的野心有关',credit:'《我们的树没有种在圣诞》'},
{text:'天上的星星\n我踮起脚也摘不下来\n我只能给你我所拥有的：\n能自由支配的全部时间\n用时间换回来的钱\n用钱买不到的那种\n刻着你名字的爱',credit:''},
{text:'这里刚下过一场雪\n仿佛人间的爱都落到低处',credit:'黄礼孩《窗下》'},
{text:'跑下山。圣诞树。\n粉刷新房子的墙。白葡萄酒。\n凌晨3点跳舞。香草奶糖。\n芥末豌豆。',credit:'马特·海格《活下去的理由》'},
{text:'走着走着天下起雪来，\n雪很好，\n我也很好。',credit:'海桑《走着走着天下起雪来》'},
{text:'圣诞节的前一周，\n雪累积的最厚的时候，\n也正是吟唱圣诞颂歌之时；\n我一想起那些夜晚，\n就会想到双脚踩过雪地的脆响\n与覆于其上的闪耀着的灯笼。',credit:'洛瑞·李《罗西与苹果酒》'}],labels:{}};
const STORE='twelfth-night-content-v1';export let content=structuredClone(DEFAULT_CONTENT);
try{const s=JSON.parse(localStorage.getItem(STORE)||'null');if(s){for(const k of ['title','english','tagline'])if(typeof s[k]==='string')content[k]=s[k];if(Array.isArray(s.poems))content.poems=DEFAULT_CONTENT.poems.map((p,i)=>({text:typeof s.poems[i]?.text==='string'?s.poems[i].text:p.text,credit:typeof s.poems[i]?.credit==='string'?s.poems[i].credit:p.credit}));if(s.labels&&typeof s.labels==='object')content.labels=s.labels;}}catch{}
export function T(v){const t=String(v);if(Object.hasOwn(content.labels,t))return String(content.labels[t]);const d={'雪落未眠城':content.title,'雪落未眠城 · 圣诞夜':content.title,'雪落未眠城 SNOWFALL NOCTURNE':content.title+' '+content.english,'SNOWFALL NOCTURNE':content.english,'CHRISTMAS NOCTURNE':content.english,'A CHRISTMAS NIGHT IN THE CITY':content.english,'今夜，灯为你而亮。':content.tagline,'一键电影漫游':'穿梭城市 · 电影漫游','高空掠影 · 圣诞广场 · 推门入室':'俯冲 · 飞越 · 环绕 · 十二声钟响'};return d[t]??t;}
export function saveContent(v){content=v;localStorage.setItem(STORE,JSON.stringify(v));dispatchEvent(new Event('city:content'));}
export function resetContent(){saveContent(structuredClone(DEFAULT_CONTENT));}
export function applyDistrictText(d){function visit(o){for(const [k,v] of Object.entries(o))if(typeof v==='string')o[k]=T(v);else if(v&&typeof v==='object')visit(v);}visit(d);d.name=content.title;d.place.cn=content.title;d.place.en=content.english;}
if(typeof CanvasRenderingContext2D!=='undefined'){const fn=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){return fn.call(this,T(t),...a);};}
