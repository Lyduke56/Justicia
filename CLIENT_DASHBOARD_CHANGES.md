# Client Dashboard UI/UX & Neumorphism Enhancements

Comprehensive record of all design refinements, neumorphic shadow tokens, layout adjustments, and interactive animations implemented across the Client Dashboard.

---

## 1. Design System & Neumorphism Tokens

### Color Palette Consistency
- **Base Surface Color**: Unified `#E5D8CB` across all surfaces (page background, lawyer cards, search input, calendar card, pagination pills).
- **Accents**:
  - Gold Accent: `#C58B3C` / `#D39758` for primary highlights, active pagination dot, and "IBP Verified" text.
  - Deep Espresso / Text: `#34150F` for primary text and headings, `#5C4535` for secondary text and roll numbers, and `#A89685` for separators.
- **Recommended Lawyers Capsule Pill**: Background `#D39758` at 30% opacity (`rgba(211, 151, 88, 0.30)`).

### Neumorphic Shadow Tokens (`src/app/globals.css`)

```css
/* Recessed / Inset Surface (#E5D8CB) */
.neu-recessed,
.neu-pressed {
  background-color: #E5D8CB;
  border: none;
  box-shadow:
    -1px -1px 2px 0 rgba(206, 194, 183, 0.50),
    1px 1px 2px 0 rgba(252, 238, 223, 0.30),
    inset 5px 5px 13px 0 rgba(206, 194, 183, 0.90),
    inset -5px -5px 10px 0 rgba(252, 238, 223, 0.90),
    inset 5px -5px 10px 0 rgba(206, 194, 183, 0.20),
    inset -5px 5px 10px 0 rgba(206, 194, 183, 0.20);
}

/* Raised Extruded Surface (#E5D8CB) */
.neu-raised {
  background-color: #E5D8CB;
  border: none;
  box-shadow:
    8px 8px 20px 0 rgba(206, 194, 183, 0.90),
    -8px -8px 16px 0 rgba(252, 238, 223, 0.90),
    8px -8px 16px 0 rgba(206, 194, 183, 0.20),
    -8px 8px 16px 0 rgba(206, 194, 183, 0.20),
    inset -1px -1px 2px 0 rgba(206, 194, 183, 0.50),
    inset 1px 1px 2px 0 rgba(252, 238, 223, 0.30);
  transition: box-shadow 0.2s ease, filter 0.2s ease;
}

/* Small Raised Pills & Badges (#E5D8CB) */
.neu-raised-sm {
  background-color: #E5D8CB;
  border: none;
  box-shadow:
    5px 5px 13px 0 rgba(206, 194, 183, 0.90),
    -5px -5px 10px 0 rgba(252, 238, 223, 0.90),
    5px -5px 10px 0 rgba(206, 194, 183, 0.20),
    -5px 5px 10px 0 rgba(206, 194, 183, 0.20),
    inset -1px -1px 2px 0 rgba(206, 194, 183, 0.50),
    inset 1px 1px 2px 0 rgba(252, 238, 223, 0.30);
  transition: box-shadow 0.2s ease, filter 0.2s ease;
}

/* Interactive Lawyer Card: Recessed at rest, rises on hover, tactile press on click */
.neu-card-interactive {
  background-color: #E5D8CB;
  border: none;
  box-shadow:
    -1px -1px 2px 0 rgba(206, 194, 183, 0.50),
    1px 1px 2px 0 rgba(252, 238, 223, 0.30),
    inset 5px 5px 13px 0 rgba(206, 194, 183, 0.90),
    inset -5px -5px 10px 0 rgba(252, 238, 223, 0.90),
    inset 5px -5px 10px 0 rgba(206, 194, 183, 0.20),
    inset -5px 5px 10px 0 rgba(206, 194, 183, 0.20);
  transform: translateY(0) scale(1);
  transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1),
              box-shadow 0.24s cubic-bezier(0.2, 0.8, 0.2, 1),
              filter 0.2s ease;
  will-change: transform, box-shadow;
}

.neu-card-interactive:hover {
  transform: translateY(-4px);
  box-shadow:
    8px 10px 22px 0 rgba(206, 194, 183, 0.90),
    -8px -8px 16px 0 rgba(252, 238, 223, 0.90),
    8px -8px 16px 0 rgba(206, 194, 183, 0.20),
    -8px 8px 16px 0 rgba(206, 194, 183, 0.20),
    inset -1px -1px 2px 0 rgba(206, 194, 183, 0.50),
    inset 1px 1px 2px 0 rgba(252, 238, 223, 0.30);
  filter: brightness(1.015);
}

.neu-card-interactive:active {
  transform: translateY(1px) scale(0.985);
  box-shadow:
    -1px -1px 2px 0 rgba(206, 194, 183, 0.50),
    1px 1px 2px 0 rgba(252, 238, 223, 0.30),
    inset 6px 6px 14px 0 rgba(190, 178, 167, 0.95),
    inset -6px -6px 12px 0 rgba(252, 238, 223, 0.95),
    inset 6px -6px 12px 0 rgba(190, 178, 167, 0.25),
    inset -6px 6px 12px 0 rgba(190, 178, 167, 0.25);
  transition-duration: 0.08s;
}
```

---

## 2. Component Refinements

### A. Dashboard View (`src/components/client/views/DashboardView.tsx`)
- **Entrance Animation**: Orchestrated with Framer Motion variants:
  - `page`: Base page stagger and container timing.
  - `headline`: Staggered masked reveal where individual words slide up smoothly from behind a clipping mask.
  - `wipe`: Calendar widget reveals horizontally with shadow-preserving clip-path (`inset(-60px 100% -60px 0px)` to `inset(-60px -60px -60px -60px)`).
  - `fade`: Smooth opacity transition for search input and recommendations section.
  - `useReducedMotion()`: Gracefully bypasses entrance animations if user system preferences request reduced motion.
- **Layout & Proportions**:
  - Calendar widget fixed width: `lg:w-[700px] lg:shrink-0` to give the calendar comfortable horizontal room.
  - Left column automatically expands and scales proportionally (`w-full lg:flex-1 min-w-0`).
  - Margins and padding calibrated for balanced whitespace (`px-8 sm:px-12 lg:px-16 xl:px-20 py-6 sm:py-12`).

### B. Dashboard Search Input (`src/components/client/DashboardSearchInput.tsx`)
- **Container**: Recessed neumorphic styling with `neu-recessed`, `h-12 sm:h-14`, and `rounded-[10px]`.
- **Interactive Submit Trigger**:
  - Monitors user query state (`hasPrompt = query.trim().length > 0`).
  - When the user finishes typing and hovers the submit button, the button smoothly tilts upwards (`rotate: -30°`, `y: -2`, `x: 2`) via a spring transition, providing visual feedback that the query is primed for submission.
  - In resting state (or when empty), the icon rests horizontally at `0°`.
  - Supports tactile tap animation (`whileTap={{ scale: 0.9 }}`).

### C. Client Icons (`src/components/client/ClientIcons.tsx`)
- **`SendPaperPlaneIcon`**: Redrawn to point completely horizontal right (`0°` along `y=12` centerline):
  ```svg
  <path d="M22 12L3 4.5l5.5 7.5L3 19.5 22 12z" />
  <line x1="8.5" y1="12" x2="22" y2="12" />
  ```

### D. Lawyer Card (`src/components/client/LawyerCard.tsx`)
- **Card Container**: Rounded corner radius (`rounded-[22px]`) with `.neu-card-interactive`.
  - Recessed at rest, smoothly elevates (`translateY(-4px)`) into `neu-raised` on hover.
  - Snaps into a tactile button press (`translateY(1px) scale(0.985)`) on click.
- **Vertical Alignment**: Avatar circle (`64px` / `80px`) aligns with the "IBP Verified" raised capsule at the top and the specializations line at the bottom.
- **Typography**:
  - Name: Lora font, bold.
  - "IBP Verified": Lora font, encapsulated in a raised capsule pill (`neu-raised-sm`).
  - Roll No & Chapter: Inter font with generous horizontal spacing (`Roll No. 58942  |  IBP MAKATI`).
  - Specializations: Inter font with dot separators (`Labor & Employment • Corporate • Civil Law`).

### E. Lawyer Grid Section (`src/components/client/LawyerGridSection.tsx`)
- **Header Pill**: "Recommended Lawyers" capsule background set to `#D39758` at 30% opacity (`rgba(211, 151, 88, 0.30)`).
- **Pagination Controls**:
  - Active page buttons render as an extruded circular button (`neu-raised-sm rounded-full size-10 sm:size-11`) when remaining pages exist.
  - Disabled controls render as subtle non-interactive chevrons.
  - Active page indicator styled with gold accent dot (`#D39758`).

### F. Shell & Navigation (`src/components/client/ClientShell.tsx`)
- **Unified Background**: `#E5D8CB` applied across viewport root and main scrollable content area (`#client-main-content`).
- **View Transition**: Updated `.client-view-enter` with smooth 420ms cubic bezier curve (`cubic-bezier(0.16, 1, 0.3, 1)`).

---

## 3. Verification & Quality Assurance

- **Build Verification**: `npm run build` executed successfully with code `0`.
- **Static & Dynamic Routes**: All 51 application routes compiled and verified without type or styling errors.
- **Accessibility**: Integrated `useReducedMotion()` to respect system accessibility preferences for motion sickness or vestibular considerations.

