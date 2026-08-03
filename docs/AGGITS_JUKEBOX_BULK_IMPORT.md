# Aggits Jukebox bulk import

This is the operator and maintenance guide for the private **Import Editions** screen in Deep Cuts Studio. The importer creates isolated `aggits_jukebox` drafts only. It never publishes, deploys, emails, or modifies another product type.

## Owner workflow

1. Open Deep Cuts Studio and select **Import Editions**.
2. Choose a UTF-8 CSV or `.xlsx` workbook. Excel imports read only the worksheet named `Import Ready`.
3. Run preflight. No edition is written during this step.
4. Review valid, warning, and invalid rows; use the filters and download the error CSV where needed.
5. Select no more than 1,000 eligible rows, choose the reimport mode, and confirm draft creation.
6. Download the reconciliation CSV. Open any created draft to preview and edit it.
7. Publish an edition individually through the existing protected publisher only after its media and production requirements are complete.

## File contract

The required 40-column schema is version `1.0`. Column names and order are validated before rows are accepted. The stable keys are `record_id` and `edition_slug`. Each record supplies exactly four ordered physical button configurations:

- `button_N_enabled`
- `button_N_icon`
- `button_N_label`
- `button_N_action`
- `button_N_destination`
- `button_N_open_new_tab`

The UI shows the complete explicit icon and action mapping used by the importer. Unknown keys fail closed. Values beginning with spreadsheet formula characters, embedded formulas in workbooks, unsupported URL schemes, malformed destinations, duplicate record IDs, duplicate slugs, and duplicate destinations inside an edition are rejected.

HTTP and HTTPS links may be retained in unpublished drafts because the source contract permits them. The protected production publisher continues to enforce its stricter HTTPS readiness policy. Telephone and email actions require `tel:` and `mailto:` values respectively.

## Idempotency and audit trail

Three modes are available:

- **Skip existing records**: keep an existing imported draft unchanged.
- **Update existing drafts**: update only unpublished imported drafts and create a snapshot first.
- **Create new records only**: create records that have no matching stable identity and skip matches.

Import state is stored beneath the Studio user-data directory in `aggits-jukebox-imports`. Each preflight records the source filename and SHA-256 checksum. Each commit records operator, timestamp, mode, attempted identities, per-row outcomes, project IDs, source metadata, and counts. Reconciliation CSVs are available after each batch.

Rollback is recoverable: drafts created by the batch are moved into the batch rollback archive, while updated drafts are restored from their snapshots. Published editions cannot be overwritten or rolled back through this importer.

## Limits and failure behaviour

- Maximum upload: 30 MB.
- Maximum source rows: 5,000.
- Maximum drafts per commit: 1,000.
- A row failure is isolated and reported; it does not corrupt another row.
- No database migration is required because Studio uses its existing project filesystem and local user-data boundary.
- Formula-bearing Excel cells are rejected rather than evaluated.

## Maintaining mappings

Mappings, schema validation, parsing, preflight, commit, reconciliation, and rollback are centralised in `scripts/aggits-jukebox-import.mjs`. The administrative UI is in `studio/import-editions.html`, `studio/import-editions.css`, and `studio/import-editions.js`. Add a new source key only by extending the explicit mapping and its tests; do not infer an icon or action from free text.

## Current supplied workbook note

The supplied `JOOKBOX_Master_Database_2026-08-03.xlsx` can be parsed directly and its `Import Ready` sheet is selected correctly. Its worksheet contains many blank `country` cells that are populated in the separate import-ready CSV. Until the workbook is corrected, use `JOOKBOX_Import_Ready_2026-08-03.csv` for the cleaner preflight result. The importer reports the workbook rows rather than silently filling or inventing missing values.
