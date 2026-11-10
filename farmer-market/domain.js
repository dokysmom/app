(function(root) {
  'use strict';
  const farmers = [
    {id:'f1',region:'경북 영주',fee:3500,freeAt:50000,crops:'사과, 배'},
    {id:'f2',region:'전남 해남',fee:4000,freeAt:60000,crops:'고구마, 배추'},
    {id:'f3',region:'제주 서귀포',fee:4500,freeAt:60000,crops:'감귤, 당근'},
    {id:'example-4',region:'충남 홍성',fee:3500,freeAt:50000,crops:'토마토'},
    {id:'example-5',region:'강원 평창',fee:3500,freeAt:50000,crops:'감자'},
    {id:'example-6',region:'전북 완주',fee:4000,freeAt:60000,crops:'딸기'},
    {id:'example-7',region:'경남 밀양',fee:3500,freeAt:50000,crops:'고추'},
    {id:'example-8',region:'충북 충주',fee:4000,freeAt:60000,crops:'복숭아'},
    {id:'example-9',region:'경기 양평',fee:3500,freeAt:50000,crops:'상추'},
    {id:'example-10',region:'전남 나주',fee:4000,freeAt:60000,crops:'배'}
  ].map((f,i)=>({...f,name:`예시${i+1}`,story:`예시${i+1} 농부의 소개입니다. 계절에 맞춰 작물을 돌보고 수확하는 이야기를 담을 공간입니다. 실제 농부와 농장 정보가 아닌 화면 확인용 자료입니다.`}));
  const products = [
    {id:'apple',name:'아삭한 가을 사과',type:'과일',farmer:'f1',price:24000,unit:'3kg · 중과',stock:8,status:'판매 중',color:'#efddd1',fruit:'#b74a36',kind:'apple',store:'서늘한 곳 또는 냉장 보관',dispatch:'결제 후 2~3영업일 출고'},
    {id:'potato',name:'포근한 밤고구마',type:'채소',farmer:'f2',price:18000,unit:'3kg · 혼합 크기',stock:12,status:'판매 중',color:'#ece2d5',fruit:'#9a6172',kind:'potato',store:'통풍이 잘 되는 서늘한 곳에 보관',dispatch:'결제 후 2영업일 출고'},
    {id:'mandarin',name:'햇살 담은 감귤',type:'과일',farmer:'f3',price:22000,unit:'3kg · 소과',stock:10,status:'판매 중',color:'#f4e9cb',fruit:'#de8a27',kind:'orange',store:'통풍이 잘 되는 곳에 보관',dispatch:'결제 후 2~4영업일 출고'},
    {id:'cabbage',name:'속이 꽉 찬 배추',type:'채소',farmer:'f2',price:16000,unit:'2포기 · 약 5kg',stock:6,status:'판매 중',color:'#e2e8cf',fruit:'#78915c',kind:'cabbage',store:'신문지에 싸서 냉장 보관',dispatch:'결제 후 2영업일 출고'},
    {id:'pear',name:'달고 시원한 배',type:'과일',farmer:'f1',price:28000,unit:'3kg · 5~6과',stock:0,status:'품절',color:'#ece6cd',fruit:'#bb9a58',kind:'pear',store:'개별 포장하여 냉장 보관',dispatch:'재입고 일정 준비 중'},
    {id:'carrot',name:'겨울을 기다리는 당근',type:'채소',farmer:'f3',price:14000,unit:'2kg · 혼합 크기',stock:0,status:'수확 예정',color:'#e7e6d5',fruit:'#ce773c',kind:'carrot',store:'물기를 제거하고 냉장 보관',dispatch:'수확 후 출고 일정 안내 예정'}
  ];
  products.push(
    {id:'tomato',name:'탱글탱글 완숙 토마토',type:'채소',farmer:'example-4',price:19000,unit:'2kg · 중과',stock:15,status:'판매 중',color:'#eeded4',fruit:'#c65a42',kind:'tomato',store:'직사광선을 피하고 서늘하게 보관',dispatch:'결제 후 2영업일 출고'},
    {id:'white-potato',name:'포슬포슬 수미감자',type:'채소',farmer:'example-5',price:17000,unit:'3kg · 혼합 크기',stock:20,status:'판매 중',color:'#ece5d6',fruit:'#bca071',kind:'white-potato',store:'빛을 피해 서늘하고 통풍이 잘 되는 곳에 보관',dispatch:'결제 후 2~3영업일 출고'},
    {id:'strawberry',name:'향긋한 설향 딸기',type:'과일',farmer:'example-6',price:23000,unit:'1kg · 2팩',stock:10,status:'판매 중',color:'#f0dfe0',fruit:'#c95055',kind:'strawberry',store:'세척하지 않은 상태로 냉장 보관',dispatch:'결제 후 2영업일 출고'},
    {id:'pepper',name:'싱싱한 풋고추',type:'채소',farmer:'example-7',price:12000,unit:'1kg · 혼합 크기',stock:18,status:'판매 중',color:'#e3e8d5',fruit:'#5e8555',kind:'pepper',store:'물기를 제거한 뒤 냉장 보관',dispatch:'결제 후 2영업일 출고'},
    {id:'peach',name:'다음 계절의 복숭아',type:'과일',farmer:'example-8',price:26000,unit:'2kg · 6~8과',stock:0,status:'수확 예정',color:'#f2e1d7',fruit:'#d98a7f',kind:'peach',store:'서늘한 곳에 두고 익은 뒤 냉장 보관',dispatch:'다음 수확 후 출고 일정 안내 예정'},
    {id:'lettuce',name:'아삭아삭 청상추',type:'채소',farmer:'example-9',price:9000,unit:'500g · 1봉',stock:16,status:'판매 중',color:'#e1e9d2',fruit:'#6e945b',kind:'lettuce',store:'물기를 제거해 밀폐 후 냉장 보관',dispatch:'결제 후 2영업일 출고'},
    {id:'naju-pear',name:'과즙 가득 나주 배',type:'과일',farmer:'example-10',price:29000,unit:'3kg · 5~6과',stock:12,status:'판매 중',color:'#ece6cd',fruit:'#bb9a58',kind:'pear',store:'개별 포장하여 냉장 보관',dispatch:'결제 후 2~3영업일 출고'}
  );
  function normalize(cart) {
    if(!Array.isArray(cart)) return [];
    const counts = new Map();
    for(const row of cart) {
      const p=products.find(p=>p.id===row?.id);
      if(!p || !Number.isInteger(row.qty) || row.qty<1 || !p.stock) continue;
      counts.set(p.id,Math.min(p.stock,(counts.get(p.id)||0)+row.qty));
    }
    return [...counts].map(([id,qty])=>({id,qty}));
  }
  function totals(cart) {
    const valid=normalize(cart);
    const groups=farmers.map(f=>{
      const rows=valid.map(r=>({...r,product:products.find(p=>p.id===r.id)})).filter(r=>r.product.farmer===f.id);
      const subtotal=rows.reduce((s,r)=>s+r.qty*r.product.price,0);
      return {farmer:f,rows,subtotal,shipping:rows.length && subtotal<f.freeAt?f.fee:0};
    }).filter(g=>g.rows.length);
    const subtotal=groups.reduce((s,g)=>s+g.subtotal,0), shipping=groups.reduce((s,g)=>s+g.shipping,0);
    return {groups,subtotal,shipping,total:subtotal+shipping};
  }
  const api={farmers,products,normalize,totals};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.Market=api;
})(typeof globalThis!=='undefined'?globalThis:this);
