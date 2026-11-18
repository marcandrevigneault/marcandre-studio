# Video QR

Standalone Vite + TypeScript encoder/decoder with Capacitor Android and iOS projects. Videos are compressed on the device using the bundled single-thread FFmpeg WASM engine. No video upload, CDN, remote native app URL, or backend is required. The browser must initially fetch the app and approximately 31 MB WASM file; web offline support is not implemented or claimed.

## Development and integration

Use Node 22.12+ (Node 24 LTS recommended) and npm. From this directory:

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run preview
npm run native:sync
npm run native:android
npm run native:ios
```

`postinstall`, `dev`, and `build` copy `@ffmpeg/core/dist/esm/ffmpeg-core.{js,wasm}` into `public/ffmpeg/`. Those generated assets and `dist/` are ignored by Git. Vite bundles the wrapper worker, and uses `base: './'`. Deploy the **entire** `dist` directory, including `ffmpeg`, `assets`, examples and licenses. Redirect the deployment URL to a trailing slash or serve its `index.html` explicitly so relative URLs resolve correctly. The root site build owns staging into `public/tools/video-qr`.

All runtime FFmpeg URLs resolve relative to the app document. The single-thread core does not need SharedArrayBuffer, COOP or COEP. WASM must be served as `application/wasm`; workers and scripts must be allowed by the host CSP. Camera use on the web requires HTTPS or localhost. Plain `file://` is unsupported.

## Core API and limits

- `packVideo(data: Uint8Array): Promise<Uint8Array[]>`
- `new PacketCollector().add(packet): Promise<{ received, total, complete? }>`; `reset(): void`
- `compressVideo(file, { start, duration, width, fps, audioKbps }, onProgress?): Promise<Uint8Array>`
- `playableVideo(data): Promise<Blob>` returns WebM when supported, otherwise locally transcodes to H.264/AAC MP4.
- `cancelMedia(): void` terminates current WASM work. Starting a new media operation supersedes the previous one; callers should suppress obsolete UI results too.

Maximum source file: 100 MiB. Maximum trim: 10 seconds. Maximum assembled video: 8 MiB. Compression accepts even widths 16–640 pixels, 1–30 fps and 0–128 kbps mono audio (0 disables audio). WASM execution has a 120-second timeout. Each job owns a worker and virtual filesystem, discarded on success, cancellation or failure, including nonzero FFmpeg exits. Unsupported/malformed media rejects rather than returning old output.

The tests use the real packet codec and SHA-256. Media lifecycle tests replace the external worker engine because Node cannot run its browser worker; they do not replace validation, cancellation or cleanup. Browser encoding/playback is a separate integration check.

## Binary format v1

QR data is a **byte segment**, never a JavaScript string or Base64. Use QR error correction L (version 40 capacity: 2,953 bytes). Lower QR versions can be chosen automatically for short packets. A 48-byte header leaves **2,905 bytes** of video per packet. The supplied 2,310-byte WebM fits in one 2,358-byte packet. This format does not claim compatibility with earlier WebP/Opus experiments.

| Offset | Bytes | Meaning |
| --- | --- | --- |
| 0 | 3 | ASCII `VQR` |
| 3 | 1 | Version `1` |
| 4 | 1 | Flags `0` (all other values rejected) |
| 5 | 1 | Media type `1` (WebM) |
| 6 | 2 | Zero-based packet index |
| 8 | 2 | Packet count |
| 10 | 4 | Complete video byte length |
| 14 | 2 | This packet's payload byte length |
| 16 | 32 | SHA-256 of the complete video bytes |
| 48 | 1–2905 | Video bytes |

Integers are unsigned big-endian. Count must be `ceil(totalBytes / 2905)`, every nonfinal packet must be full, and the final packet must have exactly the remaining length. Empty, oversized, truncated, trailing-byte, unknown-version, unknown-media-type, bad-index and inconsistent-count packets reject before collection. Digest and total length identify a sequence; mixed sequences and conflicting duplicates reject without modifying accepted data. Identical duplicates do not advance progress. Packets may arrive in any order. Completed output is returned only after verifying the full digest. An integrity failure resets the collection; manual reset invalidates queued/in-flight work. Input and returned buffers are copied to prevent mutation races. SHA-256 detects corruption; it does not authenticate the sender.

## Native projects

`capacitor.config.ts` sets `webDir: 'dist'`, Android `https://localhost`, and iOS `capacitor://localhost`. There is deliberately no `server.url`; `native:sync` copies all app/WASM assets into both projects. Native bundles can therefore load their assets without a network connection. Offline behavior, camera capture and share sheets on physical devices still need device testing.

Android declares CAMERA and makes camera hardware optional. iOS includes `NSCameraUsageDescription`. Camera capture requests video only, so microphone permission is not requested. Native exports use the Filesystem plugin's cache directory and the Share plugin. No external-storage permission is needed. The iOS app includes a FileTimestamp privacy reason (`C617.1`) for Filesystem.

### iOS

Xcode with an iOS SDK and Swift Package Manager are required; CocoaPods is not used. Open `ios/App/App.xcodeproj`. Dependencies are pinned in its `Package.resolved`. Unsigned simulator build:

```sh
npm run native:sync
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/video-qr-ios-build CODE_SIGNING_ALLOWED=NO
```

This command passed with Xcode 27.0, Capacitor 8.6.2, Filesystem 8.1.5 and Share 8.0.3. The generated app is `/tmp/video-qr-ios-build/Build/Products/Debug-iphonesimulator/App.app`. This proves simulator compilation, not physical-device behavior or distribution signing. Device builds need a development team/provisioning; App Store distribution additionally needs signing, final app icons, store metadata, and release review.

### Android

Use **JDK 21**, Android SDK Platform 36 and Build Tools 36.0.0, with accepted SDK licenses. The checked-in wrapper is Gradle 8.14.3. JDK 26 is incompatible with that Gradle release; JDK 17 cannot compile Capacitor's Java 21 sources. Configure your own paths:

```sh
export JAVA_HOME=/path/to/jdk-21/Contents/Home
export ANDROID_HOME=/path/to/android-sdk
npm run native:sync
cd android
./gradlew --no-daemon assembleDebug
```

The debug build passed using Temurin JDK 21 and API 36. APK: `android/app/build/outputs/apk/debug/app-debug.apk` (approximately 15 MB). A production APK/AAB requires your own signing key; generated debug signing is for testing only. This machine's SDK was found at `/opt/homebrew/share/android-commandlinetools` (including API 36), rather than the usual `~/Library/Android/sdk`. A temporary JDK 21 was downloaded under `/tmp/video-qr-jdk21` for verification; it is not a repository dependency.

## Third-party distribution

See [THIRD-PARTY-NOTICES.txt](public/THIRD-PARTY-NOTICES.txt) and [bundled license texts](public/licenses/). The npm package declares **@ffmpeg/core 0.12.10 GPL-2.0-or-later**; its MIT JavaScript wrapper does not change that. The prebuilt core includes x264 and other codecs. Upstream source and build recipes, FFmpeg source, and codec licensing links are included in the notices. Retain notices and fulfill the applicable source-distribution obligations when redistributing the core; these links alone are not a complete legal compliance determination.

At implementation time, `npm audit --omit=dev` reported zero vulnerabilities. Full audit reported five high findings through the development-only `picomatch` dependency chain (Vite/Vitest); no patched current version was available, and no forced major downgrade was applied.
