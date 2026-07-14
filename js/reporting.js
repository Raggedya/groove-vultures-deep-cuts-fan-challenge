(function exposeDeepCutsReporting(scope){
  "use strict";
  const outboundEvents=new Set(["spotify_clicked","bandcamp_clicked","instagram_clicked","youtube_clicked","facebook_clicked","tiktok_clicked","website_clicked","tickets_clicked","merchandise_clicked","mailing_list_clicked"]);
  const socialEvents=new Set(["instagram_clicked","youtube_clicked","facebook_clicked","tiktok_clicked"]);
  const count=(events,name)=>events.filter(event=>event.event_name===name).length;
  const rate=(numerator,denominator)=>denominator?numerator/denominator:0;

  function aggregate(events=[]){
    const grouped=new Map();
    for(const event of events){
      const id=event.edition_id||"unknown";
      if(!grouped.has(id))grouped.set(id,[]);
      grouped.get(id).push(event);
    }
    return [...grouped.entries()].map(([editionId,items])=>{
      const pageViews=count(items,"quiz_page_viewed");
      const quizStarts=count(items,"quiz_started");
      const completed=items.filter(item=>item.event_name==="quiz_completed");
      const quizCompletions=completed.length;
      const averageScore=quizCompletions?completed.reduce((total,item)=>total+Number(item.final_score||0),0)/quizCompletions:0;
      const shareActions=count(items,"share_method_selected");
      const outbound=items.filter(item=>outboundEvents.has(item.event_name));
      return {
        editionId,
        bandName:items.find(item=>item.band_name)?.band_name||editionId,
        pageViews,quizStarts,quizCompletions,
        completionRate:rate(quizCompletions,quizStarts),
        averageScore,
        shareActions,
        shareRate:rate(shareActions,quizCompletions),
        totalOutboundClicks:outbound.length,
        spotifyClicks:count(items,"spotify_clicked"),
        bandcampClicks:count(items,"bandcamp_clicked"),
        instagramClicks:count(items,"instagram_clicked"),
        youtubeClicks:count(items,"youtube_clicked"),
        otherSocialClicks:outbound.filter(item=>socialEvents.has(item.event_name)&&!["instagram_clicked","youtube_clicked"].includes(item.event_name)).length,
        websiteClicks:count(items,"website_clicked"),
        ticketClicks:count(items,"tickets_clicked"),
        merchandiseClicks:count(items,"merchandise_clicked"),
        outboundClickThroughRate:rate(outbound.length,quizCompletions)
      };
    }).sort((a,b)=>a.bandName.localeCompare(b.bandName));
  }

  scope.DeepCutsReporting={aggregate,outboundEvents};
})(typeof window!=="undefined"?window:globalThis);
