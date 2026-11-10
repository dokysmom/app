const {openDatabase}=require('./database.cjs');
const {randomUUID}=require('node:crypto');
const email=process.argv[2]?.trim().toLowerCase();
if(!email){console.error('사용법: node farmer-market/backend/admin.cjs 확인완료된-이메일');process.exit(1);}
const db=openDatabase();try{const user=db.prepare("SELECT id FROM users WHERE email=? AND status='active'").get(email);if(!user)throw new Error('이메일 확인을 완료한 회원이 필요합니다.');db.exec('BEGIN IMMEDIATE;');try{db.prepare("UPDATE users SET role='admin' WHERE id=?").run(user.id);db.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=?').run(new Date().toISOString(),user.id);db.prepare("INSERT INTO audit_logs(id,actor_user_id,action,resource_type,resource_id) VALUES(?,?,'local_admin_promotion','user',?)").run(randomUUID(),user.id,user.id);db.exec('COMMIT;');}catch(err){db.exec('ROLLBACK;');throw err;}console.log('운영자 권한을 설정했습니다. 다시 로그인해주세요.');}catch(err){console.error(err.message);process.exitCode=1;}finally{db.close();}
