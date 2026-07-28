const REQUIRED_SECTIONS = [
  '1. 結論',
  '2. 根拠',
  '3. リスク',
  '4. 今月のおすすめアクション',
  '5. Decision Journalへ残すべき内容',
];

function extractText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string' && content.text.trim()) parts.push(content.text.trim());
      else if (typeof content?.text?.value === 'string' && content.text.value.trim()) parts.push(content.text.value.trim());
    }
  }
  return parts.join('\n\n').trim();
}

function parseAmountFromMessage(message, budget) {
  const amountMatch = String(message).replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(万円|千円|円)/);
  if (!amountMatch) return budget;
  const unit = amountMatch[2] === '万円' ? 10000 : amountMatch[2] === '千円' ? 1000 : 1;
  return Math.max(0, Math.round(Number(amountMatch[1]) * unit));
}

function formatYen(value) {
  return `${Math.round(value).toLocaleString('ja-JP')}円`;
}

function normalizeContext(raw, budget) {
  const dream20 = Array.isArray(raw?.dream20)
    ? raw.dream20
        .map((item) => ({
          name: String(item?.name || '').trim(),
          ticker: String(item?.ticker || '').trim().toUpperCase(),
          type: String(item?.type || '').trim(),
          judge: String(item?.judge || '').trim(),
        }))
        .filter((item) => item.name && item.ticker)
    : [];

  const holdings = Array.isArray(raw?.holdings)
    ? raw.holdings
        .map((item) => ({
          ticker: String(item?.ticker || '').trim().toUpperCase(),
          action: String(item?.action || '').trim().toUpperCase(),
          thesis: String(item?.thesis || '').trim(),
          createdAt: item?.createdAt || null,
        }))
        .filter((item) => item.ticker)
    : [];

  const watch = raw?.decisionWatch && typeof raw.decisionWatch === 'object'
    ? {
        ticker: String(raw.decisionWatch.ticker || 'OKLO').toUpperCase(),
        status: String(raw.decisionWatch.status || 'STALE').toUpperCase(),
        estimatedRequiredJpy: Number(raw.decisionWatch.estimatedRequiredJpy),
        stockPriceUsd: Number(raw.decisionWatch.stockPriceUsd),
        usdJpy: Number(raw.decisionWatch.usdJpy),
        updatedAt: raw.decisionWatch.updatedAt || null,
        purchasedAt: raw.decisionWatch.purchasedAt || null,
      }
    : null;

  return {
    monthlyBudget: budget,
    dream20,
    holdings,
    decisionWatch: watch,
  };
}

function toWatchLabel(watch, budget) {
  if (!watch) return '未取得';
  if (watch.purchasedAt) return '購入済み';
  if (watch.status === 'READY') return '購入可能';
  if (watch.status === 'WAITING') return '購入不可';
  if (Number.isFinite(watch.estimatedRequiredJpy)) {
    return watch.estimatedRequiredJpy <= budget ? '購入可能（推定）' : '購入不可（推定）';
  }
  return '確認中';
}

function buildFallbackAnswer(message, context) {
  const budget = context.monthlyBudget;
  const requested = parseAmountFromMessage(message, budget);
  const useBudget = Math.min(requested || budget, budget);

  const watch = context.decisionWatch;
  const watchLabel = toWatchLabel(watch, budget);
  const watchCost = Number.isFinite(watch?.estimatedRequiredJpy) ? formatYen(watch.estimatedRequiredJpy) : '未取得';
  const watchPrice = Number.isFinite(watch?.stockPriceUsd) ? `${watch.stockPriceUsd.toFixed(2)} USD` : '未取得';
  const watchFx = Number.isFinite(watch?.usdJpy) ? `${watch.usdJpy.toFixed(2)}円` : '未取得';

  const affordableDream20 = context.dream20.filter((item) => {
    const isStable = item.type === 'stable';
    const isPositiveJudge = /買い候補|注目|保有継続/.test(item.judge);
    return isStable || isPositiveJudge;
  });

  const dream20Head = affordableDream20.slice(0, 3).map((item) => `${item.name}(${item.ticker})`).join('、') || '候補抽出待ち';
  const holdingHead = context.holdings.slice(0, 3).map((item) => item.ticker).join('、') || 'なし';

  const conclusion = watchLabel === '購入可能'
    ? `今月は上限${formatYen(budget)}の範囲で、まず1銘柄を少額で買う判断が妥当です。`
    : `今月は上限${formatYen(budget)}を守り、無理な買いを避けて候補比較を優先する判断が妥当です。`;

  const basis = `月上限は${formatYen(budget)}（相談金額: ${formatYen(useBudget)}）です。Dream20候補は${context.dream20.length}件あり、優先候補は${dream20Head}です。保有銘柄は${holdingHead}を参照し、Decision Watchは${watchLabel}（${watch?.ticker || 'OKLO'} 推定必要額: ${watchCost} / 株価: ${watchPrice} / USDJPY: ${watchFx}）です。`;

  const risk = watchLabel === '購入可能'
    ? '直近価格・為替は日次で変動するため、約定時に予算超過になる可能性があります。買値を追いかけず、上限超過時は見送りに切り替えてください。'
    : 'Decision Watchが購入不可/確認中のときに感情で買うと、方針逸脱や高値づかみのリスクがあります。最新価格の再確認なしでの注文は避けてください。';

  const action = watchLabel === '購入可能'
    ? `今月は①優先候補から1銘柄に絞る ②${formatYen(useBudget)}以内で1回だけ発注する ③約定後は追い買いせず、次回判断日を決める。`
    : `今月は①Decision Watchを更新して購入可否を再確認 ②Dream20の優先候補を最大2銘柄まで比較 ③今月は見送りも選択肢に含めて判断を固定する。`;

  const journal = '記録する内容: (a) 買う/見送る結論 (b) 月上限との整合 (c) Dream20からその銘柄を選んだ理由 (d) 保有銘柄との重複リスク (e) 次に見直す価格・為替・条件。';

  return [
    '1. 結論',
    conclusion,
    '',
    '2. 根拠',
    basis,
    '',
    '3. リスク',
    risk,
    '',
    '4. 今月のおすすめアクション',
    action,
    '',
    '5. Decision Journalへ残すべき内容',
    journal,
  ].join('\n');
}

function hasRequiredSections(answer) {
  return REQUIRED_SECTIONS.every((section) => answer.includes(section));
}

function buildPrompt(message, context) {
  const watch = context.decisionWatch;
  const watchSummary = watch
    ? {
        ticker: watch.ticker,
        status: toWatchLabel(watch, context.monthlyBudget),
        estimatedRequiredJpy: Number.isFinite(watch.estimatedRequiredJpy) ? Math.round(watch.estimatedRequiredJpy) : null,
        stockPriceUsd: Number.isFinite(watch.stockPriceUsd) ? watch.stockPriceUsd : null,
        usdJpy: Number.isFinite(watch.usdJpy) ? watch.usdJpy : null,
        updatedAt: watch.updatedAt,
        purchasedAt: watch.purchasedAt,
      }
    : null;

  const contextPayload = {
    monthlyBudget: context.monthlyBudget,
    dream20: context.dream20,
    holdings: context.holdings,
    decisionWatch: watchSummary,
    northStar: '投資判断を育てるアプリ',
    principles: [
      '情報は毎日更新する',
      '投資方針は簡単には変えない',
      '判断理由を記録する',
      '後から振り返って学ぶ',
    ],
  };

  return [
    'あなたは Dream Fund Labs の投資相談パートナーです。',
    'ユーザーの相談に対して「今月どう買う？」の意思決定支援を返してください。',
    '北極星「投資判断を育てるアプリ」を守り、情報は日次更新を使ってよいが投資方針を勝手に変更しないでください。',
    '回答は必ず次の5項目をこの順番・見出しで返してください。',
    '1. 結論',
    '2. 根拠',
    '3. リスク',
    '4. 今月のおすすめアクション',
    '5. Decision Journalへ残すべき内容',
    '簡潔に、断定し過ぎず、比較理由を含めてください。',
    '',
    `相談: ${message}`,
    `参照情報(JSON): ${JSON.stringify(contextPayload)}`,
  ].join('\n');
}

async function callOpenAI(prompt) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ['Auth' + 'orization']: 'Bearer ' + String(process.env.OPENAI_API_KEY || ''),
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      input: prompt,
      max_output_tokens: 900,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || 'openai request failed');
  }

  return extractText(data);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { message, monthlyBudget, context: rawContext } = req.body || {};
  if (!message || typeof message !== 'string') return res.status(400).json({ error: '相談内容を入力してください' });

  const budget = Number(monthlyBudget);
  const safeBudget = Number.isFinite(budget) && budget > 0 ? Math.round(budget) : 5000;
  const context = normalizeContext(rawContext, safeBudget);
  const fallbackAnswer = buildFallbackAnswer(message, context);

  if (!process.env.OPENAI_API_KEY) {
    return res.status(200).json({ answer: fallbackAnswer, fallback: true });
  }

  try {
    const prompt = buildPrompt(message, context);
    const aiAnswer = await callOpenAI(prompt);
    const answer = aiAnswer && hasRequiredSections(aiAnswer) ? aiAnswer : fallbackAnswer;
    return res.status(200).json({ answer, fallback: answer === fallbackAnswer });
  } catch {
    return res.status(200).json({ answer: fallbackAnswer, fallback: true });
  }
}
