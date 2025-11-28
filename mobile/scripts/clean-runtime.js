const { rimrafSync } = require("rimraf");
const { spawn } = require("child_process");
const path = require("path");

const projectRoot = process.cwd();
const targets = [
  "node_modules/.cache",
  ".expo",
  "android/.gradle",
  "android/app/build",
];

for (const target of targets) {
  const fullPath = path.join(projectRoot, target);
  try {
    rimrafSync(fullPath, { glob: false });
    console.log(`[cache] Cleared ${target}`);
  } catch (error) {
    console.warn(`[cache] Skipped ${target}: ${error.message}`);
  }
}

function clearMetroCache() {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const expoArgs = ["expo", "start", "--clear"];
    const npxCommand = isWindows ? "cmd.exe" : "npx";
    const args = isWindows ? ["/c", "npx", ...expoArgs] : expoArgs;
    const child = spawn(npxCommand, args, {
      stdio: "ignore",
      env: {
        ...process.env,
        CI: "1",
        EXPO_NO_DAEMON: "1",
        EXPO_DEV_SERVER_PORT: "8090",
        RCT_METRO_PORT: "8090",
      },
    });

    const timer = setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGINT");
      }
    }, 1500);

    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code && code !== 0 && code !== 130) {
        console.warn(`[metro] Expo exited with code ${code}. Cache was still cleared by --clear.`);
      }
      resolve();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

clearMetroCache()
  .then(() => {
    console.log("[metro] Cleared Metro/Worklet caches with expo r -c equivalent.");
  })
  .catch((error) => {
    console.warn(`[metro] Failed to clear via Expo CLI: ${error.message}`);
  });
