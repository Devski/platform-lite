White card with a hairline border — the container for everything.

```jsx
<Card as="section" padding="md">
  <h2 style={{ font: "var(--type-h3)" }}>Profile photo</h2>
</Card>
```

- Flat at rest. Only pass `interactive` when the whole card is clickable.
- Stack cards with `gap: var(--sp-6)` in a `max-width: var(--measure-form)` column.
