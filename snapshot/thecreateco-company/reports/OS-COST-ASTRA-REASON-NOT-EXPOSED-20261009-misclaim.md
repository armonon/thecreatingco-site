# Claim correction — OS-COST-ASTRA-REASON-NOT-EXPOSED-20261009

At 2026-10-09T16:32Z, `company.py claim --owner main-projects` was invoked while
starting the founder-directed WebLab prototype. The queue correctly selected its
highest eligible task, the unrelated cost-telemetry investigation, rather than
the intended WebLab task. No files, configuration, routing, or telemetry for the
cost task were inspected or changed.

The lease is being closed as BLOCKED solely to avoid leaving an accidental active
owner. The next owner should perform the original bounded investigation exactly as
specified by the task; this note is not evidence about the anomaly itself.
