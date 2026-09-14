The R360 orbit as a tile: poster + drag to turn, "360°" mark, optional cue buttons, optional autorotate.

```jsx
<OrbitTile poster={url} name="Dom na skarpie" autorotate onOpen={goToWork} />          // on the profile card
<OrbitTile poster={url} name="Dom na skarpie" cues={["Wejście","Ogród","Taras"]} ring onEnlarge={openLightbox} />  // on the landing page
```

- The picture is the drag control. The round button at bottom-right is either `onOpen` (arrow-up-right → the work's landing page; use on the profile card) or `onEnlarge` (maximize → lightbox; use on the landing page). Never both.
- `autorotate` is an owner setting per work, off under `prefers-reduced-motion`, and stops the moment the visitor grabs the picture.
- `ring` only where the product allows it: never on a phone's public page, only when enlarged on the desktop profile.
- Cue buttons are the only way to a cue on a phone — keep them whenever cues exist.
