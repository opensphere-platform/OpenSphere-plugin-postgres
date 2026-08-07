const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const PLUGIN_DIR = process.env.PLUGIN_DIR || '/plugins';
const VERSION = process.env.APP_VERSION || '0.1.0';

function text(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type });
  res.end(body);
}
function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function cliManifest() {
  return {
    kind: 'OpenSphereCLICommandManifest',
    cli: { commandPrefix: 'os postgres' },
    tools: [{
      id: 'postgres.runtime', command: 'os postgres runtime', method: 'GET', path: '/cli/runtime',
      params: [], risk: 'low', scope: 'read', description: 'PostgreSQL UI plugin runtime status'
    }]
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/healthz' || url.pathname === '/readyz') return text(res, 200, 'ok');
  if (url.pathname === '/metrics') {
    return text(res, 200, `# HELP opensphere_postgres_plugin_up PostgreSQL plugin runtime up\n# TYPE opensphere_postgres_plugin_up gauge\nopensphere_postgres_plugin_up{plugin="postgres",version="${VERSION}"} 1\n`, 'text/plain; version=0.0.4');
  }
  if (url.pathname === '/cli/manifest') return json(res, 200, cliManifest());
  if (url.pathname === '/cli/runtime') return json(res, 200, { plugin: 'postgres', version: VERSION, ready: true });
  if (url.pathname === '/manual/postgresql-operations.ko.md') {
    return fs.createReadStream(path.join(PLUGIN_DIR, 'postgresql-operations.ko.md'))
      .on('error', () => text(res, 404, 'manual not found'))
      .pipe(res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' }));
  }
  if (url.pathname === '/plugins' || url.pathname === '/plugins/') {
    const files = fs.existsSync(PLUGIN_DIR) ? fs.readdirSync(PLUGIN_DIR).filter((name) => !name.startsWith('.')) : [];
    return json(res, 200, { plugins: files });
  }
  if (url.pathname.startsWith('/plugins/')) {
    const file = path.basename(url.pathname);
    const target = path.join(PLUGIN_DIR, file);
    if (!file || !fs.existsSync(target) || !fs.statSync(target).isFile()) return text(res, 404, 'plugin not found');
    const type = file.endsWith('.js') ? 'text/javascript; charset=utf-8'
      : file.endsWith('.css') ? 'text/css; charset=utf-8'
      : file.endsWith('.json') ? 'application/json; charset=utf-8'
      : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    return fs.createReadStream(target).pipe(res);
  }
  return text(res, 404, 'not found');
});

server.listen(PORT, () => console.log(`opensphere-plugin-postgres v${VERSION} listening :${PORT}`));
