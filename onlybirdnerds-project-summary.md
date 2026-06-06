# Only Bird Nerds — Project Summary
_Transfer this to Claude Code for context_

---

## What this project is

A community birding platform at **onlybirdnerds.com** where users can:
- Upload bird observation data (CSV, eBird links, or direct photo uploads)
- Generate interactive maps of their sightings
- Earn badges and complete quests (e.g. "Robin in every Oregon county")
- Share their observations and photos with others

Tone: mix of casual/fun ("Pokémon-meets-field-science") and scientifically credible. Primary audience is casual backyard birders.

---

## Current state

### Website (landing page)
- File: `index.html`
- Hosted: not yet live — going to Netlify, domain is `onlybirdnerds.com` (registered on Namecheap)
- GitHub repo created: "only bird nerds" repository (need to push index.html there)
- Netlify will auto-deploy when GitHub repo is updated

### Map (the main tool)
- Running locally at `http://localhost:5000`
- Built in Claude Code — Python-based, uses Folium/Leaflet.js
- Currently shows Michael's own bird observation data
- Eventually: users will upload their own data and the server will run the Python script for them
- The landing page iframe and "View live map" button both point to `http://localhost:5000` — **update these URLs when the server is deployed publicly**

---

## Landing page structure (`index.html`)

Sections in order:
1. **Nav** — logo, links to Observations / Live Map / Quests, "Get early access" CTA
2. **Hero** — split layout, bird photo right side, three tagline rows with icons left side:
   - 🔭 Catch them. (binoculars icon, green)
   - 📍 Map them. (map pin icon, amber)
   - 👤 Share your journey. (person/share icon, coral)
3. **Recent observations** — 4 card grid with real Unsplash bird photos, species name, location, rarity badge, eBird link
4. **Live map** — iframe embedding `http://localhost:5000`, "Open full map" link
5. **Quests/Features** — 3 feature cards (Map sightings / Share photos / Complete quests) with live/coming soon/planned status
6. **Email signup** — collect emails for early access (currently client-side only, needs Formspree wired up)
7. **Footer**

### Design system
- Fonts: Syne (headings, 800 weight), Lora (body, serif), DM Mono (labels/mono)
- Colors: forest green `#1b3a2d`, fern `#4a7c59`, sage `#7aab88`, amber `#c97d22`, coral `#d4622a`, cream `#f7f3ec`
- Style: nature-meets-nerd, field journal aesthetic, rounded pill buttons, card-based layout

---

## Things still to do

### Immediate
- [ ] Push `index.html` to GitHub repo so Netlify auto-deploys
- [ ] Connect Namecheap domain to Netlify (change nameservers to Netlify's)
- [ ] Wire up email form to Formspree (free, takes 2 min — add `action="https://formspree.io/f/YOUR_ID"` and `method="POST"` to the form tag)

### Map server
- [ ] Deploy the Python/Flask map server to a public host (Render.com or Railway.app recommended — free tier, GitHub-connected)
- [ ] Update `index.html` iframe `src` and map link `href` from `http://localhost:5000` to the live server URL
- [ ] Configure CORS on Flask app so the iframe can embed from a different domain

### Future features
- [ ] User photo uploads (file drop or URL paste)
- [ ] eBird direct link integration
- [ ] User accounts / data storage
- [ ] Quest/badge system
- [ ] Multi-user data upload (run Python script server-side for other people's data)

---

## GitHub setup (to do in Claude Code)

```bash
# In the project directory:
git init
git remote add origin https://github.com/YOUR_USERNAME/only-bird-nerds.git
git add index.html
git commit -m "initial landing page"
git push origin main
```

Then in Netlify: Site settings → Domain management → connect `onlybirdnerds.com`
Then in Namecheap: Nameservers → Custom DNS → paste Netlify's nameservers

---

## Key decisions made
- Netlify for static site hosting (free tier, drag-and-drop or GitHub-connected)
- Namecheap for domain ($11.48/yr)
- Render.com or Railway.app for Python map server (when ready to deploy)
- Formspree for email collection (no backend needed)
- eBird links used on observation cards (external links to species pages)
- Observation cards show rarity badges: Common / Uncommon / Rare
