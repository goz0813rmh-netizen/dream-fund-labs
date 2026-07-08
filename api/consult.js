export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'AI is not connected yet'});
  const {message,monthlyBudget}=req.body||{};
  if(!message||typeof message!=='string')return res.status(400).json({error:'Message is required'});
  const prompt=`あなたは個人投資アプリ Dream Fund Labs の投資相談パートナー。ユーザー本人のための相談相手として答える。\n\nルール:\n- 相談文に具体的な予算があれば、それを月上限より優先する\n- Dream20に限定せず、市場全体から考える\n- 銘柄を挙げるなら、最新株価を確認できていない場合は断定しない\n- 予算内で何株買えるか、合計金額まで示す方向で答える\n- 短く、スマホで読みやすくする\n- 「投資は自己責任」など定型文を毎回長く書かない\n- まず相談意図を一文で捉え、その後に具体案を出す\n\n月の上限: ${Number(monthlyBudget)||5000}円\n相談: ${message}`;
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:'gpt-5-mini',input:prompt,max_output_tokens:700})});
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json({error:data?.error?.message||'AI request failed'});
    const text=data.output_text||data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;
    return res.status(200).json({answer:text||'回答を作れませんでした。'});
  }catch(e){return res.status(500).json({error:'AI connection failed'});}
}