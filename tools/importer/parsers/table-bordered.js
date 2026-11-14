/* eslint-disable */
/* global WebImporter */

/**
 * table-bordered: plain gridded table inside the legal disclosures
 * (.disclosures table).
 * Row 1: header cells; then one row per <tr>. A list-styled table
 * (.disclosures ul.table, EN CDs/IRAs page; the ES page has a real <table>)
 * becomes one row with one cell per <li>; the block renders row 1 as the
 * header row in both cases, so EN and ES stay consistent. Cell text keeps bold, links,
 * sup and line breaks; color spans are unwrapped. Self-contained: the
 * validator injects each parser as a plain script.
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

// list-styled table (.disclosures ul.table, e.g. the "not FDIC insured" row on
// the EN CDs/IRAs page): a single row, one cell per <li>
function listRows(list, document) {
  const cells = [...list.children]
    .filter((li) => li.tagName === 'LI' && (li.textContent.trim() || li.querySelector('img')))
    .map((li) => cellContent(li, document));
  return cells.length ? [cells] : [];
}

export default function parse(element, { document }) {
  const isList = element.tagName === 'UL' || element.tagName === 'OL';
  const cells = isList ? listRows(element, document) : tableRows(element, document);
  const block = WebImporter.Blocks.createBlock(document, { name: 'table-bordered', cells });
  element.replaceWith(block);
}
