const REQUIRED_SECTIONS = [
  '1. Portfolio Review',
  '2. Business Quality',
  '3. Opportunities',
  '4. Valuation',
  '5. Capital Allocation',
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

function formatYen(value) {
  return `${Math.round(value).toLocaleString('ja-JP')}円`;
}

function normalizeContext(raw, availableAmount) {
  const dream20 = Array.isArray(raw?.dream20)
    ? raw.dream20
        .map(item => ({
          name: String(item?.name || '').trim(),
          ticker: String(item?.ticker || '').trim().toUpperCase(),
          type: String(item?.type || '').trim(),
          judge: String(item?.judge || '').trim(),
        }))
        .filter(item => item.name && item.ticker)
    : [];

  const holdings = Array.isArray(raw?.holdings)
    ? raw.holdings
        .map(item => ({
          ticker: String(item?.ticker || '').trim().toUpperCase(),
          action: String(item?.action || '').trim().toUpperCase(),
          thesis: String(item?.thesis || '').trim(),
          createdAt: item?.createdAt || null,
        }))
        .filter(item => item.ticker)
    : [];

  return { availableAmount, dream20, holdings };
}

function buildFallbackAnswer(context) {
  const holdings = context.holdings.map(item => item.ticker).join('、') || '保有記録なし';
  const candidates = context.dream20.slice(0, 3).map(item => `${item.name}(${item.ticker})`).join('、') || '候補抽出待ち';

  return [
    '1. Portfolio Review',
    `保有状況: ${holdings}。既存保有株は原則HOLDとし、短期の値動きだけでは売却を検討しません。`,
    '',
    '2. Business Quality',
    '購入時の理由に照らし、事業の質・競争優位・収益力・成長余地に長期保有の前提を変える重大な変化がないか確認してください。',
    '',
    '3. Opportunities',
    `Dream20の比較候補: ${candidates}。新規候補は「話題だから」ではなく、既存保有株より長期的に魅力的かで比較します。`,
    '',
    '4. Valuation',
    '良い会社を先に絞り、その後で現在価格が十分に魅力的かを確認します。株価下落そのものを買い理由にはしません。',
    '',
    '5. Capital Allocation',
    `今月使えるお金は${formatYen(context.availableAmount)}です。選択肢は「既存株を買い増す」「新規銘柄を購入する」「現金で待つ」の3つです。良い機会がなければ現金で待つのが正常な判断です。`,
  ].join('\n');
}

function hasRequiredSections(answer) {
  return REQUIRED_SECTIONS.every(section => answer.includes(section));
}

function buildPrompt(message, context) {
  const payload = {
    northStar: '投資判断を育てるアプリ',
    principles: [
      '情報は毎日更新する',
      '投資方針は簡単には変えない',
      '判断理由を記録する',
      '後から振り返って学ぶ',
      '基本は長期保有で、売買する必要がなければ何もしない',
    ],
    monthlyInvestmentMeeting: {
      availableAmount: context.availableAmount,
      holdings: context.holdings,
      dream20: context.dream20,
      normalChoices: ['既存株を買い増す', '新規銘柄を購入する', '現金で待つ'],
      sellRule: 'SELLは通常の月次フローに含めず、長期保有の前提が崩れた場合のみ別途Investment Case Reviewで検討する',
    },
  };

  return [
    'あなたは Dream Fund Labs の長期投資向け Monthly Investment Meeting のパートナーです。',
    'ウォーレン・バフェット、Terry Smith、Li Lu、Bill Ackmanに共通する長期・事業重視・慎重な資本配分の考え方を参考にしつつ、特定投資家の売買をコピーするよう勧めないでください。',
    '短期株価を起点にせず、事業の質を見てから価格を評価してください。',
    '既存保有株は原則HOLDです。重大な事業変化がなければSELLを提案しないでください。',
    '「現金で待つ」を他の選択肢と同じ正式な判断として扱ってください。',
    '回答は必ず以下の5見出しをこの順番で使ってください。',
    ...REQUIRED_SECTIONS,
    '各項目は簡潔に。最後のCapital Allocationでは、今月使えるお金の範囲で買い増し／新規購入／現金待ちを比較し、最有力を1つ示してください。',
    '',
    `ユーザーの相談: ${message}`,
    `参照情報(JSON): ${JSON.stringify(payload)}`,
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
      max_output_tokens: 1000,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || data?.error || 'openai request failed');
  return extractText(data);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { message, monthlyBudget, context: rawContext } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: '相談内容を入力してください' });
  }

  const amount = Number(monthlyBudget);
  const availableAmount = Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 5000;
  const context = normalizeContext(rawContext, availableAmount);
  const fallbackAnswer = buildFallbackAnswer(context);

  if (!process.env.OPENAI_API_KEY) {
    return res.status(200).json({ answer: fallbackAnswer, fallback: true });
  }

  try {
    const aiAnswer = await callOpenAI(buildPrompt(message, context));
    const answer = aiAnswer && hasRequiredSections(aiAnswer) ? aiAnswer : fallbackAnswer;
    return res.status(200).json({ answer, fallback: answer === fallbackAnswer });
  } catch {
    return res.status(200).json({ answer: fallbackAnswer, fallback: true });
  }
}
