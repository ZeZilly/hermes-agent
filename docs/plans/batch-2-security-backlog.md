# Batch-2 Security Backlog

Tracked items identified during the Layer 1 security backport review (PR #1,
merged `95b5a543`). None are blockers; all harden the same surfaces further.

**Branch:** `batch-2-security` (based on `main` @ `95b5a543`)  
**Commit cadence:** one small PR per task group (T1+T2 together, T3 alone,
T4+T5 together). No long-lived branch accumulation.

---

## Task Map

| ID  | Title                                        | Severity   | Files touched                              | Status |
|-----|----------------------------------------------|------------|--------------------------------------------|--------|
| T1  | `allow_permanent` flag in gateway prompt     | MEDIUM     | `gateway/run.py`, `tools/approval.py`      | open   |
| T2  | New test: Tirith-backed prompt hides "always"| MEDIUM     | `tests/gateway/test_approve_deny_commands.py` | open |
| T3  | `_check_sensitive_read_path` unit tests      | LOW        | `tests/tools/test_file_tools.py`           | open   |
| T4  | Add `HERMES_HOME/.env` to read guard         | LOW-MEDIUM | `tools/file_tools.py`                      | open   |
| T5  | Surface-map comment + parity audit           | LOW        | `tools/file_tools.py`                      | open   |

---

## T1 — Thread `allow_permanent` flag into gateway approval prompt

**Surface:** `gateway/run.py` · `tools/approval.py` · `gateway/platforms/base.py`  
**Severity:** MEDIUM (misleading UX — not a security bypass, but implies a
capability that does not exist for Tirith-backed warnings)

**Root cause:**  
`gateway/run.py` builds the approval prompt text unconditionally including the
line that advertises `/approve always`. When the pending command was flagged by
a Tirith-backed warning, `choice == "always"` falls back silently to
`approve_session()` — the permanent allowlist is never written. The CLI avoids
this by passing `allow_permanent=False` through to the prompt builder;
the gateway skips this flag entirely.

**File-level changes:**

`tools/approval.py`
- `build_approval_prompt(…, allow_permanent: bool = True)` — add the parameter
- When `allow_permanent=False`, omit the "always" line from the returned string

`gateway/run.py`
- Detect whether any pending warning is Tirith-backed before constructing the
  approval payload
- Pass `allow_permanent=False` to `build_approval_prompt` in that case

`gateway/platforms/base.py`
- Confirm `allow_permanent` is forwarded if the base class constructs prompts

**Acceptance criteria:**
- [ ] `allow_permanent=False` → "always" text absent from gateway approval prompt
- [ ] `allow_permanent=True` (default) → no change to existing prompt text
- [ ] All existing approval tests still pass

---

## T2 — Test: Tirith-backed warning suppresses "always" in gateway prompt

**Surface:** `tests/gateway/test_approve_deny_commands.py`  
**Depends on:** T1

**New test cases to add:**

```python
def test_tirith_backed_warning_hides_always_option(…):
    # Arrange: approval triggered by Tirith-classified warning
    # Act: capture the approval prompt text sent to platform
    # Assert: "/approve always" not present in prompt
    # Assert: "/approve" and "/deny" still present

def test_non_tirith_warning_shows_always_option(…):
    # Assert: "/approve always" IS present when warning is not Tirith-backed
```

**Acceptance criteria:**
- [ ] Both tests pass
- [ ] No mock leakage into other test classes

---

## T3 — `_check_sensitive_read_path` parametrized unit tests

**Surface:** `tests/tools/test_file_tools.py`  
**Severity:** LOW (guard exists; regression coverage missing)

**Blocked paths (must return `{"error": "Access denied: …"}`):**

| Path                            | Reason                     |
|---------------------------------|----------------------------|
| `~/.ssh/id_rsa`                 | Exact file match           |
| `~/.ssh/config`                 | Exact file match           |
| `~/.aws/credentials`            | Exact file match           |
| `~/.docker/config.json`         | Exact file match           |
| `~/.azure/accessTokens.json`    | Exact file match           |
| `~/.config/gh/hosts.yml`        | Exact file match           |
| `~/.ssh/custom_key`             | Directory prefix match     |
| `~/.ssh/subdirectory/id_rsa`    | Deep subpath match         |

**Allowed paths (must pass through to normal I/O, mocked):**

| Path                            |
|---------------------------------|
| `~/projects/myapp/config.py`    |
| `/tmp/testfile.txt`             |
| `~/Documents/notes.md`          |

**Edge cases:**

| Scenario                                          | Expected result |
|---------------------------------------------------|-----------------|
| Symlink in workspace → resolves to `~/.ssh/id_rsa`| blocked         |
| `../../.ssh/id_rsa` relative to CWD               | blocked after `.resolve()` |

**Also cover `search_tool`:**
- `path="~/.ssh/"` → returns access-denied JSON, not a file listing

**Acceptance criteria:**
- [ ] Parametrized `test_blocks_sensitive_paths[…]` covers all rows above
- [ ] Parametrized `test_allows_safe_paths[…]` covers allowed paths
- [ ] Symlink + relative path edge cases as distinct test functions
- [ ] 100 % branch coverage on `_check_sensitive_read_path`

---

## T4 — Add `HERMES_HOME/.env` to `_check_sensitive_read_path`

**Surface:** `tools/file_tools.py`  
**Severity:** LOW-MEDIUM

**Gap:**  
`agent/context_references.py` blocks `HERMES_HOME/.env` for the `@file`
attachment path (`blocked_exact.add(hermes_home / ".env")`).  
`_check_sensitive_read_path` in `file_tools.py` only guards home-directory
credential directories; `HERMES_HOME/.env` (which holds API keys) is not
covered when accessed through `read_file` or `search_files`.

**Change in `tools/file_tools.py`:**

```python
# Inside _check_sensitive_read_path, after home-dir checks:
from hermes_constants import get_hermes_home
_hermes_env = get_hermes_home() / ".env"
if _path == _hermes_env.resolve():
    return f"Access denied: '{path_str}' is the Hermes secrets file."
```

**Acceptance criteria:**
- [ ] `read_file(str(get_hermes_home() / ".env"))` → access-denied JSON
- [ ] Profile isolation: path resolves per active `HERMES_HOME`, not hardcoded
- [ ] New test added (fits in T3 test file under a separate class)

---

## T5 — Surface-map comment and parity audit

**Surface:** `tools/file_tools.py` (comment only, no logic change)  
**Depends on:** T4

**Goal:**  
Make the three protection layers explicit so future contributors understand
the full picture without grepping multiple files.

**Add a block comment above `_check_sensitive_read_path`:**

```python
# Protected read surfaces (three layers — keep in sync):
#
#  Layer A — Home credential directories / files  (this function)
#    .ssh/, .aws/, .gnupg/, .kube/, .docker/, .azure/, .config/gh/
#    and their exact-file counterparts listed in _SENSITIVE_HOME_FILES
#
#  Layer B — HERMES_HOME secrets  (this function, T4)
#    HERMES_HOME/.env  (API keys and tokens)
#
#  Layer C — Hermes internal cache  (existing guard in read_file_tool)
#    HERMES_HOME/skills/.hub  (skills cache)
#
#  @file attachment path has its own parallel guard in:
#    agent/context_references.py :: _build_context_references()
#    → blocked_exact and blocked_prefix sets must stay in parity with above
```

**Acceptance criteria:**
- [ ] Comment present and accurate after T4 is applied
- [ ] No logic change; diff is comment-only
- [ ] `context_references.py` parity confirmed (no new guard needed there,
  just documented)

---

## PR plan

| PR   | Tasks | Title                                              |
|------|-------|----------------------------------------------------|
| PR-A | T1+T2 | `fix(gateway): suppress allow_permanent in Tirith-backed approval prompts` |
| PR-B | T3    | `test(file_tools): parametrized coverage for _check_sensitive_read_path`   |
| PR-C | T4+T5 | `security(file_tools): guard HERMES_HOME/.env + surface-map comment`       |

Each PR targets `main` directly; `batch-2-security` is the working branch
for all three.

---

## Test command reference

```bash
# Always use --frozen to avoid mutating uv.lock during test runs
uv run --frozen --extra dev --extra messaging pytest tests/ -q
uv run --frozen --extra dev --extra messaging pytest tests/tools/test_file_tools.py -v
uv run --frozen --extra dev --extra messaging pytest tests/tools/test_approval.py -v
uv run --frozen --extra dev --extra messaging pytest tests/gateway/test_approve_deny_commands.py -v
uv run --frozen --extra dev --extra messaging pytest tests/gateway/test_telegram_network.py -v

# Discard uv.lock drift after any test run
git checkout -- uv.lock
```
