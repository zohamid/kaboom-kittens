# Kaboom Kittens 🐱💥

Made by **Zoha** — a fan who wanted all the kaboom with none of the cards. A free web card game of cats, luck & betrayal for 2–5 players. Original art, names, and code — inspired by kitty-explosion card games. Play vs bots, pass-and-play on one device, or online with room codes.

## Deploy on GitHub Pages (about 3 minutes)

1. Create a new repository on GitHub (e.g. `kaboom-kittens`). Public repos get free Pages hosting.
2. Upload **both files in this folder** (`index.html` and this `README.md`) to the repository — on the repo page: *Add file → Upload files*.
3. Go to **Settings → Pages**. Under *Build and deployment*, set **Source** to *Deploy from a branch*, pick branch **main** and folder **/ (root)**, then save.
4. Wait a minute, then your game is live at:
   `https://<your-username>.github.io/kaboom-kittens/`

Send that link to your friends — that's it. Updating the game later = uploading a new `index.html`.

## Enabling online multiplayer

Bots and Pass & Play work with zero setup. For online rooms, the game syncs through a free Firebase Realtime Database:

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → *Create a project* (any name, Analytics off is fine).
2. In the project: **Build → Realtime Database → Create database** → start in **test mode**.
3. Copy the database URL shown at the top of the data tab (looks like `https://something-default-rtdb.firebaseio.com`).
4. In the game, tap **Play Online** and paste the URL (it's remembered after the first time). Everyone must use the same URL — or bake it into `index.html` so nobody has to paste anything.

**Note:** test mode rules expire after 30 days. To keep playing, open *Realtime Database → Rules* and set:

```json
{
  "rules": {
    "kaboom": { ".read": true, ".write": true }
  }
}
```

This keeps the game's `/kaboom` area open while the rest of your database stays locked.

## How to play

The full illustrated rules are on the game's **How to Play** screen. Short version: draw cards and don't explode — the last kitten standing wins.

---

© 2026 Zoha. Original art, names & code. Free for friends-and-family play — all the kaboom, none of the cards. 🐾
