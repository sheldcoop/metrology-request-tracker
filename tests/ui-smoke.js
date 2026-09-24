/**
 * tests/ui-smoke.js - dev only, no dependencies:  node tests/ui-smoke.js [chart]
 *
 * Runs js/ui/*.js against a tiny fake DOM (tests/fake-dom.js), builds
 * every component in every state, clicks every button, changes every input
 * and opens every overlay. When js/ui-kit.js exists it runs the kit too.
 * Exits 1 on any error. `chart` adds a fake Chart.js to exercise the
 * chart wrapper.
 */
const vm=require('vm'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const { win, doc, flush, tick } = require('./fake-dom')({ ids: ['kitBar', 'kitRoot', 'toasts', 'dialogHost'] });
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
['core','components','glyphs','heatmap','overlays','charts','panelmap','barcode','magazine'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(ROOT,'js/ui/'+f+'.js'),'utf8'),ctx,{filename:'ui/'+f+'.js'}));
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
check('form',()=>{const f=put(ui.form([{key:'code',label:'Code',kind:'text'},{key:'n',label:'Level',kind:'number',unit:'µm',cls:'half'},
  {key:'type',label:'Type',kind:'select',options:[{value:'a',label:'A'},{value:'b',label:'B'}]},{key:'unit',label:'Unit',kind:'text',showIf:v=>v.type==='b'},
  {key:'req',label:'Required',kind:'check'},{key:'days',label:'Days',kind:'checks',options:[{value:1,label:'Mon'},{value:2,label:'Tue'}]},
  {key:'txt',label:'Notes',kind:'longtext'}],{code:'FIB',n:5,type:'a',days:[2]}));
  expect('form values',JSON.stringify(f.values())===JSON.stringify({code:'FIB',n:5,type:'a',unit:'',req:false,days:[2],txt:''}));
  expect('showIf hides',f.node.children[3].hidden===true);
  f.node.children[2].querySelector('select').value='b';f.node.dispatch('change');expect('showIf shows',f.node.children[3].hidden===false);
  f.node.children[1].querySelector('input').value='abc';expect('a bad number is NaN',isNaN(f.values().n));
  f.node.children[1].querySelector('input').value='';expect('an empty number is null',f.values().n===null);
  f.setError('code','Taken');expect('setError marks the field',f.node.children[0].classList.contains('is-invalid'));f.clearErrors();f.setError('days','Pick one');f.focus()});
check('chips+leds',()=>{['ok','warning','critical','expired','blocked','neutral',{expired:true},{blocked:true},{status:'ok'}].forEach(s=>{root.appendChild(ui.statusChip(s));root.appendChild(ui.led(s,'x'))});
  expect('displayStatus expired wins',ui.displayStatus({expired:true,blocked:true})==='expired')});
check('kpi',()=>{['ok','critical','expired',undefined].forEach(s=>{const k=put(ui.kpiTile({label:'Open',value:12,status:s,icon:'inbox',sub:'s',href:'#/x'}));k.update(0,'none')})});
check('table',()=>{root.appendChild(ui.el('table',{class:'grid'},[ui.el('tr',{},[ui.el('th',{text:'h'})])]))});
check('tabs',()=>{const t=put(ui.tabs([{key:'a',label:'A',icon:'user'},{key:'b',label:'B'}],()=>{}));t.setActive('b');expect('tabs active',t.node.querySelector('.tab-btn.active').textContent==='B')});
check('empty+skeleton',()=>{put(ui.emptyState({icon:'inbox',title:'None',text:'t',actionLabel:'Add',onAction(){}}));put(ui.skeleton(4))});
check('panel map',()=>{vm.runInContext(fs.readFileSync(path.join(ROOT,'js/config.js'),'utf8'),ctx);vm.runInContext(fs.readFileSync(path.join(ROOT,'js/domain.js'),'utf8'),ctx);
  const D=win.MRT.domain;let got=null;
  const pm=put(ui.panelMap({count:12,selected:[2],label:'Panels',parse:D.parsePanels,format:D.formatPanels,onChange:l=>{got=l}}));
  const cells=pm.node.querySelectorAll('.pm-cell'),box=pm.node.querySelector('input');
  expect('panel map: 12 panels, 1 picked',cells.length===12&&pm.value().join()==='2'&&/1 of 12/.test(pm.node.textContent)&&box.value==='2');
  cells[4].click();expect('a click picks a panel and rewrites the text',got.join()==='2,5'&&box.value==='2, 5'&&cells[4].getAttribute('aria-pressed')==='true');
  cells[8].dispatch('click',{shiftKey:true});expect('shift+click picks the run',pm.value().join()==='2,5,6,7,8,9'&&box.value==='2, 5-9');
  box.value='1-3, 12';box.dispatch('input');expect('typing lights the map',pm.value().join()==='1,2,3,12'&&cells[11].classList.contains('is-picked'));
  box.value='1-3, 13';box.dispatch('input');expect('a panel outside the lot is refused, map kept',pm.value().join()==='1,2,3,12'&&pm.node.querySelector('.ifield').classList.contains('is-invalid'));
  pm.node.querySelectorAll('button').filter(b=>b.textContent==='All')[0].click();expect('All',pm.value().length===12);
  pm.node.querySelectorAll('button').filter(b=>b.textContent==='None')[0].click();expect('None',pm.value().length===0&&box.value==='');
  pm.focus();pm.node.querySelector('.panel-map').dispatch('keydown',{key:'ArrowDown'});pm.node.querySelector('.panel-map').dispatch('keydown',{key:'End'});
  pm.set([3,4]);expect('set()',pm.value().join()==='3,4');pm.setError('Pick panels');pm.setError(null);
  const big=put(ui.panelMap({count:200,parse:D.parsePanels,format:D.formatPanels}));expect('a big lot: 200 cells, rows of 20',big.node.querySelectorAll('.pm-cell').length===200&&/repeat\(20/.test(big.node.querySelector('.panel-map').style.gridTemplateColumns));
  const ro=put(ui.panelMap({count:6,readOnly:true,marks:{1:'measured',2:'scrapped',3:'received'}}));
  expect('read-only: marks, legend, no buttons, no text box',ro.node.querySelectorAll('.pm-cell.is-scrapped').length===1&&!!ro.node.querySelector('.pm-legend')&&!ro.node.querySelector('button')&&!ro.node.querySelector('input'))});
check('barcode',()=>{const b=put(ui.code128('FIB-260924-03',{height:40}));const bars=b.querySelectorAll('rect');
  const v=ui.code128Values('FIB-260924-03');expect('code 128: start B, 13 characters, checksum, stop',v.length===16&&v[0]===104&&v[15]===106);
  expect('...3 bars per symbol, 2 more for stop',bars.length===15*3+4);expect('...labelled for screen readers',/FIB-260924-03/.test(b.getAttribute('aria-label')));
  let bad=false;try{ui.code128Values('é')}catch(e){bad=true}expect('...refuses what set B cannot encode',bad)});
check('magazine map',()=>{let got=null;
  const mm=put(ui.magazineMap({magazines:[{id:'a',code:'M70345',slots:24,rack:7}],load:[{panel:1,magazine_id:'a',slot:1},{panel:2,magazine_id:'a',slot:2}],panelCount:3,highlight:[2],editable:true,onChange:l=>{got=l}}));
  const slots=()=>mm.node.querySelectorAll('.mag-slot');
  expect('magazine: 24 slots, panel 2 lit, panel 3 in the tray',slots().length===24&&slots()[1].classList.contains('is-hi')&&/P3/.test(mm.node.querySelector('.mag-tray').textContent));
  slots()[0].click();slots()[1].click();expect('click slot 1 then slot 2 swaps panels',got.filter(x=>x.panel===1)[0].slot===2&&got.filter(x=>x.panel===2)[0].slot===1);
  slots()[4].click();mm.node.querySelector('.mag-loose').click();
  expect('a tray panel into an empty slot',mm.value().some(x=>x.panel===3&&x.slot===5));
  slots()[4].click();mm.node.querySelector('.mag-tray').click();expect('a slot, then the tray: taken out',!mm.value().some(x=>x.panel===3));
  const ro=put(ui.magazineMap({magazines:[{id:'a',code:'M1',slots:4}],load:[],panelCount:2,scrapped:[2]}));expect('read-only: no buttons, scrapped named',!ro.node.querySelector('button')&&/Scrapped/.test(ro.node.textContent))});
check('heatmap',()=>{put(ui.heatmap({rows:['Mon','Tue'],cols:['07','08','09'],values:[[0,2,5],[1,0,0]],label:'Load',unit:'Requests',colour:'teal'}));put(ui.heatmap({rows:['a'],cols:['b'],values:[[0]]}))});
check('glyphs',()=>{expect('six glyphs',ui.GLYPHS.length===6);
  ui.GLYPHS.forEach(g=>['idle','live','maint','off'].forEach(s=>{const n=ui.toolGlyph(g.key,{size:40,state:s,label:g.label});root.appendChild(n);
    expect('glyph '+g.key+' '+s,n.classList.contains('is-'+s)&&n.innerHTML.indexOf('tg-body')!==-1&&n.getAttribute('role')==='img')}));
  const parts={hrm:['tg-probe','tg-scroll'],aoi:['tg-scan','tg-defect'],prf:['tg-stylus','tg-trace'],qvm:['tg-reticle','tg-measure'],fib:['tg-raster','tg-face'],generic:['tg-spin']};
  Object.keys(parts).forEach(k=>{const h=ui.toolGlyph(k).innerHTML;expect('P1 working parts + lamp: '+k,parts[k].every(p=>h.indexOf(p)!==-1)&&h.indexOf('tg-lamp')!==-1)});
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

// a dialog that saves: stays open on an error and shows it inside, closes on success
let submitted=null,tries=0;
const saveDlg=()=>doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d=>d.getAttribute('aria-label')==='Save test')[0];
async function dialogSubmitChecks(){
  ui.dialog({title:'Save test',body:ui.el('p',{text:'x'}),actions:[{label:'Cancel',value:null},{label:'Save',kind:'primary',value:()=>'v',
    submit:v=>{tries++;return tries===1?Promise.reject(new Error('Code already exists')):Promise.resolve(v)}}]}).then(v=>{submitted=v});
  flush();
  const save=()=>saveDlg().querySelectorAll('button').filter(b=>b.textContent==='Save')[0];
  save().click();await new Promise(r=>setTimeout(r,5));flush();
  expect('a failed save keeps the dialog open',!!saveDlg()&&saveDlg().open);
  expect('...and shows the error inside it',/Code already exists/.test(saveDlg().querySelector('.modal-error').textContent)&&!saveDlg().querySelector('.modal-error').hidden);
  expect('...buttons usable again',!save().disabled);
  save().click();await new Promise(r=>setTimeout(r,5));flush();await new Promise(r=>setTimeout(r,5));
  expect('a good save closes it with the value',submitted==='v'&&!saveDlg());
  await ui.copyText('\\\\srv\\lab\\FIB','Path copied');
  expect('copyText puts the text on the clipboard',win.navigator.clipboard.text==='\\\\srv\\lab\\FIB');
}

// click every button, change every input
let clicked=0;
for(const b of root.querySelectorAll('button')){check('click '+b.textContent,()=>{b.dispatch('click');clicked++})}
for(const b of doc.getElementById('dialogHost').querySelectorAll('button')){check('dialog button',()=>b.dispatch('click'))}
for(const i of root.querySelectorAll('input')){check('input',()=>{i.checked=true;i.value='12';i.dispatch('change');i.dispatch('input')})}

// the kit, once it exists (step 5)
const kit=path.join(ROOT,'js/ui-kit.js');
if(fs.existsSync(kit)){check('ui-kit',()=>{ui.clear(root);vm.runInContext(fs.readFileSync(kit,'utf8'),ctx,{filename:'ui-kit.js'});flush();tick();
  const secs=root.querySelectorAll('section').filter(x=>x.classList.contains('kit-sec'));
  expect('the kit builds every section (21)',secs.length===21);
  expect('the kit shows 6 glyphs x 4 states',root.querySelectorAll('.kit-glyph-cell').length===24);
  for(const b of root.querySelectorAll('button')){try{b.dispatch('click');flush()}catch(e){errs++;console.log('ERR kit button',b.textContent,e.message)}}
  for(const i of doc.getElementById('kitBar').querySelectorAll('input')){i.checked=true;i.dispatch('change');flush()}
  expect('the kit renders all three themes side by side',root.querySelectorAll('.theme-scope').length===3)})}

(async()=>{await dialogSubmitChecks().catch(e=>{errs++;console.log('ERR dialog submit',e.stack)});
console.log('charts built',charts,'destroyed',destroyed);
console.log('clicked',clicked,'toasts',doc.getElementById('toasts').children.length,'errors',errs);
console.log(errs?'SMOKE FAILED':'smoke ok');
if(errs)process.exitCode=1;
})();
