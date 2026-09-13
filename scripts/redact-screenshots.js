const puppeteer = require("puppeteer-core");
const path = require("path");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.argv[2];
const pages = [
  ["dashboard", "/"],
  ["transactions", "/transactions"],
  ["forecast", "/forecast"],
  ["subscriptions", "/subscriptions"],
  ["onboarding", "/onboarding"],
];

// Masks account numbers, IBANs, and card last-4 digits shown anywhere in the
// UI while leaving amounts (comma/dot-grouped), percentages, and dates
// (dot-separated) readable — those aren't personally identifying.
const REDACT_JS = `
(function() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const re = /(?<![\\d,.])\\d{4,}(?![\\d,.%])/g;
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  for (const node of nodes) {
    if (re.test(node.nodeValue)) {
      re.lastIndex = 0;
      node.nodeValue = node.nodeValue.replace(re, (m) => "\\u2022".repeat(m.length));
    }
  }
})();
`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  for (const [name, route] of pages) {
    await page.goto(`http://localhost:3000${route}`, { waitUntil: "networkidle0" });
    await page.evaluate(REDACT_JS);
    await new Promise((r) => setTimeout(r, 150));
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  }
  await browser.close();
})();
