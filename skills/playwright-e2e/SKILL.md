---
name: playwright-e2e
description: Design, implement, review, or refactor Playwright end-to-end tests in TypeScript. Use when requests mention Playwright, browser E2E, user journeys, login flows, HTML reports, test steps, Page Object Models, fixtures, selectors, traces, or happy/unhappy paths.
---

# Playwright E2E

Build tests users can read and maintain. Keep test cases about business behavior; put browser mechanics in page or domain objects.

## Inspect first

1. Read repository test instructions, Playwright config, existing fixtures, and the target route/component.
2. Reuse an existing fixture or page object before creating one.
3. Identify the smallest user-visible postcondition. Do not assert implementation details, CSS classes, or incidental copy.
4. Make every case independent. Prepare data through a fixture, factory, repository, or API; reserve UI setup for the behavior under test.

## Design hierarchy

Use this report hierarchy:

```text
domain → logical group → happy | unhappy → meaningful action steps
AUTH   → 로그인       → happy            → 로그인 → 홈 확인
BO     → 관리자 관리  → unhappy          → 권한 그룹 누락 → 저장 차단 확인
```

- Use `test.describe` for a domain and logical group.
- Keep one outcome per test. Do not make a login → department → member → admin chain whose later failures hide the first cause.
- Use `test.step()` only for a meaningful user action or checkpoint, not every click and fill.
- Add a short `test.info().annotations` description when the HTML report needs business context.

## Separate intent from browser mechanics

Tests should read like this:

```ts
test('happy — 기존 사용자를 관리자로 지정한다', async ({ admin, userFactory }) => {
  const member = await userFactory.activeMember();

  await test.step('권한 그룹과 함께 관리자 지정', () =>
    admin.admins.promote(member, '전체 관리자')
  );
  await expect(admin.admins.row(member.email)).toBeVisible();
});
```

Implement `admin.admins.promote()` in a page/domain object. It owns navigation, locators, dialog transitions, and form details. Its public method names describe business actions and return domain data where useful.

Use a screen object for one page and a domain facade when a workflow spans multiple pages. Do not create a universal `BasePage`, assertion-only wrapper, or a page object for one-off trivial navigation.

## Locator contract

Prioritize, in order:

1. `getByRole` with an accessible name for controls and headings.
2. `getByLabel`, `getByPlaceholder`, or `getByText` when that is the user contract.
3. A stable, narrowly scoped `data-testid` for composite widgets that have no reliable accessible contract.

Chain and filter locators from a dialog, row, card, or region to avoid ambiguous global matches. Do not use CSS/XPath structure, `nth()`, sleeps, or `waitForTimeout()` as synchronization. Use web-first `expect` assertions and URL/visible-state postconditions.

## Fixtures and state

- Reuse authenticated storage state for normal app tests; use a blank storage state only for login and unauthenticated gates.
- Put deterministic test-data creation in fixtures/factories. Give every mutable natural key a unique value.
- Do not let one test consume data created by another. Shared DB suites must tolerate parallel workers.
- Stub only dependencies the product does not control. Keep assertions against the application’s own UI and persisted outcome.

## Evidence and debugging

- Configure an HTML reporter for stakeholder-readable runs and keep `test.step` names concise.
- Capture screenshots and trace on failure. Use the trace or Playwright inspector to fix a locator; do not copy raw codegen scripts into the suite.
- Run the new spec first, then the affected E2E set. Run static checks required by the repository.
- Report the exact command, passed/failed/skipped counts, and the location of any failure evidence.

`test.step` enriches the Playwright report; it does not display a production in-app overlay. A live overlay is a separate product feature and must not be injected into production merely to explain test execution.
