/* =============================================================
   GROUNDUP — SITE CONFIG
   The one file you edit when re-skinning this template for a
   new contractor client. Brand text lives here; brand colors
   live in the :root block at the top of css/styles.css.
   ============================================================= */
window.SITE_CONFIG = {

  /* ---- Brand ---- */
  brandName: "Meridian Builders",
  phone: "(555) 555-0134",
  email: "hello@meridianbuilders.example",
  address: "418 Granite Way, Suite 2, Boulder CO",

  /* ---- The scroll-build hero ----
     mode:
       "frames"     — scrub a pre-rendered frame sequence (RECOMMENDED —
                      this is the Higgsfield workflow, see README.md).
                      Buttery scrubbing in both directions, zero seek lag.
       "video"      — scrub an MP4 directly. Quickest to set up, but
                      seeking is only smooth if the file is re-encoded
                      all-keyframes (README has the one-line command).
       "procedural" — the built-in code-drawn blueprint-to-house build.
                      Zero assets needed; what you're seeing if you just
                      opened the template.
     The engine automatically falls back to "procedural" if frames or
     video fail to load, so the hero can never break. */
  buildAnimation: {
    mode: "frames",

    /* frames mode — numbered pattern…
       (or supply an explicit array instead: frames: { list: [url, url, …] }) */
    frames: {
      path: "assets/build-sequence/",   // folder with the exported frames
      prefix: "frame_",                 // frame_0001.jpg, frame_0002.jpg …
      pad: 4,                           // digits in the frame number
      ext: "jpg",
      first: 1,
      count: 120                        // total number of frames
    },

    /* video mode */
    video: {
      src: "assets/build-sequence/build.mp4"
    },

    /* how many viewport-heights of scrolling the build lasts (bigger =
       slower, more cinematic). Applied to the hero section at startup. */
    scrollLength: 5.6
  }
};
