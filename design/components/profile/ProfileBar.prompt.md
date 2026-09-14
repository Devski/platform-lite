The one bar of a profile page. Fixed, 64 px (56 on a phone), transparent over the cover and white once past it.

```jsx
<ProfileBar profile={p} solid={scrolledPastCover} aboutOpen={open} onToggleAbout={toggle} actions={<AccountMenu … />} />
```

- Left: the A3D mark and a label in `--type-h3` that **crossfades** (opacity + 6 px slide, `--dur-3`): panel closed → the studio's name; panel open → „Architektów 3d” (the studio's name is then the panel's heading). No chevron. Mark + label are one button that toggles the AboutPanel; the mark is not a home link on a profile. When the panel is open on desktop it starts at the top of the screen under the bar, so the left group turns ink.
- The bar is `pointer-events: none` except its controls, so the panel's corner pencil under the bar's band stays clickable.
- No avatar in the bar. The avatar (176 px desktop, 120 px phone) sits on the cover's bottom edge, centred on the panel's width, and toggles the panel as well.
- Over the cover: white text, `onPhoto` buttons. Never over a grey or white surface.
- `solid` flips when the cover band's bottom edge passes the bar (IntersectionObserver on the band). The band is always there — a photo or the navy placeholder — so the bar always starts transparent.
- The cover is short: desktop `clamp(168px, 19vh, 240px)`, phone `clamp(128px, 17vh, 150px)` — a band, not a hero. The floor is bar + avatar/2 + gap (64 + 88 + 16 / 56 + 60 + 12) so the avatar never rises into the bar.
- Right slot by viewer: signed-out → language chip, „Zaloguj się”, „Załóż konto”; signed-in other → language chip, account menu; owner → „+ Realizacja”, account menu.
