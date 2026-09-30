const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);
const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']],
  ['/store.js', ['store.js', 'text/javascript']],
  ['/app.js', ['app.js', 'text/javascript']],
]);

http.createServer((request, response) => {
  const file = files.get(new URL(request.url, 'http://localhost').pathname);
  if (!file) { response.writeHead(404); response.end('Not found'); return; }
  response.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
  fs.createReadStream(path.join(root, file[0])).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`Folio is ready at http://127.0.0.1:${port}`));
