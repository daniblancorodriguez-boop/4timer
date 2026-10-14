const assert=require('assert');const R=require('../www/js/run.js');
let n=0;function t(name,f){try{f();n++;console.log('ok',name)}catch(e){console.log('FAIL',name,e.message);process.exitCode=1}}
// synthetic track: straight north at 3 m/s, 1s fixes, 2500 m
function track(m,speed=3){const pts=[];const dlat=1/111195;for(let i=0;i*speed<=m;i++)pts.push({lat:40+i*speed*dlat,lon:-3,t:1e6+i*1000,acc:5});return pts}
t('tracker dist/splits',()=>{const tr=new R.Tracker();tr.begin(1e6);track(2500).forEach(p=>tr.add(p));
 assert(Math.abs(tr.dist-2500)<15,'dist '+tr.dist);assert.strictEqual(tr.splits.length,2);
 assert(Math.abs(tr.splits[0].sec-333)<3,'split '+tr.splits[0].sec);
 const s=R.summarize(tr,1e6+833000);assert(Math.abs(s.avgPace-333)<4);assert(s.splits.length===3);});
t('jump & accuracy filter',()=>{const tr=new R.Tracker();tr.begin(1e6);tr.add({lat:40,lon:-3,t:1e6,acc:5});
 assert.strictEqual(tr.add({lat:40,lon:-3,t:1001000,acc:80}),'acc');
 assert.strictEqual(tr.add({lat:40.01,lon:-3,t:1002000,acc:5}),'jump');});
t('gpx roundtrip',()=>{const tr=new R.Tracker();tr.begin(1e6);track(800).forEach(p=>tr.add(p));
 const s=R.summarize(tr,1e6+270000);const g=R.buildGPX({startT:Date.UTC(2025,0,1),name:'x',route:s.route,sec:s.sec});
 const p=R.parseFile('a.gpx',new TextEncoder().encode(g).buffer);assert(p&&p.points&&p.points.length>=2);const r=R.fromPoints(p.points,{});assert(Math.abs(r.distance-s.distance)<30,r.distance+' '+s.distance);});
t('engine time+dist',()=>{const st=R.flatten([{t:'step',kind:'time',value:60,level:1,note:'a'},{t:'repeat',rounds:2,steps:[{t:'step',kind:'dist',value:500,level:3}]}]);
 assert.strictEqual(st.length,3);const e=new R.Engine(st);e.update(30,0);assert.strictEqual(e.idx,0);e.update(61,0);assert.strictEqual(e.idx,1);
 e.update(100,600);assert.strictEqual(e.idx,2);e.update(150,1100);assert(e.done());});
t('program validate/import/export',()=>{const prog={name:'P',weeks:[{name:'S1',parts:[{name:'A',items:[{t:'step',kind:'time',value:300,level:1,note:'3/10'}]}]}]};
 const v=R.validateProgram(prog);assert(!v,v);
 const txt=R.exportProgram(R.sanitizeProgram(prog));const r=R.parseProgramText(txt);assert(r.program,JSON.stringify(r));
 assert(R.parseProgramText('{"x":1}').error);assert(R.parseProgramText('basura').error);});
t('bestEfforts',()=>{const tr=new R.Tracker();tr.begin(1e6);track(1500).forEach(p=>tr.add(p));const b=R.bestEfforts(tr.points,[1000]);assert(b[1000]&&Math.abs(b[1000]-333)<5,JSON.stringify(b));});
console.log(n,'passed');
