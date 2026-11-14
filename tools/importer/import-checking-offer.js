/* eslint-disable */
/* global WebImporter */

import heroOfferParser from './parsers/hero-offer.js';
import cardsProductParser from './parsers/cards-product.js';
import cardsStepsParser from './parsers/cards-steps.js';
import tableBonusParser from './parsers/table-bonus.js';
import columnsMediaCardParser from './parsers/columns-media-card.js';
import tableBorderedParser from './parsers/table-bordered.js';
import cleanupTransformer from './transformers/bofa-cleanup.js';
import sectionsTransformer from './transformers/bofa-sections.js';

const PAGE_TEMPLATE = {
  "name": "checking-offer",
  "urls": [
    "https://promotions.bankofamerica.com/en/offers/chooseyourchecking500tiered",
    "https://promotions.bankofamerica.com/en/offers/2026t3unauth",
    "https://promotions.bankofamerica.com/es/offers/2026t3unauth"
  ],
  "representativeUrl": "https://promotions.bankofamerica.com/en/offers/chooseyourchecking500tiered",
  "description": "Up to $500 tiered checking offer landing page (English and Spanish)",
  "blocks": [
    {
      "name": "hero-offer",
      "instances": [
        "section.masthead",
        ".masthead"
      ]
    },
    {
      "name": "cards-product",
      "instances": [
        ".product-details__productList"
      ]
    },
    {
      "name": "cards-steps",
      "instances": [
        ".multi-step-content__items:not(.last-qitem)",
        ".multi-step-content__items.last-qitem"
      ]
    },
    {
      "name": "table-bonus",
      "instances": [
        ".multi-step-content table"
      ]
    },
    {
      "name": "columns-media-card",
      "instances": [
        ".uc-content-card-container .uc-card",
        ".uc-card"
      ]
    },
    {
      "name": "table-bordered",
      "instances": [
        ".disclosures table"
      ]
    }
  ],
  "sections": [
    {
      "id": "section-1",
      "name": "Masthead hero",
      "selector": [
        ".aem-wrap--masthead",
        "section.masthead"
      ],
      "style": null,
      "blocks": [
        "hero-offer"
      ],
      "defaultContent": []
    },
    {
      "id": "section-2",
      "name": "Advantage Banking product comparison",
      "selector": [
        ".aem-wrap--product-details",
        ".product-details"
      ],
      "style": null,
      "blocks": [
        "cards-product"
      ],
      "defaultContent": [
        ".product-details__heading"
      ]
    },
    {
      "id": "section-3",
      "name": "How to qualify",
      "selector": [
        ".aem-wrap--multi-step-content",
        ".multi-step-content"
      ],
      "style": null,
      "blocks": [
        "cards-steps",
        "table-bonus"
      ],
      "defaultContent": [
        ".multi-step-content__heading",
        ".multi-step-content__subcopy"
      ]
    },
    {
      "id": "section-4",
      "name": "BofA Rewards promo card",
      "selector": [
        ".aem-wrap--content-card-container",
        ".uc-content-card-container"
      ],
      "style": null,
      "blocks": [
        "columns-media-card"
      ],
      "defaultContent": []
    },
    {
      "id": "section-5",
      "name": "Offer disclosures (legal footnotes)",
      "selector": [
        ".disclosures"
      ],
      "style": "light-grey",
      "blocks": [
        "table-bordered"
      ],
      "defaultContent": [
        ".disclosures__item"
      ]
    }
  ],
  "urlPattern": "/*/offers/*"
};


// Target document paths that differ from the source path (none unless listed).
const PATH_OVERRIDES = {
  "/es/offers/2026t3unauth": "/es/offers/chooseyourchecking500tiered",
};

const parsers = {
  'hero-offer': heroOfferParser,
  'cards-product': cardsProductParser,
  'cards-steps': cardsStepsParser,
  'table-bonus': tableBonusParser,
  'columns-media-card': columnsMediaCardParser,
  'table-bordered': tableBorderedParser,
};
// Late transformers change the DOM (section <hr> markers, shared fragments), so their beforeTransform
// runs after block discovery.
const sectionTransformers = [sectionsTransformer];
const fragmentTransformers = [];
const lateTransformers = [...sectionTransformers, ...fragmentTransformers];
const transformers = [cleanupTransformer, ...lateTransformers];
const earlyTransformers = transformers.filter((fn) => !lateTransformers.includes(fn));
// Catalog selectors (pageInstances, pageCleanup) count the <script> and <hr> elements the importer
// removes before transform, so a catalog template finds its targets in preprocess.
const CATALOG = Boolean(PAGE_TEMPLATE.pageCleanup || PAGE_TEMPLATE.blocks.some((b) => b.pageInstances));

function executeTransformers(hookName, element, payload, list = transformers) {
  const enhancedPayload = { ...payload, template: payload.params?.targets?.template || PAGE_TEMPLATE };
  list.forEach((fn) => {
    try { fn(hookName, element, enhancedPayload); } catch (e) { console.error(`Transformer failed at ${hookName}:`, e); }
  });
}

function findBlocksOnPage(document, template, url) {
  const pageBlocks = [];
  const pageKey = (u) => {
    try { const { origin, pathname } = new URL(u); return `${origin}${pathname.replace(/\/$/, '')}`; } catch { return u; }
  };
  const key = pageKey(url);
  const claim = (blockDef, selector) => {
    let matches = [];
    try { matches = document.querySelectorAll(selector); } catch { return; }
    matches.forEach((element) => {
      if (pageBlocks.some((b) => b.element === element || b.element.contains(element) || element.contains(b.element))) return;
      pageBlocks.push({ name: blockDef.name, selector, element });
    });
  };
  template.blocks.forEach((blockDef) => {
    const entry = Object.entries(blockDef.pageInstances || {}).find(([u]) => pageKey(u) === key);
    (entry ? entry[1] : []).forEach((selector) => claim(blockDef, selector));
  });
  template.blocks.forEach((blockDef) => (blockDef.instances || []).forEach((selector) => claim(blockDef, selector)));
  return pageBlocks;
}

// Runs the early transformers, then marks each block and section target with an attribute: the
// importer re-creates the body before transform, so only attributes survive, not element references.
function markPageTargets(payload) {
  const { document, params } = payload;
  executeTransformers('beforeTransform', document.body, payload, earlyTransformers);
  const blocks = findBlocksOnPage(document, PAGE_TEMPLATE, params.originalURL).map(({ name, selector, element }, i) => {
    element.setAttribute('data-excat-block', String(i));
    return { name, selector };
  });
  const sections = (PAGE_TEMPLATE.sections || []).map((section, i) => {
    const target = (section.selector || []).map((s) => { try { return document.querySelector(s); } catch { return null; } }).find(Boolean);
    if (!target) return section;
    target.setAttribute('data-excat-section', String(i));
    return { ...section, selector: [`[data-excat-section="${i}"]`] };
  });
  params.targets = { blocks, template: { ...PAGE_TEMPLATE, sections } };
}

export default {
  preprocess: (payload) => {
    // Early fixes the importer would otherwise lose (e.g. lazy images with only srcset are
    // dropped before transform).
    executeTransformers('preprocess', payload.document.body, payload, earlyTransformers);
    if (CATALOG) markPageTargets(payload);
  },
  transform: (payload) => {
    const { document, url, params } = payload;
    const main = document.body;
    params.fragments = [];

    if (!params.targets) markPageTargets(payload);
    const pageBlocks = params.targets.blocks
      .map((block, i) => ({ ...block, element: document.querySelector(`[data-excat-block="${i}"]`) }))
      .filter((block) => block.element);
    executeTransformers('beforeTransform', main, { ...payload, pageBlocks }, lateTransformers);

    pageBlocks.forEach((block) => {
      if (!main.contains(block.element)) return;
      const parser = parsers[block.name];
      if (!parser) return;
      try { parser(block.element, { document, url, params }); } catch (e) { console.error(`Failed to parse ${block.name} (${block.selector}):`, e); }
    });

    executeTransformers('afterTransform', main, payload);

    main.appendChild(document.createElement('hr'));
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // A fragment's nodes left `main` before afterTransform: finalize it the same way, without the
    // page-only section breaks and metadata.
    params.fragments.forEach(({ element }) => {
      executeTransformers('afterTransform', element, payload, earlyTransformers);
      WebImporter.rules.transformBackgroundImages(element, document);
      WebImporter.rules.adjustImageUrls(element, url, params.originalURL);
    });

    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const targetPath = PATH_OVERRIDES[rawPath] || rawPath;
    const path = WebImporter.FileUtils.sanitizePath(targetPath === '' ? '/index' : targetPath);

    return [{
      element: main,
      path,
      report: { title: document.title, template: PAGE_TEMPLATE.name, blocks: pageBlocks.map((b) => b.name) },
    }, ...params.fragments];
  },
};
