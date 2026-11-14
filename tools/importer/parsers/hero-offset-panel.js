/* eslint-disable */
/* global WebImporter */

/**
 * hero-offset-panel: photo with a colored text panel offset over it
 * (section.image-with-text-offset).
 * Source (same markup on EN and ES pages):
 *   .image-with-text-offset--background  <img>, or a CSS background copied onto
 *       the element as inline style="background-image:url(...)" by bofa-cleanup
 *   .image-with-text-offset__wrapper .image-with-text-offset__section
 *       H2 .image-with-text-offset__heading (--lead / --copy spans)
 *       .image-with-text-offset__copy paragraphs (link paragraph kept)
 * Row 1: photo. Row 2: optional lead paragraph, H2, paragraphs, link.
 * Either row is omitted when empty. No text is matched.
 */

function bgUrl(el) {
  const m = (el && el.getAttribute('style') || '').match(/background-image:\s*url\(\s*["']?([^"')]+)["']?\s*\)/i);
  return m ? m[1].trim() : null;
}

function photo(element, document) {
  const bg = element.querySelector('.image-with-text-offset--background');
  const img = (bg || element).querySelector(bg ? 'img' : ':scope > img, :scope > picture img');
  const src = img && img.getAttribute('src');
  const out = document.createElement('img');
  if (src && !src.startsWith('data:')) {
    out.src = src;
    if (img.getAttribute('alt')) out.alt = img.getAttribute('alt');
    return out;
  }
  const url = bgUrl(bg) || bgUrl(element);
  if (!url) return null;
  out.src = url;
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
  el.innerHTML = el.innerHTML.trim();
  return el.textContent.trim() || el.querySelector('img') ? el : null;
}

export default function parse(element, { document }) {
  const cells = [];

  const img = photo(element, document);
  if (img) cells.push([img]);

  const content = [];
  const section = element.querySelector('.image-with-text-offset__section') || element;

  const heading = section.querySelector('.image-with-text-offset__heading, h1, h2, h3');
  if (heading) {
    const lead = heading.querySelector('.image-with-text-offset__heading--lead');
    const leadP = lead && cleanInto('p', lead, document);
    if (leadP) content.push(leadP);
    const copySpan = heading.querySelector('.image-with-text-offset__heading--copy');
    const h2 = cleanInto('h2', copySpan || heading, document);
    if (h2) content.push(h2);
  }

  const copy = section.querySelector('.image-with-text-offset__copy');
  if (copy) {
    const blocks = [...copy.querySelectorAll('p, ul, ol')].filter((el) => !el.parentElement.closest('p, ul, ol'));
    (blocks.length ? blocks : [copy]).forEach((el) => {
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        const list = el.cloneNode(true);
        unwrap(list, 'span');
        content.push(list);
        return;
      }
      const p = cleanInto('p', el, document);
      if (p) content.push(p);
    });
  }

  // standalone CTA outside the copy (other instances of the component)
  section.querySelectorAll('.image-with-text-offset__section-lower a[href], a.cta[href]').forEach((a) => {
    if ((copy && copy.contains(a)) || !a.textContent.trim()) return;
    const p = document.createElement('p');
    const link = document.createElement('a');
    link.href = a.getAttribute('href');
    link.textContent = a.textContent.trim();
    p.append(link);
    content.push(p);
  });

  if (content.length) cells.push([content]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-offset-panel', cells });
  element.replaceWith(block);
}
