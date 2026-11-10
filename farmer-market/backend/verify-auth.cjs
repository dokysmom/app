const assert=require('node:assert/strict');
const http=require('node:http');
const {openDatabase}=require('./database.cjs');
const {createApi}=require('./dev-server.cjs');
async function main(){
  const db=openDatabase(':memory:'),server=http.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const api=createApi(db,{origin:base,localMail:true});server.on('request',(req,res)=>api.emit('request',req,res));
  function client(){const jar=new Map();let csrf;return {
    async call(path,body,extra={}){const headers={Cookie:[...jar].map(([k,v])=>k+'='+v).join(';'),...extra};if(body!==undefined){headers.Origin=extra.Origin||base;headers['Content-Type']='application/json';if(csrf)headers['X-CSRF-Token']=csrf;}
      const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});for(const cookie of res.headers.getSetCookie()){const [pair]=cookie.split(';');const i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}const data=await res.json();if(path.endsWith('/csrf'))csrf=data.csrfToken;return {status:res.status,data,cookies:res.headers.getSetCookie()};},
    async prepare(){await this.call('/api/v1/auth/csrf');},
    async inbox(){return this.call('/api/dev/mailbox',undefined,{'X-CSRF-Token':csrf});},
    cookie:()=>jar.get('market_dev_session')
  };}
  try{
    const a=client(),b=client();
    assert.equal((await a.call('/api/v1/auth/me')).status,401);
    assert.equal((await a.call('/api/v1/auth/register',{email:'a@example.invalid',password:'Test-password-2026',consent:true})).status,403);
    await a.prepare();
    assert.equal((await a.call('/api/v1/auth/register',{email:'a@example.invalid',password:'Test-password-2026',consent:true},{Origin:'https://untrusted.invalid'})).status,403);
    assert.equal((await a.call('/api/v1/auth/register',{email:'a@example.invalid',password:'short',consent:true})).status,400);
    const password='Test-password-2026';
    const created=await a.call('/api/v1/auth/register',{email:'A@example.invalid',password,consent:true,role:'admin'});assert.equal(created.status,202);
    const user=db.prepare('SELECT * FROM users').get();assert.equal(user.email,'a@example.invalid');assert.equal(user.role,'customer');assert.equal(user.status,'pending');assert.ok(!user.password_hash.includes(password));
    assert.equal(db.prepare('SELECT count(*) n FROM consent_records WHERE user_id=?').get(user.id).n,1);
    const pending=await a.call('/api/v1/auth/login',{email:user.email,password});assert.equal(pending.status,401);
    const message=(await a.inbox()).data.messages[0];const verifyToken=message.url.split('/').at(-1);assert.notEqual(db.prepare('SELECT token_hash FROM access_tokens').get().token_hash,verifyToken);
    assert.equal((await a.call('/api/v1/auth/email/confirm',{token:verifyToken})).status,200);
    assert.equal((await a.call('/api/v1/auth/email/confirm',{token:verifyToken})).status,400);
    assert.equal((await a.call('/api/v1/auth/register',{email:user.email,password:'A-different-password-2026',consent:true})).status,202);
    const logged=await a.call('/api/v1/auth/login',{email:user.email,password});assert.equal(logged.status,200);assert.ok(logged.cookies.some(c=>c.includes('HttpOnly')));assert.equal((await a.call('/api/v1/auth/me')).data.user.id,user.id);
    assert.equal((await a.call('/api/v1/admin/session')).status,403);
    await b.prepare();assert.equal((await b.call('/api/v1/auth/me')).status,401);
    const session=a.cookie();assert.notEqual(db.prepare('SELECT token_hash FROM sessions').get().token_hash,session);
    assert.equal((await a.call('/api/v1/auth/logout',{})).status,200);assert.equal((await a.call('/api/v1/auth/me')).status,401);
    assert.equal((await a.call('/api/v1/auth/login',{email:user.email,password})).status,200);
    assert.equal((await a.call('/api/v1/auth/password/request',{email:user.email})).status,202);
    const reset=(await a.inbox()).data.messages.find(m=>m.subject==='비밀번호 재설정').url.split('/').at(-1);
    assert.equal((await a.call('/api/v1/auth/password/reset',{token:reset,newPassword:'New-password-2026'})).status,200);
    assert.equal((await a.call('/api/v1/auth/me')).status,401);
    assert.equal((await a.call('/api/v1/auth/password/reset',{token:reset,newPassword:'New-password-2026'})).status,400);
    assert.equal((await a.call('/api/v1/auth/login',{email:user.email,password})).status,401);
    assert.equal((await a.call('/api/v1/auth/login',{email:user.email,password:'New-password-2026'})).status,200);
    db.prepare('UPDATE sessions SET expires_at=?').run('2000-01-01T00:00:00.000Z');assert.equal((await a.call('/api/v1/auth/me')).status,401);
    await b.prepare();let last;for(let i=0;i<6;i++)last=await b.call('/api/v1/auth/login',{email:'nobody@example.invalid',password});assert.equal(last.status,429);
    db.prepare("UPDATE users SET role='admin' WHERE id=?").run(user.id);assert.equal((await a.call('/api/v1/auth/login',{email:user.email,password:'New-password-2026'})).status,200);assert.equal((await a.call('/api/v1/admin/session')).status,200);
    const disabledApi=createApi(db,{origin:base,localMail:false});server.removeAllListeners('request');server.on('request',(req,res)=>disabledApi.emit('request',req,res));assert.equal((await a.inbox()).status,404);await b.prepare();assert.equal((await b.call('/api/v1/auth/register',{email:'disabled@example.invalid',password,consent:true})).status,503);
    console.log('PASS: 가입·해시·역할 주입 차단·이메일 확인/재사용 차단·로그인·세션 분리/만료·로그아웃·재설정/세션 폐기·CSRF/Origin·운영자 권한·횟수 제한');
  }finally{await new Promise(resolve=>server.close(resolve));db.close();}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
