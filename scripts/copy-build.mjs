import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const clientDist = path.join(rootDir, 'artifacts', 'airnet-computers', 'dist');
const destPublic = path.join(rootDir, 'public');
const destDist = path.join(rootDir, 'dist');

if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  console.log(`[copy-build] Synchronizing ${clientDist} to root ./public and ./dist`);
  fs.cpSync(clientDist, destPublic, {
    recursive: true,
    filter: (src) => !src.includes('dist\\public') && !src.includes('dist/public'),
  });
  fs.cpSync(clientDist, destDist, {
    recursive: true,
    filter: (src) => !src.includes('dist\\public') && !src.includes('dist/public'),
  });
  console.log('[copy-build] Successfully synchronized all output directories');
} else {
  console.error(`[copy-build] Source index.html not found in ${clientDist}`);
  process.exit(1);
}
