const $=selector=>document.querySelector(selector);
const views=["selectionView","resultView","dataView","adminView"];
let latest=null;

initialize();
async function initialize(){
  const today=new Date();$("#raceDate").value=today.toISOString().slice(0,10);$("#raceDate").min=today.toISOString().slice(0,10);
  for(let n=1;n<=12;n++)$("#raceNumber").add(new Option(`Race ${n}`,String(n)));
  await loadCourses("");
  $("#raceLocation").addEventListener("input",event=>loadCourses(event.target.value));
  $("#raceForm").addEventListener("submit",analyse);
  $("#openData").addEventListener("click",()=>{renderData(latest?.dataAudit);show("dataView")});
  $("#openAdmin").addEventListener("click",()=>show("adminView"));
  $("#adminForm").addEventListener("submit",openDashboard);
  document.addEventListener("click",event=>{const target=event.target.closest("[data-view]");if(target)show(target.dataset.view)});
}
async function loadCourses(q){try{const data=await fetch(`/api/racing/courses?q=${encodeURIComponent(q)}`).then(r=>r.json());$("#courseSuggestions").replaceChildren(...data.courses.map(name=>new Option(name)))}catch{}}
async function analyse(event){
  event.preventDefault();const button=$("#analyseButton"),status=$("#status");button.disabled=true;status.className="status";status.textContent="Confirming the race and collecting current evidence…";
  try{
    const response=await fetch("/api/racing/analyse",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({date:$("#raceDate").value,location:$("#raceLocation").value,raceNumber:Number($("#raceNumber").value)})});
    const data=await response.json();if(!response.ok)throw new Error(data.noClearSelection?`NO CLEAR SELECTION — ${data.error}`:data.error||"Analysis failed.");latest=data;renderResult(data);show("resultView");status.textContent="";
  }catch(error){status.className="status error";status.textContent=error.message}finally{button.disabled=false}
}
function renderResult(data){
  const race=data.race;$("#raceHeader").innerHTML=`<p class="eyebrow">${esc(race.location)} · Race ${race.raceNumber}</p><h2 id="resultTitle">${esc(race.raceName)}</h2><div class="race-meta">${[race.date,race.scheduledTime,`${race.distanceMetres||"—"}m`,race.raceClass||"Class unavailable",race.trackCondition||"Track unavailable",`${race.fieldSize} runners`,`Updated ${formatDate(race.lastUpdated)}`].map(x=>`<span>${esc(x)}</span>`).join("")}</div>`;
  if(data.status!=="selection"){$("#selectionCard").innerHTML=`<p class="eyebrow">No clear selection</p><h2>Analysis abstained</h2><p>${esc(data.abstainReasons.join(" "))}</p>`}else{
    const s=data.selection;$("#selectionCard").innerHTML=`<p class="eyebrow">Most likely winner</p><h2>${esc(s.horseName)}</h2><p class="runner-line">No. ${esc(s.runnerNumber)} · Barrier ${esc(s.barrier||"—")} · ${esc(s.jockey||"Jockey unavailable")} · ${esc(s.trainer||"Trainer unavailable")}${s.currentOdds?` · Odds ${esc(s.currentOdds)}`:""}</p><div class="probabilities"><div class="probability"><strong>${s.winProbability}%</strong><span>Win probability</span></div><div class="probability"><strong>${s.topThreeProbability}%</strong><span>Top-three probability</span></div><div class="probability"><strong>${esc(data.confidence)}</strong><span>Analysis confidence</span></div></div><p class="runner-line">Main danger: <strong>${esc(data.mainDanger?.horseName)}</strong> · Strongest place chance: <strong>${esc(data.strongestPlace?.horseName)}</strong></p>`;
  }
  $("#verdict").textContent=data.verdict;list("#strengths",data.supportingFactors);list("#risks",data.risks);
  $("#topThree").innerHTML=data.topThree.map(runnerCard).join("");$("#fullField").innerHTML=data.fullField.map(runnerCard).join("");
  const tips=data.tipsters;$("#tipsters").innerHTML=`<p><strong>${tips.uniqueTipsters}</strong> unique tipsters reviewed.</p><p>${tips.consensusHorse?`Consensus: <strong>${esc(tips.consensusHorse)}</strong> (${tips.consensusPercentage}%) — ${esc(tips.agreement)}.`:"Insufficient legally accessible tipster information."}</p><p>${tips.consensusRunnerId&&data.selection?tips.consensusRunnerId===data.selection.runnerId?"Media consensus agrees with Deep Cuts Racing.":"Media consensus differs from Deep Cuts Racing.":"No reliable comparison is available."}</p><p>${esc(data.market.comparison)}</p>`;
}
function renderData(audit){
  const empty={considered:0,potential:0,unavailable:0,sourcesConsulted:0,tipstersReviewed:0,sections:{},calculations:[],materialUncertainties:["Run an analysis to see race-specific evidence."]};audit=audit||empty;$("#usedCount").textContent=audit.considered;
  $("#dataSummary").innerHTML=[[audit.potential,"Potential"],[audit.considered,"Usable"],[audit.unavailable,"Unavailable"],[audit.sourcesConsulted,"Sources"],[audit.tipstersReviewed,"Tipsters"]].map(([v,l])=>`<div class="metric"><strong>${v}</strong><span>${l}</span></div>`).join("");
  const categories=["race_details","recent_form","distance","track","condition","weather","class","barrier_pace","weight","jockey","trainer","sectionals","official_reports","market","tipsters_media","final_calculations","risks_uncertainties"];
  $("#dataSections").innerHTML=categories.map(category=>{let points=audit.sections?.[category]||[];if(category==="final_calculations")points=(audit.calculations||[]).map(label=>({label}));if(category==="risks_uncertainties")points=(audit.materialUncertainties||[]).map(label=>({label}));return`<details><summary>${esc(category.replaceAll("_"," "))} (${points.length})</summary>${points.length?points.map(p=>`<div class="data-point"><strong>${esc(p.horseName||"")}</strong> ${esc(p.label)}${p.value!==undefined?`: ${esc(p.value)}`:""}${p.sourceName?` · ${esc(p.sourceName)}`:""}</div>`).join(""):'<div class="data-point">Unavailable for this race.</div>'}</details>`}).join("");
}
async function openDashboard(event){event.preventDefault();const token=$("#adminToken").value;const response=await fetch("/api/racing/dashboard",{headers:{authorization:`Bearer ${token}`}});if(!response.ok){alert("The admin token was not accepted.");return}const data=await response.json(),s=data.summary;$("#adminForm").hidden=true;$("#dashboard").hidden=false;$("#dashboardMetrics").innerHTML=[[s.total_races,"Races analysed"],[`${s.winner_strike_rate}%`,"Winner strike rate"],[`${s.predicted_winner_top_three_rate}%`,"Selection top-three"],[s.top_three_hits,"Top-three hits"]].map(([v,l])=>`<div class="metric"><strong>${v||0}</strong><span>${l}</span></div>`).join("");$("#dashboardBreakdowns").innerHTML=Object.entries(data.breakdowns||{}).map(([name,rows])=>`<details><summary>${esc(name.replaceAll("_"," "))}</summary>${rows.length?rows.map(row=>`<div class="data-point">${esc(Object.values(row).join(" · "))}</div>`).join(""):"<div class=\"data-point\">No completed results yet.</div>"}</details>`).join("");$("#historyRows").innerHTML=data.history.map(row=>`<tr><td>${esc(row.race_date)} ${esc(row.location)} R${row.race_number}</td><td>${esc(row.predicted_winner_id||"Abstained")}</td><td>${esc(row.winner_id||"Pending")}</td><td>${esc(row.predicted_top_three_hits??"—")}</td></tr>`).join("");$("#exportCsv").onclick=event=>downloadCsv(event,token)}
async function downloadCsv(event,token){event.preventDefault();const response=await fetch("/api/racing/export.csv",{headers:{authorization:`Bearer ${token}`}});const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="deep-cuts-racing-performance.csv";a.click();URL.revokeObjectURL(url)}
function show(id){views.forEach(view=>$("#"+view).classList.toggle("active",view===id));scrollTo({top:0,behavior:"smooth"})}
function runnerCard(item){return`<article class="runner-card"><div class="rank">${item.rank||"—"}</div><div><h3>${esc(item.horseName)}</h3><p>Strength: ${esc(item.keyStrength)}</p><p>Risk: ${esc(item.keyRisk)}</p></div><div class="chance">${item.winProbability}%<small>win</small>${item.topThreeProbability}%<small>top 3</small></div></article>`}
function list(selector,items){$(selector).innerHTML=(items?.length?items:["No verified item available."]).map(item=>`<li>${esc(item)}</li>`).join("")}
function formatDate(value){if(!value)return"unavailable";return new Date(value).toLocaleString("en-AU",{dateStyle:"medium",timeStyle:"short"})}
function esc(value){return String(value??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
