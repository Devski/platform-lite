Text input. Always inside a FormField — it renders no label of its own.

```jsx
<Input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
<Input mono prefix="architektow3d.pl/" value={handle} onChange={onHandle} />
```

- Focus is a 1px ink border plus the browser focus ring; no glow, no colour fill.
- `invalid` only after a submit attempt, never while typing the first character.
