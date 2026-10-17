// Local helper for diagrams.net acceptance (see docs/drawio-export.md).
// GET /open?file=<name>.drawio redirects to app.diagrams.net with the file in the "#R" hash,
// diagrams.net's own URL encoding: base64(deflateRaw(encodeURIComponent(xml))).
// Only *.drawio files directly inside the served folder are readable; it listens on 127.0.0.1 only.
// The diagram content travels inside the URL hash to app.diagrams.net, which renders it in the
// browser; do not use it for diagrams you may not open in diagrams.net.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { deflateRawSync } from "node:zlib";
import { Buffer } from "node:buffer";

const root = resolve(process.argv[2] ?? "examples");
const port = Number(process.env.PORT ?? 43828);
createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const name = basename(url.searchParams.get("file") ?? "");
  const file = join(root, name);
  if (url.pathname !== "/open" || !name.endsWith(".drawio") || !existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  const xml = readFileSync(file, "utf8");
  const data = deflateRawSync(Buffer.from(encodeURIComponent(xml), "latin1")).toString("base64");
  res.writeHead(302, { Location: "https://app.diagrams.net/?splash=0#R" + encodeURIComponent(data) });
  res.end();
}).listen(port, "127.0.0.1", () => console.log(`Open http://127.0.0.1:${port}/open?file=<name>.drawio`));
