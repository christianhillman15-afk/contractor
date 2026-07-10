# GroundUp — Scroll-Build Contractor Template

A premium one-page website template for contractors and design-build firms.
Its signature move: **as the visitor scrolls, the house builds itself** — from
survey stakes to foundation to framing to a finished home with the lights
coming on — the same effect as high-end property sites.

Everything is plain HTML/CSS/JS. No build step, no framework, no dependencies.
Open `index.html` and it works.

---

## The scroll-build hero — three modes

Set the mode in `js/config.js` → `buildAnimation.mode`:

| Mode | What it does | When to use |
|------|--------------|-------------|
| `"frames"` *(default)* | Scrubs a pre-rendered photoreal frame sequence on a canvas. Buttery in both directions, zero seek lag. | The money look. Generate the footage with Higgsfield (below). |
| `"video"` | Scrubs an MP4's `currentTime` directly. | Fastest setup — one file. Needs the all-keyframe re-encode below to scrub smoothly. |
| `"procedural"` | A code-drawn blueprint-to-house build (SVG). | Zero assets. Also the automatic fallback if frames/video ever fail to load, so the hero can never break. |

The engine (`js/scroll-engine.js`) pins the stage for ~5.6 viewport-heights of
scroll, maps scroll → progress 0..1 with inertial smoothing, and drives the
active renderer plus the copy chapters, phase tracker, and scroll cue.
`prefers-reduced-motion` users get the finished house with no scrub.

## Generating the build footage with Higgsfield

This template ships with a sequence generated on [Higgsfield](https://higgsfield.ai)
(Kling 3.0 Turbo, 15 s, 1080p, 16:9). To produce one for a new client:

**Quick way (one text-to-video shot):**

> Static locked-off tripod wide shot, fixed camera, photorealistic construction
> time-lapse of a `[style]` home being built on an empty lot at golden hour.
> Sequence in order: bare graded dirt lot with survey stakes, excavation,
> concrete foundation slab, timber stud framing rises, roof trusses, `[roof]`
> roof laid, `[siding]` installed, windows set, front door hung, finishing with
> landscaped lawn and warm interior lights glowing at dusk. No people, no text,
> no watermarks, zero camera movement, locked composition, smooth continuous
> transformation.

**Pro way (multi-segment):** generate keyframe *images* of each
construction phase (same composition), then chain **image-to-video** segments
using each phase image as `start_image` and the next as `end_image`
(Kling 3.0 supports start+end frames). Concatenate the clips. You get a much
longer master with cleanly separated phases and total control over the arc.

**Tips that matter:** always say *locked-off / fixed camera / zero camera
movement*; generate 16:9; no people (crowds shimmer when scrubbed); end at
dusk with interior lights on — the finale sells the effect.

## Converting the video for the site

Requires [ffmpeg](https://ffmpeg.org). From the project root, with your
Higgsfield export saved as `master.mp4`:

**Frames mode (recommended):**

```bash
# ~8 fps of stills, 1600px wide — 120 frames from a 15 s master
ffmpeg -i master.mp4 -vf "fps=8,scale=1600:-2" -q:v 4 \
       -start_number 1 assets/build-sequence/frame_%04d.jpg
```

Then in `js/config.js` set `frames.count` to the number of files created.
More frames = smoother scrub but a bigger download; 100–150 is the sweet spot.
(Tighter budget? Use `-q:v 5` and `scale=1280:-2` — roughly half the bytes.)

**Video mode:**

```bash
# strip audio, make every frame a keyframe so seeking is instant
ffmpeg -i master.mp4 -an -g 1 -crf 21 -movflags +faststart \
       assets/build-sequence/build.mp4
```

## Re-skinning for a new client (the 30-minute checklist)

1. **`js/config.js`** — brand name, phone, email, address, animation mode.
2. **`css/styles.css`** — the `:root` block at the top holds every color.
   Swap `--accent` and you've re-branded 90% of the site.
3. **`index.html`** — services, process copy, project cards, testimonials,
   trust-bar claims, license number in the footer. All plain HTML.
4. **Footage** — generate the client's build sequence (above), or ship
   `mode: "procedural"` on day one and add footage later.
5. **Fonts** — Google Fonts `Sora` + `Inter`; swap the `<link>` in `index.html`
   and `--font-display` / `--font-body` if the brand needs something else.

## Contact form

The form is [Netlify Forms](https://docs.netlify.com/forms/setup/)-ready
(`data-netlify="true"` + honeypot). Deploy to Netlify and submissions just
work. On other hosts, point the form `action` at your handler
(Formspree, Basin, etc.).

## File map

```
index.html               all markup & copy
css/styles.css           theme (:root block) + all styles
js/config.js             ← the file you edit per client
js/scroll-engine.js      scroll-build engine + 3 renderers
js/main.js               nav, reveals, counters, testimonials
assets/build-sequence/   frame_0001.jpg … (the scrub footage)
dist/groundup-demo.html  single-file demo build (all assets inlined)
```

Frames can also be listed explicitly (custom filenames / CDN URLs) via
`frames: { list: ["…", "…"] }` in `js/config.js`, and the hero's scroll
length is tuned with `buildAnimation.scrollLength` (viewport-heights).

## Browser support

Evergreen Chrome / Edge / Firefox / Safari (incl. iOS). Degrades gracefully:
no JS → normal scrolling page; assets missing → procedural build; reduced
motion → finished house, no scrub.
