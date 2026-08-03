import crypto from "node:crypto";
import {createRequire} from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import {AGGITS_JUKEBOX_ICONS} from "./aggits-jukebox-icons.mjs";
import {StudioValidationError,createProject,updateProject} from "./studio-model.mjs";

const require=createRequire(import.meta.url);
const yauzl=require("yauzl");

export const AGGITS_IMPORT_SCHEMA_VERSION="1.0";
export const AGGITS_IMPORT_MAX_FILE_BYTES=30*1024*1024;
export const AGGITS_IMPORT_MAX_ROWS=5000;
export const AGGITS_IMPORT_MAX_COMMIT=1000;
export const AGGITS_IMPORT_LABEL_LIMIT=32;

export const AGGITS_IMPORT_HEADERS=Object.freeze([
  "schema_version","record_id","source_record_id","edition_slug","entity_name","display_name","entity_group","category","subcategory","location_name","state_or_region","country","homepage_url",
  ...Array.from({length:4},(_,offset)=>offset+1).flatMap(position=>[
    `button_${position}_enabled`,`button_${position}_icon`,`button_${position}_label`,`button_${position}_action`,`button_${position}_destination`,`button_${position}_open_new_tab`
  ]),
  "record_status","last_verified_date","discovery_source_url"
]);

// This is intentionally explicit. An unknown spreadsheet key must fail closed rather
// than silently borrowing a visually similar icon.
export const AGGITS_IMPORT_ICON_MAP=Object.freeze({
  ACCOMMODATION:"accommodation",BLOG:"blog",BOOK_DIRECT:"book_direct",BOOK_NOW:"book_now",CALENDAR:"calendar",CALL:"call",CATERING:"catering",CONFERENCES:"conferences",CONTACT:"contact",DIRECTIONS:"directions",DRINKS:"drinks",EMAIL:"email",EVENTS:"events",FACEBOOK:"facebook",FACILITIES:"facilities",FAQ:"faq",FOOD:"food",FUNCTIONS:"functions",GALLERY:"gallery",GIFT_CARDS:"gift_cards",GIGS:"gigs",INSTAGRAM:"instagram",MEMBERSHIP:"membership",MENU:"menu",MUSIC:"music",NEWS:"news",OFFERS:"offers",ORDER_ONLINE:"order_online",PARKING:"parking",PHOTOS:"photos",PRIVATE_HIRE:"private_hire",ROOMS:"rooms",SHOP:"shop",SOUNDCLOUD:"soundcloud",SPECIALS:"specials",SPORTS:"sports",SPOTIFY:"spotify",SUPPORT:"support",TICKETS:"tickets",TIKTOK:"tiktok",TRANSPORT:"transport",VENUE_HIRE:"venue_hire",VIDEOS:"videos",WEBSITE:"website",WEDDINGS:"weddings",WINE_LIST:"wine_list",YOUTUBE:"youtube"
});

export const AGGITS_IMPORT_ACTION_MAP=Object.freeze({
  WEBSITE_URL:"web",
  SOCIAL_URL:"web",
  MAP_URL:"map",
  PHONE:"tel",
  EMAIL:"email"
});

export const AGGITS_IMPORT_TAXONOMY=Object.freeze({
  "Accommodation":["Hotel"],
  "Arts and Culture":["Art Gallery","Cinema","Museum","Theatre"],
  "Community and Nonprofit":["Charity","Library"],
  "Education":["School","University"],
  "Entertainment":["Amusement Park"],
  "Events":["Event Venue"],
  "Food and Beverage":["Brewery","Cafe","Restaurant","Winery"],
  "Health":["Hospital","Medical Clinic"],
  "Health and Wellness":["Fitness Centre"],
  "Hospitality":["Hotel","Music Venue","Pub"],
  "Music":["Artist","Band"],
  "Retail":["Shopping Centre"],
  "Sport and Recreation":["Sports Club","Sports Venue"],
  "Tourism":["Aquarium","National Park","Tourist Attraction","Zoo"]
});

const ENTITY_GROUPS=new Set(["Artist","Band","Business or Organisation"]);
const SUBCATEGORIES=new Set(Object.values(AGGITS_IMPORT_TAXONOMY).flat());
const IMPORT_MODES=new Set(["skip_existing","update_drafts","create_new_only"]);
const SAFE_ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/;
const SAFE_SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UNSAFE_SHEET_VALUE=/^[=+@]|^-(?:[A-Za-z_(]|\d+[+*/^])/;
const iconIds=new Set(AGGITS_JUKEBOX_ICONS.map(icon=>icon.id));

for(const [key,id] of Object.entries(AGGITS_IMPORT_ICON_MAP)){
  if(!iconIds.has(id))throw new Error(`Aggits import icon mapping ${key} points to missing registry icon ${id}.`);
}

export function parseImportCsv(text){
  const rows=[];
  let row=[],field="",quoted=false;
  const source=String(text||"").replace(/^\uFEFF/,"");
  for(let index=0;index<source.length;index+=1){
    const character=source[index];
    if(quoted){
      if(character==='"'&&source[index+1]==='"'){field+='"';index+=1}
      else if(character==='"')quoted=false;
      else field+=character;
      continue;
    }
    if(character==='"'){quoted=true;continue}
    if(character===","){row.push(field);field="";continue}
    if(character==="\n"){
      row.push(field.replace(/\r$/,"").trimEnd());
      if(row.some(value=>value!==""))rows.push(row);
      row=[];field="";continue;
    }
    field+=character;
  }
  if(quoted)throw importError("CSV contains an unterminated quoted value.","malformed_csv");
  row.push(field.replace(/\r$/,"").trimEnd());
  if(row.some(value=>value!==""))rows.push(row);
  if(!rows.length)throw importError("The import file is empty.","empty_import");
  return tableToRecords(rows);
}

export async function parseImportFile({bytes,fileName}){
  const buffer=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes||[]);
  if(!buffer.length)throw importError("Choose a non-empty CSV or Excel workbook.","empty_import");
  if(buffer.length>AGGITS_IMPORT_MAX_FILE_BYTES)throw importError("The import file exceeds the 30 MB safety limit.","import_file_too_large");
  const extension=path.extname(String(fileName||"")).toLowerCase();
  if(extension===".csv")return{...parseImportCsv(buffer.toString("utf8")),format:"csv",sheetName:null};
  if(extension===".xlsx")return{...await parseImportXlsx(buffer),format:"xlsx",sheetName:"Import Ready"};
  throw importError("Import Editions accepts .csv or .xlsx files only.","unsupported_import_file");
}

export async function parseImportXlsx(buffer){
  const entries=await unzipWorkbookEntries(buffer);
  const workbook=readXmlEntry(entries,"xl/workbook.xml","Excel workbook metadata is missing.");
  const relationships=readXmlEntry(entries,"xl/_rels/workbook.xml.rels","Excel workbook relationships are missing.");
  const sheetTag=[...workbook.matchAll(/<(?:[A-Za-z_][\w.-]*:)?sheet\b([^>]*)\/?\s*>/gi)].find(match=>xmlAttribute(match[1],"name")==="Import Ready");
  if(!sheetTag)throw importError('The Excel workbook must contain a worksheet named "Import Ready".',"missing_import_ready_sheet");
  const relationshipId=xmlAttribute(sheetTag[1],"r:id");
  const relationship=[...relationships.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi)].find(match=>xmlAttribute(match[1],"Id")===relationshipId);
  if(!relationship)throw importError("The Import Ready worksheet relationship is invalid.","invalid_workbook_relationship");
  let target=xmlAttribute(relationship[1],"Target").replace(/\\/g,"/");
  if(target.startsWith("/"))target=target.slice(1);
  else if(!target.startsWith("xl/"))target=`xl/${target}`;
  target=path.posix.normalize(target);
  if(target.startsWith("../")||!target.startsWith("xl/"))throw importError("The Import Ready worksheet path is unsafe.","unsafe_workbook_path");
  const worksheet=readXmlEntry(entries,target,"The Import Ready worksheet data is missing.");
  const shared=parseSharedStrings(entries.get("xl/sharedStrings.xml")?.toString("utf8")||"");
  const table=[];
  for(const rowMatch of worksheet.matchAll(/<(?:[A-Za-z_][\w.-]*:)?row\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?row>/gi)){
    const values=[];
    for(const cell of rowMatch[1].matchAll(/<(?:[A-Za-z_][\w.-]*:)?c\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c>/gi)){
      const reference=xmlAttribute(cell[1],"r");
      const column=excelColumnIndex(reference);
      if(column<0)continue;
      if(/<(?:[A-Za-z_][\w.-]*:)?f\b/i.test(cell[2]))throw importError(`The Import Ready worksheet contains a formula in ${reference}. Replace formulas with plain values.`,"spreadsheet_formula");
      const type=xmlAttribute(cell[1],"t");
      const rawValue=xmlText(cell[2].match(/<(?:[A-Za-z_][\w.-]*:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?v>/i)?.[1]??"");
      let value=rawValue;
      if(type==="s")value=shared[Number(rawValue)]??"";
      else if(type==="inlineStr")value=[...cell[2].matchAll(/<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/gi)].map(match=>xmlText(match[1])).join("");
      else if(type==="b")value=rawValue==="1"?"TRUE":"FALSE";
      values[column]=value;
    }
    if(values.some(value=>String(value??"")!==""))table.push(values.map(value=>String(value??"")));
  }
  if(!table.length)throw importError("The Import Ready worksheet is empty.","empty_import_ready_sheet");
  return tableToRecords(table);
}

export function preflightImportRecords(records,{existingIndex=emptyImportIndex(),fileName="upload.csv",checksum=""}={}){
  if(!Array.isArray(records)||!records.length)throw importError("No import records were found.","empty_import");
  if(records.length>AGGITS_IMPORT_MAX_ROWS)throw importError(`The file contains ${records.length} rows; the safety limit is ${AGGITS_IMPORT_MAX_ROWS}.`,"import_row_limit");
  const recordCounts=countValues(records.map(record=>clean(record.record_id)));
  const slugCounts=countValues(records.map(record=>clean(record.edition_slug)));
  const rows=records.map((record,index)=>validateImportRecord(record,{
    rowNumber:index+2,
    duplicateRecordId:recordCounts.get(clean(record.record_id))>1,
    duplicateSlug:slugCounts.get(clean(record.edition_slug))>1,
    existingIndex
  }));
  const facets=facetValues(rows);
  const counts=countRowStates(rows);
  return{
    schemaVersion:"aggits-jukebox-import-preflight/1",
    fileName:safeFileName(fileName),
    checksum,
    createdAt:new Date().toISOString(),
    rows,
    counts,
    facets,
    mappings:{icons:AGGITS_IMPORT_ICON_MAP,actions:AGGITS_IMPORT_ACTION_MAP},
    filters:{entityGroup:"",category:"",subcategory:"",country:"",stateOrRegion:"",readinessStatus:""}
  };
}

export function validateImportRecord(record,{rowNumber=0,duplicateRecordId=false,duplicateSlug=false,existingIndex=emptyImportIndex()}={}){
  const source=Object.fromEntries(AGGITS_IMPORT_HEADERS.map(header=>[header,clean(record?.[header])]));
  const errors=[],warnings=[];
  const error=(code,message)=>errors.push({code,message});
  const warning=(code,message)=>warnings.push({code,message});
  for(const [key,value] of Object.entries(source)){
    if(UNSAFE_SHEET_VALUE.test(value))error("unsafe_spreadsheet_value",`${key} begins with a spreadsheet formula character.`);
    if(value.includes("\0"))error("unsafe_spreadsheet_value",`${key} contains a null character.`);
  }
  if(source.schema_version!==AGGITS_IMPORT_SCHEMA_VERSION)error("unsupported_schema",`schema_version must be ${AGGITS_IMPORT_SCHEMA_VERSION}.`);
  if(!SAFE_ID.test(source.record_id))error("invalid_record_id","record_id is missing or contains unsupported characters.");
  if(duplicateRecordId)error("duplicate_record_id","record_id occurs more than once in this upload.");
  if(!source.entity_name)error("missing_entity_name","entity_name is required.");
  if(!source.display_name)error("missing_display_name","display_name is required.");
  if(source.display_name.length>120)error("display_name_too_long","display_name exceeds Studio's 120-character limit.");
  if(!ENTITY_GROUPS.has(source.entity_group))error("invalid_entity_group",`Unsupported entity_group: ${source.entity_group||"(blank)"}.`);
  if(!AGGITS_IMPORT_TAXONOMY[source.category])error("invalid_category",`Unsupported category: ${source.category||"(blank)"}.`);
  if(!SUBCATEGORIES.has(source.subcategory))error("invalid_subcategory",`Unsupported subcategory: ${source.subcategory||"(blank)"}.`);
  if(!source.country)error("missing_country","country is required.");
  if(!SAFE_SLUG.test(source.edition_slug)||source.edition_slug.length>100)error("invalid_edition_slug","edition_slug must be a lowercase, hyphen-separated identifier up to 100 characters.");
  if(duplicateSlug)error("duplicate_edition_slug","edition_slug occurs more than once in this upload.");
  if(!/^Import Ready$/i.test(source.record_status))error("not_import_ready",`record_status must be Import Ready; received ${source.record_status||"(blank)"}.`);
  const homepage=validateWebDestination(source.homepage_url,{required:true,label:"homepage_url",errors});
  if(source.discovery_source_url)validateWebDestination(source.discovery_source_url,{required:false,label:"discovery_source_url",errors});
  const buttons=[];
  const destinations=new Map();
  for(let position=1;position<=4;position+=1){
    const prefix=`button_${position}_`;
    const enabled=parseImportBoolean(source[`${prefix}enabled`],`${prefix}enabled`,errors);
    const openInNewTab=parseImportBoolean(source[`${prefix}open_new_tab`],`${prefix}open_new_tab`,errors);
    const iconKey=source[`${prefix}icon`].toUpperCase();
    const actionKey=source[`${prefix}action`].toUpperCase();
    const label=source[`${prefix}label`];
    const destination=source[`${prefix}destination`];
    const iconId=AGGITS_IMPORT_ICON_MAP[iconKey]||"";
    const actionType=AGGITS_IMPORT_ACTION_MAP[actionKey]||"";
    if(!iconId)error("unknown_icon",`Button ${position} uses unmapped icon key ${iconKey||"(blank)"}.`);
    if(!actionType)error("unknown_action",`Button ${position} uses unmapped action ${actionKey||"(blank)"}.`);
    if(!label)error("missing_button_label",`Button ${position} label is required.`);
    else if(label.length>AGGITS_IMPORT_LABEL_LIMIT)error("button_label_too_long",`Button ${position} label exceeds ${AGGITS_IMPORT_LABEL_LIMIT} characters.`);
    const normalizedDestination=actionType?validateActionDestination(actionType,destination,position,errors):"";
    if(normalizedDestination){
      if(destinations.has(normalizedDestination))error("duplicate_destination",`Buttons ${destinations.get(normalizedDestination)} and ${position} use the same destination.`);
      else destinations.set(normalizedDestination,position);
    }
    if(enabled===false)warning("disabled_button",`Button ${position} is present but disabled.`);
    buttons.push({slot:position,enabled:enabled===true,iconKey,iconId,label,actionKey,actionType,value:destination,href:normalizedDestination,openInNewTab:openInNewTab===true});
  }
  const existing=existingIndex.records?.[source.record_id]||null;
  const slugOwner=existingIndex.slugs?.[source.edition_slug]||"";
  if(slugOwner&&slugOwner!==source.record_id)error("existing_slug_conflict",`edition_slug is already assigned to record_id ${slugOwner}.`);
  if(existing)warning("existing_record",`record_id already belongs to Studio draft ${existing.projectId}.`);
  if(homepage&&buttons.every(button=>button.href!==homepage))warning("homepage_not_button","homepage_url is preserved as metadata but is not one of the four physical buttons.");
  const normalized={
    schemaVersion:source.schema_version,
    recordId:source.record_id,
    sourceRecordId:source.source_record_id,
    editionSlug:source.edition_slug,
    entityName:source.entity_name,
    displayName:source.display_name,
    entityGroup:source.entity_group,
    category:source.category,
    subcategory:source.subcategory,
    locationName:source.location_name,
    stateOrRegion:source.state_or_region,
    country:source.country,
    homepageUrl:homepage,
    recordStatus:source.record_status,
    lastVerifiedDate:source.last_verified_date,
    discoverySourceUrl:source.discovery_source_url,
    buttons
  };
  return{
    rowNumber,
    recordId:source.record_id,
    editionSlug:source.edition_slug,
    displayName:source.display_name||source.entity_name,
    entityGroup:source.entity_group,
    category:source.category,
    subcategory:source.subcategory,
    country:source.country,
    stateOrRegion:source.state_or_region,
    readinessStatus:source.record_status,
    existing:Boolean(existing),
    existingProjectId:existing?.projectId||"",
    valid:errors.length===0,
    status:errors.length?"invalid":warnings.length?"warning":"valid",
    errors,
    warnings,
    normalized
  };
}

export function createAggitsJukeboxImportController({dataDir,projectRoot,loadProject,saveProject,projectDirectory}){
  if(!dataDir||!projectRoot||!loadProject||!saveProject||!projectDirectory)throw new Error("Aggits import controller requires Studio storage callbacks.");
  const importRoot=path.join(dataDir,"aggits-jukebox-imports");
  const indexFile=path.join(importRoot,"index.json");

  async function preflight({bytes,fileName,importedBy="local-administrator"}){
    const checksum=crypto.createHash("sha256").update(bytes).digest("hex");
    const parsed=await parseImportFile({bytes,fileName});
    const index=await readIndex();
    const report=preflightImportRecords(parsed.records,{existingIndex:index,fileName,checksum});
    const id=`preflight_${crypto.randomBytes(8).toString("hex")}`;
    const stored={...report,id,format:parsed.format,sheetName:parsed.sheetName,headers:parsed.headers,importedBy:clean(importedBy)||"local-administrator"};
    await atomicJson(path.join(importRoot,"preflights",`${id}.json`),stored);
    return publicPreflight(stored);
  }

  async function getPreflight(id,{includeRows=true}={}){
    const stored=await readPreflight(id);
    return includeRows?publicPreflight(stored):publicPreflight({...stored,rows:[]});
  }

  async function commit({preflightId,selectedRecordIds=[],mode="skip_existing",maximum=AGGITS_IMPORT_MAX_COMMIT,confirmed=false,importedBy="local-administrator"}){
    if(confirmed!==true)throw importError("Final confirmation is required before Studio writes imported drafts.","import_confirmation_required");
    if(!IMPORT_MODES.has(mode))throw importError("Choose a supported reimport mode.","invalid_import_mode");
    const parsedMaximum=Math.max(1,Math.min(AGGITS_IMPORT_MAX_COMMIT,Number(maximum)||AGGITS_IMPORT_MAX_COMMIT));
    const preflightReport=await readPreflight(preflightId);
    const selected=new Set((Array.isArray(selectedRecordIds)?selectedRecordIds:[]).map(clean).filter(Boolean));
    if(!selected.size)throw importError("Select at least one eligible record.","empty_import_selection");
    const chosen=preflightReport.rows.filter(row=>selected.has(row.recordId)).slice(0,parsedMaximum);
    if(!chosen.length)throw importError("The selected records are not present in this preflight.","invalid_import_selection");
    const invalid=chosen.filter(row=>!row.valid);
    if(invalid.length)throw importError(`${invalid.length} selected row(s) failed preflight. Remove or correct them before importing.`,"invalid_selected_rows");
    const batchId=`import_${new Date().toISOString().replace(/\D/g,"").slice(0,14)}_${crypto.randomBytes(4).toString("hex")}`;
    const batchDirectory=path.join(importRoot,"batches",batchId);
    const startedAt=new Date().toISOString();
    const batch={schemaVersion:"aggits-jukebox-import-batch/1",id:batchId,preflightId,sourceFile:preflightReport.fileName,fileChecksum:preflightReport.checksum,sourceSchemaVersion:AGGITS_IMPORT_SCHEMA_VERSION,importedBy:clean(importedBy)||"local-administrator",mode,requestedRecordIds:[...selected],attemptedRecordIds:chosen.map(row=>row.recordId),startedAt,status:"running",results:[]};
    await atomicJson(path.join(batchDirectory,"batch.json"),batch);
    let index=await readIndex();
    for(const row of chosen){
      const result={rowNumber:row.rowNumber,recordId:row.recordId,editionSlug:row.editionSlug,displayName:row.displayName,status:"failed",projectId:"",warnings:row.warnings.map(item=>item.message),errors:[],previousIndexEntry:index.records[row.recordId]||null};
      const existing=index.records[row.recordId]||null;
      try{
        if(existing&&mode!=="update_drafts"){
          result.status="skipped";result.projectId=existing.projectId;result.warnings.push("Existing import record skipped by the selected mode.");batch.results.push(result);continue;
        }
        const input=projectInputFromImport(row.normalized);
        let project;
        if(existing){
          const current=await loadProject(existing.projectId);
          if(current.publication?.status==="published"||current.status==="published")throw importError("Published editions cannot be overwritten by a bulk import.","published_import_conflict");
          await atomicJson(path.join(batchDirectory,"snapshots",`${existing.projectId}.json`),current);
          project=updateProject(current,input);
          result.status="updated";
        }else{
          project=createProject(input);
          result.status="created";
        }
        project={...project,status:"draft",importMetadata:{schemaVersion:"aggits-jukebox-import-source/1",recordId:row.normalized.recordId,sourceRecordId:row.normalized.sourceRecordId,editionSlug:row.normalized.editionSlug,entityName:row.normalized.entityName,displayName:row.normalized.displayName,entityGroup:row.normalized.entityGroup,category:row.normalized.category,subcategory:row.normalized.subcategory,locationName:row.normalized.locationName,stateOrRegion:row.normalized.stateOrRegion,country:row.normalized.country,homepageUrl:row.normalized.homepageUrl,recordStatus:row.normalized.recordStatus,lastVerifiedDate:row.normalized.lastVerifiedDate,discoverySourceUrl:row.normalized.discoverySourceUrl,importBatchId:batchId,sourceFile:preflightReport.fileName,fileChecksum:preflightReport.checksum,importedAt:new Date().toISOString(),importedBy:batch.importedBy}};
        result.projectId=project.id;
        await saveProject(project);
        const reconciled=await loadProject(project.id);
        verifyImportedProject(reconciled,row.normalized);
        index.records[row.recordId]={recordId:row.recordId,editionSlug:row.editionSlug,projectId:project.id,batchId,updatedAt:new Date().toISOString()};
        index.slugs[row.editionSlug]=row.recordId;
        await writeIndex(index);
      }catch(error){
        result.errors.push(error.message||"Import failed.");
        if(result.status==="updated"&&existing){
          const snapshot=await readJson(path.join(batchDirectory,"snapshots",`${existing.projectId}.json`),null);
          if(snapshot)await saveProject(snapshot);
        }else if(result.status==="created"&&result.projectId){
          await recoverProject(result.projectId,batchDirectory);
        }
        result.status="failed";
      }
      batch.results.push(result);
      await atomicJson(path.join(batchDirectory,"batch.json"),batch);
    }
    const counts=countBatchResults(batch.results);
    batch.status="complete";batch.completedAt=new Date().toISOString();batch.counts=counts;
    batch.reconciled=counts.attempted===batch.results.length&&counts.created+counts.updated+counts.skipped+counts.failed===counts.attempted;
    await atomicJson(path.join(batchDirectory,"batch.json"),batch);
    return publicBatch(batch);
  }

  async function getBatch(id){return publicBatch(await readBatch(id))}

  async function rollback({batchId,confirmation}){
    const batch=await readBatch(batchId);
    if(confirmation!==`ROLLBACK ${batchId}`)throw importError(`Type ROLLBACK ${batchId} to confirm the recoverable rollback.`,"rollback_confirmation_required");
    if(batch.rollback?.status==="complete")return publicBatch(batch);
    let index=await readIndex();
    const rollbackDirectory=path.join(importRoot,"batches",batchId,"rollback");
    const results=[];
    for(const item of batch.results){
      try{
        if(item.status==="created"&&item.projectId){
          const source=projectDirectory(item.projectId),destination=path.join(rollbackDirectory,"created",item.projectId);
          await fs.mkdir(path.dirname(destination),{recursive:true});
          await fs.rename(source,destination);
          if(index.records[item.recordId]?.projectId===item.projectId)delete index.records[item.recordId];
          if(index.slugs[item.editionSlug]===item.recordId)delete index.slugs[item.editionSlug];
          results.push({recordId:item.recordId,status:"archived_created_draft"});
        }else if(item.status==="updated"&&item.projectId){
          const snapshot=await readJson(path.join(importRoot,"batches",batchId,"snapshots",`${item.projectId}.json`),null);
          if(!snapshot)throw new Error("The pre-update snapshot is missing.");
          await saveProject(snapshot);
          if(item.previousIndexEntry)index.records[item.recordId]=item.previousIndexEntry;else delete index.records[item.recordId];
          if(item.previousIndexEntry?.editionSlug)index.slugs[item.previousIndexEntry.editionSlug]=item.recordId;
          results.push({recordId:item.recordId,status:"restored_updated_draft"});
        }
      }catch(error){results.push({recordId:item.recordId,status:"failed",error:error.message})}
    }
    await writeIndex(index);
    batch.rollback={status:results.some(item=>item.status==="failed")?"warning":"complete",completedAt:new Date().toISOString(),results};
    await atomicJson(path.join(importRoot,"batches",batchId,"batch.json"),batch);
    return publicBatch(batch);
  }

  async function reportCsv(id,{errorsOnly=false}={}){
    if(String(id).startsWith("preflight_")){
      const report=await readPreflight(id);
      const rows=report.rows.filter(row=>errorsOnly?row.errors.length:Boolean(row.errors.length||row.warnings.length)).map(row=>({batch_id:"",row_number:row.rowNumber,record_id:row.recordId,edition_slug:row.editionSlug,display_name:row.displayName,status:row.status,project_id:row.existingProjectId||"",warnings:row.warnings.map(item=>item.message).join(" | "),errors:row.errors.map(item=>item.message).join(" | ")}));
      return toCsv(rows);
    }
    const batch=await readBatch(id);
    return toCsv(batch.results.map(row=>({batch_id:batch.id,row_number:row.rowNumber,record_id:row.recordId,edition_slug:row.editionSlug,display_name:row.displayName,status:row.status,project_id:row.projectId,warnings:row.warnings.join(" | "),errors:row.errors.join(" | ")})));
  }

  async function readIndex(){return await readJson(indexFile,emptyImportIndex())}
  async function writeIndex(index){index.updatedAt=new Date().toISOString();await atomicJson(indexFile,index)}
  async function readPreflight(id){
    if(!/^preflight_[a-f0-9]{16}$/.test(String(id)))throw importError("Invalid preflight identifier.","invalid_preflight_id");
    const report=await readJson(path.join(importRoot,"preflights",`${id}.json`),null);
    if(!report)throw importError("Import preflight not found.","missing_preflight");
    return report;
  }
  async function readBatch(id){
    if(!/^import_\d{14}_[a-f0-9]{8}$/.test(String(id)))throw importError("Invalid import batch identifier.","invalid_batch_id");
    const batch=await readJson(path.join(importRoot,"batches",id,"batch.json"),null);
    if(!batch)throw importError("Import batch not found.","missing_import_batch");
    return batch;
  }
  async function recoverProject(projectId,batchDirectory){const source=projectDirectory(projectId),destination=path.join(batchDirectory,"failed-created",projectId);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.rename(source,destination).catch(()=>{})}
  return{preflight,getPreflight,commit,getBatch,rollback,reportCsv};
}

function projectInputFromImport(record){
  const facts=[record.displayName,record.subcategory,record.locationName,record.stateOrRegion,record.country].filter(Boolean);
  return{name:record.displayName,type:"aggits_jukebox",aggitsOption:"none",tickerText:facts.join(" • "),brief:"",aboutText:"",posterHeading:"",sourceUrls:[],sourceLabels:[],youtubeUrl:"",addWheel:false,actionButtons:record.buttons.map(button=>({enabled:button.enabled,iconId:button.iconId,label:button.label,actionType:button.actionType,value:button.value,openInNewTab:button.openInNewTab}))};
}

function verifyImportedProject(project,source){
  if(project.status!=="draft")throw importError("Reconciliation found a non-draft imported edition.","reconciliation_status");
  if(project.importMetadata?.recordId!==source.recordId)throw importError("Stable record_id was not preserved.","reconciliation_record_id");
  const actions=project.input?.actionButtons||[];
  if(actions.length!==4)throw importError("The imported edition does not contain four physical buttons.","reconciliation_button_count");
  for(let index=0;index<4;index+=1){
    const expected=source.buttons[index],actual=actions[index];
    if(actual.slot!==index+1||actual.iconId!==expected.iconId||actual.label!==expected.label||actual.value!==expected.value)throw importError(`Physical button ${index+1} failed post-import reconciliation.`,"reconciliation_button");
  }
}

function validateActionDestination(actionType,value,position,errors){
  const raw=clean(value);
  if(!raw){errors.push({code:"missing_button_destination",message:`Button ${position} destination is required.`});return""}
  if(actionType==="tel"){
    const number=raw.replace(/^tel:/i,"").replace(/[^+0-9*#(),.;-]/g,"");
    if(!/[0-9]/.test(number)){errors.push({code:"invalid_phone",message:`Button ${position} must contain a valid telephone number.`});return""}
    return`tel:${number}`;
  }
  if(actionType==="email"){
    const address=raw.replace(/^mailto:/i,"").trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)){errors.push({code:"invalid_email",message:`Button ${position} must contain a valid email address.`});return""}
    return`mailto:${address.toLowerCase()}`;
  }
  return validateWebDestination(raw,{required:true,label:`Button ${position} destination`,errors});
}

function validateWebDestination(value,{required,label,errors}){
  const raw=clean(value);
  if(!raw){if(required)errors.push({code:"missing_url",message:`${label} is required.`});return""}
  try{
    const url=new URL(raw);
    if(!["https:","http:"].includes(url.protocol))throw new Error();
    if(url.username||url.password)throw new Error();
    if(["localhost","127.0.0.1","::1"].includes(url.hostname.toLowerCase()))throw new Error();
    url.hash="";
    return url.href;
  }catch{errors.push({code:"invalid_url",message:`${label} must be a complete HTTP or HTTPS URL.`});return""}
}

export function parseImportBoolean(value,label="value",errors=[]){
  const normalized=clean(value).toLowerCase();
  if(["true","1","yes"].includes(normalized))return true;
  if(["false","0","no"].includes(normalized))return false;
  errors.push({code:"invalid_boolean",message:`${label} must be TRUE or FALSE.`});
  return null;
}

function tableToRecords(table){
  const headers=(table[0]||[]).map((value,index)=>index===0?String(value).replace(/^\uFEFF/,"").trim():String(value).trim());
  const duplicates=[...countValues(headers).entries()].filter(([,count])=>count>1).map(([header])=>header);
  if(duplicates.length)throw importError(`Duplicate spreadsheet header(s): ${duplicates.join(", ")}.`,"duplicate_import_headers");
  const missing=AGGITS_IMPORT_HEADERS.filter(header=>!headers.includes(header));
  if(missing.length)throw importError(`Missing required import column(s): ${missing.join(", ")}.`,"missing_import_headers");
  const records=table.slice(1).map(values=>Object.fromEntries(headers.map((header,index)=>[header,String(values[index]??"").trim()]))).filter(record=>Object.values(record).some(Boolean));
  if(records.length>AGGITS_IMPORT_MAX_ROWS)throw importError(`The file contains ${records.length} rows; the safety limit is ${AGGITS_IMPORT_MAX_ROWS}.`,"import_row_limit");
  return{headers,records};
}

function unzipWorkbookEntries(buffer){
  return new Promise((resolve,reject)=>{
    yauzl.fromBuffer(buffer,{lazyEntries:true,decodeStrings:true,validateEntrySizes:true},(error,zip)=>{
      if(error)return reject(importError("The Excel workbook is malformed.","malformed_xlsx"));
      const entries=new Map();let total=0;let settled=false;
      const fail=reason=>{if(settled)return;settled=true;try{zip.close()}catch{}reject(reason)};
      zip.on("error",()=>fail(importError("The Excel workbook could not be read safely.","malformed_xlsx")));
      zip.on("entry",entry=>{
        const name=String(entry.fileName||"").replace(/\\/g,"/");
        if(name.includes("../")||name.startsWith("/"))return fail(importError("The Excel workbook contains an unsafe path.","unsafe_workbook_path"));
        if(entry.uncompressedSize>20*1024*1024)return fail(importError("An Excel worksheet exceeds the 20 MB uncompressed limit.","xlsx_entry_too_large"));
        zip.openReadStream(entry,(streamError,stream)=>{
          if(streamError)return fail(importError("The Excel workbook could not be read.","malformed_xlsx"));
          const chunks=[];
          stream.on("data",chunk=>chunks.push(chunk));
          stream.on("error",()=>fail(importError("The Excel workbook could not be read.","malformed_xlsx")));
          stream.on("end",()=>{const data=Buffer.concat(chunks);total+=data.length;if(total>50*1024*1024)return fail(importError("The Excel workbook expands beyond the 50 MB safety limit.","xlsx_expansion_limit"));entries.set(name,data);zip.readEntry()});
        });
      });
      zip.on("end",()=>{if(!settled){settled=true;resolve(entries)}});
      zip.readEntry();
    });
  });
}

function parseSharedStrings(xml){return[...String(xml).matchAll(/<(?:[A-Za-z_][\w.-]*:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?si>/gi)].map(item=>[...item[1].matchAll(/<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/gi)].map(match=>xmlText(match[1])).join(""))}
function readXmlEntry(entries,name,message){const entry=entries.get(name);if(!entry)throw importError(message,"malformed_xlsx");return entry.toString("utf8")}
function xmlAttribute(attributes,name){const match=String(attributes).match(new RegExp(`(?:^|\\s)${name.replace(":","\\:")}=(?:"([^"]*)"|'([^']*)')`,"i"));return xmlText(match?.[1]??match?.[2]??"")}
function xmlText(value){return String(value||"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&").replace(/&#(\d+);/g,(_,number)=>String.fromCodePoint(Number(number))).replace(/&#x([0-9a-f]+);/gi,(_,number)=>String.fromCodePoint(parseInt(number,16)))}
function excelColumnIndex(reference){const letters=String(reference||"").match(/^([A-Z]+)/i)?.[1]?.toUpperCase();if(!letters)return-1;return[...letters].reduce((value,letter)=>value*26+letter.charCodeAt(0)-64,0)-1}
function countValues(values){const counts=new Map();for(const value of values)counts.set(value,(counts.get(value)||0)+1);return counts}
function countRowStates(rows){return{total:rows.length,valid:rows.filter(row=>row.status==="valid").length,warnings:rows.filter(row=>row.status==="warning").length,invalid:rows.filter(row=>row.status==="invalid").length,new:rows.filter(row=>!row.existing).length,existing:rows.filter(row=>row.existing).length}}
function countBatchResults(rows){return{attempted:rows.length,created:rows.filter(row=>row.status==="created").length,updated:rows.filter(row=>row.status==="updated").length,skipped:rows.filter(row=>row.status==="skipped").length,warnings:rows.filter(row=>row.warnings.length).length,failed:rows.filter(row=>row.status==="failed").length}}
function facetValues(rows){const facet=key=>[...new Set(rows.map(row=>row[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));return{entityGroups:facet("entityGroup"),categories:facet("category"),subcategories:facet("subcategory"),countries:facet("country"),statesOrRegions:facet("stateOrRegion"),readinessStatuses:facet("readinessStatus")}}
function emptyImportIndex(){return{schemaVersion:"aggits-jukebox-import-index/1",records:{},slugs:{},updatedAt:null}}
function publicPreflight(report){return{...report,rows:report.rows.map(row=>({...row,buttons:row.normalized?.buttons||[],normalized:undefined}))}}
function publicBatch(batch){return{...batch,results:batch.results.map(result=>({...result,previousIndexEntry:undefined}))}}
function clean(value){return String(value??"").trim()}
function safeFileName(value){return path.basename(clean(value)||"import.csv").replace(/[^a-z0-9._ -]+/gi,"-").slice(0,160)}
function importError(message,code){return new StudioValidationError(message,code)}
async function readJson(file,fallback){try{return JSON.parse(await fs.readFile(file,"utf8"))}catch(error){if(error.code==="ENOENT")return fallback;throw error}}
async function atomicJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const temporary=`${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;await fs.writeFile(temporary,`${JSON.stringify(value,null,2)}\n`,"utf8");await fs.rename(temporary,file)}
function csvCell(value){let text=String(value??"");if(/^[=+\-@]/.test(text))text=`'${text}`;return/[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text}
function toCsv(rows){const headers=rows.length?Object.keys(rows[0]):["batch_id","row_number","record_id","edition_slug","display_name","status","project_id","warnings","errors"];return`${[headers.join(","),...rows.map(row=>headers.map(header=>csvCell(row[header])).join(","))].join("\r\n")}\r\n`}
