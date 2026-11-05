# Client AI Legal Assistant UI/UX & Neumorphism Enhancements

Comprehensive record of all design refinements, neumorphic shadow tokens, layout adjustments, interactive animations, and component refactoring implemented across the **Client AI Legal Assistant Screen** (`src/components/client/AIAssistantChat.tsx`).

---

## 1. Design System & Neumorphism Tokens

The screen has been aligned with the unified client portal design system and authentic neumorphic tokens defined in `src/app/globals.css`.

### Color Palette Consistency
- **Base Surface Color**: Unified `#E5D8CB` across the full viewport, parchment message bubbles, input containers, and button plates.
- **Accents**:
  - Primary Gold Accent: `#C58B3C` and `#D39758` for icons, active pills, statutory authority highlights, focus rings, and animated indicators.
  - Deep Espresso / Headings: `#34150F` for primary headlines, card text, and user message bubbles.
  - Warm Brown / Secondary: `#5C4535` and `#7A6756` for descriptions, statutes, and subtitles.
  - Separators & Dividers: `#A89685` and `#D8C6B0`.
  - Muted Disclaimer: `#8E7E70`.
  - Header Capsule Pill: `#D39758` at 30% opacity (`rgba(211, 151, 88, 0.30)`).

### Neumorphic Tokens Applied (`src/app/globals.css`)

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

/* Caramel / Gold primary action button (Find a Lawyer CTA) */
.neu-btn-caramel {
  background-color: #D49E56;
  box-shadow:
    0 6px 16px rgba(212, 158, 86, 0.4),
    inset 0 1px 1px rgba(255, 255, 255, 0.4);
  border: none;
  transition: all 140ms ease;
}

.neu-btn-caramel:hover {
  background-color: #C58B3C;
}

.neu-btn-caramel:active {
  box-shadow: inset 2px 2px 6px rgba(140, 96, 32, 0.6);
}
```

---

## 2. Component Refinements (`src/components/client/AIAssistantChat.tsx`)

### A. Pristine / Empty State (`messages.length === 0`)
- **Staggered Masked Entrance Animation**:
  - Implemented using Framer Motion (`motion/react`) variants matching `DashboardView.tsx`.
  - Individual words of `"Let's make it make sense, {userFirstName}."` slide up smoothly from behind clipping masks while transitioning from `blur(10px)` to `blur(0px)`.
  - Motion accessibility is honored via `useReducedMotion()`.
- **Header Badge**:
  - Encapsulated `"Philippine Legal Intelligence"` badge with `#D39758` at 30% opacity (`rgba(211, 151, 88, 0.30)`) and `.neu-raised-sm` styling.
- **Extended Prompt Text Field Width**:
  - Form width expanded from `max-w-2xl` (672px) to **`max-w-4xl lg:max-w-5xl`** (up to 1024px) inside a `max-w-[1240px]` viewport container for a generous, prominent typing area.
  - Recessed neumorphic container (`.neu-recessed bg-[#E5D8CB] rounded-[22px] p-3.5 sm:p-4`) with smooth focus ring (`focus-within:ring-[#B9833C]/40`).
- **Tactile Raised Attachment Plus Button**:
  - Encased in a circular extruded button with the neumorphic rise effect (`.neu-raised-sm rounded-full size-11 sm:size-12 bg-[#E5D8CB]`).
  - Contains the clean, borderless `PlusIcon` (orthogonal cross lines without enclosing SVG circle stroke).
  - Tactile animation on interaction:
    - Hover: `whileHover={{ scale: 1.04 }}`
    - Click: `whileTap={{ scale: 0.9 }}` with spring transition (`stiffness: 400, damping: 25`).
- **Interactive Paper Plane Submit Button**:
  - Monitors prompt state (`hasPrompt = inputQuery.trim().length > 0 || !!attachedFile`).
  - Spring-animated hover tilt (`rotate: -30°`, `y: -2`, `x: 2`) when primed for submission.
  - Tactile press animation: `whileTap={{ scale: 0.9 }}`.
- **Removal of "Common Legal Scenarios" Cards**:
  - The bulky 4-card grid and "Common Legal Scenarios" section were removed to keep the interface focused, clean, and spacious.
- **Tactile Popular Topics Capsules**:
  - Quick query pills (*Labor Code Illegal Dismissal, Small Claims MTC Procedure, Estate Settlement Without a Will, Cyber Libel Requirements, Tenancy & Eviction Rules, BP 22 Bouncing Checks*).
  - Raised extruded capsule pill (`.neu-raised-sm px-4 py-2 rounded-full bg-[#E5D8CB]`).
  - Tactile button animation:
    - Hover: `whileHover={{ scale: 1.04, y: -1 }}`
    - Click: `whileTap={{ scale: 0.92, y: 1 }}` with spring timing (`stiffness: 400, damping: 22`).
- **Increased Vertical Spacing**:
  - Increased padding between the prompt text field and popular topics capsules to **`pt-7 sm:pt-10`** for clear visual breathing room.
- **Centered Disclaimer**:
  - Subtle disclaimer in Inter font (`text-[#8E7E70]`) clarifying informational scope under Philippine statutes.

---

### B. Active Conversation View (`messages.length > 0`)
- **Container Layout**:
  - Calibrated to `h-[calc(100vh-4rem)]` with `max-w-[1240px] mx-auto`.
  - Independent scroll region (`flex-1 min-h-0 overflow-y-auto`) prevents double scrollbars and maintains a pinned header and anchored input bar.
- **Conversation Header**:
  - AI avatar badge in an extruded circle (`.neu-raised-sm size-11 rounded-full bg-[#E5D8CB]`) with gold `AIAssistantIcon`.
  - Lora bold title `"Justicia Legal Assistant"` and subtitle with `"IBP Grounded"` raised capsule pill.
  - Tactile `"+ New Question"` button styled with `.neu-raised-sm` and active spring press.
- **User Message Bubble**:
  - Right-aligned Deep Espresso (`#34150F`) card with ivory text (`#FAF6F0`), subtle shadow, and attached document badge (when a file is attached).
- **Assistant Message Bubble**:
  - Left-aligned extruded parchment bubble with authentic neumorphic shadow (`.neu-raised bg-[#E5D8CB] rounded-[24px] rounded-tl-sm p-5 sm:p-6`).
  - Lora typography for optimal legal text readability.
  - Off-topic warning banner (`.neu-recessed bg-[#E5D8CB] border border-[#C58B3C]/40`) when queries fall outside Philippine law.
- **Philippine Legal Authorities Section**:
  - Uppercase gold heading with `🏛️` icon.
  - Statutory citation chips styled as individual extruded pills (`.neu-raised-sm bg-[#E5D8CB] px-3 py-1.5 rounded-[10px]`) displaying citation number, separator, and title.
- **Consult a Lawyer Escalation Banner**:
  - Recessed container (`.neu-recessed bg-[#E5D8CB] rounded-[18px] border border-[#C58B3C]/35`) shown when legal consultation is recommended.
  - Displays suggested specialization badge (e.g., *Civil Law*, *Labor Law*).
  - Primary `.neu-btn-caramel` button with `FindLawyerIcon` linking directly to `/client/lawyers` with pre-filled filters.
- **Thinking / Analyzing Indicator**:
  - Extruded `.neu-raised` card on `#E5D8CB` with gold pulsing animation (`bg-[#C58B3C] animate-ping`) and italicized copy (*"Analyzing Philippine statutes & Supreme Court jurisprudence…"*) during response generation.
- **Bottom Sticky Input Bar**:
  - Recessed container (`.neu-recessed bg-[#E5D8CB] h-13 sm:h-15 rounded-[16px] px-3.5 sm:px-4.5`).
  - Tactile circular plus button (`.neu-raised-sm rounded-full size-9 sm:size-10`) with `whileTap={{ scale: 0.9 }}`.
  - Spring-tilted paper plane submit trigger and legal disclaimer.

---

## 3. Custom SVG Icon Additions (`src/components/client/ClientIcons.tsx`)

- **`PlusIcon`**: Dedicated clean orthogonal cross lines without enclosing circle stroke, allowing pure SVG scaling and custom button wrappers:
  ```svg
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
  ```

---

## 4. Verification & Quality Assurance

- **Build Verification**: `npm run build` executed successfully with code `0`.
- **All 51 Routes Compiled**: Zero TypeScript or styling errors across static and dynamic routes.
- **Accessibility**: Full compliance with motion sensitivity preferences via `useReducedMotion()`.
