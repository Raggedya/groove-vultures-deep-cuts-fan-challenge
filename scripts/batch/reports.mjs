import fs from 'node:fs/promises';
import path from 'node:path';
import {csvText} from './csv.mjs';

const COLUMNS=['artist_name','follower_count','follower_platform','confidence_score','source_count','question_count','build_status','deployment_status','post_deployment_test_status','live_url','rejection_or_failure_reason'];

export async function writeReports(summary,dir='reports'){
  await fs.mkdir(dir,{recursive:true});
  const rows=summary.artists.map(item=>({
    artist_name:item.artist,follower_count:item.followerCount??'',follower_platform:item.followerPlatform||'',confidence_score:item.confidence??'',source_count:item.sourceCount??0,
    question_count:0,build_status:item.buildStatus,deployment_status:item.deploymentStatus||'not_started',post_deployment_test_status:item.postDeploymentStatus||'not_started',live_url:item.liveURL||'',
    rejection_or_failure_reason:(item.reasons||[]).map(value=>`${value.code}: ${value.message}`).join(' | ')
  }));
  await Promise.all([
    fs.writeFile(path.join(dir,'LATEST_BATCH_SUMMARY.json'),JSON.stringify(summary,null,2)+'\n'),
    fs.writeFile(path.join(dir,'LATEST_BATCH_SUMMARY.csv'),csvText(rows,COLUMNS)),
    fs.writeFile(path.join(dir,'LATEST_BATCH_SUMMARY.md'),markdown(summary,rows)),
    fs.writeFile(path.join(dir,'REJECTED_ARTISTS.csv'),csvText(rows.filter(row=>row.build_status==='rejected'),COLUMNS)),
    fs.writeFile(path.join(dir,'SOURCE_AUDIT.csv'),csvText(sourceRows(summary),['artist_name','destination','url','source_host','http_status','identity_verified','verified_at','evidence'])),
    fs.writeFile(path.join(dir,'DEPLOYMENT_RESULTS.csv'),csvText(rows,['artist_name','build_status','deployment_status','post_deployment_test_status','live_url','rejection_or_failure_reason']))
  ]);
}

function sourceRows(summary){return summary.artists.flatMap(item=>Object.entries(item.evidence||{}).map(([destination,evidence])=>({artist_name:item.artist,destination,url:evidence.url,source_host:evidence.sourceHost,http_status:evidence.status,identity_verified:evidence.identityVerified,verified_at:evidence.verifiedAt,evidence:evidence.evidence})))}
function markdown(summary,rows){
  const line=(label,value)=>`- **${label}:** ${value}`;
  const table=rows.map(row=>`| ${escape(row.artist_name)} | ${row.build_status} | ${row.confidence_score||'—'} | ${escape(row.live_url||'—')} | ${escape(row.rejection_or_failure_reason||'—')} |`).join('\n');
  return `# Deep Cuts batch summary\n\nThis report explains the latest unattended artist batch in plain language. Artists are published only after reaching the mandatory 98% evidence threshold. Rejected artists did not affect the rest of the batch.\n\n${line('Batch ID',summary.batchId)}\n${line('CSV rows',summary.counts.total)}\n${line('Valid rows',summary.counts.valid)}\n${line('Completed artists',summary.counts.completed)}\n${line('Deployed artists',summary.counts.deployed)}\n${line('Rejected artists',summary.counts.rejected)}\n${line('Technical failures',summary.counts.technicalFailures)}\n${line('Skipped completed artists',summary.counts.skippedCompleted)}\n${line('Started',summary.startedAt)}\n${line('Finished',summary.finishedAt)}\n${line('Total duration',formatDuration(summary.durationMs))}\n\n## Artist results\n\n| Artist | Result | Confidence | Live URL | Reason |\n|---|---:|---:|---|---|\n${table}\n\n## What rejection means\n\nA rejection is a safety result, not a system crash. It means the available public evidence did not prove every required direct destination and artist identity to at least 98% confidence. Search-result pages, placeholders and guesses are never published.\n`;
}
function escape(value){return String(value).replaceAll('|','\\|').replace(/\r?\n/g,' ')}
function formatDuration(ms){const seconds=Math.round(ms/1000);return seconds<60?`${seconds} seconds`:`${Math.floor(seconds/60)}m ${seconds%60}s`}
