import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createIconCatalog } from "./icon-catalog.js";
import { buildProfileHtml } from "./profile-html.js";

const local = process.argv.includes("--local");
if (local && process.env.WORKERS_CI) throw new Error("Local profile defaults cannot be used in Workers Builds.");
const variables = local ? {
    PROFILE_HANDLE: process.env.PROFILE_HANDLE ?? "jams_jard",
    PROFILE_IMAGE_PATH: process.env.PROFILE_IMAGE_PATH ?? "me.jpg",
} : process.env;
const template = await readFile(new URL("index.html", import.meta.url), "utf8");
const html = buildProfileHtml(template, variables);
await readFile(new URL(`../public/${variables.PROFILE_IMAGE_PATH}`, import.meta.url));
const output = new URL("../dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const destination = new URL("vendor/", output);
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
await cp(new URL("../public/", import.meta.url), output, {
    recursive: true,
    filter: source => !["index.html", "vendor"].includes(source.split("/").at(-1)),
});
await writeFile(new URL("index.html", output), html);