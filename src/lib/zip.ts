import {
  strFromU8,
  strToU8,
  unzipSync,
  Zip,
  ZipDeflate,
  ZipPassThrough,
} from "fflate";

export type ZipEntry =
  | {
      type: "file";
      path: string;
      content: string;
    }
  | {
      type: "dir";
      // Should end with a `/`.
      path: string;
    };

/**
 * Create a zip file, streaming entries into it as they're generated
 *
 * Our entire zip process is not fully streaming, since FireFox doesn't support
 * showOpenFilePicker(), but hopefully this will change in the future.
 */
export async function createZip(
  entries: AsyncIterable<ZipEntry>,
  date: Date = new Date(),
): Promise<Blob> {
  const chunks: Uint8Array[] = [];
  let zipError: Error | null = null;
  const zip = new Zip((err, chunk) => {
    if (err) {
      zipError = err;
    } else {
      chunks.push(chunk);
    }
  });

  try {
    for await (const entry of entries) {
      const file =
        entry.type == "file"
          ? new ZipDeflate(entry.path)
          : new ZipPassThrough(entry.path);
      file.mtime = date;
      zip.add(file);
      file.push(strToU8(entry.type == "file" ? entry.content : ""), true);
      if (zipError) {
        throw zipError;
      }
    }
    zip.end();
  } catch (e) {
    zip.terminate();
    throw e;
  }
  if (zipError) {
    throw zipError;
  }
  return new Blob(chunks, { type: "application/zip" });
}

/**
 * Read all entries from a zip file
 */
export function readZip(data: Uint8Array): ZipEntry[] {
  return Object.entries(unzipSync(data)).map(([path, content]) =>
    path.endsWith("/")
      ? { type: "dir", path: path.slice(0, -1) }
      : { type: "file", path, content: strFromU8(content) },
  );
}
