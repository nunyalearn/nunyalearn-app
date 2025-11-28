const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "";
const platformTools = sdkRoot ? path.join(sdkRoot, "platform-tools") : "";
const adbExecutable = process.platform === "win32" ? "adb.exe" : "adb";
const adbPath = platformTools ? path.join(platformTools, adbExecutable) : "";

const warnings = [];

if (!sdkRoot) {
  warnings.push("ANDROID_HOME is not set. Expo will serve a QR code for Expo Go instead of launching an emulator.");
}

if (sdkRoot && (!fs.existsSync(platformTools) || !fs.existsSync(adbPath))) {
  warnings.push("adb executable not found at the expected Android SDK path. Device builds will rely on Expo Go QR codes.");
}

if (warnings.length > 0) {
  console.warn("\n[Android Environment]");
  warnings.forEach((msg) => console.warn(`- ${msg}`));
  console.warn("This run will fall back to Expo Go over LAN/Tunnel.\n");
} else {
  console.log("Android environment detected. Expo Go will still use the QR workflow per project constraints.\n");
}

if (process.env.SKIP_EXPO_START === "1") {
  console.log("SKIP_EXPO_START detected. Exiting after environment verification.");
  process.exit(0);
}

const args = ["expo", "start", "--tunnel", "--no-dev-client"];

const child = spawn("npx", args, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    EXPO_USE_METRO_WORKSPACES: "1",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
