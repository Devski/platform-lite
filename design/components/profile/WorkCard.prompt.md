A work on the profile: a full-width picture group with a caption underneath. Behance-scale exposure of the work.

```jsx
<WorkCard work={w} layout="cover-thumbs" onOpen={goToWork} />
<WorkCard work={w} layout="cover-text" owner onEdit={goToWorkEdit} />
```

- Cards stack vertically with 40–64 px between them, inside a column capped at 1600 px (`--measure-works`).
- `layout` is the owner's choice per work; `cover-thumbs` is the default.
- The whole strip is pictures; the only chrome is the owner's „Edytuj” pill, which goes to the work's landing page in edit mode.
- Every picture is a link to the work's landing page (`onOpen`) — there is no lightbox on the profile. On hover a round arrow-up-right badge in the picture's corner says where the click goes.
- The one exception is the orbit: with an orbit the cover slot is an `OrbitTile`, a visitor turns it right on the profile, and its corner button (the same arrow-up-right) is what leads to the landing page.
- `phone` stacks everything: cover 4:3, thumbnails in a 2-up row, caption below.
