# Security

The generation CLI reads local UTF-8 files and writes local XML. It does not spawn subprocesses, call cloud APIs or upload data. Developer benchmark/test scripts spawn the local Node CLI. The optional fixture-regeneration script invokes Terraform init/plan/show only when explicitly run; it may download providers. It is not part of pnpm test or generate, and must not run apply.

Only explicit architectural attribute names are copied. Nested structures have explicit child-key lists. Whole-field sensitivity masks redact values; nested sensitivity conservatively drops the affected field. Outputs, output_changes values, provider config, configuration constants, user data and credentials are not copied into graph attributes. Test-secret markers are scrubbed from display strings and graph metadata. Unknown-value and sensitivity masks are separate concepts.

Unmarked arbitrary secrets cannot all be detected. Resource addresses, names and allowed attributes may still contain data the user considers confidential. Review artifacts before sharing. Raw Terraform exports often contain plaintext secrets; do not commit production inputs. Do not treat these tests as a security audit or a complete DLP system.

XML is produced with XMLBuilder and plain-text labels. The validator rejects DTD/entity declarations and tests known fixture-secret patterns. Parser errors exposed by CLI do not echo raw malformed JSON or schema values. Missing/invalid config fails, unknown CLI choices fail, and input/config overwrite is blocked. Resource-based denial-of-service limits and filesystem symlink overwrite protection need further hardening.
