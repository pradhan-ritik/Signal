# Signal: status

Last verified 2026-10-10, on the `signal` branch of `pradhan-ritik/hyphen-hacks-2026`.

## Run it

You need Node 20.19 or newer (tested on Node 26) and an internet connection for the fonts.

```bash
git clone https://github.com/pradhan-ritik/hyphen-hacks-2026.git
cd hyphen-hacks-2026
git checkout signal
cd frontend
npm install
npm run dev
```

Open the URL that `npm run dev` prints. It is `http://localhost:5173` unless that port is already in use, in which case Vite picks the next free one (5174, 5175, ...) and prints it.

To run the tests: `npm test` (45 tests, all passing). To check a production build: `npm run build`.

The app is frontend only. Nothing in `backend/` is used, and nothing needs to be started there.

## What works

- **Describe your situation** in one text box, or click one of three examples to fill it.
- **Safety check first.** Active-emergency language ("trapped", "can't breathe", "on fire", "smell gas", and so on) replaces everything with a "Call 911" block. No plan, no constellation. Self-harm language also shows the 988 line. Negated phrases such as "nobody is hurt" do not trigger it.
- **A plan of steps.** Every confirmed situation contributes its steps, strongest first, with repeats removed. Seven situations are known: dependents, replacement documents, pets, elderly or mobility-limited, financial hardship, temporary housing, and transportation.
- **Two-fact rule.** A situation is only confirmed when two separate details point to it. With one, the app says which situation it points to and asks for another detail.
- **The constellation.** Each step is a star, joined in order by lines. The first step is the largest. The same plan always draws the same shape. Click a star or use the arrow keys to move between steps.
- **Step detail.** The selected step shows why it matters, a checklist of ways to get it done, websites to open, and a tip. Ticking every item, or "Mark done", turns the star hollow.
- **Add a detail.** The box pinned at the bottom adds to the situation and redraws the plan.
- **Why these steps.** Each matching detail is listed with the exact word underlined and the sign it triggered, plus any details that matched nothing.
- **Past situations** in the left rail, with their checklists, kept in the browser on this device.
- **List view,** which is also the printable page ("Print or save" gives one clean white page).
- **911 line** pinned to the top at all times.
- **Layouts** at 375, 768 and 1280 pixels wide, with no console errors, no sideways scrolling and 44-pixel tap targets.

## A demo script that works

1. Click the first example, then "Map my steps". Result: "Evacuee with dependents", four stars.
2. Click the third star, then press the left arrow key. The detail panel follows.
3. Click "Mark done". The star turns hollow and the count reads "1 done".
4. In the box at the bottom, type `I have no cash and I lost my job`, then "Add detail". The plan grows to nine stars across two situations.
5. Open "List", then "Print or save".
6. Click "New situation" and enter `my son is trapped under debris` to show the emergency block.
7. Click "New situation" and enter only `I have no cash` to show the two-fact rule.

## Known limitations

- **Matching is keyword-based and does not understand "no".** "I have no pets" still counts as a possible pet sign. (The safety check does handle negation.)
- **The safety check is deliberately cautious.** An idiom such as "a stroke of luck" triggers the 911 block. A false alarm costs one click; a miss could be serious.
- **Text is split into facts at line breaks, sentence ends, commas and the word "and".** Two details in one clause count as one fact.
- **Steps are linked in order only.** There are no branching dependencies, and the constellation cannot be panned or zoomed.
- **The follow-up box adds details; it does not answer questions.** There is no AI model behind the app.
- **Saved situations live in this browser only.** There is no account and no way to delete one from the rail yet; clearing site data removes them.
- **Fonts load from Google Fonts.** Offline, the app still works but falls back to system fonts.
- **Resource details are general guidance.** Phone numbers and program names were written from general knowledge and were not checked against official sources; programs vary by state and by disaster.
- **`ConstellationView.tsx` and `PITCH.md` describe the earlier design,** where the stars were the facts. The file is no longer used by the app.
