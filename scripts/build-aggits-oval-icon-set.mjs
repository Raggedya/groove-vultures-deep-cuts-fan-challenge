import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AGGITS_JUKEBOX_ICONS } from "./aggits-jukebox-icons.mjs";

const root = process.cwd();
const lucideDirectory = path.join(root, "node_modules", "lucide-static", "icons");
const outputDirectory = path.join(root, "assets", "aggits-jukebox-icons-oval-v6");

// Optical centres measured from the rendered alpha coverage at 240 × 240.
// These source-level translations remove asymmetric whitespace/path weight from
// the three affected 24 × 24 glyph canvases. The shared button CSS therefore
// centres every icon identically without per-button layout offsets.
const opticalCenterCorrections = Object.freeze({
  menu: { x: 0, y: 0.608 },
  shop: { x: -0.55, y: -0.136 },
  events: { x: 0, y: 0.666 },
});

const lucideById = {
  call: "phone", book_now: "calendar-check", gigs: "guitar", menu: "book-open",
  food: "cooking-pot", drinks: "beer", specials: "star", happy_hour: "clock",
  cocktails: "martini", wine_list: "wine", tickets: "ticket", live_tonight: "mic",
  bands: "guitar", dj: "disc-3", events: "calendar-days", calendar: "calendar",
  trivia: "trophy", karaoke: "mic-vocal", sports: "goal", live_sport: "tv",
  shop: "shopping-cart", offers: "gift", loyalty: "crown", gift_cards: "credit-card",
  membership: "badge-check", coupons: "ticket-percent", discounts: "badge-percent",
  vouchers: "ticket-check", deals: "tag", clearance: "badge-dollar-sign",
  order_online: "shopping-bag", takeaway: "package", delivery: "bike", coffee: "coffee",
  breakfast: "egg-fried", lunch: "sandwich", dinner: "utensils", desserts: "cake-slice",
  kids_menu: "baby", catering: "concierge-bell", gallery: "camera", photos: "images",
  videos: "play", live_stream: "radio-tower", music: "music", playlist: "list-music",
  podcast: "podcast", radio: "radio", website: "globe", blog: "square-pen",
  news: "newspaper", press: "badge-info", magazine: "book-open", media: "monitor-play",
  find_us: "map-pin", directions: "signpost", map: "map", location: "navigation",
  parking: "circle-parking", transport: "bus-front", taxi: "car-taxi-front", uber: "car",
  train: "train-front", bus: "bus", accommodation: "bed", rooms: "door-open",
  book_direct: "key-round", check_in: "bell-ring", facilities: "concierge-bell",
  pool: "waves", wifi: "wifi", air_con: "snowflake", smoking_area: "cigarette",
  pet_friendly: "paw-print", functions: "users", private_hire: "users-round",
  birthdays: "cake", weddings: "heart-handshake", corporate: "briefcase-business",
  meetings: "handshake", conferences: "presentation", parties: "party-popper",
  venue_hire: "landmark", event_spaces: "armchair", reviews: "star", rate_us: "thumbs-up",
  testimonials: "quote", feedback: "message-square-more", contact: "contact", email: "mail",
  message: "message-circle", whatsapp: "phone-call", sms: "message-square-text",
  live_chat: "headset", support: "life-buoy", faq: "circle-help", help: "badge-help",
  info: "info", notifications: "bell", alerts: "triangle-alert", updates: "refresh-cw",
  announcements: "megaphone", pinned: "pin", important: "circle-alert", tiktok: "music-2",
  australian_football: "medal", football_club: "shield", soccer: "goal",
  cricket: "club", basketball: "circle-dot", netball: "circle-dot", rugby: "trophy",
  tennis: "circle-dot", golf: "flag", baseball: "circle-dot", hockey: "club",
  volleyball: "volleyball", swimming: "waves", running: "footprints", cycling: "bike",
  gym: "dumbbell", boxing: "biceps-flexed", motorsport: "flag", darts: "target",
  bowling: "circle-dot", restaurant: "utensils", bar: "martini", pub: "beer",
  beer_garden: "trees", brewery: "beer", taproom: "beer", reservations: "calendar-check",
  table_service: "concierge-bell", chef: "chef-hat", function_room: "door-open",
  open_late: "moon-star", live_entertainment: "theater", dance_floor: "music",
  gaming: "gamepad-2", cinema: "clapperboard", comedy: "laugh", open_mic: "mic-vocal",
  nightclub: "music-2", festival: "tickets", showtimes: "clock-3", arcade: "gamepad-2",
  quiz_night: "badge-help", live_performance: "drama", community_event: "users-round",
  wedding_ceremony: "church", wedding_reception: "party-popper", engagement: "gem",
  bride: "heart", groom: "shirt", celebrant: "badge-check", florist: "flower-2",
  flowers: "flower", photography: "camera", videography: "video",
  invitations: "mail-check", rsvp: "clipboard-check", registry: "package-check",
  wedding_cake: "cake-slice", venue_tour: "map-pinned", wedding_packages: "hand-heart",
};

const customIcons = {
  youtube: '<rect x="3" y="6" width="18" height="12" rx="4"/><path d="m10 9 5 3-5 3Z" fill="url(#brass)" stroke="none"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="url(#brass)" stroke="none"/>',
  facebook: '<path d="M14.5 21v-8h2.8l.5-3h-3.3V8.1c0-.9.3-1.6 1.7-1.6H18V3.8c-.6-.1-1.5-.2-2.6-.2-2.7 0-4.5 1.6-4.5 4.6V10H8v3h2.9v8Z" fill="url(#brass)" stroke="none"/>',
  spotify: '<circle cx="12" cy="12" r="9"/><path d="M7.2 9.4c3.5-1 7.6-.7 10.2.7M7.8 12.4c3-.8 6.5-.5 8.9.7M8.4 15.2c2.4-.6 5-.4 7 .5"/>',
  bandcamp: '<path d="M6.6 6.2h14.1l-4.9 11.6H1.7Z" fill="url(#brass)" stroke="none"/>',
  soundcloud: '<path d="M4 15v-3m3 5V9m3 8V7m3 10V9a4.5 4.5 0 0 1 8 3 3 3 0 0 1-1 5Z"/>',
  wedding_rings: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
  bouquet: '<path d="M8 4c1.7 0 3 1.3 3 3 0-1.7 1.3-3 3-3s3 1.3 3 3c0 1.2-.7 2.3-1.8 2.8C16.3 10.3 17 11.4 17 13c0 2-1.6 3.5-3.5 3.5-.9 0-1.8-.4-2.5-1-.7.6-1.6 1-2.5 1A3.5 3.5 0 0 1 5 13c0-1.6.7-2.7 1.8-3.2A3 3 0 0 1 8 4Z"/><path d="m9 16 3 5m1-5-1 5"/>',
};

const shell = (body, correction) => {
  const artwork = correction
    ? `<g transform="translate(${correction.x} ${correction.y})">${body}</g>`
    : body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="url(#brass)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><defs><linearGradient id="brass" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#ffe0a0"/><stop offset=".38" stop-color="#d89a43"/><stop offset=".72" stop-color="#a96320"/><stop offset="1" stop-color="#f0bd66"/></linearGradient></defs>${artwork}</svg>`;
};

function colorizeLucide(source, correction) {
  const openingTag = source.indexOf("<svg");
  const openingTagEnd = source.indexOf(">", openingTag);
  const closingTag = source.lastIndexOf("</svg>");
  if (openingTag < 0 || openingTagEnd < 0 || closingTag < 0) {
    throw new Error("Lucide source does not contain a valid SVG root.");
  }
  const body = source
    .slice(openingTagEnd + 1, closingTag)
    .replaceAll('stroke="currentColor"', 'stroke="url(#brass)"')
    .replace(/stroke-width="[^"]+"/g, 'stroke-width="1.8"');
  return shell(body, correction);
}

await mkdir(outputDirectory, { recursive: true });
for (const icon of AGGITS_JUKEBOX_ICONS) {
  const correction = opticalCenterCorrections[icon.id];
  let svg;
  if (customIcons[icon.id]) svg = shell(customIcons[icon.id], correction);
  else {
    const lucideName = lucideById[icon.id];
    if (!lucideName) throw new Error(`No oval-native mapping for ${icon.id}.`);
    svg = colorizeLucide(
      await readFile(path.join(lucideDirectory, `${lucideName}.svg`), "utf8"),
      correction,
    );
  }
  await writeFile(path.join(outputDirectory, `${icon.id}.svg`), svg, "utf8");
}

console.log(`Built ${AGGITS_JUKEBOX_ICONS.length} clean oval-native vector glyphs in ${path.relative(root, outputDirectory)}.`);
