# Travel Journal — Demo Guide

A feature that lets trip participants write journal entries and hear each other's voices inside the shared 3D world.

---

## The Idea

Everyone on a trip experiences it differently. This feature lets each person write their own journal — and when friends load the same VR world, they walk up to glowing orbs and hear that person's voice reading what they felt in that exact spot.

---

## What You Need Running

Two terminals before the demo:

**Terminal 1 — Backend**
```bash
cd backend
npm install       # first time only
npm run dev
# Running at http://localhost:3001
```

**Terminal 2 — Frontend**
```bash
cd citywalk
npm install       # first time only
npm run dev
# Running at https://localhost:5173
```

---

## Demo Flow (step by step)

### Step 1 — Someone writes a journal entry

Open the journal form in any browser (phone works great for the demo):

```
http://localhost:3001/journal-app/journal.html?cityId=tokyo-demo
```

Fill in:
- **Your name** — e.g. `Sai`
- **Voice** — choose one, or leave on Auto
- **Journal entry** — write what you experienced

Hit **Add to the world**. The backend calls Smallest.ai, generates an MP3 of their voice, and saves it.

---

### Step 2 — A second person adds their entry

Have another person (or demo a second author yourself) open the same URL and add their entry. Each person gets a different voice automatically based on their name.

---

### Step 3 — Share the world link

The form shows a shareable VR link at the top:

```
https://localhost:5173/?cityId=tokyo-demo
```

Send this to whoever has the PICO headset (or open it on desktop).

---

### Step 4 — Walk through the world and hear the voices

Load the VR link. The world loads with **glowing colored orbs** floating where each person left their journal entry.

- Walk toward an orb
- Within **2 metres** — the person's voice plays automatically in 3D space
- The audio is positional: it sounds like it's coming from where they stood
- Each person has a consistent voice (same name = same voice every time)

---

## Available Voices (lightning-v3.1)

| Voice | Character |
|-------|-----------|
| `lucas` | Male, clear |
| `alex` | Male, neutral |
| `jordan` | Neutral |
| `jessica` | Female, warm |
| `sophia` | Female, expressive |
| `kavya` | Female, South Asian accent |
| `kiran` | Neutral, South Asian accent |

Voice is auto-assigned per author name — you can also pick manually from the dropdown.

---

## What the Demo Shows

```
Sarah writes on her phone
    → form at localhost:3001/journal-app/journal.html?cityId=tokyo-demo
    → "sophia" voice generated as MP3

Sai writes on his phone
    → same URL
    → "lucas" voice generated as MP3

Mike puts on the PICO headset
    → loads https://localhost:5173/?cityId=tokyo-demo
    → walks through the city
    → approaches Sarah's orb → hears Sarah's voice in 3D space
    → approaches Sai's orb   → hears Sai's voice from that spot
```

---

## API Quick Reference

| Action | Request |
|--------|---------|
| Add entry | `POST http://localhost:3001/journal/:cityId` with `{ text, author, voice_id? }` |
| List entries | `GET http://localhost:3001/journal/:cityId` |
| Delete entry | `DELETE http://localhost:3001/journal/:cityId/:entryId` |

Files saved to: `backend/output/<cityId>/journals/`

---

## Troubleshooting

**No orbs appear in VR**
- Check the URL has `?cityId=tokyo-demo` (must match what was used in the form)
- Check backend is running on port 3001

**"TTS failed" error**
- Check `SMALLEST_API_KEY` is set in `backend/.env`
- Confirm `USE_MOCK=false` in `.env`

**Audio doesn't play in VR**
- Web Audio requires a user gesture first — the VR button click counts
- On desktop, click anywhere on the scene first

**Text too long error**
- The API auto-chunks at sentence boundaries, max 240 chars per chunk — this should be handled automatically
