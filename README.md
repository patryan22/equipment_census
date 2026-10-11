# Equipment Census

A phone-first app for cataloging the equipment you see at customers across your territory. Log each machine under its customer, then search, filter and analyze the fleet to find sales opportunities.

It's a Progressive Web App: no App Store, no server. You open it in Safari and add it to your Home Screen.

## Features (v1: manual entry)

- **Add equipment**: customer, brand, model, year, hours, type, serial, condition, county, sales status, follow-up date, notes. Brand/type are tap-to-pick lists with an "Other…" option. "Save & add another" keeps the same customer for the next machine in the yard.
- **Customers**: typed once, auto-created, auto-suggested next time; each shows its fleet and whether it has any Bobcat.
- **Fleet search**: free-text search plus filters for brand, type, county, Bobcat vs competitor, sales status, age and customer.
- **Opportunities**: a competitor machine is flagged when it is N+ years old (default 7, adjustable in Settings) or is in your pipeline (Lead / Contacted / Quoted).
- **Insights**: Bobcat share, brand / type / county / age breakdowns, largest fleets, follow-ups. Tap any bar to jump to the matching machines.
- **CSV import/export** and **JSON backup/restore**.

Coming later: photo capture, AI identification, GPS and a map.

## Put it on your iPhone

Home Screen install needs **HTTPS**. The easiest free option is GitHub Pages:

1. In this GitHub repo: **Settings → Pages → Build and deployment → Deploy from a branch**, choose the branch (e.g. `main`) and folder `/ (root)`.
2. Wait a minute, then open `https://<your-username>.github.io/equipment_census/` in **Safari** on your iPhone.
3. Tap **Share → Add to Home Screen**. Open it from the new icon.

> Any static host works (Netlify, Cloudflare Pages, etc.). To try it on a computer: `python3 -m http.server` then open `http://localhost:8000`.

## Important: your data lives on the phone

There is no server. Everything is stored in the browser's database on your iPhone. Deleting the app, clearing Safari website data, or losing the phone loses the data. So:

- Use **Settings → Back up everything** regularly and save the file to iCloud Drive (the share sheet offers "Save to Files"). The app warns you when your last backup is over 2 weeks old.
- To move to a new phone, install the app there and use **Restore from backup**.
- Use the Home Screen icon rather than a Safari tab; it gets more durable storage.


## CSV format

Equipment: `customer, category, brand, model, year, serial, hours, condition, status, follow_up, county, notes`
Customers: `name, contact, phone, address, county, notes`

Missing customers in an equipment file are created automatically. Importing a customers file skips names that already exist.

## Project layout

```
index.html, manifest.webmanifest, sw.js   app shell, install metadata, offline cache
css/app.css                               mobile-first styles (light + dark)
js/app.js                                 hash router + tab bar
js/db.js                                  IndexedDB wrapper
js/insights.js                            opportunity / age / stats logic
js/csv.js, js/backup.js                   import/export
js/views/*                                one file per screen
```

No build step and no dependencies.
