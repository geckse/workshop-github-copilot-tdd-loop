---
name: test-driven-development
description: Apply test-driven development when adding features, fixing bugs, or changing behavior. Clarify ambiguous requirements and edge cases, then work one failing test at a time through red, green, and refactor using the repository's existing test tools.
license: MIT
---

# Test-driven development

## Establish the behavior

Read the repository instructions and relevant code and tests. Derive acceptance criteria from the user's request and any supplied issue or task context. Run existing tests to establish a baseline.

Identify relevant boundaries and failure paths, such as empty or invalid inputs, limits, missing records, and persistence failures. If the expected result is unclear, ask the user a focused question with concrete examples or possible outcomes before implementing that behavior. Ask again if new ambiguity emerges during implementation. Continue independent work whose requirements are clear.

## Red: one failing test

- Pick the smallest unimplemented behavior or agreed edge case.
- Write one behavior-focused test using the existing framework and Arrange / Act / Assert structure. For a bug fix, reproduce the reported defect first.
- Run the test before editing production code. Confirm that it fails because the expected behavior is missing, rather than a syntax error, invalid setup, or unavailable dependency.
- If it already passes, investigate whether the behavior exists or the test fails to exercise the intended path.

## Green: minimal implementation

- Make the smallest change that satisfies the failing test and acceptance criteria.
- Keep changes within the current requirement; let further tests drive additional behavior.
- Run the new test and affected existing tests. Do not disable or weaken tests to make them pass.
- If the expected behavior in the test appears wrong, resolve the requirement before changing it.

## Refactor: preserve behavior

- Start with green tests. Improve names, remove duplication, or simplify structure in small steps.
- Run affected tests after each step. Fix or revert a refactoring step that introduces a failure before proceeding.
- Treat new validation or error-handling behavior as another red–green–refactor cycle.
- Repeat the cycle one test at a time until the acceptance criteria and agreed edge cases are covered.

## Verify completion

Run all test suites required by `AGENTS.md`. For this repository, use `npm test` for Node.js unit tests and `npm run test:browser` for Playwright browser tests. Report results, baseline failures, and any blockers or unverified behavior explicitly.

Documentation-only changes do not require an artificial red phase. For pure refactoring, establish passing coverage before changing structure.

## Upstream source

Adapted from the following MIT-licensed agents in [github/awesome-copilot](https://github.com/github/awesome-copilot), pinned to revision `e62be9667aff87958ed94bee2b396433897d1529`:

- [TDD Red Phase](https://github.com/github/awesome-copilot/blob/e62be9667aff87958ed94bee2b396433897d1529/agents/tdd-red.agent.md)
- [TDD Green Phase](https://github.com/github/awesome-copilot/blob/e62be9667aff87958ed94bee2b396433897d1529/agents/tdd-green.agent.md)
- [TDD Refactor Phase](https://github.com/github/awesome-copilot/blob/e62be9667aff87958ed94bee2b396433897d1529/agents/tdd-refactor.agent.md)

Upstream publishes this workflow as agents rather than a standalone skill. This adaptation combines the phases, uses this repository's test tools, and asks for clarification when requirements or edge cases are unclear. It does not require a GitHub issue or authorize issue updates. The upstream license is included in [LICENSE](LICENSE).
