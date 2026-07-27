const LANEWAY_EDITION_ID="dc_b9e7b66620";
const LANEWAY_ROSTER_PATH="/editions/laneway-music-one-off/roster.json";
const REPORTING_VERSION="laneway-weekly-v1";
const MAX_REPORT_EVENTS=50000;
const encoder=new TextEncoder();

export async function buildLanewayWeeklyReport(env,now=new Date(),days=7){
  const end=new Date(now),start=new Date(end.getTime()-days*86400000),previousStart=new Date(start.getTime()-days*86400000);
  const [roster,events]=await Promise.all([loadRoster(env),loadEvents(env,previousStart,end)]);
  const currentEvents=events.filter(event=>event.occurredAt>=start&&event.occurredAt<end);
  const previousEvents=events.filter(event=>event.occurredAt>=previousStart&&event.occurredAt<start);
  const current=aggregatePeriod(currentEvents,roster);
  const previous=aggregatePeriod(previousEvents,roster);
  const artists=roster.map(name=>{
    const active=current.artists.get(name)||emptyArtist(name),prior=previous.artists.get(name)||emptyArtist(name);
    return{artist:name,wheelResults:active.wheelResults,wheelSpotifyClicks:active.wheelSpotifyClicks,directorySpotifyClicks:active.directorySpotifyClicks,
      totalSpotifyClicks:active.totalSpotifyClicks,uniqueSpotifyClickers:active.uniqueSpotifyClickers.size,previousSpotifyClicks:prior.totalSpotifyClicks,
      wheelConversion:active.wheelResults?active.wheelSpotifyClicks/active.wheelResults:0};
  });
  const topArtists=[...artists].sort((a,b)=>b.totalSpotifyClicks-a.totalSpotifyClicks||b.wheelResults-a.wheelResults||a.artist.localeCompare(b.artist)).slice(0,7);
  return{
    editionId:LANEWAY_EDITION_ID,brandName:"Laneway Music",reportingVersion:REPORTING_VERSION,generatedAt:end.toISOString(),
    periodStart:start.toISOString(),periodEnd:end.toISOString(),previousStart:previousStart.toISOString(),days,
    periodLabel:`${formatDate(start)} - ${formatDate(new Date(end.getTime()-1))}`,
    current:current.summary,previous:previous.summary,artists,topArtists,quizQuestions:current.quizQuestions,
    acquisition:current.acquisition,devices:current.devices,regions:current.regions,eventAudit:mergeEventAudit(current.eventAudit,previous.eventAudit),
    dataQuality:{eventCount:currentEvents.length,enhancedEventCount:currentEvents.filter(event=>event.metadata.tracking_version===REPORTING_VERSION).length,
      note:"Artist-level wheel and quiz reporting reflects events received after the enhanced Laneway tracking contract was deployed."}
  };
}

export function aggregateLanewayEvents(events,roster,now=new Date(),days=7){
  const end=new Date(now),start=new Date(end.getTime()-days*86400000),previousStart=new Date(start.getTime()-days*86400000);
  const normalized=events.map(normalizeEvent);
  const current=aggregatePeriod(normalized.filter(event=>event.occurredAt>=start&&event.occurredAt<end),roster);
  const previous=aggregatePeriod(normalized.filter(event=>event.occurredAt>=previousStart&&event.occurredAt<start),roster);
  return{current,previous};
}

async function loadRoster(env){
  const response=await env.ASSETS.fetch(new Request(`https://deep-cuts.invalid${LANEWAY_ROSTER_PATH}`));
  if(!response.ok)throw new Error("Laneway reporting roster could not be loaded.");
  const data=await response.json(),names=(data.artists||[]).map(item=>String(item.name||"").trim()).filter(Boolean);
  if(!names.length||new Set(names).size!==names.length)throw new Error("Laneway reporting roster is incomplete or duplicated.");
  return names.sort((a,b)=>a.localeCompare(b,"en-AU"));
}

async function loadEvents(env,start,end){
  const result=await env.DB.prepare(`SELECT event_name,occurred_at,session_id,referring_source,device_category,destination_platform,country_code,region_code,metadata_json
    FROM analytics_events WHERE edition_id=?1 AND occurred_at>=?2 AND occurred_at<?3 ORDER BY occurred_at LIMIT ?4`)
    .bind(LANEWAY_EDITION_ID,start.toISOString(),end.toISOString(),MAX_REPORT_EVENTS+1).all();
  const rows=result.results||[];
  if(rows.length>MAX_REPORT_EVENTS)throw new Error("Laneway weekly report exceeded its audited event limit; report generation stopped rather than truncating data.");
  return rows.map(normalizeEvent);
}

function normalizeEvent(event){
  let metadata={};try{metadata=JSON.parse(event.metadata_json||"{}")||{}}catch{}
  return{eventName:String(event.event_name||event.eventName||""),occurredAt:new Date(event.occurred_at||event.occurredAt||0),
    sessionId:String(event.session_id||event.sessionId||""),referringSource:String(event.referring_source||event.referringSource||"direct")||"direct",
    deviceCategory:String(event.device_category||event.deviceCategory||"unknown")||"unknown",destinationPlatform:String(event.destination_platform||event.destinationPlatform||""),
    countryCode:String(event.country_code||event.countryCode||""),regionCode:String(event.region_code||event.regionCode||""),metadata:{...metadata,...(event.metadata||{})}};
}

function aggregatePeriod(events,roster){
  const artistSet=new Set(roster),artists=new Map(roster.map(name=>[name,emptyArtist(name)])),scores=[],questions=new Map(),eventAudit=new Map();
  const visitSessions=new Set(),qrSessions=new Set(),spotifySessions=new Set(),quizStartSessions=new Set(),quizCompleteSessions=new Set();
  const acquisition=new Map(),devices=new Map(),regions=new Map();
  const summary={siteVisits:0,uniqueVisitors:0,qrScans:0,uniqueQrSessions:0,spinButtonPushes:0,wheelResults:0,spotifyClicks:0,uniqueSpotifyClickers:0,
    wheelSpotifyClicks:0,directorySpotifyClicks:0,quizStarts:0,quizCompletions:0,quizAbandonments:0,quizReplays:0,averageQuizScore:0,
    shareButtonPushes:0,completedShares:0,servicesContactClicks:0,contactClicks:0,recommendedClicks:0,directorySearches:0};
  for(const event of events){
    eventAudit.set(event.eventName,(eventAudit.get(event.eventName)||0)+1);
    const meta=event.metadata||{},artist=String(meta.artist_name||"").trim();
    if(event.eventName==="discovery_page_viewed"){
      summary.siteVisits++;if(event.sessionId)visitSessions.add(event.sessionId);
      increment(acquisition,event.referringSource||"direct");increment(devices,event.deviceCategory||"unknown");
      increment(regions,[event.countryCode,event.regionCode].filter(Boolean).join("-")||"Unknown");
    }else if(event.eventName==="qr_scan"){summary.qrScans++;if(event.sessionId)qrSessions.add(event.sessionId)}
    else if(event.eventName==="wheel_spin_started")summary.spinButtonPushes++;
    else if(event.eventName==="wheel_result_shown"){
      summary.wheelResults++;if(artistSet.has(artist))artists.get(artist).wheelResults++;
    }else if(event.eventName==="artist_destination_clicked"&&event.destinationPlatform==="spotify"){
      summary.spotifyClicks++;if(event.sessionId)spotifySessions.add(event.sessionId);
      if(meta.interaction_source==="wheel_winner")summary.wheelSpotifyClicks++;
      if(meta.interaction_source==="artist_directory")summary.directorySpotifyClicks++;
      if(artistSet.has(artist)){
        const row=artists.get(artist);row.totalSpotifyClicks++;
        if(meta.interaction_source==="wheel_winner")row.wheelSpotifyClicks++;
        if(meta.interaction_source==="artist_directory")row.directorySpotifyClicks++;
        if(event.sessionId)row.uniqueSpotifyClickers.add(event.sessionId);
      }
    }else if(event.eventName==="quiz_started"){summary.quizStarts++;if(event.sessionId)quizStartSessions.add(event.sessionId)}
    else if(event.eventName==="quiz_completed"){
      summary.quizCompletions++;if(event.sessionId)quizCompleteSessions.add(event.sessionId);
      const score=Number(meta.final_score);if(Number.isFinite(score))scores.push(score);
    }else if(event.eventName==="quiz_abandoned")summary.quizAbandonments++;
    else if(event.eventName==="quiz_replayed")summary.quizReplays++;
    else if(event.eventName==="quiz_question_answered"){
      const id=String(meta.question_id||"Unknown question"),row=questions.get(id)||{questionId:id,answers:0,correct:0};
      row.answers++;if(meta.correct===true||meta.correct==="true")row.correct++;questions.set(id,row);
    }else if(event.eventName==="share_button_clicked")summary.shareButtonPushes++;
    else if(event.eventName==="native_share_completed")summary.completedShares++;
    else if(event.eventName==="services_contact_clicked")summary.servicesContactClicks++;
    else if(event.eventName==="utility_link_clicked"){
      if(meta.button_name==="record_company_home")summary.contactClicks++;
      if(meta.button_name==="recommended_artists")summary.recommendedClicks++;
    }else if(event.eventName==="artist_directory_searched")summary.directorySearches++;
  }
  summary.uniqueVisitors=visitSessions.size;summary.uniqueQrSessions=qrSessions.size;summary.uniqueSpotifyClickers=spotifySessions.size;
  summary.uniqueQuizStarters=quizStartSessions.size;summary.uniqueQuizCompleters=quizCompleteSessions.size;
  summary.quizCompletionRate=summary.quizStarts?summary.quizCompletions/summary.quizStarts:0;
  summary.spinEngagementRate=summary.siteVisits?summary.spinButtonPushes/summary.siteVisits:0;
  summary.spotifyClickThroughRate=summary.wheelResults?summary.wheelSpotifyClicks/summary.wheelResults:0;
  summary.averageQuizScore=scores.length?scores.reduce((sum,value)=>sum+value,0)/scores.length:0;
  return{summary,artists,quizQuestions:[...questions.values()].map(row=>({...row,accuracy:row.answers?row.correct/row.answers:0})).sort((a,b)=>a.questionId.localeCompare(b.questionId)),
    acquisition:mapRows(acquisition,"source"),devices:mapRows(devices,"device"),regions:mapRows(regions,"region"),eventAudit};
}

function emptyArtist(name){return{artist:name,wheelResults:0,wheelSpotifyClicks:0,directorySpotifyClicks:0,totalSpotifyClicks:0,uniqueSpotifyClickers:new Set()}}
function increment(map,key){map.set(key,(map.get(key)||0)+1)}
function mapRows(map,label){return[...map.entries()].map(([name,count])=>({[label]:name,count})).sort((a,b)=>b.count-a.count||String(a[label]).localeCompare(String(b[label])))}
function mergeEventAudit(current,previous){
  const names=new Set([...current.keys(),...previous.keys()]);
  return[...names].sort().map(eventName=>({eventName,current:current.get(eventName)||0,previous:previous.get(eventName)||0}));
}

export function buildLanewayXlsx(report){
  const sheets=[
    {name:"Dashboard",...dashboardSheet(report)},
    {name:"Artist Performance",...artistSheet(report)},
    {name:"Quiz",...quizSheet(report)},
    {name:"Audience",...audienceSheet(report)},
    {name:"Event Audit",...auditSheet(report)},
    {name:"Definitions",...definitionsSheet(report)}
  ];
  const files=new Map();
  files.set("[Content_Types].xml",contentTypesXml(sheets.length));
  files.set("_rels/.rels",rootRelsXml());
  files.set("docProps/app.xml",appXml(sheets));
  files.set("docProps/core.xml",coreXml(report.generatedAt));
  files.set("xl/workbook.xml",workbookXml(sheets));
  files.set("xl/_rels/workbook.xml.rels",workbookRelsXml(sheets.length));
  files.set("xl/styles.xml",stylesXml());
  sheets.forEach((sheet,index)=>files.set(`xl/worksheets/sheet${index+1}.xml`,worksheetXml(sheet)));
  return zipStore(files);
}

function dashboardSheet(report){
  const metrics=[
    ["Site visits",report.current.siteVisits,report.previous.siteVisits,"Recorded page openings"],
    ["Anonymous unique visitors",report.current.uniqueVisitors,report.previous.uniqueVisitors,"Distinct weekly browser sessions"],
    ["Spin button pushes",report.current.spinButtonPushes,report.previous.spinButtonPushes,"Intentional wheel spins"],
    ["Wheel results shown",report.current.wheelResults,report.previous.wheelResults,"Completed artist selections"],
    ["Spotify clicks",report.current.spotifyClicks,report.previous.spotifyClicks,"Wheel and directory click intent"],
    ["Quiz starts",report.current.quizStarts,report.previous.quizStarts,"Quiz sessions opened"],
    ["Quiz completions",report.current.quizCompletions,report.previous.quizCompletions,"Completed ten-question runs"],
    ["Services contact clicks",report.current.servicesContactClicks,report.previous.servicesContactClicks,"Film, TV or advertising interest"],
    ["Share button pushes",report.current.shareButtonPushes,report.previous.shareButtonPushes,"Share intent"],
    ["QR scans",report.current.qrScans,report.previous.qrScans,"Tracked QR entries"]
  ];
  const rows=[[s("LANEWAY MUSIC - WEEKLY DISCOVERY REPORT",1),blank(),blank(),blank(),blank()],
    [s(`Reporting period: ${report.periodLabel}`,2),blank(),blank(),blank(),blank()],
    [],[s("Executive dashboard",3),blank(),blank(),blank(),blank()],
    [s("Metric",4),s("This week",4),s("Previous week",4),s("Change",4),s("Definition",4)]];
  metrics.forEach((metric,index)=>rows.push([s(metric[0],7),n(metric[1],5),n(metric[2],5),f(`IF(C${index+6}=0,IF(B${index+6}=0,0,1),(B${index+6}-C${index+6})/C${index+6})`,change(metric[1],metric[2]),6),s(metric[3],7)]));
  rows.push([], [s("Key rates",3),blank(),blank(),blank(),blank()],
    [s("Spin engagement",7),n(report.current.spinEngagementRate,6),s("Spins / visits",9),blank(),blank()],
    [s("Wheel-to-Spotify conversion",7),n(report.current.spotifyClickThroughRate,6),s("Winner Spotify clicks / wheel results",9),blank(),blank()],
    [s("Quiz completion",7),n(report.current.quizCompletionRate,6),s("Completions / starts",9),blank(),blank()],
    [s("Average quiz score",7),n(report.current.averageQuizScore,10),s("Out of 10",9),blank(),blank()],
    [],[s("Important: Spotify clicks measure outbound intent, not confirmed streams. Visitor counts are anonymous sessions, not identified people.",9),blank(),blank(),blank(),blank()]);
  return{rows,widths:[31,16,18,14,44],merges:["A1:E1","A2:E2","A4:E4","A17:E17","A23:E23"],freezeRows:5};
}

function artistSheet(report){
  const rows=[[s("ARTIST PERFORMANCE - COMPLETE VERIFIED ROSTER",1),blank(),blank(),blank(),blank(),blank(),blank(),blank(),blank()],
    [s(report.periodLabel,2),blank(),blank(),blank(),blank(),blank(),blank(),blank(),blank()],
    [s("Artist",4),s("Wheel results",4),s("Wheel Spotify",4),s("Directory Spotify",4),s("Total Spotify",4),s("Unique clickers",4),s("Wheel conversion",4),s("Previous total",4),s("WoW",4)]];
  report.artists.forEach((artist,index)=>{
    const row=index+4;
    rows.push([s(artist.artist,7),n(artist.wheelResults,5),n(artist.wheelSpotifyClicks,5),n(artist.directorySpotifyClicks,5),
      f(`C${row}+D${row}`,artist.totalSpotifyClicks,5),n(artist.uniqueSpotifyClickers,5),f(`IF(B${row}=0,0,C${row}/B${row})`,artist.wheelConversion,6),
      n(artist.previousSpotifyClicks,5),f(`IF(H${row}=0,IF(E${row}=0,0,1),(E${row}-H${row})/H${row})`,change(artist.totalSpotifyClicks,artist.previousSpotifyClicks),6)]);
  });
  return{rows,widths:[28,14,16,18,15,16,18,16,13],merges:["A1:I1","A2:I2"],freezeRows:3,autoFilter:`A3:I${rows.length}`};
}

function quizSheet(report){
  const rows=[[s("QUIZ INTELLIGENCE",1),blank(),blank(),blank()],
    [s(report.periodLabel,2),blank(),blank(),blank()],
    [s("Metric",4),s("This week",4),s("Previous week",4),s("Rate / score",4)],
    [s("Quiz starts",7),n(report.current.quizStarts,5),n(report.previous.quizStarts,5),blank()],
    [s("Quiz completions",7),n(report.current.quizCompletions,5),n(report.previous.quizCompletions,5),n(report.current.quizCompletionRate,6)],
    [s("Quiz abandonments",7),n(report.current.quizAbandonments,5),n(report.previous.quizAbandonments,5),blank()],
    [s("Quiz replays",7),n(report.current.quizReplays,5),n(report.previous.quizReplays,5),blank()],
    [s("Average score",7),n(report.current.averageQuizScore,10),n(report.previous.averageQuizScore,10),s("Out of 10",9)],
    [],[s("Question-level response",3),blank(),blank(),blank()],
    [s("Question ID",4),s("Answers",4),s("Correct",4),s("Accuracy",4)]];
  report.quizQuestions.forEach(question=>rows.push([s(question.questionId,7),n(question.answers,5),n(question.correct,5),n(question.accuracy,6)]));
  return{rows,widths:[43,16,18,18],merges:["A1:D1","A2:D2","A10:D10"],freezeRows:3};
}

function audienceSheet(report){
  const rows=[[s("AUDIENCE AND ACQUISITION",1),blank(),blank(),blank()],
    [s(report.periodLabel,2),blank(),blank(),blank()],
    [s("Referring source",4),s("Visits",4),blank(),blank()]];
  report.acquisition.forEach(row=>rows.push([s(row.source,7),n(row.count,5),blank(),blank()]));
  rows.push([], [s("Device",4),s("Visits",4),blank(),blank()]);
  report.devices.forEach(row=>rows.push([s(row.device,7),n(row.count,5),blank(),blank()]));
  rows.push([], [s("Coarse region",4),s("Visits",4),blank(),blank()]);
  report.regions.forEach(row=>rows.push([s(row.region,7),n(row.count,5),blank(),blank()]));
  return{rows,widths:[42,16,18,18],merges:["A1:D1","A2:D2"],freezeRows:3};
}

function auditSheet(report){
  const rows=[[s("EVENT AUDIT",1),blank(),blank()],[s("All accepted events used to reconcile the weekly outputs.",2),blank(),blank()],
    [s("Event",4),s("This week",4),s("Previous week",4)]];
  report.eventAudit.forEach(row=>rows.push([s(row.eventName,7),n(row.current,5),n(row.previous,5)]));
  rows.push([], [s("Enhanced tracking events",7),n(report.dataQuality.enhancedEventCount,5),blank()],
    [s("All report-period events",7),n(report.dataQuality.eventCount,5),blank()],
    [s(report.dataQuality.note,9),blank(),blank()]);
  return{rows,widths:[43,18,18],merges:["A1:C1","A2:C2",`A${rows.length}:C${rows.length}`],freezeRows:3};
}

function definitionsSheet(report){
  const definitions=[
    ["Site visit","A recorded opening of the Laneway discovery page."],["Anonymous unique visitor","A distinct browser session during the reporting period; no person is identified."],
    ["Spin button push","A user-initiated wheel spin."],["Wheel result","An artist selection shown after a completed spin."],
    ["Wheel Spotify click","A Spotify artist button clicked from the wheel winner result."],["Directory Spotify click","A Spotify artist button clicked from the full artist directory."],
    ["Spotify click","Outbound intent only; it is not evidence of a stream, follow, save or purchase."],["Quiz completion rate","Completed quiz runs divided by quiz starts."],
    ["Services contact click","A click from the quiz result to Laneway's film, television or advertising services page."],["WoW","Change versus the immediately preceding reporting period."],
    ["Privacy","No raw IP address, precise location, login, password or Spotify account information is stored."],["Reporting contract",report.dataQuality.note]
  ];
  const rows=[[s("METRIC DEFINITIONS AND DATA NOTES",1),blank()],[s(report.periodLabel,2),blank()],[s("Metric",4),s("Definition",4)]];
  definitions.forEach(row=>rows.push([s(row[0],7),s(row[1],7)]));
  return{rows,widths:[30,95],merges:["A1:B1","A2:B2"],freezeRows:3};
}

function worksheetXml(sheet){
  const rows=sheet.rows.map((row,rowIndex)=>{
    const cells=row.map((cell,columnIndex)=>cellXml(cell,columnIndex+1,rowIndex+1)).join("");
    return`<row r="${rowIndex+1}"${rowIndex<2?' ht="24" customHeight="1"':""}>${cells}</row>`;
  }).join("");
  const cols=sheet.widths.map((width,index)=>`<col min="${index+1}" max="${index+1}" width="${width}" customWidth="1"/>`).join("");
  const merges=sheet.merges?.length?`<mergeCells count="${sheet.merges.length}">${sheet.merges.map(ref=>`<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`:"";
  const pane=sheet.freezeRows?`<pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows+1}" activePane="bottomLeft" state="frozen"/>`:"";
  return xmlHeader()+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><cols>${cols}</cols><sheetData>${rows}</sheetData>${merges}${sheet.autoFilter?`<autoFilter ref="${sheet.autoFilter}"/>`:""}<pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

function cellXml(cell,column,row){
  if(!cell)return"";const ref=`${columnName(column)}${row}`,style=cell.style?` s="${cell.style}"`:"";
  if(cell.formula!==undefined)return`<c r="${ref}"${style}><f>${xmlEscape(cell.formula)}</f><v>${Number(cell.cached)||0}</v></c>`;
  if(typeof cell.value==="number")return`<c r="${ref}"${style}><v>${Number.isFinite(cell.value)?cell.value:0}</v></c>`;
  return`<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(cell.value||"")}</t></is></c>`;
}
function s(value,style=0){return{value:String(value??""),style}}
function n(value,style=5){return{value:Number(value)||0,style}}
function f(formula,cached=0,style=0){return{formula,cached,style}}
function blank(){return null}
function change(current,previous){return previous?(current-previous)/previous:current?1:0}
function columnName(index){let value="",number=index;while(number){number--;value=String.fromCharCode(65+number%26)+value;number=Math.floor(number/26)}return value}
function xmlEscape(value){return String(value).replace(/[<>&'"]/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[char]))}
function xmlHeader(){return'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'}
function contentTypesXml(count){return xmlHeader()+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${Array.from({length:count},(_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`}
function rootRelsXml(){return xmlHeader()+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`}
function workbookXml(sheets){return xmlHeader()+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView/></bookViews><sheets>${sheets.map((sheet,index)=>`<sheet name="${xmlEscape(sheet.name)}" sheetId="${index+1}" r:id="rId${index+1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`}
function workbookRelsXml(count){return xmlHeader()+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${Array.from({length:count},(_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="rId${count+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`}
function appXml(sheets){return xmlHeader()+`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Deep Cuts</Application><TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${sheets.map(sheet=>`<vt:lpstr>${xmlEscape(sheet.name)}</vt:lpstr>`).join("")}</vt:vector></TitlesOfParts></Properties>`}
function coreXml(created){return xmlHeader()+`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Laneway Music Weekly Discovery Report</dc:title><dc:creator>Deep Cuts</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${xmlEscape(created)}</dcterms:created></cp:coreProperties>`}
function stylesXml(){return xmlHeader()+`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="0.0%"/><numFmt numFmtId="165" formatCode="0.0"/></numFmts><fonts count="4"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="18"/><name val="Aptos Display"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font><font><color rgb="FFB8B8B8"/><sz val="9"/><name val="Aptos"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF111111"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEF233C"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF242424"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FF555555"/></left><right style="thin"><color rgb="FF555555"/></right><top style="thin"><color rgb="FF555555"/></top><bottom style="thin"><color rgb="FF555555"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="11"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="2" borderId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"><alignment horizontal="right"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="14" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" applyFont="1"><alignment wrapText="1"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`}

function zipStore(files){
  const entries=[],localParts=[];let offset=0;
  for(const [name,value]of files){
    const nameBytes=encoder.encode(name),data=value instanceof Uint8Array?value:encoder.encode(value),crc=crc32(data);
    const local=new Uint8Array(30+nameBytes.length+data.length),view=new DataView(local.buffer);
    view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0,true);view.setUint16(8,0,true);
    view.setUint32(14,crc,true);view.setUint32(18,data.length,true);view.setUint32(22,data.length,true);view.setUint16(26,nameBytes.length,true);
    local.set(nameBytes,30);local.set(data,30+nameBytes.length);localParts.push(local);
    entries.push({nameBytes,crc,size:data.length,offset});offset+=local.length;
  }
  const centralParts=[];let centralSize=0;
  for(const entry of entries){
    const central=new Uint8Array(46+entry.nameBytes.length),view=new DataView(central.buffer);
    view.setUint32(0,0x02014b50,true);view.setUint16(4,20,true);view.setUint16(6,20,true);view.setUint16(8,0,true);view.setUint16(10,0,true);
    view.setUint32(16,entry.crc,true);view.setUint32(20,entry.size,true);view.setUint32(24,entry.size,true);view.setUint16(28,entry.nameBytes.length,true);view.setUint32(42,entry.offset,true);
    central.set(entry.nameBytes,46);centralParts.push(central);centralSize+=central.length;
  }
  const end=new Uint8Array(22),endView=new DataView(end.buffer);endView.setUint32(0,0x06054b50,true);endView.setUint16(8,entries.length,true);endView.setUint16(10,entries.length,true);endView.setUint32(12,centralSize,true);endView.setUint32(16,offset,true);
  return concatBytes([...localParts,...centralParts,end]);
}
let crcTable;
function crc32(bytes){
  if(!crcTable)crcTable=Array.from({length:256},(_,index)=>{let value=index;for(let bit=0;bit<8;bit++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;return value>>>0});
  let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;
}
function concatBytes(parts){const size=parts.reduce((sum,part)=>sum+part.length,0),result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length}return result}

export function buildLanewayPdf(report){
  const commands=[],W=842,H=595,red=[.937,.137,.235],green=[.263,.863,.525],white=[.96,.96,.96],muted=[.68,.68,.7],panel=[.075,.075,.085],border=[.22,.22,.24];
  rect(commands,0,0,W,H,[.025,.025,.03]);rect(commands,28,25,W-56,H-50,[.035,.035,.042],border,1);
  ring(commands,74,527,27,white,1.8);text(commands,"laneway",48,519,18,"F2",white);text(commands,"M U S I C",57,507,5.5,"F1",muted);
  text(commands,"WEEKLY DISCOVERY REPORT",135,530,21,"F2",white);text(commands,report.periodLabel.toUpperCase(),136,510,8,"F2",red);
  waveform(commands,610,520,190,red);
  text(commands,"THE WEEK AT A GLANCE",45,473,8,"F2",muted);
  const cards=[
    ["SITE VISITS",report.current.siteVisits,"anonymous sessions"],["SPINS",report.current.spinButtonPushes,percent(report.current.spinEngagementRate)+" of visits"],
    ["SPOTIFY CLICKS",report.current.spotifyClicks,`${report.current.wheelSpotifyClicks} wheel / ${report.current.directorySpotifyClicks} list`],
    ["QUIZ COMPLETIONS",report.current.quizCompletions,percent(report.current.quizCompletionRate)+" completion"],["SERVICES INTEREST",report.current.servicesContactClicks,"film / TV / advertising"]
  ];
  cards.forEach((card,index)=>{const x=44+index*151;rect(commands,x,391,139,66,panel,index===4?red:border,1);text(commands,card[0],x+11,439,6.5,"F2",muted);text(commands,formatNumber(card[1]),x+11,414,22,"F2",index===4?red:white);text(commands,card[2],x+11,400,6.5,"F1",muted)});
  text(commands,"DISCOVERY FUNNEL",45,359,8,"F2",muted);
  const funnel=[["VISITS",report.current.siteVisits],["SPINS",report.current.spinButtonPushes],["ARTISTS SHOWN",report.current.wheelResults],["WINNER SPOTIFY",report.current.wheelSpotifyClicks]];
  const max=Math.max(1,...funnel.map(item=>item[1]));
  funnel.forEach((item,index)=>{const y=326-index*34,width=285*(item[1]/max);text(commands,item[0],45,y+8,7,"F2",white);rect(commands,126,y,285,19,[.09,.09,.1]);rect(commands,126,y,Math.max(2,width),19,index===3?green:red);text(commands,formatNumber(item[1]),420,y+6,8,"F2",white)});
  text(commands,"TOP ARTIST DISCOVERY",475,359,8,"F2",muted);
  text(commands,"ARTIST",475,337,6.5,"F2",muted);text(commands,"WHEEL",680,337,6.5,"F2",muted);text(commands,"SPOTIFY",747,337,6.5,"F2",muted);
  line(commands,475,329,792,329,border,1);
  report.topArtists.slice(0,5).forEach((artist,index)=>{const y=310-index*28;text(commands,fit(artist.artist,28),475,y,8,"F2",white);text(commands,formatNumber(artist.wheelResults),692,y,8,"F1",white);text(commands,formatNumber(artist.totalSpotifyClicks),762,y,8,"F2",artist.totalSpotifyClicks?green:muted);line(commands,475,y-9,792,y-9,[.13,.13,.15],.6)});
  rect(commands,44,71,367,96,panel,border,1);text(commands,"ENGAGEMENT SIGNALS",57,148,7,"F2",muted);
  metricLine(commands,"Wheel to Spotify conversion",percent(report.current.spotifyClickThroughRate),57,124,red);
  metricLine(commands,"Average quiz score",`${report.current.averageQuizScore.toFixed(1)} / 10`,57,101,white);
  metricLine(commands,"Catalogue wheel coverage",`${report.artists.filter(a=>a.wheelResults>0).length} / ${report.artists.length} artists`,57,78,green);
  rect(commands,428,71,364,96,panel,border,1);text(commands,"CLIENT-READY READ",441,148,7,"F2",muted);
  const leader=report.topArtists[0];
  text(commands,leader&&leader.totalSpotifyClicks?`${fit(leader.artist,28)} led Spotify interest this week.`:"No Spotify artist clicks were recorded this week.",441,123,9,"F2",white);
  text(commands,`${formatNumber(report.current.uniqueVisitors)} anonymous visitors generated ${formatNumber(report.current.spinButtonPushes)} spins and ${formatNumber(report.current.quizStarts)} quiz starts.`,441,101,7.3,"F1",muted);
  text(commands,report.current.servicesContactClicks?`${report.current.servicesContactClicks} visitor${report.current.servicesContactClicks===1?"":"s"} opened Laneway's services page from the quiz result.`:"The services link received no recorded clicks this week.",441,81,7.3,"F1",muted);
  text(commands,"Clicks indicate outbound intent only - not confirmed Spotify streams, follows, saves or purchases.",45,48,6.7,"F1",muted);
  text(commands,"Anonymous, privacy-conscious reporting | Detailed artist, quiz, source and audit data is attached in Excel.",45,36,6.5,"F1",muted);
  text(commands,"DEEP CUTS",741,42,6.5,"F2",white);
  return pdfDocument(commands.join("\n"),W,H);
}

function rect(out,x,y,w,h,fill,stroke=null,lineWidth=1){out.push(`${colour(fill)} rg ${x} ${y} ${w} ${h} re f`);if(stroke)out.push(`${colour(stroke)} RG ${lineWidth} w ${x} ${y} ${w} ${h} re S`)}
function line(out,x1,y1,x2,y2,colourValue,width=1){out.push(`${colour(colourValue)} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`)}
function text(out,value,x,y,size,font,colourValue){out.push(`BT /${font} ${size} Tf ${colour(colourValue)} rg 1 0 0 1 ${x} ${y} Tm (${pdfEscape(ascii(value))}) Tj ET`)}
function metricLine(out,label,value,x,y,accent){text(out,label,x,y,7.5,"F1",[.78,.78,.8]);text(out,value,x+270,y,9,"F2",accent)}
function waveform(out,x,y,width,accent){line(out,x,y,x+width,y,[.2,.2,.22],.6);for(let i=0;i<31;i++){const height=4+((i*17)%19),cx=x+8+i*(width-16)/30;line(out,cx,y-height/2,cx,y+height/2,accent,.7)}}
function ring(out,cx,cy,r,stroke,width){const c=.5522847498*r;out.push(`${colour(stroke)} RG ${width} w ${cx+r} ${cy} m ${cx+r} ${cy+c} ${cx+c} ${cy+r} ${cx} ${cy+r} c ${cx-c} ${cy+r} ${cx-r} ${cy+c} ${cx-r} ${cy} c ${cx-r} ${cy-c} ${cx-c} ${cy-r} ${cx} ${cy-r} c ${cx+c} ${cy-r} ${cx+r} ${cy-c} ${cx+r} ${cy} c S`)}
function colour(value){return value.map(item=>Number(item).toFixed(3)).join(" ")}
function ascii(value){return String(value??"").replace(/[–—]/g,"-").replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[^\x09\x0A\x0D\x20-\x7E]/g,"")}
function pdfEscape(value){return String(value).replace(/([\\()])/g,"\\$1")}
function fit(value,length){const text=ascii(value);return text.length<=length?text:`${text.slice(0,length-3)}...`}
function percent(value){return`${Math.round((Number(value)||0)*100)}%`}
function formatNumber(value){return Math.round(Number(value)||0).toLocaleString("en-AU")}
function pdfDocument(content,width,height){
  const stream=ascii(content),objects=[
    "<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`
  ];
  let pdf="%PDF-1.4\n",offsets=[0];objects.forEach((object,index)=>{offsets.push(encoder.encode(pdf).length);pdf+=`${index+1} 0 obj\n${object}\nendobj\n`});
  const xref=encoder.encode(pdf).length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,"0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(pdf);
}

export function buildLanewayEmailHtml(report){
  const top=report.topArtists.slice(0,5),metric=(label,value,accent="#ffffff")=>`<td style="width:20%;padding:12px 8px;border:1px solid #3b3b3d;background:#141416;text-align:center"><div style="font:700 10px Arial;color:#9e9ea2;letter-spacing:1px">${html(label)}</div><div style="font:800 25px Arial;color:${accent};margin-top:6px">${html(value)}</div></td>`;
  return`<!doctype html><html><body style="margin:0;background:#09090a;color:#f5f5f5;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#09090a"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="760" cellspacing="0" cellpadding="0" style="max-width:760px;border:1px solid #343438;background:#0e0e10"><tr><td style="padding:28px 30px 18px;border-bottom:2px solid #ef233c"><div style="font-size:14px;font-weight:800;letter-spacing:3px;color:#ef233c">LANEWAY MUSIC</div><h1 style="margin:7px 0 4px;font-size:30px;line-height:1.1">Weekly Discovery Report</h1><div style="font-size:12px;color:#a9a9ad">${html(report.periodLabel)}</div></td></tr><tr><td style="padding:22px 24px"><table role="presentation" width="100%" cellspacing="8" cellpadding="0"><tr>${metric("SITE VISITS",formatNumber(report.current.siteVisits))}${metric("SPINS",formatNumber(report.current.spinButtonPushes))}${metric("SPOTIFY",formatNumber(report.current.spotifyClicks),"#43dc86")}${metric("QUIZ COMPLETE",formatNumber(report.current.quizCompletions))}${metric("SERVICES",formatNumber(report.current.servicesContactClicks),"#ef4054")}</tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px"><tr><td style="width:52%;padding:18px;background:#151517;border-left:4px solid #ef233c;vertical-align:top"><div style="font-size:11px;font-weight:800;color:#ef4054;letter-spacing:1px">THE WEEK AT A GLANCE</div><p style="font-size:15px;line-height:1.55;color:#e8e8ea">${formatNumber(report.current.uniqueVisitors)} anonymous visitors generated ${formatNumber(report.current.spinButtonPushes)} spins. ${formatNumber(report.current.wheelSpotifyClicks)} Spotify clicks came directly from wheel winners and ${formatNumber(report.current.directorySpotifyClicks)} came from the artist directory.</p><p style="font-size:13px;color:#a9a9ad">Quiz completion: <strong style="color:#fff">${percent(report.current.quizCompletionRate)}</strong> &nbsp; | &nbsp; Wheel-to-Spotify: <strong style="color:#43dc86">${percent(report.current.spotifyClickThroughRate)}</strong></p></td><td style="width:48%;padding:18px 0 18px 22px;vertical-align:top"><div style="font-size:11px;font-weight:800;color:#a9a9ad;letter-spacing:1px">TOP ARTIST INTEREST</div>${top.map((artist,index)=>`<div style="padding:8px 0;border-bottom:1px solid #28282b;font-size:13px"><span style="display:inline-block;width:22px;color:#ef4054">${index+1}</span><strong>${html(artist.artist)}</strong><span style="float:right;color:#43dc86">${artist.totalSpotifyClicks} Spotify</span></div>`).join("")||'<p style="color:#a9a9ad">No artist Spotify clicks were recorded this week.</p>'}</td></tr></table></td></tr><tr><td style="padding:18px 30px 26px;border-top:1px solid #303034"><p style="margin:0 0 8px;font-size:13px;color:#d8d8da"><strong>Your client-ready landscape PDF</strong> is attached, with the complete auditable Excel workbook behind it.</p><p style="margin:0;font-size:11px;line-height:1.5;color:#85858a">Spotify clicks indicate outbound intent only, not confirmed streams, follows, saves or purchases. Reporting is anonymous and privacy-conscious.</p></td></tr></table></td></tr></table></body></html>`;
}

export function binaryBase64(bytes){let binary="";for(let index=0;index<bytes.length;index+=0x8000)binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000));return btoa(binary)}
function html(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function formatDate(value){return new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Sydney",day:"2-digit",month:"short",year:"numeric"}).format(value)}

export const __test={LANEWAY_EDITION_ID,REPORTING_VERSION,zipStore,normalizeEvent,aggregatePeriod};
