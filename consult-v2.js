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
    const monthlyDefault=Number(localStorage.getItem('dfl-monthly-budget'))||5000;
    const carryover=Math.max(0,Number(localStorage.getItem('dfl-investment-carryover'))||0);
    const now=new Date();
    const month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    try{
      const meetings=JSON.parse(localStorage.getItem('dfl-monthly-investment-meetings')||'{}');
      const current=meetings?.[month];
      if(current){
        const remaining=Number(current.remainingAmount);
        return Number.isFinite(remaining)&&remaining>=0?remaining:0;
      }
    }catch{}

    const total=monthlyDefault+carryover;
    return Number.isFinite(total)&&total>=0?Math.round(total):5000;
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
      answer.textContent=`1. Portfolio Review\n保有株は原則HOLDです。短期の値動きではなく、長期保有の前提に重大な変化があるかを確認します。\n\n2. Business Quality\n事業の質・競争優位・収益力・成長余地に構造的な変化がないか確認します。\n\n3. Opportunities\nDream20から、既存保有株より魅力的な投資機会があるか比較します。\n\n4. Valuation\n良い会社を絞った後で、現在価格が買いたい水準か確認します。\n\n5. Capital Allocation\n今月使えるお金は${budget.toLocaleString('ja-JP')}円です。買い増し／新規購入／現金で待つ、の3択で考えます。通信失敗中のため、確定前に最新情報を再確認してください。`;
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
