const assert=require('node:assert/strict');
const {create,select}=require('./farmer-store.js');
const memory=new Map();const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
const store=create(storage);
assert.equal(store.list().length,10);
assert.deepEqual(store.list().map(f=>f.name),Array.from({length:10},(_,i)=>`예시${i+1}`));
assert.equal(select(store.list(),{page:1,pageSize:9}).rows.length,9);
assert.equal(select(store.list(),{page:2,pageSize:9}).rows[0].name,'예시10');
for(let i=0;i<20;i++)store.save({name:`테스트농장 ${i}`,person:'예시 농부',region:i%2?'전남 해남':'제주',crops:'시험작물',story:'페이지 이동 검증용',order:11+i,published:true});
let r=select(store.list(),{publishedOnly:true,page:3,pageSize:9});
assert.equal(r.total,30);assert.equal(r.pages,4);assert.equal(r.rows.length,9);
assert.equal(select(store.list(),{page:999}).page,4);
assert.equal(select(store.list(),{pageSize:3}).pages,10);
assert.equal(select(store.list(),{query:'시험작물'}).total,20);
const last=store.list().at(-1);store.save({...last,order:1});
assert.ok(select(store.list(),{pageSize:3}).rows.some(f=>f.id===last.id));
const row=store.list()[10];store.save({...row,published:false,name:'수정 농장'});
assert.equal(select(store.list(),{publishedOnly:true}).total,29);
assert.equal(create(storage).get(row.id).name,'수정 농장');
store.remove(row.id);assert.equal(store.get(row.id),null);
assert.throws(()=>store.remove('f1'),/삭제 대신/);
assert.throws(()=>store.save({name:' ',region:'서울',story:'소개',order:1}),/농장명/);
assert.throws(()=>store.save({name:'농장',region:'서울',story:'소개',order:-1}),/순서/);
assert.throws(()=>store.save({name:'농장',region:'서울',story:'소개',order:1,photo:'javascript:alert(1)'}),/사진/);
const broken=create({getItem:()=>'{invalid',setItem:()=>{}});assert.equal(broken.recovered,true);assert.equal(broken.list().length,10);
const blocked=create({getItem:()=>null,setItem:()=>{throw new Error();}});assert.throws(()=>blocked.save({...blocked.list()[0],name:'실패'}),/저장/);assert.notEqual(blocked.list()[0].name,'실패');
let empty=select([],{page:5});assert.equal(empty.total,0);assert.equal(empty.page,1);
assert.equal(select(store.list(),{query:'없는농부'}).total,0);
const original=[
  {id:'f1',name:'햇살농장',region:'경북 영주',story:'계절의 변화를 살피며 사과와 채소를 돌보는 예시 농장입니다.'},
  {id:'f2',name:'들녘농장',region:'전남 해남',story:'땅의 속도에 맞춰 뿌리채소를 키우는 예시 농장입니다.'},
  {id:'f3',name:'바람농장',region:'제주 서귀포',story:'바람과 햇살을 담아 제철 과일을 준비하는 예시 농장입니다.'}
].map((f,i)=>({...f,person:'',crops:'',photo:'',published:true,order:i+1,example:true}));
let migrated;
const upgrade=create({getItem:()=>JSON.stringify(original),setItem:(k,v)=>{migrated=v;}});
assert.equal(upgrade.list().length,10);assert.equal(JSON.parse(migrated)[9].name,'예시10');
original[0].name='직접 수정한 농장';
assert.equal(create({getItem:()=>JSON.stringify(original),setItem:()=>{}}).list()[0].name,'직접 수정한 농장');
console.log('PASS: 예시1~10·9+1 페이지·30개 확장·검색·순서·공개 필터·저장·삭제 보호·입력 검증·기본 데이터 이관·사용자 수정 보존');
