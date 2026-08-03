import assert from "node:assert/strict";
import {
  bandRowsFromMaster,
  bandResearchInput,
  factoryResearchFromStudio,
  youtubeReportRow
} from "./jookbox-band-batch-lib.mjs";

const row={
  rowNumber:2,record_id:"JBX-1",source_record_id:"Q1",edition_slug:"test-band-australia",
  display_name:"Test Band",entity_group:"Band",category:"Music",subcategory:"Band",country:"Australia",
  homepage_url:"http://testband.example/",discovery_source_url:"https://www.wikidata.org/wiki/Q1",
  button_1_destination_url:"http://testband.example/",
  button_2_destination_url:"https://open.spotify.com/artist/example",
  button_3_destination_url:"https://www.youtube.com/channel/UCEXAMPLE",
  button_4_destination_url:"https://www.instagram.com/testband/",
  reserve_1_destination_url:"https://testband.bandcamp.com/"
};
const items=bandRowsFromMaster([row,{...row,rowNumber:3,record_id:"X",display_name:"Not a venue",category:"Hospitality",subcategory:"Pub",entity_group:"Venue"}]);
assert.equal(items.length,1);
assert.equal(items[0].homepageUrl,"https://testband.example/");
assert.equal(items[0].youtubeUrl,"https://www.youtube.com/channel/UCEXAMPLE");
assert.ok(items[0].sourceUrls.includes("https://testband.bandcamp.com/"));
assert.equal(bandResearchInput(items[0]).type,"jookbox");

const verified={
  passed:true,confidence:100,bandName:"Test Band",verifiedAt:"2026-08-03T00:00:00.000Z",
  roots:[{url:"https://testband.example/",verifiedAt:"2026-08-03T00:00:00.000Z"}],
  biography:{tickerBio:"TEST BAND BIO",paragraphs:["Test Band is a documented band with an official catalogue and verified artist-controlled destinations."],sourceURL:"https://testband.example/about"},
  featuredVideo:{title:"Official Video",youtubeURL:"https://www.youtube.com/watch?v=abcdefghijk",channelURL:"https://www.youtube.com/channel/UCEXAMPLE",selectionBasis:"most-viewed-official",verifiedAt:"2026-08-03T00:00:00.000Z"},
  links:{spotify:"https://open.spotify.com/artist/example",youtube:"https://www.youtube.com/channel/UCEXAMPLE",website:"https://testband.example/",instagram:"https://www.instagram.com/testband/"},
  selections:[
    ...[1,2,3,4].map(index=>({id:`selection-${index}`,sourceTitle:`Selection ${index}`,label:`Selection ${index}`,detail:"Verified",url:`https://testband.example/${index}`,platform:"website",kind:"website",confidence:100})),
    {id:"incomplete-show",sourceTitle:"Tickets",label:"Tickets",detail:"Verified ticket destination",url:"https://tickets.example/test-band",platform:"website",kind:"show",confidence:100}
  ],
  displaySelectionIds:["selection-1","selection-2","selection-3","selection-4","incomplete-show"],
  sources:[{destination:"identity",url:"https://testband.example/",sourceType:"official artist-controlled source",identityVerified:true,verifiedAt:"2026-08-03T00:00:00.000Z",evidence:"Identity matched."}]
};
const factory=factoryResearchFromStudio(verified);
assert.equal(factory.editionType,"jukebox");
assert.equal(factory.jookBox.qrArtworkVariant,"aggits-character-poster-perspective/2");
assert.equal(factory.jookBox.appearanceVariant,"mahogany-jookbox-master/1");
assert.equal(factory.jookBox.keyBankFormat,"mahogany-four-key/1");
assert.equal(factory.featuredVideo.youtubeURL,"https://www.youtube.com/watch?v=abcdefghijk");
assert.equal(factory.jookBox.selections.find(selection=>selection.id==="incomplete-show")?.kind,"website");
assert.equal(factory.jookBox.displaySelectionIds.length,4);
assert.equal(factory.jookBox.displaySelectionIds.includes("incomplete-show"),false);
const report=youtubeReportRow({...items[0],status:"configured",research:verified,editionId:"dc_0123456789",liveURL:"https://example.com/e/dc_0123456789"});
assert.equal(report["Most Popular Verified Video URL"],verified.featuredVideo.youtubeURL);
assert.equal(report["QR Poster Variant"],"aggits-character-poster-perspective/2");
assert.match(youtubeReportRow({...items[0],status:"technical_failure",blockers:[],reasons:[{message:"Configuration failed."}]} )["Failure / Omission Reason"],/Configuration failed/);
console.log("Band JookBox batch mapping passed.");
