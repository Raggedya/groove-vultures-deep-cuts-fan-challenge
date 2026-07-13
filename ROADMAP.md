# Deep Cuts Production-Time Roadmap

This roadmap is ordered only by expected production-time savings. Quality work remains mandatory, but priority is determined by repeatable time saved per future edition.

## 1. Convert the current application into a reusable Deep Cuts engine

**Status:** Complete  
**Time saving:** Eliminates rebuilding and retesting the application for every band.  
**Completion test:** One shared engine loads any registered edition without code changes.

## 2. Move all edition-specific content into configuration

**Status:** Complete  
**Time saving:** Turns a software task into a controlled content task.  
**Completion test:** A band name, questions, colours, links and public URL can change without editing engine files.

## 3. Automate question import

**Status:** Started: edition registration, IDs, validation and grouping checks are automated; structured research import remains next  
**Time saving:** Removes hand-formatting, ID assignment, grouping and mix calculations for 36 questions.  
**Completion test:** One structured research file imports, normalises and validates a complete bank.

## 4. Automate artwork integration

**Status:** Complete for deterministic social and QR outputs; edition-specific research artwork remains a future option  
**Time saving:** Generates consistent cover metadata, Instagram artwork and QR artwork without manual graphic design.  
**Completion test:** One edition configuration creates all required raster outputs while preserving the exact Aggits master.

## 5. Automate testing

**Status:** Complete for configuration, content, engine, syntax, Aggits identity, image dimensions and QR scan-back; live-browser automation remains an extension  
**Time saving:** Replaces repeated manual checks and catches errors before browser review.  
**Completion test:** One command validates content, engine behaviour, social outputs, QR destination, links and a live smoke test.

## 6. Automate Git commits

**Status:** Implemented in the authenticated publish command  
**Time saving:** Removes staging, commit-message and branch commands from normal production.  
**Completion test:** A validated edition is committed with a generated summary and no owner action.

## 7. Automate deployment

**Status:** Implemented through the permanent repository’s existing GitHub Pages deployment  
**Time saving:** Removes Pages setup and manual publishing commands.  
**Completion test:** A validated main-branch change deploys automatically and exposes a stable edition URL.

## 8. One-command publish

**Status:** Complete: the publish command builds, validates, creates delivery assets and prepares the email package  
**Time saving:** Reduces research-output packaging, testing, social generation, commit and deployment to one deterministic command.  
**Completion test:** `publish-edition <slug>` completes all non-editorial steps and produces a completion manifest.

## 9. One-prompt publish

**Status:** Operational through the repository-local Deep Cuts Factory skill and connected GitHub/Gmail delivery tools  
**Time saving:** Removes all normal technical interaction from the owner.  
**Completion test:** `Deep Cut [Band or Artist]` triggers research, edition creation, validation, deployment, social generation and email delivery.

## 10. Full Deep Cuts Factory

**Status:** Planned  
**Time saving:** Enables reliable concurrent production, versioned editions, monitoring and recovery without owner intervention.  
**Completion test:** The platform queues editions, records provenance, detects failures, retries safe stages, monitors live health and delivers a final link and assets automatically.

## Next automation decision

Implement the highest unfinished item whose dependencies are available. Do not prioritise cosmetic or architectural work ahead of a larger measurable production-time saving.
