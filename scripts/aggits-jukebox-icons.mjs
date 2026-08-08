export const AGGITS_JUKEBOX_MODEL_VERSION="aggits-jukebox/1";
export const AGGITS_JUKEBOX_APPEARANCE="aggits-jukebox-oval-master/4";
export const AGGITS_JUKEBOX_CABINET="assets/aggits-jukebox-illuminated-master-v3.png";
export const AGGITS_JUKEBOX_CABINET_SHA256="c42731d8f90b7c53ddbf44ee65a16930c8315c170fb5fa68cd9a81db7d7c9262";
export const AGGITS_JUKEBOX_ICON_MASTER="assets/aggits-jukebox-icons-master-v1.jpg";
export const AGGITS_JUKEBOX_ICON_MASTER_SHA256="021e112589a982df5ea3ee665c1d19edb849dd4758cbf2749522c779d2caf527";
export const AGGITS_JUKEBOX_OVAL_ICON_SET="assets/aggits-jukebox-icons-oval-v4";
export const AGGITS_JUKEBOX_OVAL_ICON_SET_SHA256="43668a5c6b090e1f8e65127e59e8bb7f93371e5a5a74681317194619f696e14e";

const LABEL_ROWS=[
  ["Call","Book Now","Gigs","Menu","Food","Drinks","Specials","Happy Hour","Cocktails","Wine List"],
  ["Tickets","Live Tonight","Bands","DJ","Events","Calendar","Trivia","Karaoke","Sports","Live Sport"],
  ["Shop","Offers","Loyalty","Gift Cards","Membership","Coupons","Discounts","Vouchers","Deals","Clearance"],
  ["Order Online","Takeaway","Delivery","Coffee","Breakfast","Lunch","Dinner","Desserts","Kids Menu","Catering"],
  ["Gallery","Photos","Videos","Live Stream","Music","Playlist","Podcast","Radio","SoundCloud","YouTube"],
  ["Instagram","Facebook","TikTok","Spotify","Bandcamp","Website","Blog","News","Press","Magazine","Media"],
  ["Find Us","Directions","Map","Location","Parking","Transport","Taxi","Uber","Train","Bus"],
  ["Accommodation","Rooms","Book Direct","Check In","Facilities","Pool","WiFi","Air Con","Smoking Area","Pet Friendly"],
  ["Functions","Private Hire","Birthdays","Weddings","Corporate","Meetings","Conferences","Parties","Venue Hire","Event Spaces"],
  ["Reviews","Rate Us","Testimonials","Feedback","Contact","Email","Message","WhatsApp","SMS","Live Chat"],
  ["Support","FAQ","Help","Info","Notifications","Alerts","Updates","Announcements","Pinned","Important"]
];

const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");

export const AGGITS_JUKEBOX_ICONS=Object.freeze(LABEL_ROWS.flatMap((row,rowIndex)=>row.map((label,columnIndex)=>Object.freeze({
  id:slug(label),
  label,
  row:rowIndex+1,
  column:columnIndex+1,
  assetPath:`/${AGGITS_JUKEBOX_OVAL_ICON_SET}/${slug(label)}.svg`
}))));

const ICON_BY_ID=new Map(AGGITS_JUKEBOX_ICONS.map(icon=>[icon.id,icon]));
export function aggitsJukeboxIcon(iconId){return ICON_BY_ID.get(String(iconId||"").trim())||null}
export function aggitsJukeboxIconAsset(iconId){return aggitsJukeboxIcon(iconId)?.assetPath||""}
