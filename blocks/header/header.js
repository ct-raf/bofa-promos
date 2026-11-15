import { getMetadata } from '../../scripts/aem.js';

// mobile-first: desktop layout from 900px
const isDesktop = window.matchMedia('(width >= 900px)');

/**
 * Normalizes a nav document path from page metadata (e.g. "/nav-debitcard", "/es/nav").
 * Strips a "/content" prefix and extensions so local and DA/EDS fetches never collide.
 * @param {string} value metadata value
 * @returns {string} path like "/es/nav-offer", or "" when not set / invalid
 */
function cleanNavPath(value) {
  if (!value) return '';
  let p = value.trim();
  try { p = new URL(p, window.location.origin).pathname; } catch { return ''; }
  p = p.replace(/^\/content(?=\/)/, '').replace(/(\.plain)?\.html$/, '').replace(/\/$/, '');
  return /^\/[\w/-]+$/.test(p) ? p : '';
}

/**
 * Fetches the nav fragment: /content/... first (local aem up), then the site root (DA/EDS).
 * The default nav keeps the fixed dual fetch; per-page navs use the same two locations.
 * @param {string} navPath normalized nav path
 * @returns {Promise<Response|null>}
 */
async function fetchNav(navPath) {
  let resp;
  if (!navPath || navPath === '/nav') {
    resp = await fetch('/content/nav.plain.html');
    if (!resp.ok) resp = await fetch('/nav.plain.html');
  } else {
    resp = await fetch('/content'.concat(navPath, '.plain.html'));
    if (!resp.ok) resp = await fetch(navPath.concat('.plain.html'));
  }
  return resp.ok ? resp : null;
}

/** Resolves relative image/link URLs in the fragment against the fragment's own URL. */
function resolveRelativeUrls(root, baseUrl) {
  root.querySelectorAll('img[src], source[srcset]').forEach((el) => {
    const attr = el.hasAttribute('src') ? 'src' : 'srcset';
    const val = el.getAttribute(attr);
    if (!/^(https?:|data:|\/)/.test(val)) el.setAttribute(attr, new URL(val, baseUrl).pathname + new URL(val, baseUrl).search);
  });
}

/** Classifies the fragment's top-level sections by content: brand (logo), menu (list), tools. */
function classifySections(fragment) {
  const sections = [...fragment.children].filter((s) => s.tagName === 'DIV');
  const brand = sections.find((s) => s.querySelector('img'));
  const menu = sections.find((s) => s !== brand && s.querySelector('ul'));
  const tools = sections.find((s) => s !== brand && s !== menu && s.querySelector('a'));
  // layout: language link before the logo => utility bar on top + tabs (current page marked)
  const utilityFirst = !!(tools && brand && sections.indexOf(tools) < sections.indexOf(brand));
  return {
    brand, menu, tools, utilityFirst,
  };
}

function samePage(href) {
  try {
    const url = new URL(href, window.location.href);
    const clean = (p) => p.replace(/(\.plain)?\.html$/, '')
      .replace(/\/$/, '')
      .replace(/^\/content(?=\/)/, '');
    return url.origin === window.location.origin
      && clean(url.pathname) === clean(window.location.pathname);
  } catch { return false; }
}

function setExpanded(item, expanded) {
  item.classList.toggle('is-open', expanded);
  const toggle = item.querySelector(':scope > .nav-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', String(expanded));
}

function closeAll(nav, except) {
  nav.querySelectorAll('.nav-item.is-open').forEach((item) => { if (item !== except) setExpanded(item, false); });
}

/**
 * Builds the menu list: top-level links, optional dropdown lists with a toggle button.
 * @param {Element} menuSection fragment section holding the <ul>
 * @param {object} labels { expand } accessible label template
 * @returns {Element} ul.nav-menu
 */
function buildMenu(menuSection, label) {
  const src = menuSection.querySelector('ul');
  const ul = document.createElement('ul');
  ul.className = 'nav-menu nav-list';
  [...src.children].forEach((li, i) => {
    const link = li.querySelector(':scope > a, :scope > p > a');
    const sub = li.querySelector(':scope > ul');
    const item = document.createElement('li');
    item.className = 'nav-item';
    if (link) {
      link.className = 'nav-link nav-trigger';
      if (samePage(link.href)) link.setAttribute('aria-current', 'page');
      item.append(link);
    }
    if (sub) {
      item.classList.add('nav-item-expandable');
      const id = `nav-dropdown-${i}`;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'nav-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', id);
      toggle.setAttribute('aria-label', label.replace('{0}', link ? link.textContent.trim() : ''));
      sub.className = 'nav-dropdown';
      sub.id = id;
      sub.querySelectorAll('a').forEach((a) => { if (samePage(a.href)) a.setAttribute('aria-current', 'page'); });
      item.append(toggle, sub);
    }
    ul.append(item);
  });
  return ul;
}

function wireDropdowns(nav) {
  nav.querySelectorAll('.nav-item.nav-item-expandable').forEach((item) => {
    const toggle = item.querySelector(':scope > .nav-toggle');
    // desktop: hover opens, like the source
    item.addEventListener('mouseenter', () => {
      if (!isDesktop.matches) return;
      closeAll(nav, item);
      setExpanded(item, true);
    });
    item.addEventListener('mouseleave', () => { if (isDesktop.matches) setExpanded(item, false); });
    // keyboard / touch / mobile: the chevron toggles
    toggle.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      closeAll(nav, item);
      setExpanded(item, open);
    });
  });
  nav.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = nav.querySelector('.nav-item.is-open');
    if (open) {
      setExpanded(open, false);
      open.querySelector(':scope > .nav-toggle')?.focus();
    } else if (!isDesktop.matches && nav.classList.contains('menu-open')) {
      nav.querySelector('.nav-hamburger')?.click();
      nav.querySelector('.nav-hamburger')?.focus();
    }
  });
  nav.addEventListener('focusout', (e) => {
    if (isDesktop.matches && !nav.contains(e.relatedTarget)) closeAll(nav);
  });
}

function buildHamburger(nav, sections, labels) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'nav-hamburger';
  button.setAttribute('aria-controls', sections.id);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', labels.open);
  button.innerHTML = '<span class="nav-hamburger-icon" aria-hidden="true"></span>';
  button.addEventListener('click', () => {
    const open = !nav.classList.contains('menu-open');
    nav.classList.toggle('menu-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? labels.close : labels.open);
    if (!open) closeAll(nav);
  });
  return button;
}

/**
 * loads and decorates the header
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const navPath = cleanNavPath(getMetadata('nav'));
  const resp = await fetchNav(navPath);
  if (!resp) return;
  const fragment = document.createElement('div');
  fragment.innerHTML = await resp.text();
  resolveRelativeUrls(fragment, resp.url);

  const lang = document.documentElement.lang || 'en';
  const es = lang.startsWith('es');
  // control labels only (no content copy): screen-reader names for generated buttons
  const labels = es
    ? {
      open: 'Abrir menú', close: 'Cerrar menú', expand: 'Mostrar {0}', nav: 'Principal',
    }
    : {
      open: 'Open menu', close: 'Close menu', expand: 'Show {0} menu', nav: 'Main',
    };

  const {
    brand, menu, tools, utilityFirst,
  } = classifySections(fragment);
  const variant = (navPath || '/nav').split('/').pop();
  block.closest('header')?.classList.add(`header-${variant}`);

  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.className = utilityFirst ? 'nav nav-utility-first' : 'nav';
  nav.setAttribute('aria-label', labels.nav);

  // skip link (copy from the fragment), target = main
  const skip = brand && [...brand.querySelectorAll('a[href^="#"]')].find((a) => !a.querySelector('img'));
  if (skip) {
    const main = document.querySelector('main');
    if (main) {
      main.id = main.id || 'main';
      main.setAttribute('tabindex', '-1');
      skip.setAttribute('href', `#${main.id}`);
    }
    skip.className = 'nav-skip';
    nav.append(skip);
  }

  // language switch: counterpart page from page metadata "alternate", fragment href as fallback
  let langLink = null;
  if (tools) {
    langLink = tools.querySelector('a');
    const alternate = getMetadata('alternate');
    if (alternate) langLink.href = alternate;
    const other = es ? 'en' : 'es';
    langLink.setAttribute('lang', other);
    langLink.setAttribute('hreflang', other);
    langLink.className = 'nav-lang';
  }

  if (utilityFirst && langLink) {
    const utility = document.createElement('div');
    utility.className = 'nav-utility';
    utility.append(langLink);
    nav.append(utility);
  }

  const top = document.createElement('div');
  top.className = 'nav-top';
  if (brand) {
    const logo = brand.querySelector('a:has(img)') || brand.querySelector('img');
    if (logo.tagName === 'A') logo.className = 'nav-brand';
    top.append(logo);
  }
  if (langLink && !utilityFirst) {
    const toolsEl = document.createElement('div');
    toolsEl.className = 'nav-tools';
    toolsEl.append(langLink);
    top.append(toolsEl);
  }
  nav.append(top);

  if (menu) {
    const sections = document.createElement('div');
    sections.className = 'nav-sections';
    sections.id = 'nav-sections';
    sections.append(buildMenu(menu, labels.expand));
    // mobile: the language switch sits inside the open menu (copy hidden on desktop)
    if (langLink) {
      const mobileLang = document.createElement('p');
      mobileLang.className = 'nav-sections-lang';
      mobileLang.append(langLink.cloneNode(true));
      sections.append(mobileLang);
    }
    top.append(buildHamburger(nav, sections, labels));
    nav.append(sections);
    wireDropdowns(nav);
  } else {
    nav.classList.add('nav-no-menu');
  }

  // crossing the breakpoint: close everything and reset the mobile menu
  isDesktop.addEventListener('change', () => {
    closeAll(nav);
    nav.classList.remove('menu-open');
    const burger = nav.querySelector('.nav-hamburger');
    if (burger) {
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', labels.open);
    }
  });

  block.textContent = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';
  wrapper.append(nav);
  block.append(wrapper);
}
