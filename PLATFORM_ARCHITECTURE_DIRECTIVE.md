# Platform Architecture Directive — Edition Protection and Isolation

**Status: permanent, governing and non-negotiable.**

Deep Cuts is one platform supporting multiple independent commercial product editions, including Bands, Artists, Businesses, Cafés, Restaurants, Classic Cars, Car Clubs, Bowls Clubs, Sporting Clubs, Museums and future editions.

Unless the owner explicitly overrides this directive in writing, preserving every completed edition takes priority over implementing a new feature.

## Core principles

1. **Every edition is an independent product.** Each edition has its own layouts, prompts, workflows, UI, data sources, branding, content rules, navigation, buttons, categories, analytics configuration and business logic. A change to one edition must never alter another edition.
2. **Backward compatibility is mandatory.** Every enhancement must preserve all previously completed editions unless the owner explicitly authorises a change to a named edition. Existing functionality must never be degraded, removed or unintentionally modified.
3. **Edition isolation is mandatory.** Edition-specific assets, prompts, templates, configuration, styling, images and business rules must remain isolated. No edition may depend directly on another edition.
4. **Only genuinely reusable services belong in the Core Engine.** Core services include page rendering, responsive foundations, QR generation, analytics, caching, search, safe external-link handling, API integrations, AI summarisation, logging, performance, security, error handling, the UI framework and reusable components. Core improvements may benefit all editions, but must not change an edition's unique behaviour.
5. **Edition-specific functionality stays with its edition.** It must not move into the Core Engine unless it is demonstrably reusable across multiple editions and preserves all existing outputs.
6. **Every change requires an impact assessment.** Before implementation, determine whether it could affect another edition, an existing UI, prompts, workflows, business logic or production output. If yes, do not proceed without explicit owner authority.
7. **Future editions plug in as separate modules.** Extend the platform framework; never modify an existing edition to make room for a new one.
8. **Never overwrite an existing edition.** Extend the platform instead.
9. **Preserve visual identity.** Each edition retains its appearance, navigation, button arrangement, content strategy and overall experience.
10. **Protect production reliability.** Optimisation must increase automation, speed, scalability or maintainability while producing identical outputs for existing editions.
11. **Treat the platform as a long-term commercial product.** Favour scalability, maintainability, modularity, reliability, performance, backward compatibility, easy addition of new editions, minimal manual effort and maximum safe automation.
12. **Preservation is the default.** Ambiguous changes must be resolved in favour of leaving completed editions unchanged.

## Mandatory change protocol

Every pull request must:

1. Name the edition or Core Engine surface being changed.
2. State which completed editions could be affected.
3. Confirm that layouts, prompts, workflows, navigation, buttons, analytics and business rules for all other editions remain unchanged.
4. Add or update edition-specific tests where behaviour changes.
5. Run the full cross-edition validation suite.
6. Fail closed if isolation or backward compatibility cannot be demonstrated.

## Permanent rule

Treat every completed edition as a finished commercial product that must remain stable forever. Future work extends the platform; it does not modify, replace or compromise existing editions. This directive applies to every future development task unless the owner explicitly overrides it in writing.

## School Discovery contract

- School Discovery is an independent edition and never inherits Music, Cars or Clubs presentation rules.
- Aggits is completely absent from the School Discovery page and every School Discovery delivery asset.
- A featured, identity-verified YouTube video is mandatory.
- The colour scheme is derived from the current official school website and recorded with dated evidence.
- The school logo, crest or emblem is never copied or displayed. Only verified website colour values inform the palette.
- QR artwork uses the heading `Discover Our School` and the edition-specific school name.
- School Discovery alone includes a six-question positive school challenge. Music, Cars and Clubs remain discovery-only and must not inherit any quiz interface or logic.
- The challenge CTA is placed immediately before the School Upgrade destination. It reads `How Well Do You Know Our School?` and `Take the Challenge` and uses the edition's verified school accent colour.
- Each question has four choices, a 15-second countdown, a time-up bell at zero, a ten-second positive fact explanation and a verified authoritative source. Exactly six questions are required.
- Results use encouraging, non-punitive ratings. The challenge always provides an explicit School Home control, and browser Back also restores the school discovery page without requiring another QR scan.
