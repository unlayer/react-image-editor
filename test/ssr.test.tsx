// @vitest-environment node
//
// The rest of the suite runs in jsdom, so nothing here verified the
// README's claim that the component "works out of the box in React Server
// Components environments ... and touches the DOM only inside effects".
// This file runs with no DOM at all.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { renderToString } from 'react-dom/server';

import ImageEditor from '../src';

it('has no DOM in this environment', () => {
  // Guards the guard: if jsdom leaked in, the test below proves nothing.
  expect(typeof document).toBe('undefined');
  expect(typeof window).toBe('undefined');
});

it('renders to a string on the server without touching the DOM', () => {
  const html = renderToString(
    <ImageEditor image="https://example.com/photo.jpg" editorId="ssr" />
  );

  expect(html).toContain('id="ssr"');
});

it('renders on the server with every prop set', () => {
  // Effects never run on the server, so a prop that reaches the DOM during
  // render rather than in an effect would throw here.
  expect(() =>
    renderToString(
      <ImageEditor
        image="https://example.com/photo.jpg"
        options={{ theme: 'dark', locale: 'fr', projectId: 1234 }}
        scriptUrl="https://cdn.example.com/embed.js"
        minHeight="80vh"
        style={{ borderRadius: 8 }}
        onLoad={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
        onLoadError={() => {}}
        onError={() => {}}
      />
    )
  ).not.toThrow();
});

// The 'use client' banner comes from tsup config, which nothing else
// checks — a bundler or config change could silently drop it and every
// existing test would still pass. Runs after `npm run build`; skipped in
// the React/Node matrix jobs, which do not build.
const dist = (file: string) => resolve(__dirname, '..', 'dist', file);
const built = existsSync(dist('index.mjs'));

it.skipIf(!built)('ships the "use client" directive in both builds', () => {
  for (const file of ['index.js', 'index.mjs']) {
    expect(readFileSync(dist(file), 'utf8').startsWith("'use client';")).toBe(
      true
    );
  }
});
