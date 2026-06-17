# marcandre.studio

A personal, artistic website for photography, scientific writing, travel, and poetry —
built with [Astro](https://astro.build). Content-first, ships almost no JavaScript, and
fast by default.

## The big idea: each gallery is its own world

A photo gallery isn't just a grid — it's a *place*. Every gallery declares its own colour
palette, typography, motion, atmosphere, and an optional ambient music track right in its
front-matter. Open one gallery and the whole page becomes dark and grainy with a serif
voice; open another and it's bright, cool, and clean. Visitors feel the mood before they
read a word.

## Running it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site -> dist/
npm run preview  # preview the production build
```

## Project layout

```
src/
  content/
    galleries/      # one .md file per photo gallery
    articles/       # one .mdx file per science/blog post
  layouts/          # BaseLayout, GalleryLayout, ArticleLayout
  components/        # Nav, Footer, PhotoGrid (+ lightbox), AmbientAudio
  pages/            # routes (index, photography, science, about)
  styles/global.css # the whole design system lives here (CSS variables)
  content.config.ts # the schema for galleries + articles
public/
  photos/           # your images (currently placeholder SVGs)
  audio/            # ambient music tracks (optional)
tools/
  gen-placeholders.mjs  # regenerates the placeholder images
```

## Adding a photo gallery

Create `src/content/galleries/my-trip.md`:

```markdown
---
title: A Morning in the Alps
place: Chamonix, France
date: 2026-06-01
featured: false           # true = show on the homepage hero
summary: One sentence that sets the mood.
cover: /photos/alps/cover.jpg
theme:
  paper: "#0e1320"        # background   (any CSS colour)
  ink:   "#eef2f8"        # text
  muted: "#8aa"           # captions
  accent: "#79b8ff"       # links / the sound button
  font:  serif            # serif | sans | mono
  motion: drift           # none | calm | drift | reveal
  atmosphere: vignette     # none | grain | vignette
audio:                    # optional — delete this block for silence
  src: /audio/alps-wind.mp3
  title: Wind on the glacier
images:
  - src: /photos/alps/01.jpg
    alt: Describe the photo (for accessibility)
    caption: Optional caption shown under the image.
    span: wide            # single | wide  (wide spans the full row)
  - src: /photos/alps/02.jpg
    alt: ...
---

<p class="intro">An optional short paragraph that opens the gallery.</p>
```

Then drop your photos in `public/photos/alps/` and (optionally) an mp3 in
`public/audio/`. That's it — the gallery, its theme, and its page are generated
automatically.

## Adding a science article

Create `src/content/articles/my-post.mdx`:

```markdown
---
title: My Post
subtitle: Optional one-liner.
date: 2026-06-10
summary: Shown in the article list and as the page description.
topics: [hydroponics, optics]
readingTime: 7 min
cover: /photos/science/my-post.jpg   # optional
---

Write in Markdown. Inline math like $a^2 + b^2 = c^2$ and display math:

$$
\int_0^\infty e^{-x}\,dx = 1
$$

Code blocks are highlighted automatically. Because it's **MDX**, you can also
import and drop in interactive components when you want them.
```

Math is rendered with KaTeX; code with Shiki (themed to match the page).

## Drafts

Set `draft: true` in front-matter to hide an item from the production build. Drafts are
still visible while running `npm run dev`.

## Real photos & image optimisation

The placeholders are SVGs. When you add real JPGs/PNGs, the current setup serves them
as-is with lazy loading. For automatic resizing / modern formats, we can later switch
the gallery images to Astro's `<Image>` component (`astro:assets`) — a small change once
you have real files to work with.

## Deploying

The build output in `dist/` is a plain static site, so it works on Vercel, Netlify,
GitHub Pages, Cloudflare Pages, or any static host. Before deploying, set your real
domain in `astro.config.mjs` (`site:`).

## Admin

`/admin` is the private gallery builder — password-protected and unlinked from the public
site. It lets you create, edit, preview, and publish photo galleries through a browser UI.
For one-time setup instructions (GitHub, Vercel, Cloudinary, env vars), see
[docs/admin-setup.md](docs/admin-setup.md).

## Next sections

Video, Poetry, and Travel are scaffolded as "coming soon" on the homepage. Each can reuse
the same content-collection pattern (a new collection in `content.config.ts` + a layout) —
e.g. Poetry as quiet typographic pages, Travel as galleries with maps.
