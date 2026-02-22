# Windsor Gastroenterology static site (Netlify-ready)

## Deploy
### Option 1: Netlify drag-and-drop
1. Zip the `site/` directory contents (not the parent folder).
2. In Netlify, choose **Add new site** → **Deploy manually**.
3. Drag the zip contents to deploy.

### Option 2: Git-based deploy
1. Push this repository to your Git host.
2. Create a new Netlify site from Git.
3. Build command: *(leave empty)*
4. Publish directory: `site`
5. Keep `netlify.toml` at repo root for redirects/404 behavior.

## Domain cutover steps (keep existing domain)
1. In Netlify Site settings → Domain management, add `www.windsorgastro.co.uk` and apex domain if required.
2. Update DNS at current registrar:
   - `www` CNAME to your Netlify subdomain.
   - Apex/root domain via Netlify DNS or ALIAS/ANAME depending on provider.
3. Wait for DNS propagation and verify HTTPS certificate is issued.

## Contact form setup (Netlify Forms)
- Contact page uses Netlify form attributes:
  - `data-netlify="true"`
  - hidden `form-name` field
  - honeypot via `data-netlify-honeypot="bot-field"`
- Form posts to `/thank-you/` success page.
- Verify after first deploy:
  1. Submit a test message from `/contact-me/`.
  2. In Netlify UI, open **Forms** and confirm submission appears.
  3. Confirm redirect to `/thank-you/` shows success message.

## Maintenance notes
- Edit page copy directly in each page's `index.html`.
- Global styles: `site/assets/css/styles.css`
- Mobile navigation behavior: `site/assets/js/main.js`
- Update `site/sitemap.xml` and `site/robots.txt` when adding/removing pages.
