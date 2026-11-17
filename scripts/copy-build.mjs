import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const srcDir = path.join(rootDir, 'artifacts', 'airnet-computers', 'dist', 'public');
const destPublic = path.join(rootDir, 'public');
const destDist = path.join(rootDir, 'dist');

if (fs.existsSync(srcDir)) {
  console.log(`[copy-build] Copying built client from ${srcDir} to root ./public and ./dist`);
  fs.cpSync(srcDir, destPublic, { recursive: true });
  fs.cpSync(srcDir, destDist, { recursive: true });
  console.log('[copy-build] Successfully populated ./public and ./dist');
} else {
  console.error(`[copy-build] Source build directory not found: ${srcDir}`);
  process.exit(1);
}
