# `expo export` corrupts Hermes bytecode when renaming DOM component html assets

Minimal reproduction: `npx expo export` **binary-patches the compiled Hermes
bytecode** to rename each `'use dom'` component's wrapper html from its
placeholder name (`md5(reference).html`) to its final content-hashed name
(`md5(htmlContent).html`). hermesc's string table **overlap-packs** strings that
share suffix/prefix bytes, so that same-length in-place write can overwrite
bytes belonging to a **neighbouring string**.

Any string literal in the app can be the victim. In our production app it
clipped the last 3 bytes of an API client key, which disabled all feature flags
for every iOS OTA user.

## Reproduce

```bash
npm install
node repro.js
```

`repro.js` is deterministic on any machine:

1. exports once to learn this checkout's DOM-component placeholder hash `H`
2. plants string literals that END with prefixes of `H` (hermesc's packer fuses
   shared suffix/prefix bytes — a 16-byte match is always taken)
3. exports again and checks the literals inside the emitted `.hbc`

Expected output (bug present):

```
  overlap16 CORRUPTED  expected …50027da9f038ca  got …65b82907c0136e
FAIL: 1 string literal(s) corrupted in the compiled bytecode by the DOM html rename.
```

The literal's tail has been replaced by fragments of the renamed html's new
content hash. The `control` literal (random suffix, no overlap) is intact —
this is not a grep artifact; `hermes -dump-bytecode` shows the string-table
entry still declaring the original length while the character buffer holds the
neighbour's bytes.

## Where

`@expo/cli` `build/src/export/exportDomComponents.js`,
`transformNativeBundleForMd5Filename` — the `Buffer.isBuffer` branch does a
same-length `Buffer.copy` into the compiled artifact. The text branch (non-
bytecode exports) is sound; `--no-bytecode` exports are unaffected.

## Proposed fix (prototype validated in this repo)

Defer Hermes compilation until after the DOM renames: request the native bundle
with `bytecode: false`, let `transformNativeBundleForMd5Filename` take its
(sound) text branch, then compile once via `buildHermesBundleAsync`. Same
number of hermesc runs, bytecode never mutated. Prototype diff against
`@expo/cli@57.0.21`'s built output: [`docs/proposed-fix-prototype.patch`](docs/proposed-fix-prototype.patch)
— with it applied to `node_modules`, `node repro.js` prints `PASS`, the emitted
`.hbc` has valid Hermes magic, and the html keeps its content-hashed name.

Affected: reproduced on `@expo/cli` 54.0.24 (SDK 54, RN 0.81 hermesc) and
57.0.19–57.0.21 (SDK 57, hermes-v0.17).
