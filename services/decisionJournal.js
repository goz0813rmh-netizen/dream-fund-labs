import { DECISIONS_STORAGE_KEY, VALID_ACTIONS } from '../data/decisions.js';

// --- localStorage helpers (safe: never throws on read) ---

function loadAll() {
  try {
    const raw = localStorage.getItem(DECISIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(decisions) {
  try {
    localStorage.setItem(DECISIONS_STORAGE_KEY, JSON.stringify(decisions));
  } catch {
    // localStorage unavailable or quota exceeded — skip persistence silently
  }
}

// --- UUID v4 via Web Crypto (no external dependency) ---

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --- validation ---

function validate(input) {
  const errors = [];

  if (!input || typeof input.ticker !== 'string' || input.ticker.trim() === '') {
    errors.push('ticker は必須の文字列です');
  }
  if (!VALID_ACTIONS.includes(input?.action)) {
    errors.push(`action は ${VALID_ACTIONS.join(' | ')} のいずれかです`);
  }
  if (!input || typeof input.thesis !== 'string' || input.thesis.trim() === '') {
    errors.push('thesis は必須の文字列です');
  }
  if (input?.risks !== undefined && !Array.isArray(input.risks)) {
    errors.push('risks は文字列配列です');
  }

  return errors;
}

// --- public API ---

/**
 * 判断記録を作成して localStorage に保存する。
 * @param {{ ticker, action, thesis, risks?, reviewDate? }} input
 * @returns {{ ok: true, decision: object } | { ok: false, errors: string[] }}
 */
export function createDecision(input) {
  const errors = validate(input);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const decision = {
    id:         generateId(),
    createdAt:  new Date().toISOString(),
    ticker:     input.ticker.trim().toUpperCase(),
    action:     input.action,
    thesis:     input.thesis.trim(),
    risks:      Array.isArray(input.risks) ? input.risks : [],
    reviewDate: input.reviewDate ?? null,
  };

  const all = loadAll();
  all.push(decision);
  saveAll(all);

  return { ok: true, decision };
}

/**
 * 全件取得（新しい順）。
 * @returns {object[]}
 */
export function getDecisions() {
  return loadAll().slice().reverse();
}

/**
 * ID で1件取得。見つからなければ null。
 * @param {string} id
 * @returns {object|null}
 */
export function getDecision(id) {
  return loadAll().find(d => d.id === id) ?? null;
}

/**
 * 銘柄コードで絞り込み（新しい順）。
 * @param {string} ticker
 * @returns {object[]}
 */
export function getDecisionsByTicker(ticker) {
  const upper = String(ticker).trim().toUpperCase();
  return loadAll()
    .filter(d => d.ticker === upper)
    .reverse();
}
