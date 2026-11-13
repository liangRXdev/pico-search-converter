# pico-search-converter — Product & Engineering Specification

> Version: `0.1.0-draft`  
> Research verified: **2026-11-13** (Asia/Taipei)  
> Status: **Ready for MVP implementation; live syntax validation pending**  
> Target audience: clinicians, pharmacists, EBM educators, trainees, review authors  
> Working language: Traditional Chinese UI; English search terms and syntax

## 0. Executive decision

Build a **browser-only, deterministic PICO search syntax generator** that produces **three separate, copy-ready strategies**:

1. **PubMed (NLM interface; MEDLINE + PubMed additional records)**
2. **Embase.com (Elsevier interface; Emtree terminology)**
3. **Ovid MEDLINE (Wolters Kluwer / Ovid interface; MeSH terminology)**

**Important:** `Embase.com` is **not** `Ovid Embase`. They access related Embase content using different interface syntax. **Ovid Embase is outside the MVP.** PubMed and Ovid MEDLINE likewise are not guaranteed to contain identical records.

The tool **translates search expressions**, not their scientific meaning. Do not claim that a valid target query is clinically equivalent, that results are identical, that MeSH and Emtree headings map 1:1, or that an unexecuted query has been validated by the target database.

**Recommended teaching/demo use:** learner enters PICO free-text keywords and synonyms, sees how parentheses/Boolean operators are retained while field codes and syntax change, then copies each strategy to the database for checking.

### In scope, v1 MVP

- Structured P/I/C/O input with one or more terms per concept, and optional inclusion of each concept in the final AND expression.
- Free-text single terms, quoted phrases, and simple trailing `*` truncation.
- Generate PubMed / Embase.com / Ovid MEDLINE side by side.
- `OR` within a concept; `AND` between enabled concepts; fully explicit parentheses.
- Copy each strategy; copy all; `.txt` export; reset; built-in example.
- Conservative input validation, clear warnings, reproducible output, local-only processing.
- Optional **user-specified, verified** MeSH and Emtree headings (see Section 4.3): never silently fabricate a mapping.
- Direct link to PubMed with an appropriately URL-encoded query; Embase/Ovid copy-and-paste because access is commonly institutional.
- Unit tests, golden test fixtures, CI, and syntax-documentation references.

### Out of scope, v1

- General-purpose conversion of arbitrary pasted PubMed Boolean strings, line-numbered Ovid histories, nested `NOT`, advanced tags, date filters, language limits, clinical trial filters, search-result counts, API-based retrieval, automatic heading mapping, AI-generated synonyms, automatic PICO inference, true query execution on subscription resources, automatic sensitivity/recall claims, and proprietary provider authentication.
- Automatic conversion of PubMed's invisible **Automatic Term Mapping (ATM)** to any other database.
- Proximity conversion as a guaranteed equivalence (see Section 4.5).

---

## 1. Evidence basis — syntax rules

All examples describe **syntax**, not observed search results. Validate the exact output against each live vendor interface before production use.

### 1.1 Official source map

| System | Primary official documentation | Verification highlights |
|---|---|---|
| PubMed | [NLM PubMed User Guide](https://pubmed.ncbi.nlm.nih.gov/help/) (updated 2026-09-30) | `[tiab]`, `[ti]`, `[MeSH Terms]`, `[MeSH Terms:noexp]`, `*`, Boolean grouping, ATM, `[tiab:~N]` |
| Ovid MEDLINE | [Ovid Quick Reference Card (PDF)](https://tools.ovid.com/ovidtools/pdf/OvidQRC.pdf) (©2023) | Ovid Advanced Search, subject mapping, `.mp.` and Boolean search |
| Ovid search syntax, supporting detail | [NCBI Bookshelf — Ovid Syntax Guide](https://www.ncbi.nlm.nih.gov/books/NBK601822/table/t11/?report=objectonly) | `.ti`, `.ab`, `.kf`, `exp`, `adjN`, subject headings, wildcards |
| Embase.com | [Elsevier: field codes](https://www.elsevier.support/embase/answer/what-field-codes-can-i-use-in-embase) | `:ti`, `:ab`, `:kw`, `/de`, `/exp` |
| Embase.com | [Elsevier: Boolean, wildcards, proximity](https://www.elsevier.support/embase/answer/can-i-use-boolean-operators-wildcards-and-proximity-operators-in-embase) (updated 2026-03-06) | `AND`, `OR`, `NOT`, `NEAR/n`, `NEXT/n`, `*`, `?`, `$` |
| Embase.com | [Elsevier: how to search](https://www.elsevier.support/embase/answer/how-do-i-search-in-embase) (updated 2025-11-05) | Broad search vs explicit fields; built-in PICO search interface |
| Cross-platform official vendor translator | [Elsevier: PubMed-to-Embase translator](https://www.elsevier.support/embase/answer/pubmed-to-embase-translation-tool) | Suggested field mapping and heading mapping with warnings |
| Search design methodology | [Cochrane Handbook, Chapter 4](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-04) | Concept selection, controlled vocabulary, search sensitivity and reproducibility |

Ovid's public quick card is a concise vendor source rather than an exhaustive specification. For field-level distinctions, cite and independently review NCBI Bookshelf guidance and the chosen Ovid database's live **Search Fields** page. Vendor interface options can change.

### 1.2 MVP conversion matrix

| Search element | PubMed | Embase.com (Elsevier) | Ovid MEDLINE |
|---|---|---|---|
| Free-text title + abstract + keywords (approximate alignment) | `term[tiab]` | `term:ti,ab,kw` | `term.ti,ab,kf.` |
| Quoted multiword free text | `"heart failure"[tiab]` | `'heart failure':ti,ab,kw` | `"heart failure".ti,ab,kf.` |
| Title only (post-MVP toggle) | `term[ti]` | `term:ti` | `term.ti.` |
| Boolean | `AND`, `OR`, `NOT` | `AND`, `OR`, `NOT` | `and`, `or`, `not` (case-insensitive; output uppercase acceptable) |
| Grouping | `( ... )` | `( ... )` | `( ... )` |
| Right-side truncation | `diabet*` | `diabet*` | `diabet*` or `diabet$` |
| Exploded subject heading | `"Hypertension"[MeSH Terms]` | `'verified Emtree term'/exp` | `exp Hypertension/` |
| Non-exploded heading | `"Hypertension"[MeSH Terms:noexp]` | `'verified Emtree term'/de` | `Hypertension/` |
| Proximity — **not v1** | `"term1 term2"[tiab:~N]` | `term1 NEAR/n term2` | `(term1 adjN term2).ti,ab,kf.` |

**Semantic caution:** `[tiab]`, `:ti,ab,kw`, `.ti,ab,kf.` are useful teaching-level approximations, **not guaranteed identical field coverage**. PubMed `[tw]` is not the same as Ovid `.mp.`; Ovid `.mp.` can depend on database/configuration. Do not use a blind `[tw] → .mp.` rule.

**ATM caution:** Untagged PubMed text invokes Automatic Term Mapping; explicit field tags, quoted phrases and truncation can change or suppress it. v1 uses explicit fields to make the translation inspectable; it does not reproduce the hit set of an untagged PubMed query.

**Wildcard caution:** PubMed `*` can replace zero or more characters and requires **at least four characters before its first wildcard**. Elsevier Embase describes `*` as variable truncation and recommends at least three characters before it. Because vendor meanings/limits vary, v1 accepts **only trailing `*` after at least four literal letters** and warns that cross-platform retrieval may still differ. Internal `*`, `?`, `$`, leading wildcards, and multiple wildcard forms are explicitly unsupported in v1. Retain `*` for Ovid because the documented Ovid search syntax supports this suffix; do not assume other wildcard forms are interchangeable.

### 1.3 Controlled vocabulary is a different problem from punctuation

- **PubMed MeSH → Ovid MEDLINE MeSH:** the indexing language is MeSH in both, but live heading availability and explosion must still be checked; explicitly preserve `exploded` vs `non-exploded` intent.
- **MeSH → Embase Emtree:** **never automatically substitute the English MeSH label** and add `/exp`. These are distinct vocabularies with different preferred headings and trees.
- If an Embase Emtree term was **not verified by the user**, output *only free text* in the Embase copy-ready strategy and show an **out-of-band** warning: `Emtree mapping requires verification`; never insert invalid `[TODO]` into the copy-ready string.
- A missing subject heading must not suppress valid free text. Do not claim automatic synonym expansion unless implemented and transparently reported.
- If heading is confirmed, each concept is assembled as `(verified heading OR free-text synonyms...)`, not as `heading AND free text`.
- Text entered in the heading field is *user-supplied*, not evidence that a controlled term actually exists in a vendor thesaurus.

### 1.4 Proximity search: explicitly deferred

PubMed proximity syntax is `[tiab:~N]` for words in **any order**, with no wildcards; Embase.com uses `NEAR/n` (unordered) or `NEXT/n` (ordered); Ovid uses `adjN` (unordered). The definition of `N` is **not identical** across platforms. For example, Elsevier states `NEAR/1` means adjacent words; PubMed `~0` means no words in between. **Do not use a naive numeric substitution**. v1 parser must reject proximity constructs with an actionable explanation; v1.1 may support only tested, explicitly documented mapping with a non-equivalence warning.

---

## 2. Product behavior

### 2.1 User workflow

1. Choose a built-in EBM teaching example or enter English terms for **P** and **I**; **C** and **O** are optional.
2. Add free-text synonyms via **one term per line**. Explicit exact phrase: optional quotes; if text contains whitespace and is not a wildcard, the UI normalizes to an exact phrase for output.
3. Optional advanced section: add **verified MeSH** and **verified Emtree** headings separately (one term per entry, explosion toggle). This is opt-in.
4. Select which P/I/C/O blocks to include in the final `AND`. Default: **P + I ON**, **C/O OFF** even if populated; show which blocks are omitted.
5. Click **Generate** (also allow live preview after valid input). See three tabs/cards, each showing a copy-ready expression, `Copy`, and the per-platform warnings.
6. Review warnings. Copy each query into the corresponding database and verify search details / terms / hit sets. Export `.txt` including queries, warnings, provenance, and generation date if desired.

### 2.2 UI acceptance requirements

- Traditional Chinese labels, English syntax, mobile-first responsive layout; no horizontal overflow in normal text, with wrapping or horizontal scroll *inside* a code panel only.
- Minimum viable components: P/I/C/O panels; term entry; add/remove term; include block switch; generate/reset/example buttons; three database outputs; copy and TXT download; inline validation, notices; official links.
- Show exactly which database **platform** is meant (`Embase.com, not Ovid Embase`).
- Copy button copies **only executable query text**, never warnings or markdown fences.
- Accessible labels, semantic buttons and keyboard support; copy confirmation after clipboard API success or fallback.
- No login, API key, telemetry, or remote search required for v1.
- Error messages tell the user how to fix the term, never silently drop an invalid term.

### 2.3 Nonfunctional requirements

- Fully static deploy to GitHub Pages or Cloudflare Pages. Offline functionality after initial load is acceptable but **PWA/offline install is not required**.
- Core engine deterministic and side-effect free; output order stable; input normalizes Unicode whitespace and line breaks, not meaning.
- User-entered clinical or patient information must **not** be transmitted: no analytics, network term-lookup, backend, or logging of entered content by default. Include UI reminder not to enter patient-identifying information.
- Render user data as text, never with untrusted `innerHTML`. CSV/JSON exports deferred; TXT uses UTF-8 and no sensitive platform logs.
- No silent external AI calls or automatic generation of synonyms.
- No claim of systematic-review-grade completeness or vendor validation without live testing.

---

## 3. Internal data model and render pipeline

### 3.1 Recommended architecture

`UI inputs → normalize + validate → structured query model (AST) → platform emitters → warnings + copied/exported query`

Avoid regex-only global search/replace over a complete query. Separate **logical meaning** from **rendering syntax** to prevent Boolean precedence errors.

Suggested module boundaries (TypeScript + Vite + Vitest; no runtime back end):

```text
pico-search-converter/
├── spec.md
├── README.md
├── package.json
├── index.html
├── src/
│   ├── main.ts
│   ├── model/types.ts
│   ├── core/normalize.ts
│   ├── core/validate.ts
│   ├── core/buildAst.ts
│   ├── render/pubmed.ts
│   ├── render/embaseCom.ts
│   ├── render/ovidMedline.ts
│   ├── render/escaping.ts
│   ├── export/txt.ts
│   └── ui/...
├── tests/
│   ├── golden/*.json
│   ├── validation.test.ts
│   ├── renderers.test.ts
│   └── ui.test.ts
└── .github/workflows/ci.yml
```

Single `index.html` without a build step is also acceptable **only** if pure syntax functions remain separately testable; the teaching goal does not justify sacrificing regression tests.

### 3.2 Canonical JSON model

```json
{
  "schemaVersion": "1.0",
  "searchMode": "explicit_free_text",
  "blocks": [
    {
      "id": "P",
      "enabled": true,
      "freeText": ["hypertension", "high blood pressure"],
      "mesh": [],
      "emtree": []
    },
    {
      "id": "I",
      "enabled": true,
      "freeText": ["exercise", "physical activity"],
      "mesh": [],
      "emtree": []
    },
    { "id": "C", "enabled": false, "freeText": [], "mesh": [], "emtree": [] },
    { "id": "O", "enabled": false, "freeText": ["blood pressure"], "mesh": [], "emtree": [] }
  ]
}
```

Controlled-term shape when enabled:

```json
{
  "term": "Hypertension",
  "explode": true,
  "verification": "user_confirmed",
  "source": "user_input"
}
```

No hardcoded MeSH-to-Emtree term crosswalk in v1. The `verification` string is provenance of user confirmation, **not an external ontology verification result**.

### 3.3 AST design

```ts
type ConceptId = 'P' | 'I' | 'C' | 'O';
type TermNode =
  | { kind: 'freeText'; value: string; phrase: boolean; trailingTruncation: boolean }
  | { kind: 'mesh'; value: string; explode: boolean }
  | { kind: 'emtree'; value: string; explode: boolean };

type Expr =
  | { kind: 'term'; term: TermNode }
  | { kind: 'or'; children: Expr[] }
  | { kind: 'and'; children: Expr[] };

type Result = {
  platform: 'pubmed' | 'embase-com' | 'ovid-medline';
  query: string;
  warnings: { code: string; severity: 'info' | 'warning' | 'error'; message: string }[];
};
```

Platform renderers select terms appropriate to their controlled vocabulary, plus **all common free-text terms**. For a verified MeSH heading, PubMed + Ovid MEDLINE may render it, while Embase.com **must not** auto-promote it to Emtree.

---

## 4. Formal MVP rules

### 4.1 Input grammar

- Each entry is a **single term or phrase**, one per line. A comma **does not** split terms, because it can occur in legitimate subject headings. A raw line must not contain `AND`, `OR`, `NOT` outside a phrase or platform field tags; these are not the user's responsibility in structured input.
- Term types: `singleWord`, `exactPhrase`, `suffixTruncation`.
- Strip redundant outer straight/curly quotation marks from free-text entries, then re-quote according to platform. Preserve original character spelling; normalize whitespace and remove duplicate terms **within each block only**, case-insensitively.
- `*` permitted **only at the end of a single token** with ≥4 letters before it. No `*` inside quoted/multiword phrases in v1; no `?`, `$`, brackets `[]`, slash commands, proximity keywords or field tags. Show a blocking error and suggested correction.
- Terms containing apostrophes or quote characters need platform-specific escaping and test coverage; if safe rendering cannot be guaranteed, **reject with actionable message**, never alter the scientific term silently.
- Inactive blocks are saved in UI state but excluded from rendered expression. Empty active block → block generation; require at least one active block, default prompt encourages P + I.
- De-duplication is case-insensitive, **not** fuzzy spelling correction or stemming.
- Never silently remove O or C; display an explicit “Not included in search” notice when populated but disabled.

### 4.2 Boolean generation

- Every block: `(term1 OR term2 OR ...)`, with its applicable subject headings OR'd alongside free text.
- Every included block: `(<P expression>) AND (<I expression>) [AND ...]` with explicit parentheses. Retain `P → I → C → O` order.
- If only one term exists in a block, keep parentheses for consistency. No `NOT` in v1 (can reduce recall and is easily misapplied).
- Render output as a **single executable query** per platform. Ovid numbered multi-line search histories are a separate feature, not just prepending line numbers to the query.

### 4.3 Subject-heading rules (optional advanced panel)

| Input | PubMed | Ovid MEDLINE | Embase.com |
|---|---|---|---|
| Verified `mesh` exploded | `"TERM"[MeSH Terms]` | `exp TERM/` | No heading emission; warning if no Emtree supplied |
| Verified `mesh` not exploded | `"TERM"[MeSH Terms:noexp]` | `TERM/` | No heading emission; warning if no Emtree supplied |
| Verified `emtree` exploded | No heading emission | No heading emission | `'TERM'/exp` |
| Verified `emtree` not exploded | No heading emission | No heading emission | `'TERM'/de` |

- Escape platform-unsafe characters; never concatenate a heading directly into syntactic delimiters without validation.
- Emtree names are often different from MeSH names; require user to enter and confirm separately. Provide links to [NLM MeSH Browser](https://meshb.nlm.nih.gov/) and [Elsevier Embase search help](https://www.elsevier.support/embase/answer/how-do-i-search-in-embase).
- When MeSH is provided, Ovid MEDLINE's output may preserve the MeSH label, but warn to validate it in Ovid's heading browser (tree/version differences).
- If a block has only a controlled-vocabulary heading incompatible with a target platform and **no free text**, emit a **blocking error for that target** (not an empty OR group or a misleading query).

### 4.4 Platform emitters

**PubMed:**

- `term[tiab]`
- `"multiword phrase"[tiab]`
- `stem*[tiab]`
- `"Verified Heading"[MeSH Terms]` (exploded) / `[MeSH Terms:noexp]` (unexploded)
- Use uppercase `AND`/`OR` and parentheses.
- Link generation: `https://pubmed.ncbi.nlm.nih.gov/?term=` + `encodeURIComponent(query)`; do not use raw unencoded `&`, `#`, `[`, `]` in the URL.

**Embase.com (Elsevier):**

- `term:ti,ab,kw`
- `'multiword phrase':ti,ab,kw`
- `stem*:ti,ab,kw`
- `'Verified Emtree Heading'/exp` or `/de`.
- Preserve all explicit Boolean grouping. Warn that the same results are not guaranteed as PubMed. Do **not** rewrite Emtree terms from MeSH guesses.

**Ovid MEDLINE:**

- `term.ti,ab,kf.`
- `"multiword phrase".ti,ab,kf.`
- `stem*.ti,ab,kf.`
- `exp Verified Heading/` or `Verified Heading/`.
- An OR block may be compacted into `(term1 OR "multiword phrase").ti,ab,kf.` for compatible free-text terms, but simplest correct renderer is per-term fields inside an OR block. **Prefer per-term fields for predictable escaping**.
- Do not emit `:ti,ab,kw` or Emtree headings for Ovid MEDLINE.

### 4.5 Deferred syntax support matrix

| Feature | v1 | Future handling |
|---|---|---|
| PICO structured synonyms | **Yes** | — |
| `OR` synonyms and `AND` blocks | **Yes** | — |
| Exact phrase | **Yes** | Phrase-index/vendor behavior to be reviewed |
| Suffix `*` only | **Yes** | Internal, limited, 1-char wildcards require separate validation |
| Verified MeSH/Emtree headings | **Opt-in** | Vendor-backed verification/mapping integration |
| Raw pasted PubMed syntax, full AST parse | **No** | v1.1+ strict grammar + source-to-target rendering |
| PubMed ATM expansion | **No** | Use PubMed Search Details as explicit input, never infer silently |
| Proximity | **No** | Test per-platform distances and order semantics |
| Date/language/publication filters | **No** | Vendor-specific rules and audit trail |
| Ovid history line references `#1`, `1 and 2` | **No** | Parser and replay/export format |
| Direct Embase/Ovid query execution | **No** | Only if authorized vendor APIs and institutional access exist |

---

## 5. Golden example (fixed expected output)

User input:

```yaml
P: [hypertension, "high blood pressure"]
I: [exercise, "physical activity"]
C: []
O: ["blood pressure"]
include: [P, I]
```

**PubMed**

```text
(hypertension[tiab] OR "high blood pressure"[tiab]) AND (exercise[tiab] OR "physical activity"[tiab])
```

**Embase.com (Elsevier)**

```text
(hypertension:ti,ab,kw OR 'high blood pressure':ti,ab,kw) AND (exercise:ti,ab,kw OR 'physical activity':ti,ab,kw)
```

**Ovid MEDLINE**

```text
(hypertension.ti,ab,kf. OR "high blood pressure".ti,ab,kf.) AND (exercise.ti,ab,kf. OR "physical activity".ti,ab,kf.)
```

Expected user-facing note: `O is populated but excluded from the search. P and I are enabled. These are structural translations; verify real database results manually.`

**Note:** This is a **syntax fixture**, not a validated high-sensitivity hypertension/exercise search; missing synonyms and headings are intentional to make the classroom example understandable.

---

## 6. Quality assurance and CI

### 6.1 Required automated tests

| ID | Test | Expected result |
|---|---|---|
| T01 | P and I each contain 2 terms | Correct three outputs; `OR` inside, `AND` between |
| T02 | C/O populated but disabled | Excluded; explicit notice; retained in form |
| T03 | Enable C/O | Included as additional `AND` blocks |
| T04 | Only P enabled | Valid one-block query and nonfatal methodology note |
| T05 | All blocks empty / enabled empty | Blocking validation error |
| T06 | Repeated synonym/case change/whitespace | Within-block stable deduplication |
| T07 | `diabet*` | Valid trailing wildcard in all three outputs |
| T08 | `cat*` | Rejected: fewer than four letters before first PubMed wildcard |
| T09 | `tumo*r`, `cardio?`, `heart$` | Rejected: unsupported wildcard forms |
| T10 | `"heart failure"` | Correct platform-specific phrase quoting |
| T11 | Unbalanced parentheses or raw `AND` in term | Rejected; no silent repair |
| T12 | Verified MeSH (explode true/false) | Correct PubMed/Ovid syntax; NOT falsely mapped to Emtree |
| T13 | Verified Emtree (explode true/false) | Correct Embase syntax; NOT copied as MeSH |
| T14 | MeSH only, no text, Embase render | Blocking error; no false success |
| T15 | Simple field tags `[tw]`, `[tiab]` pasted into structured input | Rejected; guide to supported input mode |
| T16 | Raw PubMed proximity `[tiab:~3]` | Rejected in v1 with future-feature explanation |
| T17 | Special characters / HTML tags / JavaScript-looking text | Display as text only; no XSS or broken query |
| T18 | Unicode spaces, curly quotes, CRLF | Normalized or blocked explicitly, deterministically |
| T19 | More than allowed terms / very long entry | Input limit + clear validation message; UI responsive |
| T20 | Copy query | Clipboard contains query only, without warnings |
| T21 | Export | All three queries, disclaimer, generated date, source links; UTF-8 |
| T22 | PubMed open link | `encodeURIComponent` roundtrip yields exact query |
| T23 | No-network offline render | Generation, copy/export still function after initial load |
| T24 | Keyboard-only navigation + screen reader labels | Interactive controls are operable and labeled |
| T25 | Repeated same model input | Byte-for-byte same queries (except export timestamp) |

Add regression tests for quote escaping and headings containing punctuation before enabling those entries. For v1, **reject ambiguous characters rather than output a potentially false query**.

### 6.2 CI / deployment

- Commands: `npm ci`, `npm run typecheck`, `npm run test`, `npm run build`.
- GitHub Actions on PR and default-branch push; build/deploy only after checks pass.
- Publish to GitHub Pages **or** Cloudflare Pages. Do not depend on deployment platform for logic.
- Static type checking and unit tests verify **our rendering rules**, not the target search vendors' live parsers.
- Before a public release, perform at least one **manual paste-and-run check in each institution-accessible interface**: PubMed, Embase.com, and Ovid MEDLINE. Record date, database name/version, exact query, syntax errors, and warnings. If institutional Embase/Ovid access is unavailable, release only as `unverified` for those targets and do not claim live interoperability.

### 6.3 Usability / performance bounds (design choices)

- Suggested max **30 terms per concept**, **200 characters per term**, **10,000 characters final query**. These are UI safety limits, **not documented vendor limits**. Make them configurable and show clear errors.
- Suggested goal: generation response under **100 ms** for normal sample inputs on a current desktop; test on slower phones.
- Clipboard fallback supported; no network dependency or rate limits for generation.

---

## 7. Academic / safety guardrails

1. Always show that the three outputs are **syntax translations** and field coverage is approximate, not complete scientifically validated search strategies.
2. Make the difference between **MeSH** and **Emtree** conspicuous. Unverified cross-ontology mappings must not be silent.
3. Avoid excessive PICO block `AND`s by default: requiring C/O can harm sensitivity. Users explicitly decide whether to add them.
4. Advise learners to run each query, inspect *Search Details* and subject headings, compare known relevant papers, and document the search date, exact string, database and platform.
5. Do not promise equal retrieval counts between PubMed and Ovid MEDLINE: they differ in interface mapping and coverage.
6. No patient identifiers, protected health information, stored API tokens, vendor credentials or hidden prompts in the static app.
7. Where practical, use PRISMA-S / PRESS principles for future high-stakes search audit, without claiming certification.

---

## 8. Existing projects and reuse assessment (checked 2026-11-13)

| Project | URL | Relevant features / distinction | License reported | Recommendation |
|---|---|---|---|---|
| **Polyglot Search Translator / SRA** | https://github.com/IEBH/sra-polyglot | Translates PubMed/Ovid query syntax into many destinations including Elsevier Embase; AST-like structural work, warnings and templates | **MIT** in repo | **Primary reference** for transformation rules, tests, warnings; avoid copying large code without preserving license |
| **QueryBee** | https://github.com/mafatlalmkher-cpu/querybee | Single-file frontend, user-built concept blocks, many database emitters; optional MeSH lookup; separates term discovery from deterministic syntax assembly | **MIT** in repo | **Primary reference** for easy classroom UI and static deployment; it reports that specialist databases lack controlled-vocabulary mappings |
| **search-strategy-builder** | https://github.com/wangj1758/search-strategy-builder | PICOS, many target databases, field codes, cross-database translation, term dictionary and AI tools | **MIT stated in README** | **Feature benchmark**; scope is considerably larger than proposed MVP |
| **Medline Transpose** | https://medlinetranspose.github.io/ | PubMed↔Ovid MEDLINE translation with cautions for non-equivalent syntax; not an Embase.com translator | Article describes public code under MIT; verify actual code/license before reuse | **Methodological reference**; especially warnings and Ovid/MeSH semantics |
| **search-hub** | https://github.com/ncukondo/search-hub | YAML-style search DSL, logs, validation and retrieval; repo says **Embase is planned**, so don't treat it as a fully implemented Embase runner | **MIT** in repo | Future reproducibility reference; overkill for browser-only workshop |

User-provided inspiration: https://sunflorafsketch.github.io/sr-ebm-happy-searchhen . Features and exact source license of that site are **not independently audited here**. Reimplementing a general idea is distinct from copying protected code/UI assets; follow each repository's actual license. GitHub being public does **not automatically grant reuse rights**: [GitHub official license guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).

**Differentiation:** `pico-search-converter` prioritizes transparent PICO blocks, just **three specifically labeled targets**, explicit heading-mapping warnings, easily taught syntax, small frontend footprint, and deterministic tests rather than becoming another full systematic-review platform.

---

## 9. Iteration plan

### Phase 1 — MVP (implement now)

- Four-block UI (P/I/C/O) with term inputs, enable switches, example, reset.
- Deterministic AST and three target renderers; free text, phrases, suffix `*`.
- Subject headings only when separately entered and confirmed; headings may be hidden under an Advanced panel for the first workshop demo.
- Copy/export, warnings, unit tests, CI, static deploy.

### Phase 2 — After classroom / institutional validation

- Optional paste-in **limited PubMed query parser**, with explicit recognized grammar and errors; no silently lossy translation.
- Optional PubMed Search Details / MeSH lookup via NLM documented services; transparent queries and rates, with privacy review.
- Vendor-tested proximity translation, controlled filters, Ovid history format.
- Search audit log and validation against known relevant studies (seed-paper check).

### Phase 3 — Only if demand warrants it

- Proper MeSH→Emtree suggestion and validation workflow (may require Elsevier subscription/service terms); user approval mandatory.
- Additional engines such as Ovid Embase / Cochrane / Scopus.
- External data import/export and optional PRISMA-S documentation generator.

## 10. Definition of Done — Phase 1

- [ ] A novice pharmacist can enter a two-concept example and obtain three clearly labeled, syntactically distinguishable outputs without installation.
- [ ] Every copied result preserves explicit Boolean grouping and uses the correct **vendor interface** field codes.
- [ ] Headings never silently change ontology; unsupported syntax yields errors, not fake equivalence.
- [ ] T01–T25 pass locally and in GitHub CI.
- [ ] No patient content or terms leave the browser for rendering; no secrets are required.
- [ ] At least one manual execution check per target has been recorded, **or** that target is prominently marked “Not live-validated”.
- [ ] `README.md` states supported syntax, unsupported syntax, source links, and validation limitations.

---

## 11. First implementation instruction for Claude Code / Codex

> Read `spec.md` completely. Implement **Phase 1 only** as a static TypeScript + Vite website. Start with `src/core` and `src/render` pure functions plus unit tests and golden fixtures before UI. Do not invent MeSH-to-Emtree mappings, add AI, add runtime network calls, or support unsupported syntax with silent best-effort conversion. Treat user input as text, escape safely, preserve PICO parentheses and Boolean logic, and clearly label `Embase.com (Elsevier)` versus `Ovid MEDLINE`. After implementation run `npm run typecheck`, `npm test` and `npm run build`, and report any vendor-live testing that remains unverified.
