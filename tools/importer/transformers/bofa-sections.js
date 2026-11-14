/* eslint-disable */
/* global WebImporter */

/**
 * Bank of America promotions section transformer.
 * Uses payload.template.sections (selectors tried in order).
 * beforeTransform: insert <hr> section breaks (marked for styled sections).
 * afterTransform: add Section Metadata blocks for styled sections.
 */

const MARKER_ATTR = 'data-excat-section-id';

function findSectionElement(root, section) {
  const selectors = Array.isArray(section.selector) ? section.selector : [section.selector];
  for (const sel of selectors) {
    if (!sel) continue;
    let el = null;
    try {
      el = root.querySelector(sel);
    } catch (e) {
      el = null;
    }
    if (el) return el;
  }
  return null;
}

export default function transform(hookName, element, payload) {
  const template = payload && payload.template;
  const sections = template && Array.isArray(template.sections) ? template.sections : [];
  if (sections.length < 2) return;
  const document = element.ownerDocument || payload.document;

  if (hookName === 'beforeTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const el = findSectionElement(element, section);
      if (!el) continue;
      // Insert a break before every non-first section; a styled first
      // section gets a temporary marked <hr> removed in afterTransform.
      if (i > 0 || section.style) {
        const hr = document.createElement('hr');
        if (section.style) hr.setAttribute(MARKER_ATTR, section.id);
        el.before(hr);
      }
    }
  }

  if (hookName === 'afterTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      if (!section.style) continue;
      const marker = element.querySelector(`hr[${MARKER_ATTR}="${section.id}"]`);
      const sectionMeta = WebImporter.Blocks.createBlock(document, {
        name: 'Section Metadata',
        cells: { style: section.style },
      });

      // Find the end of this section: the next section break (<hr>) after the
      // marker, or the end of the content.
      let anchor = null;
      if (marker) {
        let next = null;
        const hrs = [...element.querySelectorAll('hr')];
        const idx = hrs.indexOf(marker);
        if (idx >= 0 && idx < hrs.length - 1) next = hrs[idx + 1];
        if (next) {
          next.before(sectionMeta);
        } else {
          const last = findSectionElement(element, section);
          if (last && last.parentNode) {
            anchor = last;
            anchor.after(sectionMeta);
          } else {
            marker.parentNode.append(sectionMeta);
          }
        }
        marker.removeAttribute(MARKER_ATTR);
        if (i === 0) marker.remove();
      } else {
        const el = findSectionElement(element, section);
        if (el) el.after(sectionMeta);
      }
    }

    // Drop the importer's section/block markers now that sections are placed.
    element.querySelectorAll('[data-excat-section], [data-excat-block], [data-excat-section-id]').forEach((el) => {
      el.removeAttribute('data-excat-section');
      el.removeAttribute('data-excat-block');
      el.removeAttribute('data-excat-section-id');
    });
  }
}
