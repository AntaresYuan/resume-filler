// content.js — 扫页面、填能填的、报告填不了的
// 需要先加载 schema.js（见 manifest.json 的 content_scripts 顺序）

const FIELD_MAP = [
  { keys: ['firstname', 'first_name', 'given', '名字', '名（', '（名）', 'first name'], resumeKey: 'firstName' },
  { keys: ['lastname', 'last_name', 'family', 'surname', '姓氏', '（姓）', 'last name'], resumeKey: 'lastName' },
  { keys: ['name', 'fullname', 'full_name', '姓名', 'your name', 'applicant'], resumeKey: 'name' },
  { keys: ['email', 'e-mail', '邮箱', '电子邮件', 'mail'], resumeKey: 'email' },
  { keys: ['phone', 'mobile', 'tel', '电话', '手机', 'contact'], resumeKey: 'phone' },
  { keys: ['wechat', '微信'], resumeKey: 'wechat' },
  { keys: ['location', 'city', 'address', '城市', '地址', '所在地', 'residence', '期望城市', '工作城市'], resumeKey: 'location' },
  { keys: ['linkedin'], resumeKey: 'linkedin' },
  { keys: ['github'], resumeKey: 'github' },
  { keys: ['portfolio', 'website', '个人网站'], resumeKey: 'portfolio' },
  { keys: ['school', 'university', 'college', '学校', '院校', '毕业院校', '学校名称'], resumeKey: 'edu_school' },
  { keys: ['major', 'field of study', '专业', '专业名称'], resumeKey: 'edu_major' },
  { keys: ['degree', '学历', '学位'], resumeKey: 'edu_degree' },
  { keys: ['gpa', '绩点'], resumeKey: 'edu_gpa' },
  { keys: ['apply position', 'applied position', 'desired position', 'desired role', 'job title', 'jobtitle', '应聘职位', '求职意向', '期望职位', '目标岗位'], resumeKey: 'apply_position' },
  { keys: ['salary', 'expectation', 'expected salary', 'desired salary', '期望薪资', '薪资期望', '薪酬', '期望工资'], resumeKey: 'salary' },
  { keys: ['available', 'notice period', '到岗', '入职', '最早到岗', '到岗时间'], resumeKey: 'available_date' },
  { keys: ['years of experience', 'years experience', 'work experience years', '工作年限', '经验年限', '工龄'], resumeKey: 'years_exp' },
  { keys: ['company', 'employer', 'company name', '公司', '公司名称', '当前公司', '现公司', '工作单位'], resumeKey: 'current_company' },
  { keys: ['job title', 'position title', 'role title', '职位', '职位名称', '岗位名称', '担任职位'], resumeKey: 'current_title' },
  { keys: ['job description', 'work description', 'responsibilities', 'duties', '工作职责', '工作描述', '职责描述', '工作内容', '岗位职责'], resumeKey: 'job_description' },
  { keys: ['skills', 'skill', '技能', '专业技能'], resumeKey: 'skills' },
  { keys: ['language', 'languages', '语言'], resumeKey: 'languages' },
  { keys: ['summary', 'intro', 'introduction', 'about', 'self', '自我介绍', '个人简介', '自我描述', 'bio'], resumeKey: 'summary' },
  { keys: ['project name', '项目名称', '项目名'], resumeKey: 'project_name' },
  { keys: ['project description', 'project_desc', '项目描述'], resumeKey: 'project_description' },
];

const MULTI_ENTRY_SECTIONS = [
  {
    resumeKey: 'experience',
    sectionKeywords: ['工作经历', '工作经验', 'work experience', 'employment', 'full-time', 'full time'],
    flatEntry: (e) => ({
      current_company: e.company || '',
      current_title: e.title || '',
      job_description: e.description || '',
      location: e.location || '',
      _start_date: e.start_date || '',
      _end_date: e.end_date || '',
      _current: !!e.current,
    }),
  },
  {
    resumeKey: 'internship',
    sectionKeywords: ['实习经历', '实习经验', '实习', 'internship', 'intern experience'],
    flatEntry: (e) => ({
      current_company: e.company || '',
      current_title: e.title || '',
      job_description: e.description || '',
      location: e.location || '',
      _start_date: e.start_date || '',
      _end_date: e.end_date || '',
      _current: !!e.current,
    }),
  },
  {
    resumeKey: 'education',
    sectionKeywords: ['教育背景', '教育经历', '教育信息', '学历', 'education', 'academic'],
    flatEntry: (e) => ({
      edu_school: e.school || '',
      edu_major: e.major || '',
      edu_degree: e.degree || '',
      edu_gpa: e.gpa || '',
      _start_date: e.start_date || '',
      _end_date: e.end_date || '',
      _current: false,
    }),
  },
  {
    resumeKey: 'projects',
    sectionKeywords: ['项目经历', '项目经验', '项目', 'projects', 'project experience'],
    flatEntry: (e) => ({
      project_name: e.name || '',
      project_description: e.description || '',
      _start_date: e.start_date || '',
      _end_date: e.end_date || '',
      _current: false,
    }),
  },
];

// ─── 文本规范化 ─────────────────────────────────────────────────────────────

function normalize(str) {
  return (str || '').toLowerCase().replace(/[\s_\-.]/g, '');
}

function normalizeSpaced(str) {
  return (str || '').toLowerCase().replace(/[_\-.]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isCJKKey(str) {
  return /[\u4e00-\u9fff]/.test(str);
}

// ─── 字段标签识别（支持 label / aria / div / span 等） ──────────────────────

function getFieldLabel(el) {
  // 1. <label for="id">
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl) return (lbl.innerText || lbl.textContent || '').trim();
  }
  // 2. aria-label / aria-labelledby
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ref = document.getElementById(labelledBy);
    if (ref) return (ref.innerText || ref.textContent || '').trim();
  }
  // 3. 向上遍历，找直接子节点中的文字型标签（label / div / span / p）
  //    只取不包含 input 的短文本（< 60 字），这类通常是表单标签
  let parent = el.parentElement;
  for (let depth = 0; depth < 6 && parent; depth++) {
    for (const child of parent.children) {
      if (child.contains(el)) continue; // 跳过包含 el 的容器
      if (['LABEL', 'DIV', 'SPAN', 'P', 'DT', 'LEGEND', 'H4', 'H5', 'H6'].includes(child.tagName)) {
        if (child.querySelector('input, textarea, select')) continue; // 跳过含输入控件的容器
        const text = (child.innerText || child.textContent || '').trim();
        if (text.length > 0 && text.length < 60) return text;
      }
    }
    parent = parent.parentElement;
  }
  // 4. placeholder 兜底
  const ph = el.getAttribute('placeholder');
  if (ph && ph.length < 40) return ph;
  return el.name || el.id || '';
}

// ─── 字段匹配 ────────────────────────────────────────────────────────────────

const NAME_CONTEXT_BLOCKLIST = [
  'company', 'employer', 'organization', 'org', 'school', 'university',
  'college', 'institution', 'project', 'username', 'user', 'team', 'group',
  'job', 'position', 'role', 'product', 'brand', 'title',
];

function matchResumeKey(el) {
  const rawValues = [
    el.name,
    el.id,
    el.getAttribute('placeholder'),
    el.getAttribute('aria-label'),
    getFieldLabel(el),
  ];
  const signalsCJK = rawValues.map(normalize).join(' ');
  const signalsLatin = rawValues.filter(Boolean).map(normalizeSpaced);
  const signalsLatinJoined = signalsLatin.join(' ');

  for (const rule of FIELD_MAP) {
    for (const key of rule.keys) {
      let matched = false;
      if (isCJKKey(key)) {
        if (signalsCJK.includes(normalize(key))) matched = true;
      } else {
        const escaped = normalizeSpaced(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`);
        if (signalsLatin.some(s => re.test(s))) matched = true;
      }
      if (matched) {
        if (rule.resumeKey === 'name' || rule.resumeKey === 'firstName' || rule.resumeKey === 'lastName') {
          const blocked = NAME_CONTEXT_BLOCKLIST.some(w => signalsLatinJoined.includes(w));
          const blockedCJK =
            signalsCJK.includes('名称') || signalsCJK.includes('公司') ||
            signalsCJK.includes('职位') || signalsCJK.includes('岗位') ||
            signalsCJK.includes('专业') || signalsCJK.includes('学校') ||
            signalsCJK.includes('项目');
          if (blocked || blockedCJK) continue;
        }
        return rule.resumeKey;
      }
    }
  }
  return null;
}

// ─── input / textarea 填值 ───────────────────────────────────────────────────

function fillField(el, value) {
  if (!value) return;
  const tag = el.tagName.toLowerCase();
  if (tag !== 'input' && tag !== 'textarea') return;
  const proto = tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value');
  if (setter && setter.set) setter.set.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ─── 原生 <select> 填值 ──────────────────────────────────────────────────────

function tryFillSelect(el, value) {
  if (!value) return false;
  const v = normalize(String(value));
  const opts = Array.from(el.options);
  for (const opt of opts) {
    if (normalize(opt.text) === v || normalize(opt.value) === v) {
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  }
  for (const opt of opts) {
    const t = normalize(opt.text);
    if (t.length > 0 && (t.includes(v) || v.includes(t))) {
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  }
  return false;
}

// ─── 自定义下拉框（combobox / 非原生 select）─────────────────────────────────

async function tryFillCombobox(el, value) {
  if (!value) return false;
  const v = normalize(String(value));

  // 触发点击展开
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  el.click();
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

  // 等候下拉渲染
  await new Promise(r => setTimeout(r, 350));

  // 收集所有当前可见的 option 类元素
  const candidates = Array.from(document.querySelectorAll(
    '[role="option"], [role="listitem"], [role="menuitem"], li, .option, .item, .dropdown-item, .select-option'
  )).filter(opt => {
    if (!opt.offsetParent) return false;
    const rect = opt.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  let best = null;
  // 精确匹配
  for (const opt of candidates) {
    if (normalize(opt.textContent || '') === v) { best = opt; break; }
  }
  // 包含匹配
  if (!best) {
    for (const opt of candidates) {
      const t = normalize(opt.textContent || '');
      if (t.length > 0 && (t.includes(v) || v.includes(t))) { best = opt; break; }
    }
  }

  if (best) {
    best.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    best.click();
    best.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return true;
  }

  // 没找到 → 关闭下拉
  document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  document.body.click();
  return false;
}

// ─── 年 / 月 select 检测 ─────────────────────────────────────────────────────

function isYearSelect(el) {
  if (el.tagName.toLowerCase() !== 'select') return false;
  const opts = Array.from(el.options).filter(o => o.value !== '' && o.value !== '0');
  if (opts.length < 4) return false;
  // 先剥掉非数字（兼容 "2020年"、"2020" 等格式）
  const yearCount = opts.filter(o => {
    const digits = (o.value || o.text || '').replace(/[^\d]/g, '');
    return /^(19|20)\d{2}$/.test(digits);
  }).length;
  return yearCount >= opts.length * 0.5;
}

function isMonthSelect(el) {
  if (el.tagName.toLowerCase() !== 'select') return false;
  const opts = Array.from(el.options).filter(o => o.value !== '' && o.value !== '0');
  // 月份通常恰好 12 个选项（或 13 个含占位）
  if (opts.length < 4 || opts.length > 13) return false;
  const monthCount = opts.filter(o => {
    const digits = (o.value || '').replace(/[^\d]/g, '');
    const n = parseInt(digits !== '' ? digits : o.text);
    return !isNaN(n) && n >= 1 && n <= 12;
  }).length;
  return monthCount >= opts.length * 0.7;
}

// 从 "YYYY-MM" 取年
function yearFromDate(dateStr) {
  return (dateStr || '').split('-')[0] || '';
}

// 从 "YYYY-MM" 取月（整数字符串，无前导零）
function monthFromDate(dateStr) {
  const parts = (dateStr || '').split('-');
  if (parts.length < 2) return '';
  return String(parseInt(parts[1]));
}

// ─── 专用年份 select 填值（精确数字比对，不用 includes 避免"2021"命中"2020"）──

function fillYearSelect(el, yearStr) {
  const target = (yearStr || '').trim();
  if (!target) return false;
  for (const opt of el.options) {
    const digits = (opt.value || opt.text || '').replace(/[^\d]/g, '');
    if (digits === target || opt.value.trim() === target) {
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  }
  return false;
}

// ─── 专用月份 select 填值（整数比对，避免"10"命中"1"的 includes 污染）───────

function fillMonthSelect(el, monthStr) {
  const target = parseInt(monthStr);
  if (isNaN(target) || target < 1 || target > 12) return false;
  // 先按 option.value 的纯数字匹配
  for (const opt of el.options) {
    const digits = opt.value.replace(/[^\d]/g, '');
    if (digits !== '' && parseInt(digits) === target) {
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  }
  // 再按 option.text 的纯数字匹配（兼容 "三月" 等中文月名）
  for (const opt of el.options) {
    const digits = opt.text.replace(/[^\d]/g, '');
    if (digits !== '' && parseInt(digits) === target) {
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  }
  return false;
}

// ─── 自定义"年"/"月" picker 触发元素检测 ────────────────────────────────────
// 匹配 placeholder="年"/"月" 的 input，以及 div/span 类自定义 select

function findCustomDateTriggers(container) {
  const yearTriggers = [];
  const monthTriggers = [];

  function visRect(el) { const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; }

  // 1. input[placeholder="年/月"] — 最常见形式
  for (const el of container.querySelectorAll(
    'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit])'
  )) {
    if (!visRect(el)) continue;
    const ph = (el.getAttribute('placeholder') || '').trim();
    if (ph === '年' || /^yyyy$/i.test(ph)) yearTriggers.push(el);
    else if (ph === '月' || /^mm$/i.test(ph)) monthTriggers.push(el);
  }

  // 2. div/span 自定义 select（文本节点直接是"年"或"月"）
  for (const el of container.querySelectorAll(
    '[role="combobox"],[tabindex="0"],div[class*="select"],div[class*="year"],div[class*="month"],' +
    'span[class*="select"],span[class*="year"],span[class*="month"]'
  )) {
    if (!visRect(el) || el.tagName.toLowerCase() === 'select') continue;
    // 只看直接文本节点或第一个 span/em 子元素，不递归全文（避免容器误匹配）
    const directText = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim()).join('');
    const firstChildText = (el.querySelector('span,em,i,b')?.textContent || '').trim();
    const candidate = directText || firstChildText;
    if (candidate === '年') yearTriggers.push(el);
    else if (candidate === '月') monthTriggers.push(el);
  }

  return { yearTriggers, monthTriggers };
}

// ─── 点击自定义 picker 并选中目标值 ──────────────────────────────────────────

async function fillCustomComboOption(trigger, value) {
  if (!trigger || !value) return false;

  const OPT_SEL = [
    'li', '[role="option"]', '[role="listitem"]', '[role="menuitem"]',
    '[class*="year-item"]', '[class*="month-item"]', '[class*="date-item"]',
    '[class*="select-item"]', '[class*="picker-item"]', '[class*="cascader"]',
  ].join(',');

  const numVal = parseInt(value);

  // getBoundingClientRect 判断可见（offsetParent 对 position:fixed 元素不可靠）
  function isVis(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function matchOpt(list) {
    if (!isNaN(numVal)) {
      const m = list.find(el => {
        const d = (el.textContent || '').replace(/[^\d]/g, '');
        return d !== '' && parseInt(d) === numVal;
      });
      if (m) return m;
    }
    return list.find(el => (el.textContent || '').trim() === String(value).trim()) || null;
  }

  // 同时发 PointerEvent + MouseEvent（兼容只监听 pointer 的 Vue/React 组件）
  function doClick(el) {
    const init = { bubbles: true, cancelable: true };
    try { el.dispatchEvent(new PointerEvent('pointerover',  init)); } catch { /* PointerEvent unsupported */ }
    try { el.dispatchEvent(new PointerEvent('pointerenter', { ...init, bubbles: false })); } catch { /* PointerEvent unsupported */ }
    try { el.dispatchEvent(new PointerEvent('pointerdown',  init)); } catch { /* PointerEvent unsupported */ }
    el.dispatchEvent(new MouseEvent('mousedown', init));
    try { el.dispatchEvent(new PointerEvent('pointerup', init)); } catch { /* PointerEvent unsupported */ }
    el.dispatchEvent(new MouseEvent('mouseup',  init));
    el.dispatchEvent(new MouseEvent('click',    init));
  }

  // 点击前快照，用于找出真正因此次点击新出现的 option 元素
  const beforeSet = new Set(Array.from(document.querySelectorAll(OPT_SEL)).filter(isVis));

  // 关闭其他已打开的下拉
  doClick(document.body);
  await new Promise(r => setTimeout(r, 80));

  // 点击 trigger 本身 + 向上最多 3 层 wrapper（覆盖 input 在 div 内部的情况）
  doClick(trigger);
  if (trigger.tagName.toLowerCase() === 'input') trigger.focus();
  let p = trigger.parentElement;
  for (let i = 0; i < 3 && p && p !== document.body; i++) {
    if (['DIV', 'SPAN', 'A'].includes(p.tagName)) doClick(p);
    p = p.parentElement;
  }

  await new Promise(r => setTimeout(r, 520));

  // 新出现的 option 优先（最精确），兜底用全部可见 option
  const afterAll = Array.from(document.querySelectorAll(OPT_SEL)).filter(isVis);
  const newEls   = afterAll.filter(el => !beforeSet.has(el));

  const match = matchOpt(newEls) || matchOpt(afterAll);

  if (match) {
    doClick(match);
    await new Promise(r => setTimeout(r, 200));
    return true;
  }

  doClick(document.body);
  return false;
}

// ─── 在一个 DOM 容器内填日期 select + 自定义picker + 至今 checkbox ──────────
//    startDate / endDate: "YYYY-MM" 格式；isCurrent: boolean

async function fillDateAndCurrentInContainer(container, startDate, endDate, isCurrent) {
  // ── 原生 <select> 年月 ───────────────────────────────────────────────────
  const yearSelects  = Array.from(container.querySelectorAll('select')).filter(isYearSelect);
  const monthSelects = Array.from(container.querySelectorAll('select')).filter(isMonthSelect);

  const isStartCtx = (el) => /开始|起始|入学|入职|start|from|begin/.test(normalize(getFieldLabel(el)));
  const isEndCtx   = (el) => /结束|截止|毕业|离职|end|to$|until/.test(normalize(getFieldLabel(el)));

  if (yearSelects.length || monthSelects.length) {
    let startYears  = yearSelects.filter(isStartCtx);
    let endYears    = yearSelects.filter(isEndCtx);
    let startMonths = monthSelects.filter(isStartCtx);
    let endMonths   = monthSelects.filter(isEndCtx);

    if (!startYears.length && !endYears.length) { startYears = yearSelects.slice(0,1); endYears = yearSelects.slice(1,2); }
    if (!startMonths.length && !endMonths.length) { startMonths = monthSelects.slice(0,1); endMonths = monthSelects.slice(1,2); }

    if (startDate) {
      startYears.forEach(el  => fillYearSelect(el,  yearFromDate(startDate)));
      startMonths.forEach(el => fillMonthSelect(el, monthFromDate(startDate)));
    }
    if (!isCurrent && endDate) {
      endYears.forEach(el  => fillYearSelect(el,  yearFromDate(endDate)));
      endMonths.forEach(el => fillMonthSelect(el, monthFromDate(endDate)));
    }
  }

  // ── 自定义 "年"/"月" picker（input placeholder="年" 或 div 自定义 select）──
  const { yearTriggers, monthTriggers } = findCustomDateTriggers(container);

  if (yearTriggers.length || monthTriggers.length) {
    let startYearT  = yearTriggers.filter(isStartCtx);
    let endYearT    = yearTriggers.filter(isEndCtx);
    let startMonthT = monthTriggers.filter(isStartCtx);
    let endMonthT   = monthTriggers.filter(isEndCtx);

    if (!startYearT.length && !endYearT.length) { startYearT = yearTriggers.slice(0,1); endYearT = yearTriggers.slice(1,2); }
    if (!startMonthT.length && !endMonthT.length) { startMonthT = monthTriggers.slice(0,1); endMonthT = monthTriggers.slice(1,2); }

    if (startDate) {
      for (const tr of startYearT)  await fillCustomComboOption(tr, yearFromDate(startDate));
      for (const tr of startMonthT) await fillCustomComboOption(tr, monthFromDate(startDate));
    }
    if (!isCurrent && endDate) {
      for (const tr of endYearT)  await fillCustomComboOption(tr, yearFromDate(endDate));
      for (const tr of endMonthT) await fillCustomComboOption(tr, monthFromDate(endDate));
    }
  }

  // ── 至今 checkbox ─────────────────────────────────────────────────────────
  if (isCurrent) {
    for (const cb of container.querySelectorAll('input[type="checkbox"]')) {
      const lbl = (getFieldLabel(cb) || cb.parentElement?.textContent || '').trim();
      if (/至今|present|current|ongoing/i.test(lbl)) {
        if (!cb.checked) { cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); }
        break;
      }
    }
  }
}

// ─── 日期字段判断 ────────────────────────────────────────────────────────────

function isDateField(el) {
  const type = (el.getAttribute('type') || '').toLowerCase();
  if (['date', 'month', 'datetime-local'].includes(type)) return true;
  // year/month selects 不归入 isDateField，交给 fillDateAndCurrentInContainer 处理
  return false;
}

// ─── 可见 inputs ─────────────────────────────────────────────────────────────

function getVisibleInputs() {
  return Array.from(document.querySelectorAll(
    'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea'
  )).filter(el => el.offsetParent || el.type === 'email');
}

// ─── 批量填 inputs ────────────────────────────────────────────────────────────

function fillInputBatch(inputs, flat, filled, manual, skipSet) {
  for (const el of inputs) {
    if (skipSet && skipSet.has(el)) continue;
    if (isDateField(el)) {
      const label = getFieldLabel(el) || el.name || el.id || '日期字段';
      manual.push({ label: String(label).trim(), hint: '日期', value: null });
      continue;
    }
    const key = matchResumeKey(el);
    if (key && flat[key]) {
      fillField(el, flat[key]);
      filled.push(key);
    } else {
      const label = getFieldLabel(el);
      if (label && String(label).trim().length > 0) {
        const n = normalize(label);
        const boring = ['search', 'captcha', 'verify', 'code', 'password', 'username'].some(k => n.includes(k));
        if (!boring) {
          manual.push({ label: String(label).trim(), hint: '未匹配', value: null });
        }
      }
    }
  }
}

// ─── 找 section 的"添加"按钮 ─────────────────────────────────────────────────

function findAddButtonForSection(keywords) {
  const allEls = Array.from(document.querySelectorAll('*')).filter(el => {
    if (!el.offsetParent) return false;
    const ownText = (el.childNodes[0]?.nodeValue || '').trim();
    if (!ownText) return false;
    return keywords.some(kw => normalize(ownText).includes(normalize(kw)));
  });
  for (const heading of allEls) {
    let container = heading.parentElement;
    for (let i = 0; i < 10 && container; i++) {
      const btn = findAddBtnInContainer(container);
      if (btn) return btn;
      container = container.parentElement;
    }
  }
  return null;
}

function findAddBtnInContainer(container) {
  return Array.from(container.querySelectorAll('button, [role="button"], a, span, div'))
    .find(el => {
      if (!el.offsetParent) return false;
      const text = (el.textContent || '').trim();
      if (text.length > 20) return false;
      return /^[+＋]$|添加|新增|增加|\+\s*(add|experience|education|project)/i.test(text);
    }) || null;
}

// ─── 等新 inputs 出现 ─────────────────────────────────────────────────────────

function waitForNewInputs(knownSet, timeout = 2500) {
  return new Promise(resolve => {
    const getNew = () => getVisibleInputs().filter(el => !knownSet.has(el));
    const immediate = getNew();
    if (immediate.length > 0) { resolve(immediate); return; }
    const timer = setTimeout(() => { observer.disconnect(); resolve(getNew()); }, timeout);
    const observer = new MutationObserver(() => {
      const found = getNew();
      if (found.length > 0) { clearTimeout(timer); observer.disconnect(); resolve(found); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// 找一组新 inputs 的最小公共祖先容器
function commonAncestor(els) {
  if (!els.length) return document.body;
  let ancestor = els[0].parentElement;
  while (ancestor) {
    if (els.every(el => ancestor.contains(el))) return ancestor;
    ancestor = ancestor.parentElement;
  }
  return document.body;
}

// ─── 所有 section 的日期 + 多条目点"+"填写（合并 Phase 4 + Phase 6）──────────

async function fillAllSectionDates(resume, filled) {
  const allYearSels = Array.from(document.querySelectorAll('select'))
    .filter(el => el.offsetParent && isYearSelect(el));

  for (const section of MULTI_ENTRY_SECTIONS) {
    const entries = resume[section.resumeKey];
    if (!Array.isArray(entries) || entries.length === 0) continue;

    const addBtn = findAddButtonForSection(section.sectionKeywords);

    // ── 第一条：找 section 容器，填日期 select ───────────────────────────────
    const flatFirst = section.flatEntry(entries[0]);
    if (flatFirst._start_date || flatFirst._end_date || flatFirst._current) {
      let container = null;

      if (addBtn) {
        // 从 addBtn 向上找含年份 select（原生或自定义）的最小容器
        let p = addBtn.parentElement;
        for (let i = 0; i < 14 && p && p !== document.body; i++) {
          const hasNativeSel = Array.from(p.querySelectorAll('select')).some(isYearSelect);
          if (hasNativeSel) { container = p; break; }
          // 同时检测自定义年份 picker（input placeholder="年" 等）
          const { yearTriggers: customYears } = findCustomDateTriggers(p);
          if (customYears.length > 0) { container = p; break; }
          p = p.parentElement;
        }
      }

      // 找不到精确容器时：只有全页年份控件不多（≤4），才用 document.body
      // 避免多 section 页面乱填
      const allCustomYears = findCustomDateTriggers(document.body).yearTriggers;
      const totalYearControls = allYearSels.length + allCustomYears.length;
      if (!container && totalYearControls <= 4) container = document.body;

      if (container) {
        await fillDateAndCurrentInContainer(
          container,
          flatFirst._start_date,
          flatFirst._end_date,
          flatFirst._current
        );
      }
    }

    // ── 后续条目：点"+"并填写 ───────────────────────────────────────────────
    if (!addBtn || entries.length <= 1) continue;

    for (let i = 1; i < entries.length; i++) {
      const knownBefore = new Set(getVisibleInputs());
      addBtn.click();
      const newInputs = await waitForNewInputs(knownBefore);
      if (newInputs.length === 0) break;

      const entryFlat = section.flatEntry(entries[i]);
      fillInputBatch(newInputs, entryFlat, filled, [], null);

      const container = commonAncestor(newInputs);
      await fillDateAndCurrentInContainer(
        container,
        entryFlat._start_date,
        entryFlat._end_date,
        entryFlat._current
      );
    }
  }
}

// ─── 主消息处理 ───────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'fill') {
    handleFill(msg.resume, msg.customFields || {}).then(sendResponse);
    return true;
  }
  if (msg.action === 'ping') {
    sendResponse({ ok: true });
    return true;
  }
});

async function handleFill(resumeData, customFields) {
  let flat;
  if (typeof window.flattenResumeForFill === 'function') {
    flat = window.flattenResumeForFill(resumeData);
  } else {
    flat = resumeData || {};
  }

  const filled = [];
  const manual = [];

  // Phase 1：填所有可见 input / textarea
  fillInputBatch(getVisibleInputs(), flat, filled, manual, null);

  // Phase 2：原生 <select> 匹配填值
  for (const el of document.querySelectorAll('select')) {
    if (!el.offsetParent) continue;
    const label = getFieldLabel(el) || el.name || el.id || '下拉选择';

    // 年/月 select 交给日期模块处理
    if (isYearSelect(el) || isMonthSelect(el)) continue;

    const key = matchResumeKey(el);
    if (key && flat[key] && tryFillSelect(el, flat[key])) {
      filled.push(key);
    } else {
      const hint = key ? flat[key] || '—' : '—';
      manual.push({ label: String(label).trim(), hint: '下拉框', value: hint });
    }
  }

  // Phase 3：combobox / 自定义下拉
  const comboboxes = Array.from(document.querySelectorAll(
    '[role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="true"]'
  )).filter(el => el.offsetParent && el.tagName.toLowerCase() !== 'select');

  for (const el of comboboxes) {
    const key = matchResumeKey(el);
    if (key && flat[key]) {
      const ok = await tryFillCombobox(el, flat[key]);
      if (ok) filled.push(key);
    }
  }

  // Phase 4：富文本 / contenteditable
  for (const el of document.querySelectorAll('[contenteditable="true"], [role="textbox"]')) {
    const label = getFieldLabel(el) || '富文本编辑器';
    const key = matchResumeKey(el);
    manual.push({
      label: String(label).trim(),
      hint: '富文本',
      value: key && flat[key] ? flat[key] : null,
    });
  }

  // Phase 5：日期 select + 多条目（合并处理，按 section 定位容器避免乱填）
  const resume = typeof window.normalizeResume === 'function'
    ? window.normalizeResume(resumeData)
    : null;
  if (resume) await fillAllSectionDates(resume, filled);

  // Phase 7：用户学习到的自定义字段（label → value 精确匹配）
  if (customFields && typeof customFields === 'object') {
    // 把所有板块的条目打平成 { label: value }
    const allCustom = Object.values(customFields).reduce(
      (acc, section) => (typeof section === 'object' ? Object.assign(acc, section) : acc),
      {}
    );
    const customEntries = Object.entries(allCustom);
    if (customEntries.length > 0) {
      for (const el of getVisibleInputs()) {
        const label = getFieldLabel(el);
        if (!label) continue;
        const norm = normalize(label);
        for (const [cfLabel, cfValue] of customEntries) {
          if (normalize(cfLabel) === norm && cfValue) {
            fillField(el, String(cfValue));
            filled.push('custom:' + cfLabel);
            break;
          }
        }
      }
    }
  }

  return { filled, manual };
}
