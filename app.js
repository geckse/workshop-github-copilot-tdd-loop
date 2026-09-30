(() => {
  'use strict';
  const Store = window.FolioStore;
  const $ = (selector) => document.querySelector(selector);
  const storage = { getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
  const loaded = Store.load(storage);
  let state = loaded.state;
  let storageBlocked = Boolean(loaded.error);
  let editingTaskId = null;
  let draftColumns = [];
  let view = 'board';
  let query = '';
  let priorityFilter = 'all';
  let toastTimer;
  let undoAction = null;
  let draggedTaskId = null;
  let dropDestination = null;
  let ignoreClicksUntil = 0;
  let touchDrag = null;
  let dragPoint = null;
  let scrollFrame = null;

  const escape = (text) => String(text).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const icon = (name, className = '') => `<svg class="icon ${className}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

  function storageWarning(message, recovery = false) {
    const warning = $('#storage-warning');
    warning.replaceChildren(document.createTextNode(message));
    warning.hidden = false;
    $('#save-status').classList.add('unsaved');
    $('#save-status').innerHTML = '<span class="saved-dot"></span>Not saved';
    if (recovery) {
      const backup = document.createElement('button');
      backup.textContent = 'Download saved data';
      backup.addEventListener('click', () => {
        try { download(storage.getItem(Store.STORAGE_KEY) || '{}', 'folio-saved-data.json'); }
        catch { showToast('Browser storage is unavailable.'); }
      });
      const reset = document.createElement('button');
      reset.textContent = 'Replace saved data with this board';
      reset.addEventListener('click', () => { storageBlocked = false; persist(); });
      warning.append(backup, reset);
    }
  }

  function persist() {
    if (storageBlocked) return;
    try {
      Store.save(storage, state);
      $('#save-status').classList.remove('unsaved');
      $('#save-status').innerHTML = '<span class="saved-dot"></span>Saved locally';
      $('#storage-warning').hidden = true;
    } catch {
      storageWarning('This browser couldn’t save your changes. Your board is available until you close this page. Export it to keep a copy.');
    }
  }

  function commit(next, message, undo = null) {
    state = next;
    persist();
    render();
    if (message) showToast(message, undo);
  }

  function showToast(message, undo = null) {
    clearTimeout(toastTimer);
    $('#toast > span').textContent = message;
    $('#toast').hidden = false;
    $('#undo-action').hidden = !undo;
    undoAction = undo;
    toastTimer = setTimeout(hideToast, undo ? 12000 : 4500);
  }

  function hideToast() { $('#toast').hidden = true; undoAction = null; clearTimeout(toastTimer); }
  $('#dismiss-toast').addEventListener('click', hideToast);
  $('#undo-action').addEventListener('click', () => { const action = undoAction; hideToast(); action?.(); });

  function priorityMarkup(priority) {
    return `<span class="priority priority-${priority}"><span class="priority-bars" aria-hidden="true"><i></i><i></i><i></i></span>${capitalize(priority)}</span>`;
  }

  function dueMarkup(task, complete) {
    if (complete) return `<span class="completion-mark">${icon('circle-check')}Done</span>`;
    if (!task.due) return '';
    const today = Store.dateString(new Date());
    const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = Store.dateString(tomorrowDate);
    const date = new Date(`${task.due}T12:00:00`);
    const label = task.due === today ? 'Today' : task.due === tomorrow ? 'Tomorrow' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) }).format(date);
    const className = task.due === today ? 'today' : task.due < today ? 'overdue' : '';
    return `<span class="due-date ${className}" title="${escape(task.due)}${task.due < today ? ' — overdue' : ''}">${icon('calendar')}${escape(label)}</span>`;
  }

  function taskCard(task, complete) {
    const tagClass = ['personal', 'work', 'learning', 'ideas'].includes(task.tag.toLowerCase()) ? `tag-${task.tag.toLowerCase()}` : '';
    return `<article class="task-card${complete ? ' is-complete' : ''}" data-task-id="${escape(task.id)}" draggable="true" tabindex="0" role="button" aria-label="Edit task: ${escape(task.title)}"><div class="card-top">${task.tag ? `<span class="tag ${tagClass}">${escape(task.tag)}</span>` : '<span></span>'}<span class="drag-handle" title="Drag to move. Open the task to change status with your keyboard." aria-hidden="true">${icon('grip')}</span></div><h3>${escape(task.title)}</h3>${task.description ? `<p class="task-description">${escape(task.description)}</p>` : ''}<div class="card-footer">${priorityMarkup(task.priority)}${dueMarkup(task, complete)}</div></article>`;
  }

  function render() {
    const tasks = Store.visibleTasks(state, query, priorityFilter);
    const completedIds = new Set(state.columns.filter((column) => column.complete).map((column) => column.id));
    const done = state.tasks.filter((task) => completedIds.has(task.columnId)).length;
    const inProgress = state.tasks.filter((task) => !completedIds.has(task.columnId) && task.columnId !== state.columns[0].id).length;
    const percent = state.tasks.length ? Math.round(done / state.tasks.length * 100) : 0;
    $('#total-count').textContent = state.tasks.length;
    $('#nav-task-count').textContent = state.tasks.length;
    $('#progress-count').textContent = inProgress;
    $('#done-count').textContent = done;
    $('#progress-fill').style.width = `${percent}%`;
    $('#progress-percentage').textContent = `${percent}%`;
    $('.progress-track').setAttribute('aria-valuenow', percent);
    $('#progress-label').textContent = percent === 100 ? 'Look at you. All done!' : percent > 0 ? 'A little progress, every day' : 'Let’s make a little progress';
    $('#board').hidden = view !== 'board';
    $('#task-list').hidden = view !== 'list';
    $('#board-view').classList.toggle('selected', view === 'board');
    $('#list-view').classList.toggle('selected', view === 'list');
    $('#board-view').setAttribute('aria-pressed', view === 'board');
    $('#list-view').setAttribute('aria-pressed', view === 'list');
    $('#filter-summary').hidden = !query.trim() && priorityFilter === 'all';
    $('#filter-summary > span').textContent = `${tasks.length} of ${state.tasks.length} tasks`;

    $('#board').innerHTML = state.columns.map((column) => {
      const columnTasks = tasks.filter((task) => task.columnId === column.id);
      const total = state.tasks.filter((task) => task.columnId === column.id).length;
      return `<section class="kanban-column" data-column-id="${escape(column.id)}" style="--column-color:${column.color}" aria-label="${escape(column.name)}"><header class="column-header"><span class="status-dot"></span><h2 title="${escape(column.name)}">${escape(column.name)}</h2><span class="column-count">${columnTasks.length}</span><div class="column-actions"><button class="icon-button column-settings" aria-label="Edit ${escape(column.name)} column">${icon('more')}</button><button class="icon-button column-new-task" aria-label="Add task to ${escape(column.name)}">${icon('plus')}</button></div></header><div class="column-tasks">${columnTasks.map((task) => taskCard(task, column.complete)).join('') || `<div class="empty-column">${total ? 'No matching tasks' : column.complete ? 'Good things take small steps' : 'A little room for what’s next'}</div>`}</div><button class="column-add-task column-new-task">${icon('plus')}Add task</button></section>`;
    }).join('');

    $('#task-list').innerHTML = `<div class="list-row list-heading" aria-hidden="true"><span>Task</span><span>Status</span><span>Priority</span><span>Due date</span></div>${tasks.length ? state.columns.flatMap((column) => tasks.filter((task) => task.columnId === column.id).map((task) => `<button class="list-row" data-task-id="${escape(task.id)}" aria-label="Edit task: ${escape(task.title)}"><span class="list-task-title${column.complete ? ' done' : ''}">${escape(task.title)}</span><span class="list-status" style="--column-color:${column.color}"><span class="status-dot"></span>${escape(column.name)}</span>${priorityMarkup(task.priority)}${dueMarkup(task, column.complete) || '<span class="due-date">—</span>'}</button>`)).join('') : '<div class="list-empty">No tasks here yet. Make a little room for something new.</div>'}`;
  }

  function openTask(columnId = state.columns[0].id, taskId = null) {
    const task = state.tasks.find((item) => item.id === taskId);
    editingTaskId = task?.id || null;
    $('#task-form').reset();
    $('#task-title').setCustomValidity('');
    $('#task-status').innerHTML = state.columns.map((column) => `<option value="${escape(column.id)}">${escape(column.name)}</option>`).join('');
    $('#task-dialog-title').textContent = task ? 'A little more detail' : 'New task';
    $('#save-task').textContent = task ? 'Save changes' : 'Create task';
    $('#delete-task').hidden = !task;
    $('#task-title').value = task?.title || '';
    $('#task-description').value = task?.description || '';
    $('#task-status').value = task?.columnId || columnId;
    $('#task-priority').value = task?.priority || 'medium';
    $('#task-tag').value = task?.tag || '';
    $('#task-due').value = task?.due || '';
    $('#task-dialog').showModal();
    $('#task-title').focus();
  }

  $('#new-task').addEventListener('click', () => openTask());
  $('#task-title').addEventListener('input', () => $('#task-title').setCustomValidity(''));
  $('#task-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!$('#task-title').value.trim()) { $('#task-title').setCustomValidity('Give this task a name.'); $('#task-title').reportValidity(); return; }
    const values = Object.fromEntries(new FormData(event.target));
    try {
      const next = Store.upsertTask(state, values, editingTaskId);
      $('#task-dialog').close();
      commit(next, editingTaskId ? 'Task updated. A little clearer.' : 'Task added. One step at a time.');
    } catch (error) { $('#task-title').setCustomValidity(error.message); $('#task-title').reportValidity(); }
  });

  $('#delete-task').addEventListener('click', () => {
    const previous = state;
    const next = { ...state, tasks: state.tasks.filter((task) => task.id !== editingTaskId) };
    $('#task-dialog').close();
    commit(next, 'Task deleted.', () => commit(previous, 'Task restored.'));
  });

  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => { if (!document.activeElement || document.activeElement === document.body) $('#new-task').focus({ preventScroll: true }); });
  }
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));

  function openColumns(focusId = null) {
    draftColumns = state.columns.map((column) => ({ ...column }));
    $('#column-error').hidden = true;
    renderColumnEditor();
    $('#columns-dialog').showModal();
    const index = draftColumns.findIndex((column) => column.id === focusId);
    const input = document.querySelectorAll('.column-name')[Math.max(0, index)];
    input?.focus();
    if (focusId) input?.select();
  }

  function renderColumnEditor() {
    $('#column-editor').innerHTML = draftColumns.map((column, index) => `<div class="column-editor-row" data-id="${escape(column.id)}"><div class="column-name-field"><input class="column-color" type="color" value="${column.color}" aria-label="Color for column ${index + 1}"><input class="column-name" value="${escape(column.name)}" required maxlength="40" aria-label="Name for column ${index + 1}" placeholder="Column name"></div><input class="column-complete" type="checkbox" ${column.complete ? 'checked' : ''} aria-label="Column ${index + 1} marks tasks complete"><div class="reorder-buttons"><button type="button" class="icon-button" data-action="up" aria-label="Move column ${index + 1} up" ${index === 0 ? 'disabled' : ''}>${icon('up')}</button><button type="button" class="icon-button" data-action="down" aria-label="Move column ${index + 1} down" ${index === draftColumns.length - 1 ? 'disabled' : ''}>${icon('down')}</button></div><button type="button" class="icon-button" data-action="remove" aria-label="Remove column ${index + 1}" ${draftColumns.length === 1 ? 'disabled' : ''}>${icon('trash')}</button></div>`).join('');
    $('#add-column').disabled = draftColumns.length >= Store.MAX_COLUMNS;
    $('#column-limit').textContent = `${draftColumns.length} of ${Store.MAX_COLUMNS} columns`;
  }

  $('#manage-columns').addEventListener('click', () => openColumns());
  $('#column-editor').addEventListener('input', (event) => {
    const row = event.target.closest('.column-editor-row');
    if (!row) return;
    const column = draftColumns.find((item) => item.id === row.dataset.id);
    if (event.target.matches('.column-name')) column.name = event.target.value;
    if (event.target.matches('.column-color')) column.color = event.target.value;
    if (event.target.matches('.column-complete')) column.complete = event.target.checked;
    $('#column-error').hidden = true;
  });
  $('#column-editor').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const index = draftColumns.findIndex((column) => column.id === button.closest('.column-editor-row').dataset.id);
    const action = button.dataset.action;
    if (action === 'remove' && draftColumns.length > 1) draftColumns.splice(index, 1);
    const target = action === 'up' ? index - 1 : index + 1;
    if (action !== 'remove' && target >= 0 && target < draftColumns.length) [draftColumns[index], draftColumns[target]] = [draftColumns[target], draftColumns[index]];
    renderColumnEditor();
    document.querySelectorAll('.column-name')[Math.max(0, Math.min(action === 'remove' ? index : target, draftColumns.length - 1))]?.focus();
  });
  $('#add-column').addEventListener('click', () => {
    if (draftColumns.length >= Store.MAX_COLUMNS) return;
    let number = draftColumns.length + 1;
    while (draftColumns.some((column) => column.name.toLowerCase() === `new column ${number}`)) number++;
    draftColumns.push({ id: Store.id(), name: `New column ${number}`, color: Store.colors[draftColumns.length % Store.colors.length], complete: false });
    renderColumnEditor();
    const input = document.querySelector('.column-editor-row:last-child .column-name');
    input.focus(); input.select();
  });
  $('#columns-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const previous = state;
      const next = Store.updateColumns(state, draftColumns);
      $('#columns-dialog').close();
      commit(next, 'Your workflow, updated.', () => commit(previous, 'Column changes undone.'));
    } catch (error) { $('#column-error').textContent = error.message; $('#column-error').hidden = false; }
  });

  $('#board').addEventListener('click', (event) => {
    if (Date.now() < ignoreClicksUntil) return;
    const column = event.target.closest('.kanban-column');
    if (event.target.closest('.column-new-task')) openTask(column.dataset.columnId);
    else if (event.target.closest('.column-settings')) openColumns(column.dataset.columnId);
    else { const card = event.target.closest('.task-card'); if (card) openTask(undefined, card.dataset.taskId); }
  });
  $('#board').addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.task-card')) {
      event.preventDefault(); openTask(undefined, event.target.dataset.taskId);
    }
  });
  $('#task-list').addEventListener('click', (event) => {
    const row = event.target.closest('[data-task-id]');
    if (row) openTask(undefined, row.dataset.taskId);
  });
  $('#search').addEventListener('input', (event) => { query = event.target.value; render(); });
  $('#priority-filter').addEventListener('change', (event) => { priorityFilter = event.target.value; render(); });
  function clearFilters() { query = ''; priorityFilter = 'all'; $('#search').value = ''; $('#priority-filter').value = 'all'; render(); }
  $('#clear-filters').addEventListener('click', clearFilters);
  $('#board-view').addEventListener('click', () => { view = 'board'; render(); });
  $('#list-view').addEventListener('click', () => { view = 'list'; render(); });
  $('#nav-board').addEventListener('click', () => { view = 'board'; clearFilters(); });
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); openTask(); }
    if (event.key === '/') { event.preventDefault(); $('#search').focus(); }
  });

  function updateDropTarget(x, y) {
    dragPoint = { x, y };
    document.querySelectorAll('.drop-target').forEach((element) => element.classList.remove('drop-target'));
    document.querySelector('.drop-indicator')?.remove();
    const column = document.elementFromPoint(x, y)?.closest('.kanban-column');
    if (!column) { dropDestination = null; return; }
    column.classList.add('drop-target');
    const container = column.querySelector('.column-tasks');
    const cards = Array.from(container.querySelectorAll('.task-card')).filter((card) => card.dataset.taskId !== draggedTaskId);
    const before = cards.find((card) => { const rect = card.getBoundingClientRect(); return y < rect.top + rect.height / 2; });
    dropDestination = { columnId: column.dataset.columnId, beforeId: before?.dataset.taskId || null };
    const indicator = document.createElement('div'); indicator.className = 'drop-indicator';
    container.insertBefore(indicator, before || null);
  }

  function startDragScroll() {
    cancelAnimationFrame(scrollFrame);
    function scroll() {
      if (!draggedTaskId) return;
      if (dragPoint) {
        const board = $('#board');
        const bounds = board.getBoundingClientRect();
        const { x, y } = dragPoint;
        if (y >= bounds.top && y <= bounds.bottom) {
          const old = board.scrollLeft;
          if (x > bounds.right - 44) board.scrollLeft += 8;
          else if (x < bounds.left + 44) board.scrollLeft -= 8;
          if (board.scrollLeft !== old) updateDropTarget(x, y);
        }
      }
      scrollFrame = requestAnimationFrame(scroll);
    }
    scrollFrame = requestAnimationFrame(scroll);
  }

  function finishDrag(apply = false) {
    const destination = dropDestination;
    const taskId = draggedTaskId;
    const hadDrag = Boolean(taskId);
    touchDrag?.preview?.remove(); touchDrag = null;
    cancelAnimationFrame(scrollFrame); scrollFrame = null; dragPoint = null;
    draggedTaskId = null; dropDestination = null;
    document.querySelectorAll('.dragging, .drop-target').forEach((element) => element.classList.remove('dragging', 'drop-target'));
    document.querySelector('.drop-indicator')?.remove();
    if (hadDrag) ignoreClicksUntil = Date.now() + 350;
    if (apply && taskId && destination) {
      const column = state.columns.find((item) => item.id === destination.columnId);
      commit(Store.moveTask(state, taskId, destination.columnId, destination.beforeId), `Task moved to ${column.name}.`);
      $('#announcer').textContent = `Task moved to ${column.name}.`;
    }
  }

  $('#board').addEventListener('dragstart', (event) => {
    const card = event.target.closest('.task-card');
    if (!card) return;
    draggedTaskId = card.dataset.taskId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedTaskId);
    startDragScroll();
    requestAnimationFrame(() => { if (draggedTaskId) card.classList.add('dragging'); });
  });
  $('#board').addEventListener('dragover', (event) => {
    if (!draggedTaskId) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move'; updateDropTarget(event.clientX, event.clientY);
  });
  $('#board').addEventListener('drop', (event) => {
    if (!draggedTaskId) return;
    event.preventDefault(); updateDropTarget(event.clientX, event.clientY); finishDrag(true);
  });
  $('#board').addEventListener('dragend', () => finishDrag());

  $('#board').addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' || !event.target.closest('.drag-handle')) return;
    const card = event.target.closest('.task-card');
    event.preventDefault();
    const rect = card.getBoundingClientRect();
    const preview = card.cloneNode(true);
    preview.removeAttribute('data-task-id'); preview.removeAttribute('tabindex'); preview.setAttribute('aria-hidden', 'true');
    preview.classList.add('drag-preview'); preview.style.width = `${rect.width}px`;
    preview.style.left = `${rect.left}px`; preview.style.top = `${rect.top}px`;
    document.body.append(preview);
    draggedTaskId = card.dataset.taskId;
    touchDrag = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, preview };
    card.classList.add('dragging');
    $('#board').setPointerCapture(event.pointerId);
    updateDropTarget(event.clientX, event.clientY);
    startDragScroll();
  });
  $('#board').addEventListener('pointermove', (event) => {
    if (!touchDrag || event.pointerId !== touchDrag.pointerId) return;
    event.preventDefault();
    touchDrag.preview.style.left = `${event.clientX - touchDrag.offsetX}px`;
    touchDrag.preview.style.top = `${event.clientY - touchDrag.offsetY}px`;
    updateDropTarget(event.clientX, event.clientY);
  });
  $('#board').addEventListener('pointerup', (event) => { if (touchDrag && event.pointerId === touchDrag.pointerId) finishDrag(true); });
  $('#board').addEventListener('pointercancel', () => { if (touchDrag) finishDrag(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && touchDrag) finishDrag(); });

  function download(contents, filename) {
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  for (const button of [$('#export-button'), $('#mobile-export')]) button.addEventListener('click', () => { download(JSON.stringify(state, null, 2), `folio-board-${Store.dateString(new Date())}.json`); showToast('A little backup, just in case.'); });
  window.addEventListener('storage', (event) => {
    if (event.key !== Store.STORAGE_KEY || !event.newValue || document.querySelector('dialog[open]') || draggedTaskId) return;
    try { state = Store.validate(JSON.parse(event.newValue)); storageBlocked = false; render(); hideToast(); showToast('Board updated from another tab.'); }
    catch { /* Keep the current valid board when another tab writes invalid data. */ }
  });

  render();
  if (loaded.error) storageWarning('Your saved board couldn’t be loaded and has been left untouched. This temporary board will not be saved until you choose to replace it.', true);
  else persist();
})();
