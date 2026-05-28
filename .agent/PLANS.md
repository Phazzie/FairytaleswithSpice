# ExecPlans

Created: 2026-05-28 03:12 UTC

Use an ExecPlan for multi-hour autonomous work, significant architecture changes, deployment readiness work, and any task where a future agent must continue safely without chat context.

An acceptable ExecPlan in this repository must:

- be self-contained enough for a fresh agent or junior developer to execute from the current checkout;
- describe the user-visible outcome and how to observe it;
- name exact files, commands, URLs, environment variables, and expected validation results;
- keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds;
- define recovery steps and stop conditions;
- avoid broadening an already-ready pull request with unrelated follow-up work.

Task-specific ExecPlans may live at the repository root when they are part of the PR recovery effort. Link the active task plan from `AGENTS.md`.
