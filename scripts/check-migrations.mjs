import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = join(process.cwd(), 'supabase', 'migrations');
const files = (await readdir(directory)).filter((file) => /^\d{3}_.+\.sql$/.test(file)).sort();
if (!files.length) throw new Error('Migration tidak ditemukan.');

for (const [index, file] of files.entries()) {
  const expected = String(index + 1).padStart(3, '0');
  if (!file.startsWith(`${expected}_`)) throw new Error(`Urutan migration terputus: mengharapkan ${expected}, menemukan ${file}.`);
  const sql = await readFile(join(directory, file), 'utf8');
  if (!sql.trim() || !sql.includes(';')) throw new Error(`Migration kosong/tidak valid: ${file}.`);
}

console.log(`${files.length} migration berurutan dan tidak kosong: ${files[0]} sampai ${files.at(-1)}.`);
