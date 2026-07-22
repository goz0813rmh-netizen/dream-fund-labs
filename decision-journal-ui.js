import { createDecision, getDecisions } from './services/decisionJournal.js';

const form = document.querySelector('#decisionForm');

if (form) {
  const tickerInput = document.querySelector('#decisionTicker');
  const actionInput = document.querySelector('#decisionAction');
  const thesisInput = document.querySelector('#decisionThesis');
  const risksInput = document.querySelector('#decisionRisks');
  const reviewDateInput = document.querySelector('#decisionReviewDate');
  const submitButton = document.querySelector('#decisionSubmit');

  const successEl = document.querySelector('#decisionSuccess');
  const errorsEl = document.querySelector('#decisionErrors');
  const listEl = document.querySelector('#decisionList');
  const emptyEl = document.querySelector('#decisionEmpty');
  const countEl = document.querySelector('#decisionCount');

  const parseRisks = (raw) => String(raw)
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean);

  const toDisplayDate = (value) => {
    if (!value) return '未設定';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('ja-JP');
  };

  const clearMessages = () => {
    successEl.hidden = true;
    successEl.textContent = '';
    errorsEl.hidden = true;
    errorsEl.innerHTML = '';
  };

  const renderErrors = (errors) => {
    successEl.hidden = true;
    successEl.textContent = '';

    errorsEl.innerHTML = '';
    for (const error of errors) {
      const li = document.createElement('li');
      li.textContent = error;
      errorsEl.appendChild(li);
    }
    errorsEl.hidden = errors.length === 0;
  };

  const createField = (label, value) => {
    const field = document.createElement('p');
    const key = document.createElement('strong');
    const text = document.createElement('span');

    key.textContent = `${label}: `;
    text.textContent = value;

    field.appendChild(key);
    field.appendChild(text);

    return field;
  };

  const renderList = () => {
    const decisions = getDecisions();

    countEl.textContent = `${decisions.length}件`;
    listEl.innerHTML = '';

    if (decisions.length === 0) {
      emptyEl.hidden = false;
      listEl.hidden = true;
      return;
    }

    emptyEl.hidden = true;
    listEl.hidden = false;

    for (const decision of decisions) {
      const item = document.createElement('article');
      item.className = 'decision-item';

      const heading = document.createElement('h3');
      heading.textContent = `${decision.ticker} / ${decision.action}`;
      item.appendChild(heading);

      const risks = Array.isArray(decision.risks) ? decision.risks : [];

      item.appendChild(createField('判断理由', decision.thesis ?? ''));
      item.appendChild(createField('リスク', risks.length ? risks.join(' / ') : 'なし'));
      item.appendChild(createField('作成日時', toDisplayDate(decision.createdAt)));
      item.appendChild(createField('振り返り予定日', toDisplayDate(decision.reviewDate)));

      listEl.appendChild(item);
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearMessages();

    const result = createDecision({
      ticker: tickerInput.value,
      action: actionInput.value,
      thesis: thesisInput.value,
      risks: parseRisks(risksInput.value),
      reviewDate: reviewDateInput.value || null,
    });

    if (!result.ok) {
      renderErrors(result.errors);
      return;
    }

    form.reset();
    actionInput.value = 'BUY';

    successEl.textContent = '判断記録を保存しました。';
    successEl.hidden = false;

    renderList();

    submitButton.blur();
  });

  renderList();
}
