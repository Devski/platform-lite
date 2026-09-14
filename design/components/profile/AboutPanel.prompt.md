The profile's words, in a panel that slides in from the left so the page itself can be pictures.

```jsx
<AboutPanel profile={p} open={aboutOpen} onClose={() => setAboutOpen(false)} owner onEdit={openIdentityEdit} />
<AboutPanel profile={p} phone open={aboutOpen} onClose={close} />
```

- Trigger is the avatar + name in `ProfileBar`; the avatar is always visible, the panel is not.
- Desktop: open on load (≥ 64rem), 380 px, overlays the works; the collapse icon hides it.
- Phone: closed on load, full-height drawer with a scrim; `x` closes.
- Owner: one pencil beside the avatar edits identity in place (name, photo, headline, places, bio). No global edit mode.
- The plaque sits at the foot of the panel, decorative, 22 px lettering, red band always.
- The `h1` of the page lives here — do not repeat it in the bar.
