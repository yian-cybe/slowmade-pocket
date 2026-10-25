import { createServer } from 'node:http';
import { readFileSync,existsSync,statSync } from 'node:fs';
import { resolve,sep,extname } from 'node:path';
const root=resolve('dist'),port=Number(process.env.PORT||5178);
createServer((req,res)=>{try{
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=resolve(root,'.'+path);if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 if(existsSync(file)&&statSync(file).isDirectory())file=resolve(file,'index.html');
 if(!existsSync(file)){res.writeHead(404);res.end('Not found');return;}
 const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(readFileSync(file));
 }catch{res.writeHead(500);res.end('Unable to load');}}).listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port+'/'));
