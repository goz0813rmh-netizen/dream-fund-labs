const ALLOWED_TICKER=/^[A-Z][A-Z0-9.-]{0,9}$/;

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  if(!process.env.POLYGON_API_KEY)return res.status(503).json({error:'Market data is not connected yet'});

  const ticker=String(req.query?.symbol||'OKLO').trim().toUpperCase();
  if(!ALLOWED_TICKER.test(ticker))return res.status(400).json({error:'Invalid symbol'});

  try{
    const polygonUrl=`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${encodeURIComponent(process.env.POLYGON_API_KEY)}`;
    const fxUrl='https://api.frankfurter.dev/v2/rate/USD/JPY';
    const [stockResponse,fxResponse]=await Promise.all([fetch(polygonUrl),fetch(fxUrl)]);
    const [stockData,fxData]=await Promise.all([stockResponse.json(),fxResponse.json()]);

    if(!stockResponse.ok){
      return res.status(stockResponse.status).json({error:stockData?.error||stockData?.message||'Stock price request failed'});
    }
    if(!fxResponse.ok){
      return res.status(fxResponse.status).json({error:fxData?.message||'FX request failed'});
    }

    const bar=stockData?.results?.[0];
    const stockPriceUsd=Number(bar?.c);
    const usdJpy=Number(fxData?.rate);
    if(!Number.isFinite(stockPriceUsd)||!Number.isFinite(usdJpy)){
      return res.status(502).json({error:'Market data response was incomplete'});
    }

    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=1800');
    return res.status(200).json({
      ticker,
      stockPriceUsd,
      usdJpy,
      stockPriceAsOf:bar?.t?new Date(bar.t).toISOString():null,
      fxAsOf:fxData?.date||null,
      fetchedAt:new Date().toISOString(),
      source:{stock:'Polygon previous close',fx:'Frankfurter'}
    });
  }catch(error){
    console.error('market quote failed',error);
    return res.status(500).json({error:'Market data connection failed'});
  }
}
