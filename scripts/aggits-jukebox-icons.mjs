export const AGGITS_JUKEBOX_MODEL_VERSION="aggits-jukebox/1";
export const AGGITS_JUKEBOX_APPEARANCE="aggits-jukebox-oval-master/4";
export const AGGITS_JUKEBOX_CABINET="assets/aggits-jukebox-illuminated-master-v3.png";
export const AGGITS_JUKEBOX_CABINET_SHA256="c42731d8f90b7c53ddbf44ee65a16930c8315c170fb5fa68cd9a81db7d7c9262";
export const AGGITS_JUKEBOX_ICON_MASTER="assets/aggits-jukebox-icons-master-v1.jpg";
export const AGGITS_JUKEBOX_ICON_MASTER_SHA256="021e112589a982df5ea3ee665c1d19edb849dd4758cbf2749522c779d2caf527";
export const AGGITS_JUKEBOX_OVAL_ICON_SET="assets/aggits-jukebox-icons-oval-v6";
export const AGGITS_JUKEBOX_OVAL_ICON_SET_SHA256="4436638de48e987e354ba24ff5e6294d86d7a0b44e4a8d4ff94d19fef02868b7";

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

const BASE_CATEGORIES=[
  "Hospitality",
  "Entertainment",
  "Commerce",
  "Food & Drink",
  "Media",
  "Social & Web",
  "Travel & Location",
  "Accommodation",
  "Events",
  "Contact & Support",
  "Utilities"
];

// New groups are appended so the IDs and positions of the original approved
// library remain stable. Categories and keywords are discovery metadata only;
// the public jukebox continues to render the selected icon ID and destination.
const EXTRA_ICON_GROUPS=[
  {
    category:"Sports & Clubs",
    keywords:"sport team club competition recreation athletics",
    labels:[
      "Australian Football","Football Club","Soccer","Cricket","Basketball",
      "Netball","Rugby","Tennis","Golf","Baseball","Hockey","Volleyball",
      "Swimming","Running","Cycling","Gym","Boxing","Motorsport","Darts","Bowling"
    ]
  },
  {
    category:"Hospitality",
    keywords:"venue hotel pub bar restaurant food drink service",
    labels:[
      "Restaurant","Bar","Pub","Beer Garden","Brewery","Taproom","Reservations",
      "Table Service","Chef","Function Room","Open Late","Live Entertainment",
      "Dance Floor","Gaming"
    ]
  },
  {
    category:"Entertainment",
    keywords:"show performance stage nightlife audience activity",
    labels:[
      "Cinema","Comedy","Open Mic","Nightclub","Festival","Showtimes","Arcade",
      "Quiz Night","Live Performance","Community Event"
    ]
  },
  {
    category:"Weddings",
    keywords:"wedding marriage ceremony reception bridal event",
    labels:[
      "Wedding Ceremony","Wedding Reception","Engagement","Wedding Rings","Bride",
      "Groom","Celebrant","Florist","Flowers","Bouquet","Photography","Videography",
      "Invitations","RSVP","Registry","Wedding Cake","Venue Tour","Wedding Packages"
    ]
  }
];

const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");

const BASE_ICONS=LABEL_ROWS.flatMap((row,rowIndex)=>row.map((label,columnIndex)=>Object.freeze({
  id:slug(label),
  label,
  row:rowIndex+1,
  column:columnIndex+1,
  category:BASE_CATEGORIES[rowIndex],
  keywords:"",
  assetPath:`/${AGGITS_JUKEBOX_OVAL_ICON_SET}/${slug(label)}.svg`
})));

const EXTRA_ICONS=EXTRA_ICON_GROUPS.flatMap((group,groupIndex)=>group.labels.map((label,columnIndex)=>Object.freeze({
  id:slug(label),
  label,
  row:LABEL_ROWS.length+groupIndex+1,
  column:columnIndex+1,
  category:group.category,
  keywords:group.keywords,
  assetPath:`/${AGGITS_JUKEBOX_OVAL_ICON_SET}/${slug(label)}.svg`
})));

export const AGGITS_JUKEBOX_ICONS=Object.freeze([...BASE_ICONS,...EXTRA_ICONS]);
export const AGGITS_JUKEBOX_ICON_CATEGORIES=Object.freeze([...new Set(AGGITS_JUKEBOX_ICONS.map(icon=>icon.category))]);

const ICON_BY_ID=new Map(AGGITS_JUKEBOX_ICONS.map(icon=>[icon.id,icon]));
export function aggitsJukeboxIcon(iconId){return ICON_BY_ID.get(String(iconId||"").trim())||null}
export function aggitsJukeboxIconAsset(iconId){return aggitsJukeboxIcon(iconId)?.assetPath||""}
