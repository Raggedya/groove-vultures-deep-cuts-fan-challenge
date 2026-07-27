import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  buildLanewayEmailHtml,
  buildLanewayPdf,
  buildLanewayWeeklyReport,
  buildLanewayXlsx
} from "../worker/laneway-report.js";

const editionId="dc_b9e7b66620";
const now=new Date("2026-07-24T00:00:00.000Z");
const roster=JSON.parse(await fs.readFile("editions/laneway-music-one-off/roster.json","utf8"));
const names=roster.artists.map(artist=>artist.name);
const enhanced={tracking_version:"laneway-weekly-v2",edition_type:"laneway_company"};
const events=[];

function add(eventName,daysAgo,sessionId,metadata={},destinationPlatform="",extra={}){
  events.push({
    edition_id:editionId,
    event_name:eventName,
    occurred_at:new Date(now.getTime()-daysAgo*86400000).toISOString(),
    session_id:sessionId,
    referring_source:extra.referringSource||"direct",
    device_category:extra.deviceCategory||"mobile",
    destination_platform:destinationPlatform,
    country_code:"AU",
    region_code:"NSW",
    metadata_json:JSON.stringify({...enhanced,...metadata})
  });
}

add("discovery_page_viewed",1,"session-a",{}, "",{referringSource:"instagram"});
add("discovery_page_viewed",1,"session-a");
add("discovery_page_viewed",2,"session-b");
add("qr_scan",2,"session-b");
add("wheel_spin_started",1,"session-a");
add("wheel_spin_started",1,"session-a");
add("wheel_result_shown",1,"session-a",{artist_name:"Lime Spiders"});
add("wheel_result_shown",1,"session-a",{artist_name:"Matt Taylor"});
add("artist_selected",1,"session-a",{artist_name:"Lime Spiders",discovery_source:"wheel"});
add("surprise_me_clicked",1,"session-a",{artist_name:"Matt Taylor",discovery_source:"surprise_me"});
add("artist_selected",1,"session-a",{artist_name:"Matt Taylor",discovery_source:"surprise_me"});
add("artist_roster_selected",1,"session-b",{artist_name:"Lime Spiders",discovery_source:"roster"});
add("artist_selected",1,"session-b",{artist_name:"Lime Spiders",discovery_source:"roster"});
add("recommendation_shown",1,"session-a",{artist_name:"Do Re Mi",recommending_artist_name:"Lime Spiders"});
add("recommendation_shown",1,"session-a",{artist_name:"DollSquad",recommending_artist_name:"Lime Spiders"});
add("recommendation_selected",1,"session-a",{artist_name:"Do Re Mi",recommending_artist_name:"Lime Spiders"});
add("artist_selected",1,"session-a",{artist_name:"Do Re Mi",discovery_source:"recommendation"});
add("artist_destination_clicked",1,"session-a",{artist_name:"Lime Spiders",interaction_source:"wheel_winner"},"spotify");
add("artist_destination_clicked",1,"session-b",{artist_name:"Lime Spiders",interaction_source:"artist_directory"},"spotify");
add("artist_destination_clicked",1,"session-b",{artist_name:"Matt Taylor",interaction_source:"artist_directory"},"spotify");
add("artist_destination_clicked",1,"session-a",{artist_name:"Big Heavy Stuff",interaction_source:"selected_artist_card"},"bandcamp");
add("artist_directory_searched",1,"session-b",{result_count:4});
add("quiz_started",1,"session-a",{quiz_run_id:"run-a"});
add("quiz_question_answered",1,"session-a",{quiz_run_id:"run-a",question_id:"laneway-q1",correct:true});
add("quiz_question_answered",1,"session-a",{quiz_run_id:"run-a",question_id:"laneway-q2",correct:false});
add("quiz_completed",1,"session-a",{quiz_run_id:"run-a",final_score:8,question_count:10});
add("quiz_recommendation_selected",1,"session-a",{artist_name:"Toys Went Berserk",discovery_source:"quiz_result"});
add("artist_selected",1,"session-a",{artist_name:"Toys Went Berserk",discovery_source:"quiz_result"});
add("quiz_started",1,"session-b",{quiz_run_id:"run-b"});
add("quiz_abandoned",1,"session-b",{quiz_run_id:"run-b",answered_count:3});
add("services_contact_clicked",1,"session-a",{interaction_source:"quiz_result"});
add("share_button_clicked",1,"session-a");
add("native_share_completed",1,"session-a");
add("session_summary",1,"session-a",{session_duration_seconds:140,discovered_artist_count:4});
add("session_summary",1,"session-b",{session_duration_seconds:60,discovered_artist_count:1});
add("discovery_page_viewed",8,"previous-session");
add("wheel_spin_started",8,"previous-session");
add("wheel_result_shown",8,"previous-session",{artist_name:"Lime Spiders"});
add("artist_destination_clicked",8,"previous-session",{artist_name:"Lime Spiders",interaction_source:"wheel_winner"},"spotify");

const env={
  ASSETS:{fetch:async()=>new Response(JSON.stringify(roster),{headers:{"content-type":"application/json"}})},
  DB:{prepare:()=>({bind:()=>({all:async()=>({results:events})})})}
};
const report=await buildLanewayWeeklyReport(env,now,7);
const lime=report.artists.find(artist=>artist.artist==="Lime Spiders");
const matt=report.artists.find(artist=>artist.artist==="Matt Taylor");

assert.equal(report.artists.length,names.length,"Every verified roster artist must appear, including zero rows");
assert.equal(report.current.siteVisits,3);
assert.equal(report.current.uniqueVisitors,2);
assert.equal(report.current.spinButtonPushes,2);
assert.equal(report.current.wheelResults,2);
assert.equal(report.current.spotifyClicks,3);
assert.equal(report.current.bandcampClicks,1);
assert.equal(report.current.wheelSpotifyClicks,1);
assert.equal(report.current.directorySpotifyClicks,2);
assert.equal(report.current.uniqueSpotifyClickers,2);
assert.equal(report.current.quizStarts,2);
assert.equal(report.current.quizCompletions,1);
assert.equal(report.current.quizAbandonments,1);
assert.equal(report.current.quizCompletionRate,.5);
assert.equal(report.current.averageQuizScore,8);
assert.equal(report.current.servicesContactClicks,1);
assert.equal(report.current.artistSelections,5);
assert.equal(report.current.uniqueArtistsSelected,4);
assert.equal(report.current.surpriseMeClicks,1);
assert.equal(report.current.rosterSelections,1);
assert.equal(report.current.recommendationImpressions,2);
assert.equal(report.current.recommendationSelections,1);
assert.equal(report.current.recommendationClickThroughRate,.5);
assert.equal(report.current.quizRecommendationSelections,1);
assert.equal(report.current.averageArtistsPerSession,2.5);
assert.equal(report.current.averageSessionDurationSeconds,100);
assert.equal(report.previous.spotifyClicks,1);
assert.deepEqual(
  {wheel:lime.wheelSpotifyClicks,directory:lime.directorySpotifyClicks,total:lime.totalSpotifyClicks,previous:lime.previousSpotifyClicks},
  {wheel:1,directory:1,total:2,previous:1}
);
assert.equal(matt.totalSpotifyClicks,1);
assert.equal(matt.surpriseSelections,1);
assert.equal(report.quizQuestions.find(question=>question.questionId==="laneway-q1").accuracy,1);
assert.equal(report.quizQuestions.find(question=>question.questionId==="laneway-q2").accuracy,0);

const xlsx=buildLanewayXlsx(report);
const xlsxText=new TextDecoder().decode(xlsx);
assert.equal(String.fromCharCode(...xlsx.slice(0,2)),"PK");
for(const sheet of ["Dashboard","Artist Performance","Quiz","Audience","Event Audit","Definitions"])assert.ok(xlsxText.includes(sheet),`Missing workbook sheet ${sheet}`);
for(const artist of names)assert.ok(xlsxText.includes(artist),`Workbook must contain ${artist}`);
assert.ok(xlsxText.includes("C4+D4"),"Workbook must include auditable artist formulas");
assert.ok(xlsxText.includes("Spotify clicks measure outbound intent"));

const pdf=buildLanewayPdf(report);
const pdfText=new TextDecoder().decode(pdf);
assert.ok(pdfText.startsWith("%PDF-1.4"));
assert.equal((pdfText.match(/\/Type \/Page\b/g)||[]).length,1,"PDF must contain exactly one page");
assert.ok(pdfText.includes("/MediaBox [0 0 842 595]"),"PDF must be A4 landscape");
for(const phrase of ["WEEKLY DISCOVERY REPORT","TOP ARTIST DISCOVERY","DISCOVERY FUNNEL","SPOTIFY CLICKS"])assert.ok(pdfText.includes(phrase),`PDF must contain ${phrase}`);

const email=buildLanewayEmailHtml(report);
assert.ok(email.includes("LANEWAY MUSIC"));
assert.ok(email.includes("Weekly Discovery Report"));
assert.ok(email.includes("client-ready landscape PDF"));
assert.ok(email.includes("complete auditable Excel workbook"));
assert.ok(email.includes("outbound intent only"));

console.log(`Laneway weekly reporting tests passed: one-page PDF, six-sheet Excel workbook, branded email and ${report.artists.length}-artist attribution.`);
