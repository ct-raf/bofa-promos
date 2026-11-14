/* eslint-disable */
/* global WebImporter */

/**
 * cards-icon-inline: row of short cross-sell pointers
 * (section.features .features__items > .features__item).
 * Each item: icon-font glyph (.features__icon .uc-icon.uc-icon-*) beside a
 * sentence with an inline link (.features__item--copy p).
 * One row per item: [:icon: (or small image), body paragraphs with links kept].
 * No text is matched; icon names are derived from the uc-icon-* class (same
 * helper as cards-tile), so EN and ES pages parse the same way.
 */

// uc-icon class -> icon name. The icon set prefixes UI glyphs with a generic
// namespace (action-, interactive-) that is dropped; domain namespaces
// (finance-, ...) are part of the name. e.g. uc-icon-action-lock -> lock,
// uc-icon-finance-accounts -> finance-accounts.
const UI_ICON_NAMESPACES = ['action-', 'interactive-'];
function iconName(el) {
  const cls = [...el.classList].find((c) => /^uc-icon-[a-z0-9-]+$/.test(c));
  if (!cls) return null;
  let name = cls.replace(/^uc-icon-/, '');
  const ns = UI_ICON_NAMESPACES.find((p) => name.startsWith(p) && name.length > p.length);
  if (ns) name = name.slice(ns.length);
  return name;
}

function unwrap(root, selector) {
  root.querySelectorAll(selector).forEach((el) => el.replaceWith(...el.childNodes));
}

function cleanParagraph(src, document) {
  const p = document.createElement('p');
  p.innerHTML = src.innerHTML.trim();
  unwrap(p, 'span');
  p.querySelectorAll('[id]').forEach((el) => { if (!el.closest('sup')) el.removeAttribute('id'); });
  return p.textContent.trim() || p.querySelector('img') ? p : null;
}

function media(item, document) {
  const img = item.querySelector('.features__icon img');
  if (img && img.getAttribute('src') && !img.getAttribute('src').startsWith('data:')) {
    const out = document.createElement('img');
    out.src = img.getAttribute('src');
    if (img.getAttribute('alt')) out.alt = img.getAttribute('alt');
    return out;
  }
  const glyph = [...item.querySelectorAll('.uc-icon')].find((g) => iconName(g));
  if (!glyph) return null;
  const name = iconName(glyph);
  const span = document.createElement('span');
  span.className = `icon icon-${name}`;
  span.textContent = `:${name}:`;
  return span;
}

export default function parse(element, { document }) {
  const cells = [];
  element.querySelectorAll('.features__item').forEach((item) => {
    const body = [];
    const copy = item.querySelector('.features__item--copy') || item.querySelector('.features__items-wrapper');
    if (copy) {
      const paras = copy.querySelectorAll('p');
      (paras.length ? [...paras] : [copy]).forEach((p) => {
        const clean = cleanParagraph(p, document);
        if (clean) body.push(clean);
      });
    }
    const icon = media(item, document);
    if (!icon && !body.length) return;
    cells.push([icon || '', body]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-icon-inline', cells });
  element.replaceWith(block);
}
