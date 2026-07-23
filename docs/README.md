# `docs/` — project documentation

Reference material that isn't code. Split by audience: what we're building, and what it
should look like.

```
product/
  Bingo_PRD.docx        the product requirements doc (source of truth for scope)
  Bingo_PRD.txt         plain-text extract of the same, for grep/diff
  TODO.md               the running build punch list — check items off as they land

design/
  SortScan-UI-Spec.txt  the original screen-by-screen UI spec. Superseded by the brand
                        guide wherever the two disagree on colour or type.
  branding/
    BRAND_GUIDE.md      the brand rules in prose — voice, logo, colour, typography
    design-tokens.json  the tokens as data
    theme.ts            the tokens as TypeScript; mirrored at src/ui/brand.ts
```

## Notes

- **`design/branding/theme.ts` and `src/ui/brand.ts` are two copies of one thing.** The
  docs copy is the design source of truth; the src copy is what ships. Change both together.
- **The PRD `.docx` is tracked on purpose.** Word's transient `~$` lock files are gitignored.
- Architecture and the reasoning behind past decisions live in `CLAUDE.md` at the repo root,
  not here.
