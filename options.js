const I18N = window.ResumeFillerI18n;
let state = window.emptyResume();

function renderCustomFields(cf) {
  // 清空所有 data-custom-for 容器
  document.querySelectorAll('[data-custom-for]').forEach(el => { el.innerHTML = ''; });

  // 隐藏"其他"独立 section（有内容时再显示）
  const otherSection = document.getElementById('section-other');
  if (otherSection) otherSection.style.display = 'none';

  if (!cf || typeof cf !== 'object') return;

  Object.entries(cf).forEach(([sectionKey, fields]) => {
    if (!fields || typeof fields !== 'object') return;
    const entries = Object.entries(fields);
    if (entries.length === 0) return;

    const container = document.querySelector(`[data-custom-for="${sectionKey}"]`);
    if (!container) return;

    // 分隔标题
    const header = document.createElement('div');
    header.className = 'cf-sub-label';
    header.textContent = I18N.t('options.custom_sub_label');
    container.appendChild(header);

    entries.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'custom-field-row';

      const delBtn = document.createElement('button');
      delBtn.className = 'mini-btn danger';
      delBtn.type = 'button';
      delBtn.textContent = I18N.t('common.delete');
      delBtn.addEventListener('click', () => deleteCustomField(sectionKey, label));

      // eslint-disable-next-line no-unsanitized/property -- label/value escaped via escapeHtml
      row.innerHTML = `
        <span class="cf-label">${escapeHtml(label)}</span>
        <span class="cf-value">${escapeHtml(value)}</span>
      `;
      row.appendChild(delBtn);
      container.appendChild(row);
    });

    // 如果是 other，显示该独立 section
    if (sectionKey === 'other' && otherSection) {
      otherSection.style.display = '';
    }
  });
}

function deleteCustomField(sectionKey, label) {
  if (!confirm(I18N.t('common.confirm_delete'))) return;
  chrome.storage.local.get('customFields', ({ customFields }) => {
    const cf = customFields || {};
    if (cf[sectionKey]) {
      delete cf[sectionKey][label];
      if (Object.keys(cf[sectionKey]).length === 0) delete cf[sectionKey];
    }
    chrome.storage.local.set({ customFields: cf }, () => {
      renderCustomFields(cf);
    });
  });
}

const SECTION_FIELDS = {
  education: [
    { key: 'school', labelKey: 'options.education.school_label', placeholderKey: 'options.education.school_placeholder', col: 2 },
    { key: 'location', labelKey: 'options.education.location_label', placeholderKey: 'options.education.location_placeholder' },
    { key: 'degree', labelKey: 'options.education.degree_label', placeholderKey: 'options.education.degree_placeholder' },
    { key: 'major', labelKey: 'options.education.major_label', placeholderKey: 'options.education.major_placeholder' },
    { key: 'gpa', labelKey: 'options.education.gpa_label', placeholderKey: 'options.education.gpa_placeholder' },
    { key: 'start_date', labelKey: 'options.education.start_label', placeholderKey: 'options.education.start_placeholder' },
    { key: 'end_date', labelKey: 'options.education.end_label', placeholderKey: 'options.education.end_placeholder' },
    { key: 'description', labelKey: 'options.education.desc_label', type: 'textarea', col: 2 }
  ],
  experience: [
    { key: 'company', labelKey: 'options.experience.company_label', placeholderKey: 'options.experience.company_placeholder', col: 2 },
    { key: 'title', labelKey: 'options.experience.title_label', placeholderKey: 'options.experience.title_placeholder' },
    { key: 'location', labelKey: 'options.experience.location_label', placeholderKey: 'options.experience.location_placeholder' },
    { key: 'start_date', labelKey: 'options.experience.start_label', placeholderKey: 'options.experience.start_placeholder' },
    { key: 'end_date', labelKey: 'options.experience.end_label', placeholderKey: 'options.experience.end_placeholder' },
    { key: 'description', labelKey: 'options.experience.desc_label', type: 'textarea', col: 2 }
  ],
  internship: [
    { key: 'company', labelKey: 'options.internship.company_label', placeholderKey: 'options.internship.company_placeholder', col: 2 },
    { key: 'title', labelKey: 'options.internship.title_label', placeholderKey: 'options.internship.title_placeholder' },
    { key: 'location', labelKey: 'options.internship.location_label', placeholderKey: 'options.internship.location_placeholder' },
    { key: 'start_date', labelKey: 'options.internship.start_label', placeholderKey: 'options.internship.start_placeholder' },
    { key: 'end_date', labelKey: 'options.internship.end_label', placeholderKey: 'options.internship.end_placeholder' },
    { key: 'description', labelKey: 'options.internship.desc_label', type: 'textarea', col: 2 }
  ],
  projects: [
    { key: 'name', labelKey: 'options.projects.name_label', placeholderKey: 'options.projects.name_placeholder', col: 2 },
    { key: 'role', labelKey: 'options.projects.role_label', placeholderKey: 'options.projects.role_placeholder' },
    { key: 'link', labelKey: 'options.projects.link_label', placeholderKey: 'options.projects.link_placeholder' },
    { key: 'start_date', labelKey: 'options.projects.start_label', placeholderKey: 'options.projects.start_placeholder' },
    { key: 'end_date', labelKey: 'options.projects.end_label', placeholderKey: 'options.projects.end_placeholder' },
    { key: 'description', labelKey: 'options.projects.desc_label', type: 'textarea', col: 2 }
  ]
};

function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((acc, key) => (acc[key] = acc[key] || {}), obj);
  target[last] = value;
}

function toast(text, type) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => { el.className = 'toast'; }, 1800);
}

function labelForSection(section) {
  if (section === 'education') return I18N.t('common.card_default_education');
  if (section === 'experience') return I18N.t('common.card_default_experience');
  if (section === 'internship') return I18N.t('common.card_default_internship');
  return I18N.t('common.card_default_project');
}

function renderArraySection(section) {
  const container = document.querySelector(`[data-list="${section}"]`);
  container.innerHTML = '';

  const items = state[section] || [];
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color: #8d96ab; font-size: 12px; padding: 10px 2px;';
    empty.textContent = I18N.t('common.empty_list');
    container.appendChild(empty);
    return;
  }

  items.forEach((item, idx) => {
    container.appendChild(buildArrayCard(section, idx));
  });
}

function buildArrayCard(section, idx) {
  const item = state[section][idx];
  const fields = SECTION_FIELDS[section];
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.section = section;
  card.dataset.idx = idx;

  const titleText = (() => {
    if (section === 'education') return item.school || labelForSection(section);
    if (section === 'experience') return item.company || labelForSection(section);
    return item.name || labelForSection(section);
  })();

  const head = document.createElement('div');
  head.className = 'card-head';
  // eslint-disable-next-line no-unsanitized/property -- titleText and i18n string escaped via escapeHtml
  head.innerHTML = `
    <div class="card-title">
      #${idx + 1} · ${escapeHtml(titleText)}
      ${idx === 0 ? `<span class="muted">${escapeHtml(I18N.t('common.priority_note'))}</span>` : ''}
    </div>
  `;

  const controls = document.createElement('div');
  controls.className = 'card-actions';

  if (idx > 0) {
    const up = document.createElement('button');
    up.className = 'mini-btn';
    up.type = 'button';
    up.textContent = I18N.t('common.move_up');
    up.addEventListener('click', () => moveItem(section, idx, -1));
    controls.appendChild(up);
  }

  if (idx < state[section].length - 1) {
    const down = document.createElement('button');
    down.className = 'mini-btn';
    down.type = 'button';
    down.textContent = I18N.t('common.move_down');
    down.addEventListener('click', () => moveItem(section, idx, 1));
    controls.appendChild(down);
  }

  const del = document.createElement('button');
  del.className = 'mini-btn danger';
  del.type = 'button';
  del.textContent = I18N.t('common.delete');
  del.addEventListener('click', () => {
    if (!confirm(I18N.t('common.confirm_delete'))) return;
    state[section].splice(idx, 1);
    renderArraySection(section);
  });
  controls.appendChild(del);
  head.appendChild(controls);
  card.appendChild(head);

  const grid = document.createElement('div');
  grid.className = 'grid';
  let endDateInput = null;

  fields.forEach((field) => {
    const wrap = document.createElement('div');
    wrap.className = 'field' + (field.col === 2 ? ' full' : '');
    // eslint-disable-next-line no-unsanitized/property -- i18n string escaped via escapeHtml
    wrap.innerHTML = `<label>${escapeHtml(I18N.t(field.labelKey))}</label>`;
    const input = document.createElement(field.type === 'textarea' ? 'textarea' : 'input');
    input.placeholder = field.placeholderKey ? I18N.t(field.placeholderKey) : '';
    input.value = item[field.key] != null ? item[field.key] : '';
    if (field.key === 'end_date') endDateInput = input;

    input.addEventListener('input', (event) => {
      state[section][idx][field.key] = event.target.value;
      if (['school', 'company', 'name'].includes(field.key)) {
        const cardTitle = card.querySelector('.card-title');
        const display = state[section][idx][field.key] || labelForSection(section);
        const note = idx === 0 ? ` <span class="muted">${escapeHtml(I18N.t('common.priority_note'))}</span>` : '';
        // eslint-disable-next-line no-unsanitized/property -- display and note escaped via escapeHtml
        cardTitle.innerHTML = `#${idx + 1} · ${escapeHtml(display)}${note}`;
      }
    });

    wrap.appendChild(input);
    grid.appendChild(wrap);
  });

  if (section === 'experience' || section === 'internship') {
    const row = document.createElement('div');
    row.className = 'field full';
    // eslint-disable-next-line no-unsanitized/property -- section/idx are internal identifiers, i18n escaped via escapeHtml
    row.innerHTML = `
      <div class="checkbox-row">
        <input type="checkbox" id="cur-${section}-${idx}" ${item.current ? 'checked' : ''}>
        <label for="cur-${section}-${idx}" style="text-transform:none; letter-spacing:0; color:inherit; margin:0;">${escapeHtml(I18N.t('common.current_job'))}</label>
      </div>
    `;
    row.querySelector('input').addEventListener('change', (event) => {
      state[section][idx].current = event.target.checked;
      if (event.target.checked) {
        state[section][idx].end_date = '';
        if (endDateInput) endDateInput.value = '';
      }
    });
    grid.appendChild(row);
  }

  card.appendChild(grid);
  return card;
}

function moveItem(section, idx, dir) {
  const arr = state[section];
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= arr.length) return;
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  renderArraySection(section);
}

function renderTags(listName, editorId, inputId) {
  const editor = document.getElementById(editorId);
  const input = document.getElementById(inputId);
  editor.querySelectorAll('.tag').forEach((tag) => tag.remove());

  (state[listName] || []).forEach((value, index) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = value;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      state[listName].splice(index, 1);
      renderTags(listName, editorId, inputId);
    });

    tag.appendChild(remove);
    editor.insertBefore(tag, input);
  });
}

function bindTagInput(listName, editorId, inputId) {
  const input = document.getElementById(inputId);

  function commit() {
    const parts = input.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
    if (parts.length === 0) return;
    state[listName] = (state[listName] || []).concat(parts);
    input.value = '';
    renderTags(listName, editorId, inputId);
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && input.value === '' && (state[listName] || []).length) {
      state[listName].pop();
      renderTags(listName, editorId, inputId);
    }
  });

  input.addEventListener('blur', commit);
  document.getElementById(editorId).addEventListener('click', () => input.focus());
}

function hydrate() {
  document.title = I18N.t('options.document_title');
  I18N.applyText();

  document.querySelectorAll('[data-path]').forEach((el) => {
    el.value = getPath(state, el.dataset.path) || '';
  });

  renderArraySection('education');
  renderArraySection('experience');
  renderArraySection('internship');
  renderArraySection('projects');
  renderTags('skills', 'skills-editor', 'skills-input');
  renderTags('languages', 'languages-editor', 'languages-input');
}

function collectFlatFields() {
  document.querySelectorAll('[data-path]').forEach((el) => {
    setPath(state, el.dataset.path, el.value.trim());
  });
}

function save() {
  collectFlatFields();
  const resume = window.normalizeResume(state);
  state = resume;

  chrome.storage.local.set({ resume }, () => {
    const btn = document.getElementById('btn-save');
    const defaultText = I18N.t('options.btn_save');
    btn.textContent = I18N.t('options.saved');
    btn.classList.add('saved');
    setTimeout(() => {
      btn.textContent = defaultText;
      btn.classList.remove('saved');
    }, 1600);
    toast(I18N.t('options.toast_saved'), 'success');
  });
}

function exportJson() {
  collectFlatFields();
  const resume = window.normalizeResume(state);
  const text = JSON.stringify(resume, null, 2);

  navigator.clipboard.writeText(text).then(() => {
    toast(I18N.t('options.toast_exported'), 'success');
  }, () => {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resume.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function openImport() {
  document.getElementById('importText').value = '';
  document.getElementById('importErr').textContent = '';
  document.getElementById('importModal').classList.add('open');
  setTimeout(() => document.getElementById('importText').focus(), 40);
}

function closeImport() {
  document.getElementById('importModal').classList.remove('open');
}

function doImport() {
  const raw = document.getElementById('importText').value.trim();
  const errorNode = document.getElementById('importErr');

  if (!raw) {
    errorNode.textContent = I18N.t('options.import_empty');
    return;
  }

  let parsed;
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (error) {
    errorNode.textContent = I18N.t('options.import_error', { message: error.message });
    return;
  }

  state = window.normalizeResume(parsed);
  hydrate();
  closeImport();
  toast(I18N.t('options.toast_imported'), 'success');
}

document.querySelectorAll('[data-add]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const section = btn.dataset.add;
    state[section] = state[section] || [];
    state[section].push(window.blankEntry(section));
    renderArraySection(section);
    const container = document.querySelector(`[data-list="${section}"]`);
    container.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

document.getElementById('btn-save').addEventListener('click', save);
document.getElementById('btn-export').addEventListener('click', exportJson);
document.getElementById('btn-import').addEventListener('click', openImport);
document.getElementById('importCancel').addEventListener('click', closeImport);
document.getElementById('importOk').addEventListener('click', doImport);
document.getElementById('importModal').addEventListener('click', (event) => {
  if (event.target.id === 'importModal') closeImport();
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 's') {
    event.preventDefault();
    save();
  }
});

document.addEventListener('input', (event) => {
  const el = event.target;
  if (el.dataset && el.dataset.path) {
    setPath(state, el.dataset.path, el.value);
  }
});

window.addEventListener('resumefiller:languagechange', () => {
  hydrate();
  const saveBtn = document.getElementById('btn-save');
  if (!saveBtn.classList.contains('saved')) {
    saveBtn.textContent = I18N.t('options.btn_save');
  }
  chrome.storage.local.get('customFields', ({ customFields }) => {
    renderCustomFields(customFields || {});
  });
});

bindTagInput('skills', 'skills-editor', 'skills-input');
bindTagInput('languages', 'languages-editor', 'languages-input');

I18N.init().then(() => {
  chrome.storage.local.get(['resume', 'customFields'], ({ resume, customFields }) => {
    state = resume ? window.normalizeResume(resume) : window.emptyResume();
    hydrate();
    renderCustomFields(customFields || {});
  });
});

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
