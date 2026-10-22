# SM Royale

Arabic / English responsive company website for SM Royale, Casablanca.

## Development

Requires Node.js 20 or later. No package installation or external JavaScript dependencies are needed.

```sh
npm run dev
```

The server uses port 3000 by default; set `PORT` to override.

```sh
npm run build
```

Deploy the generated `dist/` directory to a static hosting provider, or run `npm start` on a Node host.

## Catalogue and content

Arabic opens by default, with English switching and saved language preference. The catalogue contains 161 supplied product visuals across bottles, jars, perfume packaging, pouches, closures and wellness tools. Visitors can search in either language or by reference, filter categories, sort, load more products and open an accessible product dialog. WhatsApp enquiries include the reference, chosen size and listed price when present.

`public/products.json` contains bilingual names and 121 priced variants for 31 matched catalogue entries. Another 13 hijama prices appear in the expandable price guide. Prices are reproduced from the supplied sheets; ambiguous product/price matches remain “Price on request.” Quantities, minimum orders, taxes and live availability require confirmation. No inventory counts from the source sheets are published.

- `public/catalogue.js`: catalogue interaction, detail dialogs and hijama price guide.
- `public/app.js`: language switching and Arabic interface translations.
- `public/products.json`: product records, image paths and price variants.
- `public/images/products/`: 161 optimised WebP product visuals.
- `docs/catalogue-sources.json`: internal attachment provenance and matched price sources; excluded from the public build.

Only `public/` is copied into `dist/`. No payment or checkout is implemented.

## Validation

The production build and JavaScript syntax checks passed. Chromium browser checks covered Arabic/English switching, RTL/LTR, persisted language, catalogue search and filtering, pagination, sorting, priced and unpriced product dialogs, variant prices and WhatsApp messages, dialog keyboard dismissal, empty states, the hijama price table and mobile layouts at 390px and 320px.

## GitHub Pages

The `gh-pages` branch contains the deployable contents of `public/`. In repository Settings → Pages, choose “Deploy from a branch”, `gh-pages`, and `/(root)`. Product assets use relative paths so the site works under `/SM-ROYALE/`.

To update the website after source changes, publish the contents of `public/` to `gh-pages`, preserving the branch history and without force-pushing.

## Royal visual identity

The interface follows the supplied SM Royale card: black leather, warm metallic gold, ornamental corners and the original crown/SM mark. `public/images/logo-transparent.png` is a transparent-background extraction of the supplied gold crown/SM emblem, prepared with the image tool. `public/images/royal-hero.png` is a generated brand illustration, not a promise of exact catalogue models. Actual product visuals remain in the catalogue.

Fonts are served locally from `public/fonts/`: Cairo for Arabic, Manrope for interface text and Cormorant Garamond for English display headings. Their license notices are retained alongside the fonts. No external font service is required.

Catalogue and collection panels use inset photographic mats, gold double borders, ornamental corners, reference badges and dedicated size/price areas. Product imagery remains uncropped in catalogue cards.
