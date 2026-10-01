---
name: task-tracking
description: "Continuously maintain, update, and track implementation progress in docs/TASKS.md across all features, bug fixes, and milestones."
risk: safe
date_added: "2026-09-09"
---

# Task Tracking Skill

This skill enforces continuous, transparent progress tracking in `docs/TASKS.md`. Every development step is tracked as a small, testable task with clear acceptance criteria.

---

## 🧠 Core Philosophy
> **"Every milestone broken down. Every task verified. Real-time progress in docs/TASKS.md."**  
> Never start a non-trivial task without checking `docs/TASKS.md`, and never finish a task without marking it completed with verification proof.

---

## 1. When to Invoke This Skill
Invoke this skill:
- **At the start of a milestone or feature**: Review `docs/TASKS.md` to identify the immediate next sub-task.
- **During execution**: If a task requires sub-steps or edge cases emerge, update `docs/TASKS.md` to keep the roadmap accurate.
- **Upon completion & verification**: Mark the sub-task `[x]` in `docs/TASKS.md`, noting any changes or new artifacts.
- **When user asks for progress or next steps**: Refer directly to `docs/TASKS.md`.

---

## 2. Standard Task Lifecycle

1. **Pick the next task**: Identify the top uncompleted task `[ ]` in `docs/TASKS.md`.
2. **Implement**: Write code adhering to `clean-code`, `python-ruff`, and `secrets-management` skills.
3. **Verify**: Run automated tests (`uv run ruff check app`, `uv run ruff format app`, `tsc -b`).
4. **Update `docs/TASKS.md`**:
   - Change `[ ]` to `[x]`.
   - Update `docs/DEVELOPER_GUIDE.md` if architectural changes occurred.
