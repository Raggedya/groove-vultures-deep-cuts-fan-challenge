(function exposeLanewayQuiz(scope){
  "use strict";

  const $=id=>document.getElementById(id);
  const els={
    quiz:$("lanewayQuizScreen"),result:$("lanewayResultScreen"),progress:$("lanewayQuizProgress"),category:$("lanewayQuizCategory"),
    question:$("lanewayQuestionText"),answers:$("lanewayAnswerList"),feedback:$("lanewayAnswerFeedback"),
    feedbackTitle:$("lanewayFeedbackTitle"),feedbackExplanation:$("lanewayFeedbackExplanation"),feedbackSource:$("lanewayFeedbackSource"),
    next:$("lanewayNextButton"),home:$("lanewayQuizHomeButton"),resultHome:$("lanewayResultHomeButton"),replay:$("lanewayReplayButton"),
    resultScore:$("lanewayResultScore"),resultTitle:$("lanewayResultTitle"),resultMessage:$("lanewayResultMessage")
  };

  let config=null,analytics=null,homeElement=null,challengeButton=null,questionBank=[],questions=[],answers=[],index=0,locked=false,opened=false,startedAt=0;

  async function configure(options){
    config=options.config;analytics=options.analytics;homeElement=options.homeElement;challengeButton=options.challengeButton;
    if(config.editionType!=="laneway"||!config.lanewayChallenge)throw new Error("Laneway challenge configuration is required.");
    const response=await fetch(`/${config.lanewayChallenge.questionFile}`,{cache:"no-store"});
    if(!response.ok)throw new Error(`Laneway questions returned ${response.status}`);
    questionBank=await response.json();
    validateQuestions(questionBank);
    challengeButton.disabled=false;
  }

  function validateQuestions(value){
    if(!Array.isArray(value)||value.length!==5)throw new Error("Laneway editions require exactly five questions.");
    const ids=new Set(),prompts=new Set();
    for(const question of value){
      if(!question.active||!question.id||!question.question||!question.explanation||!question.sourceName||!validHttps(question.sourceURL))throw new Error(`Invalid Laneway question: ${question.id||"unknown"}`);
      if(ids.has(question.id)||prompts.has(question.question.toLowerCase())||!Array.isArray(question.options)||question.options.length!==4||new Set(question.options).size!==4||!question.options.includes(question.correctAnswer))throw new Error(`Invalid Laneway answer set: ${question.id}`);
      ids.add(question.id);prompts.add(question.question.toLowerCase());
    }
    return true;
  }

  function open(){
    if(opened||challengeButton?.disabled)return;
    opened=true;
    if(!history.state?.lanewayChallenge)history.pushState({lanewayChallenge:config.analytics.editionId},"",location.href);
    startRun();
  }

  function startRun(){
    questions=DeepCutsEngine.prepareQuestions(questionBank,5);
    answers=[];index=0;startedAt=performance.now();
    homeElement.hidden=true;els.result.hidden=true;els.quiz.hidden=false;
    analytics.track("quiz_started",{quiz_identifier:config.analytics.pageIdentifier,question_count:5,edition_type:"laneway"});
    renderQuestion();
  }

  function renderQuestion(){
    locked=false;
    const question=questions[index];
    els.progress.textContent=`Question ${index+1} of 5`;
    els.category.textContent=question.category||"Band Story";
    els.question.textContent=question.question;
    els.answers.replaceChildren();els.feedback.hidden=true;
    question.options.forEach((option,optionIndex)=>{
      const button=document.createElement("button");button.type="button";button.className="laneway-answer-button";
      button.textContent=`${String.fromCharCode(65+optionIndex)}. ${option}`;button.dataset.answer=option;
      button.addEventListener("click",()=>selectAnswer(option,button));els.answers.append(button);
    });
    els.next.textContent=index===4?"See My Result":"Next Question";
    window.scrollTo({top:0,behavior:"auto"});els.question.focus({preventScroll:true});
  }

  function selectAnswer(selected,button){
    if(locked)return;
    locked=true;button.classList.add("selected-choice");
    const question=questions[index],correct=selected===question.correctAnswer;
    answers.push({id:question.id,correct});
    for(const choice of els.answers.children){choice.disabled=true;if(choice.dataset.answer===question.correctAnswer)choice.classList.add("best-answer")}
    els.feedbackTitle.textContent=correct?"Exactly right.":"Good choice — here is the story.";
    els.feedbackExplanation.textContent=question.explanation;
    els.feedbackSource.textContent=`Source: ${question.sourceName}`;els.feedbackSource.href=question.sourceURL;
    els.feedback.hidden=false;
    analytics.track("quiz_question_answered",{quiz_identifier:config.analytics.pageIdentifier,question_id:question.id,question_number:index+1,correct,edition_type:"laneway"});
  }

  function next(){
    if(!locked)return;
    index+=1;
    if(index>=questions.length)showResults();else renderQuestion();
  }

  function showResults(){
    const stats=DeepCutsEngine.calculateStats(answers,5);
    const result=DeepCutsEngine.classificationFor(stats.correct,config.lanewayChallenge.classifications,config.bandName);
    els.resultScore.textContent=`${stats.correct} / 5`;els.resultTitle.textContent=result.label;els.resultMessage.textContent=result.message;
    els.quiz.hidden=true;els.result.hidden=false;window.scrollTo({top:0,behavior:"auto"});
    analytics.track("quiz_completed",{quiz_identifier:config.analytics.pageIdentifier,final_score:stats.correct,question_count:5,completion_seconds:Math.round((performance.now()-startedAt)/1000),classification:result.label,edition_type:"laneway"});
  }

  function returnHome(fromPopState=false){
    if(!opened)return;
    if(!fromPopState&&history.state?.lanewayChallenge){history.back();return}
    opened=false;els.quiz.hidden=true;els.result.hidden=true;homeElement.hidden=false;window.scrollTo({top:0,behavior:"auto"});
  }

  function validHttps(value){try{return new URL(String(value)).protocol==="https:"}catch{return false}}

  els.next.addEventListener("click",next);
  els.home.addEventListener("click",()=>returnHome(false));
  els.resultHome.addEventListener("click",()=>returnHome(false));
  els.replay.addEventListener("click",()=>{analytics.track("quiz_replayed",{quiz_identifier:config.analytics.pageIdentifier,edition_type:"laneway"});startRun()});
  window.addEventListener("popstate",()=>returnHome(true));

  scope.LanewayQuiz={configure,open,returnHome,test:{validateQuestions,getState:()=>({opened,index,locked,questionCount:questions.length,answerCount:answers.length,quizVisible:!els.quiz.hidden,resultVisible:!els.result.hidden})}};
})(window);
