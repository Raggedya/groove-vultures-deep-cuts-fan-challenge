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
      if(this.activeSource){
        try{this.activeSource.stop()}catch{}
        this.activeSource=null;
      }
      if(this.element){
        this.element.pause();
        try{this.element.currentTime=0}catch{}
      }
    }

    startDecodedBuffer(){
      if(!this.context||!this.buffer||this.context.state==="closed")return false;
      const source=this.context.createBufferSource();
      const gainNode=this.context.createGain();
      source.buffer=this.buffer;
      gainNode.gain.value=this.gain;
      source.connect(gainNode);
      gainNode.connect(this.context.destination);
      source.addEventListener("ended",()=>{if(this.activeSource===source)this.activeSource=null},{once:true});
      source.start(0);
      this.activeSource=source;
      return true;
    }

    play(){
      if(!this.source)return Promise.reject(new Error("JookBox coin recording has no source."));
      this.stop();

      let resumePromise=Promise.resolve();
      if(this.context&&this.context.state!=="running"&&this.context.state!=="closed"){
        try{resumePromise=Promise.resolve(this.context.resume())}catch(error){resumePromise=Promise.reject(error)}
      }
      if(this.buffer&&this.context){
        return resumePromise.then(()=>{
          if(!this.startDecodedBuffer())throw new Error("Decoded JookBox coin recording could not start.");
        });
      }

      if(!this.element){
        return resumePromise.then(()=>this.bufferPromise).then(()=>{
          if(!this.startDecodedBuffer())throw new Error("JookBox coin recording is unavailable.");
        });
      }

      this.element.muted=false;
      this.element.volume=this.volume;
      try{this.element.currentTime=0}catch{}
      let playback;
      try{playback=this.element.play()}catch(error){playback=Promise.reject(error)}
      return Promise.resolve(playback).catch(async primaryError=>{
        await resumePromise.catch(()=>{});
        if(this.bufferPromise)await this.bufferPromise;
        if(this.startDecodedBuffer())return;
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
