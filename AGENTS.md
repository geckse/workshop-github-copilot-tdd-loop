# Development instructions

These instructions apply throughout this repository. Read `CLAUDE.md` for additional task instructions if it exists.

## Test-driven development

Use [.github/skills/test-driven-development/SKILL.md](.github/skills/test-driven-development/SKILL.md) when adding features, fixing bugs, or changing behavior.

1. Identify the expected behavior and relevant edge cases before implementation. If requirements, acceptance criteria, or edge-case outcomes are too vague or unclear, ask the user focused questions before implementing the affected behavior. Revisit this whenever ambiguity emerges during implementation; do not silently invent product requirements.
2. **Red:** Write one test for the next behavior before changing production code. Run it and verify it fails because the behavior is missing, not because of a broken test or environment. For bugs, first write a regression test that reproduces the defect.
3. **Green:** Make the smallest production change that passes the test. Run the affected tests and keep existing tests passing. Do not skip, disable, or weaken tests to get a green result.
4. **Refactor:** Improve the implementation without changing behavior, rerunning affected tests after each step. Repeat the cycle for each remaining behavior and agreed edge case.

Use the existing test frameworks: Node.js `node:test` for board operations and Playwright for browser behavior. Pure refactoring starts with passing tests; documentation-only changes do not need artificial failing tests.

## Required test runs

Tests are part of the development lifecycle, not an optional final step. Run the existing suites before implementation to establish a baseline, the relevant tests during each TDD cycle, and both suites before declaring work complete:

```sh
npm test
npm run test:browser
```

If browser test tooling is missing, install it with `npm ci` and `npx playwright install chromium`. Playwright starts the local server automatically.

Report the commands run and their outcomes when handing work back. If a suite cannot run, state the blocker and what remains unverified; never claim unrun tests passed. Identify baseline failures separately from regressions introduced by the change.
