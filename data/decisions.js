export const DECISIONS_STORAGE_KEY = 'dream_fund_decisions';

export const VALID_ACTIONS = ['BUY', 'SELL', 'HOLD', 'WATCH'];

/**
 * 判断記録の最小データ構造
 * {
 *   id:         string   — UUID v4
 *   createdAt:  string   — ISO 8601
 *   ticker:     string   — 銘柄コード（必須）
 *   action:     string   — BUY | SELL | HOLD | WATCH
 *   thesis:     string   — 判断理由（必須）
 *   risks:      string[] — リスク一覧（未指定なら空配列）
 *   reviewDate: string|null — 振り返り予定日（未指定なら null）
 *   reflection: { outcome: string, learning: string, reviewedAt: string } | null
 * }
 */
