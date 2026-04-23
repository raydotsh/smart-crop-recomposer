function buildSharpInstallMessage(error) {
  const platform = process.platform;
  const arch = process.arch;
  const usingWslPath = process.cwd().startsWith("/mnt/");

  const lines = [
    `Sharp failed to load for ${platform}-${arch}.`,
    "This usually means node_modules were installed on a different OS than the one running Node."
  ];

  if (platform === "linux" && usingWslPath) {
    lines.push(
      "You appear to be running the backend from WSL against a Windows-mounted repo.",
      "Reinstall backend dependencies inside WSL so sharp can download the linux-x64 binary:",
      "  rm -rf node_modules package-lock.json",
      "  npm install"
    );
  } else if (platform === "win32") {
    lines.push(
      "Reinstall backend dependencies in this Windows environment:",
      "  rmdir /s /q node_modules",
      "  del package-lock.json",
      "  npm install"
    );
  } else {
    lines.push(
      `Reinstall backend dependencies for ${platform}-${arch}:`,
      "  rm -rf node_modules package-lock.json",
      "  npm install"
    );
  }

  if (error && error.message) {
    lines.push("", `Original sharp error: ${error.message}`);
  }

  return new Error(lines.join("\n"));
}

function loadSharp() {
  try {
    return require("sharp");
  } catch (error) {
    throw buildSharpInstallMessage(error);
  }
}

module.exports = {
  loadSharp
};
