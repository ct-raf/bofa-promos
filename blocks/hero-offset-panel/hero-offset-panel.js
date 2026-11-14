import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Hero Offset Panel block.
 * Rows (any order, any may be missing):
 *   - a cell holding only a picture: the photo, inset from the right edge
 *   - a cell holding text: heading, copy, link; rendered in a solid panel that
 *     overlaps the photo's bottom-left corner and extends below it
 * No text is generated here, so the block works for any page language.
 * @param {Element} block
 */
export default function decorate(block) {
  const media = document.createElement('div');
  media.className = 'hero-offset-panel-media';
  const panel = document.createElement('div');
  panel.className = 'hero-offset-panel-panel';

  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => {
      const pictures = cell.querySelectorAll('picture');
      const textless = cell.textContent.trim() === '';
      if (pictures.length && textless && !media.children.length) {
        media.append(...pictures);
      } else if (cell.textContent.trim() || cell.children.length) {
        panel.append(...cell.childNodes);
      }
    });
  });

  // Drop empty paragraphs left by the source markup.
  panel.querySelectorAll('p').forEach((p) => {
    if (!p.textContent.trim() && !p.querySelector('picture, img')) p.remove();
  });

  media.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(
      createOptimizedPicture(img.src, img.alt, false, [
        { media: '(min-width: 900px)', width: '2000' },
        { width: '750' },
      ]),
    );
  });

  block.replaceChildren(...[media, panel].filter((el) => el.children.length));
  if (!media.children.length) block.classList.add('hero-offset-panel-no-media');
  if (!panel.children.length) block.classList.add('hero-offset-panel-no-panel');
}
