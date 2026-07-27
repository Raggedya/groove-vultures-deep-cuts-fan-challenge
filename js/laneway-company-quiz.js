(function exposeLanewayCompanyQuiz(scope){
  "use strict";

  const $=id=>document.getElementById(id);
  const els={
    quiz:$("lanewayCompanyQuizScreen"),result:$("lanewayCompanyResultScreen"),progress:$("lanewayCompanyQuizProgress"),category:$("lanewayCompanyQuizCategory"),
    question:$("lanewayCompanyQuestionText"),answers:$("lanewayCompanyAnswerList"),feedback:$("lanewayCompanyAnswerFeedback"),
    feedbackTitle:$("lanewayCompanyFeedbackTitle"),feedbackExplanation:$("lanewayCompanyFeedbackExplanation"),feedbackSource:$("lanewayCompanyFeedbackSource"),
    next:$("lanewayCompanyNextButton"),home:$("lanewayCompanyQuizHomeButton"),resultHome:$("lanewayCompanyResultHomeButton"),replay:$("lanewayCompanyReplayButton"),
    resultScore:$("lanewayCompanyResultScore"),resultTitle:$("lanewayCompanyResultTitle"),resultMessage:$("lanewayCompanyResultMessage"),
    resultContact:$("lanewayCompanyResultContact"),resultContactLink:$("lanewayCompanyResultContactLink")
  };

  const REPORTING_VERSION="laneway-weekly-v1";
  let config=null,analytics=null,homeElement=null,challengeButton=null,questionBank=[],questions=[],answers=[],index=0,locked=false,opened=false,startedAt=0,runCompleted=false,abandonmentTracked=false;

  async function configure(options){
    config=options.config;analytics=options.analytics;homeElement=options.homeElement;challengeButton=options.challengeButton;
    const challenge=challengeConfig();
    if(!challenge)throw new Error("Indie Wheel challenge configuration is required.");
    const response=await fetch(`/${challenge.questionFile}`,{cache:"no-store"});
    if(!response.ok)throw new Error(`Indie Wheel questions returned ${response.status}`);
    questionBank=await response.json();
    validateQuestions(questionBank);
    const settings=config.editionType==="indie_wheel"?config.indieWheel:config.lanewayCompany;
    els.home.textContent=`← ${config.bandName} Home`;
    els.resultHome.textContent=`Back to ${config.bandName} Home`;
    const logo=document.getElementById("lanewayCompanyResultLogo");
    logo.src=`/${settings.logoArtwork}`;logo.alt=config.bandName;
    document.getElementById("lanewayCompanyResultKicker").textContent=`Your ${config.bandName} Result`;
    const showServices=config.editionType==="laneway_company"&&validHttps(settings.servicesURL);
    els.resultContact.hidden=!showServices;
    if(showServices){
      els.resultContactLink.href=settings.servicesURL;
      els.resultContactLink.setAttribute("aria-label",`Contact ${config.bandName} about music services (opens in a new tab)`);
      els.resultContactLink.addEventListener("click",()=>analytics.track("services_contact_clicked",{button_name:"laneway_sync",interaction_source:"quiz_result",destination_url_origin:new URL(settings.servicesURL).origin,edition_type:config.editionType,tracking_version:REPORTING_VERSION}),{passive:true});
    }
    challengeButton.disabled=false;
  }

  function challengeConfig(){return config?.editionType==="indie_wheel"?config.indieWheelChallenge:config?.editionType==="laneway_company"?config.lanewayCompanyChallenge:null}

  function validateQuestions(value){
    if(!Array.isArray(value)||value.length!==10)throw new Error("The Indie Wheel edition requires exactly 10 questions.");
    const ids=new Set(),prompts=new Set();
    for(const question of value){
      if(!question.active||!question.id||!question.question||!question.explanation||!question.sourceName||!validHttps(question.sourceURL))throw new Error(`Invalid Indie Wheel question: ${question.id||"unknown"}`);
      if(ids.has(question.id)||prompts.has(question.question.toLowerCase())||!Array.isArray(question.options)||question.options.length!==4||new Set(question.options).size!==4||!question.options.includes(question.correctAnswer))throw new Error(`Invalid Indie Wheel answer set: ${question.id}`);
      ids.add(question.id);prompts.add(question.question.toLowerCase());
    }
    return true;
  }

  function open(){
    if(opened||challengeButton?.disabled)return;
    opened=true;
    if(!history.state?.lanewayCompanyChallenge)history.pushState({lanewayCompanyChallenge:config.analytics.editionId},"",location.href);
    startRun();
  }

  function startRun(){
    questions=DeepCutsEngine.prepareQuestions(questionBank,10);
    answers=[];index=0;startedAt=performance.now();runCompleted=false;abandonmentTracked=false;analytics.setRun?.();
    homeElement.hidden=true;els.result.hidden=true;els.quiz.hidden=false;
    analytics.track("quiz_started",{quiz_identifier:config.analytics.pageIdentifier,question_count:10,edition_type:config.editionType,tracking_version:REPORTING_VERSION});
    renderQuestion();
  }

  function renderQuestion(){
    locked=false;
    const question=questions[index];
    els.progress.textContent=`Question ${index+1} of 10`;
    els.category.textContent=question.category||"Artist Deep Cut";
    els.question.textContent=question.question;
    els.answers.replaceChildren();els.feedback.hidden=true;
    question.options.forEach((option,optionIndex)=>{
      const button=document.createElement("button");button.type="button";button.className="laneway-answer-button";
      button.textContent=`${String.fromCharCode(65+optionIndex)}. ${option}`;button.dataset.answer=option;
      button.addEventListener("click",()=>selectAnswer(option,button));els.answers.append(button);
    });
    els.next.textContent=index===9?"See My Result":"Next Question";
    window.scrollTo({top:0,behavior:"auto"});els.question.focus({preventScroll:true});
  }

  function selectAnswer(selected,button){
    if(locked)return;
    locked=true;button.classList.add("selected-choice");
    const question=questions[index],correct=selected===question.correctAnswer;
    answers.push({id:question.id,correct});
    for(const choice of els.answers.children){choice.disabled=true;if(choice.dataset.answer===question.correctAnswer)choice.classList.add("best-answer")}
    els.feedbackTitle.textContent=correct?"Exactly right.":"Not quite — good try.";
    els.feedbackExplanation.textContent=question.explanation;
    els.feedbackSource.textContent=`Source: ${question.sourceName}`;els.feedbackSource.href=question.sourceURL;
    els.feedback.hidden=false;
    analytics.track("quiz_question_answered",{quiz_identifier:config.analytics.pageIdentifier,question_id:question.id,question_number:index+1,correct,edition_type:config.editionType,tracking_version:REPORTING_VERSION});
  }

  function next(){
    if(!locked)return;
    index+=1;
    if(index>=questions.length)showResults();else renderQuestion();
  }

  function showResults(){
    const stats=DeepCutsEngine.calculateStats(answers,10);
    const result=DeepCutsEngine.classificationFor(stats.correct,challengeConfig().classifications,config.bandName);
    els.resultScore.textContent=`${stats.correct} / 10`;els.resultTitle.textContent=result.label;els.resultMessage.textContent=result.message;
    els.quiz.hidden=true;els.result.hidden=false;window.scrollTo({top:0,behavior:"auto"});
    runCompleted=true;
    analytics.track("quiz_completed",{quiz_identifier:config.analytics.pageIdentifier,final_score:stats.correct,question_count:10,completion_seconds:Math.round((performance.now()-startedAt)/1000),classification:result.label,edition_type:config.editionType,tracking_version:REPORTING_VERSION});
  }

  function returnHome(fromPopState=false){
    if(!opened)return;
    if(!fromPopState&&history.state?.lanewayCompanyChallenge){history.back();return}
    trackAbandonment();
    analytics.clearRun?.();
    opened=false;els.quiz.hidden=true;els.result.hidden=true;homeElement.hidden=false;window.scrollTo({top:0,behavior:"auto"});
  }

  function trackAbandonment(){
    if(runCompleted||abandonmentTracked||!answers.length)return;
    abandonmentTracked=true;
    analytics.track("quiz_abandoned",{quiz_identifier:config.analytics.pageIdentifier,answered_count:answers.length,question_count:10,completion_seconds:Math.round((performance.now()-startedAt)/1000),edition_type:config.editionType,tracking_version:REPORTING_VERSION});
  }

  function validHttps(value){try{return new URL(String(value)).protocol==="https:"}catch{return false}}

  els.next.addEventListener("click",next);
  els.home.addEventListener("click",()=>returnHome(false));
  els.resultHome.addEventListener("click",()=>returnHome(false));
  els.replay.addEventListener("click",()=>{analytics.track("quiz_replayed",{quiz_identifier:config.analytics.pageIdentifier,edition_type:config.editionType,tracking_version:REPORTING_VERSION});startRun()});
  window.addEventListener("popstate",()=>returnHome(true));
  window.addEventListener("pagehide",trackAbandonment);

  scope.LanewayCompanyQuiz={configure,open,returnHome,test:{validateQuestions,getState:()=>({opened,index,locked,questionCount:questions.length,answerCount:answers.length,quizVisible:!els.quiz.hidden,resultVisible:!els.result.hidden})}};
})(window);
