One action control for every surface; ink fill for the primary action, bordered for everything else.

```jsx
<Button variant="solid" size="lg">Sign up</Button>
<Button variant="quiet">Log in</Button>
```

- `onPhoto` / `onPhotoQuiet` are the hero pair (white fill + white-outline) — never use the ink variants over the facade photo.
- Pass the busy label yourself: `<Button loading>{t("submitting")}</Button>` — there is no spinner in this system.
- Full-width buttons belong in the 28rem form column only.
