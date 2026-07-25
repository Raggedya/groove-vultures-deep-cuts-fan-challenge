import fs from "node:fs/promises";
import path from "node:path";

const args=process.argv.slice(2);
const recordCompanyUrl=args.find(value=>!value.startsWith("--"));
if(!recordCompanyUrl)throw new Error('Usage: npm run record-company:start -- "https://record-company.example"');
const api=String(process.env.DEEP_CUTS_API_URL||"").replace(/\/+$/,"");
const token=process.env.DEEP_CUTS_ADMIN_TOKEN;
if(!api||!token)throw new Error("DEEP_CUTS_API_URL and DEEP_CUTS_ADMIN_TOKEN are required.");

const payload={
  recordCompanyUrl,
  recordCompanyLogo:option("--logo"),
  notificationEmail:option("--email")||process.env.REPORT_RECIPIENT||"",
  projectName:option("--project")||"",
  refreshExisting:args.includes("--refresh"),
  analyticsEnabled:!args.includes("--no-analytics"),
  sendCompletionEmail:!args.includes("--no-email")
};
const started=await request("/api/record-company/jobs",{method:"POST",body:payload});
console.log(`Record Company job ${started.jobId} started.`);
if(args.includes("--no-wait"))process.exit(0);

const deadline=Date.now()+Number(process.env.RECORD_COMPANY_TIMEOUT_MS||21600000);
let status;
while(Date.now()<deadline){
  status=await request(`/api/record-company/jobs/${started.jobId}`);
  console.log(`${status.current_stage}: ${status.progress_completed}/${status.progress_total||"?"}`);
  if(status.status==="ready_for_delivery")break;
  if(status.status==="failed")throw new Error(status.error_summary||"Record Company build failed.");
  await new Promise(resolve=>setTimeout(resolve,Number(process.env.RECORD_COMPANY_POLL_MS||10000)));
}
if(status?.status!=="ready_for_delivery")throw new Error("Record Company build did not become ready before the workflow timeout.");
const bundle=await request(`/api/record-company/jobs/${started.jobId}/export`);
const slug=bundle.company.slug,output=path.join("record-company-output",slug);
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,"build-export.json"),JSON.stringify(bundle,null,2)+"\n");
console.log(JSON.stringify({jobId:started.jobId,slug,output,companyName:bundle.company.name}));

function option(name){const index=args.indexOf(name);return index>=0?String(args[index+1]||""):""}
async function request(route,{method="GET",body}={}){
  const response=await fetch(`${api}${route}`,{method,headers:{authorization:`Bearer ${token}`,...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  const value=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(value.error||`Deep Cuts API returned HTTP ${response.status}.`);
  return value;
}
