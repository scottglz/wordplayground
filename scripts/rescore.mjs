import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WORDLIST_IN = join(ROOT, 'public', 'wordlist.txt');
const WORDLIST_OUT = join(ROOT, 'public', 'wordlist_rescored.txt');
const PROGRESS_FILE = join(__dirname, 'rescore_progress.json');

const BATCH_SIZE = 200;
const CONCURRENCY = 10;
const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You are scoring word puzzle entries. Each entry is a lowercase string representing an English word or phrase with spaces removed (e.g., "newyorkcity" = "New York City", "zztop" = "ZZ Top"). Your job is to score each entry 0–50 based on how well-known and interesting it is to a general English-speaking adult.

Scoring guide:
- 45-50: Iconic — everyone knows it (common everyday words, major cities, famous people, pop culture staples like "pizza", "beatles", "newyork")
- 35-44: Well-known — most adults recognize it (e.g., "aardvark", "zumba", "wikileaks")
- 25-34: Recognizable but niche — enthusiasts or educated adults know it
- 15-24: Obscure — exists but not widely known outside specialists
- 5-14: Very obscure — rare proper nouns, highly technical jargon
- 0-4: Unresolvable garbage — meaningless string with no clear interpretation

Respond with ONLY a JSON object mapping each entry exactly as given to its integer score. No explanation, no markdown, no code fences.`;

function buildUserPrompt(words) {
  return `Score these entries:\n\n${words.join('\n')}`;
}

function parseProgress() {
  if (!existsSync(PROGRESS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress), 'utf8');
}

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function scoresBatch(client, words, batchIndex, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(words) }],
      });

      const text = msg.content[0].text.trim();
      const parsed = JSON.parse(text);

      // Validate: every word present, score is integer 0-50
      const result = {};
      for (const word of words) {
        const score = parsed[word];
        if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 50) {
          throw new Error(`Invalid score for "${word}": ${score}`);
        }
        result[word] = score;
      }
      return result;
    } catch (err) {
      if (attempt === retries) {
        console.error(`  Batch ${batchIndex} failed after ${retries + 1} attempts: ${err.message}`);
        // Fall back to keeping original score (40) for this batch
        return Object.fromEntries(words.map(w => [w, 40]));
      }
      console.warn(`  Batch ${batchIndex} attempt ${attempt + 1} failed, retrying: ${err.message}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable not set');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  console.log('Reading wordlist...');
  const lines = readFileSync(WORDLIST_IN, 'utf8').split('\n');
  const entries = [];
  for (const line of lines) {
    const semi = line.indexOf(';');
    if (semi === -1) continue;
    const word = line.slice(0, semi).trim();
    const score = parseInt(line.slice(semi + 1).trim(), 10);
    if (word && !isNaN(score)) entries.push({ word, score });
  }
  console.log(`Loaded ${entries.length} entries`);

  const words = entries.map(e => e.word);
  const batches = chunk(words, BATCH_SIZE);
  console.log(`${batches.length} batches of ${BATCH_SIZE}, concurrency ${CONCURRENCY}`);

  const progress = parseProgress();
  const scores = { ...progress };
  const pending = batches.filter((_, i) => {
    // Skip if all words in batch already scored
    return !batches[i].every(w => w in scores);
  });
  console.log(`${Object.keys(scores).length} already scored, ${pending.length} batches remaining`);

  const start = Date.now();
  let done = 0;
  const limit = pLimit(CONCURRENCY);

  await Promise.all(
    batches.map((batch, i) => {
      if (batch.every(w => w in scores)) return Promise.resolve();
      return limit(async () => {
        const result = await scoresBatch(client, batch, i);
        Object.assign(scores, result);
        done++;
        saveProgress(scores);
        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        const remaining = batches.length - done;
        process.stdout.write(`\r  ${done}/${batches.length} batches done, ~${remaining} remaining (${elapsed}s)  `);
      });
    })
  );

  console.log('\nWriting output...');
  const outLines = entries.map(({ word }) => {
    const score = scores[word] ?? 20; // fallback if missing
    return `${word};${score}`;
  });
  writeFileSync(WORDLIST_OUT, outLines.join('\n') + '\n', 'utf8');

  console.log(`Done! Written to ${WORDLIST_OUT}`);
  console.log(`Total time: ${((Date.now() - start) / 1000).toFixed(1)}s`);

  // Score distribution summary
  const dist = {};
  for (const score of Object.values(scores)) {
    const bucket = Math.floor(score / 5) * 5;
    dist[bucket] = (dist[bucket] ?? 0) + 1;
  }
  console.log('\nScore distribution (buckets of 5):');
  for (const bucket of Object.keys(dist).map(Number).sort((a, b) => a - b)) {
    const bar = '█'.repeat(Math.round(dist[bucket] / 500));
    console.log(`  ${String(bucket).padStart(2)}-${bucket + 4}: ${String(dist[bucket]).padStart(6)}  ${bar}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
