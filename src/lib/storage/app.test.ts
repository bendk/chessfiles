import { createRoot } from "solid-js";
import { afterAll, describe, test, expect } from "vitest";
import type { ChessfilesStorage } from ".";
import { AppStorage, ChessfilesStorageLocal, joinPath, splitPath } from ".";
import { MockLocalStorage } from "./testutils";
import type {
  Activity,
  LibraryActivity,
  TrainingActivity,
} from "~/lib/activity";
import { newLibraryActivity } from "~/lib/activity";
import { Book, RootNode, RootNodeType } from "~/lib/node";
import type { TrainingMeta } from "~/lib/training";
import { defaultTrainingSettings } from "~/lib/training";

class TestStorageEngines {
  local: ChessfilesStorageLocal;

  constructor(
    private s1: ChessfilesStorageLocal,
    private s2: ChessfilesStorageLocal,
  ) {
    this.local = this.s1;
  }

  allStorageEngines(): [string, ChessfilesStorage][] {
    return [
      ["s1", this.s1],
      ["s2", this.s2],
    ];
  }
}

class TestChessfilesStorageLocal extends ChessfilesStorageLocal {
  constructor() {
    super(new MockLocalStorage());
  }

  async writeMetadata(
    trainingMeta: Record<string, TrainingMeta>,
    activity: Activity[],
  ) {
    await this.createFile(
      "/ChessfilesData.json",
      JSON.stringify({ trainingMeta, activity }),
    );
  }
}

function testBook(name: string): Book {
  const node = RootNode.fromInitialPosition(RootNodeType.Normal);
  node.headers.set("test-name", name);
  return new Book([node]);
}

type ActivityData =
  | Omit<TrainingActivity, "id" | "timestamp">
  | Omit<LibraryActivity, "id" | "timestamp">;

async function checkActivityData(
  storage: AppStorage,
  expected: ActivityData[],
) {
  const actualData = (await storage.listActivity()).map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ id, timestamp, ...data }) => data,
  );
  expect(actualData).toEqual(expected);
}

class TestAppStorage extends AppStorage {
  s1: ChessfilesStorageLocal;
  s2: ChessfilesStorageLocal;

  constructor(useEngines?: [ChessfilesStorageLocal, ChessfilesStorageLocal]) {
    const [s1, s2] = useEngines ?? [
      new TestChessfilesStorageLocal(),
      new TestChessfilesStorageLocal(),
    ];
    const engines = new TestStorageEngines(s1, s2);
    super(engines, "/");
    this.s1 = s1;
    this.s2 = s2;
  }

  async checkFiles(
    dir: string,
    expectedEntries: Record<string, string>,
  ): Promise<void> {
    await this.checkDirListing(dir, expectedEntries);
    for (const [filename, contents] of Object.entries(expectedEntries)) {
      if (contents == "dir" || contents == "engine") {
        continue;
      }
      await this.checkFileContents(joinPath(dir, filename), contents);
    }
  }

  async checkDirListing(
    path: string,
    expectedEntries: Record<string, string>,
  ): Promise<void> {
    const expectedFileTypes = new Map(
      Object.entries(expectedEntries).map(([name, contents]) => {
        if (contents == "dir") {
          return [name, "dir"];
        } else if (contents == "engine") {
          return [name, "engine"];
        } else {
          return [name, "file"];
        }
      }),
    );
    const appStorageListDir = new Map(
      (await this.listDir(path)).map((e) => [e.filename, e.type]),
    );
    expect(appStorageListDir).toEqual(expectedFileTypes);

    if (path.startsWith("/s1")) {
      path = path.slice(3);
      const engineListDir = new Map(
        (await this.s1.listDir(path))
          .filter((e) => e.filename != "ChessfilesData.json")
          .map((e) => [e.filename, e.type]),
      );
      expect(engineListDir).toEqual(expectedFileTypes);
    } else if (path.startsWith("/s2")) {
      path = path.slice(3);
      const engineListDir = new Map(
        (await this.s2.listDir(path))
          .filter((e) => e.filename != "ChessfilesData.json")
          .map((e) => [e.filename, e.type]),
      );
      expect(engineListDir).toEqual(expectedFileTypes);
    } else if (path == "/") {
      // Nothing to check here
    } else {
      throw Error(`Invalid path: ${path}`);
    }
  }

  async checkFileContents(path: string, expected: string): Promise<void> {
    expect(await this.readFile(path)).toEqual(expected);

    if (path.startsWith("/s1")) {
      path = path.slice(3);
      expect(await this.s1.readFile(path)).toEqual(expected);
    } else if (path.startsWith("/s2")) {
      path = path.slice(3);
      expect(await this.s2.readFile(path)).toEqual(expected);
    } else {
      throw Error(`Invalid path: ${path}`);
    }
  }

  async checkBooks(expected: Record<string, Book>) {
    const expectedData = new Map<string, Record<string, string>>();
    for (const [path, book] of Object.entries(expected)) {
      const [dir, filename] = splitPath(path);
      const entry = expectedData.get(dir);
      if (entry) {
        entry[filename] = book.export();
      } else {
        expectedData.set(dir, {});
      }
    }
    for (const [dir, expectedEntries] of expectedData) {
      for (const [filename, content] of Object.entries(expectedEntries)) {
        await this.checkFileContents(joinPath(dir, filename), content);
      }
    }

    const expectedTrainingMetas = Object.entries(expected)
      .filter(([, b]) => b.trainingMeta !== undefined && b.trainingMeta.active)
      .map(([bookPath, b]) => ({
        ...b.trainingMeta,
        bookPath,
      }));
    expect(new Set((await this.listTraining()).metas)).toEqual(
      new Set(expectedTrainingMetas),
    );
  }
}

/**
 * Test the `copy` and `move` functions
 */
describe("AppStorage", () => {
  let solidDispose: (() => void) | null = null;

  afterAll(() => {
    if (solidDispose) {
      solidDispose();
      solidDispose = null;
    }
  });

  function testAppStorage(
    useEngines?: [ChessfilesStorageLocal, ChessfilesStorageLocal],
  ): TestAppStorage {
    return createRoot((dispose) => {
      solidDispose = dispose;
      return new TestAppStorage(useEngines);
    });
  }

  test("initial load", async () => {
    const storage = testAppStorage();
    expect(await storage.listActivity()).toEqual([]);
    await storage.checkBooks({});
    await storage.checkFiles("/", {
      s1: "engine",
      s2: "engine",
    });
  });

  test("load with stored data", async () => {
    const book = testBook("MyBook");
    const training = book.getOrCreateTraining(
      defaultTrainingSettings(),
      "MyBook.pgn",
    );
    const activity = newLibraryActivity("MyBook.pgn", 1);
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    await s1.writeMetadata(
      {
        "/MyBook.pgn": training.meta,
      },
      [activity],
    );
    await s1.createFile("/MyBook.pgn", book.export());
    const storage = testAppStorage([s1, s2]);
    expect(await storage.listActivity()).toEqual([activity]);
    await storage.checkBooks({ "/s1/MyBook.pgn": book });
  });

  test("merge engine data", async () => {
    const book1 = testBook("MyBook");
    const activity1 = newLibraryActivity("MyBook.pgn", 1);
    const training1 = book1.getOrCreateTraining(
      defaultTrainingSettings(),
      "MyBook.pgn",
    );
    const book2 = testBook("MyOtherBook");
    const activity2 = newLibraryActivity("MyOtherBook.pgn", 2);
    const training2 = book2.getOrCreateTraining(
      defaultTrainingSettings(),
      "MyOtherBook.pgn",
    );
    const s1 = new TestChessfilesStorageLocal();
    await s1.writeMetadata(
      {
        "/MyBook.pgn": training1.meta,
      },
      [activity1],
    );
    await s1.createFile("/MyBook.pgn", book1.export());
    const s2 = new TestChessfilesStorageLocal();
    await s2.writeMetadata(
      {
        "/MyOtherBook.pgn": training2.meta,
      },
      [activity2],
    );
    await s2.createFile("/MyOtherBook.pgn", book2.export());

    const storage = testAppStorage([s1, s2]);
    expect(await storage.listActivity()).toEqual([activity2, activity1]);
    await storage.checkBooks({
      "/s1/MyBook.pgn": book1,
      "/s2/MyOtherBook.pgn": book2,
    });
  });

  test("saving books", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    const storage = testAppStorage([s1, s2]);
    const book = testBook("MyBook");

    // initial creation
    await storage.writeBook("/s2/MyBook.pgn", book);
    await storage.checkFiles("/s2", {
      "MyBook.pgn": book.export(),
    });
    await checkActivityData(storage, [
      {
        type: "library",
        filename: "MyBook.pgn",
      },
    ]);

    // updates
    book.rootNodes.push(RootNode.fromInitialPosition(RootNodeType.Normal));
    await storage.writeBook("/s2/MyBook.pgn", book);
    await storage.checkFiles("/s2", {
      "MyBook.pgn": book.export(),
    });
    await checkActivityData(storage, [
      {
        type: "library",
        filename: "MyBook.pgn",
      },
      {
        type: "library",
        filename: "MyBook.pgn",
      },
    ]);
  });

  test("saving training", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    const storage = testAppStorage([s1, s2]);

    // Save

    const book = new Book([
      RootNode.fromInitialPosition(RootNodeType.Training),
    ]);
    let training = book.getOrCreateTraining(
      defaultTrainingSettings(),
      "MyBook.pgn",
    );
    await storage.writeBook("/s1/MyBook.pgn", book);
    await storage.checkBooks({ "/s1/MyBook.pgn": book });
    expect((await storage.readBook("/s1/MyBook.pgn")).trainingMeta).toEqual(
      training.meta,
    );
    await checkActivityData(storage, [
      {
        type: "library",
        filename: "MyBook.pgn",
      },
    ]);

    // Update
    training = book.getOrCreateTraining(
      defaultTrainingSettings(),
      "MyBook.pgn",
    );
    training.activity.correctCount = 3;
    training.activity.incorrectCount = 2;
    training.activity.linesTrained = 4;
    training.meta.trainingCount += 1;
    await storage.updateTraining("/s1/MyBook.pgn", book, training);
    await storage.checkBooks({ "/s1/MyBook.pgn": book });
    await checkActivityData(storage, [
      {
        type: "library",
        filename: "MyBook.pgn",
      },
      {
        type: "training",
        name: "MyBook",
        linesTrained: 4,
        correctCount: 3,
        incorrectCount: 2,
      },
      {
        type: "library",
        filename: "MyBook.pgn",
      },
    ]);

    // Save without any new activity
    await storage.writeBook("/s1/MyBook.pgn", book);
    await storage.checkBooks({ "/s1/MyBook.pgn": book });
    await checkActivityData(storage, [
      {
        type: "library",
        filename: "MyBook.pgn",
      },
      {
        type: "library",
        filename: "MyBook.pgn",
      },
      {
        type: "training",
        name: "MyBook",
        linesTrained: 4,
        correctCount: 3,
        incorrectCount: 2,
      },
      {
        type: "library",
        filename: "MyBook.pgn",
      },
    ]);
  });

  test("remove training", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    const storage = testAppStorage([s1, s2]);

    let book = new Book([RootNode.fromInitialPosition(RootNodeType.Training)]);
    book.getOrCreateTraining(defaultTrainingSettings(), "MyBook.pgn");
    book.trainingMeta!.trainingCount = 1;

    await storage.writeBook("/s1/MyBook.pgn", book);

    await storage.removeTraining("/s1/MyBook.pgn");
    // The training session should be deleted, but the meta should still be there
    book = await storage.readBook("/s1/MyBook.pgn");
    expect(book.hasTrainingSession()).toEqual(false);
    expect(book.trainingMeta).not.toBe(undefined);
    expect(book.trainingMeta?.active).toEqual(false);
    expect(book.trainingMeta?.totalLines).toEqual(1);
    expect(book.trainingMeta?.trainingCount).toEqual(1);
    await storage.checkBooks({ "/s1/MyBook.pgn": book });
  });

  test("move single file", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    const book = testBook("MyBook");
    const training = book.getOrCreateTraining(
      defaultTrainingSettings(),
      "MyBook.pgn",
    );
    await s1.createFile("/MyBook.pgn", book.export());
    await s1.writeMetadata(
      {
        "/MyBook.pgn": training.meta,
      },
      [],
    );

    const storage = testAppStorage([s1, s2]);
    storage.setDir("/s1");
    await storage.move(
      [
        {
          filename: "MyBook.pgn",
          type: "file",
        },
      ],
      "/s2/",
      {},
    );
    await storage.checkBooks({ "/s2/MyBook.pgn": book });
  });

  test("copy single file", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    const book = testBook("MyBook");
    const training = book.getOrCreateTraining(
      defaultTrainingSettings(),
      "MyBook.pgn",
    );
    await s1.createFile("/MyBook.pgn", book.export());
    await s1.writeMetadata(
      {
        "/MyBook.pgn": training.meta,
      },
      [],
    );
    const storage = testAppStorage([s1, s2]);

    storage.setDir("/s1");
    await storage.copy(
      [
        {
          filename: "MyBook.pgn",
          type: "file",
        },
      ],
      "/s2/",
      {},
    );
    await storage.checkFiles("/s1", {
      "MyBook.pgn": book.export(),
    });
    await storage.checkFiles("/s2", {
      "MyBook.pgn": book.export(),
    });
    // The training data should stay with the source file
    await storage.checkBooks({
      "/s1/MyBook.pgn": book,
      "/s2/MyBook.pgn": book,
    });
  });

  test("delete file", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    const book = testBook("MyBook");
    const training = book.getOrCreateTraining(
      defaultTrainingSettings(),
      "MyBook.pgn",
    );
    await s1.createFile("/MyBook.pgn", book.export());
    await s1.writeMetadata(
      {
        "/MyBook.pgn": training.meta,
      },
      [],
    );
    const storage = testAppStorage([s1, s2]);

    storage.setDir("/s1");
    await storage.delete(
      [
        {
          filename: "MyBook.pgn",
          type: "file",
        },
      ],
      {},
    );
    await storage.checkFiles("/s1", {});
    await storage.checkFiles("/s2", {});
    await storage.checkBooks({});
  });

  test("move single directory", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    await s1.createDir("/My Openings");
    const storage = testAppStorage([s1, s2]);

    storage.setDir("/s1");
    await storage.move(
      [
        {
          filename: "My Openings",
          type: "dir",
        },
      ],
      "/s2/",
      {},
    );
    await storage.checkFiles("/s1", {});
    await storage.checkFiles("/s2", {
      "My Openings": "dir",
    });
    await storage.checkBooks({});
  });

  test("copy single directory", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    await s1.createDir("/My Openings");
    const storage = testAppStorage([s1, s2]);

    storage.setDir("/s1");
    await storage.copy(
      [
        {
          filename: "My Openings",
          type: "dir",
        },
      ],
      "/s2/",
      {},
    );
    await storage.checkFiles("/s1", {
      "My Openings": "dir",
    });
    await storage.checkFiles("/s2", {
      "My Openings": "dir",
    });
    await storage.checkBooks({});
  });

  test("move multiple files/directories", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();

    // Data that we move for this test
    await s1.createDir("/My Openings");
    const sicilian = testBook("sicilian");
    const sicilianTraining = sicilian.getOrCreateTraining(
      defaultTrainingSettings(),
      "Sicilian.pgn",
    );
    const london = testBook("london");
    await s1.createFile("/Sicilian.pgn", sicilian.export());
    await s1.createFile("/My Openings/London.pgn", london.export());

    // Data doesn't move
    await s1.createDir("/My Endgames");
    const kingAndPawn = testBook("king-and-pawn");
    await s1.createFile("/My Endgames/king-and-pawn.pgn", kingAndPawn.export());
    const kingsGambit = testBook("kings-gambit");
    const kingsGambitTraining = kingsGambit.getOrCreateTraining(
      defaultTrainingSettings(),
      "KingsGambit.pgn",
    );
    await s1.createFile("/KingsGambit.pgn", kingsGambit.export());

    await s1.writeMetadata(
      {
        "/Sicilian.pgn": sicilianTraining.meta,
        "/KingsGambit.pgn": kingsGambitTraining.meta,
      },
      [],
    );

    const storage = testAppStorage([s1, s2]);
    storage.setDir("/s1");
    await storage.move(
      [
        {
          filename: "My Openings",
          type: "dir",
        },
        {
          filename: "Sicilian.pgn",
          type: "file",
        },
      ],
      "/s2/",
      {},
    );
    await storage.checkFiles("/s1", {
      "My Endgames": "dir",
      "KingsGambit.pgn": kingsGambit.export(),
    });
    await storage.checkFiles("/s1/My Endgames", {
      "king-and-pawn.pgn": kingAndPawn.export(),
    });
    await storage.checkFiles("/s2", {
      "My Openings": "dir",
      "Sicilian.pgn": sicilian.export(),
    });
    await storage.checkFiles("/s2/My Openings", {
      "London.pgn": london.export(),
    });
    await storage.checkBooks({
      "/s1/KingsGambit.pgn": kingsGambit,
      "/s1/My Endgames/king-and-pawn.pgn": kingAndPawn,
      "/s2/Sicilian.pgn": sicilian,
      "/s2/My Openings/London.pgn": london,
    });
  });

  test("copy multiple files/directories", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();

    // Data that we copy for this test
    await s1.createDir("/My Openings");
    const sicilian = testBook("sicilian");
    const sicilianTraining = sicilian.getOrCreateTraining(
      defaultTrainingSettings(),
      "Sicilian.pgn",
    );
    const london = testBook("london");
    await s1.createFile("/Sicilian.pgn", sicilian.export());
    await s1.createFile("/My Openings/London.pgn", london.export());

    // Data doesn't get copied
    await s1.createDir("/My Endgames");
    const kingAndPawn = testBook("king-and-pawn");
    await s1.createFile("/My Endgames/king-and-pawn.pgn", kingAndPawn.export());
    const kingsGambit = testBook("kings-gambit");
    const kingsGambitTraining = kingsGambit.getOrCreateTraining(
      defaultTrainingSettings(),
      "KingsGambit.pgn",
    );
    await s1.createFile("/KingsGambit.pgn", kingsGambit.export());

    await s1.writeMetadata(
      {
        "/Sicilian.pgn": sicilianTraining.meta,
        "/KingsGambit.pgn": kingsGambitTraining.meta,
      },
      [],
    );

    const storage = testAppStorage([s1, s2]);
    storage.setDir("/s1");
    await storage.copy(
      [
        {
          filename: "My Openings",
          type: "dir",
        },
        {
          filename: "Sicilian.pgn",
          type: "file",
        },
      ],
      "/s2/",
      {},
    );
    await storage.checkFiles("/s1", {
      "My Openings": "dir",
      "My Endgames": "dir",
      "KingsGambit.pgn": kingsGambit.export(),
      "Sicilian.pgn": sicilian.export(),
    });
    await storage.checkFiles("/s1/My Openings", {
      "London.pgn": london.export(),
    });
    await storage.checkFiles("/s1/My Endgames", {
      "king-and-pawn.pgn": kingAndPawn.export(),
    });
    await storage.checkFiles("/s2", {
      "My Openings": "dir",
      "Sicilian.pgn": sicilian.export(),
    });
    await storage.checkFiles("/s2/My Openings", {
      "London.pgn": london.export(),
    });

    await storage.checkBooks({
      "/s1/KingsGambit.pgn": kingsGambit,
      "/s1/Sicilian.pgn": sicilian,
      "/s1/My Endgames/king-and-pawn.pgn": kingAndPawn,
      "/s2/Sicilian.pgn": sicilian,
      "/s2/My Openings/London.pgn": london,
    });
  });

  test("move path conflict: overwrite", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();

    await s1.createDir("/My Openings");
    await s1.createDir("/My Endgames");
    await s1.createFile("/foo.pgn", "foo-data");
    await s1.createFile("/My Openings/foo2.pgn", "foo2-data");
    await s2.createFile("/foo.pgn", "s2-foo-data");

    const storage = testAppStorage([s1, s2]);

    storage.setDir("/s1");
    await storage.move(
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
      "/s2/",
      {
        shouldOverwrite: () => Promise.resolve(true),
      },
    );
    await storage.checkFiles("/s1", {
      "My Endgames": "dir",
    });
    await storage.checkFiles("/s2/", {
      "My Openings": "dir",
      "foo.pgn": "foo-data",
    });
    await storage.checkFiles("/s2/My Openings", {
      "foo2.pgn": "foo2-data",
    });
  });

  test("copy path conflict: overwrite", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();

    await s1.createDir("/My Openings");
    await s1.createDir("/My Endgames");
    await s1.createFile("/foo.pgn", "foo-data");
    await s1.createFile("/My Openings/foo2.pgn", "foo2-data");
    await s2.createFile("/foo.pgn", "s2-foo-data");

    const storage = testAppStorage([s1, s2]);

    storage.setDir("/s1");
    await storage.copy(
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
      "/s2/",
      {
        shouldOverwrite: () => Promise.resolve(true),
      },
    );
    await storage.checkFiles("/s1", {
      "My Openings": "dir",
      "My Endgames": "dir",
      "foo.pgn": "foo-data",
    });
    await storage.checkFiles("/s1/My Openings", {
      "foo2.pgn": "foo2-data",
    });
    await storage.checkFiles("/s2/", {
      "My Openings": "dir",
      "foo.pgn": "foo-data",
    });
    await storage.checkFiles("/s2/My Openings", {
      "foo2.pgn": "foo2-data",
    });
  });

  test("move path conflict: skip", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();

    await s1.createDir("/My Openings");
    await s1.createDir("/My Endgames");
    await s1.createFile("/foo.pgn", "foo-data");
    await s1.createFile("/My Openings/foo2.pgn", "foo2-data");
    await s2.createFile("/foo.pgn", "s2-foo-data");

    const storage = testAppStorage([s1, s2]);

    storage.setDir("/s1");
    await storage.move(
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
      "/s2/",
      {
        shouldOverwrite: () => Promise.resolve(false),
      },
    );
    await storage.checkFiles("/s1", {
      "My Endgames": "dir",
      "foo.pgn": "foo-data",
    });
    await storage.checkFiles("/s2/", {
      "My Openings": "dir",
      "foo.pgn": "s2-foo-data",
    });
    await storage.checkFiles("/s2/My Openings", {
      "foo2.pgn": "foo2-data",
    });
  });

  test("copy path conflict: skip", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();

    await s1.createDir("/My Openings");
    await s1.createDir("/My Endgames");
    await s1.createFile("/foo.pgn", "foo-data");
    await s1.createFile("/My Openings/foo2.pgn", "foo2-data");
    await s2.createFile("/foo.pgn", "s2-foo-data");

    const storage = testAppStorage([s1, s2]);

    storage.setDir("/s1");
    await storage.copy(
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
      "/s2/",
      {
        shouldOverwrite: () => Promise.resolve(false),
      },
    );
    await storage.checkFiles("/s1", {
      "My Openings": "dir",
      "My Endgames": "dir",
      "foo.pgn": "foo-data",
    });
    await storage.checkFiles("/s1/My Openings", {
      "foo2.pgn": "foo2-data",
    });
    await storage.checkFiles("/s2/", {
      "My Openings": "dir",
      "foo.pgn": "s2-foo-data",
    });
    await storage.checkFiles("/s2/My Openings", {
      "foo2.pgn": "foo2-data",
    });
  });

  test("move inside same storage", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();

    const book = testBook("MyBook");
    const training = book.getOrCreateTraining(
      defaultTrainingSettings(),
      "MyBook.pgn",
    );
    await s1.createFile("/MyBook.pgn", book.export());
    await s1.createDir("/directory");
    await s1.writeMetadata(
      {
        "/MyBook.pgn": training.meta,
      },
      [],
    );

    const storage = testAppStorage([s1, s2]);

    storage.setDir("/s1");
    await storage.move(
      [
        {
          filename: "MyBook.pgn",
          type: "file",
        },
      ],
      "/s1/directory",
      {},
    );
    await storage.checkFiles("/s1", {
      directory: "dir",
    });
    await storage.checkFiles("/s1/directory", {
      "MyBook.pgn": book.export(),
    });
    await storage.checkBooks({
      "/s1/directory/MyBook.pgn": book,
    });
  });

  test("move inside source dir", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();

    const book = testBook("MyBook");
    const training = book.getOrCreateTraining(
      defaultTrainingSettings(),
      "MyBook.pgn",
    );
    await s1.createDir("/directory");
    await s1.createDir("/directory/subdirectory");
    await s1.createFile("/directory/MyBook.pgn", book.export());
    await s1.writeMetadata(
      {
        "/directory/MyBook.pgn": training.meta,
      },
      [],
    );

    const storage = testAppStorage([s1, s2]);

    storage.setDir("/s1/directory");
    await storage.move(
      [
        {
          filename: "MyBook.pgn",
          type: "file",
        },
      ],
      "/s1/directory/subdirectory",
      {},
    );
    await storage.checkFiles("/s1", {
      directory: "dir",
    });
    await storage.checkFiles("/s1/directory", {
      subdirectory: "dir",
    });
    await storage.checkFiles("/s1/directory/subdirectory", {
      "MyBook.pgn": book.export(),
    });
    await storage.checkBooks({
      "/s1/directory/subdirectory/MyBook.pgn": book,
    });
  });
});
