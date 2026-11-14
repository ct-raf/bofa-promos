/* eslint-disable */
/* global WebImporter */

/**
 * columns-getapp: get-the-app panel (.getapp2).
 * One row, two cells:
 *   1. text: H2; placeholder paragraph (the select's default option); bulleted
 *      list of device links (one per remaining <option>: label = option text,
 *      href = the download link's data-attr-{option value} URL); bold
 *      button-label paragraph (the device-step button text); consent copy and
 *      Terms link (split at <br> into separate paragraphs).
 *   2. media: the QR code / phone picture.
 * The SMS phone-number step, inputs, buttons and status messages are not authored.
 * No text is matched, so EN and ES pages parse the same way.
 */

function imageFrom(img, document) {
  if (!img) return null;
  let src = img.getAttribute('src');
  if (!src || src.startsWith('data:')) {
    const picture = img.closest('picture');
    const source = picture && picture.querySelector('source[srcset]');
    const srcset = img.getAttribute('srcset') || (source && source.getAttribute('srcset'));
    src = srcset ? srcset.split(',')[0].trim().split(/\s+/)[0] : null;
  }
  if (!src) return null;
  const out = document.createElement('img');
  out.src = src;
  if (img.getAttribute('alt')) out.alt = img.getAttribute('alt');
  return out;
}

function usableHref(href) {
  return href && href.trim() && href.trim() !== '#' ? href.trim() : null;
}

// Device options -> { placeholder, devices: [{ label, href }] }.
// Each option resolves its URL from the download link's data-attr-<key>
// attribute (key = option value, else label, lower-cased). An option that
// resolves to no URL is the placeholder. Without data-attr-* (pre-rendered
// snapshots), the first option is the placeholder and the others use the
// download link's href (data-attr-default, else href).
function deviceOptions(element) {
  const select = element.querySelector('select.js-mobile-device, .getapp2__dropdown, select');
  if (!select) return { placeholder: null, devices: [] };
  const options = [...select.querySelectorAll('option')]
    .map((o) => ({ value: (o.getAttribute('value') || '').trim(), label: o.textContent.trim() }))
    .filter((o) => o.label);
  const dl = element.querySelector('.getapp2__mobiledownload a[href], a.cta--dynamic[href]');
  const hasDataAttrs = !!dl && [...dl.attributes].some((a) => /^data-attr-/.test(a.name));
  const fallback = dl ? usableHref(dl.getAttribute('data-attr-default')) || usableHref(dl.getAttribute('href')) : null;

  let placeholder = null;
  const devices = [];
  options.forEach((o, i) => {
    let href = null;
    if (hasDataAttrs) {
      const keys = [o.value, o.label].filter(Boolean).map((k) => k.toLowerCase().replace(/[^a-z0-9-]+/g, '-'));
      keys.some((k) => { href = usableHref(dl.getAttribute(`data-attr-${k}`)); return !!href; });
    } else if (i > 0 || options.length === 1) {
      href = fallback;
    }
    if (href) devices.push({ label: o.label, href });
    else if (!placeholder) placeholder = o.label;
  });
  return { placeholder, devices };
}

// <p> split at <br> into separate paragraphs; spans unwrapped; empty ones dropped
function splitParagraph(src, document) {
  const out = [];
  let current = document.createElement('p');
  const flush = () => {
    current.innerHTML = current.innerHTML.trim();
    if (current.textContent.trim()) out.push(current);
    current = document.createElement('p');
  };
  [...src.childNodes].forEach((node) => {
    if (node.nodeType === 1 && node.tagName === 'BR') flush();
    else current.append(node.cloneNode(true));
  });
  flush();
  out.forEach((p) => {
    p.querySelectorAll('span').forEach((s) => s.replaceWith(...s.childNodes));
    p.querySelectorAll('a[id]').forEach((a) => a.removeAttribute('id'));
  });
  return out;
}

export default function parse(element, { document }) {
  const text = [];

  const heading = element.querySelector('.getapp2__heading, h1, h2, h3');
  if (heading && heading.textContent.trim()) {
    const h2 = document.createElement('h2');
    h2.innerHTML = heading.innerHTML.trim();
    h2.querySelectorAll('span').forEach((s) => s.replaceWith(...s.childNodes));
    text.push(h2);
  }

  const { placeholder, devices } = deviceOptions(element);
  if (devices.length) {
    if (placeholder) {
      const p = document.createElement('p');
      p.textContent = placeholder;
      text.push(p);
    }
    const ul = document.createElement('ul');
    devices.forEach((d) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = d.href;
      a.textContent = d.label;
      li.append(a);
      ul.append(li);
    });
    text.push(ul);

    // button label of the device step (first group holding the select)
    const select = element.querySelector('select');
    const group = (select && select.closest('.getapp2__group')) || element;
    const button = group.querySelector('button');
    if (button && button.textContent.trim()) {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = button.textContent.trim();
      p.append(strong);
      text.push(p);
    }
  }

  // consent copy + Terms link: the desktop footer (the mobile duplicate lives
  // in .getapp2__mobiledownload)
  const disclaimer = element.querySelector('.getapp2__footer .getapp2__disclaimer')
    || [...element.querySelectorAll('.getapp2__disclaimer')].find((d) => !d.closest('.getapp2__mobiledownload'));
  if (disclaimer) {
    const paras = disclaimer.querySelectorAll('p');
    (paras.length ? [...paras] : [disclaimer]).forEach((p) => text.push(...splitParagraph(p, document)));
  }

  const media = imageFrom(element.querySelector('.getapp2__media img, .getapp2__media picture img'), document);

  const cells = [[text, media || '']];
  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-getapp', cells });
  element.replaceWith(block);
}
