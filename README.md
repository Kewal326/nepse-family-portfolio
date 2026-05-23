# NEPSE Family Portfolio

Android-first portfolio app for consolidating multiple family MeroShare/NEPSE accounts.

## Quick UI Testing With Expo Go

1. Install **Expo Go** from the Google Play Store.
2. Make sure your phone and Mac are on the same Wi-Fi network.
3. In this folder, run:

```sh
npm run start:phone
```

4. Open Expo Go on your phone.
5. Tap **Enter URL manually** and enter:

```txt
exp://YOUR_MAC_WIFI_IP:8081
```

On this machine right now, the Wi-Fi IP was:

```txt
192.168.18.185
```

So the current dev URL is:

```txt
exp://192.168.18.185:8081
```

If your Wi-Fi changes, get the current IP with:

```sh
ipconfig getifaddr en0
```

## Current Main Path

For MeroShare report downloads and local file handling, use the custom Android development build below. Expo Go is only useful for quick UI checks.

## Run The Custom Android Development Build

Use this when testing native Android behavior like WebView downloads and local file handling.

1. On your Android phone, enable Developer Options:

```txt
Settings -> About phone -> tap Build number 7 times
```

2. Enable USB debugging:

```txt
Settings -> Developer options -> USB debugging
```

3. Connect the phone to the Mac with USB.

4. On the phone, approve the **Allow USB debugging** prompt.

5. Confirm the phone is visible:

```sh
/Users/kewal.agrawal/Library/Android/sdk/platform-tools/adb devices
```

The device should show as `device`, not `unauthorized`.

6. Build and install the custom debug app:

```sh
npm run android:device
```

7. Start Metro for the custom dev client:

```sh
npm run start:dev-client
```

After this, use the installed **NEPSE Family Portfolio** debug app on the phone instead of Expo Go.

This project uses a local Java 17 JDK at:

```txt
/Users/kewal.agrawal/.jdks/jdk-17.0.19+10/Contents/Home
```

## Test MeroShare Report Import

1. Start the custom dev-client server:

```sh
npm run start:dev-client
```

2. If the phone is connected by USB, route Metro through USB:

```sh
/Users/kewal.agrawal/Library/Android/sdk/platform-tools/adb reverse tcp:8081 tcp:8081
```

3. Open **NEPSE Family Portfolio** on the phone.

4. Tap **Start sync**.

5. Log into MeroShare.

6. Navigate to the WACC / Share Values / holdings report page.

7. Tap MeroShare's own download/export button.

The app will log:

```txt
[MeroShare Sync] Downloaded report raw text
[MeroShare Sync] Downloaded report parsed rows
[MeroShare Sync] Downloaded report normalized holdings
```

If the report is a true binary XLSX file, the app will log that XLSX parsing is the next parser to add.
