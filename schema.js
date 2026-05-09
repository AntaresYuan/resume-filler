// schema.js — 结构化简历 schema、规范化、以及填表用的扁平化映射
// 同时被 popup.html、options.html、content.js 加载使用。

(function (global) {
  // 空白模板（也就是发给 LLM 的目标 JSON 结构）
  const RESUME_SCHEMA = {
    version: 1,
    basic: {
      name: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      wechat: "",
      location: "",
      linkedin: "",
      github: "",
      portfolio: ""
    },
    intent: {
      apply_position: "",
      salary: "",
      available_date: "",
      years_exp: ""
    },
    education: [
      {
        school: "",
        degree: "",
        major: "",
        gpa: "",
        start_date: "",
        end_date: "",
        location: "",
        description: ""
      }
    ],
    experience: [
      {
        company: "",
        title: "",
        location: "",
        start_date: "",
        end_date: "",
        current: false,
        description: ""
      }
    ],
    internship: [
      {
        company: "",
        title: "",
        location: "",
        start_date: "",
        end_date: "",
        current: false,
        description: ""
      }
    ],
    projects: [
      {
        name: "",
        role: "",
        link: "",
        start_date: "",
        end_date: "",
        description: ""
      }
    ],
    skills: [],
    languages: [],
    summary: ""
  };

  // 创建一个空白条目
  function blank(section) {
    const templates = {
      education: { school: "", degree: "", major: "", gpa: "", start_date: "", end_date: "", location: "", description: "" },
      experience: { company: "", title: "", location: "", start_date: "", end_date: "", current: false, description: "" },
      internship: { company: "", title: "", location: "", start_date: "", end_date: "", current: false, description: "" },
      projects: { name: "", role: "", link: "", start_date: "", end_date: "", description: "" }
    };
    return JSON.parse(JSON.stringify(templates[section] || {}));
  }

  function emptyResume() {
    // 深拷贝 schema，作为默认空值
    const clone = JSON.parse(JSON.stringify(RESUME_SCHEMA));
    // 模板里的占位条目去掉
    clone.education = [];
    clone.experience = [];
    clone.internship = [];
    clone.projects = [];
    return clone;
  }

  // 兼容旧版本扁平 schema → 升级为结构化
  function upgradeLegacy(data) {
    if (!data || typeof data !== "object") return emptyResume();
    // 如果已经是新结构，直接返回
    if (data.basic || data.intent || Array.isArray(data.education)) return data;

    const r = emptyResume();
    r.basic.name = data.name || "";
    r.basic.firstName = data.firstName || "";
    r.basic.lastName = data.lastName || "";
    r.basic.email = data.email || "";
    r.basic.phone = data.phone || "";
    r.basic.wechat = data.wechat || "";
    r.basic.location = data.location || "";
    r.basic.linkedin = data.linkedin || "";
    r.basic.github = data.github || "";
    r.basic.portfolio = data.portfolio || "";
    r.intent.apply_position = data.apply_position || "";
    r.intent.salary = data.salary || "";
    r.intent.available_date = data.available_date || "";
    r.intent.years_exp = data.years_exp || "";
    if (data.edu_school || data.edu_major || data.edu_gpa) {
      r.education.push({
        school: data.edu_school || "",
        degree: "",
        major: data.edu_major || "",
        gpa: data.edu_gpa || "",
        start_date: "",
        end_date: "",
        location: "",
        description: ""
      });
    }
    if (data.current_company) {
      r.experience.push({
        company: data.current_company,
        title: data.apply_position || "",
        location: "",
        start_date: "",
        end_date: "",
        current: true,
        description: ""
      });
    }
    r.summary = data.summary || "";
    return r;
  }

  // 把用户粘贴/导入的 JSON 规范化：补齐缺失字段，不抛错
  function normalizeResume(input) {
    const upgraded = upgradeLegacy(input);
    const out = emptyResume();

    const assignObj = (target, src, keys) => {
      if (!src || typeof src !== "object") return;
      keys.forEach(k => {
        if (typeof src[k] === "string") target[k] = src[k];
        else if (typeof src[k] === "number") target[k] = String(src[k]);
        else if (typeof src[k] === "boolean") target[k] = src[k];
      });
    };

    assignObj(out.basic, upgraded.basic, Object.keys(out.basic));
    assignObj(out.intent, upgraded.intent, Object.keys(out.intent));

    const arraySection = (name, sample) => {
      const src = Array.isArray(upgraded[name]) ? upgraded[name] : [];
      out[name] = src.map(item => {
        const clean = blank(name);
        if (!item || typeof item !== "object") return clean;
        Object.keys(clean).forEach(k => {
          if (typeof item[k] === "string") clean[k] = item[k];
          else if (typeof item[k] === "number") clean[k] = String(item[k]);
          else if (typeof item[k] === "boolean") clean[k] = item[k];
        });
        return clean;
      });
    };
    arraySection("education");
    arraySection("experience");
    arraySection("internship");
    arraySection("projects");

    out.skills = Array.isArray(upgraded.skills)
      ? upgraded.skills.filter(s => typeof s === "string")
      : [];
    out.languages = Array.isArray(upgraded.languages)
      ? upgraded.languages.filter(s => typeof s === "string")
      : [];
    out.summary = typeof upgraded.summary === "string" ? upgraded.summary : "";

    return out;
  }

  // 是否有任何有意义的内容
  function isResumeFilled(resume) {
    if (!resume || typeof resume !== "object") return false;
    const b = resume.basic || {};
    const hasBasic = Object.values(b).some(v => typeof v === "string" && v.trim());
    const hasIntent = resume.intent && Object.values(resume.intent).some(v => typeof v === "string" && v.trim());
    const hasArrays = ["education", "experience", "internship", "projects"]
      .some(k => Array.isArray(resume[k]) && resume[k].length > 0);
    const hasSummary = typeof resume.summary === "string" && resume.summary.trim();
    return hasBasic || hasIntent || hasArrays || hasSummary;
  }

  // 把结构化简历扁平成 content.js 使用的 key → value 映射
  // 策略：基本信息/意向直接取；多段经历取 experience[0] / education[0] / projects[0]（约定 LLM 按时间倒序）
  function flattenResumeForFill(resume) {
    const r = normalizeResume(resume);
    const flat = {};

    Object.assign(flat, r.basic);
    Object.assign(flat, r.intent);

    const edu = r.education[0] || {};
    flat.edu_school = edu.school || "";
    flat.edu_major = edu.major || (edu.degree ? edu.degree : "");
    flat.edu_degree = edu.degree || "";
    flat.edu_gpa = edu.gpa || "";
    flat.edu_start = edu.start_date || "";
    flat.edu_end = edu.end_date || "";

    const job = r.experience[0] || {};
    flat.current_company = job.company || "";
    flat.current_title = job.title || r.intent.apply_position || "";
    flat.job_start = job.start_date || "";
    flat.job_end = job.end_date || "";
    flat.job_description = job.description || "";

    const proj = r.projects[0] || {};
    flat.project_name = proj.name || "";
    flat.project_description = proj.description || "";

    flat.skills = Array.isArray(r.skills) ? r.skills.join(", ") : "";
    flat.languages = Array.isArray(r.languages) ? r.languages.join(", ") : "";
    flat.summary = r.summary || "";

    return flat;
  }

  global.RESUME_SCHEMA = RESUME_SCHEMA;
  global.blankEntry = blank;
  global.emptyResume = emptyResume;
  global.normalizeResume = normalizeResume;
  global.isResumeFilled = isResumeFilled;
  global.flattenResumeForFill = flattenResumeForFill;
})(typeof window !== "undefined" ? window : globalThis);
