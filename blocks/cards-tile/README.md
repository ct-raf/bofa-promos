# cards-tile

Custom **cards** block. Purpose: Centered tiles without outline: media on top, bold heading, copy and an optional CTA.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row per tile: cell 1 image or :icon:, cell 2 H3 title (sup footnote allowed), paragraph copy, optional CTA link. The media cell may be omitted; empty paragraphs are dropped.

## Supported variations

No variations. The look follows the content shape, via classes the block JS sets on each tile (`li`):

- `cards-tile-icon` — media cell is an `:icon:` (text `:name:` is converted to an icon span): 60px icon, 300px feature tiles.
- `cards-tile-graphic` — media is a small spot image (natural width under 200px): 70px-high icon, red heading (step tiles).
- `cards-tile-photo` — media is a larger illustration/photo: full-width image above the copy.
- `cards-tile-has-cta` — the body ends in a paragraph holding only a link; it renders as a red pill (`p.cards-tile-cta`). Photo tiles with a CTA get a grey card body.
- `cards-tile-no-image` — no media cell.

## Universal Editor fields

N/A (Document Authoring project)
