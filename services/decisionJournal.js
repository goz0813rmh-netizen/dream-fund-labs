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
    return true;
  } catch {
    return false;
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

function normalizeReflection(reflection) {
  if (!reflection || typeof reflection !== 'object') {
    return null;
  }

  const outcome = typeof reflection.outcome === 'string' ? reflection.outcome : '';
  const learning = typeof reflection.learning === 'string' ? reflection.learning : '';
  const reviewedAt = typeof reflection.reviewedAt === 'string' ? reflection.reviewedAt : null;

  if (outcome === '' && learning === '' && !reviewedAt) {
    return null;
  }

  return { outcome, learning, reviewedAt };
}

function normalizeDecision(decision) {
  return {
    ...decision,
    risks: Array.isArray(decision?.risks) ? decision.risks : [],
    reviewDate: decision?.reviewDate ?? null,
    reflection: normalizeReflection(decision?.reflection),
  };
}

function validateReflection(decisionId, input) {
  const errors = [];

  if (typeof decisionId !== 'string' || decisionId.trim() === '') {
    errors.push('decisionId は必須です');
  }

  const outcome = typeof input?.outcome === 'string' ? input.outcome.trim() : '';
  const learning = typeof input?.learning === 'string' ? input.learning.trim() : '';

  if (outcome === '' && learning === '') {
    errors.push('その後どうなった？ か 次回に活かす学び のどちらかを入力してください');
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
    reflection: null,
  };

  const all = loadAll();
  all.push(decision);
  const saved = saveAll(all);
  if (!saved) {
    return { ok: false, errors: ['判断記録を保存できませんでした'] };
  }

  return { ok: true, decision };
}

/**
 * 判断記録へ振り返りを保存する。
 * @param {string} decisionId
 * @param {{ outcome?: string, learning?: string }} input
 * @returns {{ ok: true, decision: object } | { ok: false, errors: string[] }}
 */
export function addReflection(decisionId, input) {
  const errors = validateReflection(decisionId, input);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const all = loadAll();
  const index = all.findIndex(decision => decision.id === decisionId);

  if (index === -1) {
    return { ok: false, errors: ['対象の判断記録が見つかりません'] };
  }

  const updatedDecision = {
    ...all[index],
    reflection: {
      outcome: typeof input?.outcome === 'string' ? input.outcome.trim() : '',
      learning: typeof input?.learning === 'string' ? input.learning.trim() : '',
      reviewedAt: new Date().toISOString(),
    },
  };

  all[index] = updatedDecision;

  if (!saveAll(all)) {
    return { ok: false, errors: ['振り返りを保存できませんでした'] };
  }

  return { ok: true, decision: normalizeDecision(updatedDecision) };
}

/**
 * 全件取得（新しい順）。
 * @returns {object[]}
 */
export function getDecisions() {
  return loadAll()
    .map(normalizeDecision)
    .slice()
    .reverse();
}

/**
 * ID で1件取得。見つからなければ null。
 * @param {string} id
 * @returns {object|null}
 */
export function getDecision(id) {
  const decision = loadAll().find(d => d.id === id);
  return decision ? normalizeDecision(decision) : null;
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
    .map(normalizeDecision)
    .reverse();
}
