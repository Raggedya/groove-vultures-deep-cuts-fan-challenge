import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const requiredDocs=['PLATFORM_ARCHITECTURE_DIRECTIVE.md','DEEP_CUTS_PRODUCTION_MANUAL.md','CLAUDE.md','ROADMAP.md','AGENTS.md','.agents/skills/deep-cuts-factory/SKILL.md'];
const errors=[];
for(const file of requiredDocs)try{const text=await fs.readFile(file,'utf8');if(text.trim().length<100)errors.push(`${file} is unexpectedly short.`)}catch{errors.push(`Missing ${file}.`)}
try{
  const integrity=JSON.parse(await fs.readFile('assets/aggits-integrity.json','utf8'));
  for(const item of integrity.assets||[integrity]){const actual=crypto.createHash('sha256').update(await fs.readFile(item.asset)).digest('hex');if(actual!==item.sha256)errors.push(`${item.asset} failed its approved SHA-256 identity check.`)}
}catch(error){errors.push(`Aggits integrity check failed: ${error.message}`)}
const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
if(!platform.defaultEdition)errors.push('platform.json requires defaultEdition.');
let publicBaseURL;
try{
  publicBaseURL=new URL(platform.publicBaseURL);
  if(publicBaseURL.protocol!=='https:'||publicBaseURL.hostname.endsWith('.example'))errors.push('platform.json publicBaseURL must be the permanent HTTPS Deep Cuts address.');
  if(publicBaseURL.pathname!=='/'||publicBaseURL.search||publicBaseURL.hash)errors.push('platform.json publicBaseURL must not contain a path, query or fragment.');
}catch{errors.push('platform.json requires a valid publicBaseURL.');}
const slugs=new Set();
const editionIds=new Set();
for(const edition of platform.editions){
  if(slugs.has(edition.slug))errors.push(`Duplicate edition slug: ${edition.slug}`);slugs.add(edition.slug);
  if(!/^[A-Za-z0-9_-]{4,40}$/.test(edition.editionId||''))errors.push(`${edition.slug} requires an opaque editionId.`);
  if(editionIds.has(edition.editionId))errors.push(`Duplicate editionId: ${edition.editionId}`);editionIds.add(edition.editionId);
  if(edition.canonicalPath!==`/e/${edition.editionId}`)errors.push(`${edition.slug} canonicalPath must use its opaque editionId.`);
  if(publicBaseURL?.href.toLowerCase().includes(edition.slug.toLowerCase()))errors.push('The permanent publicBaseURL must not contain an artist slug.');
  try{
    const config=JSON.parse(await fs.readFile(edition.config,'utf8'));
    if(config.slug!==edition.slug)errors.push(`${edition.config} slug mismatch.`);
    if(!config.bandName||!/^https:\/\//.test(config.publicURL||''))errors.push(`${edition.config} requires bandName and an HTTPS publicURL.`);
    if(config.production){
      if(!config.production.jobId||!Number.isFinite(new Date(config.production.submittedAt).getTime()))errors.push(`${edition.config} requires factory job identity and submission time.`);
      const researchPath=edition.config.replace(/edition\.json$/,'research.json');
      const research=JSON.parse(await fs.readFile(researchPath,'utf8'));
      if(research.editionId!==edition.editionId||!Array.isArray(research.sources)||research.sources.length<2)errors.push(`${researchPath} requires matching edition identity and at least two sources.`);
      for(const[key,value]of Object.entries(config.links||{}))if(value&&!research.sources.some(source=>source.destination===key&&source.identityVerified===true&&normalized(source.url)===normalized(value)))errors.push(`${researchPath} lacks matching verified evidence for links.${key}.`);
    }
    if(config.editionType==='school'){
      if(config.characterArtwork)errors.push(`${edition.config} School Discovery must not configure character artwork.`);
      if(config.theme?.logoPolicy!=='colour-reference-only; no logo or emblem displayed')errors.push(`${edition.config} must preserve the School Discovery no-logo policy.`);
      if(!config.featuredVideo?.youtubeURL)errors.push(`${edition.config} School Discovery requires a featured YouTube video.`);
      if(config.schoolChallenge?.numberOfQuestions!==6||config.schoolChallenge?.secondsPerQuestion!==15||config.schoolChallenge?.feedbackMilliseconds!==10000)errors.push(`${edition.config} must preserve the locked six-question, 15-second Schools Edition challenge.`);
      if(config.schoolChallenge?.dingSound!=='assets/ding.mp3')errors.push(`${edition.config} must preserve the approved time-up bell.`);
      if(!config.schoolChallenge?.questionFile)errors.push(`${edition.config} requires an external School challenge question file.`);
      else{
        const questionPath=String(config.schoolChallenge.questionFile).replace(/^\//,'');
        const questions=JSON.parse(await fs.readFile(questionPath,'utf8'));
        validateSchoolQuestions(questions,questionPath,errors);
        const research=JSON.parse(await fs.readFile(edition.config.replace(/edition\.json$/,'research.json'),'utf8'));
        for(const question of questions)if(!research.sources.some(source=>source.identityVerified===true&&normalized(source.url)===normalized(question.sourceURL)))errors.push(`${questionPath} question ${question.id} lacks matching verified source evidence.`);
      }
    }else await fs.access(config.characterArtwork);
    for(const[key,value]of Object.entries(config.links||{}))if(value&&(!/^https:\/\//.test(value)||authenticationWall(value)))errors.push(`${edition.config} links.${key} must be a direct HTTPS destination, never an authentication URL.`);
    if(config.featuredVideo?.youtubeURL&&!/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(config.featuredVideo.youtubeURL))errors.push(`${edition.config} featuredVideo.youtubeURL must be a verified YouTube URL.`);
    if(config.featuredVideo?.youtubeURL&&config.production){
      const researchPath=edition.config.replace(/edition\.json$/,'research.json');
      const research=JSON.parse(await fs.readFile(researchPath,'utf8'));
      if(!research.sources.some(source=>source.destination==='featuredVideo'&&source.identityVerified===true&&normalized(source.url)===normalized(config.featuredVideo.youtubeURL)))errors.push(`${researchPath} lacks verified featured-video evidence.`);
    }
  }catch(error){errors.push(`${edition.slug}: ${error.message}`)}
}
if(!slugs.has(platform.defaultEdition))errors.push('defaultEdition is not registered.');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`Deep Cuts discovery platform validation passed: ${platform.editions.length} registered edition(s).`);

function normalized(value){try{const url=new URL(String(value));if(url.protocol==='http:')url.protocol='https:';url.hash='';return url.href.replace(/\/$/,'')}catch{return''}}
function authenticationWall(value){try{const url=new URL(String(value));const host=url.hostname.replace(/^www\./,'').toLowerCase(),path=url.pathname.toLowerCase();return host==='instagram.com'&&(path.startsWith('/accounts/login')||path.startsWith('/accounts/signup')||url.searchParams.has('next'))||(host==='facebook.com'||host==='m.facebook.com')&&(/^\/(?:login|checkpoint|recover|reg)(?:\/|$)/.test(path)||(path.startsWith('/login')&&url.searchParams.has('next')))}catch{return false}}
function validateSchoolQuestions(questions,file,errors){
  if(!Array.isArray(questions)||questions.length!==6){errors.push(`${file} must contain exactly six School Discovery questions.`);return}
  const ids=new Set(),prompts=new Set();
  for(const question of questions){
    if(!question.active||!question.id||!question.question||!question.explanation||!question.sourceName||!/^https:\/\//.test(question.sourceURL||''))errors.push(`${file} contains an incomplete School Discovery question.`);
    if(ids.has(question.id)||prompts.has(String(question.question).toLowerCase()))errors.push(`${file} contains a duplicate question.`);
    if(!Array.isArray(question.options)||question.options.length!==4||new Set(question.options).size!==4||!question.options.includes(question.correctAnswer))errors.push(`${file} question ${question.id||'unknown'} requires four unique choices including the correct answer.`);
    ids.add(question.id);prompts.add(String(question.question).toLowerCase());
  }
}

