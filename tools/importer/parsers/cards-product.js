/* eslint-disable */
/* global WebImporter */

/**
 * cards-product: product comparison cards (.product-details__productList).
 * One row per .product-details__productItem, one text cell in the order
 * blocks/cards-product expects:
 *   header: H3 title, eyebrow, intro, CTA (Open account) in its own <p>
 *   body:   fee, Learn more link (own <p>), feature paragraphs
 * The block splits header/body after the first link-only paragraph (the CTA),
 * so no <hr> is emitted. Intro/description bullet lists are kept as lists in
 * source order. CD option cards (growyoursavings CDs/IRAs) have no fee/desc
 * containers: H3, eyebrow, feature list, then the Learn more CTA at the
 * bottom, so the whole card is header content, as in the source where all of
 * it sits in .product-details__productItemHeader. The hidden "accessible
 * version" toggle is a <button> outside the list and never matched; the empty
 * .product-details__productTab placeholders are removed by bofa-cleanup.
 * Decorative .horizontal-line separator paragraphs are dropped. No text is
 * matched, so EN and ES pages parse the same way.
 */

// no text besides nbsp/whitespace, and no image
function blank(el) {
  return !el.textContent.replace(/ /g, ' ').trim() && !el.querySelector('img');
}

function cleanParagraph(src, document) {
  const p = document.createElement('p');
  p.innerHTML = src.innerHTML;
  p.querySelectorAll('span').forEach((s) => s.replaceWith(...s.childNodes));
  // separator rows hold only &nbsp;
  return blank(p) ? null : p;
}

// bullet list (feature list on the CD cards): spans unwrapped, empty items dropped
function cleanList(src, document) {
  const list = document.createElement(src.tagName.toLowerCase());
  src.querySelectorAll(':scope > li').forEach((li) => {
    if (blank(li)) return;
    const item = document.createElement('li');
    item.innerHTML = li.innerHTML.trim();
    item.querySelectorAll('span').forEach((s) => s.replaceWith(...s.childNodes));
    item.querySelectorAll('[id]').forEach((n) => { if (!n.closest('sup')) n.removeAttribute('id'); });
    item.innerHTML = item.innerHTML.trim();
    // trailing <br> left by the source editor
    while (item.lastChild && item.lastChild.nodeName === 'BR') item.lastChild.remove();
    list.append(item);
  });
  return list.children.length ? list : null;
}

// paragraphs and bullet lists of a copy container, in source order
function paragraphs(container, document) {
  if (!container) return [];
  if (!container.querySelector('p, ul, ol')) {
    const clean = cleanParagraph(container, document);
    return clean ? [clean] : [];
  }
  const out = [];
  [...container.children].forEach((el) => {
    if (el.tagName === 'P') {
      if (el.querySelector('.horizontal-line') && blank(el)) return;
      const clean = cleanParagraph(el, document);
      if (clean) out.push(clean);
    } else if (el.tagName === 'UL' || el.tagName === 'OL') {
      const list = cleanList(el, document);
      if (list) out.push(list);
    } else if (el.querySelector('p, ul, ol')) {
      out.push(...paragraphs(el, document));
    }
  });
  return out;
}

function linkParagraph(a, document) {
  const p = document.createElement('p');
  const link = document.createElement('a');
  link.href = a.getAttribute('href');
  if (a.getAttribute('title')) link.title = a.getAttribute('title');
  link.textContent = a.textContent.trim();
  p.append(link);
  return p;
}

export default function parse(element, { document }) {
  const cells = [];

  element.querySelectorAll('.product-details__productItem').forEach((item) => {
    const content = [];

    // optional card image (none on the current pages)
    const img = item.querySelector('.product-details__productImage img, .product-details__productItemHeader > img');

    const title = item.querySelector('.product-details__productTitle, h3');
    if (title && title.textContent.trim()) {
      const h3 = document.createElement('h3');
      h3.innerHTML = title.innerHTML;
      h3.querySelectorAll('span').forEach((s) => s.replaceWith(...s.childNodes));
      content.push(h3);
    }

    content.push(...paragraphs(item.querySelector('.product-details__productIntro'), document));

    const cta = item.querySelector('.product-details__productCTA a[href]');
    if (cta && cta.textContent.trim()) content.push(linkParagraph(cta, document));

    content.push(...paragraphs(item.querySelector('.product-details__productKeyDesc'), document));
    content.push(...paragraphs(item.querySelector('.product-details__productDesc'), document));

    if (!content.length) return;
    if (img) cells.push([img.cloneNode(true), content]);
    else cells.push([content]);
  });

  // keep the table rectangular when only some cards have an image
  const width = Math.max(1, ...cells.map((r) => r.length));
  cells.forEach((r) => { while (r.length < width) r.unshift(''); });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-product', cells });
  element.replaceWith(block);
}
