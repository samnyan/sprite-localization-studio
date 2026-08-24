# Repository Guidelines

## Project Structure & Module Organization

Application code lives in `src/`. Keep framework setup, routing, Pinia stores, i18n, and composables in `src/app/`; pure TypeScript models in `src/domain/`; use cases and ports in `src/application/`; and browser or renderer adapters in `src/infrastructure/`. Vue UI belongs in `src/components/` and route-level screens in `src/views/`. Static assets go in `public/`. Tests are colocated in `__tests__/` directories and use the `*.spec.ts` suffix.

Dependencies should flow from UI to application to domain. Domain code must not import Vue, browser APIs, or infrastructure implementations.

## Build, Test, and Development Commands

- `pnpm install` installs the locked dependencies. Use the Node version declared in `package.json`.
- `pnpm dev` starts the Vite development server.
- `pnpm type-check` runs `vue-tsc` across application and test projects.
- `pnpm test:unit --run` runs the Vitest suite once; omit `--run` for watch mode.
- `pnpm lint` runs oxlint and ESLint with fixes.
- `pnpm format` formats `src/` with oxfmt.
- `pnpm build` performs type checking and creates the production bundle.

Run type checking, tests, lint, and build before requesting review.

## Coding Style & Naming Conventions

Use TypeScript and Vue `<script setup>`. Follow `.editorconfig`: two-space indentation, LF endings, final newlines, and a 100-character target line length. oxfmt enforces single quotes and no semicolons. Name Vue components in PascalCase, composables as `useFeature`, stores as `useFeatureStore`, and tests as `Feature.spec.ts`.

Reuse Tailwind, shadcn-vue patterns, Lucide, Pinia, Router, and vue-i18n before adding custom infrastructure. Put user-facing strings in the separate locale files under `src/app/i18n/locales/`.

## Testing Guidelines

Vitest, Vue Test Utils, and jsdom are the standard stack. Add focused tests for domain invariants, storage safety, persisted preferences, and visible UI behavior. No coverage threshold is configured; prioritize meaningful regression coverage.

## Commit & Pull Request Guidelines

The repository currently has only the `Init` commit, so no established convention exists. Use concise imperative messages, preferably scoped Conventional Commits such as `feat(workspace): add project menu`. Keep commits focused. Pull requests should summarize behavior, list verification commands, link relevant issues, and include screenshots for UI changes in affected languages and themes.

## Product UI & Comments

Treat this as desktop engineering software, not a marketing website. Keep UI copy short and operational. Never expose requirements or implementation reasoning in the interface. Comments should briefly describe functionality only; do not add change-history narratives or essay-style rationale.
