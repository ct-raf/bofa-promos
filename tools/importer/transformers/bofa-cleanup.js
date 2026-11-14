/* eslint-disable */
/* global WebImporter */

/**
 * Bank of America promotions cleanup transformer.
 * Selectors come from migration-work/cleaned.html (same markup on EN and ES pages).
 */

// Non-authorable chrome removed before parsing so it cannot affect block matching.
const CHROME_SELECTORS = [
  // header / nav / skip links
  '.aem-wrap--expanded-navigation',
  '.expanded-nav__menuWrapper',
  'nav',
  '.ada-skip',
  // modals (leaving-site, ad choices, mobile app)
  '.aem-wrap--modal',
  '.modal__content',
  // OneTrust cookie banner / preference center
  '#onetrust-consent-sdk',
  '[id^="onetrust-"]',
  '.onetrust-pc-dark-filter',
  // chat widget
  '#widgetContainer',
  // empty spacer bands
  '.aem-wrap--separator',
  'section.separator',
  // sticky product bar (duplicate of the product cards)
  '.product-details__sticky',
  '.product-details__stickyWrapper',
  '.product-details__stickyTrigger',
  // mobile-only duplicate product tabs above the product carousel
  '.product-details__productTab',
  '.only-mobile',
  // hidden "back to footnote" helper notes in disclosures
  '.disclosures__note.not-visible',
  // non-content elements
  'script',
  'style',
  'noscript',
  'link',
  'iframe',
];

// Lazy-loaded images carry only srcset (empty or data: placeholder src). The importer drops such
// images before transform, so this runs in `preprocess` (and again in beforeTransform): use the
// largest srcset candidate (img, else the picture's last <source>), or data-src.
function fixLazyImages(element) {
  const largest = (srcset) => (srcset || '').split(',').map((c) => c.trim().split(/\s+/))
    .filter(([u]) => u && !u.startsWith('data:'))
    .map(([u, w]) => [u, parseFloat(w) || 0])
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  element.querySelectorAll('img').forEach((img) => {
    // Prefer the desktop rendition: the <picture> source with the largest min-width media query
    // (snapshots may have been rendered at a mobile width, leaving the mobile crop in src).
    const desktop = [...(img.closest('picture')?.querySelectorAll('source[media][srcset]') || [])]
      .map((s) => [s, parseFloat((s.getAttribute('media').match(/min-width:\s*([\d.]+)/) || [])[1]) || 0])
      .sort((a, b) => b[1] - a[1])[0];
    if (desktop && desktop[1] > 0) {
      const url = largest(desktop[0].getAttribute('srcset')) || desktop[0].getAttribute('srcset').trim().split(/\s+/)[0];
      if (url && !url.startsWith('data:')) { img.setAttribute('src', url); return; }
    }
    const src = img.getAttribute('src') || '';
    if (src && !src.startsWith('data:')) return;
    const sources = [...(img.closest('picture')?.querySelectorAll('source') || [])];
    const url = img.getAttribute('data-src') || largest(img.getAttribute('srcset'))
      || largest(img.getAttribute('data-srcset'))
      || largest(sources.length ? sources[sources.length - 1].getAttribute('srcset') : '');
    if (url) img.setAttribute('src', url);
  });
}

export default function transform(hookName, element, payload) {
  const doc = element.ownerDocument || payload.document;

  if (hookName === 'preprocess') {
    fixLazyImages(element);
    return;
  }

  if (hookName === 'beforeTransform') {
    fixLazyImages(element);

    // Keep the legal disclosures band: it lives inside <footer> but is page content.
    // Move it into the main content before the footer is removed.
    const main = element.querySelector('main#main-content, main') || element;
    const disclosures = [...element.querySelectorAll('.disclosures')];
    disclosures.forEach((d) => {
      if (d.closest('footer') || !main.contains(d)) {
        main.append(d);
      }
    });

    // Footnotes: the source shows each footnote's number as a superscript before its text, but the
    // markup has a hidden number before and a visible back link after the text. Rebuild as one
    // leading <sup>N</sup> in the footnote's first paragraph and drop both number links.
    element.querySelectorAll('.disclosures__item').forEach((item) => {
      const notes = [...item.querySelectorAll('a.disclosures__note')];
      if (!notes.length) return;
      const num = notes.map((a) => a.textContent.trim()).find(Boolean);
      notes.forEach((a) => a.remove());
      const text = item.querySelector('.disclosures__text') || item;
      const first = text.querySelector('p') || text;
      if (!num || !first) return;
      const sup = doc.createElement('sup');
      sup.textContent = num;
      first.prepend(sup, doc.createTextNode(' '));
    });

    // uc-background images are set by CSS custom properties (--image-l-url etc.) in inline <style>
    // rules keyed by the component id; when the component JS has not injected an <img>, add one
    // from those rules before <style> elements are removed.
    const styleText = [...doc.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    element.querySelectorAll('uc-background[id]').forEach((bg) => {
      const container = bg.querySelector('.uc-background__container--image');
      if (!container || container.querySelector('img')) return;
      const id = bg.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rule = styleText.match(new RegExp(`${id}"?\\]?[^{]*\\.uc-background__container--image\\s*\\{([^}]*)\\}`));
      if (!rule) return;
      const url = (rule[1].match(/--image-l-url:\s*url\(["']?([^"')]+)["']?\)/)
        || rule[1].match(/--image-m-url:\s*url\(["']?([^"')]+)["']?\)/)
        || rule[1].match(/--image-s-url:\s*url\(["']?([^"')]+)["']?\)/) || [])[1];
      if (!url) return;
      const img = doc.createElement('img');
      img.setAttribute('src', url);
      img.setAttribute('alt', '');
      container.prepend(img);
    });

    // Component background images (masthead, preferred-cards photo, ...) are set by <style> rules
    // keyed on a per-instance class such as `.masthead-275967173`; the last rule for a class is the
    // desktop one. Copy that url onto the element as an inline background-image (when it has none)
    // so parsers and transformBackgroundImages can pick it up after <style> is removed.
    const decodeCss = (s) => s.replace(/\\([0-9a-f]{1,6})\s?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, '$1');
    const bgByClass = {};
    (styleText.match(/[^{}]+\{[^{}]*\}/g) || []).forEach((rule) => {
      const [, sel, body] = rule.match(/([^{}]+)\{([^{}]*)\}/);
      const m = body.match(/background-image:\s*url\(\s*["']?((?:\\.|[^"')\\])+)["']?\s*\)/i);
      if (!m) return;
      const url = decodeCss(m[1]).trim();
      if (!url) return;
      (sel.match(/\.[A-Za-z][\w-]*-\d+(?![\w-])/g) || []).forEach((cls) => { bgByClass[cls.slice(1)] = url; });
    });
    Object.entries(bgByClass).forEach(([cls, url]) => {
      element.querySelectorAll(`.${CSS.escape(cls)}`).forEach((el) => {
        if (/background-image/i.test(el.getAttribute('style') || '')) return;
        el.setAttribute('style', `${el.getAttribute('style') ? `${el.getAttribute('style')}; ` : ''}background-image: url(${url})`);
      });
    });

    WebImporter.DOMUtils.remove(element, CHROME_SELECTORS);

    // Single-cell layout tables (e.g. a boxed note in the disclosures) are not data tables: unwrap
    // them so the importer doesn't turn them into a block. Multi-cell tables (bonus chart) stay.
    element.querySelectorAll('table').forEach((table) => {
      const cells = table.querySelectorAll('td, th');
      if (cells.length !== 1 || table.querySelectorAll('tr').length !== 1) return;
      table.replaceWith(...cells[0].childNodes);
    });

    // Theme decoration (e.g. flagscape swooshes) lives under /etc.clientlibs/ — never authored content.
    element.querySelectorAll('[style*="background-image"]').forEach((el) => {
      if (/\/etc\.clientlibs\//.test(el.getAttribute('style'))) {
        el.style.removeProperty('background-image');
        if (!el.getAttribute('style').trim()) el.removeAttribute('style');
      }
    });
    element.querySelectorAll('img').forEach((img) => {
      if (/\/etc\.clientlibs\//.test(img.getAttribute('src') || '')) (img.closest('picture') || img).remove();
    });

    // Empty AEM grid wrappers (e.g. a stray .aem-wrap--tile with no text or media).
    element.querySelectorAll('[class*="aem-wrap--"]').forEach((el) => {
      if (!el.textContent.trim() && !el.querySelector('img, picture, video, iframe, [style*="background-image"]')) el.remove();
    });

    // Script-injected placeholder link at the top of <body> (text "___", href="#").
    [...element.children].forEach((el) => {
      if (el.tagName === 'A' && el.getAttribute('href') === '#' && /^[\s_]*$/.test(el.textContent)) el.remove();
    });

    // Remove site header and footer (disclosures already moved out).
    element.querySelectorAll('header, footer').forEach((el) => {
      if (!el.querySelector('.disclosures')) el.remove();
    });
    // Footer remnants outside <footer> (defensive across page variants).
    element.querySelectorAll('.footer.responsivegrid, .footer_wrapper, .footer__ar').forEach((el) => {
      if (!el.querySelector('.disclosures')) el.remove();
    });
  }

  if (hookName === 'afterTransform') {
    // Final cleanup of leftover chrome. Do not touch HTML comments.
    WebImporter.DOMUtils.remove(element, [
      'script',
      'style',
      'noscript',
      'link',
      'iframe',
      'button',
    ]);

    // Pill CTAs in default content (outside block tables): red -> **link** (primary button),
    // navy -> _link_ (secondary button), white -> **_link_** (accent button, used on colored
    // bands), each in its own paragraph so EDS decorates it as a button.
    element.querySelectorAll('a.cta--red, a.cta--blue, a.cta--white').forEach((a) => {
      if (a.closest('table') || a.closest('strong, em, b, i')) return;
      const white = a.classList.contains('cta--white');
      const wrap = doc.createElement(a.classList.contains('cta--red') || white ? 'strong' : 'em');
      a.replaceWith(wrap);
      if (white) {
        const em = doc.createElement('em');
        wrap.append(em);
        em.append(a);
      } else {
        wrap.append(a);
      }
      const p = wrap.closest('p');
      if (!p || p.textContent.trim() !== a.textContent.trim()) {
        const own = doc.createElement('p');
        wrap.replaceWith(own);
        own.append(wrap);
      }
    });

    // Strip tracking / framework attributes.
    element.querySelectorAll('*').forEach((el) => {
      [...el.attributes].forEach((attr) => {
        const n = attr.name;
        // Keep data-excat-* markers: the sections transformer (runs after this one) needs them
        // and removes them itself.
        if (n.startsWith('data-excat-')) return;
        if (n.startsWith('data-') || n.startsWith('on') || n === 'tabindex') {
          el.removeAttribute(n);
        }
      });
    });
  }
}
