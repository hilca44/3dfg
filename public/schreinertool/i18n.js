(function () {
  const DEFAULT_LANG = "de";
  const SUPPORTED_LANGS = ["de", "en", "fr", "nl", "pl", "it"];

  function normalizeLang(lang) {
    return SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  }

  function readLangFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const cookieLang = document.cookie
      .split(";")
      .map(v => v.trim())
      .find(v => v.startsWith("st_lang="))
      ?.split("=")[1];
    return normalizeLang(params.get("lang") || cookieLang);
  }

  function setCookie(lang) {
    document.cookie = `st_lang=${lang};path=/;max-age=31536000;samesite=lax`;
  }

  function withLang(href, lang) {
    const url = new URL(href, window.location.href);
    url.searchParams.set("lang", lang);
    return url.pathname + url.search + url.hash;
  }

  async function loadMessages(lang) {
    const res = await fetch(`./i18n/${lang}.json`);
    if (!res.ok) throw new Error(`Could not load language: ${lang}`);
    return res.json();
  }

  function applyText(messages) {
    document.documentElement.lang = messages.lang || window.ST_LANG;

    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.dataset.i18n;
      const value = key.split(".").reduce((obj, part) => obj?.[part], messages);
      if (value) el.textContent = value;
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      const value = key.split(".").reduce((obj, part) => obj?.[part], messages);
      if (value) el.placeholder = value;
    });

    document.querySelectorAll("[data-i18n-href]").forEach(el => {
      const lang = el.dataset.i18nHref;
      el.href = withLang(el.getAttribute("href") || window.location.href, lang);
    });

    if (messages.colors && window.colors) {
      Object.entries(messages.colors).forEach(([key, label]) => {
        if (window.colors[key]) window.colors[key].de = label;
      });
    }
  }

  window.ST_LANG = readLangFromUrl();
  setCookie(window.ST_LANG);

  window.ST_I18N_READY = loadMessages(window.ST_LANG)
    .then(messages => {
      window.ST_I18N = messages;
      applyText(messages);
      window.dispatchEvent(new CustomEvent("st:i18n", { detail: messages }));
      return messages;
    })
    .catch(err => {
      console.warn(err);
      return null;
    });
})();
