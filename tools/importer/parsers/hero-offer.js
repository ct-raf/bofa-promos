/* eslint-disable */
/* global WebImporter */

/**
 * hero-offer: offer masthead (section.masthead).
 * Row 1: background image (the masthead art, usually an animated GIF; the
 *        src is kept as-is so the GIF survives).
 * Row 2: eyebrow paragraph, H1 (with its <br> and bold line), copy paragraphs
 *        (footnote <sup> links kept), CTA link.
 * No text is matched, so EN and ES pages parse the same way.
 */

// background art: a direct <img> child of the masthead, else an inline
// background-image url on the masthead (copied from the per-instance CSS rule
// by bofa-cleanup). Image-only mastheads (debit-card-overview: no heading,
// copy or CTA) produce just this row.
function backgroundImage(element, document) {
  const img = element.querySelector(':scope > img, :scope > picture img');
  if (img && img.getAttribute('src') && !img.getAttribute('src').startsWith('data:')) {
    const out = document.createElement('img');
    out.src = img.getAttribute('src');
    if (img.getAttribute('alt')) out.alt = img.getAttribute('alt');
    return out;
  }
  const style = element.getAttribute('style') || '';
  const m = style.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i);
  if (m) {
    const out = document.createElement('img');
    out.src = m[1];
    return out;
  }
  return null;
}

// <p> copy with spans unwrapped (color/small-caps classes carry no meaning)
function cleanParagraph(src, document) {
  const p = document.createElement('p');
  p.innerHTML = src.innerHTML;
  p.querySelectorAll('span').forEach((s) => s.replaceWith(...s.childNodes));
  return p.textContent.trim() || p.querySelector('img') ? p : null;
}

export default function parse(element, { document }) {
  const cells = [];

  const bg = backgroundImage(element, document);
  if (bg) cells.push([bg]);

  const content = [];

  const lead = element.querySelector('.masthead__heading--lead');
  if (lead) {
    const p = cleanParagraph(lead, document);
    if (p) content.push(p);
  }

  const heading = element.querySelector('.masthead__heading h1, h1');
  if (heading) {
    const h1 = document.createElement('h1');
    h1.innerHTML = heading.innerHTML;
    h1.querySelectorAll('span').forEach((s) => s.replaceWith(...s.childNodes));
    content.push(h1);
  }

  const copy = element.querySelector('.masthead__copy');
  if (copy) {
    const paras = copy.querySelectorAll('p');
    if (paras.length) {
      paras.forEach((p) => {
        const clean = cleanParagraph(p, document);
        if (clean) content.push(clean);
      });
    } else {
      const clean = cleanParagraph(copy, document);
      if (clean) content.push(clean);
    }
  }

  const cta = element.querySelector('.masthead__section-lower a[href], a.cta[href]');
  if (cta && cta.textContent.trim()) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = cta.getAttribute('href');
    a.textContent = cta.textContent.trim();
    p.append(a);
    content.push(p);
  }

  if (content.length) cells.push([content]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-offer', cells });
  element.replaceWith(block);
}
