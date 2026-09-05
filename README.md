# Dream Fund Labs

初心者向けの個人投資研究アプリ。

## v0.1

- Dream20銘柄一覧
- 大型株枠／夢枠の切り替え
- 銘柄ごとの簡易DD
- 今月の購入候補

スマホで使いやすい、依存関係なしのWebアプリとして開始。

## Policy API

アプリ全体の VISION と PRINCIPLES は `data/policies.js` で一元管理しています。
`services/policy.js` を ES Module として import して参照できます。

```js
import { getNorthStar, getPrinciples, getPolicy } from './services/policy.js';

getNorthStar();        // '投資判断を育てるアプリ'
getPrinciples();       // 原則の配列 [{ id, text }, ...]
getPolicy('keep-policy'); // { id: 'keep-policy', text: '投資方針は簡単には変えない' }
```

| id | 原則 |
|----|------|
| `daily-update`     | 情報は毎日更新する       |
| `keep-policy`      | 投資方針は簡単には変えない |
| `record-reason`    | 判断理由を記録する       |
| `review-and-learn` | 後から振り返って学ぶ     |

## Decision Journal API

投資判断の理由を記録・取得するサービスです。
`services/decisionJournal.js` を ES Module として import して使います。
記録はブラウザの `localStorage` に保存されます。

```js
import {
  createDecision,
  getDecisions,
  getDecision,
  getDecisionsByTicker,
} from './services/decisionJournal.js';

// 記録を作成する
const result = createDecision({
  ticker:     'AAPL',
  action:     'BUY',           // BUY | SELL | HOLD | WATCH
  thesis:     '好決算と強いキャッシュフローを評価',
  risks:      ['金利上昇リスク', '為替リスク'],
  reviewDate: '2026-10-01',    // 省略可（省略時は null）
});
// result.ok === true のとき result.decision に保存済み記録が入る
// result.ok === false のとき result.errors にエラー文字列配列が入る
//   バリデーション失敗例: { ok: false, errors: ['ticker は必須の文字列です'] }
//   保存失敗例:           { ok: false, errors: ['判断記録を保存できませんでした'] }

// 全件取得（新しい順）
getDecisions();

// ID で1件取得
getDecision('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx');

// 銘柄コードで絞り込み
getDecisionsByTicker('AAPL');
```

| フィールド   | 型             | 説明                              |
|------------|----------------|-----------------------------------|
| `id`       | string         | 自動生成される UUID v4             |
| `createdAt`| string         | 作成日時（ISO 8601）               |
| `ticker`   | string         | 銘柄コード（必須）                 |
| `action`   | string         | `BUY` / `SELL` / `HOLD` / `WATCH`（必須） |
| `thesis`   | string         | 判断理由（必須）                   |
| `risks`    | string[]       | リスク一覧（省略時は空配列）        |
| `reviewDate`| string \| null | 振り返り予定日（省略時は null）    |

## Monthly Investment Meeting

Dream Fund Labs の月次判断は、長期投資を前提に次の5ステップで進めます。

1. Portfolio Review
2. Business Quality
3. Opportunities
4. Valuation
5. Capital Allocation

AIは情報を日次で更新しますが、ユーザーの投資判断は原則月1回です。既存保有株は基本HOLDとし、SELLは通常フローでは扱いません。

Capital Allocationの「今月使えるお金」は、毎月のデフォルト投資額と前月までの未投資残高の合計です。未投資残高は翌月へ繰り越されます。

通常の選択肢は「既存株を買い増す」「新規銘柄を購入する」「現金で待つ」の3つです。
