(function installDeepCutsJookBoxCoinAudio(global){
  "use strict";

  const AudioContextConstructor=global.AudioContext||global.webkitAudioContext;

  function normaliseSource(value){
    const source=String(value||"").trim();
    if(!source)return"";
    return source.startsWith("/")?source:`/${source}`;
  }

  function clampVolume(value){
    const volume=Number(value);
    return Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):1;
  }

  class CoinAudio{
    constructor(source,{volume=1,gain=1.15}={}){
      this.source=normaliseSource(source);
      this.volume=clampVolume(volume);
      this.gain=Math.max(.1,Math.min(1.5,Number(gain)||1.15));
      this.element=null;
      this.context=null;
      this.buffer=null;
      this.bufferPromise=null;
      this.activeSource=null;
      this.activeCompletion=null;
      if(!this.source)return;

      try{
        this.element=new Audio(this.source);
        this.element.preload="auto";
        this.element.volume=this.volume;
        this.element.muted=false;
        this.element.load();
      }catch(error){
        console.warn("JookBox coin recording could not be prepared.",error);
      }

      if(AudioContextConstructor){
        try{
          this.context=new AudioContextConstructor({latencyHint:"interactive"});
          this.bufferPromise=fetch(this.source,{cache:"force-cache",credentials:"same-origin"})
            .then(response=>{
              if(!response.ok)throw new Error(`Coin recording request returned ${response.status}.`);
              return response.arrayBuffer();
            })
            .then(bytes=>this.context.decodeAudioData(bytes.slice(0)))
            .then(buffer=>(this.buffer=buffer))
            .catch(error=>{
              console.warn("JookBox coin recording could not be decoded; HTML audio remains available.",error);
              return null;
            });
        }catch(error){
          console.warn("JookBox coin recording Web Audio preparation was unavailable.",error);
          this.context=null;
          this.bufferPromise=null;
        }
      }
    }

    stop(){
      this.finishActivePlayback();
      if(this.activeSource){
        try{this.activeSource.stop()}catch{}
        this.activeSource=null;
      }
      if(this.element){
        this.element.pause();
        try{this.element.currentTime=0}catch{}
      }
    }

    finishActivePlayback(error=null){
      const completion=this.activeCompletion;
      this.activeCompletion=null;
      if(!completion)return;
      completion.cleanup?.();
      if(error)completion.reject(error);
      else completion.resolve();
    }

    startDecodedBuffer(){
      if(!this.context||!this.buffer||this.context.state==="closed")return null;
      return new Promise((resolve,reject)=>{
        const source=this.context.createBufferSource();
        const gainNode=this.context.createGain();
        source.buffer=this.buffer;
        gainNode.gain.value=this.gain;
        source.connect(gainNode);
        gainNode.connect(this.context.destination);
        const cleanup=()=>source.removeEventListener("ended",finish);
        const finish=()=>{
          if(this.activeSource===source)this.activeSource=null;
          this.finishActivePlayback();
        };
        source.addEventListener("ended",finish,{once:true});
        this.activeCompletion={resolve,reject,cleanup};
        try{
          source.start(0);
          this.activeSource=source;
        }catch(error){
          this.finishActivePlayback(error);
        }
      });
    }

    playHtmlRecording(){
      if(!this.element)return Promise.reject(new Error("HTML audio is unavailable."));
      const element=this.element;
      element.muted=false;
      element.volume=this.volume;
      try{element.currentTime=0}catch{}
      return new Promise((resolve,reject)=>{
        let guardTimer=0;
        const cleanup=()=>{
          element.removeEventListener("ended",finish);
          element.removeEventListener("error",fail);
          if(guardTimer)global.clearTimeout(guardTimer);
        };
        const finish=()=>this.finishActivePlayback();
        const fail=()=>this.finishActivePlayback(element.error||new Error("The coin recording could not be played."));
        element.addEventListener("ended",finish,{once:true});
        element.addEventListener("error",fail,{once:true});
        this.activeCompletion={resolve,reject,cleanup};
        guardTimer=global.setTimeout(finish,8000);
        let playback;
        try{playback=element.play()}catch(error){playback=Promise.reject(error)}
        Promise.resolve(playback).catch(error=>this.finishActivePlayback(error));
      });
    }

    play(){
      if(!this.source)return Promise.reject(new Error("JookBox coin recording has no source."));
      this.stop();

      let resumePromise=Promise.resolve();
      if(this.context&&this.context.state!=="running"&&this.context.state!=="closed"){
        try{resumePromise=Promise.resolve(this.context.resume())}catch(error){resumePromise=Promise.reject(error)}
      }
      /* HTML media is the first choice because it is started synchronously inside
         the visitor's coin gesture on iOS. Web Audio remains a decoded fallback. */
      if(this.element){
        resumePromise.catch(()=>{});
        return this.playHtmlRecording().catch(async primaryError=>{
          await resumePromise.catch(()=>{});
          if(this.bufferPromise)await this.bufferPromise;
          const decodedPlayback=this.startDecodedBuffer();
          if(decodedPlayback)return decodedPlayback;
          throw primaryError;
        });
      }

      return resumePromise.then(()=>this.bufferPromise).then(()=>{
        const decodedPlayback=this.startDecodedBuffer();
        if(decodedPlayback)return decodedPlayback;
        throw new Error("JookBox coin recording is unavailable.");
      }).catch(async primaryError=>{
        await resumePromise.catch(()=>{});
        if(this.bufferPromise)await this.bufferPromise;
        const decodedPlayback=this.startDecodedBuffer();
        if(decodedPlayback)return decodedPlayback;
        throw primaryError;
      });
    }

    destroy(){
      this.stop();
      if(this.context&&this.context.state!=="closed")this.context.close().catch(()=>{});
      this.context=null;
      this.buffer=null;
      this.bufferPromise=null;
      this.element=null;
    }
  }

  global.DeepCutsJookBoxCoinAudio=Object.freeze({
    create(source,options){return new CoinAudio(source,options)}
  });
})(window);
