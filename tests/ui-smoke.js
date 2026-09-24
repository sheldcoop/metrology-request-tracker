/**
 * tests/ui-smoke.js - dev only, no dependencies:  node tests/ui-smoke.js [chart]
 *
 * Runs js/ui/*.js against a tiny fake DOM (copied from ABF Tracker), builds
 * every component in every state, clicks every button, changes every input
 * and opens every overlay. When js/ui-kit.js exists it runs the kit too.
 * Exits 1 on any error. `chart` adds a fake Chart.js to exercise the
 * chart wrapper.
 */
const vm=require('vm'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
let timers=[],rafs=[];
class Node_{constructor(){this.childNodes=[];this.parentNode=null;this.listeners={}}
 get children(){return this.childNodes.filter(n=>n.nodeType===1)}
 get firstChild(){return this.childNodes[0]||null} get lastChild(){return this.childNodes[this.childNodes.length-1]||null}
 appendChild(n){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;this.childNodes.push(n);return n}
 removeChild(n){const i=this.childNodes.indexOf(n);if(i<0)throw new Error('removeChild: not a child');this.childNodes.splice(i,1);n.parentNode=null;return n}
 contains(n){while(n){if(n===this)return true;n=n.parentNode}return false}
 get isConnected(){let n=this;while(n.parentNode)n=n.parentNode;return n===doc}
 addEventListener(t,f){(this.listeners[t]=this.listeners[t]||[]).push(f)} removeEventListener(){}
 dispatch(t,ev){ev=Object.assign({type:t,target:this,preventDefault(){},stopPropagation(){}},ev||{});let n=this;while(n){(n.listeners[t]||[]).forEach(f=>f.call(n,ev));n=n.parentNode}}
 get textContent(){return this.childNodes.map(c=>c.textContent).join('')} set textContent(v){this.childNodes.forEach(c=>c.parentNode=null);this.childNodes=[];if(v!=='')this.appendChild(new Text_(String(v)))}
}
class Text_ extends Node_{constructor(t){super();this.nodeType=3;this.data=t} get textContent(){return this.data}}
function matches(elm,sel){return sel.split(',').some(s=>{s=s.trim();const parts=s.split(/\s+/);const last=parts[parts.length-1];return simple(elm,last)})}
function simple(e,s){if(e.nodeType!==1)return false;const m=s.match(/^([a-z0-9-]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/i);if(!m)return false;if(m[1]&&e.tagName.toLowerCase()!==m[1].toLowerCase())return false;const cls=(m[2]||'').split('.').filter(Boolean);if(!cls.every(c=>e.classList.contains(c)))return false;return true}
class El extends Node_{constructor(tag){super();this.nodeType=1;this.tagName=tag.toUpperCase();this.attrs={};this.style={setProperty(k,v){this[k]=v}};const self=this;
 this.classList={add:(...c)=>{const s=self._cls();c.forEach(x=>s.add(x));self._set(s)},remove:(...c)=>{const s=self._cls();c.forEach(x=>s.delete(x));self._set(s)},toggle:(c,f)=>{const s=self._cls();const on=f===undefined?!s.has(c):f;on?s.add(c):s.delete(c);self._set(s);return on},contains:c=>self._cls().has(c)};
 this.dataset=new Proxy({}, {set:(o,k,v)=>{self.attrs['data-'+k.replace(/[A-Z]/g,x=>'-'+x.toLowerCase())]=String(v);return true},get:(o,k)=>self.attrs['data-'+String(k).replace(/[A-Z]/g,x=>'-'+x.toLowerCase())]});
 this.value='';this.checked=false;this.disabled=false;}
 _cls(){return new Set((this.attrs['class']||'').split(/\s+/).filter(Boolean))} _set(s){this.attrs['class']=[...s].join(' ')}
 get className(){return this.attrs['class']||''} set className(v){this.attrs['class']=v}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='value')this.value=String(v);if(k==='checked')this.checked=true} getAttribute(k){return k in this.attrs?this.attrs[k]:null} removeAttribute(k){delete this.attrs[k]} hasAttribute(k){return k in this.attrs}
 set innerHTML(v){this._html=v;this.childNodes=[]} get innerHTML(){return this._html||''}
 querySelectorAll(sel){const out=[];const walk=n=>n.children.forEach(c=>{if(matches(c,sel))out.push(c);walk(c)});walk(this);return out}
 querySelector(sel){return this.querySelectorAll(sel)[0]||null}
 closest(sel){let n=this;while(n&&n.nodeType===1){if(matches(n,sel))return n;n=n.parentNode}return null}
 focus(){doc.activeElement=this} getBoundingClientRect(){return{left:0,top:0,right:10,bottom:10,width:10,height:10}}
 get offsetWidth(){return 50} get offsetHeight(){return 20} get offsetLeft(){return 5}
 showModal(){this.open=true} close(){this.open=false} click(){this.dispatch('click')}
 get hidden(){return 'hidden' in this.attrs} set hidden(v){v?this.attrs.hidden='':delete this.attrs.hidden}
}
const doc=new El('#document');doc.nodeType=9;
doc.documentElement=doc.appendChild(new El('html'));doc.body=doc.documentElement.appendChild(new El('body'));
doc.createElement=t=>new El(t);doc.createElementNS=(ns,t)=>new El(t);doc.createTextNode=t=>new Text_(t);
doc.getElementById=id=>{let r=null;const walk=n=>n.children.forEach(c=>{if(!r&&c.attrs.id===id)r=c;walk(c)});walk(doc);return r};
['kitBar','kitRoot','toasts','dialogHost'].forEach(id=>{const e=new El('div');e.setAttribute('id',id);doc.body.appendChild(e)});
const store={};
const win={document:doc,console,Math,JSON,Date,Intl,Object,Array,String,Number,Promise,Proxy,Set,parseFloat,isFinite,
 matchMedia:()=>({matches:false}),IntersectionObserver:class{observe(){}unobserve(){}},ResizeObserver:class{observe(){}},
 requestAnimationFrame:f=>rafs.push(f),setTimeout:(f,ms)=>{timers.push(f);return timers.length},clearTimeout(){},setInterval:(f)=>{win._tick=f;return 1},
 getComputedStyle:()=>({color:'rgb(10, 20, 30)',getPropertyValue:()=>' x '}),localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},innerWidth:1920,innerHeight:1080,location:{search:''}};
win.window=win;
let charts=0,destroyed=0;
if(process.argv[2]==='chart'){win.Chart=function(canvas,cfg){charts++;this.cfg=cfg;
  const fakeCtx={createLinearGradient:()=>({addColorStop(){}})};
  const chartObj={chartArea:{left:0,right:100,top:0,bottom:100},ctx:fakeCtx,canvas,scales:{y:{getPixelForValue:()=>50}},getDatasetMeta:()=>({data:[{getProps:()=>({y:1})}]})};
  cfg.data.datasets.forEach(d=>['backgroundColor','hoverBackgroundColor'].forEach(k=>{if(typeof d[k]==='function'){d[k]({chart:chartObj});d[k]({chart:{chartArea:null}})}}));
  const ext=cfg.options.plugins.tooltip.external;
  ext({chart:chartObj,tooltip:{opacity:1,caretX:5,caretY:5,title:['t'],dataPoints:[{dataset:cfg.data.datasets[0],dataIndex:0,raw:3,formattedValue:'3',label:'a'}]}});
  ext({chart:chartObj,tooltip:{opacity:0}});
  if(cfg.options.onClick)cfg.options.onClick({},[{index:0,datasetIndex:0}],this);
  if(cfg.options.onHover)cfg.options.onHover({},[]);
  const a=cfg.options.animations;if(a){a.y.from({index:1,chart:chartObj,datasetIndex:0});a.x.delay({type:'data',index:2})}
  this.destroy=()=>destroyed++;};}const ctx=vm.createContext(win);
['core','components','glyphs','heatmap','overlays','charts'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(ROOT,'js/ui/'+f+'.js'),'utf8'),ctx,{filename:'ui/'+f+'.js'}));
function flush(){for(let i=0;i<5;i++){const r=rafs;rafs=[];r.forEach(f=>f(16*i));const t=timers;timers=[];t.forEach(f=>f())}}
let errs=0;
function check(name,fn){try{fn();flush()}catch(e){errs++;console.log('ERR',name,e.stack.split('\n').slice(0,3).join(' | '))}}
function expect(name,cond){if(!cond){errs++;console.log('FAIL',name)}}
const ui=win.MRT.ui, root=doc.getElementById('kitRoot');
const put=n=>{root.appendChild(n.node||n);return n};

// every component, every state
check('panel',()=>{['ok','warning','critical','expired','blocked',null].forEach(s=>{const p=put(ui.panel({title:'T',icon:'settings',status:s,glow:true,actions:[ui.button('A')],body:ui.el('p',{text:'x'})}));p.setStatus('critical')})});
check('buttons',()=>{[undefined,'primary','danger','ghost'].forEach(k=>['sm',undefined,'lg'].forEach(z=>put(ui.button('B',{kind:k,size:z,icon:'plus',onClick(){}}))));put(ui.button('Off',{disabled:true}))});
check('segmented',()=>{const s=put(ui.segmented({label:'Theme',value:'a',options:[{value:'a',label:'A',icon:'sun'},{value:'b',label:'B'},{value:'c',label:'C',disabled:true}],onChange(){}}));s.set('b');expect('seg value',s.value()==='b')});
check('toggle',()=>{put(ui.toggle({label:'Check',checked:true,onChange(){}}));put(ui.toggle({kind:'switch',label:'Switch',onChange(){}}))});
check('field',()=>{const f=put(ui.field({label:'Cut depth',type:'number',unit:'µm',hint:'0-50'}));f.setState('valid','ok');f.setState('invalid','too deep');f.setState(null);
  put(ui.field({label:'Tool',options:[{value:'a',label:'A'}],value:'a'}));put(ui.field({label:'Purpose',multiline:true,value:'x'}));put(ui.field({label:'Off',disabled:true}))});
check('chips+leds',()=>{['ok','warning','critical','expired','blocked','neutral',{expired:true},{blocked:true},{status:'ok'}].forEach(s=>{root.appendChild(ui.statusChip(s));root.appendChild(ui.led(s,'x'))});
  expect('displayStatus expired wins',ui.displayStatus({expired:true,blocked:true})==='expired')});
check('kpi',()=>{['ok','critical','expired',undefined].forEach(s=>{const k=put(ui.kpiTile({label:'Open',value:12,status:s,icon:'inbox',sub:'s',href:'#/x'}));k.update(0,'none')})});
check('table',()=>{root.appendChild(ui.el('table',{class:'grid'},[ui.el('tr',{},[ui.el('th',{text:'h'})])]))});
check('tabs',()=>{const t=put(ui.tabs([{key:'a',label:'A',icon:'user'},{key:'b',label:'B'}],()=>{}));t.setActive('b');expect('tabs active',t.node.querySelector('.tab-btn.active').textContent==='B')});
check('empty+skeleton',()=>{put(ui.emptyState({icon:'inbox',title:'None',text:'t',actionLabel:'Add',onAction(){}}));put(ui.skeleton(4))});
check('heatmap',()=>{put(ui.heatmap({rows:['Mon','Tue'],cols:['07','08','09'],values:[[0,2,5],[1,0,0]],label:'Load',unit:'Requests',colour:'teal'}));put(ui.heatmap({rows:['a'],cols:['b'],values:[[0]]}))});
check('glyphs',()=>{expect('six glyphs',ui.GLYPHS.length===6);
  ui.GLYPHS.forEach(g=>['idle','live','maint','off'].forEach(s=>{const n=ui.toolGlyph(g.key,{size:40,state:s,label:g.label});root.appendChild(n);
    expect('glyph '+g.key+' '+s,n.classList.contains('is-'+s)&&n.innerHTML.indexOf('tg-body')!==-1&&n.getAttribute('role')==='img')}));
  const d=ui.toolGlyph('xyz');expect('unknown glyph -> generic',d.dataset.glyph==='generic'&&d.getAttribute('aria-hidden')==='true');
  ui.toolGlyphState(d,'off');expect('state change',d.classList.contains('is-off')&&!d.classList.contains('is-idle'));
  ui.toolGlyphState(d,'bogus');expect('bad state -> idle',d.classList.contains('is-idle'))});
check('icons',()=>{['logo','requests','request_new','board','bell','copy','wrench','users','calendar','gauge','inbox','lots','analytics','settings','help'].forEach(n=>{const i=ui.icon(n);expect('icon '+n,i.innerHTML.length>10)})});
check('format',()=>{expect('formatTs',ui.formatTs('2026-09-24T08:05:00Z')==='24.09.2026 10:05');expect('duration',ui.formatDurationH(1.5)==='1 h 30 min');expect('initials',ui.initials('Prince Khurana')==='PK')});
check('esc',()=>{expect('esc',ui.esc('<b a="1">&')==='&lt;b a=&quot;1&quot;&gt;&amp;')});
check('charts',()=>{const c=ui.chart(t=>({type:'bar',data:{labels:['a','b'],datasets:[{label:'x',data:[1,2],backgroundColor:t.color('accent')}]},options:{}}),{height:200,expand:true,onPick(){}});root.appendChild(c.node);c.refresh&&c.refresh()});

// overlays: toasts, dialogs, menu, tooltip
check('toasts',()=>{['info','success','warning','error'].forEach(k=>ui.toast({message:'m',kind:k,actions:[{label:'Retry',onClick(){}}]}));ui.toastError('boom',null)});
check('dialogs',()=>{ui.dialog({title:'D',icon:'info',body:ui.el('p',{text:'b'})});ui.confirm({message:'sure?',danger:true});ui.promptReason({title:'Why'})});
check('menu',()=>{const a=ui.el('button');root.appendChild(a);ui.menu(a,[{label:'One',icon:'user',aside:'?',onClick(){}},{sep:true},{node:ui.el('span',{text:'n'})}],[ui.el('b',{text:'h'})])});
check('tips',()=>{const box=ui.el('div',{},[ui.el('span',{class:'tipme',text:'t'})]);root.appendChild(box);ui.bindTips(box,'.tipme',()=>ui.tipRow('a','b'));box.querySelector('.tipme').dispatch('mouseover');box.querySelector('.tipme').dispatch('mouseout')});

// click every button, change every input
let clicked=0;
for(const b of root.querySelectorAll('button')){check('click '+b.textContent,()=>{b.dispatch('click');clicked++})}
for(const b of doc.getElementById('dialogHost').querySelectorAll('button')){check('dialog button',()=>b.dispatch('click'))}
for(const i of root.querySelectorAll('input')){check('input',()=>{i.checked=true;i.value='12';i.dispatch('change');i.dispatch('input')})}

// the kit, once it exists (step 5)
const kit=path.join(ROOT,'js/ui-kit.js');
if(fs.existsSync(kit)){check('ui-kit',()=>{vm.runInContext(fs.readFileSync(kit,'utf8'),ctx,{filename:'ui-kit.js'});flush();if(win._tick)win._tick()})}

console.log('charts built',charts,'destroyed',destroyed);
console.log('clicked',clicked,'toasts',doc.getElementById('toasts').children.length,'errors',errs);
console.log(errs?'SMOKE FAILED':'smoke ok');
if(errs)process.exitCode=1;
