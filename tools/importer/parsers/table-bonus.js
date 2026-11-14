/* eslint-disable */
/* global WebImporter */

/**
 * table-bonus: compact bonus-tier table that sits inside a step list
 * (.multi-step-content table).
 * Row 1: header cells; then one row per <tr>. Cell text keeps bold, links,
 * sup and line breaks; color spans (.color-reverse, .text-brightRed) are unwrapped.
 *
 * The source table lives inside a .multi-step-content__items group (step 2),
 * but blocks cannot nest, so the block is placed directly after that group,
 * between the cards-steps blocks. The cards-steps parser (which claims the
 * step group first) emits the same block itself; this parser covers the case
 * where the table is reached on its own. Both produce the same document order.
 * Self-contained: the validator injects each parser as a plain script.
 */

const INLINE_KEEP = new Set(['A', 'SUP', 'SUB', 'BR', 'I', 'EM', 'U']);

function copyInline(src, target, document) {
  src.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      target.append(document.createTextNode(node.textContent));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === 'B' || tag === 'STRONG') {
      if (!node.textContent.trim()) return; // empty <b> wrappers
      const strong = document.createElement('strong');
      copyInline(node, strong, document);
      target.append(strong);
    } else if (INLINE_KEEP.has(tag)) {
      const el = document.createElement(tag.toLowerCase());
      if (tag === 'A') {
        const href = node.getAttribute('href');
        if (href) el.setAttribute('href', href);
        if (node.getAttribute('title')) el.setAttribute('title', node.getAttribute('title'));
      }
      copyInline(node, el, document);
      target.append(el);
    } else if (tag === 'IMG') {
      target.append(node.cloneNode(true));
    } else {
      // span (color classes), p and other wrappers: unwrap
      copyInline(node, target, document);
    }
  });
}

function trimEdges(el) {
  const first = el.firstChild;
  if (first && first.nodeType === 3) first.textContent = first.textContent.replace(/^\s+/, '');
  const last = el.lastChild;
  if (last && last.nodeType === 3) last.textContent = last.textContent.replace(/\s+$/, '');
}

function cellContent(cell, document) {
  const paras = [...cell.querySelectorAll(':scope > p')].filter((p) => p.textContent.trim());
  if (paras.length > 1) {
    return paras.map((p) => {
      const out = document.createElement('p');
      copyInline(p, out, document);
      trimEdges(out);
      return out;
    });
  }
  // single paragraph: one element node (createBlock mishandles bare text nodes)
  const out = document.createElement('p');
  copyInline(paras.length === 1 ? paras[0] : cell, out, document);
  trimEdges(out);
  return out.childNodes.length ? out : '';
}

function tableRows(table, document) {
  const rows = [];
  let width = 0;
  table.querySelectorAll('tr').forEach((tr) => {
    if (tr.closest('table') !== table) return;
    const cells = [...tr.children]
      .filter((c) => c.tagName === 'TH' || c.tagName === 'TD')
      .map((c) => cellContent(c, document));
    if (!cells.length) return;
    width = Math.max(width, cells.length);
    rows.push(cells);
  });
  // pad ragged rows so the block table stays rectangular
  rows.forEach((r) => { while (r.length < width) r.push(''); });
  return rows;
}

export default function parse(element, { document }) {
  const cells = tableRows(element, document);
  const block = WebImporter.Blocks.createBlock(document, { name: 'table-bonus', cells });

  const group = element.closest('.multi-step-content__items');
  if (group && group.parentElement) {
    // remove the table (and a wrapper that only held it) from the step copy
    let target = element;
    while (
      target.parentElement
      && target.parentElement !== group
      && !target.parentElement.classList.contains('multi-step-content-item__copy')
      && target.parentElement.children.length === 1
    ) {
      target = target.parentElement;
    }
    group.after(block);
    target.remove();
    return;
  }
  element.replaceWith(block);
}
