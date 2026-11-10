const http=require('node:http');
const {openDatabase}=require('./database.cjs');
function createApi(db,options={}){const auth=options.origin?require('./auth.cjs').createAuth(db,options):null;return http.createServer(async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  const url=new URL(req.url,'http://127.0.0.1');
  if(auth&&await auth.handle(req,res,url))return;
  if(req.method!=='GET')return send(405,{error:{code:'METHOD_NOT_ALLOWED',message:'3단계에서는 읽기 API만 제공합니다.'}});
  try{
    if(url.pathname==='/api/health')return send(200,{status:'ok',stage:auth?4:3,authImplemented:!!auth,paymentsEnabled:false,mailEnabled:false,localMailboxEnabled:!!options.localMail,schemaVersion:db.prepare('PRAGMA user_version').get().user_version});
    const page=Number(url.searchParams.get('page')||1),pageSize=Number(url.searchParams.get('pageSize')||9);
    if(!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>100)return send(400,{error:{code:'INVALID_PAGINATION',message:'page는 1 이상, pageSize는 1~100 정수여야 합니다.'}});
    if(url.pathname==='/api/v1/farmers'){
      const q=(url.searchParams.get('q')||'').trim();if(q.length>120)return send(400,{error:{code:'INVALID_QUERY',message:'검색어는 120자 이하로 입력해주세요.'}});
      const where='published=1 AND (?=\'\' OR instr(name,?)>0 OR instr(person,?)>0 OR instr(region,?)>0 OR instr(crops,?)>0)';
      const args=[q,q,q,q,q];
      const total=db.prepare(`SELECT count(*) AS n FROM farmers WHERE ${where}`).get(...args).n;
      const data=db.prepare(`SELECT id,name,person,region,crops,story,photo_key AS photoKey,is_example AS isExample FROM farmers WHERE ${where} ORDER BY display_order,id LIMIT ? OFFSET ?`).all(...args,pageSize,(page-1)*pageSize);
      return send(200,{data,page,pageSize,total});
    }
    if(url.pathname==='/api/v1/products'){
      const farmer=url.searchParams.get('farmerId')||'';
      const total=db.prepare("SELECT count(*) AS n FROM products WHERE status IN ('on_sale','sold_out','scheduled') AND (?='' OR farmer_id=?)").get(farmer,farmer).n;
      const data=db.prepare(`SELECT p.id,p.name,p.farmer_id AS farmerId,f.name AS farmerName,p.category,p.status FROM products p JOIN farmers f ON f.id=p.farmer_id WHERE p.status IN ('on_sale','sold_out','scheduled') AND (?='' OR p.farmer_id=?) ORDER BY f.display_order,p.id LIMIT ? OFFSET ?`).all(farmer,farmer,pageSize,(page-1)*pageSize);
      const variants=db.prepare('SELECT id,label,price,stock-reserved AS availableStock FROM variants WHERE product_id=? ORDER BY id');
      data.forEach(p=>{p.variants=variants.all(p.id);});
      return send(200,{data,page,pageSize,total});
    }
    return send(404,{error:{code:'NOT_IMPLEMENTED',message:'아직 구현하지 않은 API입니다.'}});
  }catch{send(500,{error:{code:'INTERNAL_ERROR',message:'요청을 처리하지 못했습니다.'}});}
});}
module.exports={createApi};
if(require.main===module){const db=openDatabase();const server=createApi(db);server.listen(4174,'127.0.0.1',()=>console.log('3단계 읽기 API: http://127.0.0.1:4174/api/health'));const stop=()=>server.close(()=>{db.close();process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);}
