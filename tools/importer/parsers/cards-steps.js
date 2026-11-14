/* eslint-disable */
/* global WebImporter */

/**
 * cards-steps: vertical list of qualification steps (.multi-step-content__items).
 * One row per .multi-step-content-item: [icon image, step copy + additional text].
 *
 * Grouping: consecutive .multi-step-content__items siblings are merged into
 * one block until a group that holds the bonus <table>. That table cannot
 * nest in a block, so it is removed from the step copy and emitted as a
 * table-bonus block right after this block; the following items (the final
 * .last-qitem step) form a second cards-steps block. Result, in document
 * order: cards-steps (steps 1-2), table-bonus, cards-steps (step 3).
 *
 * No text is matched, so EN and ES pages parse the same way.
 * Self-contained: the validator injects each parser as a plain script.
 */

const GROUP = 'multi-step-content__items';

/* ---------- table-bonus cells (same rules as parsers/table-bonus.js) ---------- */

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
      if (!node.textContent.trim()) return;
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

function tableCell(cell, document) {
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

function tableBonusBlock(table, document) {
  const rows = [];
  let width = 0;
  table.querySelectorAll('tr').forEach((tr) => {
    if (tr.closest('table') !== table) return;
    const cells = [...tr.children]
      .filter((c) => c.tagName === 'TH' || c.tagName === 'TD')
      .map((c) => tableCell(c, document));
    if (!cells.length) return;
    width = Math.max(width, cells.length);
    rows.push(cells);
  });
  rows.forEach((r) => { while (r.length < width) r.push(''); });
  return WebImporter.Blocks.createBlock(document, { name: 'table-bonus', cells: rows });
}

/* ---------- steps ---------- */

// Remove a table plus any wrapper that only held it, stopping at the copy container.
function detachTable(table) {
  let target = table;
  while (
    target.parentElement
    && target.parentElement.children.length === 1
    && !target.parentElement.classList.contains('multi-step-content-item__copy')
    && !target.parentElement.classList.contains('multi-step-content-item__content')
  ) {
    target = target.parentElement;
  }
  target.remove();
}

function stepRow(item, document) {
  const iconImg = item.querySelector(':scope > .multi-step-content-item__icon img');
  const iconCell = iconImg ? iconImg.cloneNode(true) : '';

  const copy = [];
  const parts = [
    ...item.querySelectorAll(':scope > .multi-step-content-item__content .multi-step-content-item__copy'),
    ...item.querySelectorAll(':scope > .multi-step-content__additional-text .multi-step-content-item__copy'),
  ];
  // fall back to the raw containers when the copy wrapper is missing
  if (!parts.length) {
    parts.push(...item.querySelectorAll(':scope > .multi-step-content-item__content, :scope > .multi-step-content__additional-text'));
  }
  parts.forEach((part) => {
    const clone = part.cloneNode(true);
    clone.querySelectorAll('table').forEach((t) => detachTable(t));
    [...clone.children].forEach((child) => {
      if (child.textContent.trim() || child.querySelector('img')) copy.push(child);
    });
  });
  return [iconCell, copy];
}

export default function parse(element, { document }) {
  // consecutive step groups, ending with the first one that holds a table
  const groups = [element];
  let current = element;
  while (!current.querySelector('table')) {
    const next = current.nextElementSibling;
    if (!next || !next.classList.contains(GROUP)) break;
    groups.push(next);
    current = next;
  }

  const cells = [];
  const tables = [];
  groups.forEach((group) => {
    group.querySelectorAll(':scope > .multi-step-content-item').forEach((item) => {
      cells.push(stepRow(item, document));
    });
    group.querySelectorAll('table').forEach((t) => {
      if (!t.parentElement.closest('table')) tables.push(t);
    });
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-steps', cells });
  element.replaceWith(block);

  // bonus table(s) directly after this block, in document order
  let anchor = block;
  tables.forEach((t) => {
    const tableBlock = tableBonusBlock(t, document);
    anchor.after(tableBlock);
    anchor = tableBlock;
  });

  // merged groups are now part of this block
  groups.slice(1).forEach((g) => g.remove());
}
