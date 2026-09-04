# Security Policy

## Supported versions

Security fixes land on the latest released minor version. Please upgrade to the
latest release before reporting.

## Reporting a vulnerability

**Please do not open a public issue for a security report.**

Use GitHub's private vulnerability reporting instead:
[Report a vulnerability](https://github.com/unlayer/react-image-editor/security/advisories/new).
That opens a private advisory visible only to you and the maintainers.

Please include:

- the version of `@unlayer/react-image-editor` affected
- a description of the issue and its impact
- steps to reproduce, ideally a minimal example
- any suggested mitigation

You can expect an acknowledgement within a few business days. We will keep you
updated as we work on a fix, and will credit you in the advisory unless you ask
otherwise.

## Scope

This repository is the React wrapper. It loads the Unlayer Image Editor from a
CDN at runtime, so issues in the editor itself, or in Unlayer's hosted APIs, are
outside this repository — report those to Unlayer directly.
