Round profile photo with a monogram fallback.

```jsx
<Avatar src={profile.avatar?.url128} name="Studio Praga" size={128} />
```

- No photo means initials on `--n-900`, never a placeholder illustration.
- Sizes are fixed steps: 32 / 48 / 128 / 160.
