# Reframe editable sessions

Use **Save editable session** to download a versioned `.json` sidecar containing the current crop settings, analyzed subject path, scene cuts, manual pins, and letterbox ranges. It does not contain the source video or an absolute media path, and Reframe does not autosave sessions in the browser.

To continue later, open the original video (or an identical renamed copy), wait for analysis to finish, then choose **Import / relink session** and select the saved JSON. Reframe verifies the media SHA-256, byte size, dimensions, and duration before restoring edits; filenames may differ. A different/transcoded file must be treated as a new source and cannot be relinked to the old session.

Sessions use the strict `scenepilot.reframe-session` version 1 schema. Unsupported versions, unknown fields, invalid values, malformed JSON, or media mismatches are rejected with an in-app status message; no stored path is followed.
