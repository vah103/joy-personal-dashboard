(() => {
  const URL = "/project-data/turtlebot4/project-state-v2.json";
  const TZ = "Asia/Ho_Chi_Minh";
  const oldNormalize = normalizeOverrides;
  const oldProgress = projectProgress;
  const oldCard = updateTurtleBotCard;
  const oldHub = renderHub;
  const oldPlan = renderPlan;
  const oldAnswer = answerProjectQuestion;
  const oldEffectivePlan = effectivePlan;

  hubState.projectState = null;

  normalizeOverrides = (value) => {
    const next = oldNormalize(value);
    next.planTasks = value?.planTasks && typeof value.planTasks === "object" ? value.planTasks : {};
    return next;
  };

  const style = document.createElement("style");
  style.textContent = `
    .ps-wrap{padding:22px;display:grid;gap:14px}.ps-hero,.ps-panel,.ps-history,.ps-week{border:1px solid #d6dee2;border-radius:16px;background:#fff}.ps-hero{display:flex;justify-content:space-between;gap:18px;padding:20px;background:radial-gradient(circle at 88% 0%,rgba(132,166,183,.18),transparent 34%),#fff}.ps-hero span,.ps-title span,.ps-schedule>header span{color:#73828a;font-size:.68rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.ps-hero h3,.ps-title h3,.ps-schedule>header h3{margin:4px 0 0;color:#29363d}.ps-hero p,.ps-schedule>header p{margin:7px 0 0;color:#617079;font-size:.78rem;line-height:1.5}.ps-status{height:fit-content;padding:7px 10px;border-radius:999px;background:#eaf1f4;color:#4a6572;font-size:.7rem;font-weight:800}.ps-status.at-risk,.ps-status.behind{background:#fbf2da;color:#7c6021}.ps-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.ps-metrics article{padding:14px;border:1px solid #d7dfe3;border-radius:13px;background:#fff}.ps-metrics span,.ps-metrics strong,.ps-metrics small{display:block}.ps-metrics span{color:#7a878e;font-size:.66rem}.ps-metrics strong{margin-top:4px;color:#2e3e46;font-size:1.35rem}.ps-metrics small{margin-top:3px;color:#7a878e;font-size:.65rem}.ps-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ps-panel,.ps-history{padding:17px}.ps-title{display:flex;justify-content:space-between;gap:12px}.ps-title h3{font-size:1rem}.ps-title small{color:#829097;font-size:.67rem}.ps-tasks{display:grid;gap:7px;margin-top:12px}.ps-task{display:grid;grid-template-columns:19px 1fr;gap:8px;padding:9px 10px;border:1px solid #e0e5e7;border-radius:10px;background:#f8fafb;cursor:pointer}.ps-task input{position:absolute;opacity:0}.ps-check{width:18px;height:18px;display:grid;place-items:center;border:1px solid #bfcbd1;border-radius:6px;background:#fff;font-size:.65rem}.ps-task b,.ps-task small{display:block}.ps-task b{color:#46565e;font-size:.74rem;line-height:1.4}.ps-task small{margin-top:2px;color:#87949a;font-size:.61rem}.ps-task.done{background:#eef4f2}.ps-task.done b{text-decoration:line-through;color:#6f7e78}.ps-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}.ps-actions a,.ps-schedule>header a{display:inline-flex;align-items:center;min-height:35px;padding:0 11px;border:1px solid #d1dade;border-radius:9px;color:#556972;font-size:.7rem;font-weight:700;text-decoration:none}.ps-panel>p{color:#5e6e76;font-size:.75rem;line-height:1.5}.ps-panel ul{padding-left:18px;color:#6d624f;font-size:.71rem;line-height:1.5}.ps-timeline{display:grid;margin-top:12px}.ps-timeline article{display:grid;grid-template-columns:1fr auto;gap:10px;padding:9px 0;border-bottom:1px solid #e6eaec}.ps-timeline small,.ps-timeline b,.ps-timeline p{display:block;margin:0}.ps-timeline small{color:#829097;font-size:.62rem}.ps-timeline b{color:#40525a;font-size:.75rem}.ps-timeline p{margin-top:3px;color:#718087;font-size:.68rem}.ps-timeline em{padding:4px 7px;border-radius:7px;background:#eef3f5;color:#506873;font-size:.68rem;font-style:normal;font-weight:800}.ps-chat{min-height:480px}.ps-schedule{padding:22px;display:grid;gap:12px}.ps-schedule>header{display:flex;justify-content:space-between;gap:18px;padding:19px;border:1px solid #d6dee2;border-radius:16px;background:#fff}.ps-weeks{display:grid;gap:9px}.ps-week{overflow:hidden}.ps-week>summary{display:grid;grid-template-columns:35px 1fr 120px;gap:10px;align-items:center;padding:13px 15px;list-style:none;cursor:pointer}.ps-week>summary::-webkit-details-marker{display:none}.ps-num{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#eaf0f2;color:#526b76;font-size:.75rem;font-weight:900}.ps-week.current .ps-num{background:#31434c;color:#fff}.ps-week summary b,.ps-week summary small{display:block}.ps-week summary b{color:#405159;font-size:.79rem}.ps-week summary small{margin-top:2px;color:#829097;font-size:.64rem}.ps-bar{text-align:right;color:#526a75;font-size:.68rem}.ps-bar i{display:block;height:5px;margin-top:4px;border-radius:99px;background:#e2e8eb;overflow:hidden}.ps-bar em{display:block;height:100%;background:#6e8995}.ps-week-body{padding:14px;border-top:1px solid #e2e7e9}.ps-week-body>p{color:#607078;font-size:.73rem}.ps-days{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ps-day{padding:10px;border:1px solid #e0e5e7;border-radius:10px;background:#fafbfc}.ps-day.today{border-color:#9bb1bb;background:#f2f6f7}.ps-day.optional{border-style:dashed}.ps-day>header{display:flex;justify-content:space-between;gap:8px;color:#70828a;font-size:.63rem;font-weight:700}.ps-day>header b{color:#42545c}.ps-day .ps-tasks{margin-top:8px}.ps-day .ps-task{padding:8px}.ps-day .ps-task b{font-size:.7rem}
    @media(max-width:900px){.ps-metrics{grid-template-columns:1fr 1fr}.ps-grid,.ps-days{grid-template-columns:1fr}}@media(max-width:600px){.ps-wrap,.ps-schedule{padding:13px}.ps-hero,.ps-schedule>header,.ps-title{flex-direction:column}.ps-metrics{grid-template-columns:1fr 1fr}.ps-week>summary{grid-template-columns:32px 1fr}.ps-bar{grid-column:1/-1}.ps-grid{grid-template-columns:1fr}}@media(max-width:420px){.ps-metrics{grid-template-columns:1fr}}
  `;
  document.head.append(style);

  const state = () => hubState.projectState?.schemaVersion === 2 ? hubState.projectState : null;
  const stages = () => {
    const ids = new Set(state()?.scope?.includedStageIds || getStages().map((s) => s.id));
    return getStages().map(effectiveStage).filter((s) => ids.has(s.id));
  };
  const today = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:state()?.project?.timezone||TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map((x)=>[x.type,x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  };
  const fmt = (v, weekday=true) => new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:weekday?"short":undefined,day:"numeric",month:"short",year:"numeric"}).format(new Date(`${v}T00:00:00+07:00`));
  const weeks = () => state()?.weeks || [];
  const days = () => weeks().flatMap((w)=>(w.days||[]).map((d)=>({...d,weekNumber:w.number,weekTitle:w.title})));
  const itemDone = (id) => getStages().map(effectiveStage).some((s)=>s.checklist?.some((i)=>i.id===id&&i.done));
  const taskProgress = (t) => {
    const ids=t.roadmapItemIds||[];
    if(ids.length)return ids.filter(itemDone).length/ids.length;
    const value=hubState.overrides.planTasks?.[t.id];
    return typeof value==="boolean"?(value?1:0):(t.done?1:0);
  };
  const taskDone = (t) => taskProgress(t)>=1;
  const dayProgress = (d) => {
    const t=d?.tasks||[]; return t.length?Math.round(t.reduce((n,x)=>n+taskProgress(x),0)/t.length*100):0;
  };
  const weekProgress = (w) => {
    const t=(w?.days||[]).filter((d)=>!d.optional).flatMap((d)=>(d.tasks||[]).filter((x)=>!x.optional));
    return t.length?Math.round(t.reduce((n,x)=>n+taskProgress(x),0)/t.length*100):0;
  };

  projectProgress = () => {
    const list=stages(); if(!list.length)return oldProgress();
    const total=list.reduce((n,s)=>n+Number(s.weight||1),0);
    return total?Math.round(list.reduce((n,s)=>n+s.progress*Number(s.weight||1),0)/total):0;
  };

  const snapshot = () => {
    const date=today();
    const week=weeks().find((w)=>date>=w.start&&date<=w.end)||weeks().find((w)=>date<w.start)||weeks().at(-1);
    const todayDay=days().find((d)=>d.date===date);
    const pendingDays=days().filter((d)=>d.date>=date);
    let next=null;
    for(const d of [todayDay,...pendingDays.filter((x)=>x!==todayDay)].filter(Boolean)){
      const task=(d.tasks||[]).find((t)=>!taskDone(t)); if(task){next={task,day:d};break;}
    }
    if(!next)for(const d of days()){const task=(d.tasks||[]).find((t)=>!taskDone(t));if(task){next={task,day:d};break;}}
    const nextLab=days().find((d)=>d.date>=date&&d.location==="Lab"&&(d.tasks||[]).some((t)=>!taskDone(t)))||null;
    const overdue=days().flatMap((d)=>d.date<date&&!d.optional?(d.tasks||[]).filter((t)=>!taskDone(t)).map((task)=>({task,day:d})):[]);
    const stage=stages().find((s)=>s.id===state()?.project?.currentStageId)||stages().find((s)=>s.progress<100)||stages().at(-1);
    const start=new Date(`${state()?.project?.planStart}T00:00:00+07:00`).getTime(),end=new Date(`${state()?.project?.planEnd}T00:00:00+07:00`).getTime(),now=new Date(`${date}T00:00:00+07:00`).getTime();
    const elapsed=now<=start?0:now>=end?100:Math.round((now-start)/(end-start)*100);
    const status=date<state()?.project?.planStart?"Not started":overdue.length?"At risk":date>state()?.project?.planEnd&&projectProgress()<100?"Behind":"On track";
    return {date,week,todayDay,next,nextLab,overdue,stage,elapsed,status,overall:projectProgress(),weekPct:weekProgress(week)};
  };

  effectivePlan = () => {
    if(!state())return oldEffectivePlan();
    const s=snapshot();
    return {title:s.next?.task.label||"Review the next milestone",why:s.stage?.completionCriteria||"",location:s.next?.day.location||"Home",priority:"High",currentFocus:(s.todayDay?.tasks||[]).find((t)=>!taskDone(t))?.label||s.next?.task.label||"",nextAction:s.next?.task.label||"",completionCriteria:s.stage?.completionCriteria||""};
  };

  const tasksHtml = (list=[]) => `<div class="ps-tasks">${list.length?list.map((t)=>{const p=taskProgress(t),done=p>=1,linked=(t.roadmapItemIds||[]).length;return `<label class="ps-task ${done?"done":""}"><input type="checkbox" data-ps-task="${escapeHub(t.id)}" ${done?"checked":""}><span class="ps-check">${done?"✓":""}</span><span><b>${escapeHub(t.label)}</b><small>${linked?"Counts toward technical progress":"Schedule task"}${p>0&&p<1?` · ${Math.round(p*100)}%`:""}</small></span></label>`}).join(""):`<p class="hub-muted">No tasks scheduled.</p>`}</div>`;

  const chatHtml = () => `<section class="hub-chat-card ps-chat"><header><div><span>Joy project assistant</span><h3>Ask about TurtleBot4</h3></div><i>✦</i></header><div class="hub-chat-suggestions">${["What should I do today?","What should I prepare for the next lab?","Am I on schedule?","How did progress reach this percentage?"].map((q)=>`<button type="button" data-hub-action="ask-suggestion" data-question="${escapeHub(q)}">${escapeHub(q)}</button>`).join("")}</div><div class="hub-chat-log" id="hub-chat-log">${hubState.chat.length?hubState.chat.map((m)=>`<div class="hub-chat-message ${m.role}"><span>${m.role==="joy"?"Joy":"Vanh"}</span><p>${escapeHub(m.text)}</p></div>`).join(""):`<div class="hub-chat-empty"><strong>Project State v2 is active</strong><p>Joy now combines roadmap evidence, the 10-week schedule, lab days and completion gates.</p></div>`}</div><form id="hub-chat-form"><input name="question" autocomplete="off" placeholder="Ask Joy about this project…" required><button type="submit">Send</button></form></section>`;

  function overview(){
    if(!state()){oldPlan();return}
    const s=snapshot(),list=stages(),index=Math.max(0,list.findIndex((x)=>x.id===s.stage?.id))+1;
    const history=state().history||[];
    hubElements.body.innerHTML=`<div class="ps-wrap"><section class="ps-hero"><div><span>Project State v2 · ${escapeHub(fmt(s.date))}</span><h3>${escapeHub(s.week?`Week ${s.week.number}: ${s.week.title}`:"TurtleBot4")}</h3><p>${escapeHub(s.week?.objective||s.stage?.objective||"")}</p></div><b class="ps-status ${s.status.toLowerCase().replaceAll(" ","-")}">${escapeHub(s.status)}</b></section><section class="ps-metrics"><article><span>Overall completion</span><strong>${s.overall}%</strong><small>Active 10-week scope</small></article><article><span>Current week</span><strong>${s.week?.number||"—"}/10</strong><small>${s.weekPct}% weekly tasks</small></article><article><span>Technical stage</span><strong>${index}/${list.length}</strong><small>${escapeHub(s.stage?.shortName||s.stage?.name||"")}</small></article><article><span>Timeline elapsed</span><strong>${s.elapsed}%</strong><small>Time does not add progress</small></article></section><div class="ps-grid"><section class="ps-panel"><div class="ps-title"><div><span>Today</span><h3>${escapeHub(s.todayDay?`${s.todayDay.label} · ${s.todayDay.location}`:"Next planned action")}</h3></div><small>${escapeHub(fmt(s.date,false))}</small></div>${tasksHtml(s.todayDay?.tasks||[s.next?.task].filter(Boolean))}<div class="ps-actions"><button class="hub-primary-button" data-hub-action="add-plan-to-todo">Add next action to To-do</button><a href="${escapeHub(state().project.googleDocUrl)}" target="_blank" rel="noreferrer">Open Google Docs plan ↗</a></div></section><section class="ps-panel"><div class="ps-title"><div><span>Next robot session</span><h3>${escapeHub(s.nextLab?fmt(s.nextLab.date):"No lab session pending")}</h3></div><small>${escapeHub(s.nextLab?.location||"")}</small></div>${tasksHtml((s.nextLab?.tasks||[]).filter((t)=>!taskDone(t)))}</section><section class="ps-panel"><div class="ps-title"><div><span>Current completion gate</span><h3>${escapeHub(s.stage?.name||"Current stage")}</h3></div></div><p>${escapeHub(s.stage?.completionCriteria||"")}</p><ul>${(state().project.currentBlockers||[]).map((x)=>`<li>${escapeHub(x)}</li>`).join("")}</ul></section><section class="ps-panel"><div class="ps-title"><div><span>Scope control</span><h3>Accelerated core thesis</h3></div></div><p>${escapeHub(state().scope.excludedReason)}</p><p><b>${state().scope.objectClassLimit}</b> object classes · <b>${state().scope.environmentLimit}</b> experiment environment · Saturday only as buffer.</p></section></div><section class="ps-history"><div class="ps-title"><div><span>Progress history</span><h3>From 0% to today</h3></div><small>Evidence-backed only</small></div><div class="ps-timeline">${history.map((h)=>`<article><div><small>${escapeHub(fmt(h.date,false))}</small><b>${escapeHub(h.title)}</b><p>${escapeHub(h.detail)}</p></div><em>${h.progressAfter}%</em></article>`).join("")}</div></section>${chatHtml()}</div>`;
  }

  function schedule(){
    if(!state()){hubElements.body.innerHTML=`<div class="hub-loading"><span></span><strong>Loading plan…</strong></div>`;return}
    const s=snapshot();
    hubElements.body.innerHTML=`<div class="ps-schedule"><header><div><span>10-week execution plan</span><h3>27 Jul – 4 Oct 2026</h3><p>Home preparation Monday–Tuesday, robot work Wednesday–Thursday, Saturday only as a controlled buffer.</p></div><a href="${escapeHub(state().project.googleDocUrl)}" target="_blank" rel="noreferrer">Open source plan ↗</a></header><div class="ps-weeks">${weeks().map((w)=>{const p=weekProgress(w),cur=w.number===s.week?.number;return `<details class="ps-week ${cur?"current":""}" ${cur?"open":""}><summary><span class="ps-num">${w.number}</span><span><b>${escapeHub(w.title)}</b><small>${escapeHub(fmt(w.start,false))} – ${escapeHub(fmt(w.end,false))}</small></span><span class="ps-bar">${p}%<i><em style="width:${p}%"></em></i></span></summary><div class="ps-week-body"><p>${escapeHub(w.objective)} <b>Deliverable:</b> ${escapeHub(w.deliverable)}</p><div class="ps-days">${(w.days||[]).map((d)=>`<article class="ps-day ${d.date===s.date?"today":""} ${d.optional?"optional":""}"><header><b>${escapeHub(d.label)} · ${escapeHub(fmt(d.date,false))}</b><span>${escapeHub(d.location)} · ${dayProgress(d)}%</span></header>${tasksHtml(d.tasks||[])}</article>`).join("")}</div></div></details>`}).join("")}</div></div>`;
  }

  renderPlan=overview;
  renderHub=()=>{
    hubElements.tabs.forEach((b)=>{const active=b.dataset.hubTab===hubState.activeTab;b.classList.toggle("active",active);b.setAttribute("aria-selected",String(active))});updateHubStatus();
    if(!hubState.source){hubElements.body.innerHTML=`<div class="hub-loading"><span></span><strong>Connecting TurtleBot project…</strong></div>`;return}
    if(hubState.activeTab==="schedule")schedule();else if(hubState.activeTab==="plan")overview();else if(hubState.activeTab==="commands")renderCommands();else if(hubState.activeTab==="journal")renderJournal();else if(hubState.activeTab==="roadmap")renderRoadmap();else oldHub();
  };

  updateTurtleBotCard=()=>{
    if(!state()||!hubState.source){oldCard();return}
    const card=findTurtleBotCard();if(!card)return;const s=snapshot(),list=stages(),index=Math.max(0,list.findIndex((x)=>x.id===s.stage?.id))+1;
    card.querySelector(".project-top span").textContent=`${s.overall}%`;card.querySelector(".progress-track span").style.width=`${s.overall}%`;
    const dd=card.querySelectorAll("dl dd");if(dd[0])dd[0].textContent=(s.todayDay?.tasks||[]).find((t)=>!taskDone(t))?.label||s.next?.task.label||s.stage?.objective||"";if(dd[1])dd[1].textContent=s.next?.task.label||"Review the next completion gate";
    const pill=card.querySelector(".project-stage-pill");if(pill)pill.textContent=`Week ${s.week?.number||"—"} of 10 · Stage ${index} of ${list.length}`;
    let source=card.querySelector(".project-git-source");if(!source){source=document.createElement("span");source.className="project-git-source";card.append(source)}source.textContent=`Project State v2 · ${s.status} · ${hubState.sourceMode==="github"?"GitHub live":"Snapshot"}`;
  };

  const isVi=(q)=>/[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]|\b(tôi|hôm nay|tiến độ|tuần|chuẩn bị|ở nhà|sắp tới)\b/i.test(q);
  answerProjectQuestion=(q)=>{
    if(!state())return oldAnswer(q);const v=String(q).toLowerCase(),vi=isVi(q),s=snapshot(),next=s.next?.task.label||"No pending task",stage=`${s.stage?.name||"Stage"} (${s.stage?.progress||0}%)`;
    if(/today|hôm nay|làm gì/.test(v)){const t=(s.todayDay?.tasks||[]).filter((x)=>!taskDone(x));return vi?`Hôm nay ${fmt(s.date)}, bạn ở Tuần ${s.week?.number||"—"}, ${stage}. Việc cần làm: ${(t.length?t:[s.next?.task].filter(Boolean)).map((x)=>x.label).join("; ")}.`:`Today is ${fmt(s.date)}. You are in Week ${s.week?.number||"—"}, ${stage}. Focus on: ${(t.length?t:[s.next?.task].filter(Boolean)).map((x)=>x.label).join("; ")}.`}
    if(/lab|chuẩn bị/.test(v)){const text=(s.nextLab?.tasks||[]).filter((x)=>!taskDone(x)).map((x)=>x.label).join("; ");return vi?`Buổi lab tiếp theo: ${s.nextLab?fmt(s.nextLab.date):"không còn"}. ${text}`:`Next lab: ${s.nextLab?fmt(s.nextLab.date):"none pending"}. ${text}`}
    if(/progress|percent|%|tiến độ|từ 0/.test(v))return vi?`Tiến độ là ${s.overall}% trong phạm vi 10 tuần; ${stage}; Tuần ${s.week?.number||"—"} đạt ${s.weekPct}%. Thời gian đã trôi ${s.elapsed}% nhưng không tự cộng tiến độ.`:`Completion is ${s.overall}% for the active 10-week scope; ${stage}; Week ${s.week?.number||"—"} is ${s.weekPct}%. Timeline elapsed is ${s.elapsed}% but never adds completion.`;
    if(/schedule|track|late|behind|chậm|đúng tiến độ/.test(v))return vi?`Trạng thái lịch: ${s.status}. Có ${s.overdue.length} việc quá hạn. Việc tiếp theo: ${next}.`:`Schedule: ${s.status}. ${s.overdue.length} overdue tasks. Next: ${next}.`;
    if(/blocker|gate|điều kiện|vướng/.test(v))return vi?`Completion gate: ${s.stage?.completionCriteria}. Vướng mắc: ${(state().project.currentBlockers||[]).join("; ")}.`:`Completion gate: ${s.stage?.completionCriteria}. Blockers: ${(state().project.currentBlockers||[]).join("; ")}.`;
    return vi?`Joy đang theo dõi ${s.overall}%, Tuần ${s.week?.number||"—"} (${s.weekPct}%), ${stage}, trạng thái ${s.status}. Tiếp theo: ${next}.`:`Joy is tracking ${s.overall}%, Week ${s.week?.number||"—"} (${s.weekPct}%), ${stage}, status ${s.status}. Next: ${next}.`;
  };

  const taskById=(id)=>{for(const w of weeks())for(const d of w.days||[]){const t=(d.tasks||[]).find((x)=>x.id===id);if(t)return t}return null};
  document.addEventListener("change",(e)=>{const input=e.target.closest?.("[data-ps-task]");if(!input)return;const task=taskById(input.dataset.psTask);if(!task)return;hubState.overrides.planTasks||={};const ids=task.roadmapItemIds||[];if(ids.length){delete hubState.overrides.planTasks[task.id];ids.forEach((id)=>hubState.overrides.checklist[id]=input.checked)}else hubState.overrides.planTasks[task.id]=input.checked;scheduleHubSave();updateTurtleBotCard();renderHub()});

  const oldButton=document.querySelector('[data-hub-tab="plan"]');
  if(oldButton&&!document.querySelector("[data-ps-overview]")){
    oldButton.dataset.hubTab="schedule";oldButton.textContent="10-Week Plan";
    const button=document.createElement("button");button.type="button";button.dataset.hubTab="plan";button.dataset.psOverview="1";button.textContent="Overview";button.setAttribute("aria-selected","false");
    oldButton.parentElement.insertBefore(button,oldButton.parentElement.firstElementChild);hubElements.tabs.unshift(button);if(!HUB_TABS.includes("schedule"))HUB_TABS.push("schedule");
    button.addEventListener("click",()=>{hubState.activeTab="plan";renderHub()});
  }

  fetchHubJson(URL).then((data)=>{
    if(data?.schemaVersion!==2)throw new Error("Unsupported Project State schema");
    hubState.projectState=data;hubState.overrides=normalizeOverrides(hubState.overrides);storeLocalOverrides();hubState.activeTab="plan";updateTurtleBotCard();if(!hubElements.modal?.hidden)renderHub();
  }).catch((error)=>{hubState.saveStatus="Project State unavailable";hubState.projectStateError=error.message;updateHubStatus()});
})();