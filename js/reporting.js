(function exposeDeepCutsReporting(scope){
  "use strict";
  const outboundEvents=new Set(["spotify_clicked","bandcamp_clicked","instagram_clicked","youtube_clicked","facebook_clicked","tiktok_clicked","website_clicked","tickets_clicked","merchandise_clicked","mailing_list_clicked","tip_clicked"]);
  const socialEvents=new Set(["instagram_clicked","youtube_clicked","facebook_clicked","tiktok_clicked"]);
  const count=(events,...names)=>events.filter(event=>names.includes(event.event_name)).length;
  const rate=(a,b)=>b?a/b:0;
  function aggregate(events=[]){
    const grouped=new Map();for(const event of events){const id=event.edition_id||"unknown";if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(event)}
    return [...grouped.entries()].map(([editionId,items])=>{
      const pageViews=count(items,"discovery_page_viewed","quiz_page_viewed");
      const shareActions=count(items,"share_method_selected");
      const outbound=items.filter(item=>outboundEvents.has(item.event_name));
      return{editionId,bandName:items.find(item=>item.band_name)?.band_name||editionId,pageViews,shareActions,shareRate:rate(shareActions,pageViews),totalOutboundClicks:outbound.length,
        spotifyClicks:count(items,"spotify_clicked"),bandcampClicks:count(items,"bandcamp_clicked"),instagramClicks:count(items,"instagram_clicked"),youtubeClicks:count(items,"youtube_clicked"),
        otherSocialClicks:outbound.filter(item=>socialEvents.has(item.event_name)&&!["instagram_clicked","youtube_clicked"].includes(item.event_name)).length,
        websiteClicks:count(items,"website_clicked"),ticketClicks:count(items,"tickets_clicked"),merchandiseClicks:count(items,"merchandise_clicked"),tipClicks:count(items,"tip_clicked"),
        outboundClickThroughRate:rate(outbound.length,pageViews)};
    }).sort((a,b)=>a.bandName.localeCompare(b.bandName));
  }
  scope.DeepCutsReporting={aggregate,outboundEvents};
})(typeof window!=="undefined"?window:globalThis);
