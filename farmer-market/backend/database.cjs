const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');
const {farmers,products}=require('../domain.js');
const DEFAULT_PATH=path.join(__dirname,'../../.farmer-market-data/market.sqlite');
function openDatabase(filename=DEFAULT_PATH){
  if(filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true});
  const db=new DatabaseSync(filename);
  try{
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    if(filename!==':memory:')db.exec('PRAGMA journal_mode=WAL;');
    const version=db.prepare('PRAGMA user_version').get().user_version;
    if(version>2)throw new Error('DB schema version is newer than this application.');
    if(version===0){db.exec('BEGIN IMMEDIATE;');try{db.exec(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));db.exec('PRAGMA user_version=1; COMMIT;');}catch(err){db.exec('ROLLBACK;');throw err;}}
    if(version<2){db.exec('BEGIN IMMEDIATE;');try{db.exec(fs.readFileSync(path.join(__dirname,'002-scoped-sessions.sql'),'utf8'));db.exec('PRAGMA user_version=2; COMMIT;');}catch(err){db.exec('ROLLBACK;');throw err;}}
    return db;
  }catch(err){db.close();throw err;}
}
function seedDemo(db){
  const farmer=db.prepare('INSERT OR IGNORE INTO farmers(id,name,region,crops,story,published,display_order,is_example) VALUES(?,?,?,?,?,1,?,1)');
  const shipping=db.prepare('INSERT OR IGNORE INTO shipping_policies(farmer_id,base_fee,free_at) VALUES(?,?,?)');
  const product=db.prepare('INSERT OR IGNORE INTO products(id,farmer_id,name,category,status,origin,storage_text,dispatch_text,illustration_json) VALUES(?,?,?,?,?,?,?,?,?)');
  const variant=db.prepare('INSERT OR IGNORE INTO variants(id,product_id,label,price,stock) VALUES(?,?,?,?,?)');
  const states={'판매 중':'on_sale','품절':'sold_out','수확 예정':'scheduled'};
  db.exec('BEGIN IMMEDIATE;');
  try{
    farmers.forEach((f,i)=>{farmer.run(f.id,f.name,f.region,f.crops,f.story,i+1);shipping.run(f.id,f.fee,f.freeAt);});
    products.forEach(p=>{product.run(p.id,p.farmer,p.name,p.type==='과일'?'fruit':'vegetable',states[p.status],farmers.find(f=>f.id===p.farmer).region,p.store,p.dispatch,JSON.stringify({color:p.color,fruit:p.fruit,kind:p.kind}));variant.run(p.id+'-default',p.id,p.unit,p.price,p.stock);});
    db.exec('COMMIT;');
  }catch(err){db.exec('ROLLBACK;');throw err;}
}
module.exports={openDatabase,seedDemo,DEFAULT_PATH};
if(require.main===module){const db=openDatabase();try{if(process.argv.includes('--seed-demo'))seedDemo(db);console.log(JSON.stringify({database:DEFAULT_PATH,schemaVersion:db.prepare('PRAGMA user_version').get().user_version,farmers:db.prepare('SELECT count(*) AS n FROM farmers').get().n,products:db.prepare('SELECT count(*) AS n FROM products').get().n,integrity:db.prepare('PRAGMA integrity_check').get().integrity_check}));}finally{db.close();}}
