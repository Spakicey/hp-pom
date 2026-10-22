# Pawprint — Visit Cards

A mobile-first React + TypeScript prototype for creating Rover-style dog-walking and drop-in visit cards. It is designed for iPhone Safari and can be installed to the Home Screen as a web app.

**This is a client-side prototype. There is no database, login, API, analytics, or automatic upload of visit records.** Visit details, route points, and selected photos live in the current page's memory. Export the data before refreshing, closing the tab, or starting another visit.

## What is included

- React + TypeScript + Vite.
- Responsive, mobile-first visit workflow.
- Walk and drop-in service types.
- Visit timer based on start/end timestamps.
- GPS route tracking via `navigator.geolocation.watchPosition()`.
- Leaflet map with OpenStreetMap tiles, route line, start/end markers, and distance estimate.
- Care checklist, notes, and up to six photos.
- Rover-style report preview, with print styles for **Print / Save card as PDF**.
- CSV export for the visit summary.
- GPX export for timestamped GPS route points.
- Shareable text summary through the native share sheet where available.
- Sample report with a clearly labelled fictional route, so you can preview the design without granting location access.
- PWA manifest, minimal app-shell service worker, and GitHub Pages GitHub Actions deployment workflow.
- No backend or persistence of visit data.

## Important prototype limitations

1. **GPS and iPhone backgrounding:** The web Geolocation API requires HTTPS and user permission. iOS may suspend or throttle a web page when Safari is backgrounded or the phone locks. Keep the page in the foreground during a walk until the actual target iPhone has been tested. A timer can calculate elapsed time from timestamps after returning to the page, but GPS points cannot be recovered for a period when the browser did not record them.
2. **No saved visit history:** Refreshing, closing the tab, or starting a new visit can lose the current visit and photo references. Export a CSV/GPX and save/share the report before moving on. The current prototype exports one visit at a time; a master CSV import/merge workflow is a planned next step.
3. **PDF sharing:** The report preview has print CSS. On an iPhone, choose Print / Save card as PDF, then use the iOS print/share interface to save or share the card. Map tile rendering in printed output should be verified on the target iOS version. The Share text summary action shares the visit text, not the PDF.
4. **Map service:** Leaflet draws the route and OpenStreetMap provides the map tiles. Map tile requests go to OpenStreetMap servers and reveal which map areas are being viewed; visit records and full GPS tracks are not uploaded to a Pawprint backend. Follow the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/), including attribution and no bulk/offline tile downloading.
5. **Hosting:** GitHub Pages is included for prototype deployment. GitHub's published policy says Pages is not intended or permitted as free hosting for websites that run an online business or commercial SaaS. Check the [GitHub Pages usage limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) before using Pages for a live paid dog-walking business. The same static frontend can be deployed on Vercel for production.
6. **Photo memory:** Images are held through in-memory object URLs. They are not included in the CSV. Keep the original photo files on the phone if they are needed independently of the report.

## Requirements

- Node.js 20.19+ or 22.12+ (Node.js 22 LTS recommended)
- npm
- A modern browser; use HTTPS for GPS features

## Run locally

```bash
npm install
npm run dev
```

Vite prints a local development URL. GPS usually works on `localhost`, but the actual phone test should use the deployed HTTPS site. When testing on a phone, use the LAN URL only for interface testing; browsers may not permit location access on a non-secure LAN origin.

Type-check and build:

```bash
npm run typecheck
npm run build
npm run preview
```

The static build is written to `dist/`.

## Create the GitHub repository

1. Extract the ZIP.
2. Open a terminal in this folder.
3. Run `npm install` and `npm run build` to check that it builds.
4. Create a new, empty GitHub repository.
5. Initialize and push the source:

   ```bash
   git init
   git add .
   git commit -m "Initial Pawprint visit card prototype"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

6. In GitHub, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
7. Pushes to `main` trigger `.github/workflows/deploy.yml`. Open the **Actions** tab to monitor the build/deployment. GitHub will provide the published URL when the workflow completes.

The Vite `base: './'` setting is intentional so built assets can resolve from a repository subpath such as `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/` and also work at a root domain on Vercel. This is a single-page app without client-side URL routing, so it does not need a fallback rewrite.

## Deploy to Vercel later

1. Import the same Git repository into Vercel.
2. Select the Vite framework preset if it is not detected automatically.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. No environment variables are required.

The app is entirely static, so it does not require Vercel Functions or a database. The `base: './'` configuration should work on Vercel at the root path too.

## Install on iPhone

1. Open the deployed HTTPS address in Safari.
2. Tap the Share button.
3. Choose **Add to Home Screen**.
4. Launch Pawprint from the Home Screen icon and allow location access when prompted on the first walk.
5. Keep the app visible during a walk for the initial GPS prototype test. Do not assume a full GPS track will be recorded when the screen is locked.

The service worker caches the same-origin app shell as it is visited. It deliberately does not cache route records, photos, or external map tiles. Offline viewing of map tiles is not supported.

## How to use

1. Enter the dog's name and, optionally, the client name.
2. Choose **Walk** or **Drop-in**.
3. Tap **Start visit**. Walk visits request geolocation permission; drop-ins only run the timer.
4. During the visit, mark the care checklist, add notes, and optionally choose photos.
5. Tap **Finish visit & build card**.
6. Review the report. Use **Print / Save card as PDF** for the visual card, **Export visit CSV** for the summary, and **Export GPS route (GPX)** for the route coordinates.
7. Save exported files to the iPhone Files app or share them to the intended client. Avoid sharing a CSV or GPX unless the client needs the underlying data.

Use **Preview example card** to see a sample report without a live location. All sample client details and map points are fictional and labelled as sample data.

## Data schema

The exported CSV contains one visit per file. Fields include:

- ID, client and dog names
- service type and completion status
- start/end timestamps and elapsed duration
- route distance and number of route points
- care checklist flags
- notes and whether the visit is sample data

The GPX export holds timestamped latitude/longitude points and reported GPS accuracy. Photo binaries are not embedded in CSV or GPX exports.

## Suggested next steps

- Test GPS sampling and screen-lock behavior on the actual iPhone.
- Improve distance filtering, outlier rejection, and GPS state messaging.
- Add a master CSV import/merge/export flow (still client-side only).
- Add business name/logo/theme settings and editable checklist items.
- Build a downloadable PDF renderer if print-to-PDF is awkward on the target iOS version.
- Add optional recovery of an in-progress visit to IndexedDB only if the desired privacy/retention tradeoff is acceptable. It is intentionally omitted from this prototype.
- Consider a native iOS shell if reliable background GPS is required.

## Privacy checklist before production

- Do not commit client names, home addresses, access codes, route data, or photos to GitHub.
- The repository can be public because it should contain only the application source. Do not store secrets in client-side code.
- This app does not upload visit data, but map tile requests are external network requests. A third-party static host will receive ordinary web request metadata.
- Review hosting and map tile usage terms before using the app for a paid business.
