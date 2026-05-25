(function () {
  const LABELS = {
    de: {
      start: "Start",
      app: "App",
      tut: "Tutorial",
      example: "Beispiele",
      commands: "Befehle",
      spick: "Spick",
      pdf: "PDF",
      getstart: "Einstieg",
      videos: "Videos",
      price: "Preise",
      ai: "AI",
      gallery: "Galerie",
      login: "Login",
      impressum: "Impressum"
    },
    en: {
      start: "Home",
      app: "App",
      tut: "Tutorial",
      example: "Examples",
      commands: "Commands",
      spick: "Sheet",
      pdf: "PDF",
      getstart: "Start",
      videos: "Videos",
      price: "Prices",
      ai: "AI",
      gallery: "Gallery",
      login: "Login",
      impressum: "Legal"
    },
    fr: {
      start: "Accueil",
      app: "App",
      tut: "Tutoriel",
      example: "Exemples",
      commands: "Commandes",
      spick: "Memo",
      pdf: "PDF",
      getstart: "Depart",
      videos: "Videos",
      price: "Prix",
      ai: "AI",
      gallery: "Galerie",
      login: "Login",
      impressum: "Legal"
    },
    nl: {
      start: "Start",
      app: "App",
      tut: "Tutorial",
      example: "Voorbeelden",
      commands: "Commando",
      spick: "Spiek",
      pdf: "PDF",
      getstart: "Begin",
      videos: "Videos",
      price: "Prijzen",
      ai: "AI",
      gallery: "Galerij",
      login: "Login",
      impressum: "Impressum"
    },
    pl: {
      start: "Start",
      app: "App",
      tut: "Tutorial",
      example: "Przyklady",
      commands: "Komendy",
      spick: "Sciaga",
      pdf: "PDF",
      getstart: "Start",
      videos: "Filmy",
      price: "Ceny",
      ai: "AI",
      gallery: "Galeria",
      login: "Login",
      impressum: "Impressum"
    },
    it: {
      start: "Home",
      app: "App",
      tut: "Tutorial",
      example: "Esempi",
      commands: "Comandi",
      spick: "Guida",
      pdf: "PDF",
      getstart: "Avvio",
      videos: "Video",
      price: "Prezzi",
      ai: "AI",
      gallery: "Galleria",
      login: "Login",
      impressum: "Legale"
    }
  };

  const SUPPORTED_LANGS = ["de", "en", "fr", "nl", "pl", "it"];
  const LANGUAGE_LABELS = {
    de: "Sprache",
    en: "Language",
    fr: "Langue",
    nl: "Taal",
    pl: "Jezyk",
    it: "Lingua"
  };

  const MENU_ITEMS = [
    { key: "start", path: "/" },
    { key: "app", path: "/app.html" },
    { key: "tut", path: "/tut" },
    { key: "example", path: "/example" },
    { key: "commands", path: "/commands" },
    { key: "spick", path: "/spick" },
    { key: "pdf", path: "/docs/spickzettel-ultra-kompakt.pdf", target: "_blank", rel: "noopener", keepLang: false },
    { key: "getstart", path: "/getstart" },
    { key: "videos", path: "/videos" },
    { key: "price", path: "/price" },
    { key: "ai", path: "/ai" },
    { key: "gallery", path: "/gallery" },
    { key: "login", path: "/login" },
    { key: "impressum", path: "/impressum" }
  ];

  function currentLang() {
    const params = new URLSearchParams(window.location.search);
    const cookieLang = document.cookie
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("st_lang="))
      ?.split("=")[1];
    const lang = params.get("lang") || window.ST_LANG || cookieLang || document.documentElement.lang || "de";
    return LABELS[lang] ? lang : "de";
  }

  function setLangCookie(lang) {
    document.cookie = `st_lang=${lang};path=/;max-age=31536000;samesite=lax`;
  }

  function withLang(path, lang) {
    const url = new URL(path, window.location.origin);
    url.searchParams.set("lang", lang);
    return url.pathname + url.search + url.hash;
  }

  function currentPageWithLang(lang) {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", lang);
    return url.pathname + url.search + url.hash;
  }

  function labelFor(item, lang) {
    return LABELS[lang]?.[item.key] || LABELS.de[item.key] || item.key;
  }

  function renderMenu(container, lang) {
    if (!container) return;

    const fragment = document.createDocumentFragment();

    MENU_ITEMS.forEach((item) => {
      const link = document.createElement("a");
      link.href = item.keepLang === false ? item.path : withLang(item.path, lang);
      link.textContent = labelFor(item, lang);
      link.dataset.siteMenuItem = "1";

      if (item.target) link.target = item.target;
      if (item.rel) link.rel = item.rel;

      fragment.appendChild(link);
    });

    fragment.appendChild(renderLanguageMenu(lang));

    if (container.id === "helpMenu") {
      container
        .querySelectorAll("[data-site-menu-item]")
        .forEach((item) => item.remove());
      container.appendChild(fragment);
    } else {
      container.replaceChildren(fragment);
    }
  }

  function renderLanguageMenu(lang) {
    const wrap = document.createElement("div");
    wrap.className = "menu-language";
    wrap.dataset.siteMenuItem = "1";

    const label = document.createElement("span");
    label.className = "menu-language-label";
    label.textContent = LANGUAGE_LABELS[lang] || LANGUAGE_LABELS.de;
    wrap.appendChild(label);

    SUPPORTED_LANGS.forEach((code) => {
      const link = document.createElement("a");
      link.href = currentPageWithLang(code);
      link.textContent = code.toUpperCase();
      link.lang = code;
      link.className = code === lang ? "is-active" : "";
      link.addEventListener("click", () => setLangCookie(code));
      wrap.appendChild(link);
    });

    return wrap;
  }

  window.renderSchreinertoolMenus = function renderSchreinertoolMenus() {
    const lang = currentLang();
    setLangCookie(lang);
    renderMenu(document.getElementById("menuDropdown"), lang);
    renderMenu(document.getElementById("helpMenu"), lang);
  };
})();
