The one upload surface in the product — the profile photo.

```jsx
<PhotoUpload src={profile.avatar?.url512} name="Studio Praga" busy={uploading} onChoose={pickFile} />
```

- Never a drag-and-drop zone: the product's own UI is a plain file button.
- While busy the hint line is replaced by the progress sentence; the button disables.
