import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGallery, serializeGallery } from '../src/lib/frontmatter.ts';
import { normalizeToBlocks } from '../src/lib/blocks.ts';

const dir = 'src/content/galleries';
for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
  const slug = file.replace(/\.md$/, '');
  const g = parseGallery(slug, readFileSync(join(dir, file), 'utf8'));
  const migrated = { ...g, blocks: normalizeToBlocks(g), images: [] };
  writeFileSync(join(dir, file), serializeGallery(migrated));
  console.log(`migrated ${file}: ${migrated.blocks.length} blocks`);
}
