function extractText(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
  const parts=[];
  for(const item of data?.output||[])for(const content of item?.content||[]){
    if(typeof content?.text==='string'&&content.text.trim())parts.push(content.text.trim());
    else if(typeof content?.text?.value==='string'&&content.text.value.trim())parts.push(content.text.value.trim());
  }
  return parts.join('\n\n').trim();
}
function localAdvice(message,budget){
  const amountMatch=String(message).replace(/,/g,'').match(/(\d+(?:\.\d+)?)\s*(万円|千円|円)/);
  const amount=amountMatch?Math.round(Number(amountMatch[1])*(amountMatch[2]==='万円'?10000:amountMatch[2]==='千円'?1000:1)):budget;
  return `今回は${amount.toLocaleString('ja-JP')}円での買い方を考えます。\n\n少額で買い増す場合は、手数料と1株価格を先に確認し、予算内で買える銘柄だけを比較するのが現実的です。候補が決まっているなら銘柄名を入れてください。購入可能性と見送る理由を整理します。`;
}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const {message,monthlyBudget}=req.body||{};
  if(!message||typeof message!=='string')return res.status(400).json({error:'相談内容を入力してください'});
  const budget=Number(monthlyBudget)||5000;
  if(!process.env.OPENAI_API_KEY)return res.status(200).json({answer:localAdvice(message,budget),fallback:true});
  const prompt=`あなたは個人投資アプリ Dream Fund Labs の投資相談パートナーです。断定ではなく、比較と理由を短く示してください。\n月の上限: ${budget.toLocaleString('ja-JP')}円\n相談: ${message}`;
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:'gpt-5-mini',input:prompt,max_output_tokens:700})});
    const data=await response.json();
    if(!response.ok)return res.status(200).json({answer:localAdvice(message,budget),fallback:true});
    const answer=extractText(data);
    return res.status(200).json({answer:answer||localAdvice(message,budget),fallback:!answer});
  }catch(error){
    return res.status(200).json({answer:localAdvice(message,budget),fallback:true});
  }
}