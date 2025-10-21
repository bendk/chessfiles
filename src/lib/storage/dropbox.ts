import type { DirEntry, DirEntryType } from "./base";
import { splitPath, ChessfilesStorage, FileExistsError } from "./base";
import * as dropbox from "~/lib/auth/dropbox";

function apiPath(path: string): string {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export class ChessfilesStorageDropbox extends ChessfilesStorage {
  cachedEntries: Record<string, DirEntry[]> = {};

  constructor() {
    super();
  }

  async populateEntries(path: string) {
    if (this.cachedEntries[path] !== undefined) {
      return;
    }
    let resp = await makeRequest("files/list_folder", { path: apiPath(path) });
    this.cachedEntries[path] = [];
    do {
      for (const entry of resp.entries) {
        let type: "file" | "dir";
        if (entry[".tag"] == "file") {
          type = "file";
        } else if (entry[".tag"] == "folder") {
          type = "dir";
        } else {
          continue;
        }
        this.cachedEntries[path].push({
          type,
          filename: entry.name,
        });
      }
      resp = await makeRequest("files/list_folder/continue", {
        cursor: resp.cursor,
      });
    } while (resp.has_more);
  }

  private removeCachedFile(path: string) {
    const [dir, filename] = splitPath(path);
    if (this.cachedEntries[dir] !== undefined) {
      this.cachedEntries[dir] = this.cachedEntries[dir].filter(
        (e) => e.filename != filename,
      );
    }
  }

  private addCachedEntry(path: string, type: DirEntryType) {
    const [dir, filename] = splitPath(path);
    if (this.cachedEntries[dir] !== undefined) {
      this.cachedEntries[dir].push({
        type,
        filename,
      });
    }
  }

  async listDir(path: string): Promise<DirEntry[]> {
    await this.populateEntries(path);
    return this.cachedEntries[path] ?? [];
  }

  async readFile(path: string): Promise<string> {
    const [, content] = await makeContentDownloadRequest("files/download", {
      path: apiPath(path),
    });
    return content;
  }

  async exists(path: string) {
    const [dir, filename] = splitPath(path);
    for (const entry of await this.listDir(dir)) {
      if (entry.filename == filename) {
        return true;
      }
    }
    return false;
  }

  async createFile(path: string, content: string) {
    await makeContentUploadRequest(
      "files/upload",
      {
        path: apiPath(path),
        mode: "add",
      },
      content,
    );
    this.addCachedEntry(path, "file");
  }

  async writeFile(path: string, content: string) {
    await makeContentUploadRequest(
      "files/upload",
      {
        path: apiPath(path),
        mode: "overwrite",
      },
      content,
    );
  }

  async createDir(path: string) {
    await makeRequest("files/create_folder_v2", {
      path: apiPath(path),
    });
    this.addCachedEntry(path, "dir");
  }

  async move(from: string, to: string) {
    const [dir, filename] = splitPath(from);
    this.populateEntries(dir);
    const entry = this.cachedEntries[dir].find((e) => e.filename == filename);
    if (!entry) {
      throw Error(`${from} does not exist`);
    }
    await makeRequest("files/move", {
      from_path: apiPath(from),
      to_path: apiPath(to),
    });
    this.removeCachedFile(from);
    this.addCachedEntry(to, entry.type);
  }

  async remove(path: string) {
    await makeRequest("files/delete_v2", { path });
    this.removeCachedFile(path);
  }
}

async function makeRequest(
  path: string,
  data: Record<string, string>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  let accessToken = dropbox.getAccessToken();
  if (accessToken === undefined) {
    throw Error("makeRequest: no access token");
  }
  const url = new URL(`https://api.dropbox.com/2/${path}`);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const body = data ? JSON.stringify(data) : undefined;

  let resp = await fetch(url, { method: "POST", headers, body });
  if (resp.status == 401) {
    accessToken = await dropbox.refreshAccessToken();
    if (accessToken != undefined) {
      headers["Authorization"] = `Bearer ${accessToken}`;
      resp = await fetch(url, { method: "POST", headers, body });
    }
  }
  await checkApiResponse(resp);
  return resp.json();
}

async function makeContentUploadRequest(
  path: string,
  data: Record<string, string>,
  body: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  let accessToken = dropbox.getAccessToken();
  if (accessToken === undefined) {
    throw Error("makeRequest: no access token");
  }
  const url = new URL(`https://content.dropboxapi.com/2/${path}`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/octet-stream",
    "Dropbox-API-Arg": JSON.stringify(data),
  };

  let resp = await fetch(url, { method: "POST", headers, body });
  if (resp.status == 401) {
    accessToken = await dropbox.refreshAccessToken();
    headers["Authorization"] = `Bearer ${accessToken}`;
    resp = await fetch(url, { method: "POST", headers, body });
  }
  await checkApiResponse(resp);
  return resp.json();
}

async function makeContentDownloadRequest(
  path: string,
  data: Record<string, string>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<[any, string]> {
  let accessToken = dropbox.getAccessToken();
  if (accessToken === undefined) {
    throw Error("makeRequest: no access token");
  }
  const url = new URL(`https://content.dropboxapi.com/2/${path}`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Dropbox-API-Arg": JSON.stringify(data),
  };

  let resp = await fetch(url, { method: "POST", headers });
  if (resp.status == 401) {
    accessToken = await dropbox.refreshAccessToken();
    headers["Authorization"] = `Bearer ${accessToken}`;
    resp = await fetch(url, { method: "POST", headers });
  }
  await checkApiResponse(resp);
  const responseData = JSON.parse(
    resp.headers.get("Dropbox-API-Result") ?? "{}",
  );
  const content = await resp.text();
  return [responseData, content];
}

async function checkApiResponse(resp: Response) {
  if (resp.status != 200) {
    let errorData;
    try {
      errorData = await resp.json();
    } catch {
      errorData = undefined;
    }
    if (
      errorData !== undefined &&
      errorData.error_summary &&
      errorData.error_summary.startsWith("path/conflict")
    ) {
      throw new FileExistsError();
    }
    throw Error("Dropbox API error");
  }
}
