/* eslint-disable */
/* global WebImporter */

/**
 * columns-media-card: promo card with copy and a lifestyle photo (uc-content-card.uc-card).
 * One row, two cells:
 *   1. logo image + H2 heading + copy paragraphs (footnote sups, inline Learn more link)
 *   2. photo (the uc-background image)
 * Also handles section.preferred-cards (debit-card-overview):
 *   photo (.preferred-cards__cardImg: <img> child, else inline background-image
 *   copied there by bofa-cleanup) + H3, copy, benefit list, inline links,
 *   CTA(s). The photo cell keeps its visual side (image-left / image-right
 *   class, else DOM order).
 * No text is matched, so EN and ES pages parse the same way.
 */

function imageFrom(img, document) {
  if (!img || !img.getAttribute('src')) return null;
  const out = document.createElement('img');
  out.src = img.getAttribute('src');
  if (img.getAttribute('alt')) out.alt = img.getAttribute('alt');
  return out;
}

function cleanParagraph(src, document) {
  const p = document.createElement('p');
  p.innerHTML = src.innerHTML;
  p.querySelectorAll('span').forEach((s) => s.replaceWith(...s.childNodes));
  return p.textContent.trim() ? p : null;
}

function backgroundImage(el, document) {
  if (!el) return null;
  const m = (el.getAttribute('style') || '').match(/background-image:\s*url\(\s*["']?([^"')]+)["']?\s*\)/i);
  if (!m) return null;
  const out = document.createElement('img');
  out.src = m[1].trim();
  return out;
}

function unwrap(root, selector) {
  root.querySelectorAll(selector).forEach((el) => el.replaceWith(...el.childNodes));
}

// copy element (p / ul / ol) with presentational spans, screen-reader duplicates,
// ids and leading/trailing <br> removed; null when empty
function cleanCopy(src, document) {
  const el = document.createElement(src.tagName.toLowerCase());
  el.innerHTML = src.innerHTML;
  el.querySelectorAll('.ada-invisible').forEach((n) => n.remove());
  unwrap(el, 'span');
  el.querySelectorAll('[id]').forEach((n) => { if (!n.closest('sup')) n.removeAttribute('id'); });
  el.querySelectorAll('[class]').forEach((n) => n.removeAttribute('class'));
  const trimBr = (first) => {
    for (;;) {
      const node = first ? el.firstChild : el.lastChild;
      if (!node) return;
      if (node.nodeType === 3 && !node.textContent.trim()) node.remove();
      else if (node.nodeType === 1 && node.tagName === 'BR') node.remove();
      else return;
    }
  };
  trimBr(true);
  trimBr(false);
  return el.textContent.trim() || el.querySelector('img') ? el : null;
}

function linkParagraph(a, document) {
  const p = document.createElement('p');
  const link = document.createElement('a');
  link.href = a.getAttribute('href');
  link.textContent = a.textContent.trim();
  p.append(link);
  return p;
}

function parsePreferredCard(element, document) {
  const card = element.querySelector('.preferred-cards__cardWrapper') || element;
  const imgWrap = card.querySelector('.preferred-cards__cardImg');
  const photo = (imgWrap && (imageFrom(imgWrap.querySelector('img'), document)
    || backgroundImage(imgWrap, document))) || null;

  const text = [];
  const content = card.querySelector('.preferred-cards__contentWrapper, .preferred-cards__cardContent') || card;
  const heading = content.querySelector('.preferred-cards__heading, h1, h2, h3, h4, h5, h6');
  if (heading && heading.textContent.trim()) {
    const level = /^H[1-6]$/.test(heading.tagName) ? heading.tagName.toLowerCase() : 'h3';
    const h = document.createElement(level);
    h.innerHTML = heading.innerHTML.trim();
    unwrap(h, 'span');
    h.innerHTML = h.innerHTML.trim();
    text.push(h);
  }

  content.querySelectorAll('.preferred-cards__subHeading, .preferred-cards__disclaimer').forEach((root) => {
    root.querySelectorAll('p, ul, ol').forEach((el) => {
      if (el.parentElement.closest('p, ul, ol')) return;
      const clean = cleanCopy(el, document);
      if (clean) text.push(clean);
    });
  });

  // CTA links outside the copy (Watch video, Learn more)
  content.querySelectorAll('a[href]').forEach((a) => {
    if (a.closest('.preferred-cards__subHeading, .preferred-cards__disclaimer, sup, p, li')) return;
    if (heading && heading.contains(a)) return;
    if (!a.textContent.trim()) return;
    text.push(linkParagraph(a, document));
  });

  let photoFirst;
  if (card.classList.contains('image-left')) photoFirst = true;
  else if (card.classList.contains('image-right')) photoFirst = false;
  else {
    photoFirst = !!(imgWrap && card.querySelector('.preferred-cards__cardContent')
      && (imgWrap.compareDocumentPosition(card.querySelector('.preferred-cards__cardContent')) & 4));
  }
  return photoFirst ? [[photo || '', text]] : [[text, photo || '']];
}

// uc-content-card.uc-card (checking-offer): [text, photo]
function parseUcCard(element, document) {
  const text = [];

  const logo = imageFrom(
    element.querySelector('.uc-heading__parsys img, .uc-card__heading uc-image img'),
    document,
  );
  if (logo) text.push(logo);

  const heading = element.querySelector('.uc-heading__headline, .uc-card__heading h2, h2');
  if (heading && heading.textContent.trim()) {
    const level = /^H[1-6]$/.test(heading.tagName) ? heading.tagName.toLowerCase() : 'h2';
    const h = document.createElement(level);
    h.innerHTML = heading.innerHTML.trim();
    text.push(h);
  }

  const sub = element.querySelector('.uc-heading__subheadline');
  const copyRoot = sub || element.querySelector('.uc-card__container-text');
  if (copyRoot) {
    copyRoot.querySelectorAll('p').forEach((p) => {
      if (heading && heading.contains(p)) return;
      const clean = cleanParagraph(p, document);
      if (clean) text.push(clean);
    });
  }

  // standalone link outside the copy paragraphs (other card variants)
  const textRoot = element.querySelector('.uc-card__container-text') || element;
  textRoot.querySelectorAll('a[href]').forEach((a) => {
    if (a.closest('p') || a.closest('sup') || !a.textContent.trim()) return;
    const p = document.createElement('p');
    const link = document.createElement('a');
    link.href = a.getAttribute('href');
    link.textContent = a.textContent.trim();
    p.append(link);
    text.push(p);
  });

  const photo = imageFrom(
    element.querySelector('.uc-background__container img, uc-background img'),
    document,
  );

  return [[text, photo || '']];
}

export default function parse(element, { document }) {
  const isPreferredCard = element.matches('.preferred-cards, .preferred-cards__cardWrapper')
    || !!element.querySelector('.preferred-cards__cardWrapper');
  const cells = isPreferredCard
    ? parsePreferredCard(element, document)
    : parseUcCard(element, document);
  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-media-card', cells });
  element.replaceWith(block);
}
