const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const archiver = require("archiver");

const mode = process.argv[2] || "zip";
const browser = process.env.TARGET_BROWSER || "chrome";
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist", browser);
const releaseDir = path.join(root, "release");

if (!fs.existsSync(distDir)) {
  throw new Error(`Build output not found: ${distDir}`);
}

fs.mkdirSync(releaseDir, { recursive: true });

if (mode === "zip") {
  archiveDirectory(distDir, path.join(releaseDir, `${browser}-extension.zip`));
} else if (mode === "crx") {
  createCrxPlaceholder(distDir, path.join(releaseDir, `${browser}-extension.crx`));
} else {
  throw new Error(`Unknown package mode: ${mode}`);
}

function archiveDirectory(sourceDir, outputPath) {
  const output = fs.createWriteStream(outputPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    console.log(`Created ${outputPath} (${archive.pointer()} bytes)`);
  });

  archive.on("error", (error) => {
    throw error;
  });

  archive.pipe(output);
  archive.directory(sourceDir, false);
  archive.finalize();
}

function createCrxPlaceholder(sourceDir, outputPath) {
  const privateKeyPath = process.env.CRX_PRIVATE_KEY;
  if (!privateKeyPath || !fs.existsSync(privateKeyPath)) {
    const notePath = outputPath.replace(/\.crx$/, ".crx.README.txt");
    fs.writeFileSync(
      notePath,
      [
        "CRX packaging requires a private key and Chrome-compatible signing.",
        "For Chrome Web Store, upload the generated ZIP; the store signs the CRX.",
        "To produce an offline CRX, set CRX_PRIVATE_KEY and replace this placeholder with a signing implementation.",
        `Build directory: ${sourceDir}`
      ].join("\n")
    );
    console.log(`CRX signing key not provided. Wrote ${notePath}`);
    return;
  }

  const digest = crypto.createHash("sha256").update(fs.readFileSync(privateKeyPath)).digest("hex");
  fs.writeFileSync(outputPath, `CRX signing placeholder for ${sourceDir}\nkey:${digest}\n`);
  console.log(`Created placeholder CRX at ${outputPath}`);
}
