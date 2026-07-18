import fs from 'node:fs/promises';

export async function readCsv(file){
  const text=(await fs.readFile(file,'utf8')).replace(/^\uFEFF/,'');
  const rows=parseCsv(text);
  if(rows.length<2)throw new Error('CSV must contain a header and at least one artist.');
  const headers=rows[0].map(value=>value.trim());
  const duplicates=headers.filter((value,index)=>headers.indexOf(value)!==index);
  if(duplicates.length)throw new Error(`Duplicate CSV headers: ${[...new Set(duplicates)].join(', ')}`);
  return rows.slice(1).filter(row=>row.some(value=>value.trim())).map((row,index)=>({
    rowNumber:index+2,
    ...Object.fromEntries(headers.map((header,column)=>[header,(row[column]??'').trim()]))
  }));
}

export function parseCsv(text){
  const rows=[];let row=[];let field='';let quoted=false;
  for(let index=0;index<text.length;index++){
    const char=text[index];
    if(quoted){
      if(char==='"'&&text[index+1]==='"'){field+='"';index++;}
      else if(char==='"')quoted=false;
      else field+=char;
    }else if(char==='"')quoted=true;
    else if(char===','){row.push(field);field='';}
    else if(char==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
    else field+=char;
  }
  if(quoted)throw new Error('CSV contains an unclosed quoted field.');
  if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  return rows;
}

export function csvText(rows,columns){
  const quote=value=>{const text=String(value??'');return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text};
  return [columns.join(','),...rows.map(row=>columns.map(column=>quote(row[column])).join(','))].join('\n')+'\n';
}
