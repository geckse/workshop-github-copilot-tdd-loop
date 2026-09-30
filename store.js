(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FolioStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'folio.board.v1';
  const MAX_COLUMNS = 12;
  const priorities = ['low', 'medium', 'high'];
  const colors = ['#8c95a6', '#9c83e7', '#e4ad57', '#71a991', '#db8398', '#6a9fbe'];
  const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const dateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const validDate = (value) => typeof value === 'string' && (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()) && dateString(new Date(`${value}T12:00:00`)) === value);

  function initialBoard(now = new Date()) {
    const date = (offset) => { const d = new Date(now); d.setDate(d.getDate() + offset); return dateString(d); };
    const columns = [
      { id: 'todo', name: 'To do', color: colors[0], complete: false },
      { id: 'progress', name: 'In progress', color: colors[1], complete: false },
      { id: 'review', name: 'In review', color: colors[2], complete: false },
      { id: 'done', name: 'Done', color: colors[3], complete: true },
    ];
    const task = (columnId, title, description, tag, priority, due = '') => ({ id: id(), columnId, title, description, tag, priority, due, createdAt: now.toISOString() });
    return { version: 1, columns, tasks: [
      task('todo', 'Make room for your next big idea', 'A fresh page, a few possibilities. Write down what you’d love to work on next.', 'Ideas', 'medium', date(2)),
      task('todo', 'Plan the week ahead', 'Pick three things that would make this a good week.', 'Personal', 'high', date(0)),
      task('todo', 'Read something inspiring', 'That article you saved? This is your little reminder.', 'Learning', 'low'),
      task('progress', 'Make this board your own', 'Try renaming a column, changing a color, or adding a stage that fits your flow.', 'Personal', 'medium', date(0)),
      task('progress', 'Bring a new project to life', 'Break it into small, doable steps. Start with the first one.', 'Work', 'high', date(1)),
      task('review', 'Give it a fresh pair of eyes', 'Take a step back. A little polish goes a long way.', 'Work', 'medium', date(1)),
      task('done', 'Find a little space to focus', 'Less noise. More room for the things that matter.', 'Personal', 'low'),
      task('done', 'Take the first small step', 'You’re here. That’s a pretty good start.', 'Personal', 'low'),
    ] };
  }

  function validate(state) {
    if (!state || state.version !== 1 || !Array.isArray(state.columns) || !Array.isArray(state.tasks)) throw new Error('Unrecognized board format.');
    if (!state.columns.length || state.columns.length > MAX_COLUMNS) throw new Error(`A board needs 1–${MAX_COLUMNS} columns.`);
    const columnIds = new Set();
    const names = new Set();
    for (const column of state.columns) {
      if (!column || typeof column.id !== 'string' || !column.id || columnIds.has(column.id)) throw new Error('Column IDs must be unique.');
      if (typeof column.name !== 'string' || !column.name.trim() || column.name.length > 40) throw new Error('Give every column a name of 1–40 characters.');
      if (names.has(column.name.trim().toLowerCase())) throw new Error('Give each column a different name.');
      if (!/^#[\da-f]{6}$/i.test(column.color) || typeof column.complete !== 'boolean') throw new Error('Invalid column settings.');
      columnIds.add(column.id);
      names.add(column.name.trim().toLowerCase());
    }
    const taskIds = new Set();
    for (const task of state.tasks) {
      if (!task || typeof task.id !== 'string' || !task.id || taskIds.has(task.id)) throw new Error('Task IDs must be unique.');
      if (!columnIds.has(task.columnId)) throw new Error('A task refers to a missing column.');
      if (typeof task.title !== 'string' || !task.title.trim() || task.title.length > 160) throw new Error('Task names need 1–160 characters.');
      if (typeof task.description !== 'string' || task.description.length > 3000 || typeof task.tag !== 'string' || task.tag.length > 24) throw new Error('Invalid task details.');
      if (!priorities.includes(task.priority) || (task.due !== '' && !validDate(task.due))) throw new Error('Invalid task priority or due date.');
      taskIds.add(task.id);
    }
    return state;
  }

  function load(storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      return { state: raw === null ? initialBoard() : validate(JSON.parse(raw)), error: null };
    } catch (error) {
      return { state: initialBoard(), error: 'Your saved board could not be loaded. It has been left untouched. Export a backup before continuing.' };
    }
  }

  function save(storage, state) {
    validate(state);
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function upsertTask(state, values, taskId) {
    const previous = state.tasks.find((task) => task.id === taskId);
    const task = { id: previous?.id || id(), createdAt: previous?.createdAt || new Date().toISOString(), columnId: values.columnId, priority: values.priority, due: values.due, title: values.title.trim(), description: values.description.trim(), tag: values.tag.trim() };
    const tasks = previous ? state.tasks.map((item) => item.id === taskId ? task : item) : [...state.tasks, task];
    return validate({ ...state, tasks });
  }

  function moveTask(state, taskId, columnId, beforeId = null) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task || !state.columns.some((column) => column.id === columnId) || taskId === beforeId) return state;
    const tasks = state.tasks.filter((item) => item.id !== taskId);
    const target = tasks.findIndex((item) => item.id === beforeId && item.columnId === columnId);
    const moved = { ...task, columnId };
    if (target === -1) tasks.push(moved);
    else tasks.splice(target, 0, moved);
    return validate({ ...state, tasks });
  }

  function updateColumns(state, columns) {
    if (!columns.length) throw new Error('Keep at least one column on your board.');
    const cleaned = columns.map((column) => ({ ...column, name: column.name.trim() }));
    const ids = new Set(cleaned.map((column) => column.id));
    const tasks = state.tasks.map((task) => ids.has(task.columnId) ? task : { ...task, columnId: cleaned[0].id });
    return validate({ ...state, columns: cleaned, tasks });
  }

  function visibleTasks(state, query = '', priority = 'all') {
    const search = query.trim().toLowerCase();
    return state.tasks.filter((task) => (priority === 'all' || task.priority === priority) && (!search || `${task.title} ${task.description} ${task.tag}`.toLowerCase().includes(search)));
  }

  return { STORAGE_KEY, MAX_COLUMNS, colors, id, dateString, initialBoard, validate, load, save, upsertTask, moveTask, updateColumns, visibleTasks };
});
