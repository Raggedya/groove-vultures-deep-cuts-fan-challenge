export const RECORD_COMPANY_EDITION="record_company";
export const PUBLICATION_CONFIDENCE=0.98;
export const QUIZ_QUESTION_COUNT=5;
export const JOB_STAGES=[
  "queued","validating","discovering_company","discovering_roster","researching_artists",
  "generating_quizzes","generating_pages","generating_qr_codes","validating_output",
  "generating_reports","generating_master_qr_image","sending_completion_email",
  "ready_for_delivery","completed","completed_with_exceptions","failed"
];
export const LINK_TYPES=[
  "about","artists","latest_releases","new_music","news","events","store","contact",
  "submit_music","licensing","publishing","distribution","playlists","youtube",
  "instagram","facebook","tiktok","spotify","apple_music","bandcamp","soundcloud",
  "mailing_list","website","tour_dates","merchandise","record_company_profile"
];
export const ANALYTICS_EVENTS=[
  "company_page_view","artist_page_view","company_quiz_started","artist_quiz_started",
  "quiz_response","quiz_completed","quiz_abandoned","quiz_replayed","discover_artist","recommended_artist",
  "back_to_company","outbound_click","source_opened"
];

export function validHttpsUrl(value){
  try{
    const url=new URL(String(value||""));
    return url.protocol==="https:"&&Boolean(url.hostname)&&!isBlockedHost(url.hostname);
  }catch{return false}
}

export function canonicalDomain(value){
  if(!validHttpsUrl(value))return "";
  return new URL(value).hostname.toLowerCase().replace(/^www\./,"");
}

export function safeSlug(value){
  return String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
    .replace(/^the\s+/,"").replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"").slice(0,80);
}

export function validateQuiz(quiz){
  if(!quiz||!Array.isArray(quiz.questions)||quiz.questions.length!==QUIZ_QUESTION_COUNT)return false;
  const prompts=new Set();
  return quiz.questions.every((question,index)=>{
    const prompt=String(question?.question||"").trim();
    const options=question?.options;
    const valid=question?.displayOrder===index+1&&prompt.length>=12&&prompt.length<=220&&
      Array.isArray(options)&&options.length===4&&new Set(options.map(String)).size===4&&
      options.includes(question.correctAnswer)&&String(question.explanation||"").trim().length>=20&&
      validHttpsUrl(question.sourceUrl)&&Number(question.confidenceScore)>=PUBLICATION_CONFIDENCE;
    if(prompts.has(prompt.toLowerCase()))return false;
    prompts.add(prompt.toLowerCase());
    return valid;
  });
}

export function validateArtist(artist){
  return Boolean(artist&&artist.id&&artist.recordCompanyId&&artist.name&&artist.slug&&
    validHttpsUrl(artist.officialLabelProfileUrl)&&Number(artist.confidenceScore)>=PUBLICATION_CONFIDENCE&&
    artist.publicationStatus==="published"&&validateQuiz(artist.quiz));
}

export function validateRecordCompany(company){
  return Boolean(company&&company.id&&company.name&&company.slug&&validHttpsUrl(company.officialUrl)&&
    canonicalDomain(company.officialUrl)===company.canonicalDomain&&
    Number(company.confidenceScore)>=PUBLICATION_CONFIDENCE&&validateQuiz(company.quiz));
}

function isBlockedHost(hostname){
  const host=String(hostname).toLowerCase().replace(/^\[|\]$/g,"");
  if(host==="localhost"||host.endsWith(".local")||host.endsWith(".internal"))return true;
  if(/^127\./.test(host)||/^10\./.test(host)||/^169\.254\./.test(host)||/^192\.168\./.test(host))return true;
  const match=host.match(/^172\.(\d+)\./);
  if(match&&Number(match[1])>=16&&Number(match[1])<=31)return true;
  if(host==="::1"||host.startsWith("fc")||host.startsWith("fd")||host.startsWith("fe80:"))return true;
  return false;
}
