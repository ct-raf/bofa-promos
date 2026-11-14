import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * A paragraph whose only content is one link (a CTA or a "learn more" link).
 * @param {Element} el
 */
function isLinkOnly(el) {
  if (el.tagName !== 'P') return false;
  const links = el.querySelectorAll('a');
  return links.length === 1 && el.textContent.trim() === links[0].textContent.trim();
}

/**
 * Split a card's text into a header (title, eyebrow, intro, primary CTA)
 * and a body (fee, links, feature list). An authored <hr> wins; otherwise
 * the split falls after the first link-only paragraph. No split point means
 * everything stays in the body.
 * @param {Element} cell
 */
function splitCard(cell) {
  const children = [...cell.children];
  let splitAt = children.findIndex((el) => el.tagName === 'HR');
  let dropSplit = splitAt !== -1;
  if (splitAt === -1) {
    const cta = children.findIndex(isLinkOnly);
    splitAt = cta === -1 ? -1 : cta + 1;
    dropSplit = false;
  }

  const header = document.createElement('div');
  header.className = 'cards-product-card-header';
  const body = document.createElement('div');
  body.className = 'cards-product-card-body';

  children.forEach((el, i) => {
    if (dropSplit && i === splitAt) return;
    if (splitAt !== -1 && i < splitAt) header.append(el);
    else body.append(el);
  });
  // Paragraphs after the first link-only one in the body are the feature list.
  const firstLink = [...body.children].findIndex(isLinkOnly);
  if (firstLink !== -1) {
    [...body.children].slice(firstLink + 1).forEach((el) => el.classList.add('cards-product-feature'));
  }
  return [header, body].filter((el) => el.children.length);
}

/**
 * Cards (product): one row per card, one text cell per card.
 * An optional picture-only cell becomes the card image.
 * @param {Element} block
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture'));
    if (!cells.length) return;
    const li = document.createElement('li');
    cells.forEach((cell) => {
      if (cell.children.length === 1 && cell.querySelector('picture') && !cell.textContent.trim()) {
        cell.className = 'cards-product-card-image';
        li.append(cell);
      } else {
        li.append(...splitCard(cell));
      }
    });
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
  block.replaceChildren(ul);
}
