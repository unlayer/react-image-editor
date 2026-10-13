# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Fixed

- Support the image editor `dock` and `corners` options in `Features` ([#25](https://github.com/unlayer/react-image-editor/issues/25))

### Changed

- Use the modern JSX transform

### Internal

- Full (100%) test coverage and additional edge-case scenarios

## 1.0.2

### Fixed

- Contain exceptions thrown by a consumer's `onLoad` callback, so they can no longer surface as a wrapper failure ([#22](https://github.com/unlayer/react-image-editor/pull/22))

### Added

- Demo: image upload, so the demo can be tried with your own images

## 1.0.1

### Fixed

- Contain exceptions thrown by a consumer's `onError` callback, which previously escaped as an unhandled promise rejection ([#9](https://github.com/unlayer/react-image-editor/issues/9))
- Demo: auto-install demo dependencies in the root `dev` script, so a fresh clone works without a second `npm install` ([#8](https://github.com/unlayer/react-image-editor/issues/8))

### Added

- Demo: dark chrome for the top bar and sidebar

## 1.0.0

Initial release: the Unlayer Image Editor as a React component.
