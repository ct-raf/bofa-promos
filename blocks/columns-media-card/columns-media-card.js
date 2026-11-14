import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Columns (media card): one row, a text column and a picture-only column,
 * in either order. Extra rows are laid out the same way.
 * @param {Element} block
 */
export default function decorate(block) {
  const first = block.firstElementChild;
  const cols = first ? [...first.children] : [];
  block.classList.add(`columns-media-card-${cols.length}-cols`);

  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pics = col.querySelectorAll('picture');
      if (pics.length === 1 && col.textContent.trim() === '') {
        col.classList.add('columns-media-card-img-col');
      } else {
        col.classList.add('columns-media-card-text-col');
      }
    });
  });

  // Two looks: an H2 promo card (filled, shadowed) and an H3 product card
  // (outlined, pill CTA). The heading level is what distinguishes them.
  const heading = block.querySelector('.columns-media-card-text-col :is(h1, h2, h3, h4, h5, h6)');
  const outlined = heading && !/^H[12]$/.test(heading.tagName);
  block.classList.add(outlined ? 'columns-media-card-outlined' : 'columns-media-card-filled');

  // Outlined look: a trailing link-only paragraph is the pill CTA.
  if (outlined) {
    block.querySelectorAll('.columns-media-card-text-col').forEach((col) => {
      const last = col.lastElementChild;
      const link = last && last.tagName === 'P' && last.querySelector(':scope > a:only-child');
      if (link && last.textContent.trim() === link.textContent.trim()) {
        last.classList.add('columns-media-card-cta');
      }
    });
  }

  block.querySelectorAll('.columns-media-card-img-col picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [
      { media: '(min-width: 900px)', width: '1000' },
      { width: '750' },
    ]));
  });
}
