---
name: syncing-drift
description: Use when the user asks whether things are still in step — phrases like "sync", "is the KB up to date", "did anything change in Figma", "check for drift", "am I stale". Compares the knowledge base and the active specs against the live Figma file, reports what moved, and recommends a command. Read-only — it never writes a registry.
---

{{ACTIVE_RULES}}

# Syncing Drift

## Overview

Bridge is deliberately **transactional**: `make` → `fix` → `done`, with
snapshots as the synchronisation points. That is a feature, not a gap. A live
bidirectional sync would replace those deterministic gates with eventual
consistency and raise the question no design tool answers well — who wins when
the spec and the board change at once.

`sync` gets the useful part of "nothing escapes me" without any of that: an
on-demand, read-only probe that reports drift and recommends the command that
resolves it. It writes no registry and no spec.

Two kinds of drift, with different remedies:

| Kind          | Question it answers                                     | Remedy         |
| ------------- | -------------------------------------------------------- | -------------- |
| **KB drift**  | did the design system change under my knowledge base?     | refresh the KB |
| **Spec drift**| was a design I generated edited in Figma behind my back?  | `fix`          |

## When to Use

Invoke when the user:

- says "sync", "check drift", "is the KB up to date", "did anything change"
- is about to start work and wants to know whether the ground moved
- hits a resolution failure and suspects the KB is stale

Do NOT use if:

- the user wants to *apply* a Figma correction — that is `fix`
- the user wants to bring a new design in — that is `import`
- the user wants to refresh the KB — this command recommends it, `cron` does it

## Procedure

**Before starting, load:**

- `references/transport-adapter.md` (repo-root) — for the live probes

### 1. KB drift

```bash
bridge-ds drift --kb {kb-path}
```

The command compares each registry against the recorded baseline in two
directions: **local** (has the file changed since the baseline?) and
**upstream** (has Figma changed?).

Hashing is per-entry and deliberately ignores the `generatedAt` envelope — that
timestamp changes on every extraction and would otherwise report drift on every
run.

Expected, non-alarming results:

- **variables not probed** — `/variables/local` is Enterprise-only and returns
  403 on other plans. This is a plan limit, not a failure, and not drift. On
  those plans variables refresh through MCP, never REST.
- **local changed on a hand-curated registry** — expected when the user curates
  it deliberately.

### 2. Spec drift

For each spec in `specs/active/` that has a snapshot, check whether the design
was edited outside Bridge since the snapshot was taken:

- **Console transport:** `figma_get_changes_since_version`
- **Official transport:** re-extract the node tree and diff against the snapshot

Report which specs moved. Do not diff the changes in detail here — that is
`fix`'s job, and doing it twice invites two different answers.

### 3. Live key probe (optional, on request or on a resolution failure)

Verify that the keys the active specs actually reference still exist in Figma.
This is the check that catches a renamed or deleted component before the next
compile does.

Sample rather than exhaust: a handful of keys per registry is enough to tell a
stale KB from a fresh one.

### 4. Recommend, then stop

    ## Sync report

    KB drift
      {registry}: {local} / {upstream}

    Spec drift
      {spec}: edited in Figma since {snapshot date} | in step

    Recommended
      - {command} — {why}

    Nothing was modified. `sync` is read-only.

Recommend; do not execute. Refreshing the KB or applying corrections are
separate, consequential commands the user runs deliberately.

To record the current state as the new baseline:

```bash
bridge-ds drift --kb {kb-path} --update-baseline
```

The baseline records the **on-disk** registries, never the fresh Figma
extraction — baselining upstream content would claim a sync that never
happened. Upstream drift therefore keeps being reported until the KB is
actually refreshed, which is the correct signal.

## Red Flags

| Rationalization                                            | Reality                                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| "Drift found, I'll just run `cron` to fix it"               | `sync` recommends. Refreshing the KB is the user's call — it can overwrite curated files. |
| "The variables endpoint 403'd, the sync failed"             | Enterprise-only endpoint. Report it as not probed and move on.                |
| "`generatedAt` changed, so the registry drifted"            | The envelope timestamp changes on every extraction. Only entries count.       |
| "I'll set up a webhook so this is automatic"                | Live sync was considered and rejected. On-demand is the design.               |
| "I'll apply the Figma edits I found while I'm here"         | That is `fix`, and it captures learnings this command cannot.                 |
| "No baseline yet, so there is no drift"                     | No baseline means unknown, not clean. Say so and offer to record one.         |

## Verification

Before reporting, confirm all of:

- [ ] `bridge-ds drift` exited without an unhandled error
- [ ] no registry file was written (drift is read-only — check mtimes if unsure)
- [ ] a 403 on variables was reported as "not probed", never as drift
- [ ] each reported drift carries a recommended command and a reason
- [ ] no recommended command was executed without the user asking

If the KB has no baseline, say that the result is "unknown, not clean" and offer
`--update-baseline`. Do not report "no drift" when nothing was comparable.
