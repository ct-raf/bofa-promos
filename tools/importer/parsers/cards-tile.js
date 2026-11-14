/* eslint-disable */
/* global WebImporter */

/**
 * cards-tile: centered tiles (media on top, H3, copy, optional CTA).
 * Source shapes (same markup on EN and ES pages):
 *   - section.features consumer-flag-carousel.features__items > .features__item
 *       icon-font glyph (.features__icon .uc-icon.uc-icon-*), H2 title, copy
 *   - section.tiles > .tiles__item
 *       .tiles__media picture/img, .tiles__copy (H3 + paragraphs), .tiles__cta link
 *   - .multi-step-content .newQualiwrapper > .multi-step-content__items > .multi-step-content-item
 *       .multi-step-content-item__icon img, H3 .multi-step-content-item__heading,
 *       .multi-step-content-item__copy paragraphs (growyoursavings)
 * One row per item: [image or :icon:, body (H3, paragraphs, optional CTA)].
 * No text is matched; icon names are derived from the uc-icon-* class.
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

function imageFrom(img, document) {
  if (!img) return null;
  let src = img.getAttribute('src');
  if (!src || src.startsWith('data:')) {
    const srcset = img.getAttribute('srcset')
      || (img.closest('picture') && img.closest('picture').querySelector('source[srcset]')
        && img.closest('picture').querySelector('source[srcset]').getAttribute('srcset'));
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

function cleanParagraph(src, document) {
  const p = document.createElement('p');
  p.innerHTML = src.innerHTML;
  unwrap(p, 'span');
  p.querySelectorAll('[id]').forEach((el) => { if (!el.closest('sup')) el.removeAttribute('id'); });
  return p.textContent.trim() || p.querySelector('img') ? p : null;
}

function heading(src, document) {
  if (!src || !src.textContent.trim()) return null;
  // Card title (text cell, styled as a heading): keep the source level (H2-H4), default H3.
  const level = /^H[2-4]$/.test(src.tagName) ? src.tagName.toLowerCase() : 'h3';
  const h = document.createElement(level);
  h.innerHTML = src.innerHTML.trim();
  unwrap(h, 'span');
  // tile titles are bold by design; drop the wrapping <b>/<strong>
  unwrap(h, 'b, strong');
  h.innerHTML = h.innerHTML.trim();
  return h;
}

function parseItem(item, document) {
  // media: picture/img, else icon-font glyph
  let media = imageFrom(item.querySelector('.tiles__media img, .features__icon img, .multi-step-content-item__icon img, picture img'), document);
  if (!media) {
    const glyph = item.querySelector('.features__icon .uc-icon, .uc-icon');
    const name = glyph && iconName(glyph);
    if (name) {
      media = document.createElement('span');
      media.className = `icon icon-${name}`;
      media.textContent = `:${name}:`;
    }
  }

  const body = [];
  const copyRoot = item.querySelector('.tiles__copy, .features__items-wrapper') || item;
  const titleEl = item.querySelector('.features__item--title, .multi-step-content-item__heading')
    || copyRoot.querySelector('h1, h2, h3, h4, h5, h6');
  const h = heading(titleEl, document);
  if (h) body.push(h);

  copyRoot.querySelectorAll('p, ul, ol').forEach((el) => {
    if (titleEl && titleEl.contains(el)) return;
    if (el.closest('.tiles__cta')) return;
    if (el.tagName === 'P') {
      if (el.closest('li')) return;
      const p = cleanParagraph(el, document);
      if (p) body.push(p);
    } else if (!el.parentElement.closest('ul, ol')) {
      const list = el.cloneNode(true);
      unwrap(list, 'span');
      body.push(list);
    }
  });

  item.querySelectorAll('.tiles__cta a[href]').forEach((a) => {
    if (!a.textContent.trim()) return;
    const p = document.createElement('p');
    const link = document.createElement('a');
    link.href = a.getAttribute('href');
    link.textContent = a.textContent.trim();
    p.append(link);
    body.push(p);
  });

  if (!media && !body.length) return null;
  return [media || '', body];
}

export default function parse(element, { document }) {
  const cells = [];
  let items = [...element.querySelectorAll('.features__item, .tiles__item, .multi-step-content-item')];
  // keep outermost items only (no double selection); .multi-step-content-item is
  // the stable inner wrapper of each .multi-step-content__items cell
  items = items.filter((it) => !items.some((o) => o !== it && o.contains(it)));
  items.forEach((item) => {
    const row = parseItem(item, document);
    if (row) cells.push(row);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-tile', cells });
  element.replaceWith(block);
}
