# YourPar — PROJECT BRIEF (Source of Truth)

## Purpose

YourPar is a **golf strategy and scoring engine for high-handicap players**.
It is **not** a swing coach, GPS app, or rangefinder.

The app helps players:

- Plan hole-by-hole strategy using Stableford logic
- Choose safe, repeatable clubs
- Hit greens in regulation where possible
- Avoid high-risk shots that blow up scoring

This document is the **authoritative source of truth** for the project.
All code changes must conform to it.

---

## Core Principles

- Strategy > swing mechanics
- Safe outcomes beat hero shots
- Consistency beats distance
- The app must be explainable to a 30–45 handicap golfer

---

## App Architecture (MANDATORY)

### Navigation

The app uses **Expo Router only**.

Active routes:

- `/` → Home / entry point
- `/goal` → Target Stableford goal selection
- `/par-card` → “My Score Card” (MyPar view)
- `/hole` → Hole strategy screen
- `/clubs` → Club distances & preferences

❌ Do NOT introduce `react-navigation`
❌ Do NOT add alternative navigation flows

---

## Legacy Code

Any files inside `/legacy` are **read-only reference material**.

❌ Do NOT edit
❌ Do NOT import
❌ Do NOT “fix” legacy screens

---

## Data & Storage (CRITICAL)

### AsyncStorage Keys

Only the following keys are allowed unless explicitly added here.

#### `clubDistances`

**This is the ONLY valid shape:**

```js
{
  distances: {
    Driver: number,
    "3W": number,
    "5W": number,
    "4i": number,
    "5i": number,
    "6i": number,
    "7i": number,
    "8i": number,
    "9i": number,
    PW: number,
    GW: number,
    SW: number,
    LW: number
  },
  favouriteClub: string | null,
  favouriteWedge: string | null,
  useWedgeRegulation: boolean,
}
```

Distances are carry distance in metres

Partial shots are calculated logically — they are NOT stored

If older formats are detected, they may be migrated ON LOAD only

❌ Do NOT create alternate shapes
❌ Do NOT create new storage keys for the same concept

#### `currentCourse`

The currently active course for strategy calculations.

**Shape:**

```js
{
  name: string,
  holes: [
    {
      hole: number,
      par: number,
      length: number,
      index: number
    }
  ]
}
```

If not present, falls back to Burns Club demo course.

#### `savedCourses`

Array of user-entered courses that can be selected.

**Shape:**

```js
[
  {
    name: string,
    holes: [
      {
        hole: number,
        par: number,
        length: number,
        index: number,
      },
    ],
  },
];
```

Each course in the array follows the same shape as `currentCourse`.

## Strategy Engine Rules

### High-level

Strategy is based on Stableford scoring. The strategy engine is sensitive to exit conditions and must never introduce unbounded loops or planners without hard stop conditions.

A player’s handicap determines:

- Allowed shots per hole

- Risk tolerance

The engine prefers:

- Repeating a safe club

- Leaving wedge-friendly distances

- Hitting greens in regulation where realistic

- Strategy logic includes: shot planning loops, path construction, exit conditions, and distance reduction logic. These must not be relocated into UI components or hooks.

- UI may call strategy functions, but must not implement planning logic.

- All strategy lives in utils/ only.

### MyPar Immersion Rule (MANDATORY)

- The user must never be prompted to think in terms of actual course par.
- Once a round starts, MyPar is the only conceptual model shown.
- Screens must not mix or compare MyPar with real par.
- Language, labels, and headings must reinforce MyPar as the “truth” for the round.
- Any reference to actual par is internal only and must never surface in UI outside of the new course entry screen.

### Visual Design Principles (MANDATORY)

## Overall Feel

Calm, confident, and professional — not flashy, not playful.

Designed for focus during a golf round, not exploration.

Should feel like a trusted caddie, not a game or dashboard.

## Colour Usage

Slate backgrounds dominate; navy is reserved for intent.

Navy is used only for primary actions, key emphasis, and active states.

Avoid high-contrast colour noise.

No pure white surfaces.

No decorative gradients or visual effects.

Hierarchy & Emphasis

One primary action per screen.

Secondary actions must be visually subordinate.

Headings > body text > helper text must be clearly differentiated by size and weight, not colour alone.

Never rely on colour as the only indicator of meaning.

Typography

Use system fonts only.

Text should prioritise legibility over style.

Avoid ALL CAPS except for short labels or buttons.

Line height should favour readability, especially for strategy text.

Spacing & Layout

Generous vertical spacing between sections.

Related items should feel grouped; unrelated items should feel clearly separated.

Prefer fewer elements per screen over dense layouts.

Consistent padding and margins across screens.

Buttons & Actions

Primary actions use the PrimaryButton component.

No default platform buttons.

Destructive actions must be visually distinct but restrained (no bright red buttons unless necessary).

Buttons should feel intentional, not “clickable everywhere”.

Cards & Containers

Use soft contrast between background and cards.

Cards are for grouping information, not decoration.

Avoid heavy borders; prefer subtle separation.

Rounded corners should be consistent and modest.

Icons & Visual Noise

Icons should support comprehension, not decorate.

Avoid unnecessary icons.

No emoji.

No ornamental imagery.

Consistency Rules

If a pattern is introduced on one screen, reuse it elsewhere.

Do not invent new visual patterns without strong reason.

When in doubt, copy an existing pattern from another screen.

“Does This Look Right?” Test

If the UI feels:

Busy → simplify

Flashy → remove colour

Playful → tone it down

Clever → make it obvious

The correct default is boring but trustworthy.

### Key Concepts

Favourite Club: preferred repeatable club when multiple options exist

Wedge Regulation (MyWIR):

When enabled, intentionally leaves 80–110m where possible

GIR First Logic:

If reachable safely, plan to hit GIR

Otherwise, plan controlled lay-ups

❌ Do NOT introduce swing advice
❌ Do NOT introduce shot-shape mechanics
❌ Do NOT gamify beyond scoring and strategy

### Course Model (Current Scope)

Single course supported initially (Burns Club)

Holes defined by:

- hole number

- par

- length (metres)

- stroke index

Course expansion comes later

❌ Do NOT generalise course architecture yet

### Round State (Planned / In Progress)

A round session will include:

- 9 or 18 holes

- Front or back 9 selection

- Current hole index

- Running Stableford total

- End-of-round summary

- Saved round history

Until implemented, screens are considered planning views only.

### Code Change Rules (IMPORTANT)

Before making changes:

- Read this file

- Identify exactly which files are affected

- Propose a short plan

- Wait for approval (if required)

When making changes:

- Touch the minimum number of files

- Make small, reversible commits

- Do not refactor unrelated code

- Do not invent new abstractions

After changes:

- Run lint / type checks

- Confirm app launches

- Summarise:
  - what changed

  - what to test manually

### Definition of “Done”

A feature is done when:

- The app runs without errors

- Strategy output matches intent

- Data persists correctly

- No duplicate logic or storage shapes exist

- No legacy files were touched

- All code changes must pass the repository’s automated checks.

- No screen may block the main thread or hang the UI under valid inputs.

### Non-Goals (Explicit)

The app will NOT:

- Teach swing mechanics

- Replace a GPS rangefinder

- Simulate pro-level shot shaping

- Optimise for low-handicap golfers (yet)

### Main Flow Screens (Scope for most UI tasks)

- Home (/)
- Goal (/goal)
- Course Select (/course-select)
- Course Entry (/course-entry)
- Par Card (/par-card)
- Hole (/hole)
- Clubs (/clubs)
- Settings (/settings)

### AI Working Rules (MANDATORY)

- Read this document before suggesting changes

These rules apply to all AI-assisted changes unless explicitly overridden.

## Scope & File Safety

- Only modify files under: HandicapCaddyMVP/
- Ignore all other folders, even if visible in the workspace.
- Allowed folders by default:
  - app/
  - components/
  - constants/
  - utils/
- Do NOT modify tests, config files, build tooling, or dependencies unless explicitly asked.

## Git & Repo Hygiene

- Do NOT run git commands unless explicitly instructed.
- Never use `git add -A`, `git add .`, or commit automatically.
- Do NOT stage or commit files outside the files you directly changed.
- Do NOT add node_modules, .expo, browser profiles, OS files, or caches to git.

## File Creation

- Do NOT create new files unless explicitly required for the task OR explicitly approved.
  - If a new file is needed, propose it first and wait.”

- If a task would benefit from a new file, propose it first and wait for approval.

## Build & Tests

- Do NOT “fix” tests, Jest config, lint rules, or TypeScript errors unless they are directly caused by the requested change.
- If a build/test issue appears unrelated, stop and ask.

## Behaviour Expectations

- Follow the PROJECT_BRIEF over assumptions.
- Prefer minimal, localised changes.
- When in doubt, ask rather than expanding scope.

## If In Doubt

Stop.
Explain the uncertainty.
Propose options.
Do NOT guess.

This project values correctness and clarity over speed.
