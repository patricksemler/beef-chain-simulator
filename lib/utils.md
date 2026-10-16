# `lib/utils.ts` — `cn()` class-name helper

**Role:** Exports `cn(...inputs)`, which joins conditional class names (`clsx`) and resolves conflicting Tailwind classes (`tailwind-merge`). For example, `cn('px-2', isWide && 'px-4')` returns `'px-4'`.

## Why it exists

It's the standard shadcn/ui helper. Every component in `components/ui/*` and many app components use it, so conditional styling stays short and later classes override earlier ones predictably.

## Where it fits

- **Imports:** `clsx` and `tailwind-merge`.
- **Imported by:** most of `components/ui/*` and several app components via `@/lib/utils`. It has no model or assistant logic.

## Testing

There's no test, because it's a two-library wrapper. If you change it, `npm run typecheck` and a visual check of any page (`npm run dev`) are enough.

To add a test: `cn('px-2', 'px-4') === 'px-4'`, and `cn('a', false, undefined, 'b') === 'a b'`.

## When changing this file

shadcn's CLI (`components.json`) expects `cn` at this path. Don't rename or move it.
