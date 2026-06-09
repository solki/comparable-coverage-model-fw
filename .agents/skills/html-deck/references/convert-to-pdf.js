const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const SLIDE_W = 1024;
const SLIDE_H = 576;

function findChrome() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function convertToPdf(inputHtml, outputPdf) {
  const htmlPath = path.resolve(inputHtml || "deck.html");
  const outputPath = outputPdf || htmlPath.replace(/\.html?$/i, ".pdf");
  const chromePath = findChrome();

  if (!chromePath) {
    console.error("Chrome not found. Install Google Chrome and try again.");
    process.exit(1);
  }

  console.log(`Converting: ${htmlPath}`);
  console.log(`Output:     ${outputPath}`);
  console.log(`Chrome:     ${chromePath}`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: SLIDE_W, height: SLIDE_H, deviceScaleFactor: 2 });
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 500));

  await page.pdf({
    path: outputPath,
    width: `${SLIDE_W}px`,
    height: `${SLIDE_H}px`,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    printBackground: true,
    preferCSSPageSize: false,
    displayHeaderFooter: false,
  });

  await browser.close();
  console.log(`Done! PDF saved to: ${outputPath}`);
}

const [inputArg, outputArg] = process.argv.slice(2);
convertToPdf(inputArg, outputArg).catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
