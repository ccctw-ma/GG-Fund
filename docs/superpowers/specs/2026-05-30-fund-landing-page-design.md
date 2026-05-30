# Fund Landing Page UI Redesign Design

Date: 2026-05-30

## Goal

Redesign GG Fund from a compact fund dashboard into a polished fund landing page plus live product workspace. The UI should communicate trust, security, mobile readiness, and modern glassmorphism while preserving the existing working fund search, portfolio, authentication, analysis, and settings functionality.

## Direction

Use a high-end fintech/private banking visual language: deep navy and blue-black backgrounds, warm gold CTAs, mint security accents, translucent glass cards, large confident typography, and consistent Lucide icons. Avoid emoji icons and generic purple AI gradients.

## Page Structure

1. Sticky glass header with product navigation and CTA.
2. Hero section with strong fund-management promise, trust metrics, and app/account preview.
3. Account overview preview connected to current portfolio summary values.
4. Transaction and fund feature cards explaining search, watchlist, portfolio, AI analysis, export/import, and auth capabilities.
5. Security highlights covering local-first data, Cloudflare API boundary, export control, and transparent disclaimers.
6. Mobile app download section with iOS/Android/PWA actions and QR placeholder.
7. Live product workspace containing the existing MarketOverview, FundSearch, AuthPanel, AnalysisPanel, PortfolioPanel, and SettingsPanel.

## Accessibility and UX Requirements

- All primary links and buttons must be at least 44px tall.
- Use visible focus outlines.
- Preserve semantic sections and headings.
- Do not convey status by color alone; include text labels.
- Use SVG Lucide icons only.
- Respect reduced motion by disabling decorative animation when requested.
- Keep mobile layout single-column with no horizontal page scroll.

## Implementation Notes

The redesign will primarily modify `frontend/src/App.tsx`, `frontend/src/styles.css`, `frontend/src/components/Header.tsx`, and shared UI primitives under `frontend/src/components/ui/`. Existing component data flow stays intact; current API calls, state, and local storage behavior should not change.
