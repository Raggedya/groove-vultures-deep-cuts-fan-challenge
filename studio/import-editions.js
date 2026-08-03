const state={token:"",file:null,preflight:null,batch:null,selected:new Set(),toastTimer:null};
const $=selector=>document.querySelector(selector);
const els={file:$("#import-file"),run:$("#run-preflight"),uploadState:$("#upload-state"),fileNote:$("#file-note"),preflightPanel:$("#preflight-panel"),summary:$("#summary-grid"),errorReport:$("#error-report"),rows:$("#preflight-rows"),tableNote:$("#table-note"),selectVisible:$("#select-visible"),selectionCount:$("#selection-count"),commitPanel:$("#commit-panel"),confirm:$("#confirm-import"),commit:$("#commit-import"),mode:$("#import-mode"),maximum:$("#import-maximum"),iconMappings:$("#icon-mappings"),actionMappings:$("#action-mappings"),resultsPanel:$("#results-panel"),resultSummary:$("#result-summary"),resultList:$("#result-list"),reconciliation:$("#reconciliation-report"),rollback:$("#rollback-batch"),toast:$("#toast"),filters:{entityGroup:$("#filter-group"),category:$("#filter-category"),subcategory:$("#filter-subcategory"),country:$("#filter-country"),stateOrRegion:$("#filter-state"),readinessStatus:$("#filter-readiness")}};

init().catch(error=>notify(error.message));

async function init(){
  const bootstrap=await api("/api/studio/bootstrap",null,{method:"GET",token:false});
  state.token=bootstrap.token;
  els.file.addEventListener("change",chooseFile);
  els.run.addEventListener("click",runPreflight);
  Object.values(els.filters).forEach(filter=>filter.addEventListener("change",renderRows));
  els.selectVisible.addEventListener("change",toggleVisible);
  els.confirm.addEventListener("change",updateCommitState);
  els.commit.addEventListener("click",commitImport);
  els.errorReport.addEventListener("click",event=>downloadReport(event,`/api/studio/imports/preflights/${state.preflight.id}/errors.csv`,`${state.preflight.id}-errors.csv`));
  els.reconciliation.addEventListener("click",event=>downloadReport(event,`/api/studio/imports/batches/${state.batch.id}/report.csv`,`${state.batch.id}-reconciliation.csv`));
  els.rollback.addEventListener("click",rollbackBatch);
}

function chooseFile(){
  state.file=els.file.files?.[0]||null;
  els.run.disabled=!state.file;
  els.fileNote.textContent=state.file?`${state.file.name} · ${formatBytes(state.file.size)} · ready for read-only preflight`:"Maximum 30 MB · maximum 5,000 source rows · maximum 1,000 drafts per commit";
  els.uploadState.textContent=state.file?"FILE READY":"WAITING";
}

async function runPreflight(){
  if(!state.file)return;
  setBusy(els.run,true,"CHECKING EVERY ROW");
  try{
    const result=await api("/api/studio/imports/preflight",state.file,{headers:{"x-studio-file-name":encodeURIComponent(state.file.name)},raw:true});
    state.preflight=result.preflight;state.batch=null;state.selected.clear();
    els.uploadState.textContent="PREFLIGHT COMPLETE";
    renderPreflight();
    notify(`Preflight checked ${state.preflight.counts.total} records. No drafts were created.`);
  }catch(error){notify(error.message);els.uploadState.textContent="CHECK INPUT"}
  finally{setBusy(els.run,false,"RUN PREFLIGHT")}
}

function renderPreflight(){
  const report=state.preflight;
  els.preflightPanel.hidden=false;els.commitPanel.hidden=false;els.resultsPanel.hidden=true;
  els.summary.replaceChildren(
    summaryCard("Rows found",report.counts.total),summaryCard("Valid",report.counts.valid,"valid"),summaryCard("Warnings",report.counts.warnings,"warning"),summaryCard("Invalid",report.counts.invalid,"invalid"),summaryCard("New",report.counts.new),summaryCard("Existing",report.counts.existing)
  );
  populateFilter(els.filters.entityGroup,"All entity groups",report.facets.entityGroups);
  populateFilter(els.filters.category,"All categories",report.facets.categories);
  populateFilter(els.filters.subcategory,"All subcategories",report.facets.subcategories);
  populateFilter(els.filters.country,"All countries",report.facets.countries);
  populateFilter(els.filters.stateOrRegion,"All states / regions",report.facets.statesOrRegions);
  populateFilter(els.filters.readinessStatus,"All readiness states",report.facets.readinessStatuses);
  els.errorReport.hidden=!(report.counts.invalid||report.counts.warnings);
  els.iconMappings.textContent=Object.entries(report.mappings.icons).map(([source,target])=>`${source} → ${target}`).join("\n");
  els.actionMappings.textContent=Object.entries(report.mappings.actions).map(([source,target])=>`${source} → ${target}`).join("\n");
  renderRows();
  els.preflightPanel.scrollIntoView({behavior:reducedMotion()?"auto":"smooth",block:"start"});
}

function filteredRows(){
  if(!state.preflight)return[];
  return state.preflight.rows.filter(row=>Object.entries(els.filters).every(([key,field])=>!field.value||row[key]===field.value));
}

function renderRows(){
  const rows=filteredRows(),shown=rows.slice(0,300);
  els.rows.replaceChildren(...shown.map(row=>{
    const tr=document.createElement("tr");tr.className=row.status;
    const selection=document.createElement("td"),check=document.createElement("input");check.type="checkbox";check.className="row-check";check.checked=state.selected.has(row.recordId);check.disabled=!row.valid;check.setAttribute("aria-label",`Select ${row.displayName}`);check.addEventListener("change",()=>{check.checked?state.selected.add(row.recordId):state.selected.delete(row.recordId);updateSelectionState()});selection.append(check);
    tr.append(selection,cell(row.rowNumber),identityCell(row),cell(`${row.entityGroup}\n${row.category} · ${row.subcategory}`),buttonsCell(row.buttons),issuesCell(row));return tr;
  }));
  els.tableNote.textContent=rows.length>shown.length?`Showing the first ${shown.length} of ${rows.length} filtered rows. Selection tools still apply to all ${rows.length} filtered rows.`:`Showing ${rows.length} filtered row${rows.length===1?"":"s"}.`;
  updateSelectionState();
}

function toggleVisible(){
  const eligible=filteredRows().filter(row=>row.valid);
  for(const row of eligible){if(els.selectVisible.checked)state.selected.add(row.recordId);else state.selected.delete(row.recordId)}
  renderRows();
}

function updateSelectionState(){
  const eligible=filteredRows().filter(row=>row.valid),selectedVisible=eligible.filter(row=>state.selected.has(row.recordId)).length;
  els.selectVisible.checked=Boolean(eligible.length&&selectedVisible===eligible.length);
  els.selectVisible.indeterminate=selectedVisible>0&&selectedVisible<eligible.length;
  els.selectionCount.textContent=`${state.selected.size} selected · ${eligible.length} eligible in current filter`;
  updateCommitState();
}

function updateCommitState(){els.commit.disabled=!(state.preflight&&state.selected.size&&els.confirm.checked)}

async function commitImport(){
  setBusy(els.commit,true,"CREATING LOCAL DRAFTS");
  try{
    const result=await api(`/api/studio/imports/preflights/${state.preflight.id}/commit`,{selectedRecordIds:[...state.selected],mode:els.mode.value,maximum:Number(els.maximum.value),confirmed:true});
    state.batch=result.batch;renderResults();notify(`Import batch ${state.batch.id} reconciled. Nothing was published.`);
  }catch(error){notify(error.message)}finally{setBusy(els.commit,false,"IMPORT SELECTED DRAFTS");updateCommitState()}
}

function renderResults(){
  const batch=state.batch,counts=batch.counts;
  els.resultsPanel.hidden=false;
  els.resultSummary.replaceChildren(summaryCard("Attempted",counts.attempted),summaryCard("Created",counts.created,"valid"),summaryCard("Updated",counts.updated),summaryCard("Skipped",counts.skipped,"warning"),summaryCard("Warnings",counts.warnings,"warning"),summaryCard("Failed",counts.failed,"invalid"));
  els.resultList.replaceChildren(...batch.results.map(result=>{
    const row=document.createElement("div");row.className="result-row";
    const copy=document.createElement("div"),name=document.createElement("strong"),detail=document.createElement("small");name.textContent=result.displayName;detail.textContent=`${result.recordId} · ${result.status}${result.errors.length?` · ${result.errors.join(" | ")}`:""}`;copy.append(name,detail);row.append(copy);
    if(result.projectId){const link=document.createElement("a");link.href=`/studio/?project=${encodeURIComponent(result.projectId)}`;link.target="_blank";link.rel="noopener";link.textContent="OPEN DRAFT";row.append(link)}
    return row;
  }));
  els.resultsPanel.scrollIntoView({behavior:reducedMotion()?"auto":"smooth",block:"start"});
}

async function rollbackBatch(){
  if(!state.batch)return;
  const required=`ROLLBACK ${state.batch.id}`;
  const confirmation=window.prompt(`This archives newly created drafts and restores updated drafts. Type exactly:\n${required}`)||"";
  if(confirmation!==required)return notify("Rollback cancelled. The confirmation did not match.");
  setBusy(els.rollback,true,"ROLLING BACK");
  try{const result=await api(`/api/studio/imports/batches/${state.batch.id}/rollback`,{confirmation});state.batch=result.batch;els.rollback.disabled=true;els.rollback.textContent="ROLLBACK COMPLETE";notify("The import batch was rolled back recoverably.")}
  catch(error){notify(error.message)}finally{if(!els.rollback.disabled)setBusy(els.rollback,false,"ROLL BACK THIS BATCH")}
}

async function downloadReport(event,url,fileName){
  event.preventDefault();
  try{
    const response=await fetch(url,{headers:{"x-deep-cuts-studio-token":state.token}});
    if(!response.ok){const result=await response.json().catch(()=>({}));throw new Error(result.error||"Report download failed.")}
    const href=URL.createObjectURL(await response.blob()),anchor=document.createElement("a");anchor.href=href;anchor.download=fileName;anchor.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
  }catch(error){notify(error.message)}
}

async function api(url,body,{method="POST",headers={},raw=false,token=true}={}){
  const options={method,headers:{...headers}};if(token)options.headers["x-deep-cuts-studio-token"]=state.token;
  if(body!==null&&body!==undefined){if(raw)options.body=body;else{options.headers["content-type"]="application/json";options.body=JSON.stringify(body)}}
  const response=await fetch(url,options),result=await response.json().catch(()=>({ok:false,error:`Studio returned ${response.status}.`}));
  if(!response.ok||result.ok===false)throw new Error(result.error||"Studio import request failed.");return result;
}

function populateFilter(select,label,values){select.replaceChildren(option("",label),...values.map(value=>option(value,value)))}
function option(value,label){const node=document.createElement("option");node.value=value;node.textContent=label;return node}
function summaryCard(label,value,stateClass=""){const card=document.createElement("div");card.className=`summary-card ${stateClass}`;const small=document.createElement("span"),strong=document.createElement("strong");small.textContent=label;strong.textContent=String(value);card.append(small,strong);return card}
function cell(value){const td=document.createElement("td");String(value??"").split("\n").forEach((line,index)=>{const node=document.createElement(index?"small":"strong");node.textContent=line;td.append(node)});return td}
function identityCell(row){const td=document.createElement("td"),strong=document.createElement("strong"),small=document.createElement("small");strong.textContent=row.displayName;small.textContent=`${row.recordId} · ${row.editionSlug}${row.existing?" · EXISTING":" · NEW"}`;td.append(strong,small);return td}
function buttonsCell(buttons){const td=document.createElement("td");for(const button of buttons){const chip=document.createElement("span");chip.className="button-chip";chip.textContent=`${button.slot}. ${button.iconKey} · ${button.label}`;td.append(chip)}return td}
function issuesCell(row){const td=document.createElement("td");if(!row.errors.length&&!row.warnings.length){td.textContent="READY";return td}for(const issue of [...row.errors,...row.warnings]){const node=document.createElement("span");node.className=`issue ${row.errors.includes(issue)?"":"warning"}`;node.textContent=issue.message;td.append(node)}return td}
function setBusy(button,busy,label){button.disabled=busy;if(label)button.textContent=label}
function notify(message){clearTimeout(state.toastTimer);els.toast.textContent=message;els.toast.classList.add("show");state.toastTimer=setTimeout(()=>els.toast.classList.remove("show"),5000)}
function formatBytes(value){return value<1024*1024?`${Math.round(value/1024)} KB`:`${(value/1024/1024).toFixed(1)} MB`}
function reducedMotion(){return matchMedia("(prefers-reduced-motion: reduce)").matches}
