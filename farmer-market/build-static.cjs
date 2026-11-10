const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'public');
if(path.dirname(out)!==root||path.basename(out)!=='public')throw new Error('Unexpected output directory');
// Only this generated directory is replaced; source and local database stay outside.
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'fonts'),{recursive:true});
const files=['styles.css','domain.js','app.js','farmer-store.js','farmer-ui.js','auth-ui.js','fonts/Pretendard-Medium.ttf','fonts/OFL.txt'];
for(const file of files)fs.copyFileSync(path.join(__dirname,file),path.join(out,file));
fs.writeFileSync(path.join(out,'deployment-config.js'),'window.MARKET_STATIC_PREVIEW = true;\n');
let html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
html=html.replace('<script src="domain.js">','<script src="deployment-config.js"></script><script src="domain.js">')
  .replace('<a href="#manage-farmers">농부 소개 관리 ↗</a>','')
  .replace('상품·농장·가격은 예시이며 실제 주문과 결제는 진행되지 않습니다.','상품과 가격은 예시입니다. 회원가입·로그인·결제는 이 공개 미리보기에서 제공하지 않습니다.');
fs.writeFileSync(path.join(out,'index.html'),html);
console.log('Vercel static preview built: public/ (no database, auth API or development mailbox)');
