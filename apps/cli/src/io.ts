import {
  openSync,
  closeSync,
  fstatSync,
  readFileSync,
  mkdirSync,
  existsSync,
  lstatSync,
  realpathSync,
  statSync,
  writeFileSync,
  fsyncSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
export function readLocalFile(path: string, maxBytes = 128 * 1024 * 1024): string {
  let fd: number | undefined;
  try {
    fd = openSync(resolve(path), "r");
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > maxBytes) throw new Error();
    return readFileSync(fd, "utf8").replace(/^\uFEFF/, "");
  } catch {
    throw new Error(
      "Cannot read input/config file. Use a readable regular UTF-8 file within the size limit.",
    );
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
/** Atomic replacement never follows a destination symlink or truncates a protected source. */
export function writeDiagramFile(path: string, xml: string, protectedPaths: string[]): string {
  const output = resolve(path);
  const sources = protectedPaths.map((p) => resolve(p));
  if (sources.includes(output)) throw new Error("Invalid output path: must differ from input and config.");
  if (existsSync(output)) {
    if (lstatSync(output).isSymbolicLink())
      throw new Error("Invalid output path: symbolic links are not accepted.");
    const destination = statSync(output);
    if (!destination.isFile()) throw new Error("Invalid output path: destination must be a regular file.");
    if (
      sources.some(
        (p) =>
          realpathSync(p) === realpathSync(output) ||
          (statSync(p).ino !== 0 &&
            statSync(p).ino === destination.ino &&
            statSync(p).dev === destination.dev),
      )
    )
      throw new Error("Invalid output path: destination aliases input or config.");
  }
  mkdirSync(dirname(output), { recursive: true });
  const temporary = join(dirname(output), `.iacviz-${randomUUID()}.tmp`);
  let fd: number | undefined;
  try {
    fd = openSync(temporary, "wx", 0o600);
    writeFileSync(fd, xml, "utf8");
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temporary, output);
    return output;
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
