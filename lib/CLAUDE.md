# coreliquid (library)

## Public surface

`Cooler` is the single entry point: `Cooler::scan()` -> `Cooler::open(spec)`
(or `Cooler::detect()` for both), then instance methods. The only other
exports are the data types those calls exchange (`ModelSpec`, `FanConfig`,
`FanStatus`, `ChannelCurve`, `ControllerError`, curve-point bounds).

- New capabilities become methods or associated functions on `Cooler`.
- Modules stay private; helpers backing `Cooler` are `pub(crate)`.
- hidapi types never appear in public signatures. `HidApi` contexts are
  created internally per call; they are cheap (hidapi 2.x allows multiple
  instances) and `HidDevice` does not need its context after open.
- Adding a model is a new file in `models/` plus one registry line, nothing
  else.

## When the surface changes

Update in the same change: rustdoc on the item, crate docs in `lib.rs` if the
consumer flow changed, and `lib/README.md` (the "What each piece does" and
Usage sections).

## Checks

Finish every change with `just check` from the workspace root. It must pass
with zero warnings; clippy runs with `-D warnings`.
