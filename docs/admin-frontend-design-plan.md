# Admin frontend: design philosophy and implementation plan

## Objective and scope

Bring every active admin screen into the tactile parchment design language already present in the client and lawyer portals. Scope covers the shell, overview, verification queue, directory, lawyer dossier, accounts, audit log, settings, development-status pages, loading, and error states. Preserve existing routes, data contracts, server actions, and role checks. This is a local frontend change, not a deployment or a backend expansion.

## Analysis of the existing design

References: `src/app/globals.css` (the `neu-*` primitives and lawyer surface tokens), `DashboardView`, `LawyerDashboardView`, `LawyerConsultationsView`, and `DocumentsView`. This analysis uses the implemented reference screens; exact Figma fidelity has not been assessed.

1. **Material continuity.** The page, panels, and controls are variations of warm parchment. Espresso text and the dark header anchor the composition. Peach highlights feel like an extension of the material.
2. **Depth communicates function.** Broad cards rise from the canvas. Smaller plates group related information. Search fields and selected controls sink into their surface. Buttons lift slightly on hover and compress on press.
3. **One light source.** Highlights come from the upper left; warm shadows fall to the lower right. Paired highlights and shadows, plus small inset edge highlights, create volume. A dark drop shadow alone does not reproduce this effect.
4. **Editorial typography.** Lora gives headings and navigation the calm tone of the lawyer portal. Inter keeps forms, tables, dates, and dense operational information readable. Cinzel remains the brand accent.
5. **Soft geometry with purposeful contrast.** Large rounded containers, rounded rectangular inputs, and capsule actions establish the visual rhythm. Espresso and caramel distinguish primary actions; green, amber, and red remain meaningful status indicators.
6. **Breathing room.** Shadows need space between surfaces. Depth should be strongest at the section level; giving every table cell a raised treatment would destroy scanability.

### Why the admin implementation feels different

- The admin canvas uses a different cream, and many cards combine visible beige borders with a weak neutral black shadow.
- Repeated inline shadows prevent consistent elevation and press states.
- Inputs, tables, icon holders, and filters do not share a coherent raised/recessed hierarchy.
- Large Cormorant titles and small sans-serif navigation diverge from the Lora treatment used by the lawyer portal.
- Management dialogs and account drawers need the same materials and usable keyboard behavior as the rest of the page.

## Visual specification

| Element | Treatment | Purpose |
| --- | --- | --- |
| Canvas | `#E5D8CB` parchment | Match the reference portals |
| Primary ink | `#341512` espresso | Strong, warm text contrast |
| Secondary text | `#705744` | Readable small labels |
| Raised panel | Parchment, paired warm shadow/light, 28–32px radius | Main content grouping |
| Peach plate | `#DFC5A9`, compact raised shadow, 16–22px radius | Metrics, icons, compact summaries |
| Recessed field | Parchment, dual inset shadow, 14–18px radius | Search, selection, notes |
| Primary action | Caramel with espresso text | Main next step |
| Secondary action | Raised parchment or espresso | Supporting navigation/actions |
| Selected state | Inset depth plus text/outline/semantic state | Selection remains clear without color alone |
| Keyboard focus | Visible 2px dark-gold outline with offset | Focus independent of shadows |
| Motion | 140–200ms hover/press; short page entrance | Tactile response; respect reduced motion |
| Typography | Lora headings/navigation, Inter body/table | Shared identity with operational clarity |

## Implementation sequence

### 1. Establish scoped foundations

- Add an admin stylesheet with named material, shadow, spacing, and type tokens.
- Add explicit classes for panels, plates, recessed inputs, buttons, filters, tables, and overlays.
- Scope styles to the admin portal so existing client/lawyer screens retain their current rendering.
- Replace repeated inline shadow declarations on active admin screens.
- Use a shared native-dialog wrapper for account, audit, verification, and mobile navigation overlays, including Escape, focus containment, and focus restoration.

### 2. Shell and overview

- Keep the dark branded header and existing account/sign-out actions.
- Give the sidebar a raised parchment surface, recessed active links, and consistent touch targets.
- Add a skip link and retain semantic route links and `aria-current`.
- Restyle the overview with raised metric cards, peach number plates, and clearly separated application/activity sections.
- Keep all dashboard counts and recent activity driven by the existing data props.

### 3. Management screens

- **Verification queue:** tactile status controls, recessed search, raised application cards, peach credential summaries, clear decision controls and modal.
- **Directory:** keyboard-operable metric filters, consistent selected states, recessed search/sort controls, rounded table surface, readable status pills.
- **Lawyer dossier:** raised credential/practice/review cards, recessed identifiers and notes, peach rate plates, coherent history rows.
- **Accounts:** raised role filters, recessed search, consistent table actions, material-matched account drawer.
- **Audit:** same table/search language, tactile refresh/export buttons, scrollable details dialog.
- **Settings and WIP:** reuse the same materials and typography; keep development status explicit.
- **Loading/error:** scoped skeleton surfaces and retry action matching the completed screens.

### 4. Responsive and interaction pass

- Support narrow mobile, tablet, and desktop layouts; preserve horizontal scrolling inside wide tables.
- Wrap filter groups and action rows; prevent panels, long email addresses, and dialog content from widening the page.
- Provide visible focus, selected, hover, pressed, and disabled states.
- Use semantic buttons for clickable filters and associate field labels with controls.
- Respect reduced motion and forced-colors settings; status labels remain explicit.

### 5. Validation and handoff

- Run TypeScript checks and targeted lint for changed frontend files.
- Build the app to validate stylesheet compilation and route integration where the environment permits.
- Review the diff for accidental data/authentication changes and styles leaking outside admin.
- If local browser tooling is available, inspect representative populated/empty screens at mobile and desktop sizes, exercise filters and dialogs, and inspect focus/overflow behavior. Never weaken admin authentication to obtain a preview.
- Record completed work, checks, and any unavailable runtime verification below.

## Acceptance criteria

- Every active admin screen uses a consistent material hierarchy.
- Raised panels and recessed fields remain visually distinct on the parchment canvas.
- Actions visibly respond to hover, press, focus, and disabled states.
- Existing management operations keep their handlers and data sources.
- Dialogs remain usable on small screens and with a keyboard.
- Tables remain readable; visual depth is applied to their container and controls rather than individual cells.
- Client/lawyer styles and backend behavior are unaffected.
- WIP features are still presented as WIP.

## Completion record

Implementation and validation pending.
