/* @ds-bundle: {"format":4,"namespace":"ArchitektW3dDesignSystem_1d311d","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Divider","sourcePath":"components/core/Divider.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Plaque","sourcePath":"components/core/Plaque.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"StatusMessage","sourcePath":"components/feedback/StatusMessage.jsx"},{"name":"FormField","sourcePath":"components/forms/FormField.jsx"},{"name":"HandleField","sourcePath":"components/forms/HandleField.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"PhotoUpload","sourcePath":"components/forms/PhotoUpload.jsx"},{"name":"Footer","sourcePath":"components/navigation/Footer.jsx"},{"name":"LocaleSwitcher","sourcePath":"components/navigation/LocaleSwitcher.jsx"},{"name":"TextLink","sourcePath":"components/navigation/TextLink.jsx"},{"name":"TopBar","sourcePath":"components/navigation/TopBar.jsx"},{"name":"AboutPanel","sourcePath":"components/profile/AboutPanel.jsx"},{"name":"OrbitTile","sourcePath":"components/profile/OrbitTile.jsx"},{"name":"ProfileBar","sourcePath":"components/profile/ProfileBar.jsx"},{"name":"WorkCard","sourcePath":"components/profile/WorkCard.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"baf03b71ab41","components/core/Badge.jsx":"ea4652edce7a","components/core/Button.jsx":"e75c62c66bbd","components/core/Card.jsx":"474f483f919e","components/core/Divider.jsx":"1b0293cb7ea9","components/core/Icon.jsx":"8235ec80ed87","components/core/IconButton.jsx":"e7cf4bf3f2f1","components/core/Plaque.jsx":"4c4d25dc9940","components/feedback/EmptyState.jsx":"22a2fdac5390","components/feedback/StatusMessage.jsx":"e21def84fb0b","components/forms/FormField.jsx":"97e48a107691","components/forms/HandleField.jsx":"0cdebe41fa0b","components/forms/Input.jsx":"855f58d68e19","components/forms/PhotoUpload.jsx":"c3f6537a131a","components/navigation/Footer.jsx":"91eeb2779246","components/navigation/LocaleSwitcher.jsx":"1d4ccd362b62","components/navigation/TextLink.jsx":"ab54fe430a3d","components/navigation/TopBar.jsx":"ba67e630a100","components/profile/AboutPanel.jsx":"5cb050b8d905","components/profile/OrbitTile.jsx":"ab31c12a1281","components/profile/ProfileBar.jsx":"c1cc43997f42","components/profile/WorkCard.jsx":"6c32261a640b","ui_kits/app/AccountSettings.jsx":"22278aae35bf","ui_kits/app/Auth.jsx":"d0dcf9a4583e","ui_kits/app/Onboarding.jsx":"6e6254437ad9","ui_kits/app/ProfileEditor.jsx":"3dae3bdb7f08","ui_kits/app/tweaks-panel.jsx":"d259e3a86f73","ui_kits/public-web/Hero.jsx":"9f6bbfaa7e5d","ui_kits/public-web/NotFound.jsx":"f1d7346c0fe0","ui_kits/public-web/PublicProfile.jsx":"9a43924b13e3","ui_kits/public-web/WorkPage.jsx":"e4b9503afe8e","ui_kits/public-web/data.js":"e473cbccbbe1"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ArchitektW3dDesignSystem_1d311d = window.ArchitektW3dDesignSystem_1d311d || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function Avatar({
  src,
  name = "",
  size = 128,
  square = false,
  alt,
  style,
  ...rest
}) {
  const shape = {
    width: size,
    height: size,
    flex: "0 0 auto",
    borderRadius: square ? size >= 96 ? "var(--radius-md)" : size >= 48 ? "var(--radius-sm)" : "var(--radius-xs)" : "var(--radius-avatar)",
    border: "1px solid var(--border-default)",
    background: "var(--surface-sunken)",
    objectFit: "cover",
    ...style
  };
  if (src) return /*#__PURE__*/React.createElement("img", _extends({
    src: src,
    alt: alt || name,
    width: size,
    height: size,
    style: shape
  }, rest));
  return /*#__PURE__*/React.createElement("div", _extends({
    "aria-hidden": "true",
    style: {
      ...shape,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--n-900)",
      color: "var(--n-0)",
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--fw-semibold)",
      fontSize: Math.max(11, Math.round(size * 0.34)),
      letterSpacing: "var(--ls-heading)"
    }
  }, rest), initials(name));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  neutral: ["var(--surface-sunken)", "var(--text-muted)", "var(--border-hairline)"],
  success: ["var(--state-success-bg)", "var(--state-success)", "transparent"],
  danger: ["var(--state-danger-bg)", "var(--state-danger)", "transparent"],
  warning: ["var(--state-warning-bg)", "var(--state-warning)", "transparent"],
  ink: ["var(--surface-inverse)", "var(--text-inverse)", "transparent"]
};
function Badge({
  children,
  tone = "neutral",
  uppercase = false,
  style,
  ...rest
}) {
  const [bg, fg, bd] = TONES[tone] || TONES.neutral;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--sp-2)",
      height: 24,
      padding: "0 var(--sp-3)",
      borderRadius: "var(--radius-full)",
      background: bg,
      color: fg,
      border: "1px solid " + bd,
      font: uppercase ? "var(--type-eyebrow)" : "var(--type-mono)",
      fontSize: "var(--fs-micro)",
      letterSpacing: uppercase ? "var(--ls-caps)" : "0",
      textTransform: uppercase ? "uppercase" : "none",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  md: {
    height: "var(--control-h)",
    padding: "0 var(--control-pad-x)",
    font: "var(--fs-sm)"
  },
  lg: {
    height: "var(--control-h-lg)",
    padding: "0 var(--sp-7)",
    font: "var(--fs-body)"
  }
};
function skin(variant, hover) {
  switch (variant) {
    case "quiet":
      return {
        background: hover ? "var(--action-quiet-hover)" : "var(--surface-card)",
        color: "var(--text-strong)",
        border: "1px solid " + (hover ? "var(--border-strong)" : "var(--action-quiet-border)")
      };
    case "ghost":
      return {
        background: hover ? "var(--surface-active)" : "transparent",
        color: "var(--text-body)",
        border: "1px solid transparent"
      };
    case "onPhoto":
      return {
        background: hover ? "var(--n-0)" : "rgba(255,255,255,.94)",
        color: "var(--n-950)",
        border: "1px solid transparent"
      };
    case "onPhotoQuiet":
      return {
        background: hover ? "rgba(255,255,255,.14)" : "transparent",
        color: "var(--text-on-photo)",
        border: "1px solid rgba(255,255,255,.6)"
      };
    default:
      return {
        background: hover ? "var(--action-solid-hover)" : "var(--action-solid)",
        color: "var(--action-solid-text)",
        border: "1px solid transparent"
      };
  }
}
function Button({
  children,
  variant = "solid",
  size = "md",
  fullWidth = false,
  disabled = false,
  loading = false,
  href,
  type = "button",
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const s = SIZES[size] || SIZES.md;
  const off = disabled || loading;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--sp-3)",
    height: s.height,
    padding: s.padding,
    width: fullWidth ? "100%" : undefined,
    borderRadius: "var(--radius-control)",
    fontFamily: "var(--font-sans)",
    fontSize: s.font,
    fontWeight: "var(--fw-semibold)",
    letterSpacing: "var(--ls-body)",
    textDecoration: "none",
    cursor: off ? "not-allowed" : "pointer",
    transition: "var(--transition-control)",
    whiteSpace: "nowrap",
    ...skin(variant, hover && !off),
    ...(off ? {
      opacity: 0.45
    } : null),
    ...style
  };
  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  };
  if (href && !off) {
    return /*#__PURE__*/React.createElement("a", _extends({
      href: href,
      style: base
    }, handlers, rest), children);
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: off,
    onClick: onClick,
    style: base
  }, handlers, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const PADS = {
  none: 0,
  sm: "var(--sp-6)",
  md: "var(--card-pad)",
  lg: "var(--card-pad-lg)"
};
function Card({
  children,
  padding = "md",
  as = "div",
  tone = "default",
  interactive = false,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    onMouseEnter: interactive ? () => setHover(true) : undefined,
    onMouseLeave: interactive ? () => setHover(false) : undefined,
    style: {
      background: tone === "sunken" ? "var(--surface-sunken)" : "var(--surface-card)",
      border: "1px solid " + (hover ? "var(--border-strong)" : tone === "sunken" ? "var(--border-hairline)" : "var(--border-default)"),
      borderRadius: "var(--radius-card)",
      padding: PADS[padding],
      boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-none)",
      transition: "var(--transition-surface)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Divider.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Divider({
  label,
  spacing = "var(--sp-7)",
  style,
  ...rest
}) {
  const line = {
    height: 1,
    background: "var(--border-hairline)",
    flex: 1
  };
  if (!label) return /*#__PURE__*/React.createElement("div", _extends({
    role: "separator",
    style: {
      ...line,
      margin: spacing + " 0",
      flex: "none"
    }
  }, rest));
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "separator",
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-4)",
      margin: spacing + " 0",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: line
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-eyebrow)",
      letterSpacing: "var(--ls-caps)",
      textTransform: "uppercase",
      color: "var(--text-subtle)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: line
  }));
}
Object.assign(__ds_scope, { Divider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Divider.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CDN = "https://unpkg.com/lucide-static@0.544.0/icons/";
const TONES = {
  body: "var(--text-body)",
  muted: "var(--text-muted)",
  subtle: "var(--text-subtle)",
  strong: "var(--text-strong)",
  onPhoto: "var(--text-on-photo)",
  success: "var(--state-success)",
  danger: "var(--state-danger)"
};
function Icon({
  name,
  size = 18,
  tone = "body",
  strokeWidth = 1.75,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    "aria-hidden": "true",
    style: {
      display: "inline-block",
      width: size,
      height: size,
      flex: "0 0 auto",
      background: TONES[tone] || tone,
      WebkitMaskImage: "url(" + CDN + name + ".svg)",
      maskImage: "url(" + CDN + name + ".svg)",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskSize: "contain",
      maskSize: "contain",
      opacity: strokeWidth < 1.75 ? 0.9 : 1,
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconButton({
  icon,
  label,
  size = 40,
  tone = "quiet",
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const onPhoto = tone === "onPhoto";
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      borderRadius: "var(--radius-control)",
      cursor: "pointer",
      transition: "var(--transition-control)",
      background: hover ? onPhoto ? "rgba(255,255,255,.14)" : "var(--surface-active)" : "transparent",
      border: "1px solid " + (tone === "bordered" ? "var(--action-quiet-border)" : "transparent"),
      color: onPhoto ? "var(--text-on-photo)" : "var(--text-body)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: Math.round(size * 0.45),
    tone: onPhoto ? "onPhoto" : "body"
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Plaque.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// One form only, taken from the Warsaw MSI sign: a tall navy field with the
// name centred in it, and a red band underneath that ALWAYS carries the
// product name. The lettering is one fixed size (44 px, the „Studio Praga”
// reference) and the sign grows horizontally with the text — it never shrinks
// the letters to fit, never wraps them and never tilts. `scale` shrinks the
// WHOLE sign proportionally (letters included) for a secondary placement such
// as the panel foot at 0.5; it is never used to squeeze a long name into a box.
// Weights are literal 400 / 500: Fira Sans Condensed is loaded at exactly those two,
// and the Figtree tokens (450 / 550) would make the browser synthesise a heavier face.
const LETTER = 44;
function Plaque({
  name = "Architektów",
  footer = "Architektów 3d",
  scale = 1,
  minWidth,
  shadow = true,
  decorative = true,
  style,
  ...rest
}) {
  const u = scale;
  const text = String(name);
  return /*#__PURE__*/React.createElement("div", _extends({
    "aria-hidden": decorative ? "true" : undefined,
    style: {
      display: "inline-block",
      minWidth: minWidth ?? Math.round(200 * u),
      maxWidth: "none",
      flex: "0 0 auto",
      boxShadow: shadow ? "var(--shadow-plaque)" : "none",
      overflow: "hidden",
      borderRadius: Math.max(2, 3 * u),
      border: Math.max(1, 2 * u) + "px solid rgba(255,255,255,.55)",
      fontFamily: "var(--font-plaque)",
      color: "var(--plaque-ink)",
      boxSizing: "border-box",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--plaque-navy)",
      padding: 22 * u + "px " + 20 * u + "px " + 8 * u + "px",
      minHeight: 84 * u,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      textAlign: "center",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: LETTER * u,
      fontWeight: 400,
      letterSpacing: "-.01em",
      lineHeight: 1.1,
      whiteSpace: "nowrap"
    }
  }, text)), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--plaque-red)",
      padding: 4 * u + "px " + 20 * u + "px " + 6 * u + "px",
      fontSize: 16 * u,
      fontWeight: 500,
      textAlign: "center",
      whiteSpace: "nowrap"
    }
  }, footer));
}
Object.assign(__ds_scope, { Plaque });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Plaque.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function EmptyState({
  icon = "square-dashed",
  title,
  body,
  action,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: "var(--sp-4)",
      padding: "var(--sp-10) var(--sp-7)",
      border: "1px dashed var(--border-strong)",
      borderRadius: "var(--radius-card)",
      background: "var(--surface-card)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 22,
    tone: "subtle",
    style: {
      background: "var(--text-subtle)"
    }
  }), title ? /*#__PURE__*/React.createElement("h3", {
    style: {
      font: "var(--type-h3)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)",
      margin: 0
    }
  }, title) : null, body ? /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-muted)",
      margin: 0,
      maxWidth: "26rem"
    }
  }, body) : null, action);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/StatusMessage.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  info: ["var(--state-info-bg)", "var(--state-info)", "info"],
  success: ["var(--state-success-bg)", "var(--state-success)", "check"],
  danger: ["var(--state-danger-bg)", "var(--state-danger)", "triangle-alert"],
  warning: ["var(--state-warning-bg)", "var(--state-warning)", "clock"]
};
function StatusMessage({
  children,
  tone = "info",
  plain = false,
  style,
  ...rest
}) {
  const [bg, fg, icon] = TONES[tone] || TONES.info;
  if (plain) {
    return /*#__PURE__*/React.createElement("p", _extends({
      role: tone === "danger" ? "alert" : "status",
      style: {
        font: "var(--type-sm)",
        color: fg,
        margin: 0,
        ...style
      }
    }, rest), children);
  }
  return /*#__PURE__*/React.createElement("div", _extends({
    role: tone === "danger" ? "alert" : "status",
    style: {
      display: "flex",
      gap: "var(--sp-3)",
      alignItems: "flex-start",
      padding: "var(--sp-4) var(--sp-5)",
      borderRadius: "var(--radius-control)",
      background: bg,
      color: fg,
      font: "var(--type-sm)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16,
    tone: fg,
    style: {
      marginTop: 3
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, children));
}
Object.assign(__ds_scope, { StatusMessage });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/StatusMessage.jsx", error: String((e && e.message) || e) }); }

// components/forms/FormField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function FormField({
  label,
  htmlFor,
  hint,
  error,
  status,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--field-gap)",
      ...style
    }
  }, rest), label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: htmlFor,
    style: {
      font: "var(--type-label)",
      color: "var(--text-body)"
    }
  }, label) : null, children, error ? /*#__PURE__*/React.createElement("p", {
    role: "alert",
    style: {
      font: "var(--type-sm)",
      color: "var(--state-danger)",
      margin: 0
    }
  }, error) : null, !error && status ? /*#__PURE__*/React.createElement("p", {
    role: "status",
    style: {
      font: "var(--type-sm)",
      color: "var(--text-muted)",
      margin: 0
    }
  }, status) : null, hint ? /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-subtle)",
      margin: 0
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { FormField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FormField.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  value,
  onChange,
  type = "text",
  invalid = false,
  disabled = false,
  mono = false,
  size = "md",
  prefix,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const border = invalid ? "var(--state-danger)" : focus ? "var(--n-950)" : "var(--border-default)";
  const field = /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    onChange: onChange,
    disabled: disabled,
    "aria-invalid": invalid ? true : undefined,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      ...(prefix ? {
        flex: 1,
        minWidth: 0
      } : {
        width: "100%",
        flex: "none"
      }),
      height: size === "lg" ? "var(--field-h-lg)" : "var(--field-h)",
      padding: prefix ? "0 var(--sp-5) 0 0" : "0 var(--sp-5)",
      border: prefix ? "none" : "1px solid " + border,
      borderRadius: prefix ? 0 : "var(--radius-control)",
      background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
      color: "var(--text-strong)",
      font: mono ? "var(--type-mono)" : "var(--type-body)",
      outline: "none",
      transition: "var(--transition-control)",
      ...(prefix ? null : style)
    }
  }, rest));
  if (!prefix) return field;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      border: "1px solid " + border,
      borderRadius: "var(--radius-control)",
      background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
      transition: "var(--transition-control)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      padding: "0 var(--sp-1) 0 var(--sp-5)",
      font: "var(--type-mono)",
      color: "var(--text-subtle)",
      whiteSpace: "nowrap"
    }
  }, prefix), field);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/HandleField.jsx
try { (() => {
const STATE_COPY = {
  idle: null,
  checking: ["neutral", "checking…"],
  available: ["success", "free"],
  taken: ["danger", "taken"],
  reserved: ["warning", "reserved"],
  own: ["neutral", "yours"],
  invalid: ["danger", "invalid"]
};
function HandleField({
  label = "Profile address",
  origin = "architektow3d.pl",
  value = "",
  onChange,
  state = "idle",
  message,
  hint,
  id = "handle",
  style
}) {
  const chip = STATE_COPY[state];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-3)",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.FormField, {
    label: label,
    htmlFor: id,
    hint: hint,
    error: state === "taken" || state === "invalid" ? message : undefined,
    status: state === "checking" || state === "available" || state === "own" || state === "reserved" ? message : undefined
  }, /*#__PURE__*/React.createElement(__ds_scope.Input, {
    id: id,
    mono: true,
    prefix: origin + "/",
    value: value,
    onChange: onChange,
    invalid: state === "taken" || state === "invalid",
    autoComplete: "off",
    spellCheck: false
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-eyebrow)",
      letterSpacing: "var(--ls-caps)",
      textTransform: "uppercase",
      color: "var(--text-subtle)"
    }
  }, "Your address"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-mono)",
      color: "var(--text-strong)"
    }
  }, origin, "/", value || "…"), chip ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: chip[0]
  }, chip[1]) : null));
}
Object.assign(__ds_scope, { HandleField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/HandleField.jsx", error: String((e && e.message) || e) }); }

// components/forms/PhotoUpload.jsx
try { (() => {
function PhotoUpload({
  src,
  name = "",
  size = 128,
  emptyLabel = "You have no profile photo yet.",
  chooseLabel = "Choose a photo",
  hint = "JPEG, PNG or WebP, up to 10 MB. We crop it to a square.",
  busy = false,
  busyLabel = "Uploading and processing…",
  onChoose,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--sp-7)",
      alignItems: "flex-start",
      flexWrap: "wrap",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    src: src,
    name: name,
    size: size,
    alt: src ? "Your current profile photo" : undefined
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-3)",
      minWidth: 0,
      flex: 1
    }
  }, !src ? /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-muted)",
      margin: 0
    }
  }, emptyLabel) : null, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "quiet",
    onClick: onChoose,
    disabled: busy
  }, chooseLabel), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-subtle)",
      margin: 0
    }
  }, busy ? busyLabel : hint)));
}
Object.assign(__ds_scope, { PhotoUpload });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/PhotoUpload.jsx", error: String((e && e.message) || e) }); }

// components/navigation/LocaleSwitcher.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function LocaleSwitcher({
  locales = ["pl", "en"],
  names = {
    pl: "Polski",
    en: "English"
  },
  current = "pl",
  onChange,
  tone = "default",
  style,
  ...rest
}) {
  const onPhoto = tone === "onPhoto";
  return /*#__PURE__*/React.createElement("nav", _extends({
    "aria-label": "Language selection",
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-4)",
      ...style
    }
  }, rest), locales.map(l => {
    const active = l === current;
    return /*#__PURE__*/React.createElement("a", {
      key: l,
      href: "#",
      lang: l,
      hrefLang: l,
      "aria-current": active ? "true" : undefined,
      onClick: e => {
        e.preventDefault();
        if (onChange) onChange(l);
      },
      style: {
        font: "var(--type-sm)",
        fontWeight: active ? "var(--fw-semibold)" : "var(--fw-regular)",
        color: onPhoto ? active ? "var(--text-on-photo)" : "rgba(255,255,255,.78)" : active ? "var(--text-strong)" : "var(--text-muted)",
        textDecoration: active ? "underline" : "none",
        textUnderlineOffset: 3,
        padding: "var(--sp-1) 0"
      }
    }, names[l] || l);
  }));
}
Object.assign(__ds_scope, { LocaleSwitcher });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/LocaleSwitcher.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Footer.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Footer({
  company = "Architectorium",
  links = [],
  locale = "pl",
  onLocaleChange,
  note,
  copyright,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("footer", _extends({
    style: {
      borderTop: "1px solid var(--border-hairline)",
      background: "var(--surface-card)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--measure-wide)",
      margin: "0 auto",
      padding: "var(--sp-9) var(--sp-7)",
      display: "flex",
      flexWrap: "wrap",
      gap: "var(--sp-7)",
      alignItems: "baseline",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-sm)",
      fontWeight: "var(--fw-semibold)",
      color: "var(--text-strong)"
    }
  }, company), note ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-subtle)"
    }
  }, note) : null, copyright ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-muted)"
    }
  }, copyright) : null), links.length ? /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "var(--sp-6)"
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l.label,
    href: l.href || "#",
    style: {
      font: "var(--type-sm)",
      color: "var(--text-muted)",
      textDecoration: "none"
    }
  }, l.label))) : null, onLocaleChange ? /*#__PURE__*/React.createElement(__ds_scope.LocaleSwitcher, {
    current: locale,
    onChange: onLocaleChange
  }) : null));
}
Object.assign(__ds_scope, { Footer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Footer.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TextLink.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function TextLink({
  children,
  href = "#",
  onClick,
  tone = "strong",
  underline = "hover",
  icon,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const always = underline === "always";
  return /*#__PURE__*/React.createElement("a", _extends({
    href: href,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: icon ? "inline-flex" : "inline",
      alignItems: "center",
      gap: "var(--sp-2)",
      color: tone === "onPhoto" ? "var(--text-on-photo)" : tone === "muted" ? "var(--text-muted)" : "var(--text-strong)",
      font: "inherit",
      fontWeight: "var(--fw-semibold)",
      textDecoration: always ? hover ? "none" : "underline" : hover ? "underline" : "none",
      textUnderlineOffset: 2,
      cursor: "pointer",
      transition: "var(--transition-control)",
      ...style
    }
  }, rest), children, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16,
    tone: tone === "onPhoto" ? "onPhoto" : "strong"
  }) : null);
}
Object.assign(__ds_scope, { TextLink });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TextLink.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function TopBar({
  brand = "Architektów 3d",
  items = [],
  activeItem,
  onNavigate,
  user,
  locale = "pl",
  onLocaleChange,
  actions,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("header", _extends({
    style: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      background: "var(--surface-card)",
      borderBottom: "1px solid var(--border-hairline)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--measure-wide)",
      margin: "0 auto",
      padding: "0 var(--sp-7)",
      height: 64,
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-8)"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      textDecoration: "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 30,
      height: 30,
      position: "relative",
      overflow: "hidden",
      borderRadius: "var(--radius-xs)",
      background: "var(--plaque-navy)",
      color: "var(--plaque-ink)",
      font: "var(--type-sm)",
      fontWeight: "var(--fw-bold)",
      fontSize: 12,
      letterSpacing: "-.02em"
    }
  }, "A3D", /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "12%",
      background: "var(--plaque-red)"
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h3)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)"
    }
  }, brand)), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-6)",
      marginLeft: "auto"
    }
  }, items.map(item => {
    const active = item.id === activeItem;
    return /*#__PURE__*/React.createElement("a", {
      key: item.id,
      href: "#",
      onClick: e => {
        e.preventDefault();
        if (onNavigate) onNavigate(item.id);
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        font: "var(--type-sm)",
        fontWeight: active ? "var(--fw-semibold)" : "var(--fw-regular)",
        color: active ? "var(--text-strong)" : "var(--text-muted)",
        textDecoration: "none",
        height: 63,
        borderBottom: "2px solid " + (active ? "var(--n-950)" : "transparent")
      }
    }, item.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: item.icon,
      size: 17,
      tone: active ? "strong" : "muted"
    }) : null, item.label);
  }), onLocaleChange ? /*#__PURE__*/React.createElement(__ds_scope.LocaleSwitcher, {
    current: locale,
    onChange: onLocaleChange
  }) : null, actions, user ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)"
    }
  }, user.handle || user.email ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-mono)",
      color: "var(--text-subtle)"
    }
  }, user.handle ? "/" + user.handle : user.email) : null, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    src: user.avatarUrl,
    name: user.name,
    size: 32
  })) : /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: "var(--sp-3)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "ghost"
  }, "Log in"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "solid"
  }, "Sign up")))));
}
Object.assign(__ds_scope, { TopBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopBar.jsx", error: String((e && e.message) || e) }); }

// components/profile/AboutPanel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// The "about" panel: everything the old profile card said, moved off the wall
// of work into a panel that slides in from the left (as on Behance). On the
// desktop it is open on load and overlays the left edge of the works; on a
// phone it is closed on load and slides over everything with a scrim. The
// page's big avatar (on the cover band's bottom edge, flush with the works
// column, scrolling with the page) is its trigger; the panel carries its own
// copy, centred, at the same height (`avatarTop`, `avatarSize`), which closes
// the panel. `headroom` reserves the space under it.
//
// Edit mode (`editing`) is the same panel, same order, same type — the
// editable pieces just get a frame: the name (h1), the headline, the bio, and
// the places (chips keep their look, the pin becomes a remove ×, a framed
// field under them adds a place). Address and plaque stay read-only; the
// plaque follows the name field live. ✓ (save) and × (cancel) sit in the top-right corner.
function Chip({
  children,
  onRemove,
  removeLabel
}) {
  return /*#__PURE__*/React.createElement("li", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--sp-2)",
      height: 32,
      padding: onRemove ? "0 var(--sp-4) 0 var(--sp-2)" : "0 var(--sp-4)",
      borderRadius: "var(--radius-full)",
      background: "var(--surface-sunken)",
      font: "var(--type-label)",
      color: "var(--text-body)"
    }
  }, onRemove ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": removeLabel,
    title: removeLabel,
    onClick: onRemove,
    style: {
      width: 24,
      height: 24,
      padding: 0,
      border: 0,
      background: "transparent",
      borderRadius: "var(--radius-full)",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "circle-x",
    size: 16,
    tone: "muted"
  })) : /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "map-pin",
    size: 14,
    tone: "muted"
  }), children);
}
function Section({
  title,
  children
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-3)"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      font: "var(--type-eyebrow)",
      letterSpacing: "var(--ls-caps)",
      textTransform: "uppercase",
      color: "var(--text-subtle)"
    }
  }, title), children);
}

// A frame that reads exactly like the text it replaces: the same element, font,
// colour, alignment and width — so the text wraps as it does in read-only. The
// frame hangs outside the text box (padding + 1px border exactly compensated by
// negative margins, so the text box is the read-only box to the pixel) and
// turns ink on focus. Contenteditable, so it flows like a paragraph, not an input.
function Framed({
  as = "h1",
  value,
  onChange,
  placeholder,
  label,
  block = false,
  textStyle
}) {
  const ref = React.useRef(null);
  const [focus, setFocus] = React.useState(false);
  React.useEffect(() => {
    if (ref.current && ref.current.innerText !== (value || "")) ref.current.innerText = value || "";
  }, []); // seed once; typing owns the DOM afterwards
  const Tag = as;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: block ? "block" : "inline-block",
      maxWidth: "100%",
      minWidth: 0,
      verticalAlign: "top"
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    ref: ref,
    role: "textbox",
    "aria-multiline": "true",
    "aria-label": label,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: false,
    onInput: e => onChange(e.currentTarget.innerText.replace(/\n$/, "")),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      ...textStyle,
      margin: "-3px -7px",
      padding: "2px 6px",
      minWidth: "3ch",
      minHeight: "1lh",
      boxSizing: "content-box",
      border: "1px solid " + (focus ? "var(--focus-ring)" : "var(--border-default)"),
      borderRadius: "var(--radius-control)",
      background: "transparent",
      outline: "none",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      cursor: "text",
      transition: "border-color var(--dur-1) var(--ease-standard)"
    }
  }), !value && placeholder ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      ...textStyle,
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      color: "var(--text-subtle)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, placeholder) : null);
}

// Adding a place: a small round „+” chip at the end of the row. It opens into a
// chip-shaped field that suggests places from TERYT (here a small sample of the
// register; the product searches the server from 2 characters, 10 at most).
// Detail rules as in the spec: voivodeship → kind only; county → „powiat, {voivodeship}”;
// town → „{gmina or powiat}, {voivodeship}”. Enter or a click adds the NAME only.
const TERYT_SAMPLE = [{
  name: "Warszawa",
  detail: "miasto, mazowieckie"
}, {
  name: "Kraków",
  detail: "miasto, małopolskie"
}, {
  name: "Wrocław",
  detail: "miasto, dolnośląskie"
}, {
  name: "Poznań",
  detail: "miasto, wielkopolskie"
}, {
  name: "Gdańsk",
  detail: "miasto, pomorskie"
}, {
  name: "Łódź",
  detail: "miasto, łódzkie"
}, {
  name: "Szczecin",
  detail: "miasto, zachodniopomorskie"
}, {
  name: "Lublin",
  detail: "miasto, lubelskie"
}, {
  name: "Katowice",
  detail: "miasto, śląskie"
}, {
  name: "Białystok",
  detail: "miasto, podlaskie"
}, {
  name: "Piaseczno",
  detail: "gmina Piaseczno, mazowieckie"
}, {
  name: "Pruszków",
  detail: "powiat pruszkowski, mazowieckie"
}, {
  name: "Nowa Wieś",
  detail: "gmina Michałowice, mazowieckie"
}, {
  name: "Konstancin-Jeziorna",
  detail: "gmina Konstancin-Jeziorna, mazowieckie"
}, {
  name: "Zakopane",
  detail: "powiat tatrzański, małopolskie"
}, {
  name: "Sopot",
  detail: "miasto, pomorskie"
}, {
  name: "Gdynia",
  detail: "miasto, pomorskie"
}, {
  name: "powiat warszawski zachodni",
  detail: "powiat, mazowieckie"
}, {
  name: "powiat piaseczyński",
  detail: "powiat, mazowieckie"
}, {
  name: "powiat krakowski",
  detail: "powiat, małopolskie"
}, {
  name: "mazowieckie",
  detail: "województwo"
}, {
  name: "małopolskie",
  detail: "województwo"
}, {
  name: "pomorskie",
  detail: "województwo"
}, {
  name: "dolnośląskie",
  detail: "województwo"
}, {
  name: "wielkopolskie",
  detail: "województwo"
}, {
  name: "śląskie",
  detail: "województwo"
}];
const fold = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l");
function PlaceAdder({
  places,
  onAdd,
  label,
  placeholder
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [hi, setHi] = React.useState(-1);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (open && ref.current) ref.current.focus();
  }, [open]);
  const list = q.trim().length >= 2 ? TERYT_SAMPLE.filter(p => fold(p.name).includes(fold(q.trim())) && !places.includes(p.name)).slice(0, 10) : [];
  const add = name => {
    const n = (name || q).trim();
    if (!n) return;
    onAdd(n);
    setQ("");
    setHi(-1);
  };
  const close = () => {
    setOpen(false);
    setQ("");
    setHi(-1);
  };
  const chip = {
    display: "inline-flex",
    alignItems: "center",
    height: 32,
    borderRadius: "var(--radius-full)",
    background: "var(--surface-sunken)",
    font: "var(--type-label)",
    color: "var(--text-body)"
  };
  if (!open) {
    return /*#__PURE__*/React.createElement("li", {
      style: {
        display: "inline-flex"
      }
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-label": label,
      title: label,
      onClick: () => setOpen(true),
      style: {
        ...chip,
        width: 32,
        justifyContent: "center",
        padding: 0,
        border: 0,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "plus",
      size: 16,
      tone: "strong"
    })));
  }
  return /*#__PURE__*/React.createElement("li", {
    style: {
      display: "inline-flex",
      flex: "1 1 12ch",
      minWidth: "12ch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...chip,
      width: "100%",
      padding: "0 var(--sp-3) 0 var(--sp-2)",
      gap: "var(--sp-2)",
      boxShadow: "inset 0 0 0 1px var(--focus-ring)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "map-pin",
    size: 14,
    tone: "muted"
  }), /*#__PURE__*/React.createElement("input", {
    ref: ref,
    role: "combobox",
    "aria-label": label,
    "aria-autocomplete": "list",
    "aria-expanded": list.length > 0,
    "aria-controls": "place-suggest",
    "aria-activedescendant": hi >= 0 ? "place-opt-" + hi : undefined,
    value: q,
    placeholder: placeholder,
    maxLength: 80,
    onChange: e => {
      setQ(e.target.value);
      setHi(-1);
    },
    onBlur: () => {
      if (!q.trim()) close();
    },
    onKeyDown: e => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown" && list.length) {
        e.preventDefault();
        setHi(i => (i + 1) % list.length);
      } else if (e.key === "ArrowUp" && list.length) {
        e.preventDefault();
        setHi(i => i <= 0 ? list.length - 1 : i - 1);
      } else if (e.key === "Enter" || e.key === "Tab" && q.trim()) {
        e.preventDefault();
        add(hi >= 0 ? list[hi].name : null);
      }
    },
    style: {
      flex: 1,
      minWidth: 0,
      height: 32,
      padding: 0,
      border: 0,
      background: "transparent",
      font: "var(--type-label)",
      color: "var(--text-body)",
      outline: "none"
    }
  })), list.length ? /*#__PURE__*/React.createElement("ul", {
    id: "place-suggest",
    role: "listbox",
    style: {
      position: "absolute",
      top: "calc(100% + 4px)",
      left: 0,
      right: 0,
      zIndex: 2,
      margin: 0,
      padding: "var(--sp-1)",
      listStyle: "none",
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-control)",
      boxShadow: "var(--shadow-md)",
      maxHeight: 280,
      overflowY: "auto"
    }
  }, list.map((p, i) => /*#__PURE__*/React.createElement("li", {
    key: p.name,
    id: "place-opt-" + i,
    role: "option",
    "aria-selected": i === hi,
    onMouseDown: e => {
      e.preventDefault();
      add(p.name);
    },
    onMouseEnter: () => setHi(i),
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 1,
      padding: "var(--sp-2) var(--sp-3)",
      borderRadius: "var(--radius-xs)",
      background: i === hi ? "var(--surface-hover)" : "transparent",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: "var(--text-strong)"
    }
  }, p.name), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-muted)"
    }
  }, p.detail)))) : null);
}
function AboutPanel({
  profile,
  open = true,
  onClose,
  onAvatar,
  phone = false,
  owner = false,
  editing = false,
  draft,
  onDraftChange,
  onSave,
  onCancel,
  onChangePhoto,
  width = 380,
  top = 64,
  start = 0,
  headroom,
  avatarTop,
  avatarSize = 176,
  locale = "pl",
  children,
  style,
  ...rest
}) {
  const [copied, setCopied] = React.useState(false);
  const address = "architektow3d.pl/" + profile.handle;
  const w = phone ? "min(100% - 88px, 320px)" : width;
  // Phone: one step smaller everywhere — type, gaps, corner buttons.
  const fH1 = phone ? "var(--type-h2)" : "var(--type-h1)";
  const fLead = phone ? "var(--type-body)" : "var(--type-lead)";
  const fBody = phone ? "var(--type-sm)" : "var(--type-body)";
  const btn = phone ? 32 : 40;
  const btnIcon = phone ? 16 : 20;
  const t = locale === "en" ? {
    about: "About",
    places: "Based in and working across",
    address: "Profile address",
    copy: "Copy address",
    copied: "Address copied",
    close: "Close panel",
    toProfile: "Go to profile: ",
    editTitle: "Edit profile",
    name: "Name",
    headline: "Headline",
    headlinePh: "What you do, in one line",
    bioPh: "A few sentences about the studio",
    addPlace: "Add a place",
    addPlacePh: "Type a place…",
    remove: "Remove: ",
    photo: "Change photo",
    shapeCircle: "Round avatar",
    shapeSquare: "Square avatar",
    save: "Save",
    cancel: "Cancel"
  } : {
    about: "O nas",
    places: "Siedziba i obszar działania",
    address: "Adres profilu",
    copy: "Kopiuj adres",
    copied: "Skopiowano adres",
    close: "Zamknij panel",
    toProfile: "Przejdź do profilu: ",
    editTitle: "Edytuj profil",
    name: "Nazwa",
    headline: "Nagłówek",
    headlinePh: "Czym się zajmujecie, jednym zdaniem",
    bioPh: "Kilka zdań o pracowni",
    addPlace: "Dodaj miejsce",
    addPlacePh: "Wpisz miejsce…",
    remove: "Usuń: ",
    photo: "Zmień zdjęcie",
    shapeCircle: "Avatar okrągły",
    shapeSquare: "Avatar kwadratowy",
    save: "Zapisz",
    cancel: "Anuluj"
  };
  const d = editing && draft ? draft : profile;
  const set = k => v => onDraftChange && onDraftChange({
    [k]: v
  });
  const places = d.places || [];
  const sq = d.avatarShape === "square";
  const avatarRadius = sq ? "var(--radius-md)" : "var(--radius-full)";
  const addPlace = name => {
    if (name && !places.includes(name)) onDraftChange && onDraftChange({
      places: [...places, name]
    });
  };
  const padB = phone ? "var(--sp-9)" : "var(--sp-10)";
  const padX = phone ? "var(--sp-6)" : "var(--sp-8)";
  return /*#__PURE__*/React.createElement(React.Fragment, null, phone && open ? /*#__PURE__*/React.createElement("div", {
    onClick: editing ? undefined : onClose,
    "aria-hidden": "true",
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 44,
      background: "var(--scrim-photo)"
    }
  }) : null, /*#__PURE__*/React.createElement("aside", _extends({
    "aria-label": editing ? t.editTitle : t.about,
    "aria-hidden": !open,
    style: {
      position: "fixed",
      top: start,
      bottom: 0,
      left: 0,
      zIndex: 45,
      width: w,
      boxSizing: "border-box",
      padding: (headroom != null ? typeof headroom === "number" ? headroom + "px" : headroom : phone ? "var(--sp-7)" : "var(--sp-8)") + " " + padX + " " + padB,
      background: "var(--surface-card)",
      borderRight: "1px solid var(--border-hairline)",
      boxShadow: open ? "var(--shadow-lift)" : "none",
      transform: open ? "translateX(0)" : "translateX(-102%)",
      transition: "transform var(--dur-3) var(--ease-standard), box-shadow var(--dur-3) var(--ease-standard)",
      overflowY: "auto",
      overflowX: "hidden",
      display: "flex",
      flexDirection: "column",
      gap: phone ? "var(--sp-6)" : "var(--sp-8)",
      ...style
    }
  }, rest), avatarTop != null ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: avatarTop,
      left: "50%",
      marginLeft: -avatarSize / 2,
      display: "inline-flex",
      borderRadius: avatarRadius,
      boxShadow: "0 0 0 4px var(--surface-card)",
      zIndex: 1
    }
  }, editing ? /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    src: d.avatarUrl,
    name: d.displayName,
    size: avatarSize,
    square: sq,
    alt: ""
  }) : /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": onAvatar ? t.toProfile + profile.displayName : t.close,
    title: onAvatar ? t.toProfile + profile.displayName : t.close,
    onClick: onAvatar || onClose,
    style: {
      padding: 0,
      border: 0,
      background: "transparent",
      borderRadius: avatarRadius,
      cursor: "pointer",
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    src: profile.avatarUrl,
    name: profile.displayName,
    size: avatarSize,
    square: sq,
    alt: ""
  })), editing ?
  /*#__PURE__*/
  // Bottom-left arc, fixed spot whatever the shape: [shape toggle][camera]. The toggle shows the OTHER shape — what you get by pressing it.
  React.createElement("span", {
    style: {
      position: "absolute",
      left: 4,
      bottom: 4,
      display: "inline-flex",
      gap: "var(--sp-2)"
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": sq ? t.shapeCircle : t.shapeSquare,
    title: sq ? t.shapeCircle : t.shapeSquare,
    "aria-pressed": sq,
    onClick: () => onDraftChange && onDraftChange({
      avatarShape: sq ? "circle" : "square"
    }),
    style: {
      width: 44,
      height: 44,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-full)",
      border: "1px solid var(--action-quiet-border)",
      background: "var(--surface-card)",
      boxShadow: "var(--shadow-md)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: sq ? "circle" : "square",
    size: 18,
    tone: "strong"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": t.photo,
    title: t.photo,
    onClick: onChangePhoto,
    style: {
      width: 44,
      height: 44,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-full)",
      border: "1px solid var(--action-quiet-border)",
      background: "var(--surface-card)",
      boxShadow: "var(--shadow-md)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "camera",
    size: 18,
    tone: "strong"
  }))) : null) : null, editing ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: start ? "var(--sp-4)" : phone ? top + 8 : (top - btn) / 2,
      right: phone ? "var(--sp-4)" : "var(--sp-5)",
      display: "flex",
      gap: "var(--sp-2)",
      zIndex: 1
    }
  }, editing ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": t.save,
    title: t.save,
    onClick: onSave,
    style: {
      width: btn,
      height: btn,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-full)",
      border: 0,
      background: "var(--action-solid)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: btnIcon,
    tone: "var(--action-solid-text)"
  })) : null, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": t.cancel,
    title: t.cancel,
    onClick: onCancel,
    style: {
      width: btn,
      height: btn,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-full)",
      border: 0,
      background: "transparent",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: btnIcon,
    tone: "muted"
  }))) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-3)",
      textAlign: "center",
      alignItems: "center"
    }
  }, editing ? /*#__PURE__*/React.createElement(Framed, {
    as: "h1",
    label: t.name,
    value: d.displayName,
    onChange: set("displayName"),
    textStyle: {
      margin: 0,
      font: fH1,
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)",
      textAlign: "center"
    }
  }) : /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      font: fH1,
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)",
      overflowWrap: "anywhere",
      minWidth: 0
    }
  }, profile.displayName), editing ? /*#__PURE__*/React.createElement(Framed, {
    as: "p",
    label: t.headline,
    value: d.headline || "",
    onChange: set("headline"),
    placeholder: t.headlinePh,
    textStyle: {
      margin: 0,
      font: fLead,
      color: "var(--text-muted)",
      textAlign: "center"
    }
  }) : profile.headline ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: fLead,
      color: "var(--text-muted)"
    }
  }, profile.headline) : null), /*#__PURE__*/React.createElement(Section, {
    title: t.address
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-mono)",
      color: "var(--text-body)"
    }
  }, address), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": copied ? t.copied : t.copy,
    title: copied ? t.copied : t.copy,
    onClick: () => setCopied(true),
    style: {
      width: 32,
      height: 32,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-full)",
      border: 0,
      background: "var(--surface-sunken)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: copied ? "check" : "copy",
    size: 15,
    tone: "strong"
  })))), editing || places.length ? /*#__PURE__*/React.createElement(Section, {
    title: t.places
  }, /*#__PURE__*/React.createElement("ul", {
    style: {
      position: "relative",
      display: "flex",
      flexWrap: "wrap",
      gap: "var(--sp-3)",
      listStyle: "none",
      margin: 0,
      padding: 0
    }
  }, places.map(p => /*#__PURE__*/React.createElement(Chip, {
    key: p,
    onRemove: editing ? () => onDraftChange && onDraftChange({
      places: places.filter(x => x !== p)
    }) : undefined,
    removeLabel: t.remove + p
  }, p)), editing ? /*#__PURE__*/React.createElement(PlaceAdder, {
    places: places,
    onAdd: addPlace,
    label: t.addPlace,
    placeholder: t.addPlacePh
  }) : null)) : null, editing || profile.bio ? /*#__PURE__*/React.createElement(Section, {
    title: t.about
  }, editing ? /*#__PURE__*/React.createElement(Framed, {
    as: "p",
    block: true,
    label: t.about,
    value: d.bio || "",
    onChange: set("bio"),
    placeholder: t.bioPh,
    textStyle: {
      margin: 0,
      font: fBody,
      color: "var(--text-body)"
    }
  }) : /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: fBody,
      color: "var(--text-body)",
      whiteSpace: "pre-line"
    }
  }, profile.bio)) : null, children, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto",
      flexShrink: 0,
      position: "sticky",
      bottom: "calc(-1 * " + padB + ")",
      background: "var(--surface-card)",
      borderTop: "1px solid var(--border-hairline)",
      marginLeft: "calc(-1 * " + padX + ")",
      marginRight: "calc(-1 * " + padX + ")",
      marginBottom: "calc(-1 * " + padB + ")",
      padding: (phone ? "var(--sp-4)" : "var(--sp-5)") + " " + padX + " " + (phone ? "var(--sp-6)" : "var(--sp-7)"),
      display: "flex",
      justifyContent: "center",
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Plaque, {
    name: d.displayName,
    scale: 0.5,
    shadow: false
  }))));
}
Object.assign(__ds_scope, { AboutPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/profile/AboutPanel.jsx", error: String((e && e.message) || e) }); }

// components/profile/OrbitTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// The R360 orbit as the design system sees it: a picture that turns. The real
// product renders frames on a canvas (orbit-viewer.tsx); here a poster and a
// slow horizontal pan stand in so layouts can be judged. Keeps the product's
// rules: the picture is the drag control, so enlarging is a separate "+"
// button; a "360°" mark sits top-left; the ring shows only where asked
// (D-WORKS-19/20 — never on a phone's public page, only when enlarged on the
// desktop profile page).
function OrbitTile({
  poster,
  name = "",
  cues = [],
  autorotate = false,
  ring = false,
  aspect = "16 / 10",
  onEnlarge,
  onOpen,
  openLabel,
  radius = "var(--radius-picture)",
  style,
  ...rest
}) {
  const [pos, setPos] = React.useState(50);
  const [active, setActive] = React.useState(0);
  const drag = React.useRef(null);
  React.useEffect(() => {
    if (!autorotate) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf;
    let last = performance.now();
    const tick = t => {
      const dt = t - last;
      last = t;
      if (!drag.current) setPos(p => (p + dt * 0.004) % 100);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autorotate]);
  const onDown = e => {
    drag.current = {
      x: e.clientX,
      pos
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = e => {
    if (!drag.current) return;
    const d = (e.clientX - drag.current.x) / 6;
    setPos(((drag.current.pos + d) % 100 + 100) % 100);
  };
  const onUp = () => {
    drag.current = null;
  };
  const goCue = i => {
    setActive(i);
    setPos(i / Math.max(1, cues.length) * 100);
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-4)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    role: "slider",
    "aria-label": "Widok 360° realizacji " + name + ": przeciągnij po obrazie, by go obrócić",
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": Math.round(pos),
    tabIndex: 0,
    onPointerDown: onDown,
    onPointerMove: onMove,
    onPointerUp: onUp,
    onPointerCancel: onUp,
    onKeyDown: e => {
      if (e.key === "ArrowLeft") setPos(p => (p + 98) % 100);
      if (e.key === "ArrowRight") setPos(p => (p + 2) % 100);
    },
    style: {
      position: "relative",
      aspectRatio: aspect,
      borderRadius: radius,
      overflow: "hidden",
      background: "var(--n-900)",
      cursor: "grab",
      touchAction: "pan-y",
      outline: "none"
    }
  }, poster ? /*#__PURE__*/React.createElement("img", {
    src: poster,
    alt: name + ", widok 360°",
    draggable: "false",
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: pos + "% 50%",
      transform: "scale(1.18)",
      userSelect: "none"
    }
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: "var(--sp-4)",
      left: "var(--sp-4)",
      padding: "4px 10px",
      borderRadius: "var(--radius-full)",
      background: "rgba(12,17,22,.72)",
      color: "#fff",
      font: "var(--type-eyebrow)",
      letterSpacing: "var(--ls-caps)",
      textTransform: "uppercase"
    },
    "aria-hidden": "true"
  }, "360\xB0"), onOpen || onEnlarge ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": onOpen ? openLabel || "Otwórz realizację: " + name : "Powiększ widok 360°: " + name,
    title: onOpen ? openLabel || "Otwórz realizację: " + name : "Powiększ widok 360°: " + name,
    onClick: onOpen || onEnlarge,
    onPointerDown: e => e.stopPropagation(),
    style: {
      position: "absolute",
      right: "var(--sp-4)",
      bottom: "var(--sp-4)",
      width: 40,
      height: 40,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-full)",
      border: 0,
      background: "rgba(255,255,255,.94)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: onOpen ? "arrow-up-right" : "maximize-2",
    size: 18,
    tone: "strong"
  })) : null, ring ? /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      left: "50%",
      bottom: "var(--sp-5)",
      transform: "translateX(-50%)",
      width: "min(38%, 10rem)",
      aspectRatio: "3 / 1"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      border: "2px solid rgba(255,255,255,.55)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: 10,
      height: 10,
      marginLeft: -5,
      marginTop: -5,
      borderRadius: "50%",
      background: "#fff",
      transform: "rotate(" + pos * 3.6 + "deg) translateX(" + 0 + "px)",
      transformOrigin: "50% 50%"
    }
  })) : null), cues.length ? /*#__PURE__*/React.createElement("ul", {
    "aria-label": "Punkty widoku 360°: " + name,
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "var(--sp-3)",
      listStyle: "none",
      margin: 0,
      padding: 0
    }
  }, cues.map((c, i) => /*#__PURE__*/React.createElement("li", {
    key: c
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-pressed": active === i,
    onClick: () => goCue(i),
    style: {
      height: 32,
      padding: "0 var(--sp-4)",
      borderRadius: "var(--radius-full)",
      border: "1px solid " + (active === i ? "var(--n-950)" : "var(--action-quiet-border)"),
      background: active === i ? "var(--n-950)" : "var(--surface-card)",
      color: active === i ? "var(--n-0)" : "var(--text-body)",
      font: "var(--type-label)",
      cursor: "pointer",
      transition: "var(--transition-control)"
    }
  }, c)))) : null);
}
Object.assign(__ds_scope, { OrbitTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/profile/OrbitTile.jsx", error: String((e && e.message) || e) }); }

// components/profile/ProfileBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// The profile's sticky bar. Over the cover it is transparent and white-on-photo;
// once the cover scrolls away it becomes a white bar with a hairline. The left
// group — A3D mark + „Architektów 3d” — is one button and the one control that
// is always on screen: it toggles the AboutPanel (the avatar on the cover's
// bottom edge does the same). When the panel is open it starts at the top of
// the screen under the bar, so the left group turns ink. The label crossfades:
// panel closed → the studio's name; panel open → „Architektów 3d” (the name is
// then the panel's own heading). The bar itself lets clicks through to what is
// under it (the panel's pencil); only its controls catch the pointer. `actions` is the right-hand
// slot (language chip, sign-up, account menu — whatever the viewer mode wants).
// Stacking: the bar (with its toolbar) sits under the AboutPanel (z 45); the
// mark + wordmark is its own fixed layer above the panel — so the open panel
// slides in between the toolbar and the logo. A chevron after the label points
// right (panel closed) and flips left when the panel is open.
function ProfileBar({
  profile,
  brand = "Architektów 3d",
  solid = false,
  aboutOpen = false,
  onToggleAbout,
  toggleDisabled = false,
  phone = false,
  actions,
  style,
  ...rest
}) {
  const onPhoto = !solid;
  const ink = onPhoto ? "#fff" : "var(--text-strong)";
  const leftInk = onPhoto && !aboutOpen ? "#fff" : "var(--text-strong)"; // the open panel (white) is under the group on every width
  const barH = phone ? 56 : 64;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("header", _extends({
    style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 44,
      height: barH,
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-4)",
      padding: phone ? "0 var(--sp-4)" : "0 var(--sp-7)",
      background: solid ? "var(--surface-card)" : "transparent",
      borderBottom: "1px solid " + (solid ? "var(--border-hairline)" : "transparent"),
      color: ink,
      pointerEvents: "none",
      transition: "background-color var(--dur-2) var(--ease-standard), border-color var(--dur-2) var(--ease-standard), color var(--dur-2) var(--ease-standard)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: phone ? "var(--sp-3)" : "var(--sp-4)",
      pointerEvents: "auto"
    }
  }, actions)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-expanded": aboutOpen,
    "aria-label": (aboutOpen ? "Zamknij panel: " : "Otwórz panel: ") + profile.displayName,
    onClick: toggleDisabled ? undefined : onToggleAbout,
    disabled: toggleDisabled,
    style: {
      position: "fixed",
      top: (barH - 44) / 2,
      left: phone ? "var(--sp-4)" : "var(--sp-7)",
      zIndex: 48,
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      height: 44,
      minWidth: 0,
      padding: "0 var(--sp-3) 0 0",
      border: 0,
      background: "transparent",
      color: leftInk,
      cursor: toggleDisabled ? "default" : "pointer",
      textAlign: "left",
      pointerEvents: "auto",
      transition: "color var(--dur-2) var(--ease-standard)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 32,
      height: 32,
      flex: "0 0 auto",
      position: "relative",
      overflow: "hidden",
      borderRadius: "var(--radius-xs)",
      background: "var(--plaque-navy)",
      color: "var(--plaque-ink)",
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--fw-bold)",
      fontSize: 12,
      letterSpacing: "-.02em"
    }
  }, "A3D", /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "12%",
      background: "var(--plaque-red)"
    }
  })), /*#__PURE__*/React.createElement("span", {
    "aria-live": "polite",
    style: {
      display: "inline-grid",
      font: "var(--type-h3)",
      letterSpacing: "var(--ls-heading)",
      whiteSpace: "nowrap",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": aboutOpen,
    style: {
      gridArea: "1 / 1",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: phone ? "44vw" : "24rem",
      opacity: aboutOpen ? 0 : 1,
      transform: aboutOpen ? "translateY(-6px)" : "none",
      transition: "opacity var(--dur-3) var(--ease-standard), transform var(--dur-3) var(--ease-standard)"
    }
  }, profile.displayName), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": !aboutOpen,
    style: {
      gridArea: "1 / 1",
      opacity: aboutOpen ? 1 : 0,
      transform: aboutOpen ? "none" : "translateY(6px)",
      transition: "opacity var(--dur-3) var(--ease-standard), transform var(--dur-3) var(--ease-standard)"
    }
  }, brand)), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 18,
    tone: leftInk,
    style: {
      transform: aboutOpen ? "rotate(180deg)" : "none",
      transition: "transform var(--dur-3) var(--ease-standard), background-color var(--dur-2) var(--ease-standard)"
    }
  })));
}
Object.assign(__ds_scope, { ProfileBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/profile/ProfileBar.jsx", error: String((e && e.message) || e) }); }

// components/profile/WorkCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// One work, full width of the page column. Pictures first, words after — the
// profile is a wall of work, not a list of cards. Three layouts the owner picks
// per work (stored with the work): `cover` (one picture), `cover-thumbs` (the
// default: cover + up to two thumbnails), `cover-text` (picture beside the
// words). Below `phone` every layout stacks. No border, no box: the picture
// group and its caption are the card.
const RADIUS = "var(--radius-picture)";

// A picture is a link to the work's landing page (read-only); only the orbit is
// interactive in place and carries the ↗ badge — plain photos have no badge.
function Photo({
  src,
  alt,
  aspect,
  href,
  onClick,
  label,
  radius = RADIUS
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("a", {
    href: href || "#",
    "aria-label": label,
    onClick: onClick ? e => {
      e.preventDefault();
      onClick();
    } : undefined,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "block",
      position: "relative",
      width: "100%",
      aspectRatio: aspect,
      borderRadius: radius,
      overflow: "hidden",
      background: "var(--n-150)",
      cursor: "pointer",
      textDecoration: "none"
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt,
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: hover ? "scale(1.02)" : "none",
      transition: "transform var(--dur-3) var(--ease-standard)"
    }
  }) : null);
}
function Parties({
  work,
  phone,
  tone = "var(--text-muted)"
}) {
  const rows = [work.investor && ["Inwestor", work.investor], work.developer && ["Deweloper", work.developer]].filter(Boolean);
  if (!rows.length) return null;
  return /*#__PURE__*/React.createElement("dl", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: phone ? "var(--sp-2) var(--sp-5)" : "var(--sp-2) var(--sp-7)",
      margin: 0,
      font: "var(--type-sm)",
      color: tone
    }
  }, rows.map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: "flex",
      gap: "var(--sp-2)"
    }
  }, /*#__PURE__*/React.createElement("dt", {
    style: {
      color: "var(--text-subtle)"
    }
  }, k), /*#__PURE__*/React.createElement("dd", {
    style: {
      margin: 0,
      fontWeight: "var(--fw-semibold)",
      color: "var(--text-body)"
    }
  }, v))));
}
function WorkCard({
  work,
  layout = "cover-thumbs",
  phone = false,
  owner = false,
  onOpen,
  onEdit,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const thumbs = (work.thumbs || []).slice(0, 2);
  const hasThumbs = layout === "cover-thumbs" && thumbs.length > 0;
  const beside = layout === "cover-text" && !phone;
  const coverAspect = phone ? "4 / 3" : hasThumbs || beside ? "16 / 10" : "21 / 9";
  const open = onOpen ? () => onOpen(work) : undefined;
  const openLabel = "Otwórz realizację: " + work.name;
  const cover = work.orbit ? /*#__PURE__*/React.createElement(__ds_scope.OrbitTile, {
    poster: work.orbit.poster || work.cover,
    name: work.name,
    cues: [],
    autorotate: work.orbit.autorotate,
    aspect: coverAspect,
    onOpen: open,
    openLabel: openLabel
  }) : /*#__PURE__*/React.createElement(Photo, {
    src: work.cover,
    alt: work.name + ", zdjęcie 1",
    aspect: coverAspect,
    href: work.href,
    onClick: open,
    label: openLabel
  });
  const pictures = hasThumbs ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: phone ? "1fr" : "minmax(0,2fr) minmax(0,1fr)",
      gridAutoRows: phone ? undefined : "1fr",
      gap: "var(--sp-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      gridRow: phone ? undefined : "1 / span 2"
    }
  }, cover), phone ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "var(--sp-3)"
    }
  }, thumbs.map((t, i) => /*#__PURE__*/React.createElement(Photo, {
    key: i,
    src: t,
    alt: work.name + ", zdjęcie " + (i + 2),
    aspect: "4 / 3",
    href: work.href,
    onClick: open,
    label: openLabel
  }))) : thumbs.map((t, i) => /*#__PURE__*/React.createElement(Photo, {
    key: i,
    src: t,
    alt: work.name + ", zdjęcie " + (i + 2),
    aspect: "16 / 10",
    href: work.href,
    onClick: open,
    label: openLabel
  }))) : cover;
  const pencil = owner ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Edytuj: " + work.name,
    title: "Edytuj: " + work.name,
    onClick: onEdit ? () => onEdit(work) : undefined,
    style: {
      position: "absolute",
      top: "var(--sp-4)",
      right: "var(--sp-4)",
      zIndex: 2,
      width: 40,
      height: 40,
      padding: 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-full)",
      border: 0,
      background: "rgba(255,255,255,.94)",
      color: "var(--n-950)",
      cursor: "pointer",
      boxShadow: "var(--shadow-md)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "pencil",
    size: 16,
    tone: "strong"
  })) : null;
  // The pencil always sits on the picture (top-right of the cover), whatever the layout.
  const picturesWithPencil = /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      minWidth: 0
    }
  }, pictures, pencil);
  const caption = /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-3)",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      font: phone ? "var(--type-h3)" : "var(--type-h2)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)",
      textWrap: "balance"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: work.href || "#",
    onClick: onOpen ? e => {
      e.preventDefault();
      onOpen(work);
    } : undefined,
    style: {
      color: "inherit",
      textDecoration: hover ? "underline" : "none",
      textUnderlineOffset: 4,
      textDecorationThickness: 2
    }
  }, work.name)), /*#__PURE__*/React.createElement(Parties, {
    work: work,
    phone: phone
  }), work.description ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-body)",
      color: "var(--text-muted)",
      maxWidth: beside ? undefined : "48rem",
      display: "-webkit-box",
      WebkitLineClamp: beside ? 6 : 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden"
    }
  }, work.description) : null);
  return /*#__PURE__*/React.createElement("article", _extends({
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      position: "relative",
      display: beside ? "grid" : "flex",
      gridTemplateColumns: beside ? "minmax(0,3fr) minmax(0,1fr)" : undefined,
      flexDirection: "column",
      gap: phone ? "var(--sp-5)" : "var(--sp-7)",
      alignItems: beside ? "end" : undefined,
      ...style
    }
  }, rest), picturesWithPencil, caption);
}
Object.assign(__ds_scope, { WorkCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/profile/WorkCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/AccountSettings.jsx
try { (() => {
// V-SETTINGS-ACCOUNT as shipped (atlas 12.09.2026): the settings bar (logo,
// account avatar), one 28rem card with five sections split by dividers —
// address, password, e-mail, two-factor with its two methods.
const {
  TopBar,
  Card,
  Button,
  FormField,
  Input,
  StatusMessage,
  TextLink,
  Badge,
  Divider,
  Icon,
  Avatar
} = window.ArchitektW3dDesignSystem_1d311d;
const ACC_T = {
  pl: {
    title: "Ustawienia konta",
    address: "Adres profilu",
    current: "Twój adres: ",
    handleLabel: "Adres profilu",
    handleHint: "Od 3 do 30 znaków: małe litery, cyfry i myślniki.",
    handleOwn: "To jest Twój obecny adres.",
    changeHandle: "Zmień adres",
    handleDone: "Adres zmieniony. Stary adres przekierowuje przez 30 dni.",
    password: "Zmiana hasła",
    curPass: "Bieżące hasło",
    newPass: "Nowe hasło",
    passHint: "Od 8 do 128 znaków — bez żadnych dodatkowych wymagań.",
    changePass: "Zmień hasło",
    passDone: "Hasło zmienione. Pozostałe urządzenia zostały wylogowane.",
    email: "Zmiana adresu e-mail",
    newEmail: "Nowy adres e-mail",
    sendLink: "Wyślij link potwierdzający",
    emailSent: "Jeśli ten adres jest wolny, wysłaliśmy na niego link potwierdzający (ważny 24 godziny). Nic się nie zmienia, dopóki go nie potwierdzisz.",
    emailErr: "Podaj poprawny adres e-mail.",
    other: "Użyj innego adresu",
    twoFactor: "Weryfikacja dwuskładnikowa",
    off: "Wył.",
    on: "Wł.",
    offBody: "Weryfikacja dwuskładnikowa jest wyłączona. Włącz drugi składnik, aby lepiej chronić konto.",
    onBody: "Weryfikacja dwuskładnikowa jest włączona.",
    otp: "Kody e-mailowe",
    otpBody: "Przy każdym logowaniu wysyłamy 6-cyfrowy kod na e-mail konta. Nic do instalowania.",
    confirm: "Potwierdź hasłem",
    enableOtp: "Włącz kody e-mail",
    totp: "Aplikacja uwierzytelniająca",
    totpBody: "Silniejsza ochrona — kod z aplikacji działa nawet, gdy ktoś przejmie Twoją skrzynkę.",
    setup: "Skonfiguruj",
    disable: "Wyłącz weryfikację dwuskładnikową",
    account: "Menu konta"
  },
  en: {
    title: "Account settings",
    address: "Profile address",
    current: "Your address: ",
    handleLabel: "Profile address",
    handleHint: "3 to 30 characters: lowercase letters, digits and hyphens.",
    handleOwn: "This is your current address.",
    changeHandle: "Change address",
    handleDone: "Address changed. The old one redirects for 30 days.",
    password: "Change password",
    curPass: "Current password",
    newPass: "New password",
    passHint: "8 to 128 characters — no other requirements.",
    changePass: "Change password",
    passDone: "Password changed. Your other devices have been signed out.",
    email: "Change e-mail address",
    newEmail: "New e-mail address",
    sendLink: "Send confirmation link",
    emailSent: "If this address is free, we sent it a confirmation link (valid 24 hours). Nothing changes until you confirm it.",
    emailErr: "Enter a valid e-mail address.",
    other: "Use a different address",
    twoFactor: "Two-factor authentication",
    off: "Off",
    on: "On",
    offBody: "Two-factor authentication is off. Turn on a second factor to better protect your account.",
    onBody: "Two-factor authentication is on.",
    otp: "E-mail codes",
    otpBody: "At each login we send a 6-digit code to the account's e-mail. Nothing to install.",
    confirm: "Confirm with your password",
    enableOtp: "Turn on e-mail codes",
    totp: "Authenticator app",
    totpBody: "Stronger protection — a code from an app works even if someone takes over your mailbox.",
    setup: "Set up",
    disable: "Turn off two-factor authentication",
    account: "Account menu"
  }
};
const ACC_ORIGIN = "https://dev.architektow3d.pl/";
function SectionTitle({
  children,
  right
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-4)"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      font: "var(--type-h3)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)"
    }
  }, children), right ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto"
    }
  }, right) : null);
}
function Method({
  icon,
  title,
  body,
  action,
  t,
  onEnable,
  disabled
}) {
  const [pass, setPass] = React.useState("");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "20px minmax(0,1fr)",
      columnGap: "var(--sp-4)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 20,
    tone: "body",
    style: {
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-4)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      font: "var(--type-h4)",
      fontWeight: "var(--fw-semibold)",
      color: "var(--text-strong)"
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "var(--sp-1) 0 0",
      font: "var(--type-sm)",
      color: "var(--text-muted)"
    }
  }, body)), /*#__PURE__*/React.createElement(FormField, {
    label: t.confirm,
    htmlFor: "pass-" + icon
  }, /*#__PURE__*/React.createElement(Input, {
    id: "pass-" + icon,
    type: "password",
    autoComplete: "current-password",
    value: pass,
    onChange: e => setPass(e.target.value),
    disabled: disabled
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    disabled: disabled || !pass,
    onClick: onEnable,
    style: {
      alignSelf: "flex-start"
    }
  }, action)));
}
function AccountSettings({
  profile,
  onNavigate,
  locale = "pl"
}) {
  const t = ACC_T[locale] || ACC_T.pl;
  const current = profile.handle || "";
  const [handle, setHandle] = React.useState(current);
  const [handleDone, setHandleDone] = React.useState(false);
  const [passwordDone, setPasswordDone] = React.useState(false);
  const [emailSent, setEmailSent] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const [error, setError] = React.useState(null);
  const [twoFactor, setTwoFactor] = React.useState(null);
  const handleValid = /^[a-z0-9-]{3,30}$/.test(handle);
  const handleChanged = handle !== current;
  const sectionGap = {
    display: "flex",
    flexDirection: "column",
    gap: "var(--sp-5)"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-page)",
      minHeight: "100%"
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    items: [],
    user: {
      name: profile.displayName,
      avatarUrl: profile.avatarUrl
    },
    actions: null
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: "var(--measure-form)",
      margin: "0 auto",
      padding: "var(--sp-10) var(--sp-7) var(--sp-14)",
      boxSizing: "content-box"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "md",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-6)"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      font: "var(--type-h1)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)"
    }
  }, t.title), /*#__PURE__*/React.createElement(Divider, {
    spacing: "0"
  }), /*#__PURE__*/React.createElement("section", {
    style: sectionGap
  }, /*#__PURE__*/React.createElement(SectionTitle, null, t.address), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-sm)",
      color: "var(--text-muted)",
      overflowWrap: "anywhere"
    }
  }, t.current, /*#__PURE__*/React.createElement(TextLink, {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNavigate("profile");
    }
  }, ACC_ORIGIN, /*#__PURE__*/React.createElement("wbr", null), current)), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      if (handleChanged && handleValid) setHandleDone(true);
    },
    style: sectionGap
  }, /*#__PURE__*/React.createElement(FormField, {
    label: t.handleLabel,
    htmlFor: "handle",
    hint: t.handleHint,
    status: handleChanged ? undefined : t.handleOwn,
    error: handle && !handleValid ? t.handleHint : undefined
  }, /*#__PURE__*/React.createElement(Input, {
    id: "handle",
    mono: true,
    value: handle,
    onChange: e => {
      setHandle(e.target.value);
      setHandleDone(false);
    },
    invalid: !!handle && !handleValid,
    autoComplete: "off",
    spellCheck: false
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-mono)",
      color: "var(--text-subtle)",
      overflowWrap: "anywhere"
    }
  }, ACC_ORIGIN, /*#__PURE__*/React.createElement("wbr", null), handle || "…")), handleDone ? /*#__PURE__*/React.createElement(StatusMessage, {
    tone: "success"
  }, t.handleDone) : null, /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    disabled: !handleChanged || !handleValid,
    style: {
      alignSelf: "flex-start"
    }
  }, t.changeHandle))), /*#__PURE__*/React.createElement(Divider, {
    spacing: "0"
  }), /*#__PURE__*/React.createElement("section", {
    style: sectionGap
  }, /*#__PURE__*/React.createElement(SectionTitle, null, t.password), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      setPasswordDone(true);
    },
    style: sectionGap
  }, /*#__PURE__*/React.createElement(FormField, {
    label: t.curPass,
    htmlFor: "cur-pass"
  }, /*#__PURE__*/React.createElement(Input, {
    id: "cur-pass",
    type: "password",
    autoComplete: "current-password"
  })), /*#__PURE__*/React.createElement(FormField, {
    label: t.newPass,
    htmlFor: "new-pass",
    hint: t.passHint
  }, /*#__PURE__*/React.createElement(Input, {
    id: "new-pass",
    type: "password",
    autoComplete: "new-password"
  })), passwordDone ? /*#__PURE__*/React.createElement(StatusMessage, {
    tone: "success"
  }, t.passDone) : null, /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    style: {
      alignSelf: "flex-start"
    }
  }, t.changePass))), /*#__PURE__*/React.createElement(Divider, {
    spacing: "0"
  }), /*#__PURE__*/React.createElement("section", {
    style: sectionGap
  }, /*#__PURE__*/React.createElement(SectionTitle, null, t.email), emailSent ? /*#__PURE__*/React.createElement("div", {
    style: sectionGap
  }, /*#__PURE__*/React.createElement(StatusMessage, {
    tone: "info"
  }, t.emailSent), /*#__PURE__*/React.createElement(TextLink, {
    href: "#",
    tone: "muted",
    onClick: e => {
      e.preventDefault();
      setEmailSent(false);
    }
  }, t.other)) : /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      if (!newEmail.includes("@")) {
        setError(t.emailErr);
        return;
      }
      setError(null);
      setEmailSent(true);
    },
    style: sectionGap
  }, /*#__PURE__*/React.createElement(FormField, {
    label: t.newEmail,
    htmlFor: "new-email",
    error: error
  }, /*#__PURE__*/React.createElement(Input, {
    id: "new-email",
    type: "email",
    invalid: !!error,
    value: newEmail,
    onChange: e => setNewEmail(e.target.value)
  })), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    style: {
      alignSelf: "flex-start"
    }
  }, t.sendLink))), /*#__PURE__*/React.createElement(Divider, {
    spacing: "0"
  }), /*#__PURE__*/React.createElement("section", {
    style: sectionGap
  }, /*#__PURE__*/React.createElement(SectionTitle, {
    right: /*#__PURE__*/React.createElement(Badge, {
      uppercase: true,
      tone: twoFactor ? "success" : "neutral"
    }, twoFactor ? t.on : t.off)
  }, t.twoFactor), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-sm)",
      color: "var(--text-muted)"
    }
  }, twoFactor ? t.onBody : t.offBody), /*#__PURE__*/React.createElement(Divider, {
    spacing: "var(--sp-2)"
  }), /*#__PURE__*/React.createElement(Method, {
    icon: "mail",
    title: t.otp,
    body: t.otpBody,
    action: t.enableOtp,
    t: t,
    disabled: !!twoFactor,
    onEnable: () => setTwoFactor("otp")
  }), /*#__PURE__*/React.createElement(Divider, {
    spacing: "var(--sp-2)"
  }), /*#__PURE__*/React.createElement(Method, {
    icon: "smartphone",
    title: t.totp,
    body: t.totpBody,
    action: t.setup,
    t: t,
    disabled: !!twoFactor,
    onEnable: () => setTwoFactor("totp")
  }), twoFactor ? /*#__PURE__*/React.createElement(TextLink, {
    href: "#",
    tone: "muted",
    onClick: e => {
      e.preventDefault();
      setTwoFactor(null);
    }
  }, t.disable) : null))));
}
Object.assign(window, {
  AccountSettings
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/AccountSettings.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Auth.jsx
try { (() => {
// Auth surfaces: login, sign-up, the sent-link confirmation and the 2FA
// challenge. One 28rem card on the grey page, exactly as the product's
// (auth) routes render them. All copy verbatim from messages/en.json.
const {
  Card,
  Button,
  FormField,
  Input,
  StatusMessage,
  TextLink,
  Divider,
  Icon
} = window.ArchitektW3dDesignSystem_1d311d;
function AuthShell({
  heading,
  children,
  footer
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-page)",
      minHeight: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--sp-12) var(--sp-7)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: "var(--measure-form)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-6)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 30,
      height: 30,
      position: "relative",
      overflow: "hidden",
      borderRadius: "var(--radius-xs)",
      background: "var(--plaque-navy)",
      color: "var(--plaque-ink)",
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--fw-bold)",
      fontSize: 12
    }
  }, "A3D", /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "12%",
      background: "var(--plaque-red)"
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h3)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)"
    }
  }, "Architekt\xF3w 3d")), /*#__PURE__*/React.createElement(Card, {
    padding: "lg"
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: "var(--type-h1)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)"
    }
  }, heading), children), footer));
}
function Login({
  onDone,
  onGo
}) {
  const [email, setEmail] = React.useState("studio@praga.pl");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  function submit(e) {
    e.preventDefault();
    if (password.length === 0) {
      setError("Enter your password.");
      return;
    }
    setError(null);
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      onGo("twofactor");
    }, 500);
  }
  return /*#__PURE__*/React.createElement(AuthShell, {
    heading: "Log in",
    footer: /*#__PURE__*/React.createElement("p", {
      style: {
        font: "var(--type-sm)",
        color: "var(--text-muted)",
        textAlign: "center"
      }
    }, "No account yet? ", /*#__PURE__*/React.createElement(TextLink, {
      href: "#",
      onClick: e => {
        e.preventDefault();
        onGo("register");
      }
    }, "Sign up"))
  }, /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    noValidate: true,
    style: {
      marginTop: "var(--sp-7)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-5)"
    }
  }, /*#__PURE__*/React.createElement(FormField, {
    label: "E-mail address",
    htmlFor: "login-email"
  }, /*#__PURE__*/React.createElement(Input, {
    id: "login-email",
    type: "email",
    autoComplete: "email",
    value: email,
    onChange: e => setEmail(e.target.value)
  })), /*#__PURE__*/React.createElement(FormField, {
    label: "Password",
    htmlFor: "login-password",
    error: error
  }, /*#__PURE__*/React.createElement(Input, {
    id: "login-password",
    type: "password",
    autoComplete: "current-password",
    invalid: !!error,
    value: password,
    onChange: e => setPassword(e.target.value)
  })), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    fullWidth: true,
    disabled: busy
  }, busy ? "Logging in…" : "Log in"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      font: "var(--type-sm)"
    }
  }, /*#__PURE__*/React.createElement(TextLink, {
    href: "#",
    onClick: e => e.preventDefault()
  }, "Forgot your password?"))));
}
function Register({
  onGo
}) {
  const [sent, setSent] = React.useState(false);
  const [email, setEmail] = React.useState("");
  if (sent) {
    return /*#__PURE__*/React.createElement(AuthShell, {
      heading: "Check your inbox"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: "var(--sp-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-5)"
      }
    }, /*#__PURE__*/React.createElement(StatusMessage, {
      tone: "info"
    }, "We sent an activation link to ", email || "studio@praga.pl", ". The link is valid for 24 hours."), /*#__PURE__*/React.createElement(Button, {
      variant: "quiet",
      onClick: () => onGo("onboarding")
    }, "I confirmed it \u2014 continue"), /*#__PURE__*/React.createElement(TextLink, {
      href: "#",
      tone: "muted",
      onClick: e => {
        e.preventDefault();
        setSent(false);
      }
    }, "Send the link again")));
  }
  return /*#__PURE__*/React.createElement(AuthShell, {
    heading: "Create your account",
    footer: /*#__PURE__*/React.createElement("p", {
      style: {
        font: "var(--type-sm)",
        color: "var(--text-muted)",
        textAlign: "center"
      }
    }, "Already have an account? ", /*#__PURE__*/React.createElement(TextLink, {
      href: "#",
      onClick: e => {
        e.preventDefault();
        onGo("login");
      }
    }, "Log in"))
  }, /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      setSent(true);
    },
    noValidate: true,
    style: {
      marginTop: "var(--sp-7)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-5)"
    }
  }, /*#__PURE__*/React.createElement(FormField, {
    label: "E-mail address",
    htmlFor: "reg-email"
  }, /*#__PURE__*/React.createElement(Input, {
    id: "reg-email",
    type: "email",
    autoComplete: "email",
    value: email,
    onChange: e => setEmail(e.target.value)
  })), /*#__PURE__*/React.createElement(FormField, {
    label: "Password",
    htmlFor: "reg-password",
    hint: "8 to 72 characters \u2014 no other requirements."
  }, /*#__PURE__*/React.createElement(Input, {
    id: "reg-password",
    type: "password",
    autoComplete: "new-password"
  })), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    fullWidth: true
  }, "Sign up")));
}

// The factor was chosen long before this screen — it is whatever the account
// has enabled. The challenge only says which code it is waiting for, and
// offers a backup code as the way out.
function TwoFactor({
  onGo,
  method = "totp"
}) {
  const [useBackup, setUseBackup] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState(null);
  const active = useBackup ? "backup" : method;
  const intro = {
    totp: "Enter the code from your authenticator app.",
    otp: "We sent a 6-digit code to your account's e-mail address.",
    backup: "Enter one of your backup codes."
  };
  return /*#__PURE__*/React.createElement(AuthShell, {
    heading: "Confirm your login",
    footer: /*#__PURE__*/React.createElement("p", {
      style: {
        font: "var(--type-sm)",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement(TextLink, {
      href: "#",
      tone: "muted",
      onClick: e => {
        e.preventDefault();
        onGo("login");
      }
    }, "Back to login"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--sp-6)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-5)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: active === "backup" ? "key-round" : active === "otp" ? "mail" : "smartphone",
    size: 18,
    tone: "strong"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-sm)",
      fontWeight: "var(--fw-semibold)",
      color: "var(--text-strong)"
    }
  }, active === "backup" ? "Backup code" : active === "otp" ? "E-mail code" : "Authenticator app")), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-muted)"
    }
  }, intro[active]), active === "otp" ? /*#__PURE__*/React.createElement(StatusMessage, {
    tone: "info"
  }, "Code sent \u2014 check your inbox.") : null, /*#__PURE__*/React.createElement(FormField, {
    label: active === "backup" ? "Backup code" : "Code",
    htmlFor: "code",
    error: error
  }, /*#__PURE__*/React.createElement(Input, {
    id: "code",
    mono: true,
    autoComplete: "one-time-code",
    value: code,
    invalid: !!error,
    onChange: e => {
      setCode(e.target.value);
      setError(null);
    },
    style: {
      maxWidth: 180
    }
  })), /*#__PURE__*/React.createElement(Button, {
    fullWidth: true,
    onClick: () => code.length < 6 ? setError("Invalid code. Try again.") : onGo("onboarding")
  }, "Confirm"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--sp-6)",
      font: "var(--type-sm)"
    }
  }, active === "otp" ? /*#__PURE__*/React.createElement(TextLink, {
    href: "#",
    tone: "muted",
    onClick: e => e.preventDefault()
  }, "Send the code again") : null, method === "totp" ? /*#__PURE__*/React.createElement(TextLink, {
    href: "#",
    tone: "muted",
    onClick: e => {
      e.preventDefault();
      setUseBackup(!useBackup);
      setCode("");
      setError(null);
    }
  }, useBackup ? "Back to the app code" : "Use a backup code") : null)));
}
Object.assign(window, {
  Login,
  Register,
  TwoFactor,
  AuthShell
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Auth.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Onboarding.jsx
try { (() => {
// #15/#36: the one step between login and the app, in two parts — the display
// name, then the address derived from it. The derivation happens once, so
// going back to fix the name leaves the address alone.
const {
  Card,
  Button,
  FormField,
  Input,
  HandleField,
  TextLink,
  Plaque,
  Badge,
  StatusMessage
} = window.ArchitektW3dDesignSystem_1d311d;
function handleBaseFrom(name) {
  return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
}
const TAKEN = ["studio", "praga", "admin", "kowalski"];
function Onboarding({
  onDone
}) {
  const [step, setStep] = React.useState(1);
  const [name, setName] = React.useState("");
  const [handle, setHandle] = React.useState(null);
  const trimmed = name.trim();
  const state = React.useMemo(() => {
    if (handle === null) return "idle";
    if (handle.length < 3) return "invalid";
    if (TAKEN.includes(handle)) return "taken";
    return "available";
  }, [handle]);
  const message = {
    available: "This address is free.",
    taken: "This address is already taken.",
    invalid: "The address needs 3 to 30 characters: lowercase letters, digits and hyphens, with no hyphen at the start or end.",
    idle: undefined
  }[state];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-page)",
      minHeight: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--sp-12) var(--sp-7)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: "var(--measure-page)",
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) minmax(0,320px)",
      gap: "var(--sp-12)",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "lg",
    style: {
      maxWidth: "var(--measure-form)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      marginBottom: "var(--sp-5)"
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    uppercase: true
  }, "Step ", step, " of 2")), step === 1 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: "var(--type-h1)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)"
    }
  }, "What is your name?"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-muted)",
      marginTop: "var(--sp-3)"
    }
  }, "How your profile is signed. The address is proposed from it \u2014 you can change it."), /*#__PURE__*/React.createElement("form", {
    style: {
      marginTop: "var(--sp-7)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-5)"
    },
    onSubmit: e => {
      e.preventDefault();
      if (!trimmed) return;
      if (handle === null) setHandle(handleBaseFrom(trimmed) || "studio-1");
      setStep(2);
    }
  }, /*#__PURE__*/React.createElement(FormField, {
    label: "Your name",
    htmlFor: "display-name",
    hint: "Your studio's name or your own. Up to 80 characters."
  }, /*#__PURE__*/React.createElement(Input, {
    id: "display-name",
    autoComplete: "name",
    maxLength: 80,
    value: name,
    onChange: e => setName(e.target.value)
  })), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    size: "lg",
    disabled: trimmed === "",
    style: {
      alignSelf: "flex-start"
    }
  }, "Next"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: "var(--type-h1)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)"
    }
  }, "Set your profile address"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-muted)",
      marginTop: "var(--sp-3)"
    }
  }, "This is the public address of your profile. We prefilled a proposal based on your account \u2014 change it if you like."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--sp-7)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-6)"
    }
  }, /*#__PURE__*/React.createElement(HandleField, {
    value: handle || "",
    onChange: e => setHandle(e.target.value.toLowerCase()),
    state: state,
    message: message,
    hint: "3 to 30 characters: lowercase letters, digits and hyphens."
  }), /*#__PURE__*/React.createElement(StatusMessage, {
    tone: "warning"
  }, "Setting it the first time is free. Change it later and the next change is only possible in 30 days, while the old address redirects here until somebody else claims it."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--sp-4)",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    disabled: state !== "available",
    onClick: () => onDone({
      name: trimmed,
      handle
    })
  }, "Set the address"), /*#__PURE__*/React.createElement(TextLink, {
    href: "#",
    tone: "muted",
    onClick: e => {
      e.preventDefault();
      setStep(1);
    }
  }, "Back"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-5)",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Plaque, {
    name: trimmed || "Your name"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-subtle)",
      textAlign: "center",
      maxWidth: "18rem"
    }
  }, "Your plaque, as a visitor will read it."))));
}
Object.assign(window, {
  Onboarding
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Onboarding.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/ProfileEditor.jsx
try { (() => {
// The owner's view of their own profile: the LinkedIn-shaped header the brief
// asks for, with inline editing for the three fields that exist — display
// name, photo, address. Nothing else is offered, because nothing else is in
// the product (SPEC.md §1).
const {
  TopBar,
  Card,
  Avatar,
  Button,
  IconButton,
  FormField,
  Input,
  HandleField,
  PhotoUpload,
  StatusMessage,
  Badge,
  TextLink,
  Icon,
  EmptyState,
  Divider,
  Plaque
} = window.ArchitektW3dDesignSystem_1d311d;
const TAKEN = ["studio", "praga", "admin", "kowalski"];
function SectionCard({
  title,
  action,
  children
}) {
  return /*#__PURE__*/React.createElement(Card, {
    as: "section",
    padding: "md"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-4)",
      marginBottom: "var(--sp-5)"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: "var(--type-h3)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)"
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto"
    }
  }, action)), children);
}
function ProfileEditor({
  profile,
  onChange,
  onNavigate,
  onViewPublic
}) {
  const [editingName, setEditingName] = React.useState(false);
  const [name, setName] = React.useState(profile.displayName);
  const [nameSaved, setNameSaved] = React.useState(false);
  const [handle, setHandle] = React.useState(profile.handle);
  const [handleSaved, setHandleSaved] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const handleState = handle === profile.handle ? "own" : handle.length < 3 ? "invalid" : TAKEN.includes(handle) ? "taken" : "available";
  const handleMessage = {
    own: "This is your current address.",
    available: "This address is free.",
    taken: "This address is already taken.",
    invalid: "The address needs 3 to 30 characters: lowercase letters, digits and hyphens."
  }[handleState];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-page)",
      minHeight: "100%"
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    items: [{
      id: "profile",
      label: "Profile",
      icon: "user"
    }, {
      id: "account",
      label: "Account",
      icon: "settings"
    }],
    activeItem: "profile",
    onNavigate: onNavigate,
    user: {
      name: profile.displayName,
      handle: profile.handle
    },
    actions: /*#__PURE__*/React.createElement(Button, {
      variant: "quiet",
      onClick: onViewPublic
    }, "View public profile")
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: "var(--measure-page)",
      margin: "0 auto",
      padding: "var(--sp-10) var(--sp-7) var(--sp-14)",
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) minmax(0,300px)",
      gap: "var(--sp-8)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-6)"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "lg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--sp-8)",
      alignItems: "flex-start",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    src: profile.avatarUrl,
    name: profile.displayName,
    size: 128
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-4)",
      minWidth: 0,
      flex: 1
    }
  }, editingName ? /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onChange({
        displayName: name.trim() || profile.displayName
      });
      setEditingName(false);
      setNameSaved(true);
    },
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-4)"
    }
  }, /*#__PURE__*/React.createElement(FormField, {
    label: "Name (your studio's or your own)",
    htmlFor: "edit-name"
  }, /*#__PURE__*/React.createElement(Input, {
    id: "edit-name",
    size: "lg",
    value: name,
    onChange: e => setName(e.target.value),
    maxLength: 80
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--sp-3)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    type: "submit"
  }, "Save the name"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: () => {
      setName(profile.displayName);
      setEditingName(false);
    }
  }, "Cancel"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-4)"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: "var(--type-h1)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)"
    }
  }, profile.displayName), /*#__PURE__*/React.createElement(IconButton, {
    icon: "pencil",
    label: "Edit display name",
    onClick: () => setEditingName(true)
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      font: "var(--type-mono)",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map-pin",
    size: 16,
    tone: "subtle"
  }), /*#__PURE__*/React.createElement(TextLink, {
    href: "#",
    underline: "always",
    onClick: e => {
      e.preventDefault();
      onViewPublic();
    },
    style: {
      font: "var(--type-mono)"
    }
  }, "architektow3d.pl/", profile.handle)), nameSaved ? /*#__PURE__*/React.createElement(StatusMessage, {
    tone: "success",
    plain: true
  }, "Name saved.") : null))), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Profile photo"
  }, /*#__PURE__*/React.createElement(PhotoUpload, {
    src: profile.avatarUrl,
    name: profile.displayName,
    busy: uploading,
    onChoose: () => {
      setUploading(true);
      setTimeout(() => {
        setUploading(false);
        onChange({
          avatarUrl: "../../assets/landing-placeholder.webp"
        });
      }, 900);
    }
  })), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Profile address",
    action: /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral"
    }, "changed 0 times")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-5)"
    }
  }, /*#__PURE__*/React.createElement(HandleField, {
    value: handle,
    onChange: e => {
      setHandle(e.target.value.toLowerCase());
      setHandleSaved(false);
    },
    state: handleState,
    message: handleMessage,
    hint: "3 to 30 characters: lowercase letters, digits and hyphens."
  }), handleSaved ? /*#__PURE__*/React.createElement(StatusMessage, {
    tone: "success"
  }, "Address saved: architektow3d.pl/", profile.handle, ". The old address redirects to the new one until someone else claims it.") : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--sp-4)",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    disabled: handleState !== "available",
    onClick: () => {
      onChange({
        handle
      });
      setHandleSaved(true);
    }
  }, "Change the address"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-subtle)"
    }
  }, "The address can be changed once every 30 days.")))), /*#__PURE__*/React.createElement(EmptyState, {
    icon: "folder-open",
    title: "Projects are not part of the product yet",
    body: "A profile is a photo, a name and an address. When galleries arrive, this is where they will sit."
  })), /*#__PURE__*/React.createElement("aside", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-6)",
      position: "sticky",
      top: 88
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "sm"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-eyebrow)",
      letterSpacing: "var(--ls-caps)",
      textTransform: "uppercase",
      color: "var(--text-subtle)"
    }
  }, "Your plaque"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--sp-5)",
      display: "flex",
      justifyContent: "flex-start",
      overflowX: "auto",
      paddingBottom: "var(--sp-2)"
    }
  }, /*#__PURE__*/React.createElement(Plaque, {
    name: profile.displayName
  })), /*#__PURE__*/React.createElement(Divider, {
    spacing: "var(--sp-6)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-muted)"
    }
  }, "This is the link preview a visitor sees when your profile is shared without a photo.")), /*#__PURE__*/React.createElement(Card, {
    padding: "sm"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      font: "var(--type-h4)",
      fontWeight: "var(--fw-semibold)",
      color: "var(--text-strong)"
    }
  }, "Finish your profile"), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: "none",
      padding: 0,
      margin: "var(--sp-4) 0 0",
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-3)"
    }
  }, [["Name", true], ["Address", true], ["Photo", !!profile.avatarUrl]].map(([label, done]) => /*#__PURE__*/React.createElement("li", {
    key: label,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      font: "var(--type-sm)",
      color: done ? "var(--text-muted)" : "var(--text-strong)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: done ? "check" : "circle",
    size: 16,
    tone: done ? "success" : "subtle"
  }), label)))))));
}
Object.assign(window, {
  ProfileEditor
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/ProfileEditor.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/tweaks-panel.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
// Copied omelette starter. Re-running copy_starter_component with this kind overwrites this file with the latest version (page content is unaffected).

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // data-om-starter: inert presence marker — Claude Design's starter-usage
  // probe reads it. The closed panel renders nothing, so the marker rides
  // the <html> element as an attribute instead of a rendered node — zero
  // elements added, so page CSS (even structural selectors like
  // :nth-child) can never observe it. It records that the page WIRES a
  // tweaks panel, whether or not the panel is open. Keep this effect.
  React.useEffect(() => {
    document.documentElement.setAttribute('data-om-starter', 'tweaks-panel');
    return () => document.documentElement.removeAttribute('data-om-starter');
  }, []);
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-omelette-chrome": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/tweaks-panel.jsx", error: String((e && e.message) || e) }); }

// ui_kits/public-web/Hero.jsx
try { (() => {
// V-HOME, as the product ships it (atlas 12.09.2026): the facade photograph
// fills the first screen behind a scrim, the bar floats on it, the promise and
// two calls to action sit in the hero column, and the footer follows below.
const {
  Button,
  IconButton,
  Icon,
  Footer
} = window.ArchitektW3dDesignSystem_1d311d;
const HERO_T = {
  pl: {
    heading: "Twoje portfolio pod dobrym adresem.",
    lead: "Sceny 3D w internecie w kilka minut. Publiczne profile dla architektów i artystów.",
    primary: "Zamelduj się",
    secondary: "Jestem zameldowany",
    login: "Zaloguj się",
    register: "Załóż konto",
    menu: "Menu główne",
    lang: "Polski"
  },
  en: {
    heading: "Your portfolio, at a good address.",
    lead: "3D scenes online in minutes. Public profiles for architects and artists.",
    primary: "Check in",
    secondary: "I'm already checked in",
    login: "Log in",
    register: "Sign up",
    menu: "Main menu",
    lang: "English"
  }
};
const HERO_PHOTO = "../../assets/hero-facade-plaque.jpeg";
const HERO_SCRIM = "linear-gradient(180deg, rgba(12,17,22,.62) 0%, rgba(12,17,22,.3) 32%, rgba(12,17,22,.75) 100%)";
function Flag({
  locale
}) {
  const s = {
    width: 18,
    height: 12,
    borderRadius: 2,
    overflow: "hidden",
    display: "inline-flex",
    flexDirection: "column",
    flex: "0 0 auto",
    boxShadow: "0 0 0 1px rgba(0,0,0,.12)"
  };
  if (locale === "en") return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      ...s,
      background: "#0f4eb1",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 4,
      height: 4,
      background: "#c9150f",
      boxShadow: "0 0 0 1px #fff"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 7,
      width: 4,
      background: "#c9150f",
      boxShadow: "0 0 0 1px #fff"
    }
  }));
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: s
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      background: "#fff"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      background: "#c9150f"
    }
  }));
}

// C-LANGUAGE-CHIP — flag, locale name, chevron; opens the other locale.
function LanguageChip({
  locale,
  onChange,
  onPhoto = false
}) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const names = {
    pl: "Polski",
    en: "English"
  };
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const down = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const key = e => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    style: {
      position: "relative",
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-haspopup": "listbox",
    "aria-expanded": open,
    onClick: () => setOpen(o => !o),
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      height: 40,
      padding: "0 var(--sp-4)",
      border: 0,
      borderRadius: "var(--radius-control)",
      cursor: "pointer",
      font: "var(--type-sm)",
      fontWeight: "var(--fw-medium)",
      color: onPhoto ? "#fff" : "var(--text-body)",
      background: hover ? onPhoto ? "rgba(255,255,255,.1)" : "var(--surface-active)" : "transparent",
      transition: "var(--transition-control)"
    }
  }, /*#__PURE__*/React.createElement(Flag, {
    locale: locale
  }), names[locale], /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 14,
    tone: onPhoto ? "onPhoto" : "muted"
  })), open ? /*#__PURE__*/React.createElement("ul", {
    role: "listbox",
    style: {
      position: "absolute",
      top: "calc(100% + 6px)",
      right: 0,
      minWidth: 160,
      margin: 0,
      padding: "var(--sp-2)",
      listStyle: "none",
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-card)",
      boxShadow: "var(--shadow-lift)",
      zIndex: 5
    }
  }, ["pl", "en"].map(l => /*#__PURE__*/React.createElement("li", {
    key: l,
    role: "option",
    "aria-selected": l === locale,
    onClick: () => {
      setOpen(false);
      if (onChange) onChange(l);
    },
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      height: 40,
      padding: "0 var(--sp-4)",
      borderRadius: "var(--radius-control)",
      cursor: "pointer",
      font: "var(--type-sm)",
      fontWeight: l === locale ? "var(--fw-semibold)" : "var(--fw-regular)",
      color: "var(--text-strong)",
      background: l === locale ? "var(--surface-sunken)" : "transparent"
    }
  }, /*#__PURE__*/React.createElement(Flag, {
    locale: l
  }), names[l]))) : null);
}
function HeroMark() {
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 30,
      height: 30,
      flex: "0 0 auto",
      position: "relative",
      overflow: "hidden",
      borderRadius: "var(--radius-xs)",
      background: "var(--plaque-navy)",
      color: "var(--plaque-ink)",
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--fw-bold)",
      fontSize: 11,
      letterSpacing: "-.02em"
    }
  }, "A3D", /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "12%",
      background: "var(--plaque-red)"
    }
  }));
}

// C-TOPBAR, home variant, on photo. Phone: the actions fold into C-MOBILE-MENU.
function HomeBar({
  t,
  locale,
  onLocale,
  onGo,
  phone
}) {
  const [menu, setMenu] = React.useState(false);
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: "relative",
      zIndex: 2,
      height: phone ? 56 : 64,
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-4)",
      padding: phone ? "0 var(--sp-5)" : "0 var(--sp-7)",
      maxWidth: "var(--measure-wide)",
      margin: "0 auto",
      width: "100%",
      boxSizing: "border-box",
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      textDecoration: "none",
      color: "inherit"
    }
  }, /*#__PURE__*/React.createElement(HeroMark, null), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h3)",
      letterSpacing: "var(--ls-heading)",
      color: "#fff"
    }
  }, "Architekt\xF3w 3d")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-4)"
    }
  }, phone ? /*#__PURE__*/React.createElement(IconButton, {
    icon: menu ? "x" : "menu",
    label: t.menu,
    tone: "onPhoto",
    "aria-expanded": menu,
    onClick: () => setMenu(o => !o)
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(LanguageChip, {
    locale: locale,
    onChange: onLocale,
    onPhoto: true
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "onPhotoQuiet",
    onClick: () => onGo("login")
  }, t.login), /*#__PURE__*/React.createElement(Button, {
    variant: "onPhoto",
    onClick: () => onGo("register")
  }, t.register))), phone && menu ? /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-label": t.menu,
    style: {
      position: "absolute",
      top: 56,
      left: "var(--sp-4)",
      right: "var(--sp-4)",
      padding: "var(--sp-4)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-3)",
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-card)",
      boxShadow: "var(--shadow-lift)",
      color: "var(--text-body)"
    }
  }, /*#__PURE__*/React.createElement(LanguageChip, {
    locale: locale,
    onChange: l => {
      setMenu(false);
      onLocale(l);
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    fullWidth: true,
    onClick: () => {
      setMenu(false);
      onGo("login");
    }
  }, t.login), /*#__PURE__*/React.createElement(Button, {
    variant: "solid",
    fullWidth: true,
    onClick: () => {
      setMenu(false);
      onGo("register");
    }
  }, t.register)) : null);
}
function Hero({
  onGo,
  locale = "pl",
  onLocale = () => {},
  phone = false
}) {
  const t = HERO_T[locale] || HERO_T.pl;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-page)",
      minHeight: "100%",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("main", {
    style: {
      position: "relative",
      isolation: "isolate",
      minHeight: phone ? 760 : "100svh",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: HERO_PHOTO,
    alt: "",
    "aria-hidden": "true",
    fetchPriority: "high",
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: phone ? "90% 40%" : "70% 40%",
      zIndex: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 1,
      flex: 1,
      display: "flex",
      flexDirection: "column",
      background: HERO_SCRIM
    }
  }, /*#__PURE__*/React.createElement(HomeBar, {
    t: t,
    locale: locale,
    onLocale: onLocale,
    onGo: onGo,
    phone: phone
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: phone ? "flex-end" : "center",
      maxWidth: "var(--measure-wide)",
      width: "100%",
      margin: "0 auto",
      boxSizing: "border-box",
      padding: phone ? "var(--sp-10) var(--sp-5) var(--sp-9)" : "var(--sp-12) var(--sp-7)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "44rem",
      display: "flex",
      flexDirection: "column",
      gap: phone ? "var(--sp-5)" : "var(--sp-7)"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      font: "var(--type-hero)",
      fontSize: phone ? "var(--fs-display)" : "var(--fs-hero)",
      letterSpacing: "var(--ls-hero)",
      color: "#fff",
      textWrap: "balance"
    }
  }, t.heading), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-lead)",
      color: "rgba(255,255,255,.86)",
      maxWidth: "30rem"
    }
  }, t.lead), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: phone ? "column" : "row",
      flexWrap: "wrap",
      gap: phone ? "var(--sp-4)" : "var(--sp-4)",
      marginTop: phone ? 0 : "var(--sp-2)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "onPhoto",
    fullWidth: phone,
    onClick: () => onGo("register")
  }, t.primary), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "onPhotoQuiet",
    fullWidth: phone,
    onClick: () => onGo("login"),
    style: {
      border: "1px solid rgba(255,255,255,.55)"
    }
  }, t.secondary)))))), /*#__PURE__*/React.createElement(Footer, {
    company: "Architectorium Sp. z o.o.",
    copyright: "\xA9 2026",
    links: [],
    style: {
      background: "var(--surface-page)",
      border: 0
    }
  }));
}
Object.assign(window, {
  Hero,
  LanguageChip,
  Flag
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/public-web/Hero.jsx", error: String((e && e.message) || e) }); }

// ui_kits/public-web/NotFound.jsx
try { (() => {
// V-404 as shipped: one card, photo panel beside the text from `sm`, banner
// above it on a phone (D-SHELL-13). No bar, no logo, no footer.
const {
  Button,
  Icon
} = window.ArchitektW3dDesignSystem_1d311d;
const NF_T = {
  pl: {
    heading: "Zgubiliśmy się?",
    home: "Wróć do domu"
  },
  en: {
    heading: "Lost?",
    home: "Back home"
  }
};
function NotFound({
  onGo,
  locale = "pl",
  phone = false
}) {
  const t = NF_T[locale] || NF_T.pl;
  return /*#__PURE__*/React.createElement("main", {
    style: {
      background: "var(--surface-page)",
      minHeight: phone ? "100%" : "100svh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: phone ? "var(--sp-5)" : "var(--sp-10)",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 560,
      display: "grid",
      gridTemplateColumns: phone ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1fr)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-picture)",
      overflow: "hidden",
      background: "var(--surface-card)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "relative",
      minHeight: phone ? 160 : 340,
      background: "var(--n-900)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/hero-facade-plaque.jpeg",
    alt: "",
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: "96% 42%"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(to top, rgba(12,17,22,.35), rgba(12,17,22,0) 50%)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "flex-start",
      gap: "var(--sp-5)",
      padding: phone ? "var(--sp-7) var(--sp-6)" : "var(--sp-10)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map-pin-off",
    size: 24,
    tone: "subtle"
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      font: "var(--type-h2)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)"
    }
  }, t.heading), /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    onClick: () => onGo("hero")
  }, t.home))));
}
Object.assign(window, {
  NotFound
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/public-web/NotFound.jsx", error: String((e && e.message) || e) }); }

// ui_kits/public-web/PublicProfile.jsx
try { (() => {
// The public profile as a wall of work: cover under a transparent bar, the
// about panel sliding in from the left, works stacked full width in a column
// capped at --measure-works. Viewer modes: visitor (signed-out), other
// (signed-in, not the owner), owner. Owner edits identity in the panel and
// works on their own landing pages. Identity editing happens inside the about
// panel itself (same layout, framed fields) — see AboutPanel's `editing`.
const {
  ProfileBar,
  AboutPanel,
  WorkCard,
  Button,
  Icon,
  Footer,
  Avatar
} = window.ArchitektW3dDesignSystem_1d311d;
const T = {
  pl: {
    login: "Zaloguj się",
    register: "Załóż konto",
    add: "Realizacja",
    edit: "Edytuj",
    works: "Realizacje",
    account: "Menu konta",
    menu: "Menu",
    profileItem: "Profil",
    accountItem: "Konto",
    logout: "Wyloguj",
    name: "Nazwa",
    headline: "Nagłówek",
    bio: "O nas",
    places: "Siedziba i obszar działania (po przecinku)",
    save: "Zapisz",
    cancel: "Anuluj",
    editTitle: "Edytuj profil",
    photo: "Zmień zdjęcie",
    coverChange: "Zmień tło",
    empty: "Jeszcze bez realizacji",
    emptyBody: "Wejdź w „Edytuj” i dodaj pierwszą plusem pod zdjęciem w tle. Nazwa i jedno zdjęcie wystarczą na start."
  },
  en: {
    login: "Log in",
    register: "Sign up",
    add: "Work",
    edit: "Edit",
    works: "Works",
    account: "Account menu",
    menu: "Menu",
    profileItem: "Profile",
    accountItem: "Account",
    logout: "Log out",
    name: "Name",
    headline: "Headline",
    bio: "About",
    places: "Based in and working across (comma-separated)",
    save: "Save",
    cancel: "Cancel",
    editTitle: "Edit profile",
    photo: "Change photo",
    coverChange: "Change cover",
    empty: "No works yet",
    emptyBody: "Open “Edit” and add the first one with the plus under the cover. A name and one photo are enough to start."
  }
};

// The cover band is always there (a photo, or the dark placeholder) and scrolls
// with the page; the bar turns solid once the band's bottom edge passes under it.
function useSolid(coverRef, rootRef, barTop) {
  const [solid, setSolid] = React.useState(false);
  React.useEffect(() => {
    if (!coverRef.current) return;
    const io = new IntersectionObserver(([e]) => setSolid(!e.isIntersecting), {
      root: rootRef && rootRef.current ? rootRef.current : null,
      rootMargin: "-" + barTop + "px 0px 0px 0px",
      threshold: 0
    });
    io.observe(coverRef.current);
    return () => io.disconnect();
  }, [coverRef, rootRef, barTop]);
  return solid;
}

// One popover for the bar's right slot. Desktop: language chip + avatar menu
// (Profil, Konto, Wyloguj). Phone: EVERYTHING lives under one trigger — the
// avatar for the signed-in, a hamburger for the visitor — language included.
// Dismiss: outside press, Escape, or picking an item.
function Popover({
  trigger,
  label,
  open,
  setOpen,
  children
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const down = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const key = e => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: "relative",
      display: "inline-flex"
    }
  }, React.cloneElement(trigger, {
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-label": label,
    onClick: () => setOpen(o => !o)
  }), open ? /*#__PURE__*/React.createElement("nav", {
    role: "menu",
    "aria-label": label,
    style: {
      position: "absolute",
      top: "calc(100% + 8px)",
      right: 0,
      minWidth: 224,
      padding: "var(--sp-2)",
      background: "var(--surface-card)",
      border: "1px solid var(--border-hairline)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-lift)",
      display: "flex",
      flexDirection: "column",
      gap: 2,
      color: "var(--text-body)"
    }
  }, children) : null);
}
function MenuItem({
  icon,
  lead,
  check,
  children,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "menuitem",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      width: "100%",
      height: 44,
      padding: "0 var(--sp-4)",
      border: 0,
      borderRadius: "var(--radius-sm)",
      background: hover ? "var(--surface-hover)" : "transparent",
      font: "var(--type-body)",
      color: "var(--text-strong)",
      textAlign: "left",
      cursor: "pointer"
    }
  }, lead ? lead : icon ? /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 18,
    tone: "muted"
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, children), check ? /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    tone: "strong"
  }) : null);
}
function MenuRule() {
  return /*#__PURE__*/React.createElement("hr", {
    style: {
      margin: "var(--sp-1) 0",
      border: 0,
      borderTop: "1px solid var(--border-hairline)"
    }
  });
}
function LanguageItems({
  locale,
  onLocale,
  onPick
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(MenuItem, {
    lead: /*#__PURE__*/React.createElement(window.Flag, {
      locale: "pl"
    }),
    check: locale === "pl",
    onClick: () => {
      onLocale && onLocale("pl");
      onPick();
    }
  }, "Polski"), /*#__PURE__*/React.createElement(MenuItem, {
    lead: /*#__PURE__*/React.createElement(window.Flag, {
      locale: "en"
    }),
    check: locale === "en",
    onClick: () => {
      onLocale && onLocale("en");
      onPick();
    }
  }, "English"));
}
function AccountMenu({
  profile,
  phone,
  locale,
  onLocale,
  onGo,
  t
}) {
  const [open, setOpen] = React.useState(false);
  const pick = s => () => {
    setOpen(false);
    if (s && onGo) onGo(s);
  };
  const trigger = /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      width: 40,
      height: 40,
      padding: 0,
      border: 0,
      background: "transparent",
      borderRadius: profile.avatarShape === "square" ? "var(--radius-xs)" : "var(--radius-full)",
      cursor: "pointer",
      display: "inline-flex",
      boxShadow: "0 0 0 2px var(--surface-card)"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    src: profile.avatarUrl,
    name: profile.displayName,
    size: 40,
    square: profile.avatarShape === "square",
    alt: ""
  }));
  return /*#__PURE__*/React.createElement(Popover, {
    trigger: trigger,
    label: t.account,
    open: open,
    setOpen: setOpen
  }, /*#__PURE__*/React.createElement(MenuItem, {
    icon: "user",
    onClick: pick("profile")
  }, t.profileItem), /*#__PURE__*/React.createElement(MenuItem, {
    icon: "settings",
    onClick: pick("account")
  }, t.accountItem), phone ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(MenuRule, null), /*#__PURE__*/React.createElement(LanguageItems, {
    locale: locale,
    onLocale: onLocale,
    onPick: () => setOpen(false)
  })) : null, /*#__PURE__*/React.createElement(MenuRule, null), /*#__PURE__*/React.createElement(MenuItem, {
    icon: "log-out",
    onClick: pick("logout")
  }, t.logout));
}
function VisitorMenu({
  onPhoto,
  locale,
  onLocale,
  onGo,
  t
}) {
  const [open, setOpen] = React.useState(false);
  const pick = s => () => {
    setOpen(false);
    if (s && onGo) onGo(s);
  };
  const trigger = /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      width: 40,
      height: 40,
      padding: 0,
      border: 0,
      background: "transparent",
      borderRadius: "var(--radius-full)",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "menu",
    size: 22,
    tone: onPhoto ? "onPhoto" : "strong"
  }));
  return /*#__PURE__*/React.createElement(Popover, {
    trigger: trigger,
    label: t.menu,
    open: open,
    setOpen: setOpen
  }, /*#__PURE__*/React.createElement(LanguageItems, {
    locale: locale,
    onLocale: onLocale,
    onPick: () => setOpen(false)
  }), /*#__PURE__*/React.createElement(MenuRule, null), /*#__PURE__*/React.createElement(MenuItem, {
    icon: "log-in",
    onClick: pick("login")
  }, t.login), /*#__PURE__*/React.createElement(MenuItem, {
    icon: "user-plus",
    onClick: pick("register")
  }, t.register));
}
function PublicProfile({
  profile,
  works,
  viewer = "visitor",
  locale = "pl",
  onLocale,
  phone = false,
  rootRef,
  aboutDefault,
  onOpenWork,
  onEditWork,
  onEnlarge,
  onChangeProfile,
  onGo
}) {
  const t = T[locale];
  const owner = viewer === "owner";
  const hasCover = true; // a photo or the placeholder — the band is always there
  const [about, setAbout] = React.useState(aboutDefault ?? !phone);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(null);
  const startEdit = () => {
    setDraft({
      ...profile
    });
    setAbout(true);
    setEditing(true);
  };
  const stopEdit = () => {
    setEditing(false);
    setDraft(null);
  };
  const cancelEdit = () => {
    stopEdit();
    setAbout(false);
  }; // × drops the draft and closes the panel; ✓ saves and leaves it open
  const saveEdit = () => {
    if (draft && onChangeProfile) onChangeProfile({
      displayName: draft.displayName,
      headline: draft.headline,
      bio: draft.bio,
      places: draft.places || [],
      avatarShape: draft.avatarShape || "circle"
    });
    stopEdit();
  };
  const barTop = phone ? 56 : 64;
  const coverRef = React.useRef(null);
  const solid = useSolid(coverRef, rootRef, barTop);
  const onPhoto = hasCover && !solid;
  const lang = !phone ? /*#__PURE__*/React.createElement(window.LanguageChip, {
    locale: locale,
    onChange: onLocale,
    onPhoto: onPhoto
  }) : null;
  const actions = viewer === "visitor" ? phone ? /*#__PURE__*/React.createElement(VisitorMenu, {
    onPhoto: onPhoto,
    locale: locale,
    onLocale: onLocale,
    onGo: onGo,
    t: t
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, lang, /*#__PURE__*/React.createElement(Button, {
    variant: onPhoto ? "onPhotoQuiet" : "ghost",
    onClick: () => onGo && onGo("login")
  }, t.login), /*#__PURE__*/React.createElement(Button, {
    variant: onPhoto ? "onPhoto" : "solid",
    onClick: () => onGo && onGo("register")
  }, t.register)) : viewer === "other" ? /*#__PURE__*/React.createElement(React.Fragment, null, lang, /*#__PURE__*/React.createElement(AccountMenu, {
    profile: {
      displayName: "Kuba Render",
      avatarUrl: null
    },
    phone: phone,
    locale: locale,
    onLocale: onLocale,
    onGo: onGo,
    t: t
  })) : /*#__PURE__*/React.createElement(React.Fragment, null, lang, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": t.editTitle,
    title: t.editTitle,
    "aria-pressed": editing,
    disabled: editing,
    onClick: startEdit,
    style: {
      width: 40,
      height: 40,
      padding: 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-full)",
      border: 0,
      background: "rgba(255,255,255,.94)",
      color: "var(--n-950)",
      cursor: editing ? "default" : "pointer",
      boxShadow: "var(--shadow-md)",
      opacity: editing ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 16,
    tone: "strong"
  })), /*#__PURE__*/React.createElement(AccountMenu, {
    profile: profile,
    phone: phone,
    locale: locale,
    onLocale: onLocale,
    onGo: onGo,
    t: t
  }));
  const padX = phone ? "var(--sp-4)" : "var(--sp-7)";
  const PANEL_W = 380;
  const avatarSize = phone ? 120 : 176;
  // Floor = bar + avatar/2 + gap, so the avatar can never rise into the bar.
  const coverMin = barTop + avatarSize / 2 + (phone ? 12 : 16);
  const coverH = phone ? "clamp(" + coverMin + "px, 17vh, 150px)" : "clamp(" + coverMin + "px, 19vh, 240px)";
  // Page avatar: on the band's bottom edge, left edge flush with the works column
  // (same rule as <main>'s padding); scrolls with the band. The panel carries its
  // own copy, centred, at the same height.
  const avatarLeft = "max(" + padX + ", calc((100% - var(--measure-works)) / 2 + " + padX + "))";
  const avatarTop = "calc(" + coverH + " - " + avatarSize / 2 + "px)";
  const gap = phone ? 16 : 24;
  const panelStart = 0;
  const headroom = "calc(" + coverH + " + " + (avatarSize / 2 + gap) + "px)";
  const sq = profile.avatarShape === "square";
  const avatarButton = /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-expanded": about,
    "aria-label": (about ? "Zamknij panel: " : "Otwórz panel: ") + profile.displayName,
    onClick: () => {
      if (!editing) setAbout(o => !o);
    },
    style: {
      padding: 0,
      border: 0,
      background: "transparent",
      borderRadius: sq ? "var(--radius-md)" : "var(--radius-full)",
      cursor: editing ? "default" : "pointer",
      display: "inline-flex",
      boxShadow: "0 0 0 4px var(--surface-card)"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    src: profile.avatarUrl,
    name: profile.displayName,
    size: avatarSize,
    square: sq,
    alt: ""
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-page)",
      minHeight: "100%"
    }
  }, /*#__PURE__*/React.createElement(ProfileBar, {
    profile: profile,
    solid: !onPhoto,
    aboutOpen: about,
    onToggleAbout: () => setAbout(o => !o),
    toggleDisabled: editing,
    phone: phone,
    actions: actions
  }), /*#__PURE__*/React.createElement("div", {
    ref: coverRef,
    style: {
      position: "relative",
      height: coverH,
      background: "var(--n-900)",
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "button",
    tabIndex: 0,
    "aria-expanded": about,
    "aria-label": (about ? "Zamknij panel: " : "Otwórz panel: ") + profile.displayName,
    onClick: () => {
      if (!editing) setAbout(o => !o);
    },
    onKeyDown: e => {
      if (!editing && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        setAbout(o => !o);
      }
    },
    style: {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      cursor: editing ? "default" : "pointer"
    }
  }, profile.cover ? /*#__PURE__*/React.createElement("img", {
    src: profile.cover,
    alt: "Zdjęcie w tle profilu " + profile.displayName,
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: "50% 45%"
    }
  }) :
  /*#__PURE__*/
  // Placeholder band: the plaque's navy, deep, with a faint diagonal weave — never empty.
  React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      inset: 0,
      background: "repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0 2px, transparent 2px 14px), linear-gradient(180deg, var(--plaque-navy-deep), #052a68)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(to bottom, rgba(12,17,22,.5), rgba(12,17,22,0) 60%)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: avatarLeft,
      right: padX,
      bottom: -avatarSize / 2,
      display: "flex",
      alignItems: "flex-end",
      gap: phone ? "var(--sp-4)" : "var(--sp-6)",
      zIndex: 3,
      pointerEvents: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      pointerEvents: "auto"
    }
  }, avatarButton), /*#__PURE__*/React.createElement("p", {
    "aria-hidden": about,
    style: {
      margin: 0,
      paddingBottom: phone ? 6 : 10,
      font: phone ? "var(--type-h2)" : "var(--type-h1)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)",
      minWidth: 0,
      overflowWrap: "anywhere",
      textWrap: "balance",
      opacity: about ? 0 : 1,
      transform: about ? "translateX(-12px)" : "none",
      transition: "opacity var(--dur-3) var(--ease-standard), transform var(--dur-3) var(--ease-standard)"
    }
  }, profile.displayName)), editing ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      right: padX,
      bottom: "var(--sp-4)",
      zIndex: 3
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "onPhoto"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "image",
    size: 16,
    tone: "strong"
  }), t.coverChange)) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 1,
      background: "var(--surface-page)"
    }
  }, owner && editing ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: gap,
      right: avatarLeft,
      zIndex: 3
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    onClick: () => onEditWork && onEditWork(null)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 16,
    tone: "strong"
  }), t.add)) : null, /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: "var(--measure-works)",
      margin: "0 auto",
      padding: avatarSize / 2 + gap + "px " + padX + " " + (phone ? "var(--sp-12)" : "var(--sp-16)"),
      display: "flex",
      flexDirection: "column",
      gap: phone ? "var(--sp-10)" : "var(--sp-14)"
    }
  }, works.length === 0 && owner ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--sp-14) var(--sp-7)",
      textAlign: "center",
      border: "1px dashed var(--border-strong)",
      borderRadius: "var(--radius-card)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "var(--sp-3)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "folder-open",
    size: 28,
    tone: "subtle"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-h3)",
      color: "var(--text-strong)"
    }
  }, t.empty), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-sm)",
      color: "var(--text-muted)",
      maxWidth: "26rem"
    }
  }, t.emptyBody)) : null, works.map(w => /*#__PURE__*/React.createElement(WorkCard, {
    key: w.id,
    work: {
      ...w,
      href: "/" + profile.handle + "/" + w.slug
    },
    layout: w.layout,
    phone: phone,
    owner: owner,
    onOpen: onOpenWork,
    onEdit: onEditWork
  }))), /*#__PURE__*/React.createElement(Footer, {
    note: "Warszawa \xB7 architektow3d.pl",
    links: [{
      label: "Regulamin"
    }, {
      label: "Prywatność"
    }, {
      label: "Kontakt"
    }],
    locale: locale,
    onLocaleChange: onLocale
  })), /*#__PURE__*/React.createElement(AboutPanel, {
    profile: profile,
    open: about,
    onClose: () => setAbout(false),
    phone: phone,
    owner: owner,
    editing: editing,
    draft: draft,
    onDraftChange: p => setDraft(d => ({
      ...d,
      ...p
    })),
    onSave: saveEdit,
    onCancel: cancelEdit,
    top: barTop,
    start: panelStart,
    width: PANEL_W,
    headroom: headroom,
    avatarTop: avatarTop,
    avatarSize: avatarSize,
    locale: locale
  }));
}
Object.assign(window, {
  PublicProfile
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/public-web/PublicProfile.jsx", error: String((e && e.message) || e) }); }

// ui_kits/public-web/WorkPage.jsx
try { (() => {
// A work's landing page (#200): /{handle}/{slug}. Behance-shaped — the words
// once at the top, then every picture at full column width, the orbit among
// them. The owner edits here, in place. Edit mode is a form top-to-bottom:
// words → pictures (each with replace / remove / cover) → how the card looks on
// the profile → autorotate → delete. A new work starts empty.
const {
  ProfileBar,
  AboutPanel,
  OrbitTile,
  Button,
  Icon,
  Avatar,
  Footer,
  Input,
  FormField
} = window.ArchitektW3dDesignSystem_1d311d;
const WT = {
  pl: {
    back: "Wszystkie realizacje",
    edit: "Edytuj",
    save: "Zapisz",
    cancel: "Anuluj",
    newWork: "Nowa realizacja",
    untitled: "Bez nazwy",
    name: "Nazwa",
    investor: "Inwestor",
    developer: "Deweloper",
    description: "Opis",
    descHint: "Do 300 znaków. Widoczny na stronie realizacji i — w układzie „Okładka + opis” — na karcie.",
    pictures: "Zdjęcia",
    picturesHint: "Kolejność ustawiasz, przeciągając miniatury. Pierwsze zdjęcie jest okładką karty na profilu; drugie i trzecie — miniaturami w układzie „Okładka + 2 miniatury”.",
    dragHint: "Przeciągnij, aby zmienić kolejność",
    moveLeft: "Przesuń w lewo",
    moveRight: "Przesuń w prawo",
    orbit: "Widok 360° (R360)",
    orbitHint: "Paczka zip z R360. Na profilu widok obraca się w miejscu karty.",
    addOrbit: "Dodaj zip R360",
    replaceOrbit: "Wymień zip",
    removeOrbit: "Usuń widok 360°",
    add: "Dodaj zdjęcia",
    addFirst: "Dodaj pierwsze zdjęcie",
    addFirstBody: "JPG, PNG lub WebP, do 20 MB. Najwyżej dziesięć zdjęć.",
    cover: "Okładka",
    setCover: "Ustaw jako okładkę",
    replace: "Wymień",
    remove: "Usuń",
    up: "Przesuń wyżej",
    down: "Przesuń niżej",
    layout: "Karta na profilu",
    layoutHint: "Jak ta realizacja pokazuje się na Twojej ścianie realizacji. Okładka i miniatury to pierwsze zdjęcia z listy poniżej.",
    layouts: {
      cover: "Okładka",
      "cover-thumbs": "Okładka + 2 miniatury",
      "cover-text": "Okładka + opis"
    },
    needThumbs: "Wymaga co najmniej trzech zdjęć.",
    needDesc: "Wymaga opisu.",
    autorotate: "R360 obraca się sam na profilu",
    delete: "Usuń realizację",
    deleteHint: "Razem ze zdjęciami i paczką R360. Nie da się cofnąć."
  },
  en: {
    back: "All works",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    newWork: "New work",
    untitled: "Untitled",
    name: "Name",
    investor: "Investor",
    developer: "Developer",
    description: "Description",
    descHint: "Up to 300 characters. Shown on the work page and — in the “Cover + description” layout — on the card.",
    pictures: "Photos",
    picturesHint: "Reorder by dragging the thumbnails. The first photo is the card's cover on the profile; the second and third are the thumbnails in the “Cover + 2 thumbnails” layout.",
    dragHint: "Drag to reorder",
    moveLeft: "Move left",
    moveRight: "Move right",
    orbit: "360° view (R360)",
    orbitHint: "An R360 zip. On the profile the view turns in place of the card.",
    addOrbit: "Add R360 zip",
    replaceOrbit: "Replace zip",
    removeOrbit: "Remove 360° view",
    add: "Add photos",
    addFirst: "Add the first photo",
    addFirstBody: "JPG, PNG or WebP, up to 20 MB. Ten photos at most.",
    cover: "Cover",
    setCover: "Set as cover",
    replace: "Replace",
    remove: "Remove",
    up: "Move up",
    down: "Move down",
    layout: "Card on the profile",
    layoutHint: "How this work shows on your wall of work. The cover and thumbnails are the first photos in the list below.",
    layouts: {
      cover: "Cover",
      "cover-thumbs": "Cover + 2 thumbnails",
      "cover-text": "Cover + description"
    },
    needThumbs: "Needs at least three photos.",
    needDesc: "Needs a description.",
    autorotate: "R360 turns by itself on the profile",
    delete: "Delete work",
    deleteHint: "Together with its photos and the R360 zip. Cannot be undone."
  }
};
const SAMPLE_PHOTOS = ["../../assets/hero-facade-plaque.jpeg", "../../assets/landing-placeholder.webp"];
function Seg({
  value,
  options,
  onChange,
  label,
  disabled = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    "aria-label": label,
    style: {
      display: "inline-flex",
      flexWrap: "wrap",
      padding: 3,
      gap: 2,
      borderRadius: "var(--radius-control)",
      background: "var(--surface-sunken)"
    }
  }, Object.entries(options).map(([k, l]) => {
    const off = !!disabled[k];
    return /*#__PURE__*/React.createElement("button", {
      key: k,
      type: "button",
      role: "radio",
      "aria-checked": value === k,
      disabled: off,
      title: off ? disabled[k] : undefined,
      onClick: () => onChange(k),
      style: {
        height: 34,
        padding: "0 var(--sp-4)",
        border: 0,
        borderRadius: 9,
        background: value === k ? "var(--surface-card)" : "transparent",
        color: off ? "var(--text-subtle)" : value === k ? "var(--text-strong)" : "var(--text-muted)",
        font: "var(--type-label)",
        cursor: off ? "not-allowed" : "pointer",
        boxShadow: value === k ? "var(--shadow-sm)" : "none",
        opacity: off ? 0.6 : 1
      }
    }, l);
  }));
}
function Toggle({
  checked,
  onChange,
  label
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "switch",
    "aria-checked": checked,
    onClick: () => onChange(!checked),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      border: 0,
      background: "transparent",
      padding: 0,
      cursor: "pointer",
      font: "var(--type-label)",
      color: "var(--text-body)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 40,
      height: 24,
      borderRadius: 12,
      background: checked ? "var(--n-950)" : "var(--n-300)",
      position: "relative",
      transition: "var(--transition-control)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: checked ? 19 : 3,
      width: 18,
      height: 18,
      borderRadius: 9,
      background: "#fff",
      transition: "left var(--dur-1) var(--ease-standard)"
    }
  })), label);
}
function Section({
  title,
  hint,
  children,
  right
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "var(--sp-4)",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      font: "var(--type-h3)",
      letterSpacing: "var(--ls-heading)",
      color: "var(--text-strong)"
    }
  }, title), right ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto"
    }
  }, right) : null), hint ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-sm)",
      color: "var(--text-muted)",
      maxWidth: "40rem"
    }
  }, hint) : null, children);
}

// The white pill of controls that sits on an editable picture.
function TileActions({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "var(--sp-4)",
      right: "var(--sp-4)",
      display: "flex",
      alignItems: "center",
      gap: 2,
      padding: 4,
      borderRadius: "var(--radius-full)",
      background: "rgba(255,255,255,.94)",
      boxShadow: "var(--shadow-md)"
    }
  }, children);
}
function TileBtn({
  icon,
  label,
  onClick,
  danger
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": label,
    title: label,
    onClick: onClick,
    style: {
      width: 32,
      height: 32,
      border: 0,
      borderRadius: 16,
      background: "transparent",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 16,
    tone: danger ? "danger" : "strong"
  }));
}
function TileTag({
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      alignSelf: "center",
      padding: "0 var(--sp-3)",
      font: "var(--type-eyebrow)",
      textTransform: "uppercase",
      letterSpacing: "var(--ls-caps)",
      color: "var(--text-muted)"
    }
  }, children);
}

// Thumbnail strip: the place to reorder. Drag a thumb (pointer) or focus it
// and press ←/→. The first thumb is the card's cover on the profile.
function Filmstrip({
  photos,
  onReorder,
  onAdd,
  t,
  phone
}) {
  const [drag, setDrag] = React.useState(null);
  const [over, setOver] = React.useState(null);
  const size = phone ? 72 : 96;
  const drop = to => {
    if (drag == null || to == null || drag === to) {
      setDrag(null);
      setOver(null);
      return;
    }
    const l = [...photos];
    const [m] = l.splice(drag, 1);
    l.splice(to, 0, m);
    onReorder(l);
    setDrag(null);
    setOver(null);
  };
  const nudge = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= photos.length) return;
    const l = [...photos];
    [l[i], l[j]] = [l[j], l[i]];
    onReorder(l);
  };
  return /*#__PURE__*/React.createElement("ol", {
    "aria-label": t.dragHint,
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "var(--sp-3)",
      margin: 0,
      padding: 0,
      listStyle: "none"
    }
  }, photos.map((src, i) => /*#__PURE__*/React.createElement("li", {
    key: src + i,
    draggable: true,
    tabIndex: 0,
    "aria-label": (i === 0 ? t.cover + " · " : "") + (i + 1) + "/" + photos.length + " — " + t.dragHint,
    onDragStart: e => {
      setDrag(i);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: e => {
      e.preventDefault();
      if (over !== i) setOver(i);
    },
    onDragLeave: () => setOver(null),
    onDrop: e => {
      e.preventDefault();
      drop(i);
    },
    onDragEnd: () => {
      setDrag(null);
      setOver(null);
    },
    onKeyDown: e => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        nudge(i, -1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nudge(i, 1);
      }
    },
    style: {
      position: "relative",
      width: size * 4 / 3,
      height: size,
      borderRadius: "var(--radius-picture)",
      overflow: "hidden",
      background: "var(--n-150)",
      cursor: "grab",
      opacity: drag === i ? 0.4 : 1,
      outline: over === i && drag !== i ? "2px solid var(--n-950)" : "none",
      outlineOffset: 2,
      boxShadow: i === 0 ? "0 0 0 2px var(--n-950)" : "none",
      transition: "opacity var(--dur-1) var(--ease-standard)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "",
    draggable: false,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      pointerEvents: "none"
    }
  }), i === 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 6,
      bottom: 6,
      padding: "2px 8px",
      borderRadius: "var(--radius-full)",
      background: "rgba(255,255,255,.94)",
      font: "var(--type-eyebrow)",
      textTransform: "uppercase",
      letterSpacing: "var(--ls-caps)",
      color: "var(--text-strong)"
    }
  }, t.cover) : null, phone ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: 4,
      bottom: 4,
      display: "flex",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": t.moveLeft,
    onClick: () => nudge(i, -1),
    disabled: i === 0,
    style: {
      width: 24,
      height: 24,
      border: 0,
      borderRadius: 12,
      background: "rgba(255,255,255,.94)",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: i === 0 ? 0.4 : 1
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-left",
    size: 14,
    tone: "strong"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": t.moveRight,
    onClick: () => nudge(i, 1),
    disabled: i === photos.length - 1,
    style: {
      width: 24,
      height: 24,
      border: 0,
      borderRadius: 12,
      background: "rgba(255,255,255,.94)",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: i === photos.length - 1 ? 0.4 : 1
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 14,
    tone: "strong"
  }))) : null)), /*#__PURE__*/React.createElement("li", {
    style: {
      width: size * 4 / 3,
      height: size
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": t.add,
    title: t.add,
    onClick: onAdd,
    style: {
      width: "100%",
      height: "100%",
      border: "1px dashed var(--border-strong)",
      borderRadius: "var(--radius-picture)",
      background: "var(--surface-card)",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 20,
    tone: "muted"
  }))));
}
function Dropzone({
  title,
  body,
  action,
  onClick,
  compact
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "var(--sp-3)",
      width: "100%",
      minHeight: compact ? 120 : 260,
      padding: "var(--sp-7)",
      border: "1px dashed var(--border-strong)",
      borderRadius: "var(--radius-picture)",
      background: "var(--surface-card)",
      cursor: "pointer",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: compact ? "plus" : "image-plus",
    size: compact ? 20 : 28,
    tone: "subtle"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h4)",
      fontWeight: "var(--fw-semibold)",
      color: "var(--text-strong)"
    }
  }, title), body ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-muted)",
      maxWidth: "26rem"
    }
  }, body) : null, action ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: "var(--sp-2)",
      font: "var(--type-label)",
      color: "var(--text-strong)",
      textDecoration: "underline",
      textUnderlineOffset: 3
    }
  }, action) : null);
}
function WorkPage({
  profile,
  work,
  viewer,
  locale = "pl",
  phone = false,
  editing: editingInit = false,
  onBack,
  onSave,
  onDelete,
  onEnlarge,
  onGo
}) {
  const t = WT[locale];
  const owner = viewer === "owner";
  const isNew = !!work.isNew;
  const [editing, setEditing] = React.useState(owner && (editingInit || isNew));
  const [draft, setDraft] = React.useState(work);
  React.useEffect(() => setDraft(work), [work]);
  // The about panel opens from the bar's logo here too (read-only); its avatar goes back to the profile.
  const [about, setAbout] = React.useState(false);
  const barTop = phone ? 56 : 64;
  const panelAvatar = phone ? 96 : 120;
  const panelAvatarTop = phone ? 24 : 32;
  const w = editing ? draft : work;
  const photos = w.pictures || [];
  const pictures = [w.orbit ? {
    kind: "orbit"
  } : null, ...photos.map(src => ({
    kind: "photo",
    src
  }))].filter(Boolean);
  const setPhotos = list => setDraft({
    ...draft,
    pictures: list,
    cover: list[0] || draft.orbit && draft.orbit.poster || null,
    thumbs: list.slice(1, 3)
  });
  const remove = i => setPhotos(photos.filter((_, k) => k !== i));
  const replace = i => {
    const l = [...photos];
    l[i] = SAMPLE_PHOTOS[(SAMPLE_PHOTOS.indexOf(l[i]) + 1) % SAMPLE_PHOTOS.length];
    setPhotos(l);
  };
  const add = () => setPhotos([...photos, SAMPLE_PHOTOS[photos.length % SAMPLE_PHOTOS.length]]);
  const setOrbit = o => setDraft({
    ...draft,
    orbit: o,
    cover: photos[0] || o && o.poster || null
  });
  const set = k => e => setDraft({
    ...draft,
    [k]: e.target.value
  });
  const layoutDisabled = {
    "cover-thumbs": photos.length < 3 ? t.needThumbs : null,
    "cover-text": !(draft.description || "").trim() ? t.needDesc : null
  };
  const layout = layoutDisabled[draft.layout] ? "cover" : draft.layout;
  const canSave = (draft.name || "").trim() && (photos.length > 0 || draft.orbit);
  const padX = phone ? "var(--sp-4)" : "var(--sp-7)";
  const actions = owner ? editing ? /*#__PURE__*/React.createElement(React.Fragment, null, !isNew ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": t.delete,
    title: t.delete,
    onClick: () => onDelete && onDelete(work),
    style: {
      width: 40,
      height: 40,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-full)",
      border: 0,
      background: "transparent",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 18,
    tone: "danger"
  })) : null, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": t.cancel,
    title: t.cancel,
    onClick: () => {
      if (isNew) {
        onBack && onBack();
        return;
      }
      setDraft(work);
      setEditing(false);
    },
    style: {
      width: 40,
      height: 40,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-full)",
      border: 0,
      background: "transparent",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 20,
    tone: "muted"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": t.save,
    title: t.save,
    disabled: !canSave,
    onClick: () => {
      onSave && onSave({
        ...draft,
        layout,
        isNew: false
      });
      setEditing(false);
    },
    style: {
      width: 40,
      height: 40,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-full)",
      border: 0,
      background: "var(--action-solid)",
      cursor: canSave ? "pointer" : "default",
      opacity: canSave ? 1 : 0.4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 20,
    tone: "var(--action-solid-text)"
  }))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": t.edit,
    title: t.edit,
    onClick: () => setEditing(true),
    style: {
      width: 40,
      height: 40,
      padding: 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-full)",
      border: 0,
      background: "rgba(255,255,255,.94)",
      color: "var(--n-950)",
      cursor: "pointer",
      boxShadow: "var(--shadow-md)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 16,
    tone: "strong"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Menu konta",
    style: {
      width: 40,
      height: 40,
      padding: 0,
      border: 0,
      background: "transparent",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    src: profile.avatarUrl,
    name: profile.displayName,
    size: 32,
    square: profile.avatarShape === "square",
    alt: ""
  }))) : null;
  const rows = [w.investor && [t.investor, w.investor], w.developer && [t.developer, w.developer]].filter(Boolean);
  const field = {
    display: "flex",
    flexDirection: "column",
    gap: "var(--sp-2)"
  };
  const label = {
    font: "var(--type-label)",
    color: "var(--text-body)"
  };
  const area = {
    font: "var(--type-body)",
    padding: "var(--sp-4) var(--sp-5)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-control)",
    resize: "vertical",
    minHeight: 120,
    color: "var(--text-body)",
    fontFamily: "var(--font-sans)",
    width: "100%",
    boxSizing: "border-box"
  };
  const tileAspect = phone ? "4 / 3" : "16 / 9";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-page)",
      minHeight: "100%"
    }
  }, /*#__PURE__*/React.createElement(ProfileBar, {
    profile: profile,
    solid: true,
    aboutOpen: about,
    onToggleAbout: () => setAbout(o => !o),
    phone: phone,
    actions: actions
  }), /*#__PURE__*/React.createElement(AboutPanel, {
    profile: profile,
    open: about,
    onClose: () => setAbout(false),
    onAvatar: onBack,
    phone: phone,
    owner: owner,
    top: barTop,
    start: barTop,
    width: 380,
    headroom: panelAvatarTop + panelAvatar + (phone ? 16 : 24),
    avatarTop: panelAvatarTop,
    avatarSize: panelAvatar,
    locale: locale
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: "var(--measure-works)",
      margin: "0 auto",
      padding: (phone ? 56 + 24 : 64 + 40) + "px " + padX + " " + (phone ? "var(--sp-12)" : "var(--sp-16)"),
      display: "flex",
      flexDirection: "column",
      gap: phone ? "var(--sp-8)" : "var(--sp-10)"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onBack && onBack();
    },
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--sp-2)",
      font: "var(--type-label)",
      color: "var(--text-muted)",
      textDecoration: "none",
      alignSelf: "flex-start"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 16,
    tone: "muted"
  }), t.back), editing ? /*#__PURE__*/React.createElement("header", {
    style: {
      display: "grid",
      gridTemplateColumns: phone ? "1fr" : "minmax(0,1fr) minmax(0,1fr)",
      gap: "var(--sp-5) var(--sp-8)",
      maxWidth: "64rem"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...field,
      gridColumn: phone ? undefined : "1 / -1"
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: label,
    htmlFor: "w-name"
  }, t.name), /*#__PURE__*/React.createElement(Input, {
    id: "w-name",
    size: "lg",
    value: draft.name || "",
    placeholder: t.newWork,
    onChange: set("name")
  })), /*#__PURE__*/React.createElement("div", {
    style: field
  }, /*#__PURE__*/React.createElement("label", {
    style: label,
    htmlFor: "w-inv"
  }, t.investor), /*#__PURE__*/React.createElement(Input, {
    id: "w-inv",
    value: draft.investor || "",
    onChange: set("investor")
  })), /*#__PURE__*/React.createElement("div", {
    style: field
  }, /*#__PURE__*/React.createElement("label", {
    style: label,
    htmlFor: "w-dev"
  }, t.developer), /*#__PURE__*/React.createElement(Input, {
    id: "w-dev",
    value: draft.developer || "",
    onChange: set("developer")
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      ...field,
      gridColumn: phone ? undefined : "1 / -1"
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: label,
    htmlFor: "w-desc"
  }, t.description), /*#__PURE__*/React.createElement("textarea", {
    id: "w-desc",
    value: draft.description || "",
    maxLength: 300,
    onChange: set("description"),
    style: area
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-subtle)"
    }
  }, t.descHint, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-mono)"
    }
  }, (draft.description || "").length, "/300"))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...field,
      gridColumn: phone ? undefined : "1 / -1",
      gap: "var(--sp-3)",
      paddingTop: "var(--sp-2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: label
  }, t.layout), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "var(--sp-4) var(--sp-8)"
    }
  }, /*#__PURE__*/React.createElement(Seg, {
    label: t.layout,
    value: layout,
    options: t.layouts,
    disabled: layoutDisabled,
    onChange: v => setDraft({
      ...draft,
      layout: v
    })
  }), draft.orbit ? /*#__PURE__*/React.createElement(Toggle, {
    label: t.autorotate,
    checked: !!draft.orbit.autorotate,
    onChange: v => setOrbit({
      ...draft.orbit,
      autorotate: v
    })
  }) : null), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-sm)",
      color: "var(--text-subtle)"
    }
  }, layoutDisabled[draft.layout] && draft.layout !== layout ? layoutDisabled[draft.layout] : t.layoutHint))) : /*#__PURE__*/React.createElement("header", {
    style: {
      display: "grid",
      gridTemplateColumns: phone ? "1fr" : "minmax(0,1.4fr) minmax(0,1fr)",
      gap: phone ? "var(--sp-5)" : "var(--sp-12)",
      alignItems: "start",
      maxWidth: "80rem"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      font: phone ? "var(--type-h1)" : "var(--type-display)",
      letterSpacing: "var(--ls-display)",
      color: "var(--text-strong)",
      textWrap: "balance"
    }
  }, w.name || t.untitled), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-4)"
    }
  }, rows.length ? /*#__PURE__*/React.createElement("dl", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "var(--sp-2) var(--sp-7)",
      margin: 0,
      font: "var(--type-sm)"
    }
  }, rows.map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: "flex",
      gap: "var(--sp-2)"
    }
  }, /*#__PURE__*/React.createElement("dt", {
    style: {
      color: "var(--text-subtle)"
    }
  }, k), /*#__PURE__*/React.createElement("dd", {
    style: {
      margin: 0,
      fontWeight: "var(--fw-semibold)",
      color: "var(--text-body)"
    }
  }, v)))) : null, w.description ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-lead)",
      color: "var(--text-muted)"
    }
  }, w.description) : null)), editing ? /*#__PURE__*/React.createElement(Section, {
    title: t.orbit,
    hint: t.orbitHint
  }, draft.orbit ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(OrbitTile, {
    poster: draft.orbit.poster || photos[0],
    name: draft.name || t.untitled,
    cues: draft.orbit.cues || [],
    autorotate: false,
    ring: !phone,
    aspect: tileAspect
  }), /*#__PURE__*/React.createElement(TileActions, null, /*#__PURE__*/React.createElement(TileTag, null, "360\xB0"), /*#__PURE__*/React.createElement(TileBtn, {
    icon: "refresh-cw",
    label: t.replaceOrbit,
    onClick: () => setOrbit({
      ...draft.orbit,
      poster: SAMPLE_PHOTOS[(SAMPLE_PHOTOS.indexOf(draft.orbit.poster) + 1) % SAMPLE_PHOTOS.length]
    })
  }), /*#__PURE__*/React.createElement(TileBtn, {
    icon: "x",
    label: t.removeOrbit,
    onClick: () => setOrbit(null),
    danger: true
  }))) : /*#__PURE__*/React.createElement(Dropzone, {
    compact: true,
    title: t.addOrbit,
    onClick: () => setOrbit({
      poster: photos[0] || SAMPLE_PHOTOS[0],
      autorotate: true,
      cues: []
    })
  })) : null, editing ? /*#__PURE__*/React.createElement(Section, {
    title: t.pictures,
    hint: t.picturesHint
  }, photos.length === 0 ? /*#__PURE__*/React.createElement(Dropzone, {
    title: t.addFirst,
    body: t.addFirstBody,
    action: t.add,
    onClick: add
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: phone ? "var(--sp-5)" : "var(--sp-7)"
    }
  }, /*#__PURE__*/React.createElement(Filmstrip, {
    photos: photos,
    onReorder: setPhotos,
    onAdd: add,
    t: t,
    phone: phone
  }), photos.map((src, i) => /*#__PURE__*/React.createElement("figure", {
    key: src + i,
    style: {
      position: "relative",
      margin: 0,
      borderRadius: "var(--radius-picture)",
      overflow: "hidden",
      background: "var(--n-150)",
      aspectRatio: tileAspect
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: (draft.name || t.untitled) + ", zdjęcie " + (i + 1),
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }), /*#__PURE__*/React.createElement(TileActions, null, i === 0 ? /*#__PURE__*/React.createElement(TileTag, null, t.cover) : /*#__PURE__*/React.createElement(TileTag, null, i + 1), /*#__PURE__*/React.createElement(TileBtn, {
    icon: "refresh-cw",
    label: t.replace,
    onClick: () => replace(i)
  }), /*#__PURE__*/React.createElement(TileBtn, {
    icon: "x",
    label: t.remove,
    onClick: () => remove(i),
    danger: true
  })))))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: phone ? "var(--sp-4)" : "var(--sp-6)"
    }
  }, pictures.map((p, i) => p.kind === "orbit" ? /*#__PURE__*/React.createElement(OrbitTile, {
    key: "orbit",
    poster: w.orbit.poster || w.cover,
    name: w.name,
    cues: w.orbit.cues || [],
    autorotate: w.orbit.autorotate,
    ring: !phone,
    aspect: tileAspect,
    onEnlarge: onEnlarge ? () => onEnlarge(w, 0) : undefined
  }) : /*#__PURE__*/React.createElement("figure", {
    key: p.src + i,
    style: {
      position: "relative",
      margin: 0,
      borderRadius: "var(--radius-picture)",
      overflow: "hidden",
      background: "var(--n-150)",
      aspectRatio: tileAspect
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: p.src,
    alt: w.name + ", zdjęcie " + (i + (w.orbit ? 0 : 1)),
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      cursor: onEnlarge ? "zoom-in" : "default"
    },
    onClick: onEnlarge ? () => onEnlarge(w, i) : undefined
  }))))), /*#__PURE__*/React.createElement(Footer, {
    note: "Warszawa \xB7 architektow3d.pl",
    links: [{
      label: "Regulamin"
    }, {
      label: "Prywatność"
    }, {
      label: "Kontakt"
    }],
    locale: locale
  }));
}
function Lightbox({
  work,
  index,
  onClose
}) {
  const pics = [work.orbit ? {
    kind: "orbit"
  } : null, ...(work.pictures || []).map(src => ({
    kind: "photo",
    src
  }))].filter(Boolean);
  const [i, setI] = React.useState(index);
  const p = pics[i];
  React.useEffect(() => {
    const k = e => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI(x => (x + 1) % pics.length);
      if (e.key === "ArrowLeft") setI(x => (x + pics.length - 1) % pics.length);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [pics.length, onClose]);
  const nav = d => setI(x => (x + d + pics.length) % pics.length);
  const btn = {
    width: 44,
    height: 44,
    borderRadius: 22,
    border: 0,
    background: "rgba(255,255,255,.12)",
    color: "#fff",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  };
  return /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": work.name,
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 100,
      background: "rgba(12,17,22,.96)",
      display: "grid",
      gridTemplateRows: "auto 1fr",
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-4)",
      padding: "var(--sp-4) var(--sp-6)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)"
    }
  }, work.name), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-mono)",
      color: "rgba(255,255,255,.6)"
    }
  }, i + 1, " / ", pics.length), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Zamknij",
    onClick: onClose,
    style: {
      ...btn,
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 20,
    tone: "onPhoto"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "grid",
      placeItems: "center",
      padding: "0 var(--sp-16) var(--sp-8)",
      minHeight: 0
    }
  }, p.kind === "orbit" ? /*#__PURE__*/React.createElement(OrbitTile, {
    poster: work.orbit.poster || work.cover,
    name: work.name,
    cues: work.orbit.cues || [],
    autorotate: false,
    ring: true,
    aspect: "16 / 9",
    style: {
      width: "min(100%, 1400px)"
    },
    radius: "var(--radius-picture)"
  }) : /*#__PURE__*/React.createElement("img", {
    src: p.src,
    alt: work.name,
    style: {
      maxWidth: "100%",
      maxHeight: "100%",
      borderRadius: "var(--radius-picture)",
      objectFit: "contain"
    }
  }), pics.length > 1 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Poprzednie",
    onClick: () => nav(-1),
    style: {
      ...btn,
      position: "absolute",
      left: "var(--sp-6)",
      top: "50%",
      marginTop: -22
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-left",
    size: 22,
    tone: "onPhoto"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Nast\u0119pne",
    onClick: () => nav(1),
    style: {
      ...btn,
      position: "absolute",
      right: "var(--sp-6)",
      top: "50%",
      marginTop: -22
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 22,
    tone: "onPhoto"
  }))) : null));
}
Object.assign(window, {
  WorkPage,
  Lightbox
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/public-web/WorkPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/public-web/data.js
try { (() => {
// Sample content for the public-web kit: XOSA (xosa.pl) — the owner's own
// studio, four works with real renders. Names, clients and descriptions follow
// the portfolio pages; pictures live in assets/xosa/.
(function () {
  const X = "../../assets/xosa/";
  window.A3D_DATA = {
    profile: {
      displayName: "XOSA Architekci",
      handle: "xosa",
      avatarUrl: X + "xosa-logo.png",
      cover: X + "cover-marina-bw.jpg",
      headline: "Autorska pracownia architektoniczna",
      bio: "Pełna obsługa inwestora: analizy planowanych inwestycji, konsultacje projektowe, koncepcje i projekty.\nDomy, hotele, biura, dworce — od Lisiego Ogona po Gdańsk.",
      places: ["Bydgoszcz", "Kujawsko-pomorskie", "Polska"]
    },
    works: [{
      id: "w1",
      slug: "hnb-bialobrzegi",
      name: "HNB — Hotel i apartamenty Lake View, Białobrzegi",
      investor: "Nordic Development S.A.",
      developer: "",
      description: "Koncepcja zabudowy terenu nad Zalewem Zegrzyńskim. Przy zalewie zespół hotelowo-konferencyjny z prywatną mariną i plażą; w głębi, w lesie, apartamentowce wpisane w istniejące zadrzewienie, każdy z własnym basenem i małym SPA. Elewacje: okładziny kamienne i drewno. Koncepcja 2016, projekt XOSA, GDA, PNB.",
      cover: X + "hnb-apartamenty.jpg",
      thumbs: [X + "hnb-hotel-basen.jpg", X + "hnb-marina.jpg"],
      pictures: [X + "hnb-apartamenty.jpg", X + "hnb-hotel-basen.jpg", X + "hnb-marina.jpg", X + "hnb-wnetrze-1.jpg", X + "hnb-wnetrze-2.jpg", X + "hnb-plan.jpg"],
      orbit: {
        poster: X + "hnb-hotel-basen.jpg",
        autorotate: true,
        cues: ["Marina", "Basen", "Las"]
      },
      layout: "cover-thumbs"
    }, {
      id: "w2",
      slug: "dlo-lisi-ogon",
      name: "DLO — Dom z widokiem na łowisko, Lisi Ogon",
      investor: "Prywatny",
      developer: "",
      description: "Dom jednorodzinny na bazie kontenerów morskich, ukształtowany na skarpie tak, by obserwować szeroki plan łowisk. Część dzienna na dwóch kondygnacjach; salon z widokiem w promieniu 360 stopni. Elewacje z blachy pełnej i perforowanej, na poziomie 0 basen. Koncepcja i projekt 2016.",
      cover: X + "dlo-front.png",
      thumbs: [],
      pictures: [X + "dlo-front.png"],
      orbit: null,
      layout: "cover-text"
    }, {
      id: "w3",
      slug: "mvg-gniezno",
      name: "MVG — Budynek mieszkalny, Gniezno",
      investor: "",
      developer: "",
      description: "Budynek wielorodzinny w centrum Gniezna. Modułowa, biała elewacja z loggiami, tarasy na dachu z widokiem na katedrę.",
      cover: X + "mvg-front.jpg",
      thumbs: [X + "mvg-elewacja.jpg", X + "mvg-taras.jpg"],
      pictures: [X + "mvg-front.jpg", X + "mvg-elewacja.jpg", X + "mvg-taras.jpg", X + "mvg-schematy.jpg"],
      orbit: null,
      layout: "cover"
    }, {
      id: "w4",
      slug: "dpb-bydgoszcz",
      name: "DPB — Dworzec PKP, Bydgoszcz",
      investor: "",
      developer: "",
      description: "Koncepcja dworca kolejowego w Bydgoszczy: szklana bryła nad peronami, przedpole z torowiskiem tramwajowym.",
      cover: X + "dpb-front.jpg",
      thumbs: [X + "dpb-ulica.jpg"],
      pictures: [X + "dpb-front.jpg", X + "dpb-ulica.jpg"],
      orbit: null,
      layout: "cover-thumbs"
    }]
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/public-web/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Divider = __ds_scope.Divider;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Plaque = __ds_scope.Plaque;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.StatusMessage = __ds_scope.StatusMessage;

__ds_ns.FormField = __ds_scope.FormField;

__ds_ns.HandleField = __ds_scope.HandleField;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.PhotoUpload = __ds_scope.PhotoUpload;

__ds_ns.Footer = __ds_scope.Footer;

__ds_ns.LocaleSwitcher = __ds_scope.LocaleSwitcher;

__ds_ns.TextLink = __ds_scope.TextLink;

__ds_ns.TopBar = __ds_scope.TopBar;

__ds_ns.AboutPanel = __ds_scope.AboutPanel;

__ds_ns.OrbitTile = __ds_scope.OrbitTile;

__ds_ns.ProfileBar = __ds_scope.ProfileBar;

__ds_ns.WorkCard = __ds_scope.WorkCard;

})();
