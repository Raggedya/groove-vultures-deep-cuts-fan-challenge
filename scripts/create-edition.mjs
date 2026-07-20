import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.env.DEEP_CUTS_ROOT||process.cwd());
const inputPath=process.argv[2];
if(!inputPath)throw new Error('Usage: node scripts/create-edition.mjs <verified-research.json>');
const input=JSON.parse(await fs.readFile(path.resolve(inputPath),'utf8'));
const bandName=clean(input.bandName,120);
const bio=clean(input.bio,190);
const editionType=['car','club','school'].includes(input.editionType)?input.editionType:'music';
if(!bandName||!bio)throw new Error('Verified research requires bandName and a concise bio.');
const slug=slugify(bandName);
const jobPath=path.join(root,'.deep-cuts','jobs',`${slug}.json`);
const job=JSON.parse(await fs.readFile(jobPath,'utf8').catch(()=>{throw new Error(`Start the production clock first: node scripts/start-edition.mjs "${bandName}"`)}));
if(job.bandName!==bandName||job.status!=='in_progress')throw new Error('The active factory job does not match this artist.');

const platformPath=path.join(root,'platform.json');
const platform=JSON.parse(await fs.readFile(platformPath,'utf8'));
if(platform.editions.some(item=>item.slug===slug||String(item.name).toLowerCase()===bandName.toLowerCase()))throw new Error(`Edition already exists for ${bandName}.`);
const links=validateResearch(input);
const featuredVideo=validateFeaturedVideo(input,links);
const schoolQuestions=editionType==='school'?validateSchoolChallenge(input):null;
const editionId=uniqueEditionId(platform);
const canonicalPath=`/e/${editionId}`;
const now=new Date().toISOString();
const directory=path.join(root,'editions',slug);
await fs.mkdir(directory,{recursive:true});
const config={
  brandName:editionType==='school'?'School Discovery':editionType==='club'?'Deep Cuts Clubs':editionType==='car'?'Deep Cuts Cars':'Deep Cuts',editionType,bandName,editionTitle:bandName,description:bio,
  discovery:{bio,newsLabel:clean(input.newsLabel||'',90)},mode:'discovery',slug,
  publicURL:`${String(platform.publicBaseURL).replace(/\/$/,'')}${canonicalPath}`,
  characterArtwork:editionType==='school'?'':'assets/aggits-original-cutout-v4.png',backgroundArtwork:'',
  social:{copyright:'copyright Clearlight Creative',instagramImage:`output/${slug}/instagram-discovery.png`,qrImage:`output/${slug}/instagram-qr.png`},
  theme:editionType==='school'?schoolTheme(input):{accent:'#2f80ff',accentSecondary:'#8dbdff'},links,
  featuredVideo,
  analytics:{editionId,pageIdentifier:`${editionId}:${editionType==='school'?'school-discovery-v1':editionType==='club'?'club-v1':editionType==='car'?'automotive-v1':'discovery-v1'}`},
  production:{jobId:job.jobId,submittedAt:job.submittedAt,researchCompletedAt:now,editionCreatedAt:now}
};
if(editionType==='car')config.automotive={make:clean(input.automotive?.make,60),model:clean(input.automotive?.model,60),productionYears:clean(input.automotive?.productionYears,30),heroLabels:['Discover','Watch','Connect','Own & Restore']};
if(editionType==='club')config.club={location:clean(input.club?.location,120),formed:clean(input.club?.formed,30),heroLabels:['Visit','Play','Join','Connect']};
if(editionType==='school'){
  config.school={officialWebsite:https(input.school?.officialWebsite||''),paletteSource:https(input.school?.paletteSource||input.school?.officialWebsite||''),logoPolicy:'colour-reference-only; no logo or emblem displayed',heroLabels:['Discover','Learn','Connect','Enrol']};
  config.schoolChallenge=schoolChallengeConfig(slug);
}
const research={bandName,slug,editionId,verifiedAt:now,sources:input.sources};
await fs.writeFile(path.join(directory,'edition.json'),JSON.stringify(config,null,2)+'\n');
await fs.writeFile(path.join(directory,'research.json'),JSON.stringify(research,null,2)+'\n');
if(schoolQuestions)await fs.writeFile(path.join(directory,'school-questions.json'),JSON.stringify(schoolQuestions,null,2)+'\n');
platform.editions.push({slug,editionId,canonicalPath,name:bandName,config:`editions/${slug}/edition.json`,active:true});
await fs.writeFile(platformPath,JSON.stringify(platform,null,2)+'\n');
job.status='configured';job.editionId=editionId;job.configuredAt=now;
await fs.writeFile(jobPath,JSON.stringify(job,null,2)+'\n');
console.log(JSON.stringify({ok:true,jobId:job.jobId,slug,editionId,canonicalPath,config:`editions/${slug}/edition.json`},null,2));

function validateResearch(value){
  const car=value.editionType==='car';
  const club=value.editionType==='club';
  const school=value.editionType==='school';
  const keys=school?['website','enrolment','virtualTour','principalMessage','visionValues','curriculum','studentLife','newsletter','termDates','policies','contact','schoolProject','youtube']:club?['website','calendar','news','events','membership','barefootBowls','pennant','venueHire','history','contact','facebook','bowlsVictoria']:car?['history','specifications','buyerGuide','youtube','ownersClub','partsRestoration','carsForSale','newsReviews']:['buyMusic','spotify','instagram','bandcamp','youtube','facebook','website','merchandise','newsReviews'];
  const links=Object.fromEntries(keys.map(key=>[key,https(value.links?.[key]||'')]));
  const sources=Array.isArray(value.sources)?value.sources:[];
  if(sources.length<2||!sources.some(source=>source.identityVerified===true&&/official|authoritative/i.test(String(source.sourceType||''))))throw new Error('Research requires two identity-checked sources including one official or authoritative source.');
  for(const [destination,url] of Object.entries(links)){
    if(!url)continue;
    const evidence=sources.find(source=>source.destination===destination&&normalize(source.url)===normalize(url)&&source.identityVerified===true&&validDate(source.verifiedAt)&&clean(source.evidence,300));
    if(!evidence)throw new Error(`${destination} requires matching, dated, identity-verified evidence.`);
    if(destination==='newsReviews'&&evidence.credibleEditorial!==true)throw new Error('News & Reviews requires credible editorial evidence.');
  }
  return links;
}
function validateFeaturedVideo(value,links){
  const youtubeURL=https(value.featuredVideo?.youtubeURL||'');
  const title=clean(value.featuredVideo?.title||'',120);
  const expectedBasis=value.editionType==='music'?'most-viewed-official':'best-authoritative';
  if(value.editionType==='school'&&!youtubeURL)throw new Error('School Discovery requires a verified authoritative featured YouTube video.');
  if(links.youtube&&!youtubeURL)throw new Error(value.editionType==='music'?'An official YouTube presence requires a verified most-viewed official featured video.':'A non-music YouTube destination requires a verified authoritative featured video.');
  if(!youtubeURL)return{title:'',youtubeURL:'',selectionBasis:'',verifiedAt:''};
  if(!title)throw new Error('The featured YouTube video requires a title.');
  if(value.featuredVideo?.selectionBasis!==expectedBasis)throw new Error(`Featured video selectionBasis must be ${expectedBasis}.`);
  const evidence=(value.sources||[]).find(source=>source.destination==='featuredVideo'&&normalize(source.url)===normalize(youtubeURL)&&source.identityVerified===true&&validDate(source.verifiedAt)&&clean(source.evidence,300));
  if(!evidence)throw new Error('The featured YouTube video requires dated, identity-verified selection evidence.');
  return{title,youtubeURL,selectionBasis:expectedBasis,verifiedAt:new Date(evidence.verifiedAt).toISOString()};
}
function validateSchoolChallenge(value){
  const questions=value.schoolChallenge?.questions;
  if(!Array.isArray(questions)||questions.length!==6)throw new Error('Schools Edition requires exactly six positive, sourced challenge questions.');
  const ids=new Set(),prompts=new Set();
  return questions.map((question,index)=>{
    const id=clean(question.id,80),category=clean(question.category||'Our School',50),prompt=clean(question.question,180),correctAnswer=clean(question.correctAnswer,160),explanation=clean(question.explanation,360),sourceName=clean(question.sourceName,120),sourceURL=https(question.sourceURL||'');
    const options=Array.isArray(question.options)?question.options.map(option=>clean(option,160)):[];
    if(!id||!prompt||!correctAnswer||!explanation||!sourceName||!sourceURL)throw new Error(`School question ${index+1} requires complete positive content and a source.`);
    if(ids.has(id)||prompts.has(prompt.toLowerCase()))throw new Error(`School question ${index+1} is duplicated.`);
    if(options.length!==4||new Set(options).size!==4||!options.includes(correctAnswer))throw new Error(`School question ${index+1} requires four unique choices including the correct answer.`);
    const evidence=(value.sources||[]).find(source=>normalize(source.url)===normalize(sourceURL)&&source.identityVerified===true&&validDate(source.verifiedAt)&&clean(source.evidence,300));
    if(!evidence)throw new Error(`School question ${index+1} requires matching, dated, identity-verified source evidence.`);
    ids.add(id);prompts.add(prompt.toLowerCase());
    return{id,category,question:prompt,options,correctAnswer,explanation,sourceName,sourceURL,active:true};
  });
}
function schoolChallengeConfig(slug){
  return{
    title:'How Well Do You Know Our School?',ctaLabel:'Take the Challenge',numberOfQuestions:6,secondsPerQuestion:15,feedbackMilliseconds:10000,
    questionFile:`editions/${slug}/school-questions.json`,dingSound:'assets/ding.mp3',
    classifications:[
      {min:0,max:1,label:'Curious Explorer',message:'Your discovery of {band} has just begun. There is plenty more to explore on the school home screen.'},
      {min:2,max:3,label:'Keen School Learner',message:'You already know some of what makes {band} special. Keep exploring and discovering the school community.'},
      {min:4,max:5,label:'School Champion',message:'A terrific result. You know many of the people, programs and achievements that make {band} shine.'},
      {min:6,max:6,label:'School Discovery Wizard',message:'A perfect score. You are a true {band} discovery wizard and know the school exceptionally well.'}
    ]
  };
}
function uniqueEditionId(platform){let id;do{id=`dc_${crypto.randomBytes(5).toString('hex')}`}while(platform.editions.some(item=>item.editionId===id));return id}
function slugify(value){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function clean(value,max){return String(value||'').trim().replace(/\s+/g,' ').slice(0,max)}
function https(value){if(!value)return'';const url=new URL(String(value));if(url.protocol==='http:')url.protocol='https:';if(url.protocol!=='https:')throw new Error(`Destination must use HTTPS: ${value}`);url.hash='';return url.href}
function normalize(value){try{const url=new URL(String(value));if(url.protocol==='http:')url.protocol='https:';url.hash='';return url.href.replace(/\/$/,'')}catch{return''}}
function validDate(value){return Number.isFinite(new Date(value).getTime())}
function schoolTheme(value){
  const source=value.theme||{};
  const palette={accent:hex(source.accent),accentSecondary:hex(source.accentSecondary),navy:hex(source.navy),surface:hex(source.surface),contentBackground:hex(source.contentBackground)};
  if(Object.values(palette).some(item=>!item))throw new Error('School Discovery requires five verified website-derived theme colours.');
  const evidence=(value.sources||[]).find(item=>item.destination==='themePalette'&&item.identityVerified===true&&validDate(item.verifiedAt)&&/official school website/i.test(String(item.sourceType||'')));
  if(!evidence)throw new Error('School colours require dated evidence from the official school website.');
  return{...palette,paletteSource:https(value.school?.paletteSource||value.school?.officialWebsite||''),logoPolicy:'colour-reference-only; no logo or emblem displayed'};
}
function hex(value){const result=String(value||'').trim().toUpperCase();return /^#[0-9A-F]{6}$/.test(result)?result:''}

