# columns-media-card

Custom **columns** block. Purpose: Promotional card pairing copy with a lifestyle photo.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, two cells: text cell (optional logo image, H2, paragraphs, link) and a picture-only cell.

## Supported variations

No authored variations. The JS picks one of two looks from the heading level:

- H1/H2 heading (or no heading): `columns-media-card-filled`, a light-blue, shadowed promo card with a square photo.
- H3 or lower: `columns-media-card-outlined`, a white card with a grey outline and a half-width photo. A last paragraph that holds only a link becomes a red pill CTA (`columns-media-card-cta`).

## Universal Editor fields

N/A (Document Authoring project)
