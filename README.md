# Artha: NEPSE Portfolio Tracker

Android-first portfolio app for consolidating multiple family MeroShare/NEPSE accounts into a single unified view.

**Package:** `com.artha.app`

---

## Prerequisites

- Node.js + npm
- Java 17 JDK at:

```txt
/Users/kewal.agrawal/.jdks/jdk-17.0.19+10/Contents/Home
```

- Android SDK platform-tools (adb) at:

```txt
/Users/kewal.agrawal/Library/Android/sdk/platform-tools/
```

---

## 1. Quick UI Testing With Expo Go

Fastest way to preview UI changes — no build required.

1. Install **Expo Go** from the Google Play Store.
2. Make sure your phone and Mac are on the same Wi-Fi network.
3. In this folder, run:

```sh
npm run start:phone
```

4. Get your Mac's current Wi-Fi IP:

```sh
ipconfig getifaddr en0
```

5. Open Expo Go on your phone → tap **Enter URL manually** → enter:

```txt
exp://YOUR_MAC_WIFI_IP:8081
```

> **Note:** Expo Go is only useful for quick UI checks. Native features (WebView, file system, MeroShare sync) require the custom dev build below.

---

## 2. Run The Custom Android Development Build

Use this for testing all native Android behaviour — WebView, MeroShare sync, file downloads, NEPSE live prices.

### First time setup

1. Enable Developer Options on your Android phone:

```txt
Settings → About phone → tap Build number 7 times
```

2. Enable USB debugging:

```txt
Settings → Developer options → USB debugging
```

3. Connect phone to Mac via USB and approve the **Allow USB debugging** prompt.

4. Confirm the phone is visible:

```sh
/Users/kewal.agrawal/Library/Android/sdk/platform-tools/adb devices
```

The device should show as `device`, not `unauthorized`.

### Build and run

```sh
npm run android:device
```

Then start Metro:

```sh
npm run start:dev-client
```

After this, use the installed **Artha** debug app on the phone instead of Expo Go.

### Wireless debugging (no USB)

If the phone was previously connected via USB on the same Wi-Fi network:

```sh
/Users/kewal.agrawal/Library/Android/sdk/platform-tools/adb tcpip 5555
/Users/kewal.agrawal/Library/Android/sdk/platform-tools/adb connect PHONE_IP:5555
```

Get phone IP from: Settings → About phone → Status → IP address.

---

## 3. Build Release APK

The release APK is signed, optimised, and ready to install directly on any Android phone.

### Setup

Export the Java 17 JDK before running any Gradle commands:

```sh
export JAVA_HOME=/Users/kewal.agrawal/.jdks/jdk-17.0.19+10/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH
```

### Build

```sh
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/artha.apk` (~26 MB)

### Share APK over Wi-Fi

Start a local HTTP server to share with phones on the same network:

```sh
python3 -m http.server 9876 --directory android/app/build/outputs/apk/release
```

Get your Mac's IP:

```sh
ipconfig getifaddr en0
```

Then open this URL on the phone's browser to download:

```txt
http://YOUR_MAC_WIFI_IP:9876/artha.apk
```

### Build optimisations already configured

- R8 minification enabled
- Resource shrinking enabled
- arm64-v8a only (drops x86 emulator libs — saves ~33 MB)
- Hermes JS engine
- PNG crunching enabled
- `allowBackup` disabled (protects MeroShare session data)

---

## 4. Build Release AAB (for Play Store)

Play Store requires an Android App Bundle, not an APK.

```sh
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

> Use `assembleRelease` for direct installs/sharing. Use `bundleRelease` only when submitting to Play Store.

---

## 5. Test MeroShare Sync

1. Start the dev-client Metro server:

```sh
npm run start:dev-client
```

2. If on USB, route Metro through the cable:

```sh
/Users/kewal.agrawal/Library/Android/sdk/platform-tools/adb reverse tcp:8081 tcp:8081
```

3. Open **Artha** on the phone → tap **Start sync** → log into MeroShare.

4. Navigate to the WACC / Share Values / holdings report page and tap MeroShare's download button.

The app will log:

```txt
[MeroShare Sync] Downloaded report raw text
[MeroShare Sync] Downloaded report parsed rows
[MeroShare Sync] Downloaded report normalized holdings
```

---

## Signing

The release keystore is at `android/app/nepse-portfolio-release.keystore` (not committed to git).
Keystore credentials are in `android/app/keystore.properties` (not committed to git).

Keep both files backed up — losing the keystore means you can never update the app on Play Store.
