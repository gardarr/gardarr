# Categories UI Revamp: compact list and standardized dialog

## Delivered changes

The Categories view now presents categories as a compact, responsive list. The
desktop table and mobile cards retain the category icon, color, default
directory, tags, and metadata-source information while using less vertical
space. Each category provides a focused edit control that opens the existing
editing flow without making an entire row or card an implicit action.

`Categories` continues to use `getCategoryIcon` and `TagBadge` so the compact
layouts match the rest of the application.

`AddCategoryModal` now uses the shared `Dialog` primitives. `DialogContent`
contains the existing form controls, `Dialog` manages open and close behavior,
and `DialogFooter` provides the cancel and save actions. The existing create,
update, tag, directory, metadata-source, icon, and color behaviors were
preserved.

## Components

- `Categories` renders the compact category list and opens editing through an
  accessible edit button for each category.
- `AddCategoryModal` uses `Dialog`, `DialogContent`, and `DialogFooter` for a
  consistent create/update experience.

## Verification

- Frontend linting and unit tests cover the updated components without
  regressions.
- The Categories page supports loading, searching, creating, editing, and
  deleting categories on desktop and mobile layouts.
- The standardized dialog retains the editing rule that keeps the category
  name locked where required.
