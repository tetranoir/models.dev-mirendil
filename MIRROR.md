# Mirendil mirror

This repository tracks `anomalyco/models.dev` branch `dev` and publishes **`@mirendil/models-dev`**.

## Mirendil delta

Provider models authored with `base_model` retain that canonical ID in generated API/package snapshot records. All inherited upstream fields and provider overrides remain unchanged. Consumers can resolve a provider model to `snapshot.models[providerModel.base_model]`.

`providers/mirendil-router/models/` uses the router's public model IDs. Mappings and reasoning controls were checked against `product/services/llm-router/config.yaml` on 2026-09-08. Grok priority processing is opt-in through `experimental.modes.fast.provider`; it is not a default request body. Custom self-hosted checkpoints are not mapped to upstream models without canonical metadata.

`experimental.modes` remains keyed by provider-defined mode names. Each mode can declare `kind = "speed"` or `kind = "reasoning"`; consumers must select only `experimental.modes[modeId].kind === "speed"` for speed controls. A missing kind means unclassified, not speed. All current speed tiers (`fast`, `priority`, `ultrafast`) are classified as speed; OpenAI `pro` is reasoning. Names and provider request bodies do not determine classification. Sync preserves the kind, and Fireworks-generated priority modes declare it. The optional field keeps upstream records without a classification valid; upstream edits that conflict with mirror-local classifications require manual resolution, as with the existing canonical mapping delta.

A provider may also declare `experimental.modes` in its `provider.toml` for a mode it applies to every model it serves. Generation copies those modes onto each of the provider's models, and a model's own mode of the same name replaces the provider's. OpenRouter declares its documented latency routing (`provider.sort = "latency"`) this way, so no synced OpenRouter model record carries a mirror-local edit.

## Automated sync and publish

`.github/workflows/mirendil-sync-publish.yml` runs daily and on demand. It merges `upstream/dev`, installs with the lockfile, generates the SDK, validates the catalog, runs mapping contract and SDK tests, and builds the SDK. After those checks pass, it commits changes to `packages/sdk/src/generated.ts` only. This tracked family union must follow upstream's `ModelFamilyValues`; the snapshot module is ignored because it includes a generation timestamp. Any other uncommitted file stops the workflow. A final clean-tree check runs before the push. The workflow then publishes only when the snapshot payload differs from npm. Configure the repository Actions secret `NPM_API_KEY`; no token is committed. GitHub Actions requests `id-token: write`, so npm attaches provenance when publishing.

Upstream merge conflicts intentionally stop the workflow for manual resolution rather than overwriting the Mirendil delta.
