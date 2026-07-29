(function exposeBusinessProfile(scope){
  "use strict";

  const $=id=>document.getElementById(id);
  const els={
    screen:$("businessProfileScreen"),
    result:$("businessProfileResultScreen"),
    home:$("businessProfileHomeButton"),
    progressText:$("businessProfileProgressText"),
    progress:$("businessProfileScreen")?.querySelector(".business-profile-progress"),
    progressBar:$("businessProfileProgressBar"),
    logo:$("businessProfileLogo"),
    question:$("businessProfileQuestion"),
    answers:$("businessProfileAnswers"),
    feedback:$("businessProfileFeedback"),
    back:$("businessProfileBackButton"),
    next:$("businessProfileNextButton"),
    resultLogo:$("businessProfileResultLogo"),
    resultTitle:$("businessProfileResultTitle"),
    resultRows:$("businessProfileResultRows"),
    summary:$("businessProfileSummary"),
    response:$("businessProfileResponse"),
    sms:$("businessProfileSmsButton"),
    restart:$("businessProfileRestartButton"),
    resultHome:$("businessProfileResultHomeButton")
  };

  let config=null;
  let profile=null;
  let analytics=null;
  let homeElement=null;
  let invitationButton=null;
  let questions=[];
  let answers={};
  let index=0;
  let opened=false;
  let startedAt=0;
  let completed=false;

  function configure(options){
    config=options.config;
    profile=config.businessProfile;
    analytics=options.analytics;
    homeElement=options.homeElement;
    invitationButton=options.invitationButton;
    validateProfile(profile);
    questions=profile.questions;

    for(const logo of [els.logo,els.resultLogo]){
      logo.src=`/${config.business.logoArtwork}`;
      logo.alt=config.bandName;
    }
    els.home.textContent=`← ${config.business.shortName||config.bandName} Jobs`;
    els.resultHome.textContent=`Back to ${config.business.shortName||config.bandName} Jobs`;
    els.resultTitle.textContent=profile.resultTitle;
    els.sms.textContent=profile.smsButtonLabel;
    els.restart.textContent=profile.restartLabel;
    invitationButton.disabled=false;
  }

  function validateProfile(value){
    if(!value||!Array.isArray(value.questions)||value.questions.length!==5)throw new Error("The HGM profile builder requires exactly five questions.");
    const ids=new Set();
    for(const question of value.questions){
      if(!question.id||!question.profileLabel||!question.question||!question.feedback||!Array.isArray(question.options)||question.options.length<2)throw new Error(`Invalid HGM profile question: ${question.id||"unknown"}`);
      if(ids.has(question.id)||new Set(question.options).size!==question.options.length)throw new Error(`Duplicate HGM profile question data: ${question.id}`);
      ids.add(question.id);
    }
    if(!value.recruiter?.name||typeof value.recruiter.mobileNumber!=="string")throw new Error("The HGM recruiter configuration is incomplete.");
  }

  function open(){
    if(opened||invitationButton?.disabled)return;
    opened=true;
    if(!history.state?.businessProfile)history.pushState({businessProfile:config.analytics.editionId},"",location.href);
    start();
  }

  function start(){
    answers={};
    index=0;
    completed=false;
    startedAt=performance.now();
    analytics.setRun?.();
    homeElement.hidden=true;
    els.result.hidden=true;
    els.screen.hidden=false;
    analytics.track("candidate_profile_started",{profile_identifier:config.analytics.pageIdentifier,question_count:questions.length,edition_type:config.editionType});
    renderQuestion();
  }

  function renderQuestion(){
    const question=questions[index];
    const selected=answers[question.id]||"";
    els.progressText.textContent=`Question ${index+1} of ${questions.length}`;
    els.progress.setAttribute("aria-valuenow",String(index+1));
    els.progressBar.style.width=`${((index+1)/questions.length)*100}%`;
    els.question.textContent=question.question;
    els.answers.replaceChildren();

    question.options.forEach(option=>{
      const button=document.createElement("button");
      button.type="button";
      button.className="business-profile-answer";
      button.textContent=option;
      button.setAttribute("aria-pressed",String(selected===option));
      if(selected===option)button.classList.add("is-selected");
      button.addEventListener("click",()=>selectAnswer(question,option));
      els.answers.append(button);
    });

    els.feedback.textContent=selected?question.feedback:"";
    els.feedback.hidden=!selected;
    els.next.disabled=!selected;
    els.next.textContent=index===questions.length-1?"Build My Profile":"Continue";
    els.back.disabled=index===0;
    scope.scrollTo({top:0,behavior:prefersReducedMotion()?"auto":"smooth"});
    els.question.focus({preventScroll:true});
  }

  function selectAnswer(question,option){
    answers[question.id]=option;
    for(const button of els.answers.children){
      const selected=button.textContent===option;
      button.classList.toggle("is-selected",selected);
      button.setAttribute("aria-pressed",String(selected));
    }
    els.feedback.textContent=question.feedback;
    els.feedback.hidden=false;
    els.next.disabled=false;
    analytics.track("candidate_profile_answer_selected",{profile_identifier:config.analytics.pageIdentifier,question_id:question.id,question_number:index+1,answer:option,edition_type:config.editionType});
  }

  function next(){
    const question=questions[index];
    if(!answers[question.id])return;
    if(index===questions.length-1){showResult();return}
    index+=1;
    renderQuestion();
  }

  function back(){
    if(index===0)return;
    index-=1;
    renderQuestion();
  }

  function showResult(){
    completed=true;
    els.resultRows.replaceChildren();
    for(const question of questions){
      const row=document.createElement("div");
      row.className="business-profile-result-row";
      const label=document.createElement("span");
      label.textContent=question.profileLabel;
      const value=document.createElement("strong");
      value.textContent=answers[question.id];
      row.append(label,value);
      els.resultRows.append(row);
    }
    els.summary.textContent=naturalSummary();
    els.response.textContent=profile.resultResponse;
    els.sms.href=buildSmsURL();
    els.sms.setAttribute("aria-label",`${profile.smsButtonLabel}. Opens your text messaging application with this profile ready to send.`);
    els.screen.hidden=true;
    els.result.hidden=false;
    scope.scrollTo({top:0,behavior:prefersReducedMotion()?"auto":"smooth"});
    els.resultTitle.focus?.({preventScroll:true});
    analytics.track("candidate_profile_completed",{profile_identifier:config.analytics.pageIdentifier,selections:{...answers},completion_seconds:Math.round((performance.now()-startedAt)/1000),edition_type:config.editionType});
  }

  function naturalSummary(){
    const trade=answers.trade==="Other"?"working in another trade":`a ${answers.trade}`;
    const opportunity=answers.opportunity==="Open to options"?"an opportunity that fits":`${answers.opportunity.toLowerCase()} work`;
    const workType=answers.workType==="Open to options"?"with flexible work arrangements":`in ${answers.workType}`;
    const roster=answers.roster==="Flexible"?"a flexible roster":answers.roster==="Short-term or shutdown work"?"short-term or shutdown scheduling":`a ${answers.roster} roster`;
    const pay=answers.pay==="Open to the right opportunity"?"an open mind on pay for the right opportunity":`a preferred rate of ${answers.pay.toLowerCase()}`;
    return `Here’s what we’re hearing. You’re ${trade} looking for ${opportunity} ${workType}, ideally with ${roster}, and ${pay}.`;
  }

  function buildSmsURL(){
    const recruiter=profile.recruiter;
    const recipient=String(recruiter.mobileNumber||"").replace(/[^\d+]/g,"");
    const lines=[
      `Hi ${recruiter.name}, I completed the HGM ‘Tell Us What You Want’ profile.`,
      "",
      `Trade: ${answers.trade}`,
      `Work type: ${answers.workType}`,
      `Preferred roster: ${answers.roster}`,
      `Pay preference: ${answers.pay}`,
      `Opportunity type: ${answers.opportunity}`,
      "",
      "I’d be interested in having a chat about suitable opportunities."
    ];
    return `sms:${recipient}?&body=${encodeURIComponent(lines.join("\n"))}`;
  }

  function returnHome(fromPopState=false){
    if(!opened)return;
    if(!fromPopState&&history.state?.businessProfile){history.back();return}
    analytics.clearRun?.();
    opened=false;
    els.screen.hidden=true;
    els.result.hidden=true;
    homeElement.hidden=false;
    scope.scrollTo({top:0,behavior:"auto"});
  }

  function restart(){
    analytics.track("candidate_profile_restarted",{profile_identifier:config.analytics.pageIdentifier,edition_type:config.editionType});
    start();
  }

  function prefersReducedMotion(){return scope.matchMedia?.("(prefers-reduced-motion: reduce)").matches===true}

  els.home.addEventListener("click",()=>returnHome(false));
  els.resultHome.addEventListener("click",()=>returnHome(false));
  els.back.addEventListener("click",back);
  els.next.addEventListener("click",next);
  els.restart.addEventListener("click",restart);
  els.sms.addEventListener("click",()=>analytics.track("candidate_profile_sms_opened",{profile_identifier:config.analytics.pageIdentifier,recruiter:profile.recruiter.name,has_configured_recipient:Boolean(profile.recruiter.mobileNumber),edition_type:config.editionType}),{passive:true});
  scope.addEventListener("popstate",()=>returnHome(true));

  scope.BusinessProfile={
    configure,
    open,
    returnHome,
    test:{
      validateProfile,
      buildSmsURL,
      naturalSummary,
      getState:()=>({opened,index,answers:{...answers},profileVisible:!els.screen.hidden,resultVisible:!els.result.hidden,completed})
    }
  };
})(window);
