const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_FILE = path.join(ROOT, 'data.js');
const PORT = 3000;

function readRecords() {
  if (!fs.existsSync(DATA_FILE)) return [];
  delete require.cache[require.resolve(DATA_FILE)];
  const data = require(DATA_FILE);
  return Array.isArray(data.records) ? data.records : [];
}
function writeRecords(records) {
  const content =
    'module.exports = ' + JSON.stringify({ records }, null, 2) + ';';
  fs.writeFileSync(DATA_FILE, content, 'utf8');
}
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/api/records') {
    try { return send(res, 200, JSON.stringify({ records: readRecords() })); }
    catch (e) { return send(res, 500, JSON.stringify({ error: '读取数据失败' })); }
  }
  if (req.method === 'POST' && url.pathname === '/api/records') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (!Array.isArray(parsed.records)) return send(res, 400, JSON.stringify({ error: '数据格式不正确' }));
        const clean = parsed.records.map(r => {
          if (!r || typeof r.date !== 'string' || !Number.isFinite(Number(r.amount)) || Number(r.amount) <= 0)
            throw new Error('invalid record');
          return { id: String(r.id), date: r.date, amount: Math.round(Number(r.amount) * 100) / 100, createdAt: Number(r.createdAt) || Date.now() };
        });
        writeRecords(clean);
        return send(res, 200, JSON.stringify({ ok: true }));
      } catch (_) { return send(res, 400, JSON.stringify({ error: '保存失败，请检查输入数据' })); }
    });
    return;
  }
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(PUBLIC, requested);
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile())
    return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  const ext = path.extname(file);
  const type = ext === '.html' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
  fs.createReadStream(file).pipe(res.writeHead(200, { 'Content-Type': type }));
});
server.listen(PORT, '127.0.0.1', () => console.log(`加油记录已启动：http://127.0.0.1:${PORT}`));
