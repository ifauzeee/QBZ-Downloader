# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 5.x     | ✅ Active |
| < 5.0   | ❌ No     |

## Reporting a Vulnerability

QBZ Downloader stores user credentials (Qobuz authentication tokens, API keys) locally. If you discover a security vulnerability, please report it privately.

- **Email**: Create an issue with *security* label or reach out via GitHub Discussions
- **Response time**: Within 48 hours, you will receive acknowledgment
- **Disclosure**: We follow coordinated disclosure — please allow 90 days before public disclosure

## What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Any proposed fix (optional)

## Security Practices

- Credentials are encrypted at rest using Electron `safeStorage` when available, with a file-based AES-256-CBC fallback for non-Electron environments
- Dashboard passwords are hashed with SHA-256 before storage
- Content Security Policy restricts `connect-src` to localhost and Qobuz endpoints
- `unsafe-eval` is not permitted in CSP
- All secrets are scoped to the local machine and never transmitted
