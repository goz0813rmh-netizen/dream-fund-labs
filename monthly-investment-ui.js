import { createDecision } from './services/decisionJournal.js';
import {
  finalizeMonthlyAllocation,
  getMonthlyMeetingState,
} from './services/monthlyInvestment.js';

const yen = value => `¥${Number(value || 0).toLocaleString('ja-JP')}`;

const availableEl = document.querySelector('#meetingAvailable');
const breakdownEl = document.querySelector('#meetingBreakdown');
const statusEl = document.querySelector('#meetingStatus');
const form = document.querySelector('#allocationForm');
const choiceInputs = Array.from(document.querySelectorAll('input[name="allocationChoice"]'));
const tickerWrap = document.querySelector('#allocationTickerWrap');
const tickerInput = document.querySelector('#allocationTicker');
const amountWrap = document.querySelector('#allocationAmountWrap');
const amountInput = document.querySelector('#allocationAmount');
const reasonInput = document.querySelector('#allocationReason');
const errorsEl = document.querySelector('#allocationErrors');
const successEl = document.querySelector('#allocationSuccess');
const submitButton = document.querySelector('#allocationSubmit');

function selectedChoice() {
  return choiceInputs.find(input => input.checked)?.value || '';
}

function syncChoiceUI() {
  const choice = selectedChoice();
  const wait = choice === 'WAIT_CASH';
  tickerWrap.hidden = !choice || wait;
  amountWrap.hidden = !choice || wait;
  if (wait) {
    tickerInput.value = '';
    amountInput.value = '';
  }
}

function renderState() {
  const state = getMonthlyMeetingState();
  availableEl.textContent = yen(state.remainingAmount);
  breakdownEl.textContent = state.finalized
    ? `確定時 ${yen(state.defaultInvestmentAmount)} + 繰越 ${yen(state.carryoverAtStart)} / 残高 ${yen(state.remainingAmount)}`
    : `今月の積立 ${yen(state.defaultInvestmentAmount)} + 繰越残高 ${yen(state.carryoverAtStart)}`;

  if (state.finalized) {
    const labels = {
      ADD_EXISTING: '既存株を買い増す',
      BUY_NEW: '新規銘柄を購入する',
      WAIT_CASH: '現金で待つ',
    };
    statusEl.hidden = false;
    statusEl.textContent = `今月は確定済み：${labels[state.decision?.choice] || ''} / 翌月へ ${yen(state.remainingAmount)} 繰越`;
    form.hidden = true;
  } else {
    statusEl.hidden = true;
    form.hidden = false;
  }
}

function showErrors(errors) {
  errorsEl.innerHTML = '';
  for (const error of errors) {
    const li = document.createElement('li');
    li.textContent = error;
    errorsEl.appendChild(li);
  }
  errorsEl.hidden = errors.length === 0;
}

for (const input of choiceInputs) input.addEventListener('change', syncChoiceUI);

form?.addEventListener('submit', event => {
  event.preventDefault();
  errorsEl.hidden = true;
  successEl.hidden = true;

  const result = finalizeMonthlyAllocation({
    choice: selectedChoice(),
    ticker: tickerInput.value,
    investedAmount: amountInput.value,
    reason: reasonInput.value,
  });

  if (!result.ok) {
    showErrors(result.errors);
    return;
  }

  const meeting = result.meeting;
  const isCash = meeting.decision.choice === 'WAIT_CASH';
  const journal = createDecision({
    ticker: isCash ? 'CASH' : meeting.decision.ticker,
    action: isCash ? 'HOLD' : 'BUY',
    thesis: `Monthly Investment Meeting ${meeting.month}: ${meeting.decision.reason} / 今月使えた金額 ${yen(meeting.initialAvailableAmount)} / 投資額 ${yen(meeting.decision.investedAmount)} / 翌月繰越 ${yen(meeting.remainingAmount)}`,
    risks: [],
    reviewDate: null,
  });

  if (!journal.ok) {
    showErrors(['月次判断は保存しましたが、Decision Journalへの記録に失敗しました']);
  } else {
    successEl.textContent = '今月の判断を確定し、Decision Journalへ記録しました。';
    successEl.hidden = false;
  }

  renderState();
  window.dispatchEvent(new CustomEvent('dfl-monthly-meeting-finalized', { detail: meeting }));
});

window.addEventListener('dfl-default-investment-updated', renderState);

syncChoiceUI();
renderState();


const monthLabelEl = document.querySelector('#monthLabel');
const holdingsEl = document.querySelector('#currentHoldings');
const holdingEmptyEl = document.querySelector('#holdingEmpty');
const holdingCountEl = document.querySelector('#holdingCount');
const candidatesEl = document.querySelector('#monthlyCandidates');

function renderPersonalizedSummary() {
  const now = new Date();
  if (monthLabelEl) monthLabelEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月`;

  let decisions = [];
  try {
    decisions = JSON.parse(localStorage.getItem('dfl-decisions') || '[]');
    if (!Array.isArray(decisions)) decisions = [];
  } catch { decisions = []; }

  const latestBuys = new Map();
  for (const decision of decisions) {
    if (decision?.action !== 'BUY' || !decision?.ticker) continue;
    const previous = latestBuys.get(decision.ticker);
    if (!previous || String(decision.createdAt || '') > String(previous.createdAt || '')) {
      latestBuys.set(decision.ticker, decision);
    }
  }

  const holdings = Array.from(latestBuys.values()).slice(0, 8);
  if (holdingsEl) {
    holdingsEl.innerHTML = '';
    for (const holding of holdings) {
      const article = document.createElement('article');
      article.className = 'holding-card';
      const title = document.createElement('strong');
      title.textContent = holding.ticker;
      const status = document.createElement('span');
      status.textContent = '長期保有を継続';
      const reason = document.createElement('p');
      reason.textContent = holding.thesis || '購入時の理由を確認中です。';
      article.append(title, status, reason);
      holdingsEl.appendChild(article);
    }
  }
  if (holdingCountEl) holdingCountEl.textContent = holdings.length ? `${holdings.length}銘柄` : '';
  if (holdingEmptyEl) holdingEmptyEl.hidden = holdings.length > 0;

  const stocks = Array.isArray(window.dream20Stocks) ? window.dream20Stocks : [];
  const held = new Set(holdings.map(item => item.ticker));
  const newCandidates = stocks.filter(stock => !held.has(stock.ticker)).slice(0, 2);
  const addCandidate = stocks.find(stock => held.has(stock.ticker));
  const candidates = [
    ...(addCandidate ? [{ ...addCandidate, kind: '買い増し候補' }] : []),
    ...newCandidates.map(stock => ({ ...stock, kind: '新しい候補' })),
  ].slice(0, 3);

  if (candidatesEl) {
    candidatesEl.innerHTML = '';
    for (const candidate of candidates) {
      const article = document.createElement('article');
      article.className = 'candidate-card';
      const tag = document.createElement('span');
      tag.textContent = candidate.kind;
      const title = document.createElement('strong');
      title.textContent = candidate.name;
      const text = document.createElement('p');
      text.textContent = candidate.why || '長期目線で比較したい候補です。';
      article.append(tag, title, text);
      candidatesEl.appendChild(article);
    }
    if (!candidates.length) {
      const p = document.createElement('p');
      p.className = 'quiet-note';
      p.textContent = '今月の候補を整理中です。';
      candidatesEl.appendChild(p);
    }
  }
}

renderPersonalizedSummary();
