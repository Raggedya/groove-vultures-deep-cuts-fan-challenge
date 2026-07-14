"use strict";
const tableBody=document.querySelector("#analyticsTable tbody");
const scopeText=document.getElementById("analyticsScope");
const exportButton=document.getElementById("exportAnalytics");
const percent=value=>`${(value*100).toFixed(1)}%`;

initReport();
async function initReport(){
  let events=DeepCutsAnalytics.Tracker.storedEvents();
  let scope="This browser only";
  try{
    const platform=await fetch("platform.json",{cache:"no-store"}).then(response=>response.json());
    const endpoint=String(platform.analytics?.reportingEndpoint||"").trim();
    if(/^https:\/\//i.test(endpoint)){
      const remote=await fetch(endpoint,{credentials:"omit",cache:"no-store"}).then(response=>{if(!response.ok)throw new Error("Reporting endpoint unavailable");return response.json()});
      if(Array.isArray(remote.events)){events=remote.events;scope="All recorded visitors"}
    }
  }catch{}
  const rows=DeepCutsReporting.aggregate(events);
  scopeText.textContent=`${scope} · ${events.length} stored event${events.length===1?"":"s"}`;
  if(!rows.length){tableBody.innerHTML='<tr><td colspan="18">No analytics events have been recorded in this reporting scope yet.</td></tr>';return}
  tableBody.innerHTML=rows.map(row=>`<tr><th>${escapeHtml(row.bandName)}</th><td>${row.pageViews}</td><td>${row.quizStarts}</td><td>${row.quizCompletions}</td><td>${percent(row.completionRate)}</td><td>${row.averageScore.toFixed(1)}</td><td>${row.shareActions}</td><td>${percent(row.shareRate)}</td><td>${row.totalOutboundClicks}</td><td>${row.spotifyClicks}</td><td>${row.bandcampClicks}</td><td>${row.instagramClicks}</td><td>${row.youtubeClicks}</td><td>${row.otherSocialClicks}</td><td>${row.websiteClicks}</td><td>${row.ticketClicks}</td><td>${row.merchandiseClicks}</td><td>${percent(row.outboundClickThroughRate)}</td></tr>`).join("");
}
function escapeHtml(value){const span=document.createElement("span");span.textContent=value;return span.innerHTML}
exportButton.addEventListener("click",()=>{
  const events=DeepCutsAnalytics.Tracker.storedEvents();
  const blob=new Blob([JSON.stringify(events,null,2)],{type:"application/json"});
  const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`deep-cuts-analytics-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(link.href);
});
