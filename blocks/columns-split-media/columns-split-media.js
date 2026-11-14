import { createOptimizedPicture, decorateIcons } from '../../scripts/aem.js';

/** Link text longer than this stays a text link instead of a pill CTA. */
const CTA_MAX_LENGTH = 40;

/**
 * A cell that only holds one picture and no text.
 * @param {Element} cell
 */
function isImageCell(cell) {
  return cell.querySelectorAll('picture').length === 1 && cell.textContent.trim() === '';
}

/**
 * Turns paragraphs holding only `:name:` icon notation (left as text when the
 * pipeline did not convert it) into EDS icon spans.
 * @param {Element} cell text cell
 */
function convertIconText(cell) {
  cell.querySelectorAll(':scope > p').forEach((p) => {
    if (p.querySelector('picture, img, span.icon')) return;
    const match = p.textContent.trim().match(/^:([a-z0-9-]+):$/i);
    if (!match) return;
    const span = document.createElement('span');
    span.className = `icon icon-${match[1].toLowerCase()}`;
    p.replaceChildren(span);
  });
  decorateIcons(cell);
}

/**
 * A paragraph that holds only an :icon: span (no text).
 * @param {Element} el
 */
function isIconParagraph(el) {
  return el.tagName === 'P' && el.querySelector('span.icon') && el.textContent.trim() === '';
}

/**
 * A paragraph that holds only one link (a CTA), excluding footnote links.
 * @param {Element} el
 */
function isLinkParagraph(el) {
  if (el.tagName !== 'P') return false;
  if (el.classList.contains('button-wrapper')) return true;
  const links = el.querySelectorAll(':scope > a, :scope > :is(strong, em, b, i) > a');
  if (links.length !== 1 || links[0].querySelector('sup')) return false;
  return el.textContent.trim() === links[0].textContent.trim();
}

/**
 * A paragraph that holds only small legal copy (`<sub>` / `<small>`).
 * @param {Element} el
 */
function isNoteParagraph(el) {
  return el.tagName === 'P' && el.children.length > 0
    && [...el.children].every((c) => /^(SUB|SMALL)$/.test(c.tagName))
    && [...el.childNodes].every((n) => n.nodeType !== Node.TEXT_NODE || !n.textContent.trim());
}

/**
 * Groups `:icon:` paragraphs with the heading and copy that follow them into
 * icon items. An item ends at the next icon paragraph, a CTA, a legal note,
 * or any element other than H3-H6 or a plain paragraph.
 * @param {Element} cell text cell
 */
function buildIconItems(cell) {
  convertIconText(cell);
  cell.querySelectorAll(':scope > p').forEach((p) => {
    if (isLinkParagraph(p)) {
      const a = p.querySelector('a');
      if (p.classList.contains('button-wrapper') || a.textContent.trim().length <= CTA_MAX_LENGTH) {
        p.classList.add('columns-split-media-cta');
      }
      p.classList.add('columns-split-media-link');
    } else if (isNoteParagraph(p)) {
      p.classList.add('columns-split-media-note');
    }
  });
  const children = [...cell.children];
  let list = null;
  let item = null;
  let body = null;

  children.forEach((el) => {
    if (isIconParagraph(el)) {
      if (!list) {
        list = document.createElement('ul');
        list.className = 'columns-split-media-icon-list';
        el.before(list);
      }
      item = document.createElement('li');
      item.className = 'columns-split-media-icon-item';
      const icon = document.createElement('div');
      icon.className = 'columns-split-media-icon';
      icon.append(...el.childNodes);
      el.remove();
      body = document.createElement('div');
      body.className = 'columns-split-media-icon-body';
      item.append(icon, body);
      list.append(item);
      return;
    }
    const isCopy = /^H[3-6]$/.test(el.tagName)
      || (el.tagName === 'P' && !el.classList.contains('columns-split-media-link')
        && !el.classList.contains('columns-split-media-note'));
    if (item && isCopy) {
      body.append(el);
      return;
    }
    // anything else closes the current item and list
    item = null;
    body = null;
    list = null;
  });
}

/**
 * Columns (split media): one row, a picture-only cell beside a text cell,
 * in either order. The text cell may hold :icon: + H3 + paragraph items
 * and a CTA. Extra rows are laid out the same way.
 * @param {Element} block
 */
export default function decorate(block) {
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    row.classList.add('columns-split-media-row');
    if (cells.length < 2) row.classList.add('columns-split-media-single');
    cells.forEach((cell, i) => {
      if (isImageCell(cell)) {
        cell.classList.add('columns-split-media-img-col');
        if (i === 0) row.classList.add('columns-split-media-img-first');
      } else {
        cell.classList.add('columns-split-media-text-col');
        buildIconItems(cell);
      }
    });
  });

  block.querySelectorAll('.columns-split-media-img-col picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [
      { media: '(min-width: 900px)', width: '1000' },
      { width: '750' },
    ]));
  });
}
