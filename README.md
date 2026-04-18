# EZASCII Figma Plugins

Two Figma Community plugins for turning text and images into ASCII text art, by the team at **[ezascii.com](https://ezascii.com)**.

## Plugins

### 🅰️ Text to ASCII — FIGlet banners in Figma

Type a word, pick from 20 classic FIGlet fonts, drop it into your file as a text layer.

**Install:** _(Figma Community link — added after publishing)_

### 🖼️ Image to ASCII — Photo to text art

Select an image or frame in Figma, convert it to ASCII characters or a rendered image.

**Install:** _(Figma Community link — added after publishing)_

---

## Want more?

The plugins ship a curated, minimal feature set. The full tooling lives at **[ezascii.com](https://ezascii.com)**:

- 300+ FIGlet fonts
- 9 character sets
- SVG, PNG, JPEG, and TXT export
- Contrast, gamma, brightness, sharpness, edge-detection tuning
- Image, video, and webcam conversion

## Development

```bash
pnpm install
pnpm dev         # watches both plugins
```

Load `packages/text-to-ascii/dist/manifest.json` or `packages/image-to-ascii/dist/manifest.json` in Figma → Plugins → Development → Import plugin from manifest.

## License

MIT — see [LICENSE](./LICENSE).
