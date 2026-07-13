import fs from 'node:fs/promises';

const platform=JSON.parse(await fs.readFile('platform.json','utf8'));
const slug=process.argv[2]||platform.defaultEdition;
const entry=platform.editions.find(edition=>edition.slug===slug);
if(!entry)throw new Error(`Unknown edition: ${slug}`);
const config=JSON.parse(await fs.readFile(entry.config,'utf8'));
const manifest=JSON.parse(await fs.readFile(`output/${slug}/delivery-manifest.json`,'utf8'));
const body=`Your ${config.bandName} Deep Cuts Fan Challenge is live:\n\n${config.publicURL}\n\nThis edition contains 36 source-verified questions delivered as three fresh, non-repeating 12-question games. The Instagram image and branded QR image are attached.\n`;
await fs.writeFile(`output/${slug}/completion-email.txt`,body);
const delivery={to:'andrewharris501@gmail.com',subject:`${config.bandName} Deep Cuts Fan Challenge – live link`,bodyFile:`output/${slug}/completion-email.txt`,attachments:[manifest.files.instagramImage.path,manifest.files.qrImage.path]};
await fs.writeFile(`output/${slug}/delivery.json`,JSON.stringify(delivery,null,2)+'\n');
console.log(JSON.stringify(delivery,null,2));
