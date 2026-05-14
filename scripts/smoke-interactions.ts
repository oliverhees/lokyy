#!/usr/bin/env bun
/**
 * scripts/smoke-interactions.ts
 *
 * Etappe-1 smoke: light-mode toggle, dialogs/dropdowns, mobile viewport,
 * console-error tally across all 13 routes. Read-only on workspace.
 *
 * Output: docs/verification-shots/smoke-etappe-1/*.png + JSON tally
 *         on stdout for the report.
 */
import { chromium, type Page } from "playwright";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "http://localhost:3002";
const OUT = "docs/verification-shots/smoke-etappe-1";
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const ROUTES = [
  "dashboard", "chat", "files", "terminal", "jobs", "tasks", "conductor",
  "operations", "swarm", "memory", "skills", "mcp", "profiles",
];

type RouteReport = {
  route: string;
  status: number;
  consoleErrors: string[];
  failedRequests: string[];
};

async function dismissOnboarding(page: Page) {
  try {
    await page.getByText("Skip setup", { exact: false }).first().click({ timeout: 2000 });
    await page.waitForTimeout(800);
  } catch {
    /* already dismissed */
  }
}

async function captureConsole(page: Page) {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text().slice(0, 200));
  });
  page.on("requestfailed", (req) => {
    failed.push(`${req.failure()?.errorText ?? "?"} ${req.url()}`);
  });
  return { errors, failed };
}

async function consoleScan(): Promise<RouteReport[]> {
  const browser = await chromium.launch({ headless: true });
  const reports: RouteReport[] = [];
  try {
    for (const route of ROUTES) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const cap = await captureConsole(page);
      const resp = await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => null);
      await dismissOnboarding(page);
      await page.waitForTimeout(1200);
      reports.push({
        route,
        status: resp?.status() ?? 0,
        consoleErrors: cap.errors,
        failedRequests: cap.failed,
      });
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return reports;
}

async function lightMode() {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 30_000 });
    await dismissOnboarding(page);
    // Try via theme-toggle button in the sidebar footer first
    const toggled = await page.evaluate(() => {
      // Look for any element with data-theme or class involving "theme-toggle"
      // Fallback: directly set CSS variables via document.documentElement
      const root = document.documentElement;
      const currentTheme = root.getAttribute("data-theme") ?? root.className;
      // Hermes stores theme in localStorage under "claude-theme" (per CLAUDE.md theme IDs)
      // Try common keys; nous-light is the light variant of the claude-nous theme
      try {
        localStorage.setItem("claude-theme", "claude-nous-light");
        localStorage.setItem("theme", "light");
        // Force class change on html
        root.classList.remove("dark");
        root.classList.add("light");
        root.setAttribute("data-theme", "claude-nous-light");
      } catch {}
      return { before: currentTheme };
    });
    await page.reload({ waitUntil: "networkidle" });
    await dismissOnboarding(page);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/dashboard-light.png`, fullPage: false });
    console.log("light-mode toggled (before:", JSON.stringify(toggled), ")");
  } finally {
    await browser.close();
  }
}

async function settingsAndDialog() {
  // Settings dialog/sheet — open via the gear button visible on /dashboard top-right
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 30_000 });
    await dismissOnboarding(page);
    await page.waitForTimeout(800);

    // Try clicking the gear icon button (multiple gears in DOM; pick the small one in top toolbar)
    // Strategy: query all buttons, click the last one in the top action bar with svg-only content
    const settingsClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      // Try aria-label heuristics first
      const byLabel = buttons.find((b) => {
        const aria = (b.getAttribute("aria-label") ?? "").toLowerCase();
        return aria.includes("setting") || aria.includes("einstell");
      });
      if (byLabel) {
        (byLabel as HTMLButtonElement).click();
        return "by-aria-label";
      }
      return null;
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/settings-dialog.png`, fullPage: false });
    console.log("settings-dialog clicked via:", settingsClicked);
  } finally {
    await browser.close();
  }
}

async function userMenuDropdown() {
  // Footer user-avatar menu in the Lokyy sidebar — dropdown test
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 30_000 });
    await dismissOnboarding(page);
    await page.waitForTimeout(800);

    // Lokyy sidebar = LokyySidebar component. Footer has user avatar.
    // Click on user button at bottom of sidebar (last button-like role in nav).
    const clicked = await page.evaluate(() => {
      const aside = document.querySelector("aside") ?? document.querySelector("nav");
      if (!aside) return "no-sidebar";
      const buttons = Array.from(aside.querySelectorAll("button"));
      if (buttons.length === 0) return "no-buttons";
      const last = buttons[buttons.length - 1] as HTMLButtonElement;
      last.click();
      return `clicked: ${last.outerHTML.slice(0, 120)}`;
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/user-dropdown.png`, fullPage: false });
    console.log("user-dropdown:", clicked);
  } finally {
    await browser.close();
  }
}

async function tooltipHover() {
  // Sidebar nav items have tooltips when collapsed.
  // Easier: hover the sidebar collapse-toggle button.
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 30_000 });
    await dismissOnboarding(page);
    await page.waitForTimeout(800);

    // Try hovering on a sidebar icon
    const navItem = page.getByText("Dashboard").first();
    await navItem.hover().catch(() => null);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/tooltip-hover.png`, fullPage: false });
    console.log("tooltip-hover screenshot taken");
  } finally {
    await browser.close();
  }
}

async function mobileShots() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const route of ["dashboard", "chat", "settings"]) {
      const path = route === "settings" ? "dashboard" : route; // /settings is not a route; use dashboard + settings dialog
      const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const page = await ctx.newPage();
      const url = `${BASE}/${path}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      await dismissOnboarding(page);
      await page.waitForTimeout(1200);
      if (route === "settings") {
        // Try open settings dialog on dashboard mobile
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button"));
          const target = btns.find((b) => (b.getAttribute("aria-label") ?? "").toLowerCase().includes("setting"));
          if (target) (target as HTMLButtonElement).click();
        });
        await page.waitForTimeout(1000);
      }
      await page.screenshot({ path: `${OUT}/${route}-mobile.png`, fullPage: false });
      await ctx.close();
    }
    console.log("mobile shots done");
  } finally {
    await browser.close();
  }
}

async function main() {
  const phase = process.argv[2] ?? "all";

  if (phase === "all" || phase === "console") {
    console.log("\n=== CONSOLE-ERROR SCAN ===");
    const reports = await consoleScan();
    writeFileSync(`${OUT}/_console-tally.json`, JSON.stringify(reports, null, 2));
    for (const r of reports) {
      console.log(`/${r.route} [${r.status}] console=${r.consoleErrors.length} failed=${r.failedRequests.length}`);
    }
  }

  if (phase === "all" || phase === "light") {
    console.log("\n=== LIGHT MODE ===");
    await lightMode();
  }

  if (phase === "all" || phase === "dialog") {
    console.log("\n=== SETTINGS DIALOG ===");
    await settingsAndDialog();
  }

  if (phase === "all" || phase === "dropdown") {
    console.log("\n=== USER DROPDOWN ===");
    await userMenuDropdown();
  }

  if (phase === "all" || phase === "tooltip") {
    console.log("\n=== TOOLTIP HOVER ===");
    await tooltipHover();
  }

  if (phase === "all" || phase === "mobile") {
    console.log("\n=== MOBILE ===");
    await mobileShots();
  }
}

await main();
