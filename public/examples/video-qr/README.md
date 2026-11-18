# Example provenance

`la-bete-lumineuse-3662-7.jpg`: header still extracted at 3662.7 seconds
(01:01:02.7) from the existing 96×59 full-film WebM, enlarged using nearest
neighbor interpolation to retain its pixel texture. It contains no audio.

La Bête lumineuse (Pierre Perrault, 1982). Source used in the earlier experiment:
https://www.youtube.com/watch?v=7Co_VgBgI7g

Retrieved context: chats “Pixel Count Answer” and “Compress YouTube video to 96×59”, November 17, 2026.

- la-bete-lumineuse.webm: compressed full-film source for the local interactive generator, added with user authorization. Copied from the earlier experiment output (not a new encode): 18,444,402 bytes. ffprobe verifies VP9 video at 96×59 and 8 FPS, mono Opus audio, and a container duration of 7,649.65 seconds. The generator uses this compressed source; generated excerpts undergo further compression.
- film-preview.mp4: eight seconds beginning at 10:00 of the earlier full-film WebM (18,444,402 bytes, 96×59, 8 FPS, 8 kbps mono Opus). Re-encoded as H.264/AAC with one padded bottom row for browser playback. Preview file size is not the original film size.
- gif-preview.gif: four seconds beginning at 10:00 of the earlier 40×25, 8 FPS, sixteen-color silent GIF. Preview loops; the earlier full film plays once.
- elle-fait-pas-dombre-qr.png: original QR recovered from ~/Downloads/qr_v40_audio_max.png on November 17, 2026, copied byte-for-byte. A 1480×1480 PNG containing a version-40 QR. jsQR recovers a 2,891-byte QMV1 payload with six 20×14 WebP frames and a 2,301-byte mono Opus/Ogg stream. This legacy format is rejected by the current app decoder with “Unsupported or malformed Video QR header.”
- elle-fait-pas-dombre.mp4: matching playback file recovered from ~/Downloads/decoded_audio_max.mp4, copied byte-for-byte (37,864 bytes). ffprobe verifies three seconds, six H.264 frames at 320×224 and 2 FPS, and mono AAC audio. Comparing the six extracted QR frames enlarged with nearest-neighbor interpolation against the MP4 gives a mean absolute RGB difference of 1.184 on a 0–255 scale. Decoded audio has matching sample counts and normalized correlation 0.997228. These measurements strongly support their relationship; the MP4 is a lossy playback rendering, not the literal bytes stored in the QR. The user identified this example as « Elle fait pas d’ombre ».
- poster.png: a frame from film-preview.mp4 enlarged with nearest-neighbor interpolation.
- qr-preview.mp4: browser-friendly rendering of the NEW two-second 24×16, 2 FPS, VP9/Opus sample at apps/video-qr/public/examples/demo.webm, derived from the earlier WebM beginning at 10:00. This is an additional lossy encode.
- demo-qr.png: generated from that new WebM using this app's versioned packet format. It is not one of the original chat's QR codes. Verify decoded bytes match the WebM before regenerating.

The earlier chat reports single-QR results of 2,915 bytes (3 seconds, 40×29) and 2,775 bytes (24×17, audio priority). These remain historical reported measurements, distinct from the recovered 2,891-byte QMV1 example above; they are not verified sizes of that recovered QR or interoperability tests.

This directory includes the compressed full-film source for the local generator as well as short playback examples and QR assets. No ownership of the source film is asserted.

## Current-encoder version of « Elle fait même pas d’ombre »

`elle-fait-meme-pas-dombre-vqr.webm` was generated using the browser's film
encoder from the full-film source at 1736.4 seconds (28:56.4), for 3 seconds,
16×10 pixels, 1 FPS, 4 kbps mono Opus. The passage was located by normalized
cross-correlation with the recovered clip's audio (best match 1736.3805 seconds,
score 0.4235; next separate match 0.1769) and checked against its picture.
Low-rate audio uses 8 kHz, 60 ms Opus packets, and constant bitrate to retain the
whole phrase within the QR budget. The WebM is 2,903 bytes; its VQR packet is
2,951 bytes, below the version-40-L byte capacity. The PNG was scanned and decoded
with the current PacketCollector, recovering the exact WebM bytes.

The matching `-vqr.mp4` is a browser-friendly H.264/AAC playback rendering of
that newly encoded WebM, enlarged with nearest-neighbor interpolation. The old
QMV1 PNG and old MP4 are retained as source/reference assets, not the displayed
sample 02. The current sample preserves all three seconds and audio.
