# Video QR

Approved direction: a concise Projects page showing the La Bête lumineuse experiments, and a working encoder/decoder on web, Android and iPhone. Retain Art as a separate site section.

Use a standalone Vite/TypeScript app packaged with Capacitor for both mobile platforms. Local FFmpeg WASM compresses short uploaded clips into WebM, then binary QR packets carry the actual bytes. Scan/import packets, verify integrity and reconstruct the clip. Include a single-code mode that refuses oversize output and a sequence mode. A browser-only PWA would not supply native projects; separate Swift/Kotlin implementations would duplicate the codec and UI.

The prior chat reports custom WebP/Opus QR clips (2915 and 2775 bytes). Their binary format and bundle are unavailable: do not claim compatibility. New format is explicitly versioned. The locally available full-film WebM (18,444,402 bytes) and GIF are genuine earlier outputs; create short illustrative previews from these, label newly generated QR demonstrations separately. Do not publish full films as part of deployment.

All encoding stays on device. Camera requires permission and a secure origin. Limit input size/duration and assembled payload size, reject malformed/mixed/corrupted sequences, release camera and URLs. Bundle codec assets for native offline use. Web offline support must be tested before claiming it. Store distribution/signing and physical-device camera verification are separate from source/build completion.
