import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(root,'dist');
const [template,css,js]=await Promise.all(['index.html','style.css','synth.js'].map(name=>readFile(path.join(dist,name),'utf8')));
if(!template.includes('<link rel="stylesheet" href="style.css">')||!template.includes('<script src="synth.js"></script>'))throw new Error('Expected Flora stylesheet and script references were not found.');
if(/<\/style/i.test(css)||/<\/script/i.test(js))throw new Error('A closing HTML tag in an asset requires escaping before export.');
const html=template
 .replace('<link rel="stylesheet" href="style.css">',()=>`<!-- Single-file Flora export. Regenerate with: node scripts/export-html.mjs -->\n  <style>\n${css}\n  </style>`)
 .replace('<script src="synth.js"></script>',()=>`<script>\n${js}\n  </script>`)
 .replace('class="brand" href="./"','class="brand" href="#"');
const target=path.join(root,'index.html');
await writeFile(target,html,'utf8');
console.log(`Standalone HTML written to ${target} (${Buffer.byteLength(html)} bytes)`);
