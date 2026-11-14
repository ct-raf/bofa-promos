import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * A cell that only holds an icon: a picture or an :icon: span, no text.
 * @param {Element} cell
 */
function isIconCell(cell) {
  const icon = cell.querySelector('picture, span.icon');
  return !!icon && cell.textContent.trim() === '';
}

/**
 * Cards (steps): one row per step, icon cell then copy cell.
 * Either cell may be missing; a row without an icon still renders its copy.
 * @param {Element} block
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture, span.icon'));
    if (!cells.length) return;
    const li = document.createElement('li');
    let hasIcon = false;
    cells.forEach((cell) => {
      if (!hasIcon && isIconCell(cell)) {
        cell.className = 'cards-steps-icon';
        hasIcon = true;
        li.prepend(cell);
      } else {
        cell.className = 'cards-steps-body';
        li.append(cell);
      }
    });
    if (!hasIcon) li.classList.add('cards-steps-no-icon');
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '150' }]));
  });
  block.replaceChildren(ul);
}
