const assert=require('node:assert/strict');
const {normalize,totals,farmers,products}=require('./domain.js');
const {defaults}=require('./farmer-store.js');
assert.equal(farmers.length,10);assert.equal(products.length,13);
assert.equal(new Set(products.map(p=>p.id)).size,products.length);
for(const f of farmers){
  const profile=defaults().find(p=>p.id===f.id);
  assert.equal(profile.name,f.name);assert.equal(profile.region,f.region);assert.equal(profile.crops,f.crops);
  const offered=products.filter(p=>p.farmer===f.id);assert.ok(offered.length>0);
  for(const crop of f.crops.split(', '))assert.ok(offered.some(p=>p.name.includes(crop)),`${f.name}: ${crop}`);
}
for(const p of products)assert.ok(farmers.some(f=>f.id===p.farmer));
assert.equal(totals([]).total,0);
let t=totals([{id:'apple',qty:1},{id:'potato',qty:1}]);
assert.equal(t.groups.length,2);assert.equal(t.shipping,7500);assert.equal(t.total,49500);
t=totals([{id:'potato',qty:1},{id:'cabbage',qty:1}]);
assert.equal(t.groups.length,1);assert.equal(t.shipping,4000);assert.equal(t.total,38000);
t=totals([{id:'apple',qty:3},{id:'potato',qty:1}]);
assert.equal(t.shipping,4000);assert.equal(t.total,94000);
assert.deepEqual(normalize([{id:'pear',qty:1},{id:'carrot',qty:1},{id:'unknown',qty:2},{id:'apple',qty:-1},{id:'potato',qty:1.5}]),[]);
assert.deepEqual(normalize([{id:'apple',qty:6},{id:'apple',qty:6}]),[{id:'apple',qty:8}]);
assert.deepEqual(normalize(null),[]);
t=totals([{id:'tomato',qty:1},{id:'naju-pear',qty:1}]);
assert.equal(t.groups.length,2);assert.equal(t.shipping,7500);assert.equal(t.total,55500);
assert.equal(t.groups[0].farmer.name,'예시4');assert.equal(t.groups[1].farmer.name,'예시10');
assert.equal(totals([{id:'naju-pear',qty:3}]).shipping,0);
assert.deepEqual(normalize([{id:'peach',qty:1}]),[]);
console.log('PASS: 농부 10명·상품 13개 연결, 소개와 작물 일치, 기존 및 신규 농부 배송비·무료배송·품절·재고 검증');
