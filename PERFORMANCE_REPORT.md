# Deep Cuts Performance Report

**Scope:** Core Engine validation, static build, delivery artwork, GitHub deployment, unattended batch research, Studio JookBox research and the live mobile delivery path.  
**Behavior boundary:** all 35 completed editions, visual contracts, links, analytics, QR destinations, confidence gates, Studio outputs and deployment behavior remain protected by the existing cross-edition suite.  
**Baseline commit:** `0c071fa8bc4d140e80a6b65213d1be139ba0d26c`  
**Baseline production run:** GitHub Actions `30587613762`, `30587613614` and `30587613633`, 31 July 2026 Australia/Sydney.

## Executive result

The main bottleneck was not the public app. It was repeated production work: the deployment rendered all 35 delivery packages sequentially, reran the same shared checks for every edition, rendered the complete package a second time in another automatic workflow, and ran main-branch validation twice.

The optimized pipeline:

- runs the complete validation plan through a bounded parallel controller;
- validates the platform once before artwork instead of once per edition;
- renders independent edition artwork with two workers;
- reuses artwork only when every relevant input has the same content hash;
- treats restored artwork as untrusted until SHA-256, dimensions and two QR scan-back sizes pass;
- makes deployment the single automatic producer of the downloadable delivery package;
- parallelizes independent static-copy operations;
- deduplicates concurrent network checks and keeps unrelated origins in flight;
- preserves the required AI regeneration retry because it is a quality gate, not waste.

## Baseline measurements

### Local validation — every original command

| Step | Time |
|---|---:|
| Platform contracts | 873.3 ms |
| Edition isolation | 111.0 ms |
| Global footer | 68.1 ms |
| Discovery | 55.6 ms |
| School challenge | 47.8 ms |
| Laneway artist edition | 51.5 ms |
| Laneway company edition | 54.9 ms |
| Final Indie Label model | 52.7 ms |
| Laneway reporting | 117.4 ms |
| Indie Wheel | 52.2 ms |
| Nastyboy Indie Wheel | 61.4 ms |
| High Grade Mechanical | 57.1 ms |
| Hays | 62.8 ms |
| External-link policy | 53.7 ms |
| JookBox | 64.2 ms |
| Record Company | 943.2 ms |
| Analytics | 50.3 ms |
| Build tracking | 132.4 ms |
| Worker | 97.6 ms |
| Sales intelligence | 85.6 ms |
| Edition sync | 311.0 ms |
| Runtime secrets | 48.3 ms |
| Live delivery | 56.6 ms |
| Factory | 267.3 ms |
| Batch | 47.6 ms |
| Studio research | 68.1 ms |
| Studio | 201.9 ms |
| 29 syntax checks | approximately 1,190 ms total |
| **Total, sequential** | **5,307.7 ms** |

### Static bundle

Three-run baseline: 486.3 ms, 403.2 ms and 391.4 ms; median **403.2 ms**. The result contained 282 files and 16,190,963 bytes.

### Main production workflows

| Production step | Baseline |
|---|---:|
| Reusable validation job | 18 s |
| Deploy job setup/checkout/detection/runtime setup | 14 s |
| Generate all scan-tested artwork | **135 s** |
| Static build | <1 s |
| D1 migrations | 9 s |
| Worker deployment | 7 s |
| Runtime-secret installation | 10 s |
| Edition synchronization | 7 s |
| Live smoke verification | 8 s |
| Deployed QR availability verification | 1 s |
| **Deploy job** | **194 s** |
| **Push-to-complete workflow** | **220 s** |

The same push also ran a second standalone validation workflow for 29 seconds and a second 35-edition artwork workflow for 145 seconds. Artwork rendering alone was duplicated for **269 runner-seconds** per main change.

### Live ATLAS mobile path

Three production requests per asset, Cloudflare edge hit in every case:

| Resource | Median total | Compressed transfer |
|---|---:|---:|
| Edition HTML | 116.5 ms | 4.4 KB |
| Shared CSS | 103.6 ms | 39.1 KB |
| Main application JavaScript | 84.4 ms | 20.3 KB |
| Analytics JavaScript | 110.0 ms | 2.3 KB |
| Platform registry | 89.5 ms | 1.6 KB |
| ATLAS configuration | 89.3 ms | 2.3 KB |
| Locked ATLAS cabinet WebP | 134.3 ms | 160.4 KB |

The registry and edition configuration are intentionally sequential because the opaque route is resolved through the registry before its isolated configuration path is known. No duplicate public API or AI request was found. Cache headers require revalidation, but Cloudflare served edge hits with ETags; long immutable caching would risk stale same-URL edition assets and was therefore not introduced.

## Bottlenecks and findings

1. **Repeated per-edition validation:** `build-edition.mjs` performed platform, discovery, analytics, syntax and dependency checks 35 times in each full artwork pass.
2. **Sequential artwork generation:** independent edition images and QR scan-backs waited on one another.
3. **Duplicate automatic workflows:** validation and complete delivery artwork ran twice on every main push.
4. **Sequential validation:** 56 independent child processes waited in a strict chain; process startup represented most of the wall time.
5. **Sequential static copies:** independent bundle sources were copied one after another.
6. **Batch duplicate and disk work:** simultaneous checks for the same URL could race before the durable cache existed; a later reuse still reread JSON from disk.
7. **Global network pacing:** unrelated domains shared one delay marker, leaving safe cross-domain capacity idle.
8. **Studio discovery waves:** three search queries plus YouTube, up to seven roots and up to three additional official sites were checked sequentially.
9. **AI prompts:** the public app, standard batch and Studio JookBox research make no AI call. Record Company makes one structured call and only repeats it after a draft fails its strict evidence/schema gate. That second call is necessary and remains intact.

## Optimizations applied

### Parallel, profiled validation

`scripts/run-validation.mjs` owns the unchanged validation command plan, uses a bounded worker pool, prints completion and duration as each check finishes, stops scheduling after a failure and optionally writes JSON timing data. The plan now includes two additional performance-pipeline safeguards.

### One trusted artwork pipeline

`scripts/build-delivery-assets.mjs` validates shared contracts once, verifies dependencies once, renders isolated editions with bounded concurrency, reports live progress and performs a final complete verification.

`scripts/verify-delivery-assets.py` requires:

- all expected active-edition files;
- correct manifest identity and opaque QR destination;
- correct 1080 × 1080 dimensions;
- exact SHA-256 agreement;
- successful full-size QR decode;
- successful 540 × 540 QR decode.

GitHub’s cache key covers the registry, every edition, source assets, renderer, verifier, QR engine and locked Python requirements. A changed input is therefore a miss, never a stale hit.

### Workflow consolidation

Pull requests keep the standalone validation workflow. Main deployment invokes that reusable validation once, creates the automatic delivery artifact itself and caches the verified artwork. The separate Delivery Assets workflow remains available for explicit manual rebuilds.

### Build I/O

Independent file and directory copies now run together. No path, filter or output content changed.

### Research concurrency and cache

Batch research now:

- shares one in-flight promise for simultaneous identical URLs;
- retains successful cache reads in memory for the batch;
- keeps the existing durable resume cache;
- starts independent origins concurrently;
- spaces requests per origin;
- inspects independent sources and destinations concurrently;
- writes the two checkpoint copies in parallel.

Studio research now shares simultaneous identical inspections and checks independent searches, seed pages and additional official sites concurrently. Result arrays retain their source order, so deterministic selection and confidence behavior remain unchanged.

## Verified local after measurements

| Path | Before | After | Improvement |
|---|---:|---:|---:|
| Full validation wall time | 5,307.7 ms / 56 checks | 1,318.5 ms / 59 checks | **75.2% faster while adding 3 checks** |
| Static build median | 403.2 ms | 257.4 ms | **36.2% faster** |

Static-output equivalence:

- baseline files: 282;
- optimized files: 282;
- baseline aggregate tree SHA-256: `e59b6b088500463b5f210cef90e64bd985a8e1b7986d299acfd7d2c1ec4ac635`;
- optimized aggregate tree SHA-256: `e59b6b088500463b5f210cef90e64bd985a8e1b7986d299acfd7d2c1ec4ac635`.

## Verified GitHub runner after measurements

| Delivery-artwork path | Before | After | Improvement |
|---|---:|---:|---:|
| Cold full job | 145 s | 82 s | **43.4% faster** |
| Generate and scan-verify all 35 editions | 135 s | 64 s | **52.6% faster** |
| Exact-input cache-hit full job | 145 s | 23 s | **84.1% faster** |
| Cache-hit full integrity and QR verification | not available | 1 s | verified, fail-closed reuse |

GitHub Actions runs `30590641904` and `30592490136` supplied the after figures. The second run restored only the exact input hash and still rechecked every expected file, SHA-256 digest, dimension, manifest destination and QR decode before accepting the cache.

Delivery-output equivalence against the preserved pre-change artifact:

- 70 of 70 generated PNG files are byte-identical;
- 35 of 35 manifests match on every stable field, file digest and destination;
- only the intentionally variable `generatedAt` timestamp differs after a cold render.

The first optimized main-branch production deployment was a cold-cache run:

| Production path | Before | After | Improvement |
|---|---:|---:|---:|
| End-to-end deployment workflow | 220 s | 139 s | **36.8% faster** |
| Deployment job | 194 s | 112 s | **42.3% faster** |
| Generate and scan-verify all artwork | 135 s | 66 s | **51.1% faster** |
| Synchronise all edition records | 7 s | 2 s | **71.4% faster** |
| Live service and edition smoke tests | 8 s | 2 s | **75.0% faster** |

Production run `30593001240` supplied the after figures. It completed D1 migrations, Worker deployment, runtime-secret installation, all 35 edition synchronizations, live page checks and every deployed QR check successfully. The same main push started one Deep Cuts workflow instead of the previous three: the standalone duplicate validation and duplicate automatic artwork workflow did not run.

## Behavior and quality guarantees

- No public feature, content, visual style, link, event, route, prompt or edition configuration changed.
- All completed editions remain isolated.
- The 98% gate remains fail-closed.
- Search results remain research leads only.
- QR generation is never skipped on a changed input.
- A cached QR is decoded twice before use.
- No invalid AI result is cached.
- Runtime request behavior is unchanged.
