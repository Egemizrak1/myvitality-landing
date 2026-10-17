# Vendored scripts

Served from the site itself (no third-party requests) and loaded by `app.js`
only after the page has settled; see `motion.js`.

| File | Package | License |
|---|---|---|
| `gsap.min.js` | gsap 3.15.0 (`dist/gsap.min.js`) | GSAP Standard "no charge" license, https://gsap.com/standard-license (header in file) |
| `ScrollTrigger.min.js` | gsap 3.15.0 (`dist/ScrollTrigger.min.js`) | same |
| `lenis.min.js` | lenis 1.3.26 (`dist/lenis.min.js`, source-map comment removed) | MIT, `lenis.LICENSE.txt` |

To update: `npm pack gsap@<v> lenis@<v>`, copy the same files, update this table.
