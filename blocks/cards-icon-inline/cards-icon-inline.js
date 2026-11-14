import { createOptimizedPicture, decorateIcons } from '../../scripts/aem.js';

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
 * Cards (icon inline): one row per item, a small media cell (:icon: or image)
 * placed to the left of a short body cell (copy with an inline link).
 * Either cell may be missing, and the cells may come in either order.
 * @param {Element} block
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture, img, span.icon'));
    if (!cells.length) return;
    const li = document.createElement('li');
    let media = null;
    const body = [];
    cells.forEach((cell) => {
      convertIconText(cell);
      if (!media && isMediaCell(cell)) {
        media = cell;
        cell.className = 'cards-icon-inline-icon';
      } else {
        cell.querySelectorAll(':scope > p').forEach((p) => {
          if (!p.textContent.trim() && !p.querySelector('picture, img, span.icon')) p.remove();
        });
        cell.className = 'cards-icon-inline-body';
        body.push(cell);
      }
    });
    if (media) li.append(media);
    else li.classList.add('cards-icon-inline-no-icon');
    li.append(...body);
    ul.append(li);
  });

  ul.querySelectorAll('.cards-icon-inline-icon picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '200' }]));
  });
  block.replaceChildren(ul);
}
