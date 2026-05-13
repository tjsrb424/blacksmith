# Localization Guide

This sprint prepares the i18n foundation for `세계 최강의 대장장이`.
It intentionally does not wire translated strings into the active UI, because a separate UI development task is in progress.

## Supported Locales

| Locale | Label |
| --- | --- |
| `ko` | 한국어 |
| `en` | English |
| `ja` | 日本語 |
| `zh-TW` | 繁體中文 |

The default fallback locale is `en`.

## File Structure

- Locale definitions: `src/lib/i18n/locales.ts`
- Browser detection: `src/lib/i18n/detectLocale.ts`
- Saved preference helpers: `src/lib/i18n/localeStorage.ts`
- Translation lookup: `src/lib/i18n/t.ts`
- Message files: `src/locales/*.json`

## Key Naming Rules

- Use dot paths grouped by feature area, such as `common.ok`, `nav.shop`, and `blacksmith.enhance`.
- Keep keys semantic rather than copying the source text into the key.
- Prefer lower camel case for leaf keys: `enhanceCost`, `notEnoughGold`, `myRank`.
- Reuse `common.*` for shared actions and labels.
- Add new feature groups only when the text belongs to a clear domain.

## Adding New Text

1. Add the same key to all locale JSON files.
2. Use the glossary in `docs/LOCALIZATION_GLOSSARY.md` for core game terms.
3. Verify that `t(locale, "path.to.key")` returns the expected string.
4. If a translation is not ready, add a reasonable temporary value in every locale rather than leaving missing keys.

Missing keys fall back to `en`. If the key is also missing in English, `t` returns the key itself.

## Initial Locale Detection

`detectInitialLocale()` chooses the first locale in this order:

1. A valid saved value from `localStorage`
2. Browser or OS languages from `navigator.languages`
3. Fallback `en`

Browser language normalization rules:

- `ko` and `ko-*` map to `ko`
- `ja` and `ja-*` map to `ja`
- `zh-TW`, `zh-HK`, `zh-MO`, `zh-Hant`, and `zh-Hant-*` map to `zh-TW`
- `en` and `en-*` map to `en`
- Unsupported languages fall back to `en`

GPS permission requests and IP-based country detection are not used.

## Saved Locale Rules

- Storage key: `blacksmith_locale`
- Only values from `SUPPORTED_LOCALES` are accepted.
- Unsupported saved values are ignored.
- Helpers guard browser-only APIs so they are safe to import from Next.js server and client modules.

## UI Integration Notes

- Do not replace all Korean strings in one large pass.
- Start with small, low-conflict surfaces such as settings labels, nav labels, and common button text.
- Keep UI changes separate from layout or styling work.
- Avoid touching `TopBar`, `GameRoot`, `Layout`, `ModalRoot`, AdFit layout files, RPC files, and performance-related files unless a later sprint explicitly scopes that work.
- Add the language selector in a later sprint after the current UI development work settles.

## Deferred To Next Sprint

- Add the settings button or language selector to the actual UI.
- Thread the selected locale through client state.
- Replace visible UI strings gradually.
- Add interpolation support for values such as costs, levels, counts, and percentages.
