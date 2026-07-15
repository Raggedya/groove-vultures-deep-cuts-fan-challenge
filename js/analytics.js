(function exposeDeepCutsAnalytics(scope){
  "use strict";

  const STORAGE_KEY="deepCutsAnalyticsEventsV1";
  const DEFAULT_RETENTION=2500;

  function randomId(){
    try{return scope.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}
    catch{return `${Date.now()}-${Math.random().toString(36).slice(2)}`}
  }

  function deviceCategory(navigatorObject=scope.navigator){
    const agent=String(navigatorObject?.userAgent||"");
    if(navigatorObject?.userAgentData?.mobile||/Android.*Mobile|iPhone|iPod|Windows Phone/i.test(agent))return "mobile";
    if(/iPad|Tablet|Android(?!.*Mobile)/i.test(agent))return "tablet";
    return "desktop";
  }

  function referringSource(locationObject=scope.location,documentObject=scope.document){
    try{
      const params=new URLSearchParams(locationObject?.search||"");
      const campaign=params.get("utm_source")||params.get("source")||params.get("ref");
      if(campaign)return String(campaign).slice(0,100);
      if(documentObject?.referrer)return new URL(documentObject.referrer).hostname.slice(0,100);
    }catch{}
    return "direct";
  }

  function simpleValue(value){
    if(typeof value==="number")return Number.isFinite(value)?value:undefined;
    if(typeof value==="boolean")return value;
    if(value===null||value===undefined)return undefined;
    return String(value).slice(0,500);
  }

  class Tracker{
    constructor({platformConfig={},editionEntry={},editionConfig={},storage=scope.localStorage,windowObject=scope,documentObject=scope.document,navigatorObject=scope.navigator,locationObject=scope.location,now=()=>new Date()}={}){
      this.settings=platformConfig.analytics||{};
      this.editionId=editionEntry.slug||editionConfig.slug||"unknown";
      this.bandName=editionConfig.bandName||editionEntry.name||"Unknown";
      this.quizIdentifier=editionConfig.analytics?.pageIdentifier||editionConfig.analytics?.quizIdentifier||`${this.editionId}:discovery-v1`;
      this.storage=storage;
      this.windowObject=windowObject;
      this.documentObject=documentObject;
      this.navigatorObject=navigatorObject;
      this.locationObject=locationObject;
      this.now=now;
      this.runId="";
      this.recent=new Map();
      this.once=new Set();
      this.retention=Math.max(100,Number(this.settings.localRetention||DEFAULT_RETENTION));
      this.referrer=referringSource(locationObject,documentObject);
      this.device=deviceCategory(navigatorObject);
      this.configureGoogleAnalytics();
    }

    configureGoogleAnalytics(){
      const measurementId=String(this.settings.measurementId||"").trim();
      if(!/^G-[A-Z0-9]+$/i.test(measurementId)||!this.documentObject?.head)return;
      try{
        if(!this.documentObject.querySelector(`script[data-deep-cuts-ga="${measurementId}"]`)){
          const script=this.documentObject.createElement("script");
          script.async=true;
          script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
          script.dataset.deepCutsGa=measurementId;
          this.documentObject.head.append(script);
        }
        this.windowObject.dataLayer=this.windowObject.dataLayer||[];
        this.windowObject.gtag=this.windowObject.gtag||function(){this.dataLayer.push(arguments)}.bind(this.windowObject);
        this.windowObject.gtag("js",new Date());
        this.windowObject.gtag("config",measurementId,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
      }catch{}
    }

    setRun(runId=randomId()){this.runId=runId;return runId}
    clearRun(){this.runId=""}

    track(eventName,data={},options={}){
      try{
        const nowMs=this.now().getTime();
        if(options.onceKey&&this.once.has(options.onceKey))return null;
        const signature=`${eventName}:${options.dedupeKey||""}`;
        const dedupeMs=Number(options.dedupeMs??700);
        if(options.dedupeKey&&nowMs-(this.recent.get(signature)||0)<dedupeMs)return null;
        if(options.onceKey)this.once.add(options.onceKey);
        if(options.dedupeKey)this.recent.set(signature,nowMs);
        const event={
          event_id:randomId(),
          event_name:String(eventName).slice(0,80),
          timestamp:new Date(nowMs).toISOString(),
          edition_id:this.editionId,
          band_name:this.bandName,
          quiz_identifier:this.quizIdentifier,
          quiz_run_id:this.runId||undefined,
          referring_source:this.referrer,
          device_category:this.device
        };
        for(const[key,value]of Object.entries(data)){const simple=simpleValue(value);if(simple!==undefined)event[key]=simple}
        this.persist(event);
        this.emit(event);
        return event;
      }catch{return null}
    }

    persist(event){
      try{
        const events=JSON.parse(this.storage?.getItem(STORAGE_KEY)||"[]");
        const next=Array.isArray(events)?events:[];
        next.push(event);
        this.storage?.setItem(STORAGE_KEY,JSON.stringify(next.slice(-this.retention)));
      }catch{}
    }

    emit(event){
      try{this.windowObject?.dispatchEvent?.(new CustomEvent("fan-challenge-analytics",{detail:event}))}catch{}
      try{this.windowObject?.gtag?.("event",event.event_name,{...event,transport_type:"beacon"})}catch{}
      const endpoint=String(this.settings.endpoint||"").trim();
      if(!/^https:\/\//i.test(endpoint))return;
      try{
        const body=JSON.stringify(event);
        if(this.navigatorObject?.sendBeacon&&this.navigatorObject.sendBeacon(endpoint,new Blob([body],{type:"application/json"})))return;
        this.windowObject?.fetch?.(endpoint,{method:"POST",headers:{"content-type":"application/json"},body,keepalive:true,credentials:"omit"}).catch(()=>{});
      }catch{}
    }

    static storedEvents(storage=scope.localStorage){
      try{const events=JSON.parse(storage?.getItem(STORAGE_KEY)||"[]");return Array.isArray(events)?events:[]}
      catch{return []}
    }
  }

  scope.DeepCutsAnalytics={Tracker,STORAGE_KEY,deviceCategory,referringSource,randomId};
})(typeof window!=="undefined"?window:globalThis);
