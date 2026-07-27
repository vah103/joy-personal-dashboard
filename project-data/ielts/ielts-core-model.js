const CLOUD = document.querySelector('meta[name="joy-backend"]')?.content === "cloudflare";
const PLAN_URL = "/project-data/ielts/august-2026.json?v=2026.08.1";
const DAY_URLS = ["01-09","10-16","17-23","24-31"].map(range=>`/project-data/ielts/august-days-${range}.json?v=2026.08.1`);
const API = "/api/ielts-core";
const LOCAL = "joy-ielts-august-core-v1";
const TZ = "Asia/Ho_Chi_Minh";
const DONE = new Set(["completed", "completed-minimum"]);
const LABEL = {writing:"Writing",speaking:"Speaking",reading:"Reading",listening:"Listening",review:"Review"};
const STATUS = {pending:"Not started",progress:"In progress",completed:"Completed","completed-minimum":"Minimum day",overdue:"Overdue",recovery:"Recovery"};
const app = {plan:null,data:blank(),version:0,tab:"today",mode:"loading",timer:0};
function blank(){return{strictMode:true,taskStates:{},prelaunch:{},storyBank:[],errorLogs:[],weeklyReviews:{},settings:{morningReminder:true,eveningReminder:true,weeklyReviewReminder:true}}}
function normal(v){const b=blank();return{strictMode:v?.strictMode!==false,taskStates:obj(v?.taskStates),prelaunch:obj(v?.prelaunch),storyBank:Array.isArray(v?.storyBank)?v.storyBank.slice(-100):[],errorLogs:Array.isArray(v?.errorLogs)?v.errorLogs.slice(-500):[],weeklyReviews:obj(v?.weeklyReviews),settings:{...b.settings,...obj(v?.settings)}}}
function obj(v){return v&&typeof v==="object"&&!Array.isArray(v)?v:{}}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function key(){const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));return`${p.year}-${p.month}-${p.day}`}
function fmt(k){return new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:"short",day:"numeric",month:"short"}).format(new Date(`${k}T00:00:00+07:00`))}
function taskId(date,index){return`${date}-task-${String(index+1).padStart(2,"0")}`}
function taskList(){return(app.plan?.days||[]).flatMap(d=>(d.tasks||[]).map((raw,i)=>({id:taskId(d.date,i),date:d.date,day:d.day,week:d.week,theme:d.theme,session:raw[0],skill:raw[1],title:raw[2],minutes:raw[3],objective:raw[4],evidence:raw[5],kind:raw[6]||"practice"})))}
function day(k=key()){return app.plan?.days?.find(d=>d.date===k)}
function state(t){const s=app.data.taskStates[t.id]?.status;if(s)return s;return t.date<key()?"overdue":"pending"}
function done(t){return DONE.has(state(t))}
function progress(tasks){return tasks.length?Math.round(tasks.reduce((n,t)=>n+(state(t)==="completed"?1:state(t)==="completed-minimum"?0.45:0),0)/tasks.length*100):0}
function overdue(){return taskList().filter(t=>t.date<key()&&!done(t)).sort((a,b)=>a.date.localeCompare(b.date))}
function next(){return overdue()[0]||taskList().find(t=>t.date>=key()&&!done(t))}
function localLoad(){try{const x=JSON.parse(localStorage.getItem(LOCAL));return{data:normal(x?.data),version:Number(x?.version||0)}}catch{return{data:blank(),version:0}}}
function localSave(){localStorage.setItem(LOCAL,JSON.stringify({data:app.data,version:app.version}))}
async function req(url,opt={}){const r=await fetch(url,{credentials:"same-origin",...opt,headers:{...(opt.body?{"Content-Type":"application/json"}:{}),...(opt.headers||{})}});const p=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(p.error||`REQUEST_${r.status}`);e.status=r.status;e.payload=p;throw e}return p}
function meaningful(d){return Object.keys(d.taskStates||{}).length||Object.values(d.prelaunch||{}).some(Boolean)||d.storyBank?.length||d.errorLogs?.length||Object.keys(d.weeklyReviews||{}).length}
async function load(){shell();const local=localLoad();app.data=local.data;app.version=local.version;try{const loaded=await Promise.all([req(PLAN_URL),...DAY_URLS.map(req),CLOUD?req(API).catch(()=>null):null]);const plan=loaded[0],cloud=loaded.at(-1);app.plan={...plan,days:loaded.slice(1,-1).flat()};if(cloud){const c=normal(cloud.data);app.data=!meaningful(c)&&meaningful(local.data)?local.data:c;app.version=Number(cloud.version||0);app.mode="cloud";localSave();if(!meaningful(c)&&meaningful(local.data))save()}else app.mode="local";markOld();render();card();deepLink()}catch(e){console.error(e);app.mode="error";document.querySelector("#ielts-body").innerHTML='<div class="ielts-empty"><strong>Joy could not load the August plan.</strong><button data-ia="reload">Try again</button></div>'}}
function save(){localSave();clearTimeout(app.timer);sync("Saving…");app.timer=setTimeout(async()=>{if(!CLOUD){sync("Local");return}try{const p=await req(API,{method:"PUT",body:JSON.stringify({data:app.data,baseVersion:app.version})});app.version=p.version;app.mode="cloud";localSave();sync("Synced")}catch(e){if(e.status===409){app.data=normal(e.payload.data);app.version=e.payload.version;localSave();render()}app.mode="local";sync("Offline")}},450);updateCard()}
function markOld(){let changed=false;taskList().forEach(t=>{if(t.date<key()&&!app.data.taskStates[t.id]?.status){app.data.taskStates[t.id]={status:"overdue",updatedAt:Date.now()};changed=true}});if(changed)save()}
function shell(){if(document.querySelector("#ielts-modal"))return;const n=document.createElement("div");n.id="ielts-modal";n.className="ielts-backdrop";n.hidden=true;n.innerHTML=`<section class="ielts-core" role="dialog" aria-modal="true" aria-labelledby="ielts-title"><header><div class="ielts-id"><b>7.0</b><span><small>August intensive · Strict mode</small><h2 id="ielts-title">IELTS Coach</h2><em id="ielts-sub">Loading plan…</em></span></div><div class="ielts-head-actions"><i id="ielts-sync">Connecting…</i><a href="https://docs.google.com/document/d/1y_WC_yO7xFyFoniGUt3yISgLxq6mP3hBQFWahSzSueQ/edit?tab=t.m7b1hpnyrvjs" target="_blank" rel="noreferrer">Full plan ↗</a><button data-ia="close">×</button></div></header><nav>${["today","roadmap","log","coach"].map((x,i)=>`<button class="${i?"":"active"}" data-it="${x}">${x==="today"?"Today":x==="roadmap"?"August Roadmap":x==="log"?"Practice Log":"Joy Coach"}</button>`).join("")}</nav><main id="ielts-body"></main><aside id="ielts-editor" hidden></aside></section>`;document.body.append(n)}
function sync(t){const e=document.querySelector("#ielts-sync");if(e)e.textContent=t}
