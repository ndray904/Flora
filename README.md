# Flora — Botanical Synthesizer

[Open the live synthesizer](https://flora-flower-synth.brown-candy-2159.chatgpt.site/)

A playable web synthesizer inspired by the eight-petal flower in your reference image. The artwork is drawn in SVG so its controls stay crisp at any screen size.

## Play

Open `dist/index.html` in a modern web browser, or run `node server.mjs` and visit `http://127.0.0.1:4317`.

- Drag the brass handles along the eight long petals to change tune, detune, cutoff, resonance, attack, release, motion, and space.
- Press the center to play a major chord. Turn on **Hold the bloom** to sustain it while shaping the sound.
- Play individual notes on the inner petals or with **A S D F G H J K**.
- Choose one of four sound palettes, change the waveform, or adjust the root note and octave.
- Tab to a slider and use arrow keys, Page Up/Down, Home, or End. Focus a note and press Enter or Space to play it.

Sound begins after a click or key press. The browser generates the audio locally. The interface uses Google Fonts when available and falls back to local fonts offline.

## Files

`dist/index.html`, `dist/style.css`, and `dist/synth.js` are the complete browser application. No installation or build step is required.

## Audio reliability

Released notes fade out and their oscillators stop, including when a touch is cancelled or the page loses focus. Waveform changes crossfade, preset values move together smoothly, and the output includes a soft ceiling to prevent hard clipping.

`node tests/audio-regression.cjs` checks actual audio silence and oscillator cleanup, keyboard/mouse/touch release, rapid sound changes, and rendered envelope and waveform transitions. The checks require Playwright and Microsoft Edge; `PLAYWRIGHT_PACKAGE` can point to an existing Playwright installation and `FLORA_TEST_URL` can target a published copy.
