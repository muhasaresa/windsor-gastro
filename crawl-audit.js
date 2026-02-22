const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const startUrl = 'https://www.windsorgastro.co.uk/';
const allowedHost = 'www.windsorgastro.co.uk';
const outAudit = path.join(process.cwd(), 'audit');
const snapshotsDir = path.join(outAudit, 'snapshots');
const screenshotsDir = path.join(outAudit, 'screenshots');
const assetsDir = path.join(outAudit, 'assets_raw');

for (const dir of [outAudit, snapshotsDir, screenshotsDir, assetsDir]) fs.mkdirSync(dir, { recursive: true });

const sanitizeName = (urlStr) => {
  const u = new URL(urlStr);
  let p = u.pathname.replace(/\/+$/, '') || '/';
  if (p === '/') return 'home';
  return p.replace(/^\//, '').replace(/[^a-zA-Z0-9-_\/]/g, '-').replace(/\//g, '__');
};

const toAbs = (href, base) => {
  try { return new URL(href, base).toString(); } catch { return null; }
};

const isInternal = (urlStr) => {
  try {
    const u = new URL(urlStr);
    return (u.hostname === allowedHost || u.hostname === 'windsorgastro.co.uk') && ['http:', 'https:'].includes(u.protocol);
  } catch { return false; }
};

const isAsset = (urlStr) => /\.(png|jpe?g|gif|svg|webp|ico|bmp|avif|woff2?|ttf|eot|pdf)(\?|$)/i.test(urlStr);

async function downloadAsset(urlStr) {
  try {
    const u = new URL(urlStr);
    let filePath = decodeURIComponent(u.pathname);
    if (filePath.endsWith('/')) filePath += 'index';
    const outPath = path.join(assetsDir, filePath.replace(/^\//, ''));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    if (fs.existsSync(outPath)) return outPath;
    const res = await fetch(urlStr);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    fs.writeFileSync(outPath, Buffer.from(arr));
    return outPath;
  } catch {
    return null;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1366, height: 768 }, ignoreHTTPSErrors: true });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });

  const queue = [startUrl];
  const seen = new Set();
  const manifest = { generatedAt: new Date().toISOString(), startUrl, pages: [], assets: [] };
  const assetSet = new Set();

  while (queue.length) {
    const url = queue.shift();
    const normalized = url.replace(/#.*$/, '').replace(/\/$/, '') || startUrl;
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const page = await desktop.newPage();
    page.setDefaultTimeout(45000);
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
    } catch (e) {
      console.error('Failed to load', url, e.message);
      await page.close();
      continue;
    }

    const finalUrl = page.url();
    if (!isInternal(finalUrl)) { await page.close(); continue; }
    const name = sanitizeName(finalUrl);
    const html = await page.content();
    fs.writeFileSync(path.join(snapshotsDir, `${name}.html`), html);
    await page.screenshot({ path: path.join(screenshotsDir, `${name}-desktop.png`), fullPage: true });

    const mobilePage = await mobile.newPage();
    try {
      await mobilePage.goto(finalUrl, { waitUntil: 'networkidle' });
      await mobilePage.waitForTimeout(1200);
      await mobilePage.screenshot({ path: path.join(screenshotsDir, `${name}-mobile.png`), fullPage: true });
    } catch {}
    await mobilePage.close();

    const extracted = await page.evaluate(() => {
      const text = (el) => el?.textContent?.replace(/\s+/g, ' ').trim() || '';
      const getLinks = (root) => Array.from(root.querySelectorAll('a[href]')).map(a => ({ href: a.getAttribute('href') || '', text: text(a) })).filter(x => x.href);
      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({ level: h.tagName.toLowerCase(), text: text(h) }));
      const forms = Array.from(document.querySelectorAll('form')).map((f, i) => ({
        id: f.id || null,
        name: f.getAttribute('name') || null,
        action: f.getAttribute('action') || null,
        method: f.getAttribute('method') || 'get',
        fields: Array.from(f.querySelectorAll('input,textarea,select')).map(field => {
          const id = field.id;
          let label = '';
          if (id) {
            const l = document.querySelector(`label[for="${id}"]`);
            if (l) label = text(l);
          }
          if (!label) {
            const parentLabel = field.closest('label');
            if (parentLabel) label = text(parentLabel);
          }
          return {
            tag: field.tagName.toLowerCase(),
            type: field.getAttribute('type') || null,
            name: field.getAttribute('name') || null,
            id: field.id || null,
            required: field.required || field.getAttribute('aria-required') === 'true',
            placeholder: field.getAttribute('placeholder') || null,
            label,
          };
        }),
        submitText: text(f.querySelector('button[type="submit"],input[type="submit"]')),
      }));
      return {
        title: document.title || '',
        metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
        headings,
        navLinks: getLinks(document.querySelector('nav') || document),
        footerLinks: getLinks(document.querySelector('footer') || document.createElement('div')),
        mainBlocks: Array.from(document.querySelectorAll('main section, main article, main div')).slice(0, 30).map(el => text(el)).filter(Boolean),
        allLinks: getLinks(document),
        forms,
        visibleMessages: Array.from(document.querySelectorAll('[role="alert"], .error, .success, .wixui-error-message, .wixui-success-message')).map(el => text(el)).filter(Boolean),
      };
    });

    const allAbs = extracted.allLinks
      .map(l => ({ ...l, abs: toAbs(l.href, finalUrl) }))
      .filter(l => l.abs);

    for (const link of allAbs) {
      const clean = link.abs.replace(/#.*$/, '');
      if (isInternal(clean) && !seen.has(clean.replace(/\/$/, ''))) queue.push(clean);
      if (isAsset(clean)) assetSet.add(clean);
    }

    const domAssets = await page.evaluate(() => {
      const attrs = [
        ...Array.from(document.querySelectorAll('img[src]')).map(el => el.getAttribute('src')),
        ...Array.from(document.querySelectorAll('source[srcset]')).flatMap(el => (el.getAttribute('srcset') || '').split(',').map(x => x.trim().split(' ')[0])),
        ...Array.from(document.querySelectorAll('link[href]')).map(el => el.getAttribute('href')),
        ...Array.from(document.querySelectorAll('script[src]')).map(el => el.getAttribute('src')),
      ];
      return attrs.filter(Boolean);
    });
    domAssets.map(a => toAbs(a, finalUrl)).filter(Boolean).filter(isAsset).forEach(a => assetSet.add(a));

    manifest.pages.push({
      name,
      url: finalUrl,
      snapshot: `snapshots/${name}.html`,
      screenshots: {
        desktop: `screenshots/${name}-desktop.png`,
        mobile: `screenshots/${name}-mobile.png`,
      },
      ...extracted,
      internalLinks: allAbs.filter(l => isInternal(l.abs)).map(l => l.abs),
      externalLinks: allAbs.filter(l => !isInternal(l.abs)).map(l => ({ href: l.abs, text: l.text })),
    });

    await page.close();
  }

  for (const assetUrl of assetSet) {
    const saved = await downloadAsset(assetUrl);
    manifest.assets.push({ url: assetUrl, savedTo: saved ? path.relative(outAudit, saved) : null });
  }

  fs.writeFileSync(path.join(outAudit, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const reportLines = [];
  reportLines.push('# Windsor Gastro Audit Report');
  reportLines.push(`Generated: ${new Date().toISOString()}`);
  reportLines.push('## Site Map');
  manifest.pages.forEach(p => reportLines.push(`- ${p.url}`));
  reportLines.push('## Reusable Components');
  reportLines.push('- Header/navigation appears globally with links discovered in nav sections.');
  reportLines.push('- Footer contains contact details/social/legal links where present.');
  reportLines.push('## Functionality Summary');
  const formsPages = manifest.pages.filter(p => p.forms && p.forms.length);
  if (formsPages.length) {
    formsPages.forEach(p => reportLines.push(`- Form found on ${p.url}: ${p.forms.length} form(s), submit buttons: ${p.forms.map(f => f.submitText || '(none)').join(', ')}`));
  } else {
    reportLines.push('- No forms detected in rendered DOM.');
  }
  reportLines.push('## SEO Notes');
  manifest.pages.forEach(p => reportLines.push(`- ${p.url}: title="${p.title}"; description="${p.metaDescription}"`));
  reportLines.push('## Wix-specific Observations');
  reportLines.push('- Site appears Wix-rendered with dynamic scripts and generated class names.');
  reportLines.push('- Multiple assets are hosted on static.wixstatic.com and loaded at runtime.');

  fs.writeFileSync(path.join(outAudit, 'REPORT.md'), reportLines.join('\n'));

  await browser.close();
})();
