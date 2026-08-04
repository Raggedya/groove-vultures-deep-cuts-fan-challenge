import assert from "node:assert/strict";
import {
  STUDIO_JOOKBOX_CONFIDENCE_GATE,
  researchFingerprint,
  researchStudioJookBox
} from "./studio-jookbox-research.mjs";

const root="https://midnight-valves.example/";
const channel="https://www.youtube.com/@midnightvalves";
const popular=`${channel}/videos?view=0&sort=p&flow=grid`;
const pages=new Map([
  [root,page(root,`
    <html><head>
      <title>Midnight Valves — Official</title>
      <meta name="description" content="Midnight Valves make shadowy guitar music with bright melodic hooks, direct live energy and a fiercely independent approach.">
    </head><body>
      <p>Formed in Melbourne in 2018, the five-piece band combines independent rock, sharp live energy and a growing catalogue of original singles.</p>
      <p>Thank you for making our awards event amazing. Nobody wanted to go home after this corporate cover band finished.</p>
      <a href="https://open.spotify.com/artist/1234567890abcdef">Spotify</a>
      <a href="${channel}">Official YouTube</a>
      <a href="https://www.instagram.com/midnightvalves/">Instagram</a>
      <a href="https://midnightvalves.bandcamp.com/">Bandcamp</a>
    </body></html>
  `)],
  ["https://open.spotify.com/artist/1234567890abcdef",page("https://open.spotify.com/artist/1234567890abcdef","<title>Midnight Valves | Spotify</title>")],
  [channel,page(channel,"<title>Midnight Valves - YouTube</title>")],
  [popular,page(popular,`<title>Midnight Valves - Videos</title>{"videoId":"abcdefghijk","title":{"runs":[{"text":"Night Signal — Midnight Valves"}]}}`)],
  ["https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabcdefghijk&format=json",page("https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabcdefghijk&format=json",JSON.stringify({title:"Night Signal — Midnight Valves",author_name:"Midnight Valves"}))],
  ["https://www.youtube-nocookie.com/embed/abcdefghijk",page("https://www.youtube-nocookie.com/embed/abcdefghijk","<title>Night Signal — Midnight Valves</title>")],
  ["https://www.instagram.com/midnightvalves/",page("https://www.instagram.com/midnightvalves/","",403)],
  ["https://midnightvalves.bandcamp.com/",page("https://midnightvalves.bandcamp.com/","<title>Midnight Valves</title>")]
]);

const network={
  async inspect(url){
    const result=pages.get(url);
    return result||{ok:false,status:404,requestedURL:url,finalURL:url,body:"",checkedAt:"2026-07-30T01:00:00.000Z"};
  },
  async search(){return[root]}
};

const seeded=await researchStudioJookBox({
  name:"Midnight Valves",
  sourceUrls:[root],
  youtubeUrl:""
},{network,now:new Date("2026-07-30T01:00:00.000Z")});

assert.equal(seeded.status,"passed");
assert.equal(seeded.passed,true);
assert.ok(seeded.confidence>=STUDIO_JOOKBOX_CONFIDENCE_GATE);
assert.equal(seeded.discoveryMode,"artist_url_seeded");
assert.equal(seeded.featuredVideo.youtubeURL,"https://www.youtube.com/watch?v=abcdefghijk");
assert.equal(seeded.featuredVideo.selectionBasis,"most-viewed-official");
assert.match(seeded.biography.tickerBio,/FORMED IN MELBOURNE/);
assert.doesNotMatch(seeded.biography.tickerBio,/THANK YOU|AWARDS EVENT/,"Verified factual band information must outrank testimonials.");
assert.ok(seeded.displaySelectionIds.length>=4&&seeded.displaySelectionIds.length<=6);
assert.ok(seeded.selections.some(item=>item.kind==="spotify"&&item.confidence>=98));
assert.ok(seeded.selections.some(item=>item.kind==="instagram"&&item.confidence>=98),"A direct profile linked by the verified official root may pass when the platform returns an access wall.");
assert.ok(seeded.sources.some(item=>item.destination==="featuredVideo"&&item.identityVerified===true));
assert.ok(seeded.sources.some(item=>item.destination.startsWith("selection:")&&item.identityVerified===true));

const nameOnly=await researchStudioJookBox({
  name:"Midnight Valves",
  sourceUrls:[],
  youtubeUrl:""
},{network,now:new Date("2026-07-30T01:00:00.000Z")});
assert.equal(nameOnly.status,"passed","Name-only discovery may pass only after the discovered official source and direct destinations are independently checked.");
assert.equal(nameOnly.discoveryMode,"name_only_search");

const rejected=await researchStudioJookBox({
  name:"Different Band",
  sourceUrls:[root],
  youtubeUrl:""
},{network,now:new Date("2026-07-30T01:00:00.000Z")});
assert.equal(rejected.status,"needs_review");
assert.equal(rejected.passed,false);
assert.ok(rejected.confidence<STUDIO_JOOKBOX_CONFIDENCE_GATE);
assert.equal(rejected.displaySelectionIds.length,0);
assert.ok(rejected.blockers.some(value=>/identity/i.test(value)));

assert.equal(
  researchFingerprint({name:"Midnight Valves",sourceUrls:[root],youtubeUrl:""}),
  researchFingerprint({name:" Midnight   Valves ",sourceUrls:[root],youtubeUrl:""}),
  "Equivalent Studio identity inputs must retain the same research fingerprint."
);

console.log("Deep Cuts Studio JookBox research tests passed: name-plus-URL and name-only discovery verify independently, collect verified destination candidates for the factory's locked four-key selection, and fail closed on identity mismatch.");

function page(url,body,status=200){
  return{
    ok:status>=200&&status<300||[401,403,429].includes(status),
    status,
    requestedURL:url,
    finalURL:url,
    contentType:"text/html",
    body,
    checkedAt:"2026-07-30T01:00:00.000Z"
  };
}
