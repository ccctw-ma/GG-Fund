# Fund Landing Page UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild GG Fund as a glassmorphism fintech landing page with account overview, transaction features, security highlights, mobile download CTAs, and the existing live fund workspace.

**Architecture:** Keep the existing React app state and API data flow in `App.tsx`. Add presentational landing sections above the existing product workspace and restyle shared cards/buttons so child panels align with the new system.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS v4, Lucide React, Recharts, Vitest.

---

## File Structure

- Modify `frontend/src/App.test.tsx`: update expectations to describe the redesigned landing page and preserved workspace.
- Modify `frontend/src/App.tsx`: add landing section data, new visual sections, account/mobile/security previews, and workspace wrapper.
- Modify `frontend/src/components/Header.tsx`: update navigation labels and CTA for the landing page.
- Modify `frontend/src/components/ui/card.tsx`: restyle shared cards for dark glass UI.
- Modify `frontend/src/components/ui/button.tsx`: restyle shared buttons with trust-building colors.
- Modify `frontend/src/styles.css`: replace old banking theme with glassmorphism fintech design tokens, layout, responsive rules, focus states, and reduced-motion handling.

## Tasks

### Task 1: Red test for redesigned landing page

- [ ] Update `frontend/src/App.test.tsx` to expect `智能基金账户`, `账户总览`, `交易与基金工具`, `安全与隐私`, `下载移动端`, and existing `中国基金行情`.
- [ ] Run `bun test frontend/src/App.test.tsx`; expect failure before implementation.

### Task 2: Implement landing page structure

- [ ] Update `frontend/src/App.tsx` imports with needed Lucide icons.
- [ ] Add feature/security/download data arrays near the top of the file.
- [ ] Replace the old hero return markup with the new landing sections and workspace wrapper.
- [ ] Keep all existing state, effects, handlers, and child component props unchanged.

### Task 3: Restyle header and UI primitives

- [ ] Update `frontend/src/components/Header.tsx` navigation to landing sections and workspace.
- [ ] Update shared `Card` classes for glass surface styling.
- [ ] Update shared `Button` variants for gold/navy/mint styling.

### Task 4: Replace global theme styles

- [ ] Replace `frontend/src/styles.css` with dark fintech design tokens and glassmorphism layout classes.
- [ ] Add responsive behavior for hero, previews, feature grids, and workspace.
- [ ] Add focus-visible and reduced-motion rules.

### Task 5: Verify

- [ ] Run `bun test frontend/src/App.test.tsx`; expect pass.
- [ ] Run `bun run build`; expect pass.
- [ ] Start/open the local app and visually verify the redesigned UI.
