# Streaming Contract (Canonical SSE)

This document is the single source of truth for Kai streaming across backend, native plugins, proxy, and frontend consumers.

## Scope

This contract is mandatory for:

- Import Portfolio stream (`/api/kai/portfolio/import/stream`)
- Optimize Portfolio stream (`/api/kai/portfolio/analyze-losers/stream`)
- Analyze Stock stream (`/api/kai/analyze/stream`)

No legacy stream payload shape is supported.

## Runtime Guardrails

- User-facing stream timeout is capped at `120s`.
- Producers emit heartbeat-safe `stage` updates roughly every `3-5s` while waiting for model chunks.
- Terminal behavior is mandatory: every stream ends with one terminal `complete` or `error`.

## Transport Format

All streams use Server-Sent Events with explicit event frames:

```text
event: <event_name>
id: <sequence>
data: <json envelope>

```

- `event` must always be present.
- `data` must be a single JSON object (canonical envelope).
- Multiline `data:` lines are allowed by SSE and must be reassembled before JSON parse.

## Canonical Envelope

```json
{
  "schema_version": "1.0",
  "stream_id": "strm_<uuid>",
  "stream_kind": "portfolio_import | portfolio_optimize | stock_analyze",
  "seq": 1,
  "event": "stage",
  "terminal": false,
  "payload": {}
}
```

Rules:

- `schema_version` is fixed to `1.0` for this release.
- `stream_id` is stable for a stream session.
- `seq` is strictly increasing within a stream.
- envelope `event` must match SSE `event:`.
- `terminal=true` is required on terminal events.
- `payload` must be an object.

## Event Sets

### Import Portfolio (`stream_kind=portfolio_import`)

- `stage`
- `thinking`
- `chunk`
- `complete` (terminal)
- `error` (terminal)

### Optimize Portfolio (`stream_kind=portfolio_optimize`)

- `stage`
- `thinking`
- `chunk`
- `complete` (terminal)
- `error` (terminal)

### Analyze Stock (`stream_kind=stock_analyze`)

- `kai_thinking` (optional telemetry)
- `agent_start`
- `agent_token`
- `agent_complete`
- `agent_error` (non-terminal agent-level failure)
- `debate_round`
- `insight_extracted` (optional, debate insight telemetry)
- `decision` (terminal)
- `error` (terminal)

Analyze payload rules:

- `agent_start`, `agent_token`, `agent_complete`, `agent_error` must include:
  - `round` (`1` or `2`)
  - `phase` (`analysis` or `debate`)
- `debate_round` must include `round` and `phase=debate`.
- `decision` must include `phase=decision`.

## Thought Events

Thought summaries are best-effort telemetry.

- UI must never depend on thought events for control-flow progression.
- Missing thought events is valid and must not block completion.

## Parser Requirements

Consumers must use block-based SSE parsing:

1. Split by blank line terminator (`\n\n` after CRLF normalization).
2. Collect multiline `data:` lines and join with `\n`.
3. Parse JSON once per complete frame.
4. Validate canonical envelope fields.
5. Verify `frame.event === envelope.event`.
6. Stop on terminal envelope and perform deterministic cleanup.

## Prohibited Legacy Shapes

The following are invalid for new or existing stream consumers:

- payload-only lines without explicit `event:` semantics
- routing logic based on `data.type` / `data.stage` without envelope validation
- mixed nested wrappers that require shape guessing

## Compatibility Policy

Streaming changes must preserve this contract.

- New events may be added if documented here.
- Existing fields may not be removed without a version bump.
- Any contract change requires parser tests and route-contract tests updates.
