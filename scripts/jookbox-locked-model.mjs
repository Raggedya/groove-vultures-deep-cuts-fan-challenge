export const BAND_JOOKBOX_MODEL=Object.freeze({
  appearanceVariant:"mahogany-jookbox-master/1",
  keyBankFormat:"mahogany-four-key/1",
  cabinetArtwork:"assets/aggits-jukebox-master-v1.jpg",
  cabinetArtworkSha256:"28806c43ecc8d7eb3ac2216f064f1887d057e939bad1841d62ecbf9a6627373d",
  qrArtworkVariant:"aggits-character-poster-perspective/2",
  minimumDestinations:4,
  maximumDestinations:4
});

export function assertCurrentBandJookBoxModel(input={}){
  const requestedAppearance=String(input.appearanceVariant||"").trim();
  const requestedKeys=String(input.keyBankFormat||"").trim();
  const requestedArtwork=String(input.cabinetArtwork||"").trim();
  if(requestedAppearance&&requestedAppearance!==BAND_JOOKBOX_MODEL.appearanceVariant){
    throw new Error("ATLAS and every other retired Band JookBox appearance are blocked. Use mahogany-jookbox-master/1.");
  }
  if(requestedKeys&&requestedKeys!==BAND_JOOKBOX_MODEL.keyBankFormat){
    throw new Error("New Band JookBoxes require the locked mahogany four-key bank.");
  }
  if(requestedArtwork&&requestedArtwork!==BAND_JOOKBOX_MODEL.cabinetArtwork){
    throw new Error("New Band JookBoxes require the SHA-256-locked mahogany cabinet artwork.");
  }
}
