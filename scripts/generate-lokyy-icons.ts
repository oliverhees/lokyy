#!/usr/bin/env bun
/**
 * generate-lokyy-icons.ts — Renders the Lokyy logo SVG to PNG raster set.
 *
 * Inputs:
 *   - Sallys 24x24 viewBox SVG: rounded square + offset inner dot.
 *   - Lokyy Primary Indigo #6E63F2, inner #FAFAFC (Sallys --primary-foreground).
 *
 * Outputs (into lokyy-workspace/public/):
 *   - lokyy.svg              — single-source-of-truth SVG
 *   - lokyy-{16,32,48,180,192,512}.png — square favicons / PWA icons
 *   - lokyy-og.png (1200x630) — Open Graph image with the lockup logo + tagline
 *
 * Method: Playwright (installed in outer node_modules) renders an HTML page
 * containing the SVG at the target viewport, then page.screenshot() with
 * omitBackground=true produces a transparent PNG.
 *
 * Re-runnable: idempotent. Re-render whenever the logo spec changes.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PUBLIC_DIR = join(ROOT, "lokyy-workspace", "public");

const PRIMARY = "#6E63F2"; // Lokyy Indigo (Dark-Mode Primary, Sally Spec)
const INNER = "#FAFAFC"; // Lokyy --primary-foreground, near-white
const DARK_BG = "#0B0D14"; // Lokyy --background (Dark-Mode App-BG)
const MUTED_FG = "#9CA0AE"; // Lokyy --muted-foreground (for tagline)

const SYMBOL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-label="lokyy">
  <rect x="2" y="2" width="20" height="20" rx="5" fill="${PRIMARY}"/>
  <circle cx="9" cy="9" r="2.5" fill="${INNER}"/>
</svg>`;

const SIZES = [16, 32, 48, 180, 192, 512];

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });

  // A. Write the single-source-of-truth SVG
  await writeFile(join(PUBLIC_DIR, "lokyy.svg"), SYMBOL_SVG + "\n");
  console.log("wrote lokyy.svg");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    // B. Square favicon / PWA raster set
    for (const s of SIZES) {
      await page.setViewportSize({ width: s, height: s });
      const html = `<!doctype html><html><body style="margin:0;padding:0;background:transparent">
        <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="2" width="20" height="20" rx="5" fill="${PRIMARY}"/>
          <circle cx="9" cy="9" r="2.5" fill="${INNER}"/>
        </svg></body></html>`;
      await page.setContent(html, { waitUntil: "load" });
      const out = join(PUBLIC_DIR, `lokyy-${s}.png`);
      await page.screenshot({
        path: out,
        omitBackground: true,
        clip: { x: 0, y: 0, width: s, height: s },
      });
      console.log(`wrote lokyy-${s}.png`);
    }

    // C. Open Graph image (1200x630) — lockup centered on Lokyy dark-indigo bg + tagline
    const ogW = 1200;
    const ogH = 630;
    await page.setViewportSize({ width: ogW, height: ogH });
    const ogHtml = `<!doctype html><html><head><style>
      html,body{margin:0;padding:0;width:${ogW}px;height:${ogH}px;background:${DARK_BG};
        font-family:Inter,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
        display:flex;align-items:center;justify-content:center;}
      .stack{display:flex;flex-direction:column;align-items:center;gap:48px;}
      .lockup{display:flex;align-items:center;gap:32px;}
      .symbol{width:144px;height:144px;}
      .wordmark{font-weight:600;font-size:128px;letter-spacing:-0.02em;color:#F2F3F7;line-height:1;}
      .tagline{font-size:32px;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED_FG};font-weight:500;}
    </style></head><body>
      <div class="stack">
        <div class="lockup">
          <svg class="symbol" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="${PRIMARY}"/>
            <circle cx="9" cy="9" r="2.5" fill="${INNER}"/>
          </svg>
          <div class="wordmark">lokyy</div>
        </div>
        <div class="tagline">AI Operating System</div>
      </div>
    </body></html>`;
    await page.setContent(ogHtml, { waitUntil: "load" });
    const ogOut = join(PUBLIC_DIR, "lokyy-og.png");
    await page.screenshot({
      path: ogOut,
      clip: { x: 0, y: 0, width: ogW, height: ogH },
    });
    console.log("wrote lokyy-og.png");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
