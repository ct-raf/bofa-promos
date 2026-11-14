/**
 * Hero Offer block.
 * Rows (any order, any may be missing):
 *   - a cell holding only a picture: full-bleed background art
 *   - a cell holding text: eyebrow, heading, copy, CTA
 * The background image is the LCP candidate (often an animated GIF), so it is
 * kept as authored and loaded eagerly rather than re-encoded.
 * @param {Element} block
 */
export default function decorate(block) {
  const media = document.createElement('div');
  media.className = 'hero-offer-media';
  const content = document.createElement('div');
  content.className = 'hero-offer-content';

  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => {
      const pictures = cell.querySelectorAll('picture');
      const textless = cell.textContent.trim() === '';
      if (pictures.length && textless && !media.children.length) {
        media.append(...pictures);
      } else if (cell.textContent.trim() || cell.children.length) {
        content.append(...cell.childNodes);
      }
    });
  });

  // Eyebrow: a short paragraph that precedes the main heading.
  const heading = content.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    const prev = heading.previousElementSibling;
    if (prev && prev.tagName === 'P' && !prev.querySelector('a, picture')) {
      prev.classList.add('hero-offer-eyebrow');
    }
  }

  // CTA: a paragraph holding nothing but one link (not a footnote reference) renders as a pill.
  content.querySelectorAll(':scope > p').forEach((p) => {
    const links = p.querySelectorAll('a[href]');
    if (links.length !== 1 || links[0].querySelector('sup, img, picture')) return;
    if (p.textContent.trim() === links[0].textContent.trim()) p.classList.add('hero-offer-cta');
  });

  media.querySelectorAll('img').forEach((img) => {
    img.loading = 'eager';
    img.fetchPriority = 'high';
  });

  block.replaceChildren(...[media, content].filter((el) => el.children.length));
  if (!media.children.length) block.classList.add('hero-offer-no-media');
}
