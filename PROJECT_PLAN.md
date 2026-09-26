# Project Plan

## Current Phase: Web Prototype Foundation

- [x] Static browser entry point with Canvas rendering.
- [x] Foot-referenced player and enemy body model.
- [x] Fixed AABB platform and question-box collision surfaces.
- [x] First level layout with coins, question boxes, enemies, and upper platforms.
- [x] Score, lives, shield timer, and math-question UI.
- [x] Shield durability: 15-second shield expires early after 3 protected enemy/fire contacts.
- [x] Heart-based lives display in the HUD.
- [x] Game-over score screen with manual restart.
- [x] Enemy stomp defeat interaction.
- [x] Extended level length with a finish flag and level transition.
- [x] Level 2 color palette and 10% faster enemy difficulty.
- [x] Four-level progression.
- [x] 30-second question timer with a decreasing progress bar.
- [x] Local top-10 final score table with player name entry.
- [x] 7500px route length with end-of-level boss arena.
- [x] Boss monster with 6-hit health bar, ground fire, falling question boxes, and rocket damage.
- [x] Slower three-rocket diagonal boss salvo while preserving one health loss per correct answer.
- [x] Supplied boss image integrated with transparent-background in-game rendering.
- [x] Different boss image per level with a post-boss fireworks transition.
- [x] Replaceable player and enemy image asset slots.
- [ ] Add final production sprite sheets when supplied.
- [ ] Expand level authoring into external JSON.
- [ ] Add automated browser regression tests for collision alignment.
- [ ] Cross-browser QA in Chrome, Edge, and Firefox.

## Architecture Notes

All moving actors use a physics body as the source of truth. Sprites are drawn from the actor foot point so transparent image padding can be adjusted without changing collision behavior. Coins are positioned by platform top surface with a fixed 10px visual gap from the coin bottom to the platform top.
