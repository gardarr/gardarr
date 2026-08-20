# Categories UI Revamp: compact list + standardized dialog

## Context

`Categories.tsx` (`frontend/src/Categories.tsx`) renders categories in a
`sm:grid-cols-2 lg:grid-cols-4` grid of large cards (64px icon, generous
padding, several stacked content lines) — high vertical footprint for
little information density.

The create/update dialog (`frontend/src/components/AddCategoryModal.tsx`)
is a custom modal built from a fixed `div` + manual backdrop, while the
rest of the app — including the delete-confirmation dialog on the same
page (`Categories.tsx:270-323`) — uses the shared `Dialog`/`DialogContent`
component from `@/components/ui/dialog` (Radix-based).

Goal: replace the card grid with a compact horizontal list, and rebuild
the create/update modal on top of the standard `Dialog` component.

## 1. Cards → compact horizontal list

In `Categories.tsx`, replace the card grid (lines 202-266) with a
vertical list of compact rows:

- Container: a single `Card` wrapping a `divide-y` list (or bordered rows)
  instead of a grid of separate `Card` elements.
- Each row: small icon (~32-36px, down from 64px) + name on the left,
  tags (`TagBadge`) and directory inline to the side, all on one line via
  `flex items-center justify-between gap-3`, with `truncate` where needed.
- Keep `onClick={() => startEditCategory(category)}` to open editing, and
  the existing hover state (`hover:bg-accent/50`).
- Keep the loading/empty states as-is unless they need minor adjustment.
- Reuse `getCategoryIcon` (`utils/categoryUtils.ts`) and `TagBadge`
  (`components/ui/TagBadge.tsx`) — already used today.
- `metadata_source` can become a small inline icon/label instead of its
  own line.

## 2. Dialog create/update → standard `Dialog` component

Rewrite `AddCategoryModal.tsx` using `Dialog`, `DialogContent`,
`DialogHeader`, `DialogTitle`, `DialogFooter` from
`@/components/ui/dialog`, matching the delete modal in
`Categories.tsx:270-323` and other app modals (e.g.
`EditIntegrationWebhookModal.tsx`).

Changes:

- Remove the manual structure (`fixed inset-0`, backdrop `div`,
  click-to-close handler) — `Dialog` handles this via `open`/`onOpenChange`.
- Use `DialogHeader`/`DialogTitle` for the header (title + icon/color +
  name when editing).
- Keep all existing state/handlers (`createForm`, `tagInput`,
  `handleSubmit`, `addTag`, `removeTag`, `handleDirectoryChange`,
  `handleMetadataSourceChange`) — only the visual wrapper changes.
- Use `DialogFooter` (`components/ui/dialog.tsx:70-82`) for the
  Cancel/Save buttons.
- `DialogContent` accepts `className` (merged via `cn`) — use
  `className="max-w-2xl max-h-[90vh] overflow-y-auto"` like the current
  modal. It already renders its own close (X) button, so drop the manual
  X button from the custom header.
- Keep the icon/color picker grid as-is (no tabs — only the wrapper
  component changes).

## Affected files

- `frontend/src/Categories.tsx` — card grid → compact list
- `frontend/src/components/AddCategoryModal.tsx` — rewritten with `Dialog`

## Verification

- `cd frontend && npm run lint`
- `cd frontend && npx vitest run` (no dedicated `AddCategoryModal`/`Categories`
  tests exist today, but run the full suite to check nothing else regresses)
- `make dev`, open `/categories`, test: list, search, create category, edit
  (name must stay locked while editing, same rule as today), delete,
  mobile/desktop responsiveness.
