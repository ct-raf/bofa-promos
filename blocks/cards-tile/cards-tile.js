import { createOptimizedPicture, decorateIcons } from '../../scripts/aem.js';

/** Images narrower than this (natural px) are spot icons, not photos. */
const GRAPHIC_MAX_WIDTH = 200;

/**
 * Turns a cell holding only `:name:` icon notation (left as text when the
 * pipeline did not convert it) into an EDS icon span.
 * @param {Element} cell
 */
function convertIconText(cell) {
  if (cell.querySelector('picture, img, span.icon')) return;
  const match = cell.textContent.trim().match(/^:([a-z0-9-]+):$/i);
  if (!match) return;
  const span = document.createElement('span');
  span.className = `icon icon-${match[1].toLowerCase()}`;
  cell.replaceChildren(span);
  decorateIcons(cell);
}

/**
 * A cell that only holds media: one picture or an :icon: span, no text.
 * @param {Element} cell
 */
function isMediaCell(cell) {
  const media = cell.querySelectorAll('picture, span.icon');
  return media.length === 1 && cell.textContent.trim() === '';
}

/**
 * Drops empty paragraphs authors (or imports) leave at the end of a cell.
 * @param {Element} cell
 */
function removeEmptyParagraphs(cell) {
  cell.querySelectorAll(':scope > p').forEach((p) => {
    if (!p.textContent.trim() && !p.querySelector('picture, img, span.icon')) p.remove();
  });
}

/**
 * Marks a trailing paragraph that holds nothing but one link as the tile CTA.
 * @param {Element} li
 * @param {Element} body
 */
function markCta(li, body) {
  const last = body.lastElementChild;
  if (!last || last.tagName !== 'P') return;
  const links = last.querySelectorAll('a[href]');
  if (links.length !== 1 || last.textContent.trim() !== links[0].textContent.trim()) return;
  last.classList.add('cards-tile-cta');
  li.classList.add('cards-tile-has-cta');
}

/**
 * Photo or spot icon? Decided from the image's natural width once it is known.
 * @param {HTMLImageElement} img
 * @param {Element} li
 */
function classifyImage(img, li) {
  const apply = () => {
    if (!img.naturalWidth) return;
    const graphic = img.naturalWidth < GRAPHIC_MAX_WIDTH;
    li.classList.toggle('cards-tile-graphic', graphic);
    li.classList.toggle('cards-tile-photo', !graphic);
  };
  if (img.complete) apply();
  img.addEventListener('load', apply);
}

/**
 * Cards (tile): one row per tile, a media cell (image or :icon:) shown on top,
 * then a body cell (heading, copy, optional CTA). Either cell may be missing,
 * and the cells may come in either order.
 *
 * Tile classes (on the li): cards-tile-icon (:icon: font-style icon),
 * cards-tile-graphic (small spot image), cards-tile-photo (large image),
 * cards-tile-has-cta (standalone link at the end), cards-tile-no-image.
 * @param {Element} block
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture, img, span.icon'));
    if (!cells.length) return;
    const li = document.createElement('li');
    let media = null;
    cells.forEach((cell) => {
      convertIconText(cell);
      if (!media && isMediaCell(cell)) {
        media = cell;
        cell.className = 'cards-tile-image';
        if (cell.querySelector('span.icon')) li.classList.add('cards-tile-icon');
      } else {
        removeEmptyParagraphs(cell);
        cell.className = 'cards-tile-body';
        markCta(li, cell);
        li.append(cell);
      }
    });
    if (media) li.prepend(media);
    else li.classList.add('cards-tile-no-image');
    ul.append(li);
  });

  ul.querySelectorAll('.cards-tile-image picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
  ul.querySelectorAll('.cards-tile-image img').forEach((img) => {
    const li = img.closest('li');
    if (!li.classList.contains('cards-tile-icon')) classifyImage(img, li);
  });
  block.replaceChildren(ul);
}
