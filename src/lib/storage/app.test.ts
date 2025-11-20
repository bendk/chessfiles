import { createRoot } from "solid-js";
import { afterAll, describe, test, expect, vi } from "vitest";
import * as dropbox from "~/lib/auth/dropbox";
import { AppStorage, ChessfilesStorageLocal, joinPath } from ".";
import { MockLocalStorage } from "./meta.test";

/**
 * Test the `copy` and `move` functions
 */
describe("copy and move", () => {
  const spy = vi.spyOn(dropbox, "isAuthorized");
  spy.mockReturnValue(true);
  let solidDispose: (() => void) | null = null;

  afterAll(() => {
    spy.mockRestore();
    if (solidDispose) {
      solidDispose();
      solidDispose = null;
    }
  });

  function createStorage(): [
    ChessfilesStorageLocal,
    ChessfilesStorageLocal,
    AppStorage,
  ] {
    return createRoot((dispose) => {
      solidDispose = dispose;
      const local = new ChessfilesStorageLocal(new MockLocalStorage());
      const dropbox = new ChessfilesStorageLocal(new MockLocalStorage());
      const app = new AppStorage({ local, dropbox }, "/Local Storage");
      return [local, dropbox, app];
    });
  }

  async function checkFiles(
    s: ChessfilesStorageLocal,
    dir: string,
    expectedEntries: Record<string, string>,
  ): Promise<void> {
    for (const actual of await s.listDir(dir)) {
      if (actual.filename == "ChessfilesTraining") {
        continue;
      }
      const expected = expectedEntries[actual.filename];
      delete expectedEntries[actual.filename];
      expect(
        expected,
        `did not expected dir entry: ${JSON.stringify(actual)}`,
      ).not.toBe(undefined);
      if (expected == "dir") {
        expect(
          actual.type,
          `expected ${JSON.stringify(actual)} to be a directory`,
        ).toEqual("dir");
      } else {
        expect(
          actual.type,
          `expected ${JSON.stringify(actual)} to be a file`,
        ).toEqual("file");
        expect(
          await s.readFile(joinPath(dir, actual.filename)),
          `expected ${JSON.stringify(actual)} contents to be ${expected}`,
        ).toEqual(expected);
      }
    }
    expect(expectedEntries).toEqual({});
  }

  test("move single file", async () => {
    const [local, dropbox, app] = createStorage();
    const onFilesMoved = vi.spyOn(
      await app._metaManagerForTesting(),
      "onFilesMoved",
    );
    await local.createFile("/foo.pgn", "foo-data");
    await app.move(
      [
        {
          filename: "foo.pgn",
          type: "file",
        },
      ],
      "/Dropbox/",
      {},
    );
    await checkFiles(local, "/", {});
    await checkFiles(dropbox, "/", {
      "foo.pgn": "foo-data",
    });
    expect(onFilesMoved).toHaveBeenCalledWith([
      ["/Local Storage/foo.pgn", "/Dropbox/foo.pgn"],
    ]);
  });

  test("copy single file", async () => {
    const [local, dropbox, app] = createStorage();
    const onFilesMoved = vi.spyOn(
      await app._metaManagerForTesting(),
      "onFilesMoved",
    );
    await local.createFile("/foo.pgn", "foo-data");
    await app.copy(
      [
        {
          filename: "foo.pgn",
          type: "file",
        },
      ],
      "/Dropbox/",
      {},
    );
    await checkFiles(local, "/", {
      "foo.pgn": "foo-data",
    });
    await checkFiles(dropbox, "/", {
      "foo.pgn": "foo-data",
    });
    expect(onFilesMoved).not.toHaveBeenCalled();
  });

  test("move single directory", async () => {
    const [local, dropbox, app] = createStorage();
    const onFilesMoved = vi.spyOn(
      await app._metaManagerForTesting(),
      "onFilesMoved",
    );
    await local.createDir("/My Openings");
    await app.move(
      [
        {
          filename: "My Openings",
          type: "dir",
        },
      ],
      "/Dropbox/",
      {},
    );
    await checkFiles(local, "/", {});
    await checkFiles(dropbox, "/", {
      "My Openings": "dir",
    });
    expect(onFilesMoved).not.toHaveBeenCalled();
  });

  test("copy single directory", async () => {
    const [local, dropbox, app] = createStorage();
    const onFilesMoved = vi.spyOn(
      await app._metaManagerForTesting(),
      "onFilesMoved",
    );
    await local.createDir("/My Openings");
    await app.copy(
      [
        {
          filename: "My Openings",
          type: "dir",
        },
      ],
      "/Dropbox/",
      {},
    );
    await checkFiles(local, "/", {
      "My Openings": "dir",
    });
    await checkFiles(dropbox, "/", {
      "My Openings": "dir",
    });
    expect(onFilesMoved).not.toHaveBeenCalled();
  });

  test("move multiple files/directories", async () => {
    const [local, dropbox, app] = createStorage();
    const onFilesMoved = vi.spyOn(
      await app._metaManagerForTesting(),
      "onFilesMoved",
    );
    await local.createDir("/My Openings");
    await local.createDir("/My Endgames");
    await local.createFile("/foo.pgn", "foo-data");
    await local.createFile("/My Openings/foo2.pgn", "foo2-data");
    await app.move(
      [
        {
          filename: "My Openings",
          type: "dir",
        },
        {
          filename: "foo.pgn",
          type: "file",
        },
      ],
      "/Dropbox/",
      {},
    );
    await checkFiles(local, "/", {
      "My Endgames": "dir",
    });
    await checkFiles(dropbox, "/", {
      "My Openings": "dir",
      "foo.pgn": "foo-data",
    });
    await checkFiles(dropbox, "/My Openings", {
      "foo2.pgn": "foo2-data",
    });
    expect(onFilesMoved).toHaveBeenCalledWith([
      ["/Local Storage/My Openings/foo2.pgn", "/Dropbox/My Openings/foo2.pgn"],
      ["/Local Storage/foo.pgn", "/Dropbox/foo.pgn"],
    ]);
  });

  test("copy multiple files/directories", async () => {
    const [local, dropbox, app] = createStorage();
    const onFilesMoved = vi.spyOn(
      await app._metaManagerForTesting(),
      "onFilesMoved",
    );
    await local.createDir("/My Openings");
    await local.createDir("/My Endgames");
    await local.createFile("/foo.pgn", "foo-data");
    await local.createFile("/My Openings/foo2.pgn", "foo2-data");
    await app.copy(
      [
        {
          filename: "My Openings",
          type: "dir",
        },
        {
          filename: "foo.pgn",
          type: "file",
        },
      ],
      "/Dropbox/",
      {},
    );
    await checkFiles(local, "/", {
      "My Openings": "dir",
      "My Endgames": "dir",
      "foo.pgn": "foo-data",
    });
    await checkFiles(local, "/My Openings", {
      "foo2.pgn": "foo2-data",
    });
    await checkFiles(dropbox, "/", {
      "My Openings": "dir",
      "foo.pgn": "foo-data",
    });
    await checkFiles(dropbox, "/My Openings", {
      "foo2.pgn": "foo2-data",
    });
    expect(onFilesMoved).not.toHaveBeenCalled();
  });

  test("move path conflict: overwrite", async () => {
    const [local, dropbox, app] = createStorage();
    const onFilesMoved = vi.spyOn(
      await app._metaManagerForTesting(),
      "onFilesMoved",
    );
    await local.createDir("/My Openings");
    await local.createDir("/My Endgames");
    await local.createFile("/foo.pgn", "foo-data");
    await local.createFile("/My Openings/foo2.pgn", "foo2-data");
    await dropbox.createFile("/foo.pgn", "dropbox-foo-data");
    await app.move(
      [
        {
          filename: "My Openings",
          type: "dir",
        },
        {
          filename: "foo.pgn",
          type: "file",
        },
      ],
      "/Dropbox/",
      {
        shouldOverwrite: () => Promise.resolve(true),
      },
    );
    await checkFiles(local, "/", {
      "My Endgames": "dir",
    });
    await checkFiles(dropbox, "/", {
      "My Openings": "dir",
      "foo.pgn": "foo-data",
    });
    await checkFiles(dropbox, "/My Openings", {
      "foo2.pgn": "foo2-data",
    });
    expect(onFilesMoved).toHaveBeenCalledWith([
      ["/Local Storage/My Openings/foo2.pgn", "/Dropbox/My Openings/foo2.pgn"],
      ["/Local Storage/foo.pgn", "/Dropbox/foo.pgn"],
    ]);
  });

  test("copy path conflict: overwrite", async () => {
    const [local, dropbox, app] = createStorage();
    const onFilesMoved = vi.spyOn(
      await app._metaManagerForTesting(),
      "onFilesMoved",
    );
    await local.createDir("/My Openings");
    await local.createDir("/My Endgames");
    await local.createFile("/foo.pgn", "foo-data");
    await local.createFile("/My Openings/foo2.pgn", "foo2-data");
    await dropbox.createFile("/foo.pgn", "dropbox-foo-data");
    await app.copy(
      [
        {
          filename: "My Openings",
          type: "dir",
        },
        {
          filename: "foo.pgn",
          type: "file",
        },
      ],
      "/Dropbox/",
      {
        shouldOverwrite: () => Promise.resolve(true),
      },
    );
    await checkFiles(local, "/", {
      "My Openings": "dir",
      "My Endgames": "dir",
      "foo.pgn": "foo-data",
    });
    await checkFiles(local, "/My Openings", {
      "foo2.pgn": "foo2-data",
    });
    await checkFiles(dropbox, "/", {
      "My Openings": "dir",
      "foo.pgn": "foo-data",
    });
    await checkFiles(dropbox, "/My Openings", {
      "foo2.pgn": "foo2-data",
    });
    expect(onFilesMoved).not.toHaveBeenCalled();
  });

  test("move path conflict: skip", async () => {
    const [local, dropbox, app] = createStorage();
    const onFilesMoved = vi.spyOn(
      await app._metaManagerForTesting(),
      "onFilesMoved",
    );
    await local.createDir("/My Openings");
    await local.createDir("/My Endgames");
    await local.createFile("/foo.pgn", "foo-data");
    await local.createFile("/My Openings/foo2.pgn", "foo2-data");
    await dropbox.createFile("/foo.pgn", "dropbox-foo-data");
    await app.move(
      [
        {
          filename: "My Openings",
          type: "dir",
        },
        {
          filename: "foo.pgn",
          type: "file",
        },
      ],
      "/Dropbox/",
      {
        shouldOverwrite: () => Promise.resolve(false),
      },
    );
    await checkFiles(local, "/", {
      "My Endgames": "dir",
      "foo.pgn": "foo-data",
    });
    await checkFiles(dropbox, "/", {
      "My Openings": "dir",
      "foo.pgn": "dropbox-foo-data",
    });
    await checkFiles(dropbox, "/My Openings", {
      "foo2.pgn": "foo2-data",
    });
    expect(onFilesMoved).toHaveBeenCalledWith([
      ["/Local Storage/My Openings/foo2.pgn", "/Dropbox/My Openings/foo2.pgn"],
    ]);
  });

  test("copy path conflict: skip", async () => {
    const [local, dropbox, app] = createStorage();
    const onFilesMoved = vi.spyOn(
      await app._metaManagerForTesting(),
      "onFilesMoved",
    );
    await local.createDir("/My Openings");
    await local.createDir("/My Endgames");
    await local.createFile("/foo.pgn", "foo-data");
    await local.createFile("/My Openings/foo2.pgn", "foo2-data");
    await dropbox.createFile("/foo.pgn", "dropbox-foo-data");
    await app.copy(
      [
        {
          filename: "My Openings",
          type: "dir",
        },
        {
          filename: "foo.pgn",
          type: "file",
        },
      ],
      "/Dropbox/",
      {
        shouldOverwrite: () => Promise.resolve(false),
      },
    );
    await checkFiles(local, "/", {
      "My Openings": "dir",
      "My Endgames": "dir",
      "foo.pgn": "foo-data",
    });
    await checkFiles(local, "/My Openings", {
      "foo2.pgn": "foo2-data",
    });
    await checkFiles(dropbox, "/", {
      "My Openings": "dir",
      "foo.pgn": "dropbox-foo-data",
    });
    await checkFiles(dropbox, "/My Openings", {
      "foo2.pgn": "foo2-data",
    });
    expect(onFilesMoved).not.toHaveBeenCalled();
  });

  test("move inside same storage", async () => {
    const [local, , app] = createStorage();
    const onFilesMoved = vi.spyOn(
      await app._metaManagerForTesting(),
      "onFilesMoved",
    );
    await local.createFile("/foo.pgn", "foo-data");
    await local.createDir("/directory");
    await app.move(
      [
        {
          filename: "foo.pgn",
          type: "file",
        },
      ],
      "/Local Storage/directory",
      {},
    );
    await checkFiles(local, "/", {
      directory: "dir",
    });
    await checkFiles(local, "/directory", {
      "foo.pgn": "foo-data",
    });
    expect(onFilesMoved).toHaveBeenCalledWith([
      ["/Local Storage/foo.pgn", "/Local Storage/directory/foo.pgn"],
    ]);
  });

  test("move inside source dir", async () => {
    const [local, , app] = createStorage();
    const onFilesMoved = vi.spyOn(
      await app._metaManagerForTesting(),
      "onFilesMoved",
    );
    await local.createDir("/My Openings");
    await local.createFile("/My Openings/foo.pgn", "foo-data");
    await local.createDir("/Second folder");
    await app.move(
      [
        {
          filename: "My Openings",
          type: "dir",
        },
      ],
      "/Local Storage/Second folder",
      {},
    );
    await checkFiles(local, "/", {
      "Second folder": "dir",
    });
    await checkFiles(local, "/Second folder", {
      "My Openings": "dir",
    });
    await checkFiles(local, "/Second folder/My Openings", {
      "foo.pgn": "foo-data",
    });
    expect(onFilesMoved).toHaveBeenCalledWith([
      [
        "/Local Storage/My Openings/foo.pgn",
        "/Local Storage/Second folder/My Openings/foo.pgn",
      ],
    ]);
  });
});
