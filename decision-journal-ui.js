import { addReflection, createDecision, getDecisions } from './services/decisionJournal.js';

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
  let openReflectionId = null;

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

  const getTodayKey = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isReviewable = (decision) => {
    if (typeof decision?.reviewDate !== 'string' || decision.reviewDate === '') {
      return false;
    }

    const date = new Date(decision.reviewDate);
    if (Number.isNaN(date.getTime())) {
      return false;
    }

    return decision.reviewDate <= getTodayKey();
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

  const createReflectionPanel = (decision) => {
    const reflection = document.createElement('section');
    reflection.className = 'decision-reflection';

    const title = document.createElement('p');
    title.className = 'decision-reflection-title';
    title.textContent = '振り返りメモ';
    reflection.appendChild(title);

    if (decision.reflection?.outcome) {
      reflection.appendChild(createField('その後どうなった？', decision.reflection.outcome));
    }

    if (decision.reflection?.learning) {
      reflection.appendChild(createField('次回に活かす学び', decision.reflection.learning));
    }

    reflection.appendChild(createField('振り返った日', toDisplayDate(decision.reflection?.reviewedAt)));

    return reflection;
  };

  const createReflectionForm = (decision) => {
    const formEl = document.createElement('form');
    formEl.className = 'reflection-form';
    formEl.noValidate = true;

    const title = document.createElement('p');
    title.className = 'reflection-form-title';
    title.textContent = 'この判断を振り返る';
    formEl.appendChild(title);

    const outcomeLabel = document.createElement('label');
    outcomeLabel.textContent = 'その後どうなった？';

    const outcomeInput = document.createElement('textarea');
    outcomeInput.name = 'outcome';
    outcomeInput.rows = 3;
    outcomeInput.placeholder = '例: 決算後も保有を続けられた / 途中で不安になって売った';
    outcomeLabel.appendChild(outcomeInput);
    formEl.appendChild(outcomeLabel);

    const learningLabel = document.createElement('label');
    learningLabel.textContent = '次回に活かす学び';

    const learningInput = document.createElement('textarea');
    learningInput.name = 'learning';
    learningInput.rows = 2;
    learningInput.placeholder = '例: 買う前に、どこまで待てるか決めておく';
    learningLabel.appendChild(learningInput);
    formEl.appendChild(learningLabel);

    const formErrors = document.createElement('ul');
    formErrors.className = 'decision-errors reflection-errors';
    formErrors.hidden = true;
    formEl.appendChild(formErrors);

    const actions = document.createElement('div');
    actions.className = 'reflection-actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'reflection-cancel';
    cancelButton.textContent = '閉じる';
    cancelButton.addEventListener('click', () => {
      openReflectionId = null;
      renderList();
    });

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'reflection-submit';
    submitButton.textContent = '振り返りを保存する';

    actions.appendChild(cancelButton);
    actions.appendChild(submitButton);
    formEl.appendChild(actions);

    formEl.addEventListener('submit', (event) => {
      event.preventDefault();
      clearMessages();

      formErrors.innerHTML = '';
      formErrors.hidden = true;

      const result = addReflection(decision.id, {
        outcome: outcomeInput.value,
        learning: learningInput.value,
      });

      if (!result.ok) {
        for (const error of result.errors) {
          const li = document.createElement('li');
          li.textContent = error;
          formErrors.appendChild(li);
        }
        formErrors.hidden = false;
        return;
      }

      openReflectionId = null;
      successEl.textContent = '振り返りを保存しました。';
      successEl.hidden = false;
      renderList();
    });

    return formEl;
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

      if (decision.reflection) {
        item.appendChild(createReflectionPanel(decision));
      } else if (isReviewable(decision)) {
        const reflectionButton = document.createElement('button');
        reflectionButton.type = 'button';
        reflectionButton.className = 'reflection-toggle';
        reflectionButton.textContent = 'この判断を振り返る';
        reflectionButton.addEventListener('click', () => {
          clearMessages();
          openReflectionId = decision.id;
          renderList();
        });
        item.appendChild(reflectionButton);

        if (openReflectionId === decision.id) {
          item.appendChild(createReflectionForm(decision));
        }
      }

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
