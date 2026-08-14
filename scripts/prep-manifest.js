const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const outPath = process.argv[2];

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.browser_specific_settings = {
  gecko: {
    id: "simprler@example.org",
    strict_min_version: "115.0",
  },
};

if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
} else {
  process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
}