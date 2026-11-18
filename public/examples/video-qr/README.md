# Example provenance

La Bête lumineuse (Pierre Perrault, 1982). Source used in the earlier experiment:
https://www.youtube.com/watch?v=7Co_VgBgI7g

Retrieved context: chats “Pixel Count Answer” and “Compress YouTube video to 96×59”, November 17, 2026.

- film-preview.mp4: eight seconds beginning at 10:00 of the earlier full-film WebM (18,444,402 bytes, 96×59, 8 FPS, 8 kbps mono Opus). Re-encoded as H.264/AAC with one padded bottom row for browser playback. Preview file size is not the original film size.
- gif-preview.gif: four seconds beginning at 10:00 of the earlier 40×25, 8 FPS, sixteen-color silent GIF. Preview loops; the earlier full film plays once.
- poster.png: a frame from film-preview.mp4 enlarged with nearest-neighbor interpolation.
- qr-preview.mp4: browser-friendly rendering of the NEW two-second 24×16, 2 FPS, VP9/Opus sample at apps/video-qr/public/examples/demo.webm, derived from the earlier WebM beginning at 10:00. This is an additional lossy encode.
- demo-qr.png: generated from that new WebM using this app's versioned packet format. It is not one of the original chat's QR codes. Verify decoded bytes match the WebM before regenerating.

The earlier chat reports single-QR results of 2,915 bytes (3 seconds, 40×29) and 2,775 bytes (24×17, audio priority). Original binary bundles were not available in this workspace; these are historical reported results, not interoperability tests.

Only short demonstration excerpts are included here; full-film assets remain outside this repository. No ownership of the source film is asserted.
