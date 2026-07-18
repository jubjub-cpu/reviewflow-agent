# Architecture

ReviewFlow is a static local-first browser application with no backend, database, authentication, telemetry, or external AI call.

```text
Synthetic request and policy JSON
          |
          v
Pure workflow functions
  extraction -> classification -> rule checks -> plan -> draft
          |
          v
Browser state machine
  six visible stages -> internal gate -> outbound gate -> event export
```

`assets/analysis.mjs` contains shared pure functions. `assets/app.js` owns transient UI state and prevents blocked requests from reaching approval. Internal and outbound decisions are distinct fields in the exported record. User-edited text is escaped before rendering, and the export is created locally as a browser Blob.

The event log is demonstrative, not authoritative: reviewer identity is not authenticated and state is not persisted. No external action exists in v1.0.0.
