import express from 'express';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { loadConfig, resolvePath } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cfg = loadConfig();
const dist = path.join(__dirname, 'dist');

const backendHttps = cfg.server.httpsEnabled && fs.existsSync(resolvePath(cfg.server.httpsCert));
const backendTarget = `${backendHttps ? 'https' : 'http'}://${cfg.server.host}:${backendHttps ? cfg.server.httpsPort : cfg.server.port}`;

const app = express();

app.use(
  createProxyMiddleware({
    target: backendTarget,
    changeOrigin: true,
    secure: false,
    pathFilter: '/api',
  })
);

if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('/', (req, res) =>
    res
      .status(200)
      .send('Dashboard not built. Run: npm run build:web')
  );
}

const host = cfg.frontend.host;

http.createServer(app).listen(cfg.frontend.port, host, () => {
  console.log(`Frontend     (HTTP) : http://${host}:${cfg.frontend.port}  -> API ${backendTarget}`);
});

if (cfg.frontend.httpsEnabled) {
  const keyPath = resolvePath(cfg.frontend.httpsKey);
  const certPath = resolvePath(cfg.frontend.httpsCert);
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const tls = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
    https.createServer(tls, app).listen(cfg.frontend.httpsPort, host, () => {
      console.log(`Frontend    (HTTPS) : https://${host}:${cfg.frontend.httpsPort}  -> API ${backendTarget}`);
    });
  } else {
    console.log(`Frontend    (HTTPS) : skipped - cert files not found (${cfg.frontend.httpsKey})`);
  }
}
