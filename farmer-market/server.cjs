const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const publicFiles=new Set(['/','/index.html','/styles.css','/domain.js','/app.js','/farmer-store.js','/farmer-ui.js','/auth-ui.js','/fonts/Pretendard-Medium.ttf']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.ttf':'font/ttf'};
function createPreviewServer(options={}){const api=options.db?require('./backend/dev-server.cjs').createApi(options.db,options):null;return http.createServer((req,res)=>{
  if(req.url.startsWith('/api/')&&api){api.emit('request',req,res);return;}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end('Bad request');return;}
  if(!publicFiles.has(pathname)){res.writeHead(404);res.end('Not found');return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
});}
module.exports={createPreviewServer};
if(require.main===module){const {openDatabase,seedDemo}=require('./backend/database.cjs');const db=openDatabase();seedDemo(db);const origin='http://127.0.0.1:4175';const server=createPreviewServer({db,origin,localMail:process.argv.includes('--dev-mailbox')});server.listen(4175,'127.0.0.1',()=>console.log(`회원 기능 미리보기: ${origin} (로컬 수신함: ${process.argv.includes('--dev-mailbox')?'켜짐':'꺼짐'})`));const stop=()=>server.close(()=>{db.close();process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);}
