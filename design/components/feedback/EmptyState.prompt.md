Placeholder for a profile slot the owner has not filled in.

```jsx
<EmptyState icon="image" title="No photo yet" body="Add one and your profile stops looking unfinished." action={<Button variant="quiet">Choose a photo</Button>} />
```

- Only for the owner's own view. A visitor never sees an empty state — the public profile just omits the slot.
