(function exposeBusinessQuiz(scope){
  "use strict";

  const $=id=>document.getElementById(id);
  const els={
    quiz:$("businessQuizScreen"),result:$("businessResultScreen"),progress:$("businessQuizProgress"),category:$("businessQuizCategory"),
    question:$("businessQuestionText"),answers:$("businessAnswerList"),feedback:$("businessAnswerFeedback"),
    feedbackTitle:$("businessFeedbackTitle"),feedbackExplanation:$("businessFeedbackExplanation"),feedbackSource:$("businessFeedbackSource"),
    next:$("businessNextButton"),home:$("businessQuizHomeButton"),resultHome:$("businessResultHomeButton"),replay:$("businessReplayButton"),
    resultScore:$("businessResultScore"),resultTitle:$("businessResultTitle"),resultMessage:$("businessResultMessage"),careers:$("businessResultCareersLink"),
    quizLogo:$("businessQuizLogo"),resultLogo:$("businessResultLogo")
  };
  let config=null,analytics=null,homeElement=null,challengeButton=null,questionBank=[],questions=[],answers=[],index=0,locked=false,opened=false,startedAt=0,runCompleted=false,abandonmentTracked=false;

  async function configure(options){
    config=options.config;analytics=options.analytics;homeElement=options.homeElement;challengeButton=options.challengeButton;
    const challenge=config.businessChallenge;
    if(!challenge?.questionFile)throw new Error("Business challenge configuration is required.");
    const response=await fetch(`/${challenge.questionFile}`,{cache:"no-store"});
    if(!response.ok)throw new Error(`Business questions returned ${response.status}`);
    questionBank=await response.json();validateQuestions(questionBank);
    for(const logo of [els.quizLogo,els.resultLogo]){logo.src=`/${config.business.logoArtwork}`;logo.alt=config.bandName;logo.classList.toggle("business-logo-on-light",config.business.logoSurface==="light");logo.classList.toggle("business-logo-square",config.business.logoShape==="square")}
    els.home.textContent=`← ${config.bandName} Jobs`;els.resultHome.textContent=`Back to ${config.bandName} Jobs`;
    els.careers.href=config.business.careersURL;els.careers.textContent=`Explore ${config.bandName} Careers`;
    els.careers.addEventListener("click",()=>analytics.track("outbound_clicked",{destination_platform:"website",button_name:"careers",interaction_source:"quiz_result",destination_url_origin:new URL(config.business.careersURL).origin,edition_type:config.editionType}),{passive:true});
    challengeButton.disabled=false;
  }

  function validateQuestions(value){
    if(!Array.isArray(value)||value.length!==10)throw new Error("The Business edition requires exactly 10 questions.");
    const ids=new Set(),prompts=new Set();
    for(const question of value){
      if(!question.active||!question.id||!question.question||!question.explanation||!question.sourceName||!validHttps(question.sourceURL))throw new Error(`Invalid Business question: ${question.id||"unknown"}`);
      if(ids.has(question.id)||prompts.has(question.question.toLowerCase())||!Array.isArray(question.options)||question.options.length!==4||new Set(question.options).size!==4||!question.options.includes(question.correctAnswer))throw new Error(`Invalid Business answer set: ${question.id}`);
      ids.add(question.id);prompts.add(question.question.toLowerCase());
    }
  }

  function open(){
    if(opened||challengeButton?.disabled)return;
    opened=true;
    if(!history.state?.businessChallenge)history.pushState({businessChallenge:config.analytics.editionId},"",location.href);
    startRun();
  }

  function startRun(){
    questions=DeepCutsEngine.prepareQuestions(questionBank,10);
    answers=[];index=0;startedAt=performance.now();runCompleted=false;abandonmentTracked=false;analytics.setRun?.();
    homeElement.hidden=true;els.result.hidden=true;els.quiz.hidden=false;
    analytics.track("quiz_started",{quiz_identifier:config.analytics.pageIdentifier,question_count:10,edition_type:config.editionType});
    renderQuestion();
  }

  function renderQuestion(){
    locked=false;
    const question=questions[index];
    els.progress.textContent=`Question ${index+1} of 10`;els.category.textContent=question.category||"HGM Story";els.question.textContent=question.question;
    els.answers.replaceChildren();els.feedback.hidden=true;
    question.options.forEach((option,optionIndex)=>{
      const button=document.createElement("button");button.type="button";button.className="business-answer-button";
      button.textContent=`${String.fromCharCode(65+optionIndex)}. ${option}`;button.dataset.answer=option;
      button.addEventListener("click",()=>selectAnswer(option,button));els.answers.append(button);
    });
    els.next.textContent=index===9?"See My Result":"Next Question";
    window.scrollTo({top:0,behavior:"auto"});els.question.focus({preventScroll:true});
  }

  function selectAnswer(selected,button){
    if(locked)return;
    locked=true;
    const question=questions[index],correct=selected===question.correctAnswer;
    button.classList.add(correct?"best-answer":"wrong-answer");
    answers.push({id:question.id,correct});
    for(const choice of els.answers.children){choice.disabled=true;if(choice.dataset.answer===question.correctAnswer)choice.classList.add("best-answer")}
    els.feedbackTitle.textContent=correct?"Exactly right.":"Not quite — now you know.";
    els.feedbackExplanation.textContent=question.explanation;
    els.feedbackSource.textContent=`Source: ${question.sourceName}`;els.feedbackSource.href=question.sourceURL;els.feedback.hidden=false;
    analytics.track("quiz_question_answered",{quiz_identifier:config.analytics.pageIdentifier,question_id:question.id,question_number:index+1,correct,edition_type:config.editionType});
  }

  function next(){if(!locked)return;index+=1;if(index>=questions.length)showResults();else renderQuestion()}

  function showResults(){
    const stats=DeepCutsEngine.calculateStats(answers,10);
    const result=DeepCutsEngine.classificationFor(stats.correct,config.businessChallenge.classifications,config.bandName);
    els.resultScore.textContent=`${stats.correct} / 10`;els.resultTitle.textContent=result.label;els.resultMessage.textContent=result.message;
    els.quiz.hidden=true;els.result.hidden=false;window.scrollTo({top:0,behavior:"auto"});runCompleted=true;
    analytics.track("quiz_completed",{quiz_identifier:config.analytics.pageIdentifier,final_score:stats.correct,question_count:10,completion_seconds:Math.round((performance.now()-startedAt)/1000),classification:result.label,edition_type:config.editionType});
  }

  function returnHome(fromPopState=false){
    if(!opened)return;
    if(!fromPopState&&history.state?.businessChallenge){history.back();return}
    trackAbandonment();analytics.clearRun?.();opened=false;els.quiz.hidden=true;els.result.hidden=true;homeElement.hidden=false;window.scrollTo({top:0,behavior:"auto"});
  }

  function trackAbandonment(){
    if(runCompleted||abandonmentTracked||!answers.length)return;
    abandonmentTracked=true;
    analytics.track("quiz_abandoned",{quiz_identifier:config.analytics.pageIdentifier,answered_count:answers.length,question_count:10,completion_seconds:Math.round((performance.now()-startedAt)/1000),edition_type:config.editionType});
  }

  function validHttps(value){try{return new URL(String(value)).protocol==="https:"}catch{return false}}

  els.next.addEventListener("click",next);
  els.home.addEventListener("click",()=>returnHome(false));
  els.resultHome.addEventListener("click",()=>returnHome(false));
  els.replay.addEventListener("click",()=>{analytics.track("quiz_replayed",{quiz_identifier:config.analytics.pageIdentifier,edition_type:config.editionType});startRun()});
  window.addEventListener("popstate",()=>returnHome(true));
  window.addEventListener("pagehide",trackAbandonment);

  scope.BusinessQuiz={configure,open,returnHome,test:{validateQuestions,getState:()=>({opened,index,locked,questionCount:questions.length,answerCount:answers.length,quizVisible:!els.quiz.hidden,resultVisible:!els.result.hidden})}};
})(window);
