# Equipment Census

A phone-first app for cataloging the equipment you see at customers across your territory. Snap a photo, AI suggests brand / model / type / year, you confirm, and it's filed under the customer. Then search, filter, map and analyze the fleet to find sales opportunities.

It's a Progressive Web App: no App Store, no server. You open it in Safari and add it to your Home Screen.

## Features

- **Add equipment**: take or choose photos, tap save. Claude reads decals and serial plates and pre-fills brand, model, type, year, serial, hours and condition. You always confirm before saving. Works fully manually with no API key.
- **Customers**: typed once, auto-created, auto-suggested next time. "Save & add another" keeps the same customer for the next machine in the yard.
- **Fleet search**: free-text search plus filters for brand, type, county, Bobcat vs competitor, sales status, age and customer.
- **Opportunities**: a competitor machine is flagged when it is N+ years old (default 7, adjustable) or is in your pipeline (Lead / Contacted / Quoted). Customers with no Bobcat are called out.
- **GPS + map**: each machine is tagged with where you saw it; the map shows Bobcat (orange) vs competitor (blue), with opportunities outlined in red.
- **Insights**: Bobcat share, brand / type / county / age breakdowns, largest fleets, follow-ups. Tap any bar to jump to the matching machines.
- **CSV import/export** and **full JSON backup with photos**.

## Put it on your iPhone

Camera, GPS and Home Screen install need **HTTPS**. The easiest free option is GitHub Pages:

1. In this GitHub repo: **Settings → Pages → Build and deployment → Deploy from a branch**, choose the branch (e.g. `main`) and folder `/ (root)`.
2. Wait a minute, then open `https://<your-username>.github.io/equipment_census/` in **Safari** on your iPhone.
3. Tap **Share → Add to Home Screen**. Open it from the new icon.
4. **Settings (gear) → AI identification**: paste your Anthropic API key (from console.anthropic.com), tap **Test key**.
5. Allow Location when asked the first time you take a photo.

> Any static host works (Netlify, Cloudflare Pages, etc.). To try it on a computer: `python3 -m http.server` then open `http://localhost:8000`.

## Important: your data lives on the phone

There is no server. Everything is stored in the browser's database on your iPhone. Deleting the app, clearing Safari website data, or losing the phone loses the data. So:

- Use **Settings → Back up everything** regularly and save the file to iCloud Drive (the share sheet offers "Save to Files"). The app warns you when your last backup is over 2 weeks old.
- To move to a new phone, install the app there and use **Restore from backup**.
- Use the Home Screen icon rather than a Safari tab; it gets more durable storage.

Your API key is also stored only on the phone and is sent only to api.anthropic.com. Because it lives in the browser, treat that key as personal: set a spend limit on it in the Anthropic console.

## CSV format

Equipment: `customer, category, brand, model, year, serial, hours, condition, status, follow_up, county, lat, lng, notes`
Customers: `name, contact, phone, address, county, notes`

Missing customers in an equipment file are created automatically. Importing a customers file skips names that already exist.

## Project layout

```
index.html, manifest.webmanifest, sw.js   app shell, install metadata, offline cache
css/app.css                               mobile-first styles (light + dark)
js/app.js                                 hash router + tab bar
js/db.js                                  IndexedDB wrapper
js/ai.js                                  Claude vision call + response parsing
js/insights.js                            opportunity / age / stats logic
js/csv.js, js/backup.js                   import/export
js/views/*                                one file per screen
```

No build step and no dependencies, apart from Leaflet (loaded from unpkg when you open the Map tab) and OpenStreetMap tiles.
