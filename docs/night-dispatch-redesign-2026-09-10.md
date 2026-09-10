# Night Dispatch visual redesign

## Direction

The public entrance now uses a signal-red, porcelain-white and near-black palette inspired by late-night hospitality operations, restaurant pass screens and emergency dispatch systems. The central visual is the product lifecycle itself rather than a decorative receipt: a business broadcasts a need, the signal travels through the network and a worker confirms the position.

## Motion and truthfulness

- The eight-second dispatch loop animates a radar sweep, signal path, three real workflow states and a progress rail.
- A visible 44px pause/resume control pauses every perpetual animation in the hero console.
- Reduced-motion preferences receive the complete static state and no motion control.
- The console is labelled as an illustration of the process. It does not imply live users, shifts or activity.
- Decorative motion outside the console is finite; the role rail is static.

## Product and accessibility boundaries

- Worker registration, employer registration and returning login remain separate, direct paths.
- Authentication actions, callback behavior, Supabase access and marketplace data behavior are unchanged.
- Compensation and verification explanations remain explicit and do not claim money transfer or universal verification.
- Controls remain at least 44px, focus styles remain visible, and the 320px layout has no horizontal overflow.

## Verification

- The full 22-case local browser suite passed across desktop and mobile, including WCAG A/AA scans, keyboard navigation, 320px layout, reduced motion, pause/resume and both authentication intentions.
- Desktop homepage, mobile homepage, desktop login and mobile employer-registration captures were visually inspected with no browser errors.
