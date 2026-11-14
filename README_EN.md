# Auto Quiz Answering Skill

> 中文名：**学习通全自动答题 skills** · [中文文档](README.md)

> **About the repository name**: GitHub silently strips non-ASCII characters from
> repository names (a purely Chinese name gets normalized to `-skills`), so the
> repository is pinned to `chaoxing-quiz-auto`. The skill's display name is
> **学习通全自动答题 skills** / **Auto Quiz Answering Skill**; the clone directory
> matches the `name` field in `SKILL.md`, so it can be dropped into any skills
> directory as-is.

[![CI](https://github.com/jeeleonard9-art/chaoxing-quiz-auto/actions/workflows/ci.yml/badge.svg)](https://github.com/jeeleonard9-art/chaoxing-quiz-auto/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Take over the browser you are **already logged into** and complete a Chaoxing
(超星学习通 / `chaoxing.com`) homework or quiz end to end:

```
take over browser (CDP) → extract questions → write answer sheet
→ answer question by question with real mouse & keyboard → verify each answer
→ submit as a separate step → grade-check every question
```

## What problem it solves

A Chaoxing homework page is one long dynamic form: dozens of single-choice,
true/false and fill-in-the-blank questions, each requiring a click or a bit of
typing into a rich-text box, plus a small question navigator on the right.
Doing it by hand is not hard — doing it *again*, or *again after fixing one
question*, is painful. Chapter homework and re-attempts turn it into a chore.

This tool turns that into one command:

```bash
node scripts/run_all.js --answers answers.json --submit
```

It does **not** poke values into hidden inputs. It moves the real mouse, clicks
real options, types into the real editor, then reads the value back from the
platform and retries once if a click did not land. So it survives async
rendering and never silently leaves a question blank.

## Measured results

| Scenario | Result |
|---|---|
| "Java Web Programming" — Chapter 3 Servlet homework | 57 questions (19 single-choice + 20 true/false + 18 fill-in), answered by real mouse clicks; automated cross-check found **0 discrepancies** |
| Platform score | 98.2 / 100 — the only lost point was fill-in #51, whose standard answer is `转发(forward)` while `转发` was typed (see below) |

That 98.2 was the most valuable output of the whole run: it **measured Chaoxing's
grading rules**, and they are now written down in `references/grading_rules.md`,
so the same trap is not stepped on twice.

## ⚠️ Read this first: submitting is irreversible

Once a Chaoxing assignment is submitted:

- **the same attempt can no longer be edited** — reopening the answer page only
  returns *“作答状态异常！”* (invalid answer state);
- the only way to fix an answer is to **start a new attempt** from the course
  homework list (only if the teacher enabled re-attempts).

So submitting is deliberately a **separate step**, guarded twice:

- `answer_work.js` ends with a **full cross-check** — any mismatch prints ✗ and
  exits with code 2;
- `submit_work.js` starts with an **integrity pre-check** — any unanswered
  question aborts the submit with exit code 3.

**If you only want “filled in but not submitted”**, stop after `answer_work.js`.

## ⚠️ Why the tool clicks 暂时保存 (Save draft) before 提交 (Submit)

A real user on a different machine hit a platform-side problem: **clicking 提交 did
nothing** — `/work/validate` returned 302, and the page neither showed the confirmation
dialog nor sent the submit request; the URL never moved.

Root cause is a defect in some versions of the Chaoxing page itself:
`submitValidate()` only continues to `ready2Submit()` when `/work/validate` returns
`status` 2 or 3 — there is no `else` branch for a normal 302 → status 0 response.

**Click 暂时保存 once, then 提交** — and the confirmation dialog appears normally and
the chain completes:
`submitCheckTimes → submitWork → confirmSubmitWork → POST addStudentWorkNewWeb`.

So `submit_work.js` defaults to:

```
integrity pre-check → 暂时保存 (save draft) → click 提交 → handle the confirm dialog → report
```

That solves two things at once: it sidesteps the 302 branch, and it **persists a draft
first**, so a risk-control trigger or a flaky page cannot wipe the whole attempt —
the draft lives on the server and can be recovered.

Two more guards are built in: if the dialog mentions “未做完 / 未作答 / 还有…”, the tool
**refuses to confirm** and exits (code 4); and if no dialog appears after clicking 提交,
it falls back to calling the platform's own `ready2Submit()`.

## ⚠️ Second trap: how fill-in-the-blank is graded

Chaoxing **normalizes whitespace and bracket positions, but requires the answer
text itself to match the standard answer**:

| Standard answer | Your answer | Score |
|---|---|---|
| `init ()` | `init()` | ✅ full |
| `getWriter ()` | `getWriter` | ✅ full |
| `getContextPath ();getRealPath ()` | `getContextPath、getRealPath` | ✅ full |
| **`转发(forward)` / `重定向(redirect)`** | **`转发` / `重定向`** | ❌ **zero** |

In other words the canonical form keeps the **Chinese term plus the English
parenthetical**. Typing only the Chinese term is graded wrong.
`check_result.js` prints the platform's own “correct answer” string for every
question after submission — copy it verbatim on the next attempt.

## Compatibility

### By runtime

| Your agent supports | Usable | How |
|---|---|---|
| Skill mechanism (WorkBuddy, Claude Code, Agent-Skills-compatible runtimes) | ✅ | use `SKILL.md`; the model decides when to trigger it |
| CLI / any language | ✅ | run `scripts/*.js`, all output is human-readable text |
| MCP | ⚠️ | no MCP adapter is bundled; wrap `scripts/` in a stdio server if you need one |
| HTTP-only, cannot spawn local processes | ❌ | browser takeover requires local process control |

`agent_created: true` in the `SKILL.md` frontmatter is a WorkBuddy-specific
field. Other runtimes usually ignore unknown fields; delete the line if yours is strict.

### By question type

| Type | Platform `answertype` | Supported |
|---|---|---|
| Single choice | 0 | ✅ |
| Multiple choice | 1 | ✅ (write `"ABD"`; the script clicks each letter in turn) |
| True / false | 3 | ✅ (write `true` / `false`) |
| Fill in the blank | 2 | ✅ (UEditor rich text, real keyboard input) |
| Short answer / essay | 4/5/6/7/8/18… | ✅ (single editor, same UEditor path) |

### By platform

| Platform | Browser takeover | Answering | Status |
|---|---|---|---|
| Windows 10/11 + Edge | ✅ tested | ✅ tested | fully working (2026-11-14, Edge 157) |
| Windows + Chrome | ✅ same code path | untested | — |
| macOS | ✅ implemented | untested | see `references/troubleshooting.md` |
| Linux | ✅ implemented | untested | see `references/troubleshooting.md` |

**Honest note**: only Windows + Edge has been verified on real hardware. Browser
path resolution, symlink creation and process shutdown are implemented for
macOS/Linux but **not validated on a real machine**. Issues welcome.

### Requirements

- Node.js 20+ (playwright-core 1.6x requires 20+; CI covers 20 / 22 / 24 on ubuntu / macos / windows)
- Exactly one dependency: `playwright-core` (CDP client only — no browser download)
- Edge or Chrome installed locally, **already logged in** to Chaoxing

## Install

### As a Skill (recommended)

```bash
# WorkBuddy
bash install.sh
# or manually
git clone https://github.com/jeeleonard9-art/chaoxing-quiz-auto.git \
  "$HOME/.workbuddy/skills/chaoxing-quiz-auto"

# Claude Code
git clone https://github.com/jeeleonard9-art/chaoxing-quiz-auto.git \
  ~/.claude/skills/chaoxing-quiz-auto
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

**No git on the machine? Fine** — the installer detects the missing git and falls back to
downloading and unpacking the GitHub zip. You can also grab the zip yourself
(<https://github.com/jeeleonard9-art/chaoxing-quiz-auto/archive/refs/heads/main.zip>),
rename the extracted folder to `chaoxing-quiz-auto`, drop it into the skills directory and
run `npm install` there.

Restart the session afterwards. The model triggers the skill based on the
triggers listed in `description`.

### As a plain CLI tool

```bash
git clone https://github.com/jeeleonard9-art/chaoxing-quiz-auto.git
cd chaoxing-quiz-auto
npm install
```

## Using it with another AI assistant (e.g. Doubao)

Paste this straight into Doubao (or any other assistant) once you have cloned this repo:

```
I've downloaded the "学习通全自动答题 skills" (Auto Quiz Answering Skill) from GitHub (https://github.com/jeeleonard9-art/chaoxing-quiz-auto). Please install it into your skills directory following its README (Node.js 20+ and npm install), then use it to complete this Chaoxing (超星学习通) assignment for me: take over my already-logged-in browser → extract every question and option → answer them one by one with real mouse clicks and keyboard input, reading the value back to verify each one → stop and show me the result before submitting; I will reply "submit" and only then do you click 提交 → finally verify every question with check_result.js and tell me which questions lost points, quoting the platform's own correct-answer string.
```

If that assistant can drive a browser but cannot run Node scripts, point it at
`references/chaoxing_page_model.md` (DOM + submit flow) and `references/grading_rules.md`
(grading semantics) and let it do the page work by hand.

Before sending, make sure three things are ready: **Node.js 20+**, **the browser already
logged in to Chaoxing**, and **the assignment URL at hand**.

## Usage

| Command | What it does |
|---|---|
| `node scripts/takeover_browser.js` | close the browser and restart it with a CDP port (login state preserved); `--dry-run` detects only |
| `node scripts/extract_questions.js [--url <link>]` | extract every question, option and input slot |
| `node scripts/answer_work.js --answers answers.json` | answer question by question with the mouse, then cross-check (no submit) |
| `node scripts/submit_work.js` | integrity pre-check → **暂时保存 (save draft)** → click 提交 → handle the confirmation dialog |
| `node scripts/check_result.js` | diff “my answer” vs “correct answer” for every question |
| `node scripts/run_all.js --answers answers.json [--submit]` | one shot: extract → answer → (submit) → verify |

Common flags:

| Flag | Meaning |
|---|---|
| `--url <link>` | open the assignment page if it is not open yet |
| `--answers <file>` | answer sheet path, default `answers.json` |
| `--gap <ms>` | delay between questions, default 700 (human pacing — don't shrink it) |
| `--keep` | do not clear the form; answer on top of the current state |
| `--browser edge\|chrome` | pick the browser, default auto-detect |
| `--port <port>` | CDP port, default 9222 |
| `--dry-run` | only detect the browser and profile dir — close nothing, take over nothing |
| `--dry-run` | only detect the browser and profile dir — close nothing, take over nothing |

### Typical run

```bash
node scripts/takeover_browser.js
node scripts/extract_questions.js              # → questions.json / questions.txt
# write answers.json from the extracted content (an AI agent can do this)
node scripts/answer_work.js --answers answers.json   # stop unless the cross-check is green
node scripts/submit_work.js                     # submit
node scripts/check_result.js                    # grade-check every question
```

### Answer sheet format

```json
{
  "choice": { "1": "C", "2": "B", "20": "false", "21": "false" },
  "fill":   { "40": ["服务器", "Servlet 容器"], "47": ["getWriter"] }
}
```

See `references/answer_format.md` and `examples/answers.example.json`.

## How it works

### Browser takeover: a symlink defeats the “default profile” ban

Since Chromium 136, `--remote-debugging-port` **can no longer be used with the
default user data directory**:

```
--remote-debugging-port is disallowed with the default user data directory
```

That blocks the obvious route to “just open a debug port on the browser I am
already using”. The tool instead:

1. closes the browser (a locked profile cannot host a second instance);
2. creates a **symbolic link** (a *junction* on Windows — no admin needed) in the
   system temp dir pointing at the real profile;
3. relaunches with `--user-data-dir=<link> --remote-debugging-port=9222 --restore-last-session`.

The path string differs from the default → the guard is satisfied; the files are
the same → **cookies and login state survive**, and previously open tabs are restored.

### Answering: go through the platform's own handlers

- Objective questions: move the real mouse onto the option letter → click → the
  platform's own `addChoice()` writes the value and marks the tick; the script
  reads `#answer<qid>` and `.check_answer` back to confirm.
- Fill-in / short answer: click into the UEditor iframe → type with the real
  keyboard → `editor.sync()` copies the content into the `textarea`.
  **This step is mandatory**: the submit endpoint only does
  `$("#submitForm").serialize()`, so without `sync()` the blanks submit empty.

### Submitting: a separate step behind two gates

`submitValidate()` → `GET /work/validate` → `ready2Submit()` verifies every
question is non-empty → `workPop("确认提交？")` → click `#popok` →
`confirmSubmitWork()` POSTs → lands on `work/prompt` with the score.

The two gates in front of it: the cross-check in `answer_work.js` (exit code 2 on
mismatch) and the integrity pre-check in `submit_work.js` (exit code 3 on a gap).

### Grade-checking: diff the detail page

After submitting, `work/view` shows “my answer / correct answer / explanation /
score” for every question — diff them to find exactly what went wrong.

## Layout

```
chaoxing-quiz-auto/
├── SKILL.md                      # the skill description the agent reads
├── README.md / README_EN.md      # Chinese / English docs
├── package.json                  # npm install; npm test
├── install.sh / install.ps1      # one-line install into a skills directory
├── scripts/
│   ├── takeover_browser.js       # browser takeover (cross-platform)
│   ├── lib.js                    # CDP, question model, form IO, mouse helpers
│   ├── answers_util.js           # pure functions: slot distribution, normalization
│   ├── extract_questions.js
│   ├── answer_work.js            # answer + cross-check
│   ├── submit_work.js
│   ├── check_result.js
│   └── run_all.js
├── references/
│   ├── chaoxing_page_model.md    # DOM, answer storage, submit flow
│   ├── grading_rules.md          # grading semantics and pitfalls
│   ├── answer_format.md
│   ├── troubleshooting.md
│   └── servlet_chapter3_answer_key.md
├── examples/answers.example.json
└── tests/                        # unit tests (node --test)
```

## What CI actually proves

The `CI` workflow runs on **ubuntu / macos / windows × Node 20 / 22 / 24**:

| Check | What it covers |
|---|---|
| Syntax | `node --check` on every `scripts/*.js` and `tests/*.js` |
| Unit tests | 9 cases: slot distribution, text normalization, answer-sheet validation, arg parsing |
| DOM test | runs `extractQuestions` against a sanitized snapshot of a real homework page: 57 questions, type distribution, option letters, editor-iframe index mapping (auto-skips when no browser is installed) |
| Skill spec | `SKILL.md` frontmatter must contain `name` and `description` |

**What CI cannot prove**: it never touches a real browser or a real student
account. “Can it really finish an assignment on a real machine?” only a real
machine can answer — that is what the *untested* cells in the matrix mean.

## Safety boundaries

- Talks **only to the local loopback** (`127.0.0.1` CDP port); no remote services
- Acts **only in the user's own browser and their own Chaoxing account**
- Never bypasses a captcha — if the platform asks for one, it stops and reports
- Never uploads course content or account data anywhere
- The human decides about submitting: `answer_work.js` stops on its own,
  submission is a separate command
- The temporary symlink lives in the system temp dir; deleting the link does not
  touch the real profile (never delete it recursively)

### Who actually does the answering

This tool **only takes over clicking and typing** — the answers themselves still have
to be derived (or at least approved) by the user, because `answers.json` is produced
from the question content by the user or their AI assistant.

If a course is an **end-of-term assessment**, whether to let a tool submit on your
behalf is your call; using it for chapter homework, practice runs or re-doing wrong
questions has no such issue. Say this out loud when you hand the work back.

## License

[MIT](LICENSE)
