/* eslint-disable */
/* global WebImporter */

import heroOfferParser from './parsers/hero-offer.js';
import cardsTileParser from './parsers/cards-tile.js';
import columnsMediaCardParser from './parsers/columns-media-card.js';
import columnsGetappParser from './parsers/columns-getapp.js';
import cleanupTransformer from './transformers/bofa-cleanup.js';
import sectionsTransformer from './transformers/bofa-sections.js';

const PAGE_TEMPLATE = {
  "name": "debit-card-overview",
  "urls": [
    "https://promotions.bankofamerica.com/deposits/debitcard/overview",
    "https://promotions.bankofamerica.com/deposits/es/debitcard/overview"
  ],
  "representativeUrl": "https://promotions.bankofamerica.com/deposits/debitcard/overview",
  "description": "Debit card overview product page (English and Spanish)",
  "blocks": [
    {
      "name": "hero-offer",
      "instances": [
        "section.masthead",
        ".masthead"
      ]
    },
    {
      "name": "cards-tile",
      "instances": [
        "section.features .features__items",
        "section.tiles"
      ]
    },
    {
      "name": "columns-media-card",
      "instances": [
        "section.preferred-cards"
      ]
    },
    {
      "name": "columns-getapp",
      "instances": [
        ".getapp2"
      ]
    }
  ],
  "urlPattern": "/deposits/**/debitcard/overview",
  "sections": [
    {
      "id": "section-1",
      "name": "Masthead photo",
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
      "name": "Debit card security features",
      "selector": [
        ".aem-wrap--features",
        "section.features"
      ],
      "style": null,
      "blocks": [
        "cards-tile"
      ],
      "defaultContent": [
        ".features__heading"
      ]
    },
    {
      "id": "section-3",
      "name": "Activate, set up and spend band",
      "selector": [
        ".aem-wrap--long-form-text",
        "section.long-form-text"
      ],
      "style": "red",
      "blocks": [],
      "defaultContent": [
        ".long-form-text h2"
      ]
    },
    {
      "id": "section-4",
      "name": "Activate / Monitor / Pay tiles",
      "selector": [
        ".aem-wrap--long-form-text + .aem-wrap--tiles"
      ],
      "style": null,
      "blocks": [
        "cards-tile"
      ],
      "defaultContent": []
    },
    {
      "id": "section-5",
      "name": "Ways to PAY banner",
      "selector": [
        ".aem-wrap--tiles + .aem-wrap--content-banner"
      ],
      "style": "dark-blue",
      "blocks": [],
      "defaultContent": [
        "uc-content-banner h2"
      ]
    },
    {
      "id": "section-6",
      "name": "Enhanced Digital Card for Debit card",
      "selector": [
        ".aem-wrap--content-banner + .aem-wrap--preferred-cards"
      ],
      "style": null,
      "blocks": [
        "columns-media-card"
      ],
      "defaultContent": []
    },
    {
      "id": "section-7",
      "name": "Digital Wallet card",
      "selector": [
        ".aem-wrap--preferred-cards + .aem-wrap--preferred-cards"
      ],
      "style": null,
      "blocks": [
        "columns-media-card"
      ],
      "defaultContent": []
    },
    {
      "id": "section-8",
      "name": "Paze card",
      "selector": [
        ".aem-wrap--preferred-cards + .aem-wrap--preferred-cards + .aem-wrap--preferred-cards"
      ],
      "style": null,
      "blocks": [
        "columns-media-card"
      ],
      "defaultContent": []
    },
    {
      "id": "section-9",
      "name": "Ways to SAVE banner",
      "selector": [
        ".aem-wrap--preferred-cards + .aem-wrap--content-banner"
      ],
      "style": "dark-blue",
      "blocks": [],
      "defaultContent": [
        "uc-content-banner h2"
      ]
    },
    {
      "id": "section-10",
      "name": "Save and rewards tiles",
      "selector": [
        ".aem-wrap--content-banner + .aem-wrap--tiles"
      ],
      "style": null,
      "blocks": [
        "cards-tile"
      ],
      "defaultContent": []
    },
    {
      "id": "section-11",
      "name": "Get the mobile app",
      "selector": [
        ".aem-wrap--mobile-app",
        ".getapp2"
      ],
      "style": null,
      "blocks": [
        "columns-getapp"
      ],
      "defaultContent": []
    },
    {
      "id": "section-12",
      "name": "Disclosures (legal footnotes)",
      "selector": [
        ".disclosures"
      ],
      "style": "light-grey",
      "blocks": [],
      "defaultContent": [
        ".disclosures__item"
      ]
    }
  ]
};



// Target document paths that differ from the source path (none unless listed).
const PATH_OVERRIDES = {

};

const parsers = {
  'hero-offer': heroOfferParser,
  'cards-tile': cardsTileParser,
  'columns-media-card': columnsMediaCardParser,
  'columns-getapp': columnsGetappParser,
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
