# columns-split-media

Custom **columns** block. Purpose: Full-width band pairing a lifestyle or product photo with explanatory copy.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, two cells: a picture-only cell and a text cell, in either order.

Text cell content:
- H2 title, paragraphs.
- Icon items: an `:icon-name:` paragraph followed by an optional H3 and copy paragraphs. Each item runs
  until the next icon paragraph, a link-only paragraph, or a `<sub>`/`<small>`-only legal note.
- CTA: a paragraph holding only one link renders as a navy pill. Links longer than 40 characters stay text
  links. Bold/italic links (global `.button.primary` / `.button.secondary`) keep their global color.

Layout: the photo is on top on mobile. On desktop, a photo-first row is top-aligned and a text-first row is
vertically centered (as on the source). A text cell with icon items uses the smaller title size (40px / 32px).

## Supported variations

No variations.

## Universal Editor fields

N/A (Document Authoring project)
