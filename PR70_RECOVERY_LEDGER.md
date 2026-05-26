Created: 2026-05-26 00:12 EDT

# PR #70 Recovery Ledger

This ledger tracks the actual disposition of each currently open PR. It starts from the inventory in `PR70_RECOVERY_PLAN.md` and should be updated as each PR is merged, ported, cherry-picked, mined, or closed.

Status values:

- `pending`
- `merged`
- `ported`
- `cherry-picked`
- `mined and closed`
- `closed no material`
- `superseded`

## PR Status Index

| PR | Planned action | Actual status | Notes |
|---:|---|---|---|
| #86 | merge | pending | Design system doc. |
| #85 | merge | pending | `path-to-regexp` security bump. |
| #84 | try merge or recreate | pending | Grouped dependency update. |
| #77 | mine and close | pending | Documentation analysis lessons. |
| #76 | close | pending | No committed material found. |
| #75 | port/cherry-pick | pending | Chapter batching and continuity panels. |
| #74 | port later or mine/close | pending | Proving grounds prompt lab. |
| #73 | recreate/port | pending | Persistent story state; avoid DigitalOcean Postgres assumption. |
| #72 | port/cherry-pick | pending | Multi-chapter backend/frontend contracts. |
| #71 | compare then close | pending | Early batch generation, mostly superseded by #72. |
| #70 | merge baseline | pending | Story-lab baseline. |
| #67 | port/cherry-pick | pending | Audit, author-style extraction, duplicate cleanup. |
| #65 | port/cherry-pick | pending | AI model/token/story quality fixes. |
| #64 | port/cherry-pick | pending | Fisher-Yates/randomization and selected tests. |
| #63 | mine and close | pending | Storage/database research. |
| #56 | mine and close | pending | Backend service/cache research, DigitalOcean-shaped. |
| #55 | mine and close | pending | Voice evolution/emotion material; audio deferred. |
| #54 | close | pending | DigitalOcean deployment infra; not Vercel direction. |
| #53 | mine and close | pending | Docs cleanup intent; avoid node_modules churn. |
| #50 | port/cherry-pick | pending | Progress/hydration fix. |
| #47 | mine and close | pending | Audio pipeline research. |
| #45 | mine and close | pending | Emotion mapping and character consistency. |
| #44 | mine and close | pending | Character-driven narration material. |
| #43 | mine and close | pending | Audio player/emotion-aware voice processing. |
| #42 | mine and close | pending | Streaming audio/emotion mapping. |
| #41 | port/cherry-pick | pending | Minimal Vercel CI/API tests. |
| #40 | mine and close | pending | Visual ideas only. |
| #39 | mine and close | pending | CI concepts, not full suite. |
| #31 | recreate/port | pending | Story arc/cliffhanger; exclude audiobook. |
| #30 | mine and close | pending | Dialogue parser/speaker-tag ideas. |
| #29 | mine and close | pending | Speaker segment and voice metadata ideas. |
| #28 | mine and close | pending | Modular audio service breakdown; base not main. |
| #26 | port/cherry-pick | pending | Notifications, validation, accessibility. |
| #24 | recreate/port | pending | Trope subversion engine. |
| #22 | mine and close | pending | Early dialogue parsing/speaker tag material. |

## Disposition Template

Use this template for detailed entries as each PR is handled:

```markdown
## PR #NN - Title

- Source branch:
- Planned disposition:
- Actual disposition:
- Story-generation impact:
- Accepted material:
- Not taking now:
- Why not taking:
- Future mining value:
- Files inspected:
- Files changed in recovery branch:
- Conflicts encountered:
- Tests/checks run:
- Self-review notes:
- GitHub PR closure note:
```

