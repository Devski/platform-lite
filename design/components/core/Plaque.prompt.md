The brand mark stand-in and the product's central metaphor — a Warsaw-style street sign.

```jsx
<Plaque name="Architektów 3d" />
<Plaque name="Studio Praga" />
<Plaque name="Dawid Wróblewski Head of AI" />
<Plaque name="Studio Praga" scale={0.5} shadow={false} />   // panel foot
```

- One line in the navy field, centred; the red band always reads "Architektów 3d" — it is not optional.
- The lettering is Fira Sans Condensed **Regular 400** at one fixed size: **44 px**. Never bold, never a Figtree weight token (450/550 would synthesise a heavier face). The red band is Fira Sans Condensed Medium 500, 16 px. The sign grows horizontally with the name — „Dawid Wróblewski Head of AI” is simply a wider sign than „Studio Praga”. The letters never shrink, the text never wraps; let the container scroll or wrap instead.
- Always horizontal. No tilt, no rotation, no wall-mounted perspective.
- `scale` shrinks the whole sign proportionally for a secondary placement (0.5 at the about panel's foot, centred). It is never a way to fit a long name — a long name makes a wider sign, and a host narrower than the sign scrolls it (`overflow-x: auto`).
- Decorative by default (`aria-hidden`) — the name is already read on the page.
- Never recolour it. The navy and red are the only saturated colours in the system and they belong to this object.
