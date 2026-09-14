Handle picker used in onboarding and in profile settings — the one field the whole product is about.

```jsx
<HandleField
  value={handle}
  onChange={onChange}
  state="available"
  message="This address is free."
  hint="8 to 30 characters: lowercase letters, digits and hyphens."
/>
```

- Always show the address preview line; the handle is meaningless without its host.
- `checking` must be debounced upstream — the badge should not flicker per keystroke.
