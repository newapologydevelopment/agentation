import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url);
const manifestPath = new URL("manifest.json", dist);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const files = await readdir(dist);
const toolbarCss = files.find((file) => file.endsWith(".css"));

if (!toolbarCss) throw new Error("Agentation content stylesheet was not emitted");
if (!manifest.content_scripts?.[0]) throw new Error("Content-script manifest entry is missing");

manifest.content_scripts[0].css = [toolbarCss];
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Attached ${join("dist", toolbarCss)} to the content script`);
