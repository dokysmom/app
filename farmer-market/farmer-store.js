(function(root){
  'use strict';
  const seed=(typeof module!=='undefined'&&module.exports?require('./domain.js'):root.Market).farmers;
  const KEY='farmer-market-demo-profiles-v1';
  const defaults=()=>seed.map((f,i)=>({
    id:f.id,name:f.name,person:'',
    region:f.region,
    crops:seed[i].crops,
    story:f.story,
    photo:'',published:true,order:i+1,example:true
  }));
  function isOriginalSeed(rows){
    const legacy=[
      {id:'f1',name:'햇살농장',region:'경북 영주',story:'계절의 변화를 살피며 사과와 채소를 돌보는 예시 농장입니다.'},
      {id:'f2',name:'들녘농장',region:'전남 해남',story:'땅의 속도에 맞춰 뿌리채소를 키우는 예시 농장입니다.'},
      {id:'f3',name:'바람농장',region:'제주 서귀포',story:'바람과 햇살을 담아 제철 과일을 준비하는 예시 농장입니다.'}
    ];
    return rows.length===legacy.length&&legacy.every((f,i)=>{
      const r=rows.find(r=>r.id===f.id);
      return r&&r.name===f.name&&r.region===f.region&&r.story===f.story&&!r.person&&!r.crops&&!r.photo&&r.published&&r.example&&r.order===i+1;
    });
  }
  function validate(row){
    if(!row||typeof row!=='object')throw new Error('농부 정보를 확인해주세요.');
    const text=(key,max,required=false)=>{const value=String(row[key]??'').trim();if(required&&!value)throw new Error(`${{name:'농장명',region:'지역',story:'소개'}[key]}을 입력해주세요.`);if(value.length>max)throw new Error('입력한 내용이 허용 길이를 초과했습니다.');return value;};
    const order=Number(row.order);
    if(!Number.isInteger(order)||order<1||order>99999)throw new Error('표시 순서는 1~99999 사이 정수로 입력해주세요.');
    const photo=String(row.photo||'');
    if(photo&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))throw new Error('JPG·PNG·WebP 사진만 사용할 수 있습니다.');
    if(photo.length>1450000)throw new Error('사진은 1MB 이하로 선택해주세요.');
    return {id:String(row.id||''),name:text('name',60,true),person:text('person',40),region:text('region',80,true),crops:text('crops',120),story:text('story',1200,true),photo,published:row.published===true,order,example:row.example===true};
  }
  function select(rows,{query='',publishedOnly=false,page=1,pageSize=9}={}){
    const q=query.trim().toLocaleLowerCase('ko');
    const matched=rows.filter(f=>(!publishedOnly||f.published)&&(!q||[f.name,f.person,f.region,f.crops].some(s=>s.toLocaleLowerCase('ko').includes(q)))).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
    const pages=Math.max(1,Math.ceil(matched.length/pageSize));
    const current=Math.min(pages,Math.max(1,Number.isInteger(Number(page))?Number(page):1));
    return {rows:matched.slice((current-1)*pageSize,current*pageSize),total:matched.length,pages,page:current};
  }
  function create(storage){
    let rows=defaults(),recovered=false;
    try{const raw=storage.getItem(KEY);if(raw!==null){const parsed=JSON.parse(raw);if(!Array.isArray(parsed))throw new Error();const seen=new Set();rows=parsed.map(x=>{const row=validate(x);if(!/^[a-zA-Z0-9_-]+$/.test(row.id)||seen.has(row.id))throw new Error();seen.add(row.id);return row;});}}catch{rows=defaults();recovered=true;}
    // Upgrade only the untouched original three examples; preserve operator edits.
    if(isOriginalSeed(rows)){
      rows=defaults();
      try{storage.setItem(KEY,JSON.stringify(rows));}catch{/* Show the new examples even when persistent storage is unavailable. */}
    }
    function commit(next){try{storage.setItem(KEY,JSON.stringify(next));}catch{throw new Error('브라우저 저장 공간이 부족하거나 저장이 차단됐습니다. 사진 크기를 줄인 뒤 다시 저장해주세요.');}rows=next;}
    return {
      recovered,
      list:()=>rows.map(r=>({...r})),
      get:id=>{const row=rows.find(r=>r.id===id);return row?{...row}:null;},
      save(input){const isNew=!input.id;const id=input.id||('farmer-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9));if(!isNew&&!rows.some(r=>r.id===id))throw new Error('농부를 찾을 수 없습니다.');const row=validate({...input,id});const next=isNew?[...rows,row]:rows.map(r=>r.id===id?row:r);commit(next);return {...row};},
      remove(id){if(seed.some(f=>f.id===id))throw new Error('예시 판매 상품에 연결된 농장은 삭제 대신 소개를 비공개로 설정해주세요.');if(!rows.some(r=>r.id===id))throw new Error('농부를 찾을 수 없습니다.');commit(rows.filter(r=>r.id!==id));}
    };
  }
  const api={create,validate,select,defaults};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FarmerStore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
