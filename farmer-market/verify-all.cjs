const {spawnSync}=require('node:child_process');
const path=require('node:path');
for(const file of ['app.js','domain.js','farmer-store.js','farmer-ui.js','auth-ui.js','server.cjs','backend/database.cjs','backend/dev-server.cjs','backend/auth.cjs','backend/admin.cjs']){
  const result=spawnSync(process.execPath,['--check',path.join(__dirname,file)],{stdio:'inherit'});
  if(result.error||result.status!==0)process.exit(result.status||1);
}
for(const file of ['verify.cjs','verify-farmers.cjs','backend/verify.cjs','backend/verify-auth.cjs']){
  const result=spawnSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit'});
  if(result.error||result.status!==0)process.exit(result.status||1);
}
console.log('PASS: 전체 구문·상품·농부·DB/API 검증 완료');
