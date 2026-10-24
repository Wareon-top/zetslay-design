// Executed inside the existing API container; export only public card fields.
import pg from 'pg';
const ids=[
  'steam-rent','robux-relay','stars-relay','ai-reviews',
  'kosell-rent','roblox-lzt-market','tiktok-lzt-market','ticket-pilot',
  'priority-orders','sales-pause','lot-cloner','mass-price-editor',
  'confirm-reminder','review-reminder','auto-review-bonus'
].map(id=>'zetslay.'+id);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
let client;
try{
  client=await pool.connect();
  await client.query('BEGIN READ ONLY');
  const {rows}=await client.query('SELECT id,metadata FROM plugin_catalog_entries WHERE id=ANY($1::text[])',[ids]);
  const entries=rows.filter(row=>ids.includes(row.id)).map(({id,metadata})=>({id,name:typeof metadata?.name==='string'?metadata.name:'',cover:typeof metadata?.cover==='string'?metadata.cover:'',published:metadata?.published===true}));
  await client.query('COMMIT');
  process.stdout.write(JSON.stringify({entries}));
}catch{
  if(client)await client.query('ROLLBACK').catch(()=>{});
  console.error('Не удалось прочитать публичные карточки плагинов. Главная страница не изменена.');
  process.exitCode=1;
}finally{
  if(client)client.release();
  await pool.end();
}
