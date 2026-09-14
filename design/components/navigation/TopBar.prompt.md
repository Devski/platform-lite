The signed-in header. 64px, white, one hairline underneath.

```jsx
<TopBar
  items={[{ id: "profile", label: "Profile", icon: "user" }, { id: "account", label: "Account", icon: "settings" }]}
  activeItem="profile"
  user={{ name: "Studio Praga", handle: "studio-praga" }}
/>
```

- The A3D block is the stand-in mark: navy square, white letters. There is no logo file yet.
- Signed-out pages get the hero instead of this bar; pass no `user` only for auth pages.
