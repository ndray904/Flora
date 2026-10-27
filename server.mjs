import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const name=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const data=await readFile(file);res.writeHead(200,{'Content-Type':({'html':'text/html','js':'text/javascript','css':'text/css','svg':'image/svg+xml'})[file.split('.').pop()]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(4317,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4317'));
