(()=>{
  const DECISIONS_STORAGE_KEY='dream_fund_decisions';
  const WATCH_STORAGE_KEY='dream_fund_purchase_alerts';

  const thread=document.querySelector('#consultThread');
  const user=document.querySelector('#userMessage');
  const answer=document.querySelector('#assistantMessage');
  const again=document.querySelector('#newConsult');
  const send=document.querySelector('#sendConsult');
  const input=document.querySelector('#consultInput');

  const readJSON=(key,fallback)=>{
    try{
      const parsed=JSON.parse(localStorage.getItem(key)||'');
      return parsed??fallback;
    }catch{
      return fallback;
    }
  };

  function getMonthlyBudget(){
    const monthlyBudget=Number(localStorage.getItem('dfl-monthly-budget'))||5000;
    return Number.isFinite(monthlyBudget)&&monthlyBudget>0?monthlyBudget:5000;
  }

  function getDream20(){
    if(Array.isArray(window.dream20Stocks)&&window.dream20Stocks.length){
      return window.dream20Stocks.map(stock=>({
        name:String(stock?.name||''),
        ticker:String(stock?.ticker||''),
        type:String(stock?.type||''),
        judge:String(stock?.judge||''),
      })).filter(stock=>stock.name&&stock.ticker);
    }
    return [];
  }

  function getHoldings(){
    const decisions=readJSON(DECISIONS_STORAGE_KEY,[]);
    if(!Array.isArray(decisions))return [];

    const latestByTicker=new Map();
    for(const decision of decisions){
      const ticker=String(decision?.ticker||'').trim().toUpperCase();
      if(!ticker)continue;
      const current=latestByTicker.get(ticker);
      const createdAt=Date.parse(decision?.createdAt||'');
      const currentAt=Date.parse(current?.createdAt||'');
      if(!current||(!Number.isNaN(createdAt)&&createdAt>=currentAt)){
        latestByTicker.set(ticker,decision);
      }
    }

    return Array.from(latestByTicker.values())
      .filter(decision=>decision?.action==='BUY'||decision?.action==='HOLD')
      .map(decision=>({
        ticker:String(decision.ticker||'').toUpperCase(),
        action:String(decision.action||''),
        thesis:String(decision.thesis||''),
        createdAt:decision.createdAt||null,
      }));
  }

  function getDecisionWatch(){
    const list=readJSON(WATCH_STORAGE_KEY,[]);
    const watch=Array.isArray(list)?list[0]:null;
    if(!watch||typeof watch!=='object')return null;

    return {
      ticker:watch.ticker||'OKLO',
      status:watch.status||null,
      estimatedRequiredJpy:Number.isFinite(Number(watch.estimatedRequiredJpy))?Number(watch.estimatedRequiredJpy):null,
      stockPriceUsd:Number.isFinite(Number(watch.stockPriceUsd))?Number(watch.stockPriceUsd):null,
      usdJpy:Number.isFinite(Number(watch.usdJpy))?Number(watch.usdJpy):null,
      updatedAt:watch.updatedAt||null,
      purchasedAt:watch.purchasedAt||null,
    };
  }

  async function askAI(text){
    const monthlyBudget=getMonthlyBudget();
    const context={
      dream20:getDream20(),
      holdings:getHoldings(),
      decisionWatch:getDecisionWatch(),
    };

    const response=await fetch('/api/consult',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:text,monthlyBudget,context}),
    });

    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error||'相談に接続できませんでした');
    if(!data.answer)throw new Error('回答本文を取得できませんでした');
    return data.answer;
  }

  send.onclick=async()=>{
    const text=input.value.trim();
    if(!text){
      input.focus();
      return;
    }

    user.textContent=text;
    thread.hidden=false;
    input.closest('.consult-input-wrap').hidden=true;
    again.hidden=true;
    send.disabled=true;
    answer.innerHTML='<div class="thinking"><span></span><span></span><span></span></div>';

    try{
      answer.textContent=await askAI(text);
    }catch{
      const budget=getMonthlyBudget();
      answer.textContent=`1. 結論\n今月は${budget.toLocaleString('ja-JP')}円の上限内で、候補を絞って少額で確認的に買う進め方が安全です。\n\n2. 根拠\n月上限を守ると無理な買いを避けやすく、Dream20・保有状況・購入可否を見ながら判断の質を保てます。\n\n3. リスク\n通信失敗中は最新の個別データ反映が不完全な可能性があります。最終的な注文前に価格と購入可否を再確認してください。\n\n4. 今月のおすすめアクション\n相談文に銘柄名と希望金額を追記して再送し、予算内での候補比較を確定しましょう。\n\n5. Decision Journalへ残すべき内容\n選んだ銘柄、判断理由、見送った理由、確認したリスク、次回の見直し条件。`;
    }finally{
      again.hidden=false;
      send.disabled=false;
    }
  };

  again.hidden=true;
  again.onclick=()=>{
    thread.hidden=true;
    input.closest('.consult-input-wrap').hidden=false;
    input.value='';
    input.focus();
  };

  const decisionWatch=document.createElement('script');
  decisionWatch.src='/decision-watch.js?v=4';
  decisionWatch.defer=true;
  document.head.appendChild(decisionWatch);
})();
