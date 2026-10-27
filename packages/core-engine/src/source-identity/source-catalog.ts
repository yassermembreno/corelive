import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

type SourceCatalog = Record<string, string>;

export function resolveDefaultCatalogPath(): string {
  const baseDir =
    process.env.CORELIVE_DATA_DIR ?? join(homedir(), '.corelive');
  return join(baseDir, 'source-catalog.json');
}

export async function lookupOrAssignCatalogSourceId(
  absolutePath: string,
  catalogPath: string,
): Promise<string> {
  const catalog = await readCatalog(catalogPath);
  const existing = catalog[absolutePath];
  if (existing) {
    return existing;
  }

  const sourceId = `src_${randomUUID().replace(/-/g, '')}`;
  catalog[absolutePath] = sourceId;
  await writeCatalog(catalogPath, catalog);
  return sourceId;
}

async function readCatalog(catalogPath: string): Promise<SourceCatalog> {
  try {
    const raw = await readFile(catalogPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as SourceCatalog;
    }
    return {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

async function writeCatalog(
  catalogPath: string,
  catalog: SourceCatalog,
): Promise<void> {
  await mkdir(dirname(catalogPath), { recursive: true });
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
}
