const STARTUP_TIMINGS=Object.freeze({mechanism:120,neonOn:800,screenOn:1200,buttonsOn:1600,tickerOn:2000});
const SUPPORT_ACTION=Object.freeze({action:"share",label:"SHARE",detail:"",kind:"share",icon:"",detailIcon:""});

export const BAND_JOOKBOX_MODEL=Object.freeze({
  masterName:"Mahogany Jukebox Master",
  approvalStatus:"final-owner-approved",
  approvedAt:"2026-08-04",
  referenceEditionId:"dc_e65763b78b",
  referenceEditionSlug:"savage-garden",
  modelVersion:"jookbox/3",
  layoutVersion:"coin-awakening/1",
  appearanceVariant:"mahogany-jookbox-master/1",
  keyBankFormat:"mahogany-four-key/1",
  cabinetArtwork:"assets/aggits-jukebox-master-v1.jpg",
  cabinetArtworkSha256:"28806c43ecc8d7eb3ac2216f064f1887d057e939bad1841d62ecbf9a6627373d",
  coinSound:"assets/audio/jukebox-real-coin-insert-cc0.mp3",
  coinSoundSha256:"0d5af258fc72136626d4888c3b6a75240afe8d7b6c00d5837576b92c4ebadec0",
  coinSoundSource:"https://freesound.org/people/kyles/sounds/637369/",
  coinSoundLicense:"CC0-1.0",
  qrArtworkVariant:"aggits-character-poster-perspective/2",
  tickerDurationSeconds:36,
  buttonLightDurationMs:1100,
  autoplayDelayMs:0,
  startupTimingsMs:STARTUP_TIMINGS,
  heroLabels:Object.freeze(["Listen","Watch","Follow","Shop"]),
  lightSequence:false,
  lightSequenceMode:"none",
  supportAction:SUPPORT_ACTION,
  cabinetCopyright:"Copyright Clearlight Creative 2026.",
  coinStart:true,
  minimumDestinations:4,
  maximumDestinations:4
});

export function assertCurrentBandJookBoxModel(input={}){
  assertOptionalMatch(input,"modelVersion",BAND_JOOKBOX_MODEL.modelVersion,"Band JookBoxes require the locked jookbox/3 model.");
  assertOptionalMatch(input,"layoutVersion",BAND_JOOKBOX_MODEL.layoutVersion,"Band JookBoxes require the locked coin-awakening layout.");
  assertOptionalMatch(input,"appearanceVariant",BAND_JOOKBOX_MODEL.appearanceVariant,"ATLAS and every other retired Band JookBox appearance are blocked. Use mahogany-jookbox-master/1.");
  assertOptionalMatch(input,"keyBankFormat",BAND_JOOKBOX_MODEL.keyBankFormat,"Band JookBoxes require the locked mahogany four-key bank.");
  assertOptionalMatch(input,"cabinetArtwork",BAND_JOOKBOX_MODEL.cabinetArtwork,"Band JookBoxes require the SHA-256-locked mahogany cabinet artwork.");
  assertOptionalMatch(input,"cabinetArtworkSha256",BAND_JOOKBOX_MODEL.cabinetArtworkSha256,"The Mahogany Jukebox Master cabinet identity cannot be changed.");
  assertOptionalMatch(input,"coinSound",BAND_JOOKBOX_MODEL.coinSound,"Band JookBoxes require the locked genuine coin-slot recording.");
  assertOptionalMatch(input,"coinSoundSha256",BAND_JOOKBOX_MODEL.coinSoundSha256,"The genuine coin-slot recording identity cannot be changed.");
  assertOptionalMatch(input,"coinSoundSource",BAND_JOOKBOX_MODEL.coinSoundSource,"The genuine coin-slot recording source cannot be changed.");
  assertOptionalMatch(input,"coinSoundLicense",BAND_JOOKBOX_MODEL.coinSoundLicense,"The genuine coin-slot recording licence cannot be changed.");
  assertOptionalMatch(input,"qrArtworkVariant",BAND_JOOKBOX_MODEL.qrArtworkVariant,"Band JookBoxes require the locked perspective-fitted QR poster.");
  assertOptionalMatch(input,"tickerDurationSeconds",BAND_JOOKBOX_MODEL.tickerDurationSeconds,"The approved Mahogany Jukebox ticker speed is locked.");
  assertOptionalMatch(input,"buttonLightDurationMs",BAND_JOOKBOX_MODEL.buttonLightDurationMs,"The Mahogany Jukebox timing contract is locked.");
  assertOptionalMatch(input,"autoplayDelayMs",BAND_JOOKBOX_MODEL.autoplayDelayMs,"Video may request playback only after the genuine coin recording completes.");
  assertOptionalMatch(input,"lightSequence",BAND_JOOKBOX_MODEL.lightSequence,"Band JookBox keys must remain unlit.");
  assertOptionalMatch(input,"lightSequenceMode",BAND_JOOKBOX_MODEL.lightSequenceMode,"Band JookBox keys must not run a light sequence.");
  assertOptionalMatch(input,"cabinetCopyright",BAND_JOOKBOX_MODEL.cabinetCopyright,"The in-cabinet Clearlight copyright plate is locked.");
  assertOptionalMatch(input,"coinStart",BAND_JOOKBOX_MODEL.coinStart,"The accessible coin start is mandatory.");
  assertOptionalJSONMatch(input,"startupTimingsMs",BAND_JOOKBOX_MODEL.startupTimingsMs,"The approved Mahogany Jukebox start-up sequence is locked.");
  assertOptionalJSONMatch(input,"heroLabels",BAND_JOOKBOX_MODEL.heroLabels,"The Band JookBox semantic destination order is locked.");
  assertOptionalJSONMatch(input,"supportAction",BAND_JOOKBOX_MODEL.supportAction,"The brass SHARE plate is the sole working Share action.");
}

function assertOptionalMatch(input,key,expected,message){
  if(Object.prototype.hasOwnProperty.call(input,key)&&input[key]!==expected)throw new Error(message);
}

function assertOptionalJSONMatch(input,key,expected,message){
  if(Object.prototype.hasOwnProperty.call(input,key)&&JSON.stringify(input[key])!==JSON.stringify(expected))throw new Error(message);
}
