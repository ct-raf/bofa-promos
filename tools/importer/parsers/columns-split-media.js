/* eslint-disable */
/* global WebImporter */

/**
 * columns-split-media: full-width band pairing a photo with copy (.content-tile).
 * Source shapes (same markup on EN and ES pages):
 *   - .content-tile__left:  .content-tile__img (picture) then .content-tile__column
 *   - .content-tile__right: .content-tile__column then .content-tile__img
 * .content-tile__column: H2 .content-tile__title, .content-tile__copy (paragraphs,
 * or ul.overview__items of icon + optional H3 + copy items), .content-tile__cta link,
 * optional .content-tile__legalCopy note (growyoursavings).
 * One row, two cells in source order: [picture] / [text]. No text is matched;
 * icon names are derived from the uc-icon-* class (same helper as cards-tile).
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

// paragraph holding an :icon: for the first named uc-icon glyph under root
function iconParagraph(root, document) {
  if (!root) return null;
  const glyph = [...root.querySelectorAll('.uc-icon')].find((g) => iconName(g));
  if (!glyph) return null;
  const name = iconName(glyph);
  const p = document.createElement('p');
  const span = document.createElement('span');
  span.className = `icon icon-${name}`;
  span.textContent = `:${name}:`;
  p.append(span);
  return p;
}

function imageFrom(img, document) {
  if (!img) return null;
  let src = img.getAttribute('src');
  if (!src || src.startsWith('data:')) {
    const source = img.closest('picture') && img.closest('picture').querySelector('source[srcset]');
    const srcset = img.getAttribute('srcset') || (source && source.getAttribute('srcset'));
    src = srcset ? srcset.split(',')[0].trim().split(/\s+/)[0] : src;
  }
  if (!src) return null;
  const out = document.createElement('img');
  out.src = src;
  if (img.getAttribute('alt')) out.alt = img.getAttribute('alt');
  return out;
}

function unwrap(root, selector) {
  root.querySelectorAll(selector).forEach((el) => el.replaceWith(...el.childNodes));
}

function cleanInto(tag, src, document) {
  const el = document.createElement(tag);
  el.innerHTML = src.innerHTML.trim();
  unwrap(el, 'span');
  el.querySelectorAll('[id]').forEach((n) => { if (!n.closest('sup')) n.removeAttribute('id'); });
  return el.textContent.trim() || el.querySelector('img') ? el : null;
}

function copyContent(copy, document) {
  const out = [];
  if (!copy) return out;
  [...copy.children].forEach((child) => {
    if (child.matches('ul.overview__items, ol.overview__items')) {
      // inline icon items: :icon: paragraph, H3, copy
      child.querySelectorAll(':scope > li').forEach((li) => {
        const icon = iconParagraph(li.querySelector('.overview-item__icon'), document);
        if (icon) out.push(icon);
        const h = li.querySelector('.overview-item__heading, h1, h2, h3, h4, h5, h6');
        const h3 = h && cleanInto('h3', h, document);
        if (h3) out.push(h3);
        const body = li.querySelector('.overview-item__copy');
        if (body) {
          const paras = body.querySelectorAll('p');
          (paras.length ? [...paras] : [body]).forEach((p) => {
            const clean = cleanInto('p', p, document);
            if (clean) out.push(clean);
          });
        }
      });
    } else if (child.tagName === 'P') {
      const p = cleanInto('p', child, document);
      if (p) out.push(p);
    } else if (child.tagName === 'UL' || child.tagName === 'OL') {
      const list = child.cloneNode(true);
      unwrap(list, 'span');
      out.push(list);
    } else if (/^H[1-6]$/.test(child.tagName)) {
      const h = cleanInto(child.tagName.toLowerCase(), child, document);
      if (h) out.push(h);
    } else if (child.textContent.trim()) {
      out.push(...copyContent(child, document));
    }
  });
  return out;
}

function textCell(column, document) {
  const content = [];
  const icon = iconParagraph(column.querySelector('.content-tile__icon'), document);
  if (icon) content.push(icon);

  const title = column.querySelector('.content-tile__title');
  const h2 = title && cleanInto('h2', title, document);
  if (h2) content.push(h2);

  content.push(...copyContent(column.querySelector('.content-tile__copy'), document));

  column.querySelectorAll('.content-tile__cta a[href]').forEach((a) => {
    if (!a.textContent.trim()) return;
    const p = document.createElement('p');
    const link = document.createElement('a');
    link.href = a.getAttribute('href');
    link.textContent = a.textContent.trim();
    p.append(link);
    content.push(p);
  });

  // legal note under the CTA (e.g. "See the Personal Schedule of Fees ..."), links kept
  content.push(...copyContent(column.querySelector('.content-tile__legalCopy'), document));
  return content;
}

export default function parse(element, { document }) {
  const cells = [];
  const parts = [...element.querySelectorAll('.content-tile__img, .content-tile__column')]
    .filter((el, i, all) => !all.some((o) => o !== el && o.contains(el)));

  const row = [];
  parts.forEach((part) => {
    if (part.classList.contains('content-tile__img')) {
      const img = imageFrom(part.querySelector('img'), document);
      row.push(img ? [img] : '');
    } else {
      row.push(textCell(part, document));
    }
  });
  while (row.length < 2) row.push('');
  cells.push(row);

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-split-media', cells });
  element.replaceWith(block);
}
