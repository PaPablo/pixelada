// Lanza Vitest con la unidad de disco en mayúscula. En Windows, si la terminal está en
// "c:\" (VS Code lo hace a veces), Vitest se carga dos veces y falla con "reading 'config'".
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = here.replace(/^[a-z]:/, (d) => d.toUpperCase());
const bin = path.join(root, 'node_modules/vitest/vitest.mjs');
const r = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
process.exit(r.status ?? 1);
