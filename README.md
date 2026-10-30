# Dino Runner

A responsive endless jumping game built with HTML, CSS and vanilla JavaScript for Section 4, MAIN Assignment II, of `JS Assignments - part 2.pdf`.

## Play locally

Open `index.html` in a modern browser. No build, installation or backend is needed. The same files can be hosted on GitHub Pages; deployment has not been performed. An optional Google Font has local font fallbacks.

## Controls and features

- Start Game, Space or Arrow Up begins a run; press again to jump.
- Hold Space / Arrow Up for a full jump; release early for a shorter jump.
- Arrow Down ducks on the ground or accelerates falling in the air.
- P pauses/resumes. Losing focus or hiding the tab pauses automatically.
- Pause freezes physics and the current pose. Releases during pause are ignored; resume clears duck input and continues an interrupted jump without applying an old release. Only the key or pointer that initiated a new jump can shorten it.
- Tap/click the playfield to jump; use Resume or Play Again when shown.
- Sound button toggles generated sound effects.
- One point is awarded per cactus passed. The current score freezes on collision; Game Over announces the final score. Restart resets the run. Best score is saved locally when storage is available.
- Random cactus sizes, flowers, dust, animated legs and day/sunset/night scenery provide visual variety. Speed rises by 0.5 every five points, from 5 to a maximum of 11 pixels per nominal frame.

## Architecture

`index.html` contains semantic controls, instructions, score and live status. `style.css` owns presentation and the original CSS dinosaur. `script.js` draws the scenery and obstacles on Canvas and positions the dinosaur in the same 800 × 300 logical coordinate system. This preserves the original hybrid rendering approach and allows future CSS design contributions without replacing gameplay.

One requestAnimationFrame chain renders in sync with the browser. Elapsed time is clamped to 50 ms and accumulated into fixed 120 Hz simulation steps. Physics values use nominal 60 Hz frame units: jump velocity starts at -13, gravity adds 0.7 per nominal frame, and positive Y points down. Ground contact clamps position and velocity exactly. Only grounded players can jump; repeated keydown events cannot trigger jumps.

Cacti spawn beyond the right edge, move left together and are removed offscreen. After the initial 400-pixel spawn delay, gaps correspond to about 65–90 nominal frames at current speed, leaving time to land between full jumps. Single cacti replace the original bird/cluster combinations to simplify fairness and keep jumping central. Cactus arms and the dinosaur's decorative extremities are outside the forgiving central rectangular hitboxes.

AABB collision compares left/right and top/bottom bounds. The player's box has a four-pixel inset. Collision changes `playing` to `gameover` once, stops scheduling frames and announces the score. States are `ready`, `playing`, `paused` and `gameover`. Restart cancels the outstanding frame and resets player, score, obstacles, difficulty, timers, scenery and accumulator. Event listeners are registered only once.

## Verification

Requires Node.js only for development checks:

```sh
node --check script.js
node --test tests/game.test.cjs
git diff --check
```

Twenty-four automated tests exercise the production script in a mocked browser environment, including input-source releases, frozen pause state, duck alignment, listener counts, best-score announcements, multiple jump-trajectory samples and generated maximum-size/minimum-gap obstacle sequences. A negative control confirms the sequence test rejects artificially shortened gaps. These are logic tests; they do not validate real Canvas rendering, browser audio, touch behavior or CSS layout. Manual browser verification remains required; see `IMPLEMENTATION_REPORT.md`.

## Limitations and credits

Modern Canvas 2D (`roundRect`), Pointer Events and ResizeObserver support is expected. Browser sound and storage can be unavailable; gameplay continues. Keyboard is needed for ducking; touch supports jumping and interface buttons. Live status exposes game state, but this visually timed game does not provide a complete nonvisual gameplay mode.

Buhle created the original repository and initial implementation. This revision preserves its layout, CSS character, scenery, generated audio, score effects and overall visual direction while correcting gameplay and integration. Elion may contribute future visual design; no unverified contribution is attributed here. No external game sprites or JavaScript libraries are used.
