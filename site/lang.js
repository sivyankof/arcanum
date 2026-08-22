// Arcanum — переключение языка публичных страниц.
// Без сети и без сохранения состояния: язык вычисляется заново на каждой загрузке
// страницы из ?lang=, иначе из языка браузера, иначе английский по умолчанию.
// Без этого скрипта (JS отключён) видны подряд все четыре языковые секции —
// прятать их должен ТОЛЬКО этот файл, а не style.css.
(function () {
  var SUPPORTED = ['ru', 'en', 'es', 'pt'];
  var FALLBACK = 'en';

  // Свои страницы сайта — только им дописывается ?lang=, внешние ссылки не трогаем
  var SITE_PAGES = ['index.html', 'privacy.html', 'terms.html', 'support.html', ''];

  function detectLang() {
    var query = new URLSearchParams(window.location.search).get('lang');
    if (query && SUPPORTED.indexOf(query) !== -1) {
      return query;
    }

    var deviceLang = (navigator.language || '').slice(0, 2).toLowerCase();
    if (SUPPORTED.indexOf(deviceLang) !== -1) {
      return deviceLang;
    }

    return FALLBACK;
  }

  function showLang(lang) {
    document.documentElement.lang = lang;

    var sections = document.querySelectorAll('[data-lang]');
    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      section.hidden = section.getAttribute('data-lang') !== lang;
    }
  }

  function highlightSwitch(lang) {
    var links = document.querySelectorAll('[data-lang-link]');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var isActive = link.getAttribute('data-lang-link') === lang;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }

  // Чтобы язык не терялся при переходе между страницами сайта, дописываем
  // текущий ?lang= ко всем ссылкам на index/privacy/terms/support (переключатель
  // языка сам задаёт lang в href — его не трогаем).
  function carryLang(lang) {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (link.hasAttribute('data-lang-link')) {
        continue;
      }

      var href = link.getAttribute('href');
      if (!href) {
        continue;
      }

      var withoutHash = href.split('#')[0];
      var path = withoutHash.split('?')[0];
      if (SITE_PAGES.indexOf(path) === -1) {
        continue;
      }

      var hash = href.indexOf('#') !== -1 ? href.slice(href.indexOf('#')) : '';
      link.setAttribute('href', path + '?lang=' + lang + hash);
    }
  }

  var lang = detectLang();
  showLang(lang);
  highlightSwitch(lang);
  carryLang(lang);
})();
