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
    }else if(config.editionType==='business'){
      if(config.brandName!=='Deep Cuts Business'||!config.characterArtwork)errors.push(`${edition.config} must preserve the isolated Deep Cuts Business artwork contract.`);
      if(!config.business?.logoArtwork)errors.push(`${edition.config} must use a verified official business logo asset.`);
      if(config.featuredVideo?.selectionBasis!=='owner-selected'||config.featuredVideo?.ownerSelected!==true||!config.featuredVideo?.youtubeURL)errors.push(`${edition.config} requires an explicit owner-selected Business Recruitment video.`);
      if(config.businessChallenge?.numberOfQuestions!==10||!config.businessChallenge?.questionFile)errors.push(`${edition.config} requires an isolated 10-question Business challenge.`);
      else{
        const questionPath=String(config.businessChallenge.questionFile).replace(/^\//,'');
        const questions=JSON.parse(await fs.readFile(questionPath,'utf8'));
        validateBusinessQuestions(questions,questionPath,errors);
        const research=JSON.parse(await fs.readFile(edition.config.replace(/edition\.json$/,'research.json'),'utf8'));
        for(const question of questions)if(!research.sources.some(source=>source.identityVerified===true&&normalized(source.url)===normalized(question.sourceURL)))errors.push(`${questionPath} question ${question.id} lacks matching verified source evidence.`);
      }
      const jobs=Array.isArray(config.business?.jobs)?config.business.jobs:[];
      if(jobs.length<1)errors.push(`${edition.config} requires at least one verified current job.`);
      const jobIds=new Set(),jobURLs=new Set();
      const research=JSON.parse(await fs.readFile(edition.config.replace(/edition\.json$/,'research.json'),'utf8'));
      const jobPrefix=normalized(config.business?.jobURLPrefix);
      for(const job of jobs){
        const url=normalized(job.url);
        if(!job.id||!job.label||!jobPrefix||!url.startsWith(jobPrefix)||url===jobPrefix)errors.push(`${edition.config} contains an incomplete or non-direct official job destination.`);
        if(jobIds.has(job.id)||jobURLs.has(url))errors.push(`${edition.config} contains a duplicate Business job.`);
        if(!research.sources.some(source=>source.destination===`job:${job.id}`&&source.identityVerified===true&&normalized(source.url)===url))errors.push(`${edition.config} job ${job.id||'unknown'} lacks matching official source evidence.`);
        jobIds.add(job.id);jobURLs.add(url);
      }
      for(const asset of [config.characterArtwork,config.business?.logoArtwork])await fs.access(asset);
    }else if(config.editionType==='jukebox'){
      if(config.brandName!=='JookBox'||config.characterArtwork)errors.push(`${edition.config} must preserve the isolated no-Aggits JookBox contract.`);
      const appearanceVariant=config.jookBox?.appearanceVariant||'reference';
      const atlasReferenceCabinet=appearanceVariant==='atlas-reference-cabinet/1';
      const keyBankFormat=config.jookBox?.keyBankFormat||'classic-eight-key/1';
      const sixKeyFormat=keyBankFormat==='six-key/1';
      const validKeyBankFormat=['classic-eight-key/1','six-key/1'].includes(keyBankFormat);
      const validAppearanceVariant=['reference','atlas-reference-cabinet/1'].includes(appearanceVariant);
      const validLightSequence=config.jookBox?.lightSequenceMode==='single-key';
      if(config.jookBox?.modelVersion!=='jookbox/3'||config.jookBox?.layoutVersion!=='coin-awakening/1'||JSON.stringify(config.jookBox?.heroLabels)!==JSON.stringify(['Listen','Watch','Follow','Shop'])||config.jookBox?.lightSequence!==true||!validKeyBankFormat||!validAppearanceVariant||!validLightSequence||config.jookBox?.coinStart!==true||config.jookBox?.syncMode!=='verified-build-time')errors.push(`${edition.config} must preserve the locked coin-awakening JookBox model, appearance, key-bank format and single-key light sequence.`);
      if(!config.jookBox?.tickerBio||!config.jookBox?.coinSound||!config.jookBox?.coinSoundSha256||!/^https:\/\//.test(config.jookBox?.coinSoundSource||'')||!config.jookBox?.coinSoundLicense||!config.jookBox?.sessionStorageKey)errors.push(`${edition.config} requires configured ticker copy, sourced local coin audio with an integrity hash and licence, and session restoration.`);
      if(config.jookBox?.autoplayDelayMs!==0)errors.push(`${edition.config} must request JookBox video playback immediately within the direct coin interaction.`);
      if(!(config.jookBox?.buttonLightDurationMs>=450&&config.jookBox?.buttonLightDurationMs<=1200))errors.push(`${edition.config} must use a valid JookBox light duration.`);
      if(config.featuredVideo?.selectionBasis!=='most-viewed-official'||!config.featuredVideo?.youtubeURL)errors.push(`${edition.config} requires the verified most-viewed official YouTube feature.`);
      const selections=Array.isArray(config.jookBox?.selections)?config.jookBox.selections:[];
      if(!selections.length)errors.push(`${edition.config} requires verified Linktree selection keys.`);
      const ids=new Set(),selectionURLs=new Set();
      const research=JSON.parse(await fs.readFile(edition.config.replace(/edition\.json$/,'research.json'),'utf8'));
      for(const selection of selections){
        const url=normalized(selection.url);
        if(!selection.id||!selection.sourceTitle||!selection.label||!url||!['bandcamp','spotify','youtube','facebook','instagram','merchandise','website'].includes(selection.platform))errors.push(`${edition.config} contains an incomplete JookBox selection.`);
        if(selection.kind&& !['show','bandcamp','spotify','youtube','instagram','facebook','tiktok','buy_music','merchandise','newsletter','website','contact','deep_cut'].includes(selection.kind))errors.push(`${edition.config} contains an unsupported JookBox selection kind.`);
        if(selection.kind==='show'&&(!selection.dateLabel||!selection.venue))errors.push(`${edition.config} JookBox show ${selection.id||'unknown'} requires verified date and venue display data.`);
        if(ids.has(selection.id)||selectionURLs.has(url))errors.push(`${edition.config} contains a duplicate JookBox selection.`);
        if(!research.sources.some(source=>source.destination===`selection:${selection.id}`&&source.identityVerified===true&&normalized(source.url)===url))errors.push(`${edition.config} JookBox selection ${selection.id||'unknown'} lacks matching source evidence.`);
        ids.add(selection.id);selectionURLs.add(url);
      }
      const displayIds=Array.isArray(config.jookBox?.displaySelectionIds)?config.jookBox.displaySelectionIds:[];
      const validDisplayCount=sixKeyFormat?displayIds.length>=4&&displayIds.length<=6:displayIds.length>=1&&displayIds.length<=8;
      if(!validDisplayCount||new Set(displayIds).size!==displayIds.length||displayIds.some(id=>!ids.has(id)))errors.push(sixKeyFormat?`${edition.config} six-key format requires four to six unique display selection IDs backed by verified snapshot entries; Learn More and then Share fill the remaining positions.`:`${edition.config} requires one to eight unique display selection IDs backed by verified snapshot entries.`);
      const timings=config.jookBox?.startupTimingsMs||{};
      if(!(timings.mechanism>=0&&timings.neonOn>=300&&timings.screenOn>=timings.neonOn&&timings.buttonsOn>=timings.screenOn&&timings.tickerOn>=timings.buttonsOn))errors.push(`${edition.config} contains an invalid JookBox start-up timeline.`);
      if(!normalized(config.jookBox?.linkSourceURL)||!Number.isFinite(new Date(config.jookBox?.linkSourceVerifiedAt).getTime())||!research.sources.some(source=>source.destination==='jookBoxSource'&&source.identityVerified===true&&normalized(source.url)===normalized(config.jookBox?.linkSourceURL)))errors.push(`${edition.config} requires a dated, verified Linktree source snapshot.`);
      if(!Array.isArray(config.jookBox?.biography?.paragraphs)||!config.jookBox.biography.paragraphs.length||!research.sources.some(source=>source.destination==='biography'&&source.identityVerified===true&&normalized(source.url)===normalized(config.jookBox?.biography?.sourceURL)))errors.push(`${edition.config} requires a sourced Learn More biography.`);
      if(config.jookBox?.cabinetArtwork){
        const cabinet=await fs.readFile(config.jookBox.cabinetArtwork);
        if(config.jookBox.cabinetArtworkSha256&&crypto.createHash('sha256').update(cabinet).digest('hex')!==config.jookBox.cabinetArtworkSha256)errors.push(`${edition.config} locked JookBox cabinet artwork failed its SHA-256 identity check.`);
      }
      const atlasSupportAction=config.jookBox?.supportAction;
      if(atlasReferenceCabinet&&(
        config.jookBox?.cabinetArtworkSha256!=='ee1f3b869c2b8e9b7ac747e33d62de20a7904b3ed6fcacf7e87bbfeec61bdfb3'||
        config.jookBox?.cabinetArtwork!=='assets/jookbox-atlas-reference-v1.webp'||
        atlasSupportAction?.action!=='share'||
        atlasSupportAction?.label!=='Support Our Band'||
        atlasSupportAction?.detail!=='Please share our JookBox'||
        atlasSupportAction?.kind!=='share'||
        atlasSupportAction?.icon!=='\u2661'||
        atlasSupportAction?.detailIcon!=='\u2197'||
        config.jookBox?.cabinetCopyright!=='Copyright Clearlight Creative 2026.'||
        keyBankFormat!=='six-key/1'||
        config.jookBox?.lightSequenceMode!=='single-key'
      ))errors.push(`${edition.config} must preserve the locked ATLAS reference cabinet, Support Our Band share action with both icons, cabinet copyright, exact six-key bank and single-key reading-order light sequence.`);
      if(config.jookBox?.coinSound){
        const coinSound=await fs.readFile(config.jookBox.coinSound);
        if(config.jookBox.coinSoundSha256&&crypto.createHash('sha256').update(coinSound).digest('hex')!==config.jookBox.coinSoundSha256)errors.push(`${edition.config} JookBox coin recording failed its SHA-256 identity check.`);
      }
    }else if(config.editionType==='laneway'){
      if(config.characterArtwork)errors.push(`${edition.config} Laneway must never configure Aggits or other character artwork.`);
      if(config.laneway?.logoArtwork!=='assets/laneway-music-logo-reverse-transparent.png'||config.laneway?.logoTreatment!=='reverse-white-transparent')errors.push(`${edition.config} must preserve the approved transparent reverse-white Laneway Music logo treatment.`);
      if(JSON.stringify(config.laneway?.heroLabels)!==JSON.stringify(['Listen','Watch','Discover','Buy']))errors.push(`${edition.config} must preserve the Laneway Listen, Watch, Discover, Buy navigation labels.`);
      if(normalized(config.laneway?.recordCompanyHomeURL)!=='https://www.lanewaymusic.com.au'||normalized(config.laneway?.recommendedArtistsURL)!=='https://www.lanewaymusic.com.au')errors.push(`${edition.config} must preserve verified Laneway Music Home and Recommended navigation.`);
      const labelSelected=config.featuredVideo?.selectionBasis==='official-label-feature';
      const ownerSelected=config.featuredVideo?.selectionBasis==='owner-selected'&&config.featuredVideo?.ownerSelected===true;
      if(!config.featuredVideo?.youtubeURL||(!labelSelected&&!ownerSelected))errors.push(`${edition.config} requires a verified official-label feature or an explicit owner-selected YouTube video.`);
      if(config.lanewayChallenge?.numberOfQuestions!==5||!config.lanewayChallenge?.questionFile)errors.push(`${edition.config} must preserve the isolated five-question Laneway challenge.`);
      else{
        const questionPath=String(config.lanewayChallenge.questionFile).replace(/^\//,'');
        const questions=JSON.parse(await fs.readFile(questionPath,'utf8'));
        validateLanewayQuestions(questions,questionPath,errors);
        const research=JSON.parse(await fs.readFile(edition.config.replace(/edition\.json$/,'research.json'),'utf8'));
        for(const question of questions)if(!research.sources.some(source=>source.identityVerified===true&&normalized(source.url)===normalized(question.sourceURL)))errors.push(`${questionPath} question ${question.id} lacks matching verified source evidence.`);
      }
      await fs.access(config.laneway.logoArtwork);
    }else if(config.editionType==='laneway_company'){
      if(config.characterArtwork)errors.push(`${edition.config} Laneway Music company edition must never configure character artwork.`);
      if(config.lanewayCompany?.logoArtwork!=='assets/laneway-music-logo-reverse-transparent.png'||config.lanewayCompany?.logoTreatment!=='reverse-white-transparent')errors.push(`${edition.config} must preserve the approved transparent reverse-white Laneway Music logo treatment.`);
      if(config.lanewayCompany?.destinationKey!=='spotifyURL'||config.lanewayCompany?.destinationLabel!=='Spotify')errors.push(`${edition.config} must preserve its verified Spotify wheel destination contract.`);
      if(normalized(config.lanewayCompany?.recordCompanyHomeURL)!=='https://www.lanewaymusic.com.au/about'||normalized(config.lanewayCompany?.recommendedArtistsURL)!=='https://www.lanewaymusic.com.au'||normalized(config.lanewayCompany?.servicesURL)!=='https://www.lanewaymusic.com.au/sync')errors.push(`${edition.config} must preserve the verified Laneway Music company navigation and services destinations.`);
      if(config.featuredVideo?.selectionBasis!=='owner-selected'||config.featuredVideo?.ownerSelected!==true||!config.featuredVideo?.youtubeURL)errors.push(`${edition.config} requires the explicit owner-selected featured video.`);
      if(config.lanewayCompanyChallenge?.numberOfQuestions!==10||!config.lanewayCompanyChallenge?.questionFile)errors.push(`${edition.config} must preserve the isolated 10-question Laneway Music artist challenge.`);
      else{
        if(config.lanewayCompanyChallenge.invitationRevealAfterFirstResultMs!==10000)errors.push(`${edition.config} must preserve the 10-second Laneway Music quiz invitation reveal after the first wheel result.`);
        const questionPath=String(config.lanewayCompanyChallenge.questionFile).replace(/^\//,'');
        const questions=JSON.parse(await fs.readFile(questionPath,'utf8'));
        validateLanewayCompanyQuestions(questions,questionPath,errors);
        const research=JSON.parse(await fs.readFile(edition.config.replace(/edition\.json$/,'research.json'),'utf8'));
        for(const question of questions)if(!research.sources.some(source=>source.identityVerified===true&&normalized(source.url)===normalized(question.sourceURL)))errors.push(`${questionPath} question ${question.id} lacks matching verified source evidence.`);
      }
      const rosterPath=String(config.lanewayCompany?.rosterFile||'').replace(/^\//,'');
      const roster=JSON.parse(await fs.readFile(rosterPath,'utf8'));
      validateLanewayCompanyRoster(roster,rosterPath,errors);
      const impactPath=String(config.lanewayCompany?.artistImpactFile||'').replace(/^\//,'');
      const impactLines=JSON.parse(await fs.readFile(impactPath,'utf8'));
      validateLanewayCompanyImpact(impactLines,roster,impactPath,errors);
      const videoPath=String(config.lanewayCompany?.artistVideoFile||'').replace(/^\//,'');
      const videos=JSON.parse(await fs.readFile(videoPath,'utf8'));
      validateLanewayCompanyVideos(videos,roster,videoPath,errors);
      await fs.access(config.lanewayCompany.logoArtwork);
    }else if(config.editionType==='indie_wheel'){
      if(config.characterArtwork)errors.push(`${edition.config} Indie Wheel must never configure character artwork.`);
      const destinationPairs={bandcampURL:'Bandcamp',spotifyURL:'Spotify'};
      if(!config.indieWheel?.logoArtwork||!config.indieWheel?.rosterFile||destinationPairs[config.indieWheel?.destinationKey]!==config.indieWheel?.destinationLabel)errors.push(`${edition.config} requires isolated Indie Wheel branding, roster and a supported verified destination configuration.`);
      if(config.indieWheelChallenge?.numberOfQuestions!==10||!config.indieWheelChallenge?.questionFile)errors.push(`${edition.config} requires an isolated 10-question Indie Wheel challenge.`);
      else{
        if(config.indieWheel?.modelVersion==='indie_label/1'&&config.indieWheelChallenge.invitationRevealAfterFirstResultMs!==10000)errors.push(`${edition.config} must preserve the 10-second final Indie Label quiz invitation reveal after the first wheel result.`);
        const questionPath=String(config.indieWheelChallenge.questionFile).replace(/^\//,'');
        const questions=JSON.parse(await fs.readFile(questionPath,'utf8'));
        validateIndieWheelQuestions(questions,questionPath,errors);
        const research=JSON.parse(await fs.readFile(edition.config.replace(/edition\.json$/,'research.json'),'utf8'));
        for(const question of questions)if(!research.sources.some(source=>source.identityVerified===true&&normalized(source.url)===normalized(question.sourceURL)))errors.push(`${questionPath} question ${question.id} lacks matching verified source evidence.`);
      }
      const rosterPath=String(config.indieWheel?.rosterFile||'').replace(/^\//,'');
      const roster=JSON.parse(await fs.readFile(rosterPath,'utf8'));
      validateIndieWheelRoster(roster,rosterPath,errors,config.indieWheel);
      if(config.indieWheel?.modelVersion==='indie_label/1'){
        if(!config.indieWheel.artistImpactFile||!config.indieWheel.artistVideoFile||!/^https:\/\//.test(config.indieWheel.servicesURL||''))errors.push(`${edition.config} requires final Indie Label impact, video and contact configuration.`);
        else{
          const impactPath=String(config.indieWheel.artistImpactFile).replace(/^\//,'');
          const impactLines=JSON.parse(await fs.readFile(impactPath,'utf8'));
          validateLanewayCompanyImpact(impactLines,roster,impactPath,errors);
          const videoPath=String(config.indieWheel.artistVideoFile).replace(/^\//,'');
          const videos=JSON.parse(await fs.readFile(videoPath,'utf8'));
          validateIndieLabelVideos(videos,roster,videoPath,errors);
          const research=JSON.parse(await fs.readFile(edition.config.replace(/edition\.json$/,'research.json'),'utf8'));
          for(const video of Object.values(videos.artists||{}))if(!research.sources.some(source=>source.identityVerified===true&&normalized(source.url)===normalized(video.youtubeURL)))errors.push(`${videoPath} video ${video.youtubeURL||'unknown'} lacks matching verified source evidence.`);
        }
      }
      await fs.access(config.indieWheel.logoArtwork);
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
function validateBusinessQuestions(questions,file,errors){
  if(!Array.isArray(questions)||questions.length!==10){errors.push(`${file} must contain exactly 10 Business questions.`);return}
  const ids=new Set(),prompts=new Set();
  for(const question of questions){
    if(!question.active||!question.id||!question.question||String(question.explanation||'').length<50||!question.sourceName||!/^https:\/\//.test(question.sourceURL||''))errors.push(`${file} contains an incomplete Business question.`);
    if(ids.has(question.id)||prompts.has(String(question.question).toLowerCase()))errors.push(`${file} contains a duplicate question.`);
    if(!Array.isArray(question.options)||question.options.length!==4||new Set(question.options).size!==4||!question.options.includes(question.correctAnswer))errors.push(`${file} question ${question.id||'unknown'} requires four unique choices including the correct answer.`);
    ids.add(question.id);prompts.add(String(question.question).toLowerCase());
  }
}
function validateLanewayQuestions(questions,file,errors){
  if(!Array.isArray(questions)||questions.length!==5){errors.push(`${file} must contain exactly five Laneway questions.`);return}
  const ids=new Set(),prompts=new Set();
  for(const question of questions){
    if(!question.active||!question.id||!question.question||String(question.explanation||'').length<50||!question.sourceName||!/^https:\/\//.test(question.sourceURL||''))errors.push(`${file} contains an incomplete Laneway question.`);
    if(ids.has(question.id)||prompts.has(String(question.question).toLowerCase()))errors.push(`${file} contains a duplicate question.`);
    if(!Array.isArray(question.options)||question.options.length!==4||new Set(question.options).size!==4||!question.options.includes(question.correctAnswer))errors.push(`${file} question ${question.id||'unknown'} requires four unique choices including the correct answer.`);
    ids.add(question.id);prompts.add(String(question.question).toLowerCase());
  }
}
function validateLanewayCompanyQuestions(questions,file,errors){
  if(!Array.isArray(questions)||questions.length!==10){errors.push(`${file} must contain exactly 10 Laneway Music artist questions.`);return}
  const ids=new Set(),prompts=new Set();
  for(const question of questions){
    if(!question.active||!question.id||!question.question||String(question.explanation||'').length<50||!question.sourceName||!/^https:\/\//.test(question.sourceURL||''))errors.push(`${file} contains an incomplete Laneway Music company question.`);
    if(ids.has(question.id)||prompts.has(String(question.question).toLowerCase()))errors.push(`${file} contains a duplicate question.`);
    if(!Array.isArray(question.options)||question.options.length!==4||new Set(question.options).size!==4||!question.options.includes(question.correctAnswer))errors.push(`${file} question ${question.id||'unknown'} requires four unique choices including the correct answer.`);
    ids.add(question.id);prompts.add(String(question.question).toLowerCase());
  }
}
function validateLanewayCompanyRoster(roster,file,errors){
  if(!Array.isArray(roster.artists)||roster.artists.length<1){errors.push(`${file} requires at least one verified Laneway artist.`);return}
  if(roster.pendingArtistCount!==0)errors.push(`${file} still has pending artists.`);
  const names=new Set(),spotify=new Set();
  for(const artist of roster.artists){
    const name=String(artist.name||'').trim(),spotifyURL=normalized(artist.spotifyURL);
    if(!name||!/^https:\/\/open\.spotify\.com\/artist\/[A-Za-z0-9]+$/i.test(spotifyURL))errors.push(`${file} contains an invalid direct Spotify artist destination for ${name||'unknown'}.`);
    if(!/^https:\/\/www\.lanewaymusic\.com\.au\//i.test(artist.sourceURL||''))errors.push(`${file} artist ${name||'unknown'} lacks an official Laneway source page.`);
    if(artist.websiteURL&&!/^https:\/\//i.test(artist.websiteURL))errors.push(`${file} artist ${name} has an invalid optional website.`);
    for(const [key,evidenceKey] of [['buyMusicURL','buyMusic'],['buyMerchURL','buyMerch']]){
      const value=String(artist[key]||'').trim(),evidence=String(artist.purchaseVerification?.[evidenceKey]||'').trim();
      if(!value)continue;
      if(!/^https:\/\/[^?#\s]+/i.test(value)||/\/search(?:[/?#]|$)/i.test(value))errors.push(`${file} artist ${name} has an invalid direct ${key} destination.`);
      if(evidence.length<45)errors.push(`${file} artist ${name} requires purchase verification evidence for ${key}.`);
      if(Number.isNaN(Date.parse(artist.purchaseVerification?.checkedAt||'')))errors.push(`${file} artist ${name} requires a valid purchase verification date for ${key}.`);
    }
    if(artist.buyMerchURL&&!/\/merch(?:[/?#]|$)/i.test(artist.buyMerchURL))errors.push(`${file} artist ${name} Buy Merch must link directly to a merch page.`);
    if(artist.purchaseVerification&&!artist.buyMusicURL&&!artist.buyMerchURL)errors.push(`${file} artist ${name} has unused purchase verification evidence.`);
    if(names.has(name.toLowerCase())||spotify.has(spotifyURL))errors.push(`${file} contains a duplicate artist or Spotify destination: ${name}.`);
    names.add(name.toLowerCase());spotify.add(spotifyURL);
  }
}

function validateLanewayCompanyImpact(impactLines,roster,file,errors){
  if(!impactLines||Array.isArray(impactLines)||typeof impactLines!=='object'){errors.push(`${file} must contain a Laneway artist-impact map.`);return}
  const rosterNames=new Set(roster.artists.map(artist=>String(artist.name||'').trim()));
  for(const name of rosterNames){
    const line=String(impactLines[name]||'').trim();
    if(line.length<45||line.length>190)errors.push(`${file} requires one concise sourced impact line for ${name}.`);
  }
  for(const name of Object.keys(impactLines))if(!rosterNames.has(name))errors.push(`${file} contains an impact line for unknown roster artist ${name}.`);
}

function validateLanewayCompanyVideos(videoData,roster,file,errors){
  if(!videoData||Array.isArray(videoData)||typeof videoData!=='object'||!videoData.artists||Array.isArray(videoData.artists)||typeof videoData.artists!=='object'){errors.push(`${file} must contain a Laneway artist-video map.`);return}
  if(Number.isNaN(Date.parse(videoData.verifiedAt||'')))errors.push(`${file} requires a valid verification timestamp.`);
  if(String(videoData.selectionPolicy||'').trim().length<80)errors.push(`${file} requires a clear video-selection policy.`);
  const rosterByName=new Map(roster.artists.map(artist=>[String(artist.name||'').trim(),artist]));
  const allowedBases=new Set(['only-playable-profile-music-video','highest-viewed-playable-profile-music-video','profile-music-video-preferred-over-interview','existing-owner-selected-edition-video']);
  const ids=new Set();
  for(const [name,video] of Object.entries(videoData.artists)){
    const artist=rosterByName.get(name);
    if(!artist){errors.push(`${file} contains a video for unknown roster artist ${name}.`);continue}
    const youtubeURL=String(video?.youtubeURL||'').trim();
    const match=youtubeURL.match(/^https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/);
    if(!String(video?.title||'').trim()||!match)errors.push(`${file} contains incomplete YouTube data for ${name}.`);
    if(normalized(video?.sourceURL)!==normalized(artist.sourceURL))errors.push(`${file} ${name} video must cite that artist's official Laneway profile.`);
    if(video?.playableInEmbed!==true)errors.push(`${file} ${name} video must be verified as playable in an embed.`);
    if(!Number.isSafeInteger(video?.viewCountAtVerification)||video.viewCountAtVerification<0)errors.push(`${file} ${name} video requires its public view count at verification.`);
    if(!allowedBases.has(video?.selectionBasis))errors.push(`${file} ${name} video has an unsupported selection basis.`);
    if(String(video?.evidence||'').trim().length<80)errors.push(`${file} ${name} video requires verification evidence.`);
    if(match&&ids.has(match[1]))errors.push(`${file} reuses YouTube video ${match[1]} for more than one artist.`);
    if(match)ids.add(match[1]);
  }
  const count=Object.keys(videoData.artists).length;
  if(count<1)errors.push(`${file} requires at least one verified artist video.`);
  if(count>=roster.artists.length)errors.push(`${file} must preserve conditional omission rather than imply every roster artist has a verified video.`);
}

function validateIndieWheelQuestions(questions,file,errors){
  if(!Array.isArray(questions)||questions.length!==10){errors.push(`${file} must contain exactly 10 Indie Wheel questions.`);return}
  const ids=new Set(),prompts=new Set();
  for(const question of questions){
    if(!question.active||!question.id||!question.question||String(question.explanation||'').length<50||!question.sourceName||!/^https:\/\//.test(question.sourceURL||''))errors.push(`${file} contains an incomplete Indie Wheel question.`);
    if(ids.has(question.id)||prompts.has(String(question.question).toLowerCase()))errors.push(`${file} contains a duplicate question.`);
    if(!Array.isArray(question.options)||question.options.length!==4||new Set(question.options).size!==4||!question.options.includes(question.correctAnswer))errors.push(`${file} question ${question.id||'unknown'} requires four unique choices including the correct answer.`);
    ids.add(question.id);prompts.add(String(question.question).toLowerCase());
  }
}

function validateIndieWheelRoster(roster,file,errors,settings){
  if(!Array.isArray(roster.artists)||roster.artists.length<1){errors.push(`${file} requires at least one verified Indie Wheel artist.`);return}
  if(roster.pendingArtistCount!==0)errors.push(`${file} still has pending artists.`);
  const names=new Set(),destinations=new Set(),sourceURL=normalized(settings?.rosterSourceURL||roster.sourceURL),destinationKey=settings?.destinationKey;
  for(const artist of roster.artists){
    const name=String(artist.name||'').trim(),destination=normalized(artist[destinationKey]);
    const destinationValid=destinationKey==='spotifyURL'?/^https:\/\/open\.spotify\.com\/artist\/[A-Za-z0-9]+$/i.test(destination):destinationKey==='bandcampURL'?/^https:\/\/[^/]+\.bandcamp\.com$/i.test(destination):false;
    if(!name||!destinationValid)errors.push(`${file} contains an invalid direct ${settings?.destinationLabel||'artist'} destination for ${name||'unknown'}.`);
    if(!sourceURL||normalized(artist.sourceURL)!==sourceURL)errors.push(`${file} artist ${name||'unknown'} lacks the edition's official roster source.`);
    if(artist.websiteURL&&!/^https:\/\//i.test(artist.websiteURL))errors.push(`${file} artist ${name} has an invalid optional website.`);
    for(const [key,evidenceKey] of [['buyMusicURL','buyMusic'],['buyMerchURL','buyMerch']]){
      const value=String(artist[key]||'').trim(),evidence=String(artist.purchaseVerification?.[evidenceKey]||'').trim();
      if(!value)continue;
      if(!/^https:\/\/[^?#\s]+/i.test(value)||/\/search(?:[/?#]|$)/i.test(value))errors.push(`${file} artist ${name} has an invalid direct ${key} destination.`);
      if(evidence.length<45)errors.push(`${file} artist ${name} requires purchase verification evidence for ${key}.`);
      if(Number.isNaN(Date.parse(artist.purchaseVerification?.checkedAt||'')))errors.push(`${file} artist ${name} requires a valid purchase verification date for ${key}.`);
    }
    if(artist.purchaseVerification&&!artist.buyMusicURL&&!artist.buyMerchURL)errors.push(`${file} artist ${name} has unused purchase verification evidence.`);
    if(names.has(name.toLowerCase())||destinations.has(destination))errors.push(`${file} contains a duplicate artist or ${settings?.destinationLabel||'destination'}: ${name}.`);
    names.add(name.toLowerCase());destinations.add(destination);
  }
}

function validateIndieLabelVideos(videoData,roster,file,errors){
  if(!videoData||Array.isArray(videoData)||typeof videoData!=='object'||!videoData.artists||Array.isArray(videoData.artists)||typeof videoData.artists!=='object'){errors.push(`${file} must contain an Indie Label artist-video map.`);return}
  if(Number.isNaN(Date.parse(videoData.verifiedAt||'')))errors.push(`${file} requires a valid verification timestamp.`);
  const rosterNames=new Set(roster.artists.map(artist=>String(artist.name||'').trim())),ids=new Set();
  for(const [name,video] of Object.entries(videoData.artists)){
    const match=String(video?.youtubeURL||'').match(/^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/);
    if(!rosterNames.has(name))errors.push(`${file} contains a video for unknown roster artist ${name}.`);
    if(!match||!/^https:\/\//.test(video?.sourceURL||''))errors.push(`${file} ${name} requires direct YouTube and authoritative source URLs.`);
    if(video?.playableInEmbed!==true)errors.push(`${file} ${name} video must be verified as playable in an embed.`);
    if(!Number.isSafeInteger(video?.viewCountAtVerification)||video.viewCountAtVerification<0)errors.push(`${file} ${name} video requires its public view count at verification.`);
    if(video?.selectionBasis!=='official-label-channel-popular-sort')errors.push(`${file} ${name} video has an unsupported selection basis.`);
    if(String(video?.evidence||'').trim().length<80)errors.push(`${file} ${name} video requires verification evidence.`);
    if(match&&ids.has(match[1]))errors.push(`${file} reuses YouTube video ${match[1]} for more than one artist.`);
    if(match)ids.add(match[1]);
  }
  const count=Object.keys(videoData.artists).length;
  if(count<1)errors.push(`${file} requires at least one verified artist video.`);
  if(count>=roster.artists.length)errors.push(`${file} must preserve conditional omission rather than imply every roster artist has a verified video.`);
}

