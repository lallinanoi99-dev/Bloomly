# Bloomly 🌸

A gentle, private health tracker for women. It covers period, water, pregnancy and healthy habits in one place.
Your health data never leaves your device. Only an anonymous daily self-care check-in goes on **BOT Chain** to keep your streak.

- **Live site:** _add your GitHub Pages / custom domain URL here_
- **Contract (BOT Chain mainnet, chain ID 677):** [`0xAc21f4429EAD840D89525F6bd0f7047Fa8c73Af6`](https://scan.botchain.ai/address/0xAc21f4429EAD840D89525F6bd0f7047Fa8c73Af6)

> Bloomly gives estimates for information only. It is not medical advice and must not be used as birth control. Talk to a doctor or midwife about any health concern.

---

## What's inside

| Path | What it is |
| --- | --- |
| `index.html` | The landing page (7 sections + footer) and the app container |
| `css/styles.css` | All styles. Mobile first, with wider layouts from 600 / 900 / 1000 px |
| `js/config.js` | **Edit this:** network settings and the contract address |
| `js/core.js` | Dates, storage, cycle and pregnancy maths, cycle ring |
| `js/chain.js` | MetaMask connection and the 3 contract calls (`checkIn`, `getStreak`, `stats`) |
| `js/app.js` | The tracker: setup, Today / Calendar / Insights / Me, backups |
| `js/site.js` | Landing page: menus, stage tabs, phone mockups, live stats |
| `data/weeks.json` | Week-by-week pregnancy notes (weeks 4–40) |
| `contracts/BloomlyStreak.sol` | The streak contract |
| `manifest.webmanifest`, `assets/` | App icon and install-to-home-screen support |

No build step, no framework, no server. ethers.js v6 is loaded from cdnjs.

## Features (PRD checklist)

- **MetaMask wallet connect.** A short address is shown, and Bloomly switches to BOT Chain (or adds it) automatically.
- **Core flow.** Log today → **Check in on BOT Chain** → the streak and badges (7 / 30 / 100 days) are read back from the contract.
- **Four trackers:**
  - **Period & cycle.** Cycle ring, predictions, late-period card, symptoms, mood, discharge, sleep and notes.
  - **Water.** A glass that fills, a custom glass size and goal, a goal streak, and a gentle reminder while the app is open.
  - **Pregnancy.** Week and day, trimester, due-date countdown, fruit size, 3 notes a week, a kick counter with timer (3rd trimester) and appointments.
  - **Habits.** 6 defaults plus up to 3 of your own, and weekly completion.
- **Calendar.** Shows logged periods (filled rose), predicted periods (dotted), the fertile window (teal), ovulation (✿) and pregnancy week bars. Tap a past day to see or edit it.
- **Insights.** Average cycle and period length, the last 6 cycles as bars, most common symptoms, water this week, habit completion and streak badges.
- **Privacy.** Data stays in the browser and is never sent to a server or the chain (see below). No passcode or account.
- **States handled.**
  - No MetaMask, wrong network, or not connected.
  - Already checked in today, or a broken streak ("New streak, fresh start 🌱").
  - Fewer than 2 cycles logged, irregular cycles, or a late period. Pregnancy past week 42.
  - Private mode where storage isn't available.
  - Wrong backup file. Transaction rejected, failed, or short on gas.

## Privacy model

- Health data **never** goes on-chain: no dates, symptoms, pregnancy details, or hashes of them.
- The contract only stores, per wallet, `current`, `best`, `total` and `lastDay` (the UTC day number).
- Logs live only in this browser's `localStorage` (wrapped in try/catch). They are never sent to a server.
- There is **no passcode**, so the data is **not encrypted**. Anyone who can use the same browser can open the app, so rely on the device's own lock screen.
- **Export** downloads a `.bloomly` backup file (plain JSON), so keep it somewhere private. **Import** asks before replacing anything. **Delete all my data** wipes everything after a confirm step.
- There are no analytics, cookies, tracking scripts, accounts or server.

## Deploy the contract (Remix)

1. Open [remix.ethereum.org](https://remix.ethereum.org) and paste in `contracts/BloomlyStreak.sol`.
2. Compile with **Solidity 0.8.20+** (tested with 0.8.24, optimizer 200 runs).
3. **Testnet first.** In MetaMask, add BOT Chain Testnet:
   - Chain ID: `968`
   - RPC: `https://rpc.bohr.life`
   - Explorer: `https://scan.bohr.life`

   In Remix, choose *Injected Provider – MetaMask* and deploy.
4. Put the address in `js/config.js` → `networks.testnet.contract`, then open the site with `?net=testnet` and try a check-in.
5. **Mainnet.** Switch MetaMask to BOT Chain:
   - Chain ID: `677`
   - RPC: `https://rpc.botchain.ai`
   - Explorer: `https://scan.botchain.ai`

   Deploy again, then put the address in `networks.mainnet.contract`.
6. Verify the contract on scan.botchain.ai, then add the address to the top of this README.

## Host on GitHub Pages + custom domain

1. Push this folder to a GitHub repo. In **Settings → Pages**, deploy from the `main` branch, root folder.
2. For a custom domain, add a `CNAME` file containing your domain (for example `bloomly.yourdomain.com`), point a DNS `CNAME` record to `<user>.github.io`, then tick **Enforce HTTPS**.
3. Set `repoUrl` in `js/config.js` so the footer links to your source.

Web Crypto needs HTTPS (or `localhost`), which GitHub Pages provides.

## Run locally

```bash
python3 -m http.server 8787
```

Then open http://localhost:8787. Add `#app` to the URL to jump straight into the tracker.

## How predictions work

- **Cycle length.** The average of your last (up to) 6 logged cycles. Until you've logged 2, it uses your usual length (default 28).
- **Next period.** Your last period start plus the cycle length.
- **Ovulation.** About 14 days before the next period.
- **Fertile window.** 5 days before ovulation to 1 day after.
- **"Less certain" note.** Shown if your cycles vary by more than 7 days.
- **Late card.** Shown when today is more than 5 days after the predicted start.
- **Pregnancy week.** `floor((today − LMP) / 7)`, where LMP = due date − 280 days. Trimesters: weeks 1–13, 14–27, 28+.

## Sources for the pregnancy notes

`data/weeks.json` was written in plain, calm language from public guidance:

- NHS — *Your pregnancy week by week*: https://www.nhs.uk/pregnancy/week-by-week/
- NHS — *Your baby's movements*: https://www.nhs.uk/pregnancy/keeping-well/your-babys-movements/
- ACOG — *How Your Fetus Grows During Pregnancy*: https://www.acog.org/womens-health/faqs/how-your-fetus-grows-during-pregnancy
- Mayo Clinic — *Fetal development*: https://www.mayoclinic.org/healthy-lifestyle/pregnancy-week-by-week/

Sizes are approximate: crown to rump up to week 19, head to heel from week 20. For warning signs, the app says to contact your doctor or midwife rather than giving medical instructions.

## Credits

The illustrations and logo are original to Bloomly. The layout takes inspiration from tines.com, but no Tines or Flo branding or art is used. The BOT Chain logo is linked from botchain.ai.
