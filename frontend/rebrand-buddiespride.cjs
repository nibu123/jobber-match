const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = process.cwd();
const SRC_DIR = path.join(PROJECT_ROOT, "src");
const INDEX_HTML = path.join(PROJECT_ROOT, "index.html");

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".json"];

const REPLACEMENTS = [
  { from: /Jobber Match/g, to: "Buddies Pride" },
  { from: /JobberMatch/g, to: "BuddiesPride" },
  { from: /jobber-match/g, to: "buddies-pride" },
  { from: /jobbermatch/g, to: "buddiespride" },
];

let filesScanned = 0;
let filesEdited = 0;
const editedFiles = [];

function shouldSkip(filePath) {
  return (
    filePath.includes("node_modules") ||
    filePath.includes(".git") ||
    filePath.includes("dist") ||
    filePath.includes("build")
  );
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (shouldSkip(fullPath)) continue;
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  filesScanned++;
  let content = fs.readFileSync(filePath, "utf8");
  let original = content;

  for (const r of REPLACEMENTS) {
    content = content.replace(r.from, r.to);
  }

  if (content !== original) {
    fs.writeFileSync(filePath + ".bak", original, "utf8");
    fs.writeFileSync(filePath, content, "utf8");
    filesEdited++;
    editedFiles.push(path.relative(PROJECT_ROOT, filePath));
  }
}

function updateIndexHtml() {
  if (!fs.existsSync(INDEX_HTML)) {
    console.log("WARNING: index.html nahi mila.");
    return;
  }
  let html = fs.readFileSync(INDEX_HTML, "utf8");
  const original = html;

  for (const r of REPLACEMENTS) {
    html = html.replace(r.from, r.to);
  }

  if (/<link[^>]*rel=["']icon["'][^>]*>/i.test(html)) {
    html = html.replace(
      /<link[^>]*rel=["']icon["'][^>]*>/i,
      '<link rel="icon" type="image/svg+xml" href="/buddiespride-icon-3d-ultra.svg" />'
    );
  } else {
    html = html.replace(
      /<\/head>/i,
      '  <link rel="icon" type="image/svg+xml" href="/buddiespride-icon-3d-ultra.svg" />\n</head>'
    );
  }

  if (html !== original) {
    fs.writeFileSync(INDEX_HTML + ".bak", original, "utf8");
    fs.writeFileSync(INDEX_HTML, html, "utf8");
    console.log("SUCCESS: index.html updated");
  } else {
    console.log("INFO: index.html mein kuch change nahi mila.");
  }
}

console.log("Rebranding shuru: Jobber Match -> Buddies Pride");
walk(SRC_DIR);
updateIndexHtml();

console.log("");
console.log("Files scanned: " + filesScanned);
console.log("Files edited:  " + filesEdited);
if (editedFiles.length) {
  console.log("Edited files:");
  editedFiles.forEach(function(f) { console.log("  - " + f); });
}
