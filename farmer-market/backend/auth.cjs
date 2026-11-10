const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const random=()=>crypto.randomBytes(32).toString('base64url');
const now=()=>new Date().toISOString();
const after=ms=>new Date(Date.now()+ms).toISOString();
const params={N:131072,r:8,p:1,maxmem:256*1024*1024};
async function passwordHash(password){const salt=crypto.randomBytes(16).toString('hex');const key=await scrypt(password,salt,64,params);return `scrypt$131072$8$1$${salt}$${key.toString('hex')}`;}
async function passwordMatches(password,encoded){try{const [algo,n,r,p,salt,hex]=encoded.split('$');if(algo!=='scrypt'||n!=='131072'||r!=='8'||p!=='1')return false;const expected=Buffer.from(hex,'hex');const actual=await scrypt(password,salt,64,params);return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);}catch{return false;}}
function createAuth(db,{origin,localMail=false}){
  const secret=random(),inbox=[],limits=new Map();let busy=0;
  const cookieName='market_dev_session';
  const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=')).filter(s=>s.length===2));
  function signed(){const token=random();return token+'.'+crypto.createHmac('sha256',secret).update(token).digest('hex');}
  function valid(value){if(typeof value!=='string')return false;const [t,s]=value.split('.');if(!t||!s)return false;const want=crypto.createHmac('sha256',secret).update(t).digest('hex');return s.length===want.length&&crypto.timingSafeEqual(Buffer.from(s),Buffer.from(want));}
  function setCookie(res,name,value,maxAge){const current=res.getHeader('Set-Cookie')||[];res.setHeader('Set-Cookie',[...current,`${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`]);}
  function failure(status,message,code='VALIDATION_ERROR'){return Object.assign(new Error(message),{status,code});}
  function session(req){const token=cookies(req)[cookieName];if(!token)return null;const row=db.prepare('SELECT s.*,u.email,u.role,u.status AS user_status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').get(hash(token));if(!row||row.revoked_at||row.user_status!=='active'||Date.parse(row.expires_at)<=Date.now()||Date.now()-Date.parse(row.last_seen_at)>(row.role==='admin'?15:30)*60000)return null;db.prepare('UPDATE sessions SET last_seen_at=? WHERE id=?').run(now(),row.id);return row;}
  function limited(key,max,windowMs){const t=Date.now();let state=limits.get(key);if(!state||state.until<t){state={n:0,until:t+windowMs};limits.set(key,state);}if(++state.n>max)throw failure(429,'시도가 많습니다. 잠시 후 다시 시도해주세요.','RATE_LIMITED');if(limits.size>5000)for(const [k,v]of limits)if(v.until<t)limits.delete(k);}
  function emailOf(value){if(typeof value!=='string'||value.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw failure(400,'올바른 이메일을 입력해주세요.');return value.trim().toLowerCase();}
  function passwordOf(value){if(typeof value!=='string'||value.length<12||value.length>128)throw failure(400,'비밀번호는 12~128자로 입력해주세요.');return value;}
  async function body(req){let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw failure(413,'요청 내용이 너무 큽니다.');chunks.push(chunk);}try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||Array.isArray(value)||typeof value!=='object')throw Error();return value;}catch{throw failure(400,'올바른 JSON 요청이 필요합니다.');}}
  function mail(user,purpose){if(!localMail)throw failure(503,'개발용 수신함을 켠 서버에서 시험해주세요.','MAIL_DISABLED');const token=random(),id=crypto.randomUUID();const expiry=after(purpose==='verify_email'?30*60000:15*60000);db.prepare('UPDATE access_tokens SET revoked_at=? WHERE user_id=? AND purpose=? AND used_at IS NULL AND revoked_at IS NULL').run(now(),user.id,purpose);db.prepare('INSERT INTO access_tokens(id,token_hash,purpose,user_id,expires_at) VALUES(?,?,?,?,?)').run(id,hash(token),purpose,user.id,expiry);inbox.unshift({id,email:user.email,subject:purpose==='verify_email'?'이메일 주소 확인':'비밀번호 재설정',url:`${origin}/#${purpose==='verify_email'?'verify-email':'reset-password'}/${token}`,expiresAt:expiry});inbox.splice(30);}
  const generic={message:'대상 이메일이 유효하면 로컬 테스트 수신함에 안내가 생성됩니다.'};
  async function handle(req,res,url){
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(data));};
    const path=url.pathname;
    if(!path.startsWith('/api/v1/auth/')&&path!=='/api/dev/mailbox'&&path!=='/api/v1/admin/session')return false;
    try{
      if(req.headers.host!==new URL(origin).host)throw failure(403,'허용되지 않은 호스트입니다.');
      if(req.method==='GET'&&path==='/api/v1/auth/csrf'){let token=cookies(req).market_csrf;if(!valid(token))token=signed();const s=session(req);if(s)db.prepare('UPDATE sessions SET csrf_hash=? WHERE id=?').run(hash(token),s.id);setCookie(res,'market_csrf',token,86400);send(200,{csrfToken:token});return true;}
      if(req.method==='GET'&&path==='/api/v1/auth/me'){const s=session(req);if(!s)throw failure(401,'로그인이 필요합니다.','UNAUTHENTICATED');send(200,{user:{id:s.user_id,email:s.email,role:s.role}});return true;}
      if(req.method==='GET'&&path==='/api/v1/admin/session'){const s=session(req);if(!s)throw failure(401,'로그인이 필요합니다.','UNAUTHENTICATED');if(s.role!=='admin')throw failure(403,'운영자 권한이 필요합니다.','FORBIDDEN');send(200,{role:'admin'});return true;}
      if(req.method==='GET'&&path==='/api/dev/mailbox'){if(!localMail)throw failure(404,'수신함이 꺼져 있습니다.');if(req.headers['x-csrf-token']!==cookies(req).market_csrf||!valid(cookies(req).market_csrf))throw failure(403,'수신함 접근을 확인할 수 없습니다.');send(200,{developmentOnly:true,messages:inbox});return true;}
      if(req.method!=='POST')throw failure(405,'지원하지 않는 요청 방식입니다.');
      const csrf=cookies(req).market_csrf;if(req.headers.origin!==origin||!valid(csrf)||req.headers['x-csrf-token']!==csrf)throw failure(403,'요청 확인에 실패했습니다. 페이지를 새로고침해주세요.','CSRF_FAILED');
      const activeSession=session(req);if(activeSession&&activeSession.csrf_hash!==hash(csrf))throw failure(403,'로그인 상태 확인에 실패했습니다.','CSRF_FAILED');
      if(!String(req.headers['content-type']||'').startsWith('application/json'))throw failure(415,'JSON 요청이 필요합니다.');
      limited('ip:'+req.socket.remoteAddress,50,3600000);
      const input=await body(req);
      if(path==='/api/v1/auth/logout'){const s=session(req);if(s)db.prepare('UPDATE sessions SET revoked_at=? WHERE id=?').run(now(),s.id);setCookie(res,cookieName,'',0);send(200,{message:'로그아웃했습니다.'});return true;}
      if(path==='/api/v1/auth/register'){
        const email=emailOf(input.email),password=passwordOf(input.password);if(input.consent!==true)throw failure(400,'개발용 계정 저장 안내를 확인해주세요.');limited('register:'+hash(email),5,3600000);if(!localMail)throw failure(503,'개발용 수신함을 먼저 켜주세요.');
        if(busy>=2)throw failure(429,'인증 처리 중입니다. 잠시 후 다시 시도해주세요.');busy++;let encoded;try{encoded=await passwordHash(password);}finally{busy--;}
        if(!db.prepare('SELECT id FROM users WHERE email=?').get(email)){
          const user={id:crypto.randomUUID(),email};db.exec('BEGIN IMMEDIATE;');try{db.prepare('INSERT INTO users(id,email,password_hash) VALUES(?,?,?)').run(user.id,email,encoded);db.prepare("INSERT INTO consent_records(id,user_id,email,purpose,document_version,granted) VALUES(?,?,?,'local_test_account','dev-v1',1)").run(crypto.randomUUID(),user.id,email);mail(user,'verify_email');db.exec('COMMIT;');}catch(err){db.exec('ROLLBACK;');throw err;}
        }
        send(202,generic);return true;
      }
      if(path==='/api/v1/auth/login'){
        const email=emailOf(input.email);const password=passwordOf(input.password);limited('login:'+hash(email),5,15*60000);limited('login-ip:'+req.socket.remoteAddress,15,15*60000);
        const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);if(busy>=2)throw failure(429,'인증 처리 중입니다. 잠시 후 다시 시도해주세요.');busy++;let matches;try{matches=await passwordMatches(password,user?.password_hash||'scrypt$131072$8$1$00000000000000000000000000000000$'+'0'.repeat(128));}finally{busy--;}
        if(!user||!matches||user.status!=='active')throw failure(401,'이메일·비밀번호 또는 이메일 확인 상태를 확인해주세요.','LOGIN_FAILED');
        const previous=cookies(req)[cookieName];if(previous)db.prepare('UPDATE sessions SET revoked_at=? WHERE token_hash=?').run(now(),hash(previous));
        const token=random();db.prepare('INSERT INTO sessions(id,token_hash,user_id,csrf_hash,expires_at,last_seen_at) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),hash(token),user.id,hash(csrf),after((user.role==='admin'?8:24)*3600000),now());setCookie(res,cookieName,token,86400);limits.delete('login:'+hash(email));send(200,{user:{id:user.id,email:user.email,role:user.role}});return true;
      }
      if(path==='/api/v1/auth/email/resend'||path==='/api/v1/auth/password/request'){
        const email=emailOf(input.email);limited('mail:'+hash(email),5,3600000);limited('mail-minute:'+hash(email),1,60000);if(!localMail)throw failure(503,'개발용 수신함을 먼저 켜주세요.');const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);const purpose=path.endsWith('/resend')?'verify_email':'reset_password';if(user&&(purpose==='verify_email'?user.status==='pending':user.status==='active'))mail(user,purpose);send(202,generic);return true;
      }
      if(path==='/api/v1/auth/email/confirm'||path==='/api/v1/auth/password/reset'){
        if(typeof input.token!=='string'||input.token.length>200)throw failure(400,'유효한 확인 링크가 필요합니다.');const purpose=path.endsWith('/confirm')?'verify_email':'reset_password';const tokenHash=hash(input.token);const t=db.prepare('SELECT * FROM access_tokens WHERE token_hash=? AND purpose=?').get(tokenHash,purpose);if(!t||t.used_at||t.revoked_at||Date.parse(t.expires_at)<=Date.now())throw failure(400,'만료되거나 이미 사용한 링크입니다.');
        let encoded;if(purpose==='reset_password'){const password=passwordOf(input.newPassword);if(busy>=2)throw failure(429,'인증 처리 중입니다. 잠시 후 다시 시도해주세요.');busy++;try{encoded=await passwordHash(password);}finally{busy--;}}
        db.exec('BEGIN IMMEDIATE;');try{const result=db.prepare('UPDATE access_tokens SET used_at=? WHERE id=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?').run(now(),t.id,now());if(result.changes!==1)throw failure(400,'만료되거나 이미 사용한 링크입니다.');if(purpose==='verify_email')db.prepare("UPDATE users SET status='active',email_verified_at=? WHERE id=? AND status='pending'").run(now(),t.user_id);else{db.prepare("UPDATE users SET password_hash=? WHERE id=? AND status='active'").run(encoded,t.user_id);db.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=?').run(now(),t.user_id);db.prepare("UPDATE access_tokens SET revoked_at=? WHERE user_id=? AND purpose='reset_password'").run(now(),t.user_id);}db.exec('COMMIT;');}catch(err){db.exec('ROLLBACK;');throw err;}
        send(200,{message:purpose==='verify_email'?'이메일 확인을 완료했습니다. 로그인해주세요.':'비밀번호를 변경했습니다. 다시 로그인해주세요.'});return true;
      }
      throw failure(404,'아직 구현하지 않은 인증 API입니다.');
    }catch(err){send(err.status||500,{error:{code:err.code||'INTERNAL_ERROR',message:err.status?err.message:'인증 요청을 처리하지 못했습니다.'}});}
    return true;
  }
  return {handle};
}
module.exports={createAuth,passwordHash,passwordMatches,hash};

