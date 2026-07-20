(function exposeSchoolDiscoveryQuiz(scope){
  "use strict";

  const $=id=>document.getElementById(id);
  const els={
    quiz:$("schoolQuizScreen"),result:$("schoolResultScreen"),progress:$("schoolQuizProgress"),category:$("schoolQuizCategory"),
    timer:$("schoolTimerNumber"),timerRing:$("schoolTimerRing"),question:$("schoolQuestionText"),answers:$("schoolAnswerList"),
    feedback:$("schoolAnswerFeedback"),feedbackTitle:$("schoolFeedbackTitle"),feedbackExplanation:$("schoolFeedbackExplanation"),feedbackSource:$("schoolFeedbackSource"),
    home:$("schoolQuizHomeButton"),resultHome:$("schoolResultHomeButton"),sound:$("schoolQuizSoundButton"),replay:$("schoolReplayButton"),
    resultScore:$("schoolResultScore"),resultTitle:$("schoolResultTitle"),resultMessage:$("schoolResultMessage")
  };

  let config=null,analytics=null,homeElement=null,challengeButton=null,questionBank=[],questions=[],answers=[],index=0;
  let locked=false,opened=false,muted=readMutePreference(),timerInterval=null,advanceTimeout=null,timerDeadline=0,startedAt=0;
  let pausedQuestion=false,pausedFeedback=false,ding=null,audioContext=null,dingBuffer=null,bufferSource=null;

  async function configure(options){
    config=options.config;analytics=options.analytics;homeElement=options.homeElement;challengeButton=options.challengeButton;
    if(config.editionType!=="school"||!config.schoolChallenge)throw new Error("School Discovery challenge configuration is required.");
    const response=await fetch(`/${config.schoolChallenge.questionFile}`,{cache:"no-store"});
    if(!response.ok)throw new Error(`School challenge questions returned ${response.status}`);
    questionBank=await response.json();
    validateQuestions();
    createAudio();
    syncSoundControl();
    challengeButton.disabled=false;
  }

  function validateQuestions(){
    const expected=config.schoolChallenge.numberOfQuestions;
    if(expected!==6||questionBank.length!==6)throw new Error("Schools Edition challenges require exactly six questions.");
    const ids=new Set();
    for(const question of questionBank){
      if(!question.active||!question.id||!question.question||!question.explanation||!question.sourceName||!validHttps(question.sourceURL))throw new Error(`Invalid School Discovery question: ${question.id||"unknown"}`);
      if(ids.has(question.id)||!Array.isArray(question.options)||question.options.length!==4||new Set(question.options).size!==4||!question.options.includes(question.correctAnswer))throw new Error(`Invalid answer set for ${question.id}`);
      ids.add(question.id);
    }
  }

  function createAudio(){
    ding=new Audio(`/${config.schoolChallenge.dingSound}`);ding.preload="auto";ding.playsInline=true;ding.load();
    const AudioContextClass=scope.AudioContext||scope.webkitAudioContext;
    if(!AudioContextClass)return;
    try{
      audioContext=new AudioContextClass();
      fetch(`/${config.schoolChallenge.dingSound}`).then(response=>response.ok?response.arrayBuffer():null).then(buffer=>buffer&&audioContext.decodeAudioData(buffer)).then(decoded=>{dingBuffer=decoded||null}).catch(()=>{});
    }catch{audioContext=null}
  }

  function unlockAudio(){
    if(muted)return;
    audioContext?.resume?.().catch(()=>{});
    if(!ding)return;
    const volume=ding.volume;ding.volume=.001;ding.currentTime=0;
    try{ding.play()?.then(()=>{ding.pause();ding.currentTime=0;ding.volume=volume}).catch(()=>{ding.volume=volume})}catch{ding.volume=volume}
  }

  function playDing(){
    if(muted)return;
    stopAudio();
    if(audioContext?.state==="running"&&dingBuffer){
      bufferSource=audioContext.createBufferSource();bufferSource.buffer=dingBuffer;bufferSource.connect(audioContext.destination);bufferSource.start();return;
    }
    try{ding.currentTime=0;ding.volume=1;ding.play()?.catch(()=>{})}catch{}
  }

  function stopAudio(){
    if(bufferSource){try{bufferSource.stop()}catch{}bufferSource=null}
    if(ding){try{ding.pause();ding.currentTime=0}catch{}}
  }

  function open(){
    if(opened||challengeButton?.disabled)return;
    unlockAudio();
    opened=true;
    if(!history.state?.schoolChallenge)history.pushState({schoolChallenge:config.analytics.editionId},"",location.href);
    startRun();
  }

  function startRun(){
    clearTimers();
    questions=DeepCutsEngine.prepareQuestions(questionBank,6);
    answers=[];index=0;startedAt=performance.now();
    homeElement.hidden=true;els.result.hidden=true;els.quiz.hidden=false;
    analytics.track("quiz_started",{quiz_identifier:config.analytics.pageIdentifier,question_count:6});
    renderQuestion();
  }

  function renderQuestion(){
    clearTimers();locked=false;pausedQuestion=false;pausedFeedback=false;
    const question=questions[index];
    els.progress.textContent=`Question ${index+1} of 6`;
    els.category.textContent=question.category||"Our School";
    els.question.textContent=question.question;
    els.answers.innerHTML="";els.feedback.hidden=true;els.feedbackSource.hidden=true;
    els.timer.textContent=String(config.schoolChallenge.secondsPerQuestion);
    els.timerRing.classList.remove("urgent");
    els.timerRing.setAttribute("aria-label",`${config.schoolChallenge.secondsPerQuestion} seconds remaining`);
    question.options.forEach((option,optionIndex)=>{
      const button=document.createElement("button");button.type="button";button.className="school-answer-button";
      button.textContent=`${String.fromCharCode(65+optionIndex)}. ${option}`;button.dataset.answer=option;
      button.addEventListener("click",()=>selectAnswer(option,button));els.answers.append(button);
    });
    window.scrollTo({top:0,behavior:"auto"});els.question.focus({preventScroll:true});
    timerDeadline=performance.now()+config.schoolChallenge.secondsPerQuestion*1000;
    timerInterval=setInterval(updateTimer,50);
  }

  function updateTimer(){
    if(locked)return;
    const remainingMs=timerDeadline-performance.now();
    const remaining=Math.max(0,Math.ceil(remainingMs/1000));
    els.timer.textContent=String(remaining);els.timerRing.setAttribute("aria-label",`${remaining} seconds remaining`);
    els.timerRing.classList.toggle("urgent",remaining>0&&remaining<=3);
    if(remainingMs<=0)completeAnswer(null,true);
  }

  function selectAnswer(selected,button){
    if(locked)return;
    button.classList.add("selected-choice");
    completeAnswer(selected,false);
  }

  function completeAnswer(selected,timedOut){
    if(locked)return;
    locked=true;clearInterval(timerInterval);timerInterval=null;
    const question=questions[index];
    const correct=!timedOut&&selected===question.correctAnswer;
    const responseSeconds=timedOut?config.schoolChallenge.secondsPerQuestion:Math.min(config.schoolChallenge.secondsPerQuestion,Math.max(0,(config.schoolChallenge.secondsPerQuestion*1000-(timerDeadline-performance.now()))/1000));
    answers.push({id:question.id,correct,unanswered:timedOut,responseSeconds});
    for(const button of els.answers.children){button.disabled=true;if(button.dataset.answer===question.correctAnswer)button.classList.add("best-answer")}
    if(timedOut){els.timer.textContent="0";playDing()}
    els.timerRing.classList.remove("urgent");
    els.feedbackTitle.textContent=timedOut?"Time's up - discover the school fact":correct?"You got it!":"Great guess - here's the school fact";
    els.feedbackExplanation.textContent=question.explanation;
    els.feedbackSource.textContent=`Source: ${question.sourceName}`;els.feedbackSource.href=question.sourceURL;els.feedbackSource.hidden=false;els.feedback.hidden=false;
    analytics.track("quiz_question_answered",{quiz_identifier:config.analytics.pageIdentifier,question_id:question.id,question_number:index+1,correct,unanswered:timedOut,response_seconds:Number(responseSeconds.toFixed(2))});
    scheduleAdvance();
  }

  function scheduleAdvance(){
    advanceTimeout=setTimeout(()=>{index+=1;if(index>=questions.length)showResults();else renderQuestion()},config.schoolChallenge.feedbackMilliseconds);
  }

  function showResults(){
    clearTimers();
    const stats=DeepCutsEngine.calculateStats(answers,6);
    const result=DeepCutsEngine.classificationFor(stats.correct,config.schoolChallenge.classifications,config.bandName);
    const completionSeconds=Math.round((performance.now()-startedAt)/1000);
    els.resultScore.textContent=`${stats.correct} / 6`;els.resultTitle.textContent=result.label;els.resultMessage.textContent=result.message;
    els.quiz.hidden=true;els.result.hidden=false;window.scrollTo({top:0,behavior:"auto"});
    analytics.track("quiz_completed",{quiz_identifier:config.analytics.pageIdentifier,final_score:stats.correct,question_count:6,completion_seconds:completionSeconds,classification:result.label});
  }

  function returnHome(fromPopState=false){
    if(!opened)return;
    if(!fromPopState&&history.state?.schoolChallenge){history.back();return}
    clearTimers();stopAudio();opened=false;pausedQuestion=false;pausedFeedback=false;
    els.quiz.hidden=true;els.result.hidden=true;homeElement.hidden=false;window.scrollTo({top:0,behavior:"auto"});
  }

  function clearTimers(){
    if(timerInterval){clearInterval(timerInterval);timerInterval=null}
    if(advanceTimeout){clearTimeout(advanceTimeout);advanceTimeout=null}
  }

  function toggleSound(){muted=!muted;if(muted)stopAudio();try{localStorage.setItem("schoolDiscoveryMuted",String(muted))}catch{}syncSoundControl();analytics.track("sound_changed",{quiz_identifier:config.analytics.pageIdentifier,muted})}
  function syncSoundControl(){els.sound.textContent=`Sound: ${muted?"Off":"On"}`;els.sound.setAttribute("aria-pressed",String(muted))}
  function readMutePreference(){try{return localStorage.getItem("schoolDiscoveryMuted")==="true"}catch{return false}}
  function validHttps(value){try{return new URL(String(value)).protocol==="https:"}catch{return false}}

  els.home.addEventListener("click",()=>returnHome(false));
  els.resultHome.addEventListener("click",()=>returnHome(false));
  els.sound.addEventListener("click",toggleSound);
  els.replay.addEventListener("click",()=>{unlockAudio();analytics.track("quiz_replayed",{quiz_identifier:config.analytics.pageIdentifier});startRun()});
  window.addEventListener("popstate",()=>returnHome(true));
  document.addEventListener("visibilitychange",()=>{
    if(!opened)return;
    if(document.hidden){
      pausedQuestion=Boolean(timerInterval&&!locked);pausedFeedback=Boolean(advanceTimeout&&locked);clearTimers();stopAudio();
      if(pausedQuestion){els.timer.textContent=String(config.schoolChallenge.secondsPerQuestion);els.timerRing.classList.remove("urgent")}
    }else if(pausedQuestion)renderQuestion();else if(pausedFeedback){pausedFeedback=false;scheduleAdvance()}
  });
  window.addEventListener("beforeunload",()=>{clearTimers();stopAudio()});

  scope.SchoolDiscoveryQuiz={configure,open,returnHome,test:{validateQuestions,updateTimer,completeAnswer,showResults,getState:()=>({opened,index,locked,questionCount:questions.length,answerCount:answers.length,timer:els.timer.textContent,quizVisible:!els.quiz.hidden,resultVisible:!els.result.hidden})}};
})(window);
