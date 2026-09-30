# Folio

A simple, private kanban board. Everything runs in your browser and saves to its local storage. No account, backend, build step, fonts, or external services are needed.

Open **index.html** in a modern browser to get started. A few editable example tasks show how the board works.

For a consistent local URL, run `npm start` and open **http://127.0.0.1:4173**. Node.js 18 or newer is needed only for the optional local file server and development tools. The application itself has no runtime dependencies.

## Your board

- Create, edit, and delete tasks with descriptions, labels, priorities, and due dates. Deleted tasks can be undone for 12 seconds.
- Drag cards between columns or reorder them within a column. On a touch screen, drag a card by its dotted handle. You can also open a task and change its status using the keyboard.
- Use **Columns** to add, rename, color, reorder, or remove status columns. Mark any column as complete to count its tasks toward progress. Tasks from removed columns move to the first remaining column. Keep between 1 and 12 columns.
- Search titles, descriptions, and labels; filter by priority; switch between board and list views.
- Press **N** to create a task, **/** to search, and **Escape** to close an editor.
- Use **Export board** in the desktop sidebar (or the download icon on smaller screens) to download a JSON copy.

Data belongs to the current browser profile and origin. Opening a different address or browser creates a separate board; browsers may also treat local file storage differently. Clearing site data deletes the saved board. If storage is blocked, full, or damaged, the app shows a warning and keeps the current session usable without silently overwriting unreadable data.

## Development

```sh
npm test                     # Data integrity and persistence tests; no install needed
npm install                  # Browser test tools only
npx playwright install chromium
npm run test:browser         # End-to-end tests using Chromium
```

The browser tests cover editing, persistence, deletion and undo, drag and drop, column changes, keyboard controls, filtering, storage errors, direct-file use, and mobile touch dragging.

The app is plain HTML, CSS, and JavaScript. `store.js` contains data validation and immutable board operations; `app.js` handles the interface and browser storage. The optional server in `scripts/serve.js` only serves the four app files and does not receive or store tasks.
