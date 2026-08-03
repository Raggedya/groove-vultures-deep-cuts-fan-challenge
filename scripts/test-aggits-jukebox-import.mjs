import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crc32 from "buffer-crc32";
import {
  AGGITS_IMPORT_ACTION_MAP,
  AGGITS_IMPORT_HEADERS,
  AGGITS_IMPORT_ICON_MAP,
  createAggitsJukeboxImportController,
  parseImportBoolean,
  parseImportCsv,
  parseImportFile,
  preflightImportRecords
} from "./aggits-jukebox-import.mjs";

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/,match=>match.slice(1))),"..");
const fixturePath=path.join(root,"test-fixtures","aggits-jukebox-import-sample.csv");
const fixture=await fs.readFile(fixturePath,"utf8");
let assertions=0;
const check=(condition,message)=>{assert.ok(condition,message);assertions+=1};

const csv=parseImportCsv(fixture);
assert.equal(csv.records.length,4);assertions+=1;
assert.deepEqual(csv.headers,AGGITS_IMPORT_HEADERS);assertions+=1;
const report=preflightImportRecords(csv.records,{fileName:"fixture.csv"});
assert.deepEqual(report.counts,{total:4,valid:4,warnings:0,invalid:0,new:4,existing:0});assertions+=1;
assert.deepEqual(report.rows[0].normalized.buttons.map(button=>button.iconId),["website","book_now","menu","gift_cards"]);assertions+=1;
assert.deepEqual(report.rows[2].normalized.buttons.map(button=>button.iconId),["website","spotify","youtube","instagram"]);assertions+=1;
check(AGGITS_IMPORT_ICON_MAP.BOOK_NOW==="book_now","BOOK_NOW maps exactly.");
check(AGGITS_IMPORT_ACTION_MAP.MAP_URL==="map","MAP_URL maps exactly.");

const booleanErrors=[];
assert.equal(parseImportBoolean("TRUE","flag",booleanErrors),true);assertions+=1;
assert.equal(parseImportBoolean("0","flag",booleanErrors),false);assertions+=1;
assert.equal(parseImportBoolean("perhaps","flag",booleanErrors),null);assertions+=1;
assert.equal(booleanErrors.length,1);assertions+=1;

const malicious=structuredClone(csv.records[0]);malicious.display_name="=HYPERLINK(\"bad\")";
const maliciousResult=preflightImportRecords([malicious]).rows[0];
check(maliciousResult.errors.some(error=>error.code==="unsafe_spreadsheet_value"),"Formula injection is rejected.");
const negativeFormula=structuredClone(csv.records[0]);negativeFormula.display_name="-1+2";
check(preflightImportRecords([negativeFormula]).rows[0].errors.some(error=>error.code==="unsafe_spreadsheet_value"),"Negative spreadsheet formulas are rejected.");
const unknownIcon=structuredClone(csv.records[0]);unknownIcon.button_1_icon="UNKNOWN_ICON";
check(preflightImportRecords([unknownIcon]).rows[0].errors.some(error=>error.code==="unknown_icon"),"Unknown icons fail closed.");
const unknownAction=structuredClone(csv.records[0]);unknownAction.button_1_action="MAGIC";
check(preflightImportRecords([unknownAction]).rows[0].errors.some(error=>error.code==="unknown_action"),"Unknown actions fail closed.");
const duplicateDestination=structuredClone(csv.records[0]);duplicateDestination.button_2_destination=duplicateDestination.button_1_destination;
check(preflightImportRecords([duplicateDestination]).rows[0].errors.some(error=>error.code==="duplicate_destination"),"Duplicate destinations within one edition are rejected.");
const duplicateRecords=preflightImportRecords([csv.records[0],csv.records[0]]);
assert.equal(duplicateRecords.counts.invalid,2);assertions+=1;
assert.throws(()=>parseImportCsv(fixture.split("\n").map(line=>line.replace(",button_4_open_new_tab","")).join("\n")),/Missing required import column/);assertions+=1;

const xlsx=makeXlsx(csv.headers,csv.records);
const parsedXlsx=await parseImportFile({bytes:xlsx,fileName:"fixture.xlsx"});
assert.equal(parsedXlsx.records.length,4);assertions+=1;
assert.equal(parsedXlsx.sheetName,"Import Ready");assertions+=1;
assert.equal(parsedXlsx.records[2].record_id,"JBX-WD-Q494270");assertions+=1;
const missingSheet=makeXlsx(csv.headers,csv.records,{sheetName:"Wrong Sheet"});
await assert.rejects(()=>parseImportFile({bytes:missingSheet,fileName:"fixture.xlsx"}),error=>error.code==="missing_import_ready_sheet");assertions+=1;
const formulaWorkbook=makeXlsx(csv.headers,csv.records,{formulaCell:true});
await assert.rejects(()=>parseImportFile({bytes:formulaWorkbook,fileName:"fixture.xlsx"}),error=>error.code==="spreadsheet_formula");assertions+=1;

const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),"aggits-import-test-"));
const projectRoot=path.join(dataDir,"projects");
const projectDirectory=id=>path.join(projectRoot,id);
const saveProject=async project=>{const directory=projectDirectory(project.id);await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,"project.json"),JSON.stringify(project),"utf8")};
const loadProject=async id=>JSON.parse(await fs.readFile(path.join(projectDirectory(id),"project.json"),"utf8"));
const controller=createAggitsJukeboxImportController({dataDir,projectRoot,loadProject,saveProject,projectDirectory});
const preflight=await controller.preflight({bytes:Buffer.from(fixture),fileName:"sample.csv",importedBy:"test-admin"});
assert.equal(preflight.counts.valid,4);assertions+=1;
await assert.rejects(()=>controller.commit({preflightId:preflight.id,selectedRecordIds:[preflight.rows[0].recordId]}),error=>error.code==="import_confirmation_required");assertions+=1;
const firstBatch=await controller.commit({preflightId:preflight.id,selectedRecordIds:preflight.rows.map(row=>row.recordId),mode:"skip_existing",maximum:10,confirmed:true,importedBy:"test-admin"});
assert.deepEqual(firstBatch.counts,{attempted:4,created:4,updated:0,skipped:0,warnings:0,failed:0});assertions+=1;
for(const result of firstBatch.results){
  const project=await loadProject(result.projectId);
  assert.equal(project.status,"draft");assertions+=1;
  assert.equal(project.importMetadata.recordId,result.recordId);assertions+=1;
  assert.equal(project.input.actionButtons.length,4);assertions+=1;
  assert.deepEqual(project.input.actionButtons.map(button=>button.slot),[1,2,3,4]);assertions+=1;
}

const repeatPreflight=await controller.preflight({bytes:Buffer.from(fixture),fileName:"sample.csv"});
assert.equal(repeatPreflight.counts.existing,4);assertions+=1;
const skippedBatch=await controller.commit({preflightId:repeatPreflight.id,selectedRecordIds:repeatPreflight.rows.map(row=>row.recordId),mode:"skip_existing",confirmed:true});
assert.equal(skippedBatch.counts.skipped,4);assertions+=1;

const updatedFixture=fixture.replaceAll("Aria Restaurant Sydney","Aria Restaurant Sydney Test");
const updatePreflight=await controller.preflight({bytes:Buffer.from(updatedFixture),fileName:"sample-updated.csv"});
const aria=updatePreflight.rows.find(row=>row.recordId==="JBX-WD-Q118093897");
const updateBatch=await controller.commit({preflightId:updatePreflight.id,selectedRecordIds:[aria.recordId],mode:"update_drafts",confirmed:true});
assert.equal(updateBatch.counts.updated,1);assertions+=1;
assert.equal((await loadProject(updateBatch.results[0].projectId)).input.name,"Aria Restaurant Sydney Test");assertions+=1;
await assert.rejects(()=>controller.rollback({batchId:updateBatch.id,confirmation:"wrong"}),error=>error.code==="rollback_confirmation_required");assertions+=1;
const rolledBack=await controller.rollback({batchId:updateBatch.id,confirmation:`ROLLBACK ${updateBatch.id}`});
assert.equal(rolledBack.rollback.status,"complete");assertions+=1;
assert.equal((await loadProject(updateBatch.results[0].projectId)).input.name,"Aria Restaurant Sydney");assertions+=1;
const reconciliation=await controller.reportCsv(firstBatch.id);
check(reconciliation.includes("JBX-WD-Q494270"),"Reconciliation CSV contains imported IDs.");

await fs.rm(dataDir,{recursive:true,force:true});
console.log(`Aggits Jukebox importer tests passed (${assertions} assertions).`);

function makeXlsx(headers,records,{sheetName="Import Ready",formulaCell=false}={}){
  const table=[headers,...records.map(record=>headers.map(header=>record[header]||""))];
  const rows=table.map((values,rowIndex)=>`<row r="${rowIndex+1}">${values.map((value,columnIndex)=>{
    const reference=`${columnLetters(columnIndex+1)}${rowIndex+1}`;
    if(formulaCell&&rowIndex===1&&columnIndex===5)return`<c r="${reference}"><f>1+1</f><v>2</v></c>`;
    return`<c r="${reference}" t="str"><v>${xmlEscape(value)}</v></c>`;
  }).join("")}</row>`).join("");
  const entries={
    "[Content_Types].xml":`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels":`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml":`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="README" sheetId="1" r:id="rIdReadme"/><sheet name="${sheetName}" sheetId="2" r:id="rIdImport"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels":`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdReadme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/readme.xml"/><Relationship Id="rIdImport" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/readme.xml":`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="str"><v>Not import data</v></c></row></sheetData></worksheet>`,
    "xl/worksheets/sheet1.xml":`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`
  };
  return zipStored(entries);
}

function zipStored(entries){
  const locals=[],centrals=[];let offset=0;
  for(const [name,value] of Object.entries(entries)){
    const fileName=Buffer.from(name),body=Buffer.from(value),crc=crc32.unsigned(body);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(body.length,22);local.writeUInt16LE(fileName.length,26);
    locals.push(local,fileName,body);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(body.length,24);central.writeUInt16LE(fileName.length,28);central.writeUInt32LE(offset,42);centrals.push(central,fileName);
    offset+=local.length+fileName.length+body.length;
  }
  const centralBody=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(entries).length,8);end.writeUInt16LE(Object.keys(entries).length,10);end.writeUInt32LE(centralBody.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,centralBody,end]);
}
function columnLetters(number){let value=number,result="";while(value){value-=1;result=String.fromCharCode(65+value%26)+result;value=Math.floor(value/26)}return result}
function xmlEscape(value){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
