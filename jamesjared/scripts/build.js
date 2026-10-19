import { copyFile, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createIconCatalog } from "./icon-catalog.js";

const destination = new URL("../public/vendor/", import.meta.url);
await mkdir(destination, { recursive: true });
await copyFile(
    new URL("../node_modules/sortablejs/Sortable.min.js", import.meta.url),
    new URL("sortable.min.js", destination),
);

const fontAwesome = new URL("../node_modules/@fortawesome/fontawesome-free/", import.meta.url);
const fontDestination = new URL("fontawesome/", destination);
await mkdir(new URL("css/", fontDestination), { recursive: true });
await copyFile(new URL("css/all.min.css", fontAwesome), new URL("css/all.min.css", fontDestination));
await cp(new URL("webfonts/", fontAwesome), new URL("webfonts/", fontDestination), { recursive: true });
await copyFile(new URL("LICENSE.txt", fontAwesome), new URL("LICENSE.txt", fontDestination));
const metadata = JSON.parse(await readFile(new URL("metadata/icon-families.json", fontAwesome), "utf8"));
const icons = createIconCatalog(metadata);
await writeFile(new URL("icons.js", destination), `export default ${JSON.stringify(icons)};\n`);
console.log(`Generated ${icons.length} free Font Awesome icons.`);