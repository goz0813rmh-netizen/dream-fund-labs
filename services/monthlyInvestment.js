const DEFAULT_INVESTMENT_KEY = 'dfl-monthly-budget';
const CARRYOVER_KEY = 'dfl-investment-carryover';
const MEETINGS_KEY = 'dfl-monthly-investment-meetings';

function readNumber(key, fallback = 0) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
}

function readMeetings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MEETINGS_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveMeetings(meetings) {
  localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
}

export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getDefaultInvestmentAmount() {
  return readNumber(DEFAULT_INVESTMENT_KEY, 5000);
}

export function setDefaultInvestmentAmount(amount) {
  const normalized = Math.max(0, Math.round(Number(amount) || 0));
  localStorage.setItem(DEFAULT_INVESTMENT_KEY, String(normalized));
  return normalized;
}

export function getCarryoverAmount() {
  return readNumber(CARRYOVER_KEY, 0);
}

export function getMonthlyMeetingState(date = new Date()) {
  const month = getMonthKey(date);
  const meetings = readMeetings();
  const existing = meetings[month] || null;

  if (existing) {
    return {
      month,
      finalized: true,
      defaultInvestmentAmount: Number(existing.defaultInvestmentAmount) || 0,
      carryoverAtStart: Number(existing.carryoverAtStart) || 0,
      initialAvailableAmount: Number(existing.initialAvailableAmount) || 0,
      remainingAmount: Number(existing.remainingAmount) || 0,
      decision: existing.decision || null,
    };
  }

  const defaultInvestmentAmount = getDefaultInvestmentAmount();
  const carryoverAtStart = getCarryoverAmount();

  return {
    month,
    finalized: false,
    defaultInvestmentAmount,
    carryoverAtStart,
    initialAvailableAmount: defaultInvestmentAmount + carryoverAtStart,
    remainingAmount: defaultInvestmentAmount + carryoverAtStart,
    decision: null,
  };
}

export function finalizeMonthlyAllocation(input, date = new Date()) {
  const state = getMonthlyMeetingState(date);
  if (state.finalized) {
    return { ok: false, errors: ['今月のInvestment Meetingはすでに確定済みです'] };
  }

  const choice = String(input?.choice || '');
  if (!['ADD_EXISTING', 'BUY_NEW', 'WAIT_CASH'].includes(choice)) {
    return { ok: false, errors: ['投資判断を選択してください'] };
  }

  const reason = String(input?.reason || '').trim();
  if (!reason) {
    return { ok: false, errors: ['判断理由を入力してください'] };
  }

  const ticker = String(input?.ticker || '').trim().toUpperCase();
  const investedAmount = choice === 'WAIT_CASH'
    ? 0
    : Math.max(0, Math.round(Number(input?.investedAmount) || 0));

  const errors = [];
  if (choice !== 'WAIT_CASH' && !ticker) errors.push('購入する銘柄コードを入力してください');
  if (choice !== 'WAIT_CASH' && investedAmount <= 0) errors.push('実際の投資額を入力してください');
  if (investedAmount > state.initialAvailableAmount) errors.push('今月使えるお金を超えています');
  if (errors.length) return { ok: false, errors };

  const remainingAmount = state.initialAvailableAmount - investedAmount;
  const record = {
    month: state.month,
    finalizedAt: new Date().toISOString(),
    defaultInvestmentAmount: state.defaultInvestmentAmount,
    carryoverAtStart: state.carryoverAtStart,
    initialAvailableAmount: state.initialAvailableAmount,
    remainingAmount,
    decision: {
      choice,
      ticker: choice === 'WAIT_CASH' ? null : ticker,
      investedAmount,
      reason,
    },
  };

  const meetings = readMeetings();
  meetings[state.month] = record;
  saveMeetings(meetings);
  localStorage.setItem(CARRYOVER_KEY, String(remainingAmount));

  return { ok: true, meeting: record };
}

export function getMonthlyMeetings() {
  return readMeetings();
}
