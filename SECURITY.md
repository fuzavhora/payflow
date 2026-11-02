# Security Policy

PayFlow is early-stage software and is not currently intended for production payment processing.

## Reporting a vulnerability

Do not publish exploitable vulnerability details in a public issue.

Please use GitHub's private vulnerability reporting feature for this repository, if enabled. Include:
- A concise description and impact.
- Affected commit, version, or component.
- Reproduction steps or proof of concept that does not expose real data.
- Suggested mitigation, if known.

Do not include live API keys, payment credentials, personal data, or cardholder data in a report.

## Security design constraints

- Never submit or store raw PAN, CVV, PIN, or track data in PayFlow.
- Use provider-hosted payment collection or provider tokenization.
- Treat all webhook payloads as untrusted until signature verification succeeds.
- Apply tenant authorization at the data-access boundary.
- Keep secrets out of logs, source control, and error messages.

## Disclosure

Please allow maintainers reasonable time to investigate and prepare a fix before public disclosure. No response-time or remediation SLA is currently guaranteed.
