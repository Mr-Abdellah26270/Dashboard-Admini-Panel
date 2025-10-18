(() => {
  const DEFAULT_LANG = 'ar';
  const FALLBACK_LANG = 'en';
  const STORAGE_KEY = 'selectedLanguage';

  // Cache: lang -> JSON translations
  const cache = new Map();
  let currentLang = null;
  let activeDict = null;

  const isRTL = (lang) => ['ar', 'fa', 'ur', 'he'].includes((lang || '').toLowerCase());

  const deepGet = (obj, path) =>
    path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);

  const merge = (base, override) => {
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const k in override) {
      if (override[k] && typeof override[k] === 'object' && !Array.isArray(override[k])) {
        out[k] = merge(base[k] || {}, override[k]);
      } else {
        out[k] = override[k];
      }
    }
    return out;
  };

  const numberFormatter = (lang) => new Intl.NumberFormat(lang);
  const dateFormatter = (lang) => new Intl.DateTimeFormat(lang, { dateStyle: 'medium' });

  const pluralRulesMap = {
    ar: new Intl.PluralRules('ar', { type: 'cardinal' }),
    en: new Intl.PluralRules('en', { type: 'cardinal' }),
    fr: new Intl.PluralRules('fr', { type: 'cardinal' })
  };

  const pickPlural = (lang, msgObj, count) => {
    const rules = pluralRulesMap[lang] || pluralRulesMap[FALLBACK_LANG];
    const category = rules.select(Number(count));
    return msgObj[category] ?? msgObj.other ?? String(count);
  };

  const interpolate = (str, params, lang) => {
    if (typeof str !== 'string') return str;
    return str.replace(/\{(\w+)(?:,\s*(number|date))?\}/g, (_, key, type) => {
      const val = params?.[key];
      if (val == null) return '';
      if (type === 'number') return numberFormatter(lang).format(Number(val));
      if (type === 'date') return dateFormatter(lang).format(new Date(val));
      return String(val);
    });
  };

  const loadJSON = async (lang) => {
    if (cache.has(lang)) return cache.get(lang);
    const res = await fetch(`./locales/${lang}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${lang}.json`);
    const json = await res.json();
    cache.set(lang, json);
    return json;
  };

  const loadTranslations = async (lang) => {
    const [fallback, chosen] = await Promise.allSettled([loadJSON(FALLBACK_LANG), loadJSON(lang)]);
    let merged = {};
    if (fallback.status === 'fulfilled') merged = fallback.value;
    if (chosen.status === 'fulfilled') merged = merge(merged, chosen.value);
    if (chosen.status !== 'fulfilled' && fallback.status !== 'fulfilled') {
      throw new Error('No translations available');
    }
    return merged;
  };

  const applyDirAndLang = (lang) => {
    const html = document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', isRTL(lang) ? 'rtl' : 'ltr');
  };

  const translateTextNode = (el, key, dict, lang, params = {}) => {
    const value = deepGet(dict, key);
    if (value == null) return;
    const ds = { ...el.dataset };
    if (typeof value === 'object' && 'other' in value) {
      const count = Number(params.count ?? ds.count ?? 0);
      const picked = pickPlural(lang, value, count);
      el.textContent = interpolate(picked, { ...ds, ...params, count }, lang);
    } else if (typeof value === 'string') {
      el.textContent = interpolate(value, { ...ds, ...params }, lang);
    }
  };

  const translateAttributes = (el, dict, lang) => {
    const attrsList = el.getAttribute('data-i18n-attr');
    if (!attrsList) return;
    const ds = { ...el.dataset };
    attrsList.split(',').map(a => a.trim()).forEach(attr => {
      const keyAttr = `data-i18n-key-${attr}`; // Use a consistent prefix 'data-i18n-key-*'
      const key = el.getAttribute(keyAttr) || el.dataset[`i18n${attr.charAt(0).toUpperCase() + attr.slice(1)}`]; // Legacy support
      if (!key) return;
      const val = deepGet(dict, key);
      if (val == null) return;
      if (typeof val === 'object') {
        const count = Number(ds.count ?? 0);
        el.setAttribute(attr, interpolate(pickPlural(lang, val, count), { ...ds, count }, lang));
      } else {
        el.setAttribute(attr, interpolate(val, ds, lang));
      }
    });
  };

  const applyTranslations = (dict, lang, root = document) => {
    if (!dict) return;

    // Elements with text translation
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      translateTextNode(el, key, dict, lang);
    });

    // Elements with attribute translation
    root.querySelectorAll('[data-i18n-attr]').forEach(el => translateAttributes(el, dict, lang));

    // Translate document title explicitly
    const titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) {
      const key = titleEl.getAttribute('data-i18n');
      translateTextNode(titleEl, key, dict, lang);
    }

    // Update language button current label if present
    const span = document.getElementById('current-lang-text');
    if (span) {
      span.textContent = deepGet(dict, 'app.current_language') || span.textContent;
    }
  };

  const observeDynamicContent = () => {
    const mo = new MutationObserver(muts => {
      const dict = activeDict || cache.get(currentLang);
      for (const m of muts) {
        m.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.hasAttribute('data-i18n') || node.hasAttribute('data-i18n-attr')) {
            applyTranslations(dict, currentLang, node);
          }
          node.querySelectorAll?.('[data-i18n], [data-i18n-attr]').forEach(child => applyTranslations(dict, currentLang, child));
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return mo;
  };

  const setLanguage = async (lang) => {
    try {
      const dict = await loadTranslations(lang);
      activeDict = dict;
      applyDirAndLang(lang);
      applyTranslations(dict, lang);
      localStorage.setItem(STORAGE_KEY, lang);
      currentLang = lang;
      cache.set(lang, dict);
      document.dispatchEvent(new CustomEvent('i18n:languageChanged', { detail: { lang } }));
    } catch (e) {
      console.error('[i18n] load failed, falling back:', e);
      if (lang !== FALLBACK_LANG) {
        try {
          const dict = await loadTranslations(FALLBACK_LANG);
          activeDict = dict;
          applyDirAndLang(FALLBACK_LANG);
          applyTranslations(dict, FALLBACK_LANG);
          localStorage.setItem(STORAGE_KEY, FALLBACK_LANG);
          currentLang = FALLBACK_LANG;
          cache.set(FALLBACK_LANG, dict);
          document.dispatchEvent(new CustomEvent('i18n:languageChanged', { detail: { lang: FALLBACK_LANG } }));
        } catch (err) {
          console.error('[i18n] fallback failed:', err);
        }
      }
    }
  };

  const detectInitialLang = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    const nav = navigator.languages?.[0] || navigator.language || DEFAULT_LANG;
    const base = String(nav).toLowerCase().split('-')[0];
    return ['ar', 'en', 'fr'].includes(base) ? base : DEFAULT_LANG;
  };

  const initLanguageSwitcher = () => {
    const languageSwitcher = document.querySelector('.language-switcher');
    const languageButton = document.querySelector('.language-button');
    const langOptions = document.querySelectorAll('.lang-option');

    if (languageButton && languageSwitcher) {
      languageButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = languageSwitcher.classList.toggle('open');
        languageButton.setAttribute('aria-expanded', String(open));
      });
    }

    document.addEventListener('click', () => {
      if (languageSwitcher?.classList.contains('open')) {
        languageSwitcher.classList.remove('open');
        languageButton?.setAttribute('aria-expanded', 'false');
      }
    });

    langOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.preventDefault();
        const selectedLang = option.getAttribute('data-lang');
        if (selectedLang && selectedLang !== currentLang) {
          setLanguage(selectedLang);
        }
        languageSwitcher?.classList.remove('open');
        languageButton?.setAttribute('aria-expanded', 'false');
      });
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    initLanguageSwitcher();
    const initial = detectInitialLang();
    setLanguage(initial);
    observeDynamicContent();
  });

  // Public API
  window.i18n = {
    t: (key, params = {}) => {
      const lang = currentLang || detectInitialLang();
      const dict = activeDict || cache.get(lang);
      if (!dict) return key;
      const val = deepGet(dict, key);
      if (val == null) return key;
      if (typeof val === 'object' && 'other' in val) {
        const count = params.count ?? 0;
        return interpolate(pickPlural(lang, val, count), params, lang);
      }
      if (typeof val === 'string') return interpolate(val, params, lang);
      return String(val);
    },
    setLanguage
  };
})();