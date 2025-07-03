#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { AxePuppeteer } from 'axe-puppeteer';

/**
 * Run axe-core accessibility audit on a given URL
 * @param {string} url - The URL to audit
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Axe audit results
 */
async function runAxeAudit(url, options = {}) {
  const { headless = true } = options;

  const browser = await puppeteer.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto(url, { waitUntil: 'networkidle2' });

    const results = await new AxePuppeteer(page).analyze();

    return results.violations;
  } catch (error) {
    console.error('Audit failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    process.exit(1);
  }

  const url = args[0];
  const options = {};

  if (args.includes('--output')) {
    const outputIndex = args.indexOf('--output');
    options.outputFile = args[outputIndex + 1];
  }

  if (args.includes('--visible')) {
    options.headless = false;
  }

  try {
    const results = await runAxeAudit(url, options);
    if (results.violations > 0) {
      process.exit(1);
    }
  } catch (error) {
    process.exit(1);
  }
}

export default runAxeAudit;
