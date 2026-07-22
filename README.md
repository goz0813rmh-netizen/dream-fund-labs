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