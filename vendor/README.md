# Tredjepartsbibliotek (självhostade)

Sajten laddar inget från andra servrar (Kina blockerar Google, och jsDelivr/unpkg/GitHub är opålitliga där). Biblioteken ligger därför här, med sina licenser bredvid.

| Mapp | Bibliotek | Version | Licens | Källa |
| --- | --- | --- | --- | --- |
| `d3/` | D3 (`d3.min.js`) | 7.9.0 | ISC (`d3/LICENSE`) | npm `d3@7.9.0` |
| `maplibre-gl/` | MapLibre GL JS (`maplibre-gl.js`, `maplibre-gl.css`) | 3.6.2 | BSD-3-Clause, delvis Mapbox BSD (`maplibre-gl/LICENSE.txt`) | npm `maplibre-gl@3.6.2` |
| `topojson-client/` | topojson-client (`topojson-client.min.js`) | 3.1.0 | ISC (`topojson-client/LICENSE`) | npm `topojson-client@3.1.0` |

Typsnitten ligger i `../fonts/` (Fraunces och Work Sans, SIL Open Font License 1.1, från Fontsource). Kinesiska tecken visas med besökarens systemtypsnitt.

Uppdatera: `npm pack <paket>@<version>`, packa upp och kopiera samma filer hit. Kartbibliotekets rad `//# sourceMappingURL=…` är borttagen (kartfilen följer inte med).
