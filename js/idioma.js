/* El conmutador de idioma de las páginas de adentro que están en los dos
   idiomas a la vez (la lista de notas, la calculadora de batería). Es lo mismo que hace main.js en la
   portada, sin lo demás, y con la misma llave: el idioma que se eligió en la
   portada es el que se ve aquí, y al revés. */

(() => {
  'use strict';

  const $$ = s => Array.from(document.querySelectorAll(s));

  function aplicar(lang) {
    document.body.dataset.idioma = lang;
    document.documentElement.lang = lang;
    for (const el of $$('[data-es][data-en]')) el.textContent = el.dataset[lang];
    for (const el of $$('[data-aria-es][data-aria-en]')) {
      el.setAttribute('aria-label', lang === 'en' ? el.dataset.ariaEn : el.dataset.ariaEs);
    }
    for (const a of $$('[data-href-es][data-href-en]')) {
      a.setAttribute('href', lang === 'en' ? a.dataset.hrefEn : a.dataset.hrefEs);
    }
    for (const b of $$('[data-set-idioma]')) {
      b.setAttribute('aria-pressed', String(b.dataset.setIdioma === lang));
    }
    try { localStorage.setItem('idioma', lang); } catch (e) { /* sin almacenamiento */ }
    // para las páginas que arman texto con código (la calculadora de batería)
    document.dispatchEvent(new CustomEvent('idioma', { detail: lang }));
  }

  for (const b of $$('[data-set-idioma]')) {
    b.addEventListener('click', () => aplicar(b.dataset.setIdioma));
  }

  let inicial = 'es';
  try {
    const g = localStorage.getItem('idioma');
    if (g === 'es' || g === 'en') inicial = g;
    else if ((navigator.language || '').slice(0, 2) === 'en') inicial = 'en';
  } catch (e) {
    if ((navigator.language || '').slice(0, 2) === 'en') inicial = 'en';
  }
  aplicar(inicial);
})();
