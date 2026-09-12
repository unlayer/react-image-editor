import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// src/types.ts hand-mirrors the private @unlayer/image-editor public API,
// with a comment saying it does so "until they move into @unlayer/types".
// Nothing enforced the "until": once the move happens, the local copies
// silently become a second, diverging source of truth — which is how #25
// (a missing `dock`/`corners`) reached users.
//
// This is a tripwire, not a full drift check: a real one needs access to the
// private package. It fails the moment @unlayer/types starts exporting any
// mirrored name, so the local copy gets deleted rather than left to rot.
const MIRRORED = [
  'MountOptions',
  'ImageEditorInstance',
  'ImageEditorEmbed',
  'ImageEditorSaveResult',
];

const collectDeclarations = (dir: string): string => {
  let out = '';
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out += collectDeclarations(path);
    else if (entry.name.endsWith('.d.ts')) out += readFileSync(path, 'utf8');
  }
  return out;
};

it('still needs its local copy of the image editor types', () => {
  // Read the package directory directly: @unlayer/types restricts its
  // "exports" field, so require.resolve cannot reach its package.json.
  const declarations = collectDeclarations(
    join(process.cwd(), 'node_modules', '@unlayer', 'types')
  );

  const moved = MIRRORED.filter((name) =>
    new RegExp(`\\b(interface|type)\\s+${name}\\b`).test(declarations)
  );

  expect(
    moved,
    moved.length
      ? `@unlayer/types now exports ${moved.join(', ')}. Delete the mirrored ` +
          `declaration(s) from src/types.ts and re-export from @unlayer/types ` +
          `instead, then drop the name(s) from this test.`
      : ''
  ).toEqual([]);
});
