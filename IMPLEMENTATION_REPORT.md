# Dino Runner implementation report

## A. Initial repository assessment

Started on `feature/dino-runner` at `6bcfc4e` (Buhle's initial implementation). No tracked files had uncommitted changes. The assignment PDF was already untracked. Section 4 was extracted and read before code planning or edits.

The existing project already contained a Canvas scene, original CSS dinosaur, keyboard/touch controls, jumping, ducking, cacti/birds, score, local best, generated sound, pause and restart. Source inspection found useful implementations throughout; this was not a blank project. Initial functionality was identified from source, not claimed as browser-tested.

Corrections targeted duck-to-stand ground positioning, frame-dependent physics, pause/repeat input, state clarity, responsive border alignment and obstacle spacing. Preserved the page structure, styles, character, cactus artwork, scenery, sounds and most focused drawing/update functions. Removed birds and clusters in favor of simpler randomized single-cactus encounters with recovery gaps. Converted JavaScript to two-space indentation. No full rewrite or unrelated redesign was needed.

## B. Files modified

- Modified `index.html`: Dino Runner title, descriptive Canvas fallback, linked instructions and live game status.
- Modified `script.js`: explicit states, fixed-step simulation, grounded ducking correction, fairer spawns, responsive alignment, input/pause handling and best-score validation.
- Modified `style.css`: compact mobile overlay/score layout, visible status spacing and touch handling.
- Created `README.md`: running instructions, controls, architecture, credits and limitations.
- Created `tests/game.test.cjs`: dependency-free regression checks against the production script.
- Created this report: assignment compliance, review and presentation preparation.
- Removed no files. The PDF remains unchanged and untracked.

## C. Section 4 compliance checklist

The authoritative requirements are Section 4, MAIN Assignment II, of `JS Assignments - part 2.pdf` (pages 2–3). Mandatory requirements and optional steps are distinguished below. “Implemented” records code completion and logic verification where applicable; real-browser acceptance checks are still pending.

| PDF reference        | Requirement                                                  | Status and evidence                                                                                                                            |
| -------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.A                  | Basic Chrome-like jumping game using HTML, CSS and JS        | Implemented with original CSS/Canvas artwork and vanilla browser APIs.                                                                         |
| 4.A.a.i              | Basic HTML game structure                                    | Implemented in `index.html`, including main heading, instructions and controls.                                                                |
| 4.A.a.ii             | Canvas and necessary components                              | Actual Canvas plus CSS character, score, status and overlay.                                                                                   |
| 4.A.b.i              | Visually appealing CSS styling                               | Existing colorful design preserved; mobile overlay improved. Visual acceptance pending.                                                        |
| 4.A.b.ii             | Style canvas, character and obstacles; respect CSS hierarchy | Shared styles and component selectors preserved; character styled in CSS and obstacles drawn with Canvas methods.                              |
| 4.A.c.i              | JavaScript behavior and interaction                          | Production script handles keyboard/pointer input, states and animation.                                                                        |
| 4.A.c.ii             | Movement, obstacle generation and collision functions        | `jump`, `updatePlayer`, `createObstacle`, `updateObstacles`, `checkCollision`, `detectCollision`. Automated checks pass.                       |
| 4.A.d.i              | Keyboard-controlled movement                                 | Space and Arrow Up jump; repeat and airborne jumps rejected. Automated checks pass.                                                            |
| 4.A.d.ii             | Gravity                                                      | Positive acceleration slows ascent and returns player to exact ground level. Automated checks pass.                                            |
| 4.A.e.i              | Obstacles generated at regular intervals                     | Repeated bounded gaps, approximately 1.08–1.5 seconds at current speed after initial delay. Random variation follows optional 4.A.g.iv.        |
| 4.A.e.ii             | Obstacles approach at a consistent pace                      | Every obstacle uses the same current speed and fixed timestep. Optional progression changes speed only at five-point milestones and is capped. |
| 4.A.f.i              | Collision determines game end                                | Forgiving central AABB hitboxes; simulation stops on overlap. Automated checks pass.                                                           |
| 4.A.f.ii             | End game and display final score                             | Explicit Game Over, final-score overlay and live status, with frozen score. Automated checks pass.                                             |
| 4.A.g.i — optional   | Score for successfully cleared obstacles                     | Included: one point per passed cactus, guarded by `passed`.                                                                                    |
| 4.A.g.ii — optional  | Display/update running score                                 | Included in HTML score badge.                                                                                                                  |
| 4.A.g.iii — optional | Sound/music/visual effects                                   | Generated sound, mute, dust and changing scenery included; background music omitted.                                                           |
| 4.A.g.iv — optional  | Randomized heights/positions                                 | Included random cactus heights, widths and horizontal gaps; grounded positions keep encounters jumpable.                                       |

No prompt/PDF conflict required overriding the vision. Although scoring is under optional extras, the final-score display in 4.A.f.ii is mandatory; this implementation supplies both. Canvas is present as requested by 4.A.a.ii. Difficulty progression and randomized gaps are optional enhancements layered over the shared obstacle pace.

## D. Architecture and technical decisions

- Hybrid rendering preserves Buhle's CSS dinosaur and Canvas scene. Replacing it with all-Canvas or all-DOM rendering would add unnecessary work and reduce CSS design independence.
- requestAnimationFrame synchronizes drawing with browser frames. A fixed 120 Hz accumulator stabilizes physics; elapsed time is clamped to 50 ms and reset on resume.
- Negative jump velocity moves up; positive gravity reduces upward speed and then causes falling. Early release shortens ascent. Ground clamping resets vertical velocity and permits the next jump.
- Single cactus objects enter beyond the right edge, move left and leave the array offscreen. Gaps allow recovery between full jumps. Higher speed is capped.
- AABB uses four overlap comparisons. Player insets avoid harsh collisions against decorative extremities; CSS scaling does not alter logical hitboxes.
- A single state string represents ready, playing, paused or gameover. Only playing updates simulation; collision is processed once.
- Passing a cactus awards one point once. Local best is optional persistence; storage errors are caught.
- Restart cancels the pending frame and resets player, obstacles, score, speed, spawn distance, gap, particles, scenery and frame accumulator. Listeners remain registered once.

## E. Testing results

Executed `node --check script.js`: passed.

Executed `node --test tests/game.test.cjs`: 24 tests passed after the final audit fixes. Coverage includes static asset references, initial ground position, both jump keys, repeat protection, airborne jump prevention, landing, duck/stand/jump transitions, spawning, leftward movement, cleanup, single scoring, AABB overlap/clearance, collision-driven Game Over, frozen final score, 30 restart cycles, one pending frame, pause/resume, tab hiding, bounded inactive time, six trajectory samples at 30/60/144 Hz, tallest-cactus clearance at speeds 5 and 11, and the final regressions described below.

The clearance test initially used the same short approach distance at both speeds and failed at maximum speed. Its setup now gives the same 12-frame approach time at each speed, verifying achievable clearance rather than assuming a fixed pixel distance suits every speed. Full jumps are needed for taller obstacles.

Tests use Node VM with mocked browser APIs; they execute the actual script but do not emulate CSS layout or real audio. Real browser automation was not run; no Playwright/Puppeteer installation was available. No browser or usability pass is claimed.

Executed final `git diff --check`: passed. Final PDF SHA-256 matches the initial value: `CC496509CBE7F972B9B960412913109BFB298359906E08744E8477DE97B70275`.

## F. Final code review

- BLOCKER: none found in source review and automated gameplay checks.
- IMPORTANT: real browser acceptance remains pending for layout, Canvas/CSS alignment, sound, native button keyboard activation and touch. These require the checklist below; Node mocks cannot establish them.
- OPTIONAL: add a touch duck control if mobile ducking is desired. Provide a nonvisual gameplay alternative if broader accessibility is a future goal. The present assignment remains a visually timed game.

Review covered semantics, focused functions, physics, fixed frame timing, bounded collections, fair obstacle spacing, AABB checks, states, restart, score, input repeats, listeners, CSS scaling, live status, reduced-motion styles and modern API compatibility. No dependencies, backend or generated asset files were added. Modern browsers with Canvas `roundRect` and ResizeObserver are expected.

## G. Manual verification checklist

1. Open `index.html` directly and via a static server if available. Confirm assets load and DevTools has no errors.
2. Before start, check title, instructions, zero score and grounded character; no obstacles should move.
3. Start by button, Space and Arrow Up on separate runs. Confirm jump keys prevent page scrolling.
4. Hold/release jump for different heights, hold through landing, and press repeatedly in midair. Confirm no automatic repeat or double jump.
5. Duck, stand, jump from duck, and release duck during landing. Check the feet align with the ground.
6. Clear short/tall cacti and deliberately hit one. Check score awards once, final score matches and then freezes.
7. Pause with P, hold P, resume with P/button, hide/return to the tab, and switch windows. Confirm paused status and no catch-up leap.
8. Restart repeatedly by button/keyboard; verify score, speed, player and obstacle reset without extra loops or faster animation.
9. At desktop and 320/375-pixel mobile widths, check readable overlay controls, no horizontal overflow, and alignment after resizing during play.
10. On a touch device, start/restart and tap/hold/release the playfield. Confirm page gestures do not swallow jumps.
11. Toggle mute and test sound after a user gesture. Reload to check local best; confirm gameplay still works if storage is blocked.
12. Tab through buttons and activate with Space/Enter; confirm visible focus, live state announcements and reduced-motion styling.

## H. Instructor presentation preparation

1. **Why use `const` for player when it changes?** `const` prevents rebinding; the object's properties remain mutable. Obstacles use `let` because filtering replaces the array.
2. **Why combine DOM and Canvas?** DOM provides accessible controls and CSS character styling; Canvas redraws scenery and obstacles. Shared logical coordinates align both.
3. **Why register listeners outside startGame?** Registering once prevents duplicate actions after each restart. Key repeat is ignored for jump and pause.
4. **Why requestAnimationFrame rather than setInterval?** It aligns rendering with browser paint and provides timestamps; fixed substeps keep physics independent of refresh rate.
5. **What does gravity change?** It adds to vertical velocity each simulation step; velocity then changes vertical position. Positive Y is downward.
6. **How are double jumps and floor penetration prevented?** Jump requires grounded state. Landing clamps the feet to groundY and zeroes velocity.
7. **How does collision detection work?** Both horizontal and vertical intervals must overlap. Four comparisons implement AABB with a small player inset.
8. **Why use an obstacle array and `passed` flag?** Each object stores its own bounds and scoring state; iteration moves objects, the flag prevents duplicate points, and filtering removes offscreen objects.
9. **Why use an explicit state string?** Mutually exclusive states avoid contradictory running/paused combinations and make valid transitions easy to explain.
10. **Why freeze score on Game Over?** Only playing runs simulation, and no further frame is scheduled after collision. The final status reads that stopped score.
11. **What prevents restart from accelerating the game?** It cancels the pending animation frame before requesting one replacement, resets timing and never adds listeners.
12. **Why remove bird/cluster patterns, and what alternatives exist?** Single randomized cacti simplify fair jump timing and match the assignment. Tested bird/cluster patterns could return later; a full Canvas character is possible but would replace useful CSS contributions.

## I. Git summary

Changes remain on `feature/dino-runner` for review. A future PR can include the three source files, README, this report and regression tests. Nothing was committed, pushed, merged or deployed. The original untracked PDF must be excluded from staging. No teammate repository was modified remotely.

## Final audit fixes and regression results

This follow-up modified only `script.js`, `tests/game.test.cjs`, `README.md` and this report. Existing HTML, CSS, visual design, fixed-step physics, spawning rules and scoring rules were preserved.

- **Jump release:** previously any key/pointer release could shorten a jump, even while paused. A single input-source value now identifies the initiating key or pointer ID. Only its matching release can shorten the jump during play; unrelated releases and pointer cancellations do not interfere.
- **Pause policy:** entering pause discards jump ownership and freezes velocity, position, dimensions and duck pose. Releases during pause are ignored. Resume clears duck input, synchronizes grounded standing dimensions/position, and continues the frozen jump without applying delayed releases. Fresh jumps retain variable height; repeated keydown cannot cause automatic jumps. Manual pause, blur and tab hiding follow the same path.
- **Duck alignment:** previously pause/blur cleared the duck flag while leaving Y=226 and height=24, causing the standing visual to extend below the ground. Pause now retains the duck visual and hitbox; resume atomically restores height=40 and Y=210 on the ground. Airborne resume keeps position and velocity unchanged while clearing fast-drop input.
- **Best score:** the new-record boolean is computed against the previous best before storage changes. Scores below or equal to the old best do not announce a record; a strictly higher score does.
- **Test doubles:** listener arrays retain every registration, dispatch all handlers and expose counts. Class lists retain actual membership. The mock animation clock advances with frame timestamps.

### Fairness assumptions and evidence

The sequence tests use the actual production generator, updates, scoring, collisions and animation loop. A narrow test wrapper supplies random value 1 only while generating each cactus, conservatively testing the exact upper boundaries (height 50, width 25; real Math.random values approach but exclude 1). Other random calls return 0, selecting the minimum permitted gap. No obstacles are manually positioned in these sequence tests.

The scheduled input rule starts a full jump when the next cactus is about 12 nominal frames from the standing player's front edge. It requires landing before another jump and does not use early releases or ducking. This establishes a feasible timing rule for the tested encounters; it does not promise success for arbitrary player timing or short taps.

| Scenario | Consecutive passes | Result |
| --- | --- | --- |
| Base speed 5, starting score 0; natural milestone at 5 | 8 | Passed, with landing between jumps and speed increasing to 5.5 |
| Maximum speed 11, starting score 0 | 8 | Passed, speed remains capped |
| Base speed 5, starting score 4; immediate milestone | 8 | Passed through difficulty transitions |
| In-memory negative control with five-frame spawn gaps | Rejected | Same sequence verifier detects collision, as intended |

No impossible sequence was found under these conditions, so production spawning did not need changes. The negative control changes only an in-memory copy of the script and does not alter repository gameplay.

The final suite contains 24 tests: the original nine checks (including the strengthened trajectory check) plus 15 added regressions. New coverage includes keyboard/pointer ownership, pointer cancellation, paused releases, stale releases after resume/restart, repeat protection after resume, ground/air duck pause behavior, manual/blur/hidden-tab paths, listener registration counts, lower/tied/higher best scores, three generated obstacle sequences and the negative control. Both JavaScript syntax checks and `git diff --check` also pass.

Remaining review: no known BLOCKER or IMPORTANT code defects from these checks. IMPORTANT acceptance work remains real-browser verification of pause during ascent/ducking, resume posture, touch release/cancellation, responsive alignment, sound and native keyboard button behavior. OPTIONAL presentation burden remains the fixed-step accumulator and hybrid scaling explanation; no architecture replacement is recommended.
