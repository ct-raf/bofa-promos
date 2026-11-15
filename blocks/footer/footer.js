import { getMetadata } from '../../scripts/aem.js';

/**
 * Normalizes a footer document path from page metadata (e.g. "/es/footer").
 * Strips a "/content" prefix and extensions so the local and DA/EDS fetches never collide.
 * @param {string} value metadata value
 * @returns {string} path like "/es/footer", or "" when not set / invalid
 */
function cleanPath(value) {
  if (!value) return '';
  let p = value.trim();
  try { p = new URL(p, window.location.origin).pathname; } catch { return ''; }
  p = p.replace(/^\/content(?=\/)/, '').replace(/(\.plain)?\.html$/, '').replace(/\/$/, '');
  return /^\/[\w/-]+$/.test(p) ? p : '';
}

/**
 * Fetches the footer fragment: /content/... first (local aem up), then the site root (DA/EDS).
 * The default footer keeps the fixed dual fetch; per-page footers use the same two locations.
 * @param {string} footerPath normalized path
 * @returns {Promise<Response|null>}
 */
async function fetchFooter(footerPath) {
  let resp;
  if (!footerPath || footerPath === '/footer') {
    resp = await fetch('/content/footer.plain.html');
    if (!resp.ok) resp = await fetch('/footer.plain.html');
  } else {
    resp = await fetch('/content'.concat(footerPath, '.plain.html'));
    if (!resp.ok) resp = await fetch(footerPath.concat('.plain.html'));
  }
  return resp.ok ? resp : null;
}

/** Resolves relative image URLs in the fragment against the fragment's own URL. */
function resolveRelativeUrls(root, baseUrl) {
  root.querySelectorAll('img[src], source[srcset]').forEach((el) => {
    const attr = el.hasAttribute('src') ? 'src' : 'srcset';
    const val = el.getAttribute(attr);
    if (!/^(https?:|data:|\/)/.test(val)) {
      const url = new URL(val, baseUrl);
      el.setAttribute(attr, url.pathname + url.search);
    }
  });
}

const isExternal = (a) => {
  try { return new URL(a.href).origin !== window.location.origin; } catch { return false; }
};

/** Keeps the copyright year current (the source updates it with script). */
function updateYear(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const year = String(new Date().getFullYear());
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (/©\s*\d{4}/.test(n.textContent)) n.textContent = n.textContent.replace(/(©\s*)\d{4}/, `$1${year}`);
  }
}

/**
 * Turns a fragment section that starts with a heading into a modal dialog. The footer link
 * whose text matches the heading opens it.
 */
function buildDialog(section, index, links, labels) {
  const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
  const title = heading.textContent.trim().toLowerCase();
  const trigger = links.find((a) => a.textContent.trim().toLowerCase() === title);
  if (!trigger) return null;

  const dialog = document.createElement('dialog');
  dialog.className = 'footer-dialog';
  dialog.setAttribute('closedby', 'any');
  heading.id = heading.id || `footer-dialog-title-${index}`;
  dialog.setAttribute('aria-labelledby', heading.id);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'footer-dialog-close';
  close.setAttribute('aria-label', labels.close);
  close.innerHTML = '<span aria-hidden="true">×</span>';
  close.addEventListener('click', () => dialog.close());

  const body = document.createElement('div');
  body.className = 'footer-dialog-body';
  body.append(...section.childNodes);
  dialog.append(close, body);

  // light dismiss for browsers without closedby support
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      const inside = r.top <= e.clientY && e.clientY <= r.bottom
        && r.left <= e.clientX && e.clientX <= r.right;
      if (!inside) dialog.close();
    });
  }

  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    dialog.showModal();
  });
  return dialog;
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const resp = await fetchFooter(cleanPath(getMetadata('footer')));
  if (!resp) return;
  const fragment = document.createElement('div');
  fragment.innerHTML = await resp.text();
  resolveRelativeUrls(fragment, resp.url);

  const es = (document.documentElement.lang || 'en').startsWith('es');
  // control labels only (no content copy): screen-reader text for generated behaviour
  const labels = es
    ? { close: 'Cerrar', newTab: 'se abre en una nueva sección o ventana navegador' }
    : { close: 'Close', newTab: 'opens in a new browser tab or window' };

  const sections = [...fragment.children].filter((s) => s.tagName === 'DIV');
  const main = sections.find((s) => !s.querySelector(':scope > h1, :scope > h2, :scope > h3')) || sections[0];
  if (!main) return;

  const band = document.createElement('div');
  band.className = 'footer-band';

  [...main.children].forEach((p) => {
    const onlyLinkedImage = p.querySelector('a img') && !p.textContent.trim();
    if (onlyLinkedImage) {
      p.className = 'footer-brand';
    } else if (p.querySelector('a')) {
      p.className = 'footer-legal';
    } else {
      p.className = 'footer-copyright';
    }
    band.append(p);
  });

  // inline icons (images outside links) are decorative; their size comes from the image file.
  // An icon that opens its line leads the text; any other icon trails the link before it.
  band.querySelectorAll('img').forEach((img) => {
    if (img.closest('a')) return;
    const icon = img.closest('picture') || img;
    let prev = icon.previousSibling;
    while (prev && prev.nodeType === Node.TEXT_NODE && !prev.textContent.trim()) {
      prev = prev.previousSibling;
    }
    const leads = !prev || prev.nodeName === 'BR';
    img.classList.add('footer-icon', leads ? 'footer-icon-lead' : 'footer-icon-trail');
    img.setAttribute('aria-hidden', 'true');
    img.alt = '';
  });

  const links = [...band.querySelectorAll('a')];
  links.forEach((a) => {
    if (!isExternal(a)) return;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    const text = a.textContent.trim() || a.querySelector('img')?.alt || '';
    if (text) a.setAttribute('aria-label', `${text} ${labels.newTab}`);
  });
  updateYear(band);

  // the page's own legal code (page metadata), shown as the last line
  const code = getMetadata('legal-code');
  if (code) {
    const p = document.createElement('p');
    p.className = 'footer-code';
    p.textContent = code;
    band.append(p);
  }

  const dialogs = sections
    .filter((s) => s !== main && s.querySelector('h1, h2, h3, h4, h5, h6'))
    .map((s, i) => buildDialog(s, i, links, labels))
    .filter(Boolean);

  block.textContent = '';
  block.append(band, ...dialogs);
}
