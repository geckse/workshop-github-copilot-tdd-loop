const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { STORAGE_KEY } = require('../../store.js');

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('task creation, editing, deletion, and undo persist after reload', async ({ page }) => {
  await page.getByRole('button', { name: 'New task', exact: false }).click();
  await page.getByLabel('Task name').fill('Ship my first task');
  await page.getByLabel('Description').fill('All the details stay in my browser.');
  await page.locator('#task-status').selectOption('progress');
  await page.locator('#task-priority').selectOption('high');
  await page.getByLabel('Label', { exact: false }).fill('Work');
  await page.getByLabel('Due date', { exact: false }).fill('2026-12-31');
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  await expect(page.locator('[data-column-id="progress"]')).toContainText('Ship my first task');
  await page.reload();
  await page.getByRole('button', { name: 'Edit task: Ship my first task', exact: true }).click();
  await expect(page.getByLabel('Description')).toHaveValue('All the details stay in my browser.');
  await expect(page.locator('#task-priority')).toHaveValue('high');
  await expect(page.locator('#task-due')).toHaveValue('2026-12-31');
  await page.getByLabel('Task name').fill('Finish the app');
  await page.locator('#task-status').selectOption('done');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('[data-column-id="done"]')).toContainText('Finish the app');
  await page.getByRole('button', { name: 'Edit task: Finish the app', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('#board')).not.toContainText('Finish the app');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.reload();
  await expect(page.locator('[data-column-id="done"]')).toContainText('Finish the app');
});

test('native drag and drop moves and reorders cards, including an empty column', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.locator('#manage-columns').click();
  await page.getByRole('button', { name: 'Add a column', exact: true }).click();
  await page.getByLabel('Name for column 5', { exact: true }).fill('Later');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  const later = page.getByRole('region', { name: 'Later', exact: true });
  const source = page.locator('[data-column-id="todo"] .task-card').first();
  const id = await source.getAttribute('data-task-id');
  await source.dragTo(later.locator('.column-tasks'));
  await expect(later.locator('.task-card')).toHaveCount(1);
  await expect(later.locator('.task-card')).toHaveAttribute('data-task-id', id);
  const todo = page.locator('[data-column-id="todo"]');
  const last = todo.locator('.task-card').last();
  const lastId = await last.getAttribute('data-task-id');
  await last.dragTo(todo.locator('.task-card').first(), { targetPosition: { x: 20, y: 5 } });
  await expect(todo.locator('.task-card').first()).toHaveAttribute('data-task-id', lastId);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Later', exact: true }).locator('.task-card')).toHaveAttribute('data-task-id', id);
  await expect(page.locator('[data-column-id="todo"] .task-card').first()).toHaveAttribute('data-task-id', lastId);
});

test('column names, colors, order, completion, and safe removal are saved', async ({ page }) => {
  const originalCount = await page.locator('.task-card').count();
  await page.locator('#manage-columns').click();
  await page.getByLabel('Name for column 1', { exact: true }).fill('Backlog');
  await page.getByLabel('Color for column 1', { exact: true }).fill('#2255aa');
  await page.getByRole('button', { name: 'Move column 1 down', exact: true }).click();
  await expect(page.getByLabel('Name for column 2', { exact: true })).toHaveValue('Backlog');
  await page.getByRole('button', { name: 'Remove column 3', exact: true }).click();
  await page.getByRole('button', { name: 'Add a column', exact: true }).click();
  await page.getByLabel('Name for column 4', { exact: true }).fill('Archived');
  await page.getByLabel('Column 4 marks tasks complete', { exact: true }).check();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.reload();
  await expect(page.locator('.task-card')).toHaveCount(originalCount);
  await expect(page.locator('.column-header h2')).toHaveText(['In progress', 'Backlog', 'Done', 'Archived']);
  await expect(page.locator('[data-column-id="todo"]')).toHaveAttribute('style', '--column-color:#2255aa');
  await expect(page.locator('[data-column-id="progress"] .task-card')).toHaveCount(3);
  await page.locator('#manage-columns').click();
  await expect(page.getByLabel('Column 4 marks tasks complete')).toBeChecked();
  await page.getByLabel('Name for column 4', { exact: true }).fill('  backlog  ');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('#column-error')).toContainText('different name');
});

test('dragging at the board edge reveals columns outside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 1000 });
  await page.locator('#manage-columns').click();
  await page.getByRole('button', { name: 'Add a column', exact: true }).click();
  await page.getByLabel('Name for column 5', { exact: true }).fill('Later');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  const source = page.locator('[data-column-id="todo"] .task-card').first();
  const id = await source.getAttribute('data-task-id');
  const sourceBox = await source.boundingBox();
  const boardBox = await page.locator('#board').boundingBox();
  await page.mouse.move(sourceBox.x + 60, sourceBox.y + 60);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + 80, sourceBox.y + 60, { steps: 4 });
  await page.mouse.move(boardBox.x + boardBox.width - 8, sourceBox.y + 60, { steps: 8 });
  await expect.poll(() => page.locator('#board').evaluate((element) => element.scrollWidth - element.clientWidth - element.scrollLeft)).toBeLessThan(2);
  const targetBox = await page.getByRole('region', { name: 'Later', exact: true }).locator('.column-tasks').boundingBox();
  await page.mouse.move(targetBox.x + 70, targetBox.y + 35, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('region', { name: 'Later', exact: true }).locator('.task-card')).toHaveAttribute('data-task-id', id);
});

test('search, priority filtering, list view, and keyboard editing work together', async ({ page }) => {
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.getByRole('searchbox').fill('personal');
  await page.getByLabel('Filter by priority').selectOption('high');
  await expect(page.locator('.task-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.locator('#task-list .list-row[data-task-id]')).toHaveCount(1);
  await page.locator('#task-list .list-row[data-task-id]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#task-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('#task-list .list-row[data-task-id]')).toHaveCount(8);
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await page.locator('.task-card').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#task-dialog')).toBeVisible();
});

test('untrusted task and column names render as text', async ({ page }) => {
  await page.getByRole('button', { name: 'New task' }).click();
  await page.getByLabel('Task name').fill('<img src=x onerror="window.injected=true">');
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  await expect(page.locator('#board')).toContainText('<img src=x onerror="window.injected=true">');
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.locator('#board img')).toHaveCount(0);
});

test('corrupt saved data is preserved and storage failures are visible', async ({ page }) => {
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), STORAGE_KEY);
  await page.reload();
  await expect(page.locator('#storage-warning')).toContainText('left untouched');
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe('{broken');
  await page.getByRole('button', { name: 'Replace saved data with this board' }).click();
  await expect(page.locator('#storage-warning')).toBeHidden();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'New task' }).click();
  await page.getByLabel('Task name').fill('Still usable without storage');
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  await expect(page.locator('#storage-warning')).toContainText('couldn’t save');
  await expect(page.locator('#save-status')).toContainText('Not saved');
  await expect(page.locator('#board')).toContainText('Still usable without storage');
});

test('runs directly from the file system without network requests', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
  await expect(page.locator('.kanban-column')).toHaveCount(4);
  await page.getByRole('button', { name: 'New task' }).click();
  await page.getByLabel('Task name').fill('Works directly from a file');
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  await page.reload();
  await expect(page.locator('#board')).toContainText('Works directly from a file');
  expect(requests).toEqual([]);
});

test('mobile layout fits and supports touch dragging', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const firstCard = page.locator('[data-column-id="todo"] .task-card').first();
  const taskId = await firstCard.getAttribute('data-task-id');
  const handleBox = await firstCard.locator('.drag-handle').boundingBox();
  const client = await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: handleBox.x + 10, y: handleBox.y + 10 }] });
  await page.locator('#board').evaluate((element) => { element.scrollLeft = 290; });
  const targetBox = await page.locator('[data-column-id="progress"] .column-header').boundingBox();
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: targetBox.x + 50, y: targetBox.y + 20 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator(`[data-column-id="progress"] [data-task-id="${taskId}"]`)).toHaveCount(1);
  await page.reload();
  await expect(page.locator(`[data-column-id="progress"] [data-task-id="${taskId}"]`)).toHaveCount(1);
  await page.locator('#manage-columns').tap();
  await expect(page.locator('#columns-dialog')).toBeVisible();
  expect(await page.locator('#columns-dialog').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await context.close();
});
