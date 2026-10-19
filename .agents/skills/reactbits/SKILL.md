---
name: reactbits
description: React Bits (reactbits.dev) design methods — pick animated components by moment/intent (entrance text, ambient backgrounds, hover/micro interactions, scroll reveals, custom cursors), install them as owned source via shadcn CLI, and tune values with performance, reduced-motion, and restraint guardrails. Use when adding "wow" motion or animated components to a React/Tailwind page, or when the user asks for reactbits, aurora/silk/spotlight/magnet-style effects.
metadata:
  origin: distilled from reactbits.dev (library digest, 2026-10)
---

# React Bits design methods

React Bits ships ~150 free animated React components that **install as source you
own** (JS/TS × CSS/Tailwind variants) so every value is tunable in-repo. This
skill is the digest: what each category of effect is *for*, a decision order,
and the guardrails that keep them tasteful.

## Install (per component, as source)

```
npx shadcn@latest add @react-bits/SplitText-TS-TW
```

Suffix picks the variant: `-JS-` / `-TS-` × `-CSS-` / `-TW-` (Tailwind).
Component name → path mapping comes from reactbits.dev; each component page
lists its own dependencies. Copy-by-hand also works (Code tab → paste files).

## Match the moment before the effect

Name the **moment** first, then pick inside that category:

1. **Entrance text** (first paint of a headline) — `SplitText` (staggered
   chars/words), `BlurText` (soft-focus resolve), `GradientText` (living
   gradient), `StrokeText` (draw-on outline then fill), `CountUp` (odometer
   digits), `TextType` (typewriter), `DecryptedText` (decode scramble).
2. **Ambient background** (set mood behind content) — `Aurora` / `DarkVeil` /
   `SoftAurora` (calm, silky), `Silk` / `Beams` / `Gradual…` (satin light),
   `LiquidEther` / `Ballpit` / `Hyperspeed` (energetic, playful),
   `Particles` / `LetterGlitch` / `DotGrid` (subtle tech).
3. **Surface treatments** (containers) — `SpotlightCard` (pointer-following
   light), `MagicBento` (bento + cursor edge-light), `TiltedCard` (3D tilt +
   glare), `GlassSurface` (liquid glass panel), `Masonry` (gallery).
4. **Navigation** — `PillNav` (fill rises through links + sliding dot),
   `Dock` (macOS magnification), `GooeyNav` (goo transfers), `BubbleMenu` /
   `StaggeredMenu` (staggered open), `Stepper` (multi-step gliding indicator).
5. **Micro-interactions** (confirmations, toggles, feedback) — `ClickSpark`,
   `Magnet` (button eases to cursor), `GlareHover` (light streak), `StarBorder`
   (traveling star on a button outline), `SpringCheck`, `SlideCommit`
   (slide-to-confirm), `CodeSlots` (OTP digits), `Counter` (rolling numbers),
   `SwipeToast` (swipe-dismiss + time fuse).
6. **Scroll-driven** — `AnimatedContent` / `FadeContent` (reveal wrappers),
   `ScrollVelocity` (marquee speed ∝ scroll), `GradualBlur` (progressive edge
   blur), `ScrollReveal`.
7. **Identity moments** (sparingly) — `Ribbons`/`SplashCursor`/`GhostCursor`
   (cursor art), `Noise` (film grain overlay), `LogoLoop` (seamless marquee).

## Decision order (the working method)

1. **Name the moment** (from above) before naming a component. An effect is for
   a job, not decoration.
2. **One ambient effect max per page.** Pair it with at most one entrance
   effect and one hover/micro effect. More reads as noise; the first scroll of
   the page is the vote.
3. **WebGL = hero only.** Shader backgrounds (`Aurora`, `LiquidEther`,
   `SplashCursor`) belong on landing/hero/404 screens — never behind data
   tables, boards, or tools users stare at all day.
4. **Intensity ∝ 1/usage frequency.** A daily operator board wants quiet
   springs; a launch page can be loud.
5. **Animate words, not Ethiopic characters.** Unicode splits grapheme
   clusters — for non-Latin scripts always use the *word-level* variant
   (`SplitText`'s "words" mode) and test the real script, not lorem ipsum.
6. **Every effect must degrade.** `prefers-reduced-motion` → pause the
   ambient loop and swap entrances to a fade; the design cannot depend on a
   cursor (touch has none) — check mobile equivalents.
7. **Own the numbers.** Install as source, then tune durations, spring
   stiffness, amplitude until it feels physical — never ship defaults blind.
8. **Frame budget.** Scroll- and pointer-linked effects must ride transform /
   opacity, avoid per-frame `blur()`/`box-shadow` recalcs, and stay under
   ~16 ms/frame on mid-range Android hardware.
9. **Re-pay restraint.** The effect must not mask sluggish data, pretend a
   slow fetch, or upstage the actual content — if you removed it and the page
   still landed its message, it was recreational.

## Common traps

- Dropping several marquees/glows on one screen (visual shouting).
- Particle backgrounds inside a dense board (contrast + GPU cost for zero
  orientation value).
- Cursor-only interactions without touch fallbacks (dead on phones).
- Shipping un-tuned demo values (default cadence/pixel sizes look demo-y).
- Adding the JS-variant source into a TS project, or TW variant into a
  no-Tailwind app — pick the right suffix or the code fights the codebase.
