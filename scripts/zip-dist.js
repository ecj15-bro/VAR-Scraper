// scripts/zip-dist.js — Zip dist/win-unpacked into a distributable archive
// Run after: npm run electron:build
// Usage: node scripts/zip-dist.js

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "dist", "win-unpacked");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const version = pkg.version;
const outName = `Cloudbox-VAR-Hunter-${version}-win-portable.zip`;
const OUT = path.join(ROOT, "dist", outName);

if (!fs.existsSync(SRC)) {
  console.error(`dist/win-unpacked not found. Run npm run electron:build first.`);
  process.exit(1);
}

// Remove previous zip if exists
if (fs.existsSync(OUT)) fs.unlinkSync(OUT);

console.log(`Zipping ${SRC} → ${OUT}`);

// Use PowerShell's Compress-Archive (available on all Windows 10+ systems)
execSync(
  `powershell -Command "Compress-Archive -Path '${SRC}\\*' -DestinationPath '${OUT}'"`,
  { stdio: "inherit" }
);

const size = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
console.log(`Done: dist/${outName} (${size} MB)`);
console.log(`Distribute this zip. Users extract and run "Cloudbox VAR Hunter.exe" directly.`);
