# Flora — Botanical Synthesizer

[Open the live synthesizer](https://flora-flower-synth.brown-candy-2159.chatgpt.site/)

A playable web synthesizer inspired by the eight-petal flower in your reference image. The artwork is drawn in SVG so its controls stay crisp at any screen size.

## Play

Open `index.html` in a modern web browser, or run `node server.mjs` and visit `http://127.0.0.1:4317`.

- Drag the brass handles along the eight long petals to change tune, detune, cutoff, resonance, attack, release, motion, and space.
- Press the center to play a major chord. Turn on **Hold the bloom** to sustain it while shaping the sound.
- Play individual notes on the inner petals or with **A S D F G H J K**.
- Choose one of four sound palettes, change the waveform, or adjust the root note and octave.
- Tab to a slider and use arrow keys, Page Up/Down, Home, or End. Focus a note and press Enter or Space to play it.

Sound begins after a click or key press. The browser generates the audio locally. The interface uses Google Fonts when available and falls back to local fonts offline.

## Host online

Upload the root `index.html` to your static web host's public folder. This single file includes the styles, flower artwork, and sound code. No separate assets, installation, build step, or server application are required. Optional Google Fonts fall back to local fonts when unavailable.

## Files

- `index.html`: ready-to-host single-file site.
- `dist/index.html`, `dist/style.css`, and `dist/synth.js`: the editable, separate source files.
- `scripts/export-html.mjs`: regenerates the root HTML file from `dist/`.

After editing the files in `dist/`, run `npm run export` to update the standalone site before uploading it.

## Audio reliability

Released notes fade out and their oscillators stop, including when a touch is cancelled or the page loses focus. Waveform changes crossfade, preset values move together smoothly, and the output includes a soft ceiling to prevent hard clipping.

`node tests/audio-regression.cjs` checks actual audio silence and oscillator cleanup, keyboard/mouse/touch release, rapid sound changes, and rendered envelope and waveform transitions. The checks require Playwright and Microsoft Edge; `PLAYWRIGHT_PACKAGE` can point to an existing Playwright installation and `FLORA_TEST_URL` can target a published copy.
