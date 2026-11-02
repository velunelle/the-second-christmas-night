export function weatherTuning(base,mode){
 const t=structuredClone(base);
 if(mode==='rain'){
  t.palette={deep:'#07121d',mid:'#344954',lit:'#b7c6d0',litTint:'#b4c6cf',shade2:'#1a2b39'};
  t.air={fog:'#080f18',haze:'#293b4c',density:.002,zenith:'#070e1a'};t.hue={shift:0,saturation:.62};t.moon.strength=.3;
  Object.assign(t.rain,{brightness:.9,litAlpha:.42,midAlpha:.32,darkAlpha:.25,speed:10.5,wind:.08,length:.95,lit:'#d0d9e0',mid:'#7798ac',dark:'#304350',reach:110});
  t.glass={reflect:.65,rooms:1.12};t.post.bloom=.22;t.post.vignette=.32;t.screens.bright=.72;t.screens.mid='#8296a4';
 }else{
  t.palette={deep:'#20242c',mid:'#958971',lit:'#fff0d1',litTint:'#ead1a0',shade2:'#4e4a43'};
  t.air={fog:'#151c27',haze:'#63564c',density:.00085,zenith:'#101827'};t.hue={shift:0,saturation:.84};t.moon.strength=.68;
  Object.assign(t.rain,{brightness:.95,litAlpha:.86,midAlpha:.5,darkAlpha:.18,speed:.68,wind:.23,length:1,lit:'#fff0d7',mid:'#d9d6d0',dark:'#79879b',reach:120});
  t.glass={reflect:.42,rooms:1.5};t.post.bloom=.2;t.post.vignette=.18;t.screens.bright=.78;t.screens.mid='#d2ac63';
 }
 t.post.grain=0;t.post.outline=.24;t.post.bloomRadius=.25;t.post.bloomThreshold=1.3;t.tones.soft=.045;
 return t;
}
