function extractText(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
  const parts=[];
  for(const item of data?.output||[]){
    for(const content of item?.content||[]){
      if(typeof content?.text==='string'&&content.text.trim())parts.push(content.text.trim());
      else if(typeof content?.text?.value==='string'&&content.text.value.trim())parts.push(content.text.value.trim());
    }
  }
  return parts.join('\n\n').trim();
}

function localAnswer(message,budget){
  const normalized=String(message).replace(/,/g,'');
  const match=normalized.match(/(\d+(?:\.\d+)?)\s*(万円|千円|円)/);
  const requested=match?Math.round(Number(match[1])*(match[2]==='万円'?10000:match[2]==='千円'?1000:1)):budget;
  const amount=requested.toLocaleString('ja-JP');
  const wantsLeap=/飛躍|爆発|成長|ハイリスク|一株/.test(message);
  const mentionsOklo=/oklo|オクロ/i.test(message);
  const lines=[`相談意図：${amount}円の範囲で、今月の買い方を決めたい。`,''];
  if(mentionsOklo){
    lines.push('現時点では、Decision Watchの推定必要額と今月の上限を比較して判断するのがよいです。購入可能と表示されるまでは、入金ルールを変えずに待つ案が一貫しています。');
  }else if(wantsLeap){
    lines.push('飛躍枠は値動きが大きいため、1銘柄に全額を使うより「今月は見送る」「少額で買える候補だけ調べる」の2案を比較するのが現実的です。');
  }else{
    lines.push('まずは、今月の上限内で買える候補と、無理に買わず翌月へ持ち越す案を並べて比較するのがよいです。');
  }
  lines.push('','確認すること：最新株価、1株あたりの必要額、保有銘柄との重複、買う理由が価格だけになっていないか。');
  lines.push('','AI接続が復旧すると、候補銘柄まで含めてより具体的に比較します。');
  return lines.join('\n');
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const {message,monthlyBudget}=req.body||{};
  if(!message||typeof message!=='string')return res.status(400).json({error:'相談内容を入力してください'});
  const budget=Number(monthlyBudget)||6600;
  const fallback=localAnswer(message,budget);
  if(!process.env.OPENAI_API_KEY)return res.status(200).json({answer:fallback,source:'local'});

  const prompt=`あなたは個人投資アプリ Dream Fund Labs の投資相談パートナーです。ユーザーの投資判断を育てるため、断定ではなく比較と理由を示してください。\n\nルール:\n- 相談文に具体的な予算があれば、その金額を月上限より優先する\n- 月の上限は ${budget.toLocaleString('ja-JP')}円\n- Dream20に限定せず、市場全体から考える\n- 最新株価を確認できない銘柄について、購入株数や購入可能性を断定しない\n- 予算内で現実的な選択肢、見送る選択肢、確認すべき点を短く示す\n- スマホで読みやすい日本語にする\n- 最初に相談意図を一文で捉える\n\n相談: ${message}`;
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},
      body:JSON.stringify({model:'gpt-5-mini',input:prompt,max_output_tokens:900})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      console.error('consult api error',response.status,data?.error);
      return res.status(200).json({answer:fallback,source:'local',warning:data?.error?.message||'AI相談に接続できませんでした'});
    }
    const answer=extractText(data);
    if(!answer){
      console.error('consult empty response',JSON.stringify(data).slice(0,1000));
      return res.status(200).json({answer:fallback,source:'local',warning:'回答本文を取得できませんでした'});
    }
    return res.status(200).json({answer,source:'openai'});
  }catch(error){
    console.error('consult connection failed',error);
    return res.status(200).json({answer:fallback,source:'local',warning:'AI相談への接続に失敗しました'});
  }
}