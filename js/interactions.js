(function exposeDeepCutsInteractions(scope){
  "use strict";
  function safeOrigin(url){try{return new URL(url).origin}catch{return ""}}
  function shareMethodUrl(method,payload){
    const url=encodeURIComponent(payload.url);
    const text=encodeURIComponent(`${payload.text} ${payload.url}`);
    if(method==="facebook")return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    if(method==="x")return `https://twitter.com/intent/tweet?text=${text}`;
    if(method==="whatsapp")return `https://wa.me/?text=${text}`;
    if(method==="messenger")return `fb-messenger://share/?link=${url}`;
    if(method==="email")return `mailto:?subject=${encodeURIComponent(payload.title)}&body=${encodeURIComponent(`${payload.text}\n\n${payload.url}`)}`;
    return "";
  }
  function supportsNativeShare(navigatorObject,deviceCategory){return typeof navigatorObject?.share==="function"&&deviceCategory!=="desktop"}
  async function nativeShare({navigatorObject,tracker,payload,actionId,finalScore}){
    const context={share_method:"native_device",share_action_id:actionId,final_score:finalScore};
    tracker.track("share_method_selected",context);
    tracker.track("native_share_opened",context);
    try{await navigatorObject.share(payload);tracker.track("native_share_completed",context);return "completed"}
    catch(error){if(error?.name==="AbortError"){tracker.track("native_share_cancelled",context);return "cancelled"}return "failed"}
  }
  async function copyLink({clipboard,tracker,text,trigger,actionId,finalScore}){
    const context={share_method:"copy_link",share_action_id:actionId,copy_trigger:trigger,final_score:finalScore};
    tracker.track("copy_link_clicked",context,{dedupeKey:`copy:${trigger}`,dedupeMs:500});
    try{await clipboard.writeText(text);tracker.track("copy_link_succeeded",context);return true}catch{return false}
  }
  function trackOutbound(tracker,platform,url,finalScore){
    try{return tracker.track(`${platform==="mailingList"?"mailing_list":platform}_clicked`,{destination_platform:platform,destination_url_origin:safeOrigin(url),final_score:finalScore},{dedupeKey:`outbound:${platform}`,dedupeMs:500})}catch{return null}
  }
  scope.DeepCutsInteractions={safeOrigin,shareMethodUrl,supportsNativeShare,nativeShare,copyLink,trackOutbound};
})(typeof window!=="undefined"?window:globalThis);
