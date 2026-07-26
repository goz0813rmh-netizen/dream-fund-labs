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

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'AI相談の接続設定がありません'});
  const {message,monthlyBudget}=req.body||{};
  if(!message||typeof message!=='string')return res.status(400).json({error:'相談内容を入力してください'});
  const budget=Number(monthlyBudget)||6600;
  const prompt=`あなたは個人投資アプリ Dream Fund Labs の投資相談パートナーです。ユーザーの投資判断を育てるため、断定ではなく比較と理由を示してください。\n\nルール:\n- 相談文に具体的な予算があれば、その金額を月上限より優先する\n- 月の上限は ${budget.toLocaleString('ja-JP')}円\n- Dream20に限定せず、市場全体から考える\n- 最新株価を確認できない銘柄について、購入株数や購入可能性を断定しない\n- 予算内で現実的な選択肢、見送る選択肢、確認すべき点を短く示す\n- スマホで読みやすい日本語にする\n- 最初に相談意図を一文で捉える\n\n相談: ${message}`;
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},
      body:JSON.stringify({model:'gpt-5-mini',input:prompt,max_output_tokens:900})
    });
    const data=await response.json();
    if(!response.ok){
      console.error('consult api error',response.status,data?.error);
      return res.status(response.status).json({error:data?.error?.message||'AI相談に接続できませんでした'});
    }
    const answer=extractText(data);
    if(!answer){
      console.error('consult empty response',JSON.stringify(data).slice(0,1000));
      return res.status(502).json({error:'回答本文を取得できませんでした。もう一度お試しください'});
    }
    return res.status(200).json({answer});
  }catch(error){
    console.error('consult connection failed',error);
    return res.status(500).json({error:'AI相談への接続に失敗しました'});
  }
}