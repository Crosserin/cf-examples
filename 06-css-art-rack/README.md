# 06-css-art-rack

> An illustrated 12U server rack in pure HTML and CSS. A nod to the box under my desk.

## What it does

A 12U rack with a router, a switch (with lit port indicators), a Proxmox server, a Synology NAS (with disk bays and activity lights), a UPS, and a PDU. Everything is rendered with `<div>`, gradients, `border-radius`, and `@keyframes`. No images, no SVG, no JavaScript.

The fan on the PDU actually spins. The disk bays blink on a stagger. One LED on the PDU is permanently red because something is always failing somewhere in a homelab — you know this is true.

## Cloudflare features used

- [x] Pages (static hosting)

Nothing fancy. This one is about showing CSS craft, not edge features.

## Files

```
06-css-art-rack/
├── README.md
└── index.html    ← everything, including the rack
```

## What's actually interesting in the code

- **Disk bays** are a CSS Grid of 8 `<div>`s with a pseudo-element LED at the bottom. An `.active` class adds a fast blink animation.
- **The spinning fan** is a `conic-gradient` inside a circle, rotated with `@keyframes spin`.
- **Port indicators** on the switch are `<span>`s with `::after` for the light — small enough that the light feels authentic.
- **LED glow** is just `box-shadow: 0 0 4px currentColor` with the LED class setting the color. Cheap trick, big effect.
- **The rack itself** uses layered linear-gradients plus inset box-shadows to get the metal look.

## Gotchas

- Keyframe animations on many elements can cost more paint than you'd think. If I were adding 40+ of these, I'd use `will-change: opacity` selectively and debounce the blink animations.
- The vertical "synology · sierra" label uses `writing-mode: vertical-rl` which is well-supported but old Safari had alignment quirks — verify before shipping.

## What I'd do differently at scale

If this were a real dashboard (see example 29), I'd drive the LED states from actual data via a `data-status="ok|warn|fail"` attribute and a CSS attribute selector. That way the Worker pushes a status JSON, the DOM updates one attribute per unit, and CSS handles the visuals. No JS re-rendering needed.
