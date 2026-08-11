export const JUKEBOX_PRODUCT_PROFILES = Object.freeze({
  mahogany: Object.freeze({
    id: "mahogany",
    displayName: "Mahogany Jukebox",
    appearance: "mahogany-master",
    apiBase: "/api/mahogany",
    studioPath: "/mahogany-studio/",
    projectFolder: "projects",
  }),
  fullnoise: Object.freeze({
    id: "fullnoise",
    displayName: "Fullnoise VU Jukebox",
    appearance: "fullnoise-vu",
    apiBase: "/api/fullnoise",
    studioPath: "/fullnoise-studio/",
    projectFolder: "fullnoise-projects",
  }),
});

export function jukeboxProductProfile(value = "mahogany") {
  return JUKEBOX_PRODUCT_PROFILES[value] || JUKEBOX_PRODUCT_PROFILES.mahogany;
}

export function productForAppearance(appearance) {
  return appearance === "fullnoise-vu" ? "fullnoise" : "mahogany";
}

export function isVuAppearance(appearance) {
  return appearance === "mahogany-vu" || appearance === "fullnoise-vu";
}
