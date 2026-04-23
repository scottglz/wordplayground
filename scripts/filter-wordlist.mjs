import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = resolve(__dirname, '..', 'public', 'wordlist.txt');
const tmp = file + '.tmp';

const input = readFileSync(file, 'utf8');
const lines = input.split(/\r?\n/);

let kept = 0;
let dropped = 0;
const out = [];
for (const line of lines) {
  if (line === '') continue;
  const semi = line.lastIndexOf(';');
  if (semi === -1) {
    out.push(line);
    kept++;
    continue;
  }
  const word = line.slice(0, semi);
  const score = Number(line.slice(semi + 1));
  if (Number.isFinite(score) && word.length < 5 && score < 45) {
    dropped++;
    continue;
  }
  out.push(line);
  kept++;
}

writeFileSync(tmp, out.join('\n') + '\n');
renameSync(tmp, file);

console.log(`kept ${kept}, dropped ${dropped}`);
