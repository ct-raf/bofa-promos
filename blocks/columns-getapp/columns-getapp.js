import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * A paragraph that carries a label: text, no links, no media.
 * @param {Element|null} el
 */
function isLabelParagraph(el) {
  return !!el && el.tagName === 'P' && !el.querySelector('a, picture, img')
    && el.textContent.trim() !== '';
}

/**
 * Turns the authored device list into a device picker and a button.
 * All visible strings come from the content:
 * - list items with a link become options (link text = label, href = target);
 * - a list item without a link, or else a text paragraph right before the
 *   list, becomes the placeholder option;
 * - a text paragraph right after the list (e.g. bold "Get the app") is the
 *   button label.
 * Without a button label the list stays as plain links.
 * @param {Element} list
 */
function buildDevicePicker(list) {
  const items = [...list.querySelectorAll(':scope > li')];
  const links = items.map((li) => li.querySelector('a[href]')).filter(Boolean);
  if (!links.length) return;

  const labelEl = isLabelParagraph(list.nextElementSibling) ? list.nextElementSibling : null;
  if (!labelEl) {
    list.classList.add('columns-getapp-devices');
    return;
  }

  let placeholderText = '';
  const placeholderItem = items.find((li) => !li.querySelector('a[href]') && li.textContent.trim());
  let placeholderEl = null;
  if (placeholderItem) {
    placeholderText = placeholderItem.textContent.trim();
  } else if (isLabelParagraph(list.previousElementSibling)) {
    placeholderEl = list.previousElementSibling;
    placeholderText = placeholderEl.textContent.trim();
  }
  const buttonText = labelEl.textContent.trim();

  const picker = document.createElement('div');
  picker.className = 'columns-getapp-picker';

  const selectWrap = document.createElement('div');
  selectWrap.className = 'columns-getapp-select';
  const select = document.createElement('select');
  select.setAttribute('aria-label', placeholderText || buttonText);

  if (placeholderText) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholderText;
    option.disabled = true;
    option.selected = true;
    select.append(option);
  }
  links.forEach((a) => {
    const option = document.createElement('option');
    option.value = a.href;
    option.textContent = a.textContent.trim();
    if (a.target) option.dataset.target = a.target;
    select.append(option);
  });
  selectWrap.append(select);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button primary';
  button.textContent = buttonText;

  // aria-disabled (not `disabled`) keeps the button in the tab order, so keyboard and screen
  // reader users can find it and learn it's unavailable until a device is chosen.
  const sync = () => { button.setAttribute('aria-disabled', String(!select.value)); };
  select.addEventListener('change', sync);
  sync();

  button.addEventListener('click', () => {
    const option = select.selectedOptions[0];
    if (!option || !option.value) {
      select.focus();
      return;
    }
    if (option.dataset.target === '_blank') {
      window.open(option.value, '_blank', 'noopener');
    } else {
      window.location.assign(option.value);
    }
  });

  picker.append(selectWrap, button);
  list.replaceWith(picker);
  labelEl.remove();
  if (placeholderEl) placeholderEl.remove();
}

/**
 * Columns (get the app): one row, a text cell (H2, device links, button
 * label, consent copy, terms link) and a picture-only cell (QR code / phone),
 * in either order.
 * @param {Element} block
 */
export default function decorate(block) {
  const first = block.firstElementChild;
  const cols = first ? [...first.children] : [];
  block.classList.add(`columns-getapp-${cols.length}-cols`);

  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pics = col.querySelectorAll('picture');
      if (pics.length === 1 && col.textContent.trim() === '') {
        col.classList.add('columns-getapp-img-col');
      } else {
        col.classList.add('columns-getapp-text-col');
        const list = col.querySelector(':scope > ul, :scope > ol');
        if (list) buildDevicePicker(list);
      }
    });
  });

  block.querySelectorAll('.columns-getapp-img-col picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [
      { media: '(min-width: 900px)', width: '1000' },
      { width: '750' },
    ]));
  });
}
