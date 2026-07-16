const fs=require('fs'),vm=require('vm');
const url=process.argv[2];if(!url)process.exit(2);
const element={innerHTML:'',title:'',childNodes:[{offsetWidth:256,offsetHeight:256,style:{}}]};
const context={navigator:{userAgent:''},document:{documentElement:{tagName:'html'},getElementById(){return element}},console};
vm.createContext(context);vm.runInContext(fs.readFileSync('scripts/vendor/qrcode.min.js','utf8'),context);
const qr=new context.QRCode(element,{text:url,correctLevel:context.QRCode.CorrectLevel.H,width:256,height:256});
const model=qr._oQRCode,n=model.getModuleCount(),rows=[];for(let y=0;y<n;y++){const row=[];for(let x=0;x<n;x++)row.push(model.isDark(y,x));rows.push(row)}
process.stdout.write(JSON.stringify(rows));
