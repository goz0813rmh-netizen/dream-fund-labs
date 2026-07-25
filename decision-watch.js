const STORAGE_KEY='dream_fund_purchase_alerts';
const BUYING_POWER_JPY=6600;
const BUFFER_RATE=1.05;
const FEE_RATE=1.00495;
const STALE_AFTER_MS=36*60*60*1000;

const yen=new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0});
const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const dateTime=new Intl.DateTimeFormat('ja-JP',{dateStyle:'short',timeStyle:'short'});

function mount(){
  if(document.getElementById('decisionWatch'))return;
  const css=document.createElement('link');
  css.rel='stylesheet';css.href='/decision-watch.css?v=1';
  document.head.appendChild(css);
  const section=document.createElement('section');
  section.id='decisionWatch';section.className='decision-watch';section.dataset.status='STALE';
  section.innerHTML='<div class="decision-watch-head"><div><p class="eyebrow">DECISION WATCH</p><h2 id="watchStatus">OKLOを1株買えるまで待機中</h2></div><span class="watch-status-dot" aria-hidden="true"></span></div><p class="decision-watch-reason">入金ルールを変えず、実行可能になるまで待つ。</p><div class="watch-primary"><div><span>買付余力</span><strong id="watchBudget">¥6,600</strong></div><div><span>推計必要額</span><strong id="watchRequired">取得中</strong></div></div><p id="watchGap" class="watch-gap">最新データを取得しています</p><div class="watch-market"><div><span>OKLO 前日終値</span><strong id="watchPrice">—</strong></div><div><span>USD/JPY</span><strong id="watchFx">—</strong></div></div><dl class="watch-meta"><div><dt>最終更新</dt><dd id="watchUpdated">未取得</dd></div><div><dt>再評価期限</dt><dd id="watchExpiry">—</dd></div></dl><p id="watchError" class="watch-error" hidden></p><div class="watch-actions"><button id="refreshWatch" type="button">最新情報に更新</button><button id="enableWatchNotifications" class="secondary" type="button">通知を許可</button></div><p class="watch-note">株価はPolygonの前日終値、為替はFrankfurterの参照値による概算です。実際の注文可否はSBI証券で最終確認してください。</p>';
  const consult=document.querySelector('.consult-card');
  if(consult)consult.insertAdjacentElement('afterend',section);else document.querySelector('.app')?.prepend(section);
}

function plusOneMonth(iso){
  const date=new Date(iso);date.setMonth(date.getMonth()+1);return date.toISOString();
}
function saveAlert(alert){localStorage.setItem(STORAGE_KEY,JSON.stringify([alert]));}
function readAlert(){
  try{const list=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');if(Array.isArray(list)&&list[0])return list[0];}catch(_error){}
  const createdAt=new Date().toISOString();
  const alert={id:'oklo-1-share-6600',ticker:'OKLO',quantity:1,buyingPowerJpy:BUYING_POWER_JPY,broker:'SBI証券',settlement:'JPY',stockPriceUsd:null,usdJpy:null,estimatedRequiredJpy:null,status:'WAITING',reason:'本命のOkloを、入金ルールを変えずに1か月待つ',createdAt,expiresAt:plusOneMonth(createdAt),updatedAt:null,notifiedAt:null};
  saveAlert(alert);return alert;
}
function estimateRequiredJpy(stockPriceUsd,usdJpy){return Math.ceil(stockPriceUsd*usdJpy*BUFFER_RATE*FEE_RATE);}
function deriveStatus(alert){
  if(new Date(alert.expiresAt).getTime()<Date.now())return 'EXPIRED';
  if(!alert.updatedAt||!Number.isFinite(alert.estimatedRequiredJpy))return 'STALE';
  if(Date.now()-new Date(alert.updatedAt).getTime()>STALE_AFTER_MS)return 'STALE';
  return alert.estimatedRequiredJpy<=alert.buyingPowerJpy?'READY':'WAITING';
}
function statusCopy(alert){
  switch(alert.status){
    case 'READY':return{label:'買付可能ラインに到達',detail:`推計必要額 ${yen.format(alert.estimatedRequiredJpy)}`};
    case 'EXPIRED':return{label:'再評価の時期です',detail:'1か月の待機期限を迎えました'};
    case 'STALE':return{label:'データを確認中',detail:'最新データを取得して判定します'};
    default:return{label:'OKLOを1株買えるまで待機中',detail:`あと ${yen.format(Math.max(0,alert.estimatedRequiredJpy-alert.buyingPowerJpy))}`};
  }
}
function render(alert,errorMessage=''){
  const card=document.getElementById('decisionWatch');if(!card)return;
  const copy=statusCopy(alert);card.dataset.status=alert.status;
  document.getElementById('watchStatus').textContent=copy.label;
  document.getElementById('watchGap').textContent=copy.detail;
  document.getElementById('watchBudget').textContent=yen.format(alert.buyingPowerJpy);
  document.getElementById('watchRequired').textContent=Number.isFinite(alert.estimatedRequiredJpy)?yen.format(alert.estimatedRequiredJpy):'取得中';
  document.getElementById('watchPrice').textContent=Number.isFinite(alert.stockPriceUsd)?usd.format(alert.stockPriceUsd):'—';
  document.getElementById('watchFx').textContent=Number.isFinite(alert.usdJpy)?`${alert.usdJpy.toFixed(2)}円`:'—';
  document.getElementById('watchUpdated').textContent=alert.updatedAt?dateTime.format(new Date(alert.updatedAt)):'未取得';
  document.getElementById('watchExpiry').textContent=dateTime.format(new Date(alert.expiresAt));
  const error=document.getElementById('watchError');error.hidden=!errorMessage;error.textContent=errorMessage;
}
async function notifyReady(alert,previousStatus){
  if(previousStatus==='READY'||alert.status!=='READY'||alert.notifiedAt)return alert;
  if(!('Notification'in window)||Notification.permission!=='granted')return alert;
  new Notification('OKLOが買付可能ラインに到達しました',{body:`推計必要額は${yen.format(alert.estimatedRequiredJpy)}です。SBI証券の注文画面で最終確認してください。`});
  alert.notifiedAt=new Date().toISOString();saveAlert(alert);return alert;
}
async function refresh(){
  const button=document.getElementById('refreshWatch');button.disabled=true;button.textContent='更新中…';
  let alert=readAlert();const previousStatus=alert.status;
  try{
    const response=await fetch('/api/market/quote?symbol=OKLO',{headers:{Accept:'application/json'}});const data=await response.json();
    if(!response.ok)throw new Error(data?.error||'市場データを取得できませんでした');
    alert={...alert,stockPriceUsd:Number(data.stockPriceUsd),usdJpy:Number(data.usdJpy),updatedAt:data.fetchedAt||new Date().toISOString()};
    alert.estimatedRequiredJpy=estimateRequiredJpy(alert.stockPriceUsd,alert.usdJpy);alert.status=deriveStatus(alert);saveAlert(alert);render(alert);await notifyReady(alert,previousStatus);
  }catch(error){alert.status='STALE';saveAlert(alert);render(alert,`最新情報を取得できませんでした。${error.message}`);}
  finally{button.disabled=false;button.textContent='最新情報に更新';}
}
function init(){
  mount();const alert=readAlert();alert.status=deriveStatus(alert);saveAlert(alert);render(alert);
  document.getElementById('refreshWatch')?.addEventListener('click',refresh);
  document.getElementById('enableWatchNotifications')?.addEventListener('click',async()=>{if('Notification'in window)await Notification.requestPermission();});
  refresh();
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
