import fs from 'node:fs/promises';
import {completionEmailBody,latestCompletedBuild,loadTrackingConfig} from './build-tracker.mjs';

const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
const slug=process.argv[2]||platform.defaultEdition;
const buildRecordIndex=process.argv.indexOf('--build-record');
const entry=platform.editions.find(edition=>edition.slug===slug);
if(!entry)throw new Error(`Unknown edition: ${slug}`);
const config=JSON.parse(await fs.readFile(entry.config,'utf8'));
const manifest=JSON.parse(await fs.readFile(`output/${slug}/delivery-manifest.json`,'utf8'));
const tracking=buildRecordIndex>=0?JSON.parse(await fs.readFile(process.argv[buildRecordIndex+1],'utf8')):await latestCompletedBuild(slug);
if(!tracking)throw new Error(`No completed build record found for ${slug}. Complete the build before preparing delivery.`);
const trackingConfig=await loadTrackingConfig();
const body=completionEmailBody(config,tracking,{detailedUsage:trackingConfig.detailed_usage_in_email});
await fs.writeFile(`output/${slug}/completion-email.txt`,body);
const delivery={to:trackingConfig.email_recipient,subject:`${config.bandName} Deep Cuts Fan Challenge - live link`,bodyFile:`output/${slug}/completion-email.txt`,attachments:[manifest.files.instagramImage.path,manifest.files.qrImage.path],buildId:tracking.build_id};
await fs.writeFile(`output/${slug}/delivery.json`,JSON.stringify(delivery,null,2)+'\n');
console.log(JSON.stringify(delivery,null,2));
