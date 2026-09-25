/**
 * tests/contrast.js - dev only, no dependencies:  node tests/contrast.js [all]
 *
 * WCAG AA (4.5:1) check of every text/background token pair in EVERY theme,
 * read straight from js/themes.js (the one place themes live). Exits 1 on
 * any failure. (ui-kit.html shows the same table computed live in the browser.)
 */
const fs=require('fs'),path=require('path'),vm=require('vm');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js/themes.js'),'utf8'),ctx);
const TH=ctx.window.MRT.themes;const T={};TH.list.forEach(t=>{T[t.key]=TH.tokens(t)});
function parse(c){let m;if(m=c.match(/^#([0-9a-f]{6})$/i)){const n=parseInt(m[1],16);return[n>>16,n>>8&255,n&255,1]}if(m=c.match(/rgba?\(([^)]+)\)/)){const p=m[1].split(',').map(Number);return[p[0],p[1],p[2],p[3]??1]}throw 'parse '+c}
const over=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat(1);
const L=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])};
const ratio=(a,b)=>{const x=L(a),y=L(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const pairs=[['fg','surface'],['fg-muted','surface'],['fg-muted','surface-2'],['fg-faint','surface'],['fg-faint','surface-2'],['fg-muted','bg'],['accent','surface'],['accent-fg','accent'],['on-danger','danger'],['danger-fg','surface'],['danger-fg','danger-bg'],
...['ok','warning','critical','expired','blocked'].flatMap(s=>[[s+'-fg','surface'],[s+'-fg','surface-2'],[s+'-fg',s+'-bg']]),['c-blue','surface'],['c-teal','surface'],['c-pink','surface'],['fg','inset'],['accent','inset']];
let bad=0;const all=process.argv[2];
for(const[t,v]of Object.entries(T))for(const[f,b]of pairs){let bg=parse(v[b]);if(bg[3]<1)bg=over(bg,parse(v.surface));let fg=parse(v[f]);if(fg[3]<1)fg=over(fg,bg);const r=ratio(fg,bg);if(r<4.5)bad++;if(r<4.5||all)console.log(t.padEnd(8),(f+' on '+b).padEnd(30),r.toFixed(2),r>=4.5?'AA':'FAIL')}
console.log('fails',bad);if(bad)process.exitCode=1;
