### Summary
`npx expo export` silently corrupts string literals in the compiled Hermes bytecode of any app that contains a `'use dom'` component. The DOM component's wrapper html is renamed to its content-hashed filename **after** the bundle is compiled, by a same-length binary find-and-replace inside the `.hbc` (`exportDomComponents.js`, `transformNativeBundleForMd5Filename`, `Buffer.isBuffer` branch). hermesc's string table overlap-packs strings sharing suffix/prefix bytes, so that in-place write can overwrite bytes owned by a *neighbouring* string. Which string gets hit depends on packing layout — in our production app it clipped the last 3 bytes of an API client key, disabling all feature flags for every iOS OTA user, with the corrupted value existing nowhere in source.

### Minimal reproducible example
<link to the uploaded repro repository>
(created from `create-expo-app --template blank-typescript`, one `'use dom'` component, one script)

### Steps to reproduce
1. `npm install`
2. `node repro.js`

The script exports once (iOS, production, bytecode — the default), learns this checkout's DOM placeholder hash, plants string literals ending in prefixes of it (the packer always takes a 16-byte overlap), exports again, and checks the literals in the emitted `.hbc`.

**Expected:** every planted literal is byte-identical in the bytecode.
**Actual:** the 16-byte-overlap literal is truncated — its tail replaced by fragments of the renamed html's new content hash (`FAIL: 1 string literal(s) corrupted`). The control literal is intact. `--no-bytecode` exports are unaffected (the text-replace branch is sound).

Occurs on: iOS and Android bytecode exports (`expo export` / `eas update`), standalone/OTA — not Expo Go, not dev. Package manager: npm. Reproduced on `@expo/cli` 54.0.24 (SDK 54) and 57.0.19–57.0.21 (SDK 57).

### Proposed fix (prototype in the repro repo, `docs/proposed-fix-prototype.patch`)
Defer Hermes compilation until after the DOM html renames: request the native bundle with `bytecode: false`, let `transformNativeBundleForMd5Filename` take its existing (sound) text branch, then compile once via `buildHermesBundleAsync`. Same number of hermesc invocations; compiled artifacts are never mutated. With the prototype applied, `node repro.js` prints PASS and the output is valid bytecode with correctly content-named html assets.

### Environment
<paste env-info.txt>

### Expo Doctor Diagnostics
<paste doctor.txt — 21/21 checks passed>
