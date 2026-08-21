// Server entrypoint - Reloaded 2026-08-20 with Patron Registration Routes
import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignore DNS config failure
}

import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createExpressApp, initializeBackend } from './app.js';
import { ENV } from './config/env.js';

const getFrontendDir = () => {
  const cwd = process.cwd();
  if (cwd.endsWith('frontend')) {
    return cwd;
  }
  if (cwd.endsWith('backend')) {
    return path.resolve(cwd, '../frontend');
  }
  return path.resolve(cwd, 'frontend');
};

const frontendDir = getFrontendDir();

async function startServer() {
  const app = createExpressApp();
  const PORT = Number(ENV.PORT) || 5000;

  // Serve static assets from frontend/dist if available
  const distPath = path.resolve(frontendDir, 'dist');
  try {
    const fs = await import('fs');
    if (fs.existsSync(distPath)) {
      const express = (await import('express')).default;
      app.use(express.static(distPath));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) {
          return next();
        }
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } catch (e) {
    // Ignore static asset mount error
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Hotel ERP] Unified Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Hotel ERP] REST API available at http://0.0.0.0:${PORT}/api/health`);
  });

  // Non-blocking database initialization
  initializeBackend().catch((err) => {
    console.error('[Backend Init] Non-blocking DB initialization warning:', err.message);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
