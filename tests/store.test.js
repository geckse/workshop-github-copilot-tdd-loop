const test = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../store.js');

function memoryStorage(initial) {
  const values = new Map(initial);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('saving and reloading preserves task order, columns, and every task field', () => {
  const storage = memoryStorage();
  let state = Store.initialBoard();
  state = Store.upsertTask(state, { title: '  Ship the board  ', description: 'Keep it simple', tag: 'Work', priority: 'high', due: '2026-10-02', columnId: 'todo' });
  state = Store.moveTask(state, state.tasks.at(-1).id, 'done', state.tasks.find((task) => task.columnId === 'done').id);
  Store.save(storage, state);
  assert.deepEqual(Store.load(storage), { state, error: null });
  assert.equal(state.tasks.find((task) => task.title === 'Ship the board').columnId, 'done');
});

test('dragging supports reordering, moving into empty columns, and invalid drops', () => {
  const state = Store.initialBoard();
  const todo = state.tasks.filter((task) => task.columnId === 'todo');
  const reordered = Store.moveTask(state, todo[2].id, 'todo', todo[0].id);
  assert.deepEqual(reordered.tasks.filter((task) => task.columnId === 'todo').map((task) => task.id), [todo[2].id, todo[0].id, todo[1].id]);
  const extra = Store.updateColumns(state, [...state.columns, { id: 'empty', name: 'Later', color: '#123456', complete: false }]);
  const moved = Store.moveTask(extra, todo[0].id, 'empty');
  assert.equal(moved.tasks.filter((task) => task.columnId === 'empty').length, 1);
  assert.equal(Store.moveTask(state, todo[0].id, 'missing'), state);
  assert.equal(Store.moveTask(state, todo[0].id, 'todo', todo[0].id), state);
  assert.equal(state.tasks[0].columnId, 'todo', 'original state is unchanged');
});

test('removing a populated column preserves its tasks in the first remaining column', () => {
  const state = Store.initialBoard();
  const columns = [{ ...state.columns[2], name: 'Quality check', color: '#112233' }, { ...state.columns[3], complete: false }];
  const updated = Store.updateColumns(state, columns);
  assert.equal(updated.tasks.length, state.tasks.length);
  assert.deepEqual(updated.columns, columns);
  assert.ok(updated.tasks.every((task) => columns.some((column) => column.id === task.columnId)));
  assert.equal(updated.tasks.find((task) => task.id === state.tasks[0].id).columnId, 'review');
  assert.throws(() => Store.updateColumns(state, []), /at least one/);
  assert.throws(() => Store.updateColumns(state, [columns[0], { ...columns[1], name: ' Quality CHECK ' }]), /different name/);
});

test('empty boards remain empty after reload', () => {
  const storage = memoryStorage();
  const state = { ...Store.initialBoard(), tasks: [] };
  Store.save(storage, state);
  assert.equal(Store.load(storage).state.tasks.length, 0);
});

test('corrupt or inaccessible storage is reported without overwriting saved data', () => {
  const storage = memoryStorage([[Store.STORAGE_KEY, '{broken']]);
  assert.ok(Store.load(storage).error);
  assert.equal(storage.getItem(Store.STORAGE_KEY), '{broken');
  assert.ok(Store.load({ getItem() { throw new Error('Access denied'); } }).error);
  assert.throws(() => Store.save({ setItem() { throw new Error('Quota exceeded'); } }, Store.initialBoard()), /Quota exceeded/);
});

test('combined search and priority filters match descriptions and labels', () => {
  const state = Store.initialBoard();
  assert.equal(Store.visibleTasks(state, '  PERSONAL  ', 'high').length, 1);
  assert.equal(Store.visibleTasks(state, 'small, doable', 'high')[0].title, 'Bring a new project to life');
  assert.equal(Store.visibleTasks(state, 'no such task').length, 0);
});

test('validation rejects invalid dates and missing status references', () => {
  const state = Store.initialBoard();
  assert.throws(() => Store.upsertTask(state, { ...state.tasks[0], due: '2026-02-30' }), /due date/);
  assert.throws(() => Store.upsertTask(state, { ...state.tasks[0], columnId: 'missing' }), /missing column/);
  assert.throws(() => Store.upsertTask(state, { ...state.tasks[0], title: '   ' }), /Task names/);
});
