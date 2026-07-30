const SECURITY_HEADERS={
  "content-security-policy":[
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' https: data:",
    "media-src 'self'",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' https://www.googletagmanager.com",
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "upgrade-insecure-requests"
  ].join("; "),
  "cross-origin-opener-policy":"same-origin",
  "permissions-policy":"camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "referrer-policy":"strict-origin-when-cross-origin",
  "strict-transport-security":"max-age=31536000; includeSubDomains",
  "x-content-type-options":"nosniff",
  "x-frame-options":"DENY"
};

const PRIVATE_ROOTS=new Set([
  ".agents",".codex",".deep-cuts",".git",".github",
  "data","migrations","node_modules","record-company-output",
  "scripts","studio","worker"
]);
const PRIVATE_FILE_NAMES=new Set([
  "agents.md","build-export.json","claude.md","codex_handover.md",
  "delivery-manifest.json","package-lock.json","package.json",
  "platform_architecture_directive.md","research.json","roadmap.md",
  "wrangler.json","wrangler.jsonc"
]);
const PRIVATE_EXTENSIONS=new Set([".csv",".sqlite",".sql",".xlsx",".xls",".zip"]);
const PUBLIC_OUTPUT_FILES=new Set(["instagram-discovery.png","instagram-qr.png"]);
const PUBLIC_API_PATHS=new Set([
  "/api/builds",
  "/api/delivery",
  "/api/editions",
  "/api/events",
  "/api/health",
  "/api/reports/laneway-weekly.pdf",
  "/api/reports/laneway-weekly.xlsx",
  "/api/reports/weekly.csv",
  "/api/webhooks/resend"
]);
const PUBLIC_API_PREFIXES=["/api/builds/","/api/record-company/","/api/sell/"];
const ACTIVE_REQUESTS=new Set();

export function withSecurityHeaders(response){
  const headers=new Headers(response.headers);
  for(const[name,value]of Object.entries(SECURITY_HEADERS))headers.set(name,value);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export function isBlockedPublicPath(pathname){
  let decoded=String(pathname||"/");
  try{
    for(let pass=0;pass<3;pass++){
      const next=decodeURIComponent(decoded);
      if(next===decoded)break;
      decoded=next;
    }
    decoded=decoded.replaceAll("\\","/");
  }
  catch{return true}
  if(decoded.includes("\0"))return true;
  const segments=decoded.split("/").filter(Boolean);
  if(!segments.length)return false;
  const lower=segments.map(segment=>segment.toLowerCase());
  if(lower.some(segment=>segment==="."||segment===".."||segment.startsWith(".")))return true;
  const normalizedPath=`/${lower.join("/")}`;
  if(lower[0]==="api"){
    return !PUBLIC_API_PATHS.has(normalizedPath)
      &&!PUBLIC_API_PREFIXES.some(prefix=>normalizedPath.startsWith(prefix));
  }
  if(PRIVATE_ROOTS.has(lower[0]))return true;
  const fileName=lower.at(-1);
  if(PRIVATE_FILE_NAMES.has(fileName)||PRIVATE_EXTENSIONS.has(extension(fileName)))return true;
  if(fileName.startsWith("checkpoint")||fileName.endsWith(".env")||fileName.includes(".secret"))return true;
  if(lower[0]==="output"){
    return segments.length!==3
      ||!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(segments[1])
      ||!PUBLIC_OUTPUT_FILES.has(fileName);
  }
  if(lower[0]==="editions"&&["research.json","delivery-manifest.json","build-export.json"].includes(fileName))return true;
  return false;
}

export async function readJsonBody(request,{maxBytes=16384,allowedKeys=null}={}){
  const contentType=request.headers.get("content-type")||"";
  if(!/^application\/json(?:\s*;|$)/i.test(contentType)){
    return {ok:false,response:jsonError("JSON content type required",415)};
  }
  const encoding=(request.headers.get("content-encoding")||"identity").toLowerCase();
  if(encoding!=="identity")return {ok:false,response:jsonError("Encoded request bodies are not accepted",415)};
  const declared=Number(request.headers.get("content-length")||0);
  if(Number.isFinite(declared)&&declared>maxBytes)return {ok:false,response:jsonError("Request body is too large",413)};
  let text;
  try{
    text=await readTextWithinLimit(request,maxBytes);
  }catch(error){
    return {ok:false,response:jsonError(error?.code==="BODY_TOO_LARGE"?"Request body is too large":"Invalid request body",error?.code==="BODY_TOO_LARGE"?413:400)};
  }
  let value;
  try{value=JSON.parse(text)}
  catch{return {ok:false,response:jsonError("Malformed JSON request",400)}}
  if(!value||typeof value!=="object"||Array.isArray(value))return {ok:false,response:jsonError("JSON body must be an object",400)};
  if(allowedKeys){
    const unexpected=Object.keys(value).filter(key=>!allowedKeys.has(key));
    if(unexpected.length)return {ok:false,response:jsonError("Request contains unsupported fields",400)};
  }
  return {ok:true,value};
}

export async function enforceRateLimit(env,bindingName,request,scope){
  const limiter=env?.[bindingName];
  if(!limiter||typeof limiter.limit!=="function")return {ok:true,configured:false};
  const key=await rateLimitKey(request,scope);
  try{
    const result=await limiter.limit({key});
    return {ok:Boolean(result?.success),configured:true};
  }catch(error){
    console.error("deep-cuts-rate-limit-error",{binding:bindingName,scope,message:String(error?.message||error)});
    return {ok:false,configured:true,error:true};
  }
}

export async function acquireRequestSlot(request,scope){
  const key=await rateLimitKey(request,`concurrent:${scope}`);
  if(ACTIVE_REQUESTS.has(key))return null;
  ACTIVE_REQUESTS.add(key);
  let released=false;
  return ()=>{
    if(released)return;
    released=true;
    ACTIVE_REQUESTS.delete(key);
  };
}

export function rateLimitResponse(){
  return new Response(JSON.stringify({ok:false,error:"Too many requests. Please wait and try again."}),{
    status:429,
    headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","retry-after":"60"}
  });
}

export function protectionUnavailableResponse(){
  return new Response(JSON.stringify({ok:false,error:"Request protection is temporarily unavailable. Please try again shortly."}),{
    status:503,
    headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","retry-after":"60"}
  });
}

export function concurrentRequestResponse(){
  return new Response(JSON.stringify({ok:false,error:"A research request is already running. Please wait for it to finish."}),{
    status:429,
    headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","retry-after":"10"}
  });
}

export async function reserveDailyUsage(env,usageType,defaultLimit=100){
  const configured=Number(env?.SALES_DAILY_REQUEST_LIMIT||defaultLimit);
  const limit=Number.isFinite(configured)?Math.max(1,Math.min(10000,Math.floor(configured))):defaultLimit;
  if(!env?.DB)return false;
  const date=new Date().toISOString().slice(0,10);
  try{
    const result=await env.DB.prepare(`INSERT INTO security_daily_usage (usage_date,usage_type,request_count,updated_at)
      VALUES (?1,?2,1,?3)
      ON CONFLICT(usage_date,usage_type) DO UPDATE SET
        request_count=security_daily_usage.request_count+1,
        updated_at=excluded.updated_at
      WHERE security_daily_usage.request_count < ?4`)
      .bind(date,String(usageType).slice(0,40),new Date().toISOString(),limit).run();
    return Number(result?.meta?.changes||0)>0;
  }catch(error){
    console.error("deep-cuts-daily-usage-error",{usageType,message:String(error?.message||error)});
    return false;
  }
}

export function dailyLimitResponse(){
  return new Response(JSON.stringify({ok:false,code:"DAILY_RESEARCH_LIMIT_REACHED",error:"The daily research capacity has been reached. Please try again tomorrow."}),{
    status:429,
    headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","retry-after":"3600"}
  });
}

async function readTextWithinLimit(request,maxBytes){
  if(!request.body)return "";
  const reader=request.body.getReader();
  const decoder=new TextDecoder("utf-8",{fatal:true});
  let total=0;
  let text="";
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>maxBytes){
        const error=new Error("Request body is too large");
        error.code="BODY_TOO_LARGE";
        throw error;
      }
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
    return text;
  }finally{
    if(total>maxBytes)await reader.cancel().catch(()=>{});
  }
}

async function rateLimitKey(request,scope){
  const connectingIp=request.headers.get("cf-connecting-ip")||"unknown";
  const input=new TextEncoder().encode(`${scope}:${connectingIp}`);
  const digest=await crypto.subtle.digest("SHA-256",input);
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}

function extension(fileName){
  const index=fileName.lastIndexOf(".");
  return index<0?"":fileName.slice(index);
}

function jsonError(error,status){
  return new Response(JSON.stringify({ok:false,error}),{
    status,
    headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
  });
}

export const __test={
  SECURITY_HEADERS,
  PRIVATE_ROOTS,
  PRIVATE_FILE_NAMES,
  PUBLIC_OUTPUT_FILES,
  PUBLIC_API_PATHS,
  PUBLIC_API_PREFIXES,
  ACTIVE_REQUESTS
};
