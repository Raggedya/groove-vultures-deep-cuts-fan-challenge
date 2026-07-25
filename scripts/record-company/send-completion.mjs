import fs from "node:fs/promises";
import path from "node:path";

const output=process.argv[2];
if(!output)throw new Error("Usage: node scripts/record-company/send-completion.mjs <output-directory>");
const api=String(process.env.DEEP_CUTS_API_URL||"").replace(/\/+$/,"");
const adminToken=process.env.DEEP_CUTS_ADMIN_TOKEN;
const resendKey=process.env.RESEND_API_KEY;
const sender=process.env.REPORT_FROM_EMAIL;
const bundle=JSON.parse(await fs.readFile(path.join(output,"build-export.json"),"utf8"));
const manifest=JSON.parse(await fs.readFile(path.join(output,"delivery-manifest.json"),"utf8"));
const recipient=bundle.job.notification_email||process.env.REPORT_RECIPIENT;
if(!api||!adminToken||!resendKey||!sender||!recipient)throw new Error("Deep Cuts API, Resend and recipient configuration are required.");
if(!manifest.masterQrVerified||!manifest.reportsReconciled)throw new Error("Delivery assets have not passed QR and reporting verification.");
await updateStage("sending_completion_email");

const attachments=[];
for(const filename of [manifest.masterQrFile,manifest.xlsxFile,manifest.reportingZipFile]){
  const file=await fs.readFile(path.join(output,filename));
  attachments.push({filename,content:file.toString("base64")});
}
const exceptions=bundle.exceptions||[];
const companyUrl=`${api}/record-company/${bundle.company.slug}`;
const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{
  authorization:`Bearer ${resendKey}`,"content-type":"application/json","idempotency-key":`record-company-${bundle.job.job_id}`
},body:JSON.stringify({
  from:sender,to:[recipient],subject:`Deep Cuts Record Company Edition Complete — ${bundle.company.name}`,
  html:`<h2>${escapeHtml(bundle.company.name)} — Deep Cuts is complete</h2>
    <p>Status: <strong>${exceptions.length?"Completed with exceptions":"Completed"}</strong></p>
    <ul><li>Source: <a href="${escapeHtml(bundle.company.official_url)}">${escapeHtml(bundle.company.official_url)}</a></li>
    <li>Started: ${escapeHtml(bundle.job.started_at)}</li><li>Completed: ${new Date().toISOString()}</li>
    <li>Roster discovered: ${bundle.reconciliation.counts.published+exceptions.length}</li>
    <li>Artist pages completed: ${bundle.reconciliation.counts.published}</li><li>Skipped or failed: ${exceptions.length}</li></ul>
    <p><a href="${escapeHtml(companyUrl)}">Open the Record Company Deep Cuts collection</a></p>
    <p>Every included QR code was decoded and verified. The master Ultra HD QR collection and reporting exports are attached.</p>
    ${exceptions.length?`<p>The build completed with ${exceptions.length} recorded exception(s). See the Exceptions worksheet.</p>`:""}`,
  attachments,tags:[{name:"job_id",value:bundle.job.job_id},{name:"job_type",value:"record_company"}]
})});
const result=await response.json().catch(()=>({}));
if(!response.ok)throw new Error(`Completion email failed: ${JSON.stringify(result)}`);
const recorded=await fetch(`${api}/api/record-company/jobs/${bundle.job.job_id}/delivery`,{method:"POST",headers:{authorization:`Bearer ${adminToken}`,"content-type":"application/json"},body:JSON.stringify({
  masterQrVerified:true,reportsReconciled:true,emailProviderId:result.id,verifiedCodes:manifest.qrCodes
})});
if(!recorded.ok)throw new Error(`Delivery status recording failed: ${await recorded.text()}`);
console.log(JSON.stringify({ok:true,emailId:result.id,recipient,companyUrl}));
async function updateStage(stage){
  const response=await fetch(`${api}/api/record-company/jobs/${bundle.job.job_id}/stage`,{method:"POST",headers:{authorization:`Bearer ${adminToken}`,"content-type":"application/json"},body:JSON.stringify({stage})});
  if(!response.ok)throw new Error(`Delivery stage update failed: ${await response.text()}`);
}
function escapeHtml(value){return String(value||"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
