(function exposeEngine(scope){
  "use strict";
  function shuffle(items,random=Math.random){const copy=[...items];for(let i=copy.length-1;i>0;i-=1){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
  function prepareQuestions(items,count,random=Math.random){return shuffle(items.filter(item=>item.active),random).slice(0,count).map(item=>({...item,options:shuffle(item.options,random)}))}
  class FreshQuestionBank{
    constructor(items,mix,random=Math.random){this.items=items.filter(item=>item.active);this.mix={...mix};this.random=random;this.used=new Set();this.roundGroups=[...new Set(this.items.map(item=>item.roundGroup).filter(Boolean))];this.usedGroups=new Set()}
    nextRound(){
      if(this.roundGroups.length){
        if(this.usedGroups.size===this.roundGroups.length)this.usedGroups.clear();
        const availableGroups=this.roundGroups.filter(group=>!this.usedGroups.has(group));
        const group=shuffle(availableGroups,this.random)[0];
        const selected=this.items.filter(item=>item.roundGroup===group);
        const expected=Object.values(this.mix).reduce((sum,count)=>sum+count,0);
        if(selected.length!==expected)throw new Error(`Round group ${group} must contain exactly ${expected} questions.`);
        for(const[difficulty,count]of Object.entries(this.mix))if(selected.filter(item=>item.difficulty===difficulty).length!==count)throw new Error(`Round group ${group} has an invalid ${difficulty} mix.`);
        this.usedGroups.add(group);
        return shuffle(selected,this.random).map(item=>({...item,options:shuffle(item.options,this.random)}));
      }
      const canComplete=Object.entries(this.mix).every(([difficulty,count])=>this.items.filter(item=>item.difficulty===difficulty&&!this.used.has(item.id)).length>=count);
      if(!canComplete)this.used.clear();
      const round=[];
      for(const[difficulty,count]of Object.entries(this.mix)){
        const available=this.items.filter(item=>item.difficulty===difficulty&&!this.used.has(item.id));
        const selected=shuffle(available,this.random).slice(0,count);
        if(selected.length!==count)throw new Error(`Not enough ${difficulty} questions for a fresh round.`);
        selected.forEach(item=>this.used.add(item.id));
        round.push(...selected);
      }
      return shuffle(round,this.random).map(item=>({...item,options:shuffle(item.options,this.random)}));
    }
    reset(){this.used.clear();this.usedGroups.clear()}
  }
  function classificationFor(score,classifications,band){const match=classifications.find(item=>score>=item.min&&score<=item.max)||classifications[0];return{...match,message:match.message.replaceAll("{band}",band)}}
  function calculateStats(answers,total){const correct=answers.filter(a=>a.correct).length;const unanswered=answers.filter(a=>a.unanswered).length;const incorrect=total-correct-unanswered;const times=answers.filter(a=>!a.unanswered).map(a=>a.responseSeconds);const totalResponseTime=times.reduce((sum,time)=>sum+time,0);const averageResponseTime=times.length?totalResponseTime/times.length:0;const correctTimes=answers.filter(a=>a.correct).map(a=>a.responseSeconds);return{correct,incorrect,unanswered,totalResponseTime,averageResponseTime,fastestCorrect:correctTimes.length?Math.min(...correctTimes):null,accuracy:total?Math.round(correct/total*100):0}}
  scope.SevenSecondsBandEngine={shuffle,prepareQuestions,FreshQuestionBank,classificationFor,calculateStats};
})(typeof window!=="undefined"?window:globalThis);
