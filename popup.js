const I18N = window.ResumeFillerI18n;

// ─── 未匹配字段 → 板块映射（新增，不覆盖现有内容）────────────────────────────

const RESUME_SECTION_OPTIONS = [
  { label: '基本信息 / Basic Info', key: 'basic' },
  { label: '求职意向 / Job Target', key: 'intent' },
  { label: '教育经历 / Education', key: 'education' },
  { label: '工作经历 / Experience', key: 'experience' },
  { label: '实习经历 / Internship', key: 'internship' },
  { label: '项目经验 / Projects', key: 'projects' },
  { label: '技能 / Skills', key: 'skills' },
  { label: '语言 / Languages', key: 'languages' },
  { label: '其他 / Other', key: 'other' },
];

// 把字段标签+值保存到 customFields（独立于 resume，不覆盖任何已有内容）
function saveCustomField(section, fieldLabel, value, btn, cardEl) {
  chrome.storage.local.get('customFields', ({ customFields }) => {
    const cf = customFields || {};
    if (!cf[section]) cf[section] = {};
    cf[section][fieldLabel] = value;
    chrome.storage.local.set({ customFields: cf }, () => {
      btn.textContent = I18N.t('popup.unmatched_saved');
      btn.classList.add('saved');
      // 短暂显示成功状态后，让卡片消失
      setTimeout(() => {
        if (!cardEl) return;
        cardEl.style.transition = 'opacity 0.24s ease, transform 0.24s ease';
        cardEl.style.opacity = '0';
        cardEl.style.transform = 'scale(0.95)';
        setTimeout(() => {
          cardEl.style.overflow = 'hidden';
          cardEl.style.transition = 'max-height 0.26s ease, margin-top 0.26s ease, padding 0.26s ease';
          cardEl.style.maxHeight = cardEl.offsetHeight + 'px';
          requestAnimationFrame(() => {
            cardEl.style.maxHeight = '0';
            cardEl.style.marginTop = '0';
            cardEl.style.paddingTop = '0';
            cardEl.style.paddingBottom = '0';
          });
          setTimeout(() => cardEl.remove(), 280);
        }, 240);
      }, 700);
    });
  });
}

function buildUnmatchedItem(item) {
  const div = document.createElement('div');
  div.className = 'manual-item unmatched';

  const top = document.createElement('div');
  top.className = 'unmatched-top';
  top.innerHTML = `
    <span class="field-tag tag-other">${escapeHtml(translateManualHint(item.hint))}</span>
    <div class="field-info"><div class="field-label">${escapeHtml(item.label)}</div></div>
  `;
  div.appendChild(top);

  const form = document.createElement('div');
  form.className = 'unmatched-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'unmatched-input';
  input.placeholder = I18N.t('popup.unmatched_placeholder');

  const select = document.createElement('select');
  select.className = 'unmatched-select';
  RESUME_SECTION_OPTIONS.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.key;
    option.textContent = opt.label;
    select.appendChild(option);
  });

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'save-field-btn';
  btn.textContent = I18N.t('popup.unmatched_save');

  btn.addEventListener('click', () => {
    const value = input.value.trim();
    if (!value) return;
    saveCustomField(select.value, item.label, value, btn, div);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); btn.click(); }
  });

  form.appendChild(input);
  form.appendChild(select);
  form.appendChild(btn);
  div.appendChild(form);
  return div;
}

const screens = {
  intro: document.getElementById('screen-intro'),
  step1: document.getElementById('screen-step1'),
  step2: document.getElementById('screen-step2'),
  fill: document.getElementById('screen-fill')
};

let step1Ready = false;

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove('active'));
  screens[name].classList.add('active');
}

function buildPrompt(lang) {
  if (lang === 'en') {
    return `You are a resume parsing assistant. Parse the "resume text" below into the following JSON structure, and output JSON only (no explanation, no markdown code block).

Rules:
1. Use empty strings "" or empty arrays [] for anything not found. Do not invent values.
2. Dates must use "YYYY-MM" or "YYYY-MM-DD". If the role is ongoing, leave end_date empty and set current to true.
3. education / experience / projects should be sorted in reverse chronological order (most recent first).
4. skills and languages must be arrays of strings.
5. Split name into firstName / lastName when possible.
6. Escape any double quotes inside string values as \\"; do not use special quotation marks — replace them with plain text.
7. Separate multiple points in description fields with a period; do not use newline characters.
8. Ensure the output passes JSON.parse() without errors — verify syntax before outputting.

Target schema:
${JSON.stringify(window.RESUME_SCHEMA, null, 2)}

(Please also upload your resume PDF and send it together with this prompt.)`;
  }

  return `你是简历解析助手。请把下方"简历原文"解析成以下 JSON 结构，并 **只** 输出 JSON（不要任何解释文字、不要 markdown 代码块）。

规则：
1. 未提取到的字段用空字符串 "" 或空数组 []，不要编造。
2. 日期统一为 "YYYY-MM" 或 "YYYY-MM-DD"；"至今"时 end_date 留空并把 current 设为 true。
3. education / experience / projects 按时间倒序排列（最近的在前）。
4. skills、languages 是字符串数组。
5. name 尽量拆成 firstName / lastName；中文姓名可把姓放 lastName、名放 firstName。
6. 所有字符串值中，如含双引号请转义为 \\"；禁止使用「」『』等特殊引号，一律改为普通文字描述。
7. description 字段内容用句号分隔多个要点，不使用换行符。
8. 不得出现任何会导致 JSON.parse() 失败的字符，输出前请自检确认语法正确。

目标 schema：
${JSON.stringify(window.RESUME_SCHEMA, null, 2)}

（请同时上传你的简历 PDF 文件，将以上内容作为提示词一起发送）`;
}

function setPromptText() {
  document.getElementById('promptBox').textContent = buildPrompt(I18N.getLanguage());
  document.title = I18N.t('popup.document_title');
}

function defaultFillButtonText() {
  return I18N.t('popup.fill_button');
}

function updateStep1State() {
  document.getElementById('step1NextBtn').disabled = !step1Ready;
}

function markStep1Done() {
  step1Ready = true;
  updateStep1State();
}

function copy(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const old = btn.textContent;
    btn.textContent = I18N.t('popup.copy_ok');
    markStep1Done();
    setTimeout(() => { btn.textContent = old; }, 1500);
  });
}

function showStatus(type, text) {
  const bar = document.getElementById('statusBar');
  bar.className = `status-bar ${type}`;
  bar.textContent = text;
}

function renderManual(items) {
  const section = document.getElementById('manualSection');
  const list = document.getElementById('manualList');
  const seen = new Set();
  const unique = items.filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = '';

  unique.forEach((item) => {
    if (item.hint === '未匹配') {
      list.appendChild(buildUnmatchedItem(item));
      return;
    }

    const tagClass = {
      '日期': 'tag-date',
      '下拉框': 'tag-select',
      '富文本': 'tag-rich',
    }[item.hint] || 'tag-other';

    const hintText = translateManualHint(item.hint);
    const valueHtml = item.value
      ? `<div class="field-value">${escapeHtml(I18N.t('popup.manual_value', { value: item.value }))}</div>`
      : '';

    const div = document.createElement('div');
    div.className = 'manual-item';
    div.innerHTML = `
      <span class="field-tag ${tagClass}">${escapeHtml(hintText)}</span>
      <div class="field-info">
        <div class="field-label">${escapeHtml(item.label)}</div>
        ${valueHtml}
      </div>
    `;
    list.appendChild(div);
  });
}

function translateManualHint(hint) {
  if (I18N.getLanguage() !== 'en') return hint;
  return {
    '日期': 'Date',
    '下拉框': 'Select',
    '富文本': 'Rich text',
    '未匹配': 'Manual'
  }[hint] || hint;
}

function showFillScreen(resume) {
  const basic = resume.basic || {};
  const intent = resume.intent || {};
  const job = (resume.experience && resume.experience[0]) || {};

  document.getElementById('sumName').textContent =
    basic.name || [basic.firstName, basic.lastName].filter(Boolean).join(' ') || I18N.t('popup.no_name');

  const meta = document.getElementById('sumMeta');
  meta.innerHTML = '';
  const chips = [];
  if (intent.apply_position) chips.push(intent.apply_position);
  else if (job.title) chips.push(job.title);
  if (job.company) chips.push('@ ' + job.company);
  if (intent.years_exp) chips.push(intent.years_exp);
  if (basic.location) chips.push(basic.location);

  chips.forEach((chip) => {
    const node = document.createElement('span');
    node.textContent = chip;
    meta.appendChild(node);
  });

  document.getElementById('fillBtn').textContent = defaultFillButtonText();
  showScreen('fill');
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.getElementById('startFlowBtn').addEventListener('click', () => {
  showScreen('step1');
});

document.getElementById('step1BackBtn').addEventListener('click', () => {
  showScreen('intro');
});

document.getElementById('step1NextBtn').addEventListener('click', () => {
  showScreen('step2');
});

document.getElementById('step2BackBtn').addEventListener('click', () => {
  showScreen('step1');
});

document.getElementById('fillBackBtn').addEventListener('click', () => {
  showScreen('step2');
});

document.getElementById('copyPromptBtn').addEventListener('click', (event) => {
  copy(buildPrompt(I18N.getLanguage()), event.currentTarget);
});

document.getElementById('copySchemaBtn').addEventListener('click', (event) => {
  copy(JSON.stringify(window.RESUME_SCHEMA, null, 2), event.currentTarget);
});

document.getElementById('importBtn').addEventListener('click', () => {
  const raw = document.getElementById('jsonInput').value.trim();
  const hint = document.getElementById('importHint');

  if (!raw) {
    hint.className = 'hint error';
    hint.textContent = I18N.t('popup.import_empty');
    return;
  }

  let data;
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    data = JSON.parse(cleaned);
  } catch (error) {
    hint.className = 'hint error';
    hint.textContent = I18N.t('popup.import_error', { message: error.message });
    return;
  }

  const resume = window.normalizeResume(data);
  chrome.storage.local.set({ resume }, () => {
    hint.className = 'hint ok';
    hint.textContent = I18N.t('popup.import_ok');
    setTimeout(() => {
      showFillScreen(resume);
    }, 450);
  });
});

document.getElementById('openEditor').addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  else window.open(chrome.runtime.getURL('options.html'));
});

document.getElementById('reimport').addEventListener('click', () => {
  if (!confirm(I18N.t('popup.reimport_confirm'))) return;
  showScreen('step2');
});

document.getElementById('fillBtn').addEventListener('click', () => {
  chrome.storage.local.get(['resume', 'customFields'], ({ resume, customFields }) => {
    if (!resume || !window.isResumeFilled(resume)) {
      showStatus('warn', I18N.t('popup.status_no_resume'));
      return;
    }

    const btn = document.getElementById('fillBtn');
    btn.disabled = true;
    btn.textContent = I18N.t('popup.fill_loading');

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(tab.id, { action: 'fill', resume, customFields: customFields || {} }, (response) => {
        btn.disabled = false;
        btn.textContent = defaultFillButtonText();

        if (chrome.runtime.lastError || !response) {
          showStatus('warn', I18N.t('popup.status_connect_error'));
          return;
        }

        const { filled, manual } = response;
        if (filled.length > 0) {
          showStatus('success', I18N.t('popup.status_filled', { count: filled.length }));
        } else {
          showStatus('warn', I18N.t('popup.status_no_match'));
        }
        renderManual(manual);
      });
    });
  });
});

window.addEventListener('resumefiller:languagechange', () => {
  setPromptText();
  updateStep1State();
  const fillBtn = document.getElementById('fillBtn');
  if (!fillBtn.disabled) {
    fillBtn.textContent = defaultFillButtonText();
  }
});

I18N.init().then(() => {
  setPromptText();
  updateStep1State();

  chrome.storage.local.get('resume', ({ resume }) => {
    if (resume && window.isResumeFilled(resume)) {
      showFillScreen(resume);
    } else {
      showScreen('intro');
    }
  });
});
