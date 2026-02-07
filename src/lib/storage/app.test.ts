import { createRoot } from "solid-js";
import { afterAll, describe, test, expect } from "vitest";
import type { ChessfilesStorage } from ".";
import { AppStorage, ChessfilesStorageLocal, filename, joinPath } from ".";
import { MockLocalStorage } from "./testutils";
import type { Activity, LibraryActivity } from "~/lib/activity";
import { newLibraryActivity, newTrainingActivity } from "~/lib/activity";
import type { TrainingHistory } from "~/lib/node";
import { Book, RootNode, RootNodeType } from "~/lib/node";
import type { TrainingMeta } from "~/lib/training";
import { defaultTrainingSettings, Training } from "~/lib/training";

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

  async checkTrainingFilenames(expected: string[]) {
    const entries = await this.listDir("/ChessfilesTraining");
    expect(entries.map((e) => e.filename)).toEqual(expected);
  }

  async writeMetadata(
    trainingMeta: Record<string, TrainingMeta>,
    trainingHistory: Record<string, TrainingHistory>,
    activity: Activity[],
  ) {
    await this.createFile(
      "/ChessfilesData.json",
      JSON.stringify({ trainingMeta, trainingHistory, activity }),
    );
  }
}

function testBook(name: string): Book {
  const node = RootNode.fromInitialPosition(RootNodeType.Normal);
  node.headers.set("test-name", name);
  return new Book([node], {
    added: 1000,
    lastTrained: 2000,
    trainingCount: 10,
  });
}

function testTraining(
  bookPath: string,
  book: Book,
  trainingFilename: string,
): Training {
  let trainingDir;
  if (bookPath.startsWith("/s1")) {
    trainingDir = `/s1/ChessfilesTraining/`;
  } else if (bookPath.startsWith("/s2")) {
    trainingDir = `/s2/ChessfilesTraining/`;
  } else {
    throw Error(`invalid book path: ${bookPath}`);
  }

  return Training.create(
    defaultTrainingSettings(),
    bookPath,
    book,
    trainingDir,
    trainingFilename,
  );
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
          .filter(
            (e) =>
              e.filename != "ChessfilesData.json" &&
              e.filename != "ChessfilesTraining",
          )
          .map((e) => [e.filename, e.type]),
      );
      expect(engineListDir).toEqual(expectedFileTypes);
    } else if (path.startsWith("/s2")) {
      path = path.slice(3);
      const engineListDir = new Map(
        (await this.s2.listDir(path))
          .filter(
            (e) =>
              e.filename != "ChessfilesData.json" &&
              e.filename != "ChessfilesTraining",
          )
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

  async checkTraining(expected: { s1: Training[]; s2: Training[] }) {
    expect(new Set((await this.listTraining()).metas)).toEqual(
      new Set(expected.s1.concat(expected.s2).map((training) => training.meta)),
    );
    await this.checkFiles(
      "/s1/ChessfilesTraining",
      Object.fromEntries(
        expected.s1.map((training) => [
          filename(training.meta.trainingBookPath),
          training.exportPgn(),
        ]),
      ),
    );
    await this.checkFiles(
      "/s2/ChessfilesTraining",
      Object.fromEntries(
        expected.s2.map((training) => [
          filename(training.meta.trainingBookPath),
          training.exportPgn(),
        ]),
      ),
    );
  }

  async checkTrainingHistory(expected: {
    s1: Record<string, TrainingHistory>;
    s2: Record<string, TrainingHistory>;
  }) {
    if (await this.s1.exists("/ChessfilesData.json")) {
      const s1 = JSON.parse(await this.s1.readFile("/ChessfilesData.json"));
      expect(s1.trainingHistory).toEqual(expected.s1);
    } else {
      expect({}).toEqual(expected.s1);
    }

    if (await this.s2.exists("/ChessfilesData.json")) {
      const s2 = JSON.parse(await this.s2.readFile("/ChessfilesData.json"));
      expect(s2.trainingHistory).toEqual(expected.s2);
    } else {
      expect({}).toEqual(expected.s2);
    }
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
    await storage.checkTraining({ s1: [], s2: [] });
    await storage.checkFiles("/", {
      s1: "engine",
      s2: "engine",
    });
  });

  test("load with stored data", async () => {
    const book = testBook("MyBook");
    const training = testTraining("/s1/MyBook.pgn", book, "training-1.pgn");
    const activity = newLibraryActivity("MyBook.pgn", 1);
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    await s1.writeMetadata(
      {
        "/s1/ChessfilesTraining/training-1.pgn": training.meta,
      },
      {
        "/s1/MyBook.pgn": book.trainingHistory,
      },
      [activity],
    );
    await s1.createDir("/ChessfilesTraining");
    await s1.createFile(
      "/ChessfilesTraining/training-1.pgn",
      training.exportPgn(),
    );
    const storage = testAppStorage([s1, s2]);
    expect(await storage.listActivity()).toEqual([activity]);
    await storage.checkTraining({ s1: [training], s2: [] });
    await storage.checkTrainingHistory({
      s1: {
        "/s1/MyBook.pgn": book.trainingHistory,
      },
      s2: {},
    });
  });

  test("merge engine data", async () => {
    const book1 = testBook("MyBook");
    const activity1 = newLibraryActivity("MyBook.pgn", 1);
    const training1 = testTraining("/s1/MyBook.pgn", book1, "training-1.pgn");
    const book2 = testBook("MyOtherBook");
    const activity2 = newLibraryActivity("MyOtherBook.pgn", 2);
    const training2 = testTraining(
      "/s2/MyOtherBook.pgn",
      book2,
      "training-2.pgn",
    );
    const s1 = new TestChessfilesStorageLocal();
    await s1.writeMetadata(
      {
        "/s1/ChessfilesTraining/training-1.pgn": training1.meta,
      },
      {},
      [activity1],
    );
    await s1.createDir("/ChessfilesTraining");
    await s1.createFile(
      "/ChessfilesTraining/training-1.pgn",
      training1.exportPgn(),
    );
    const s2 = new TestChessfilesStorageLocal();
    await s2.writeMetadata(
      {
        "/s2/ChessfilesTraining/training-2.pgn": training2.meta,
      },
      {},
      [activity2],
    );
    await s2.createDir("/ChessfilesTraining");
    await s2.createFile(
      "/ChessfilesTraining/training-2.pgn",
      training2.exportPgn(),
    );

    const storage = testAppStorage([s1, s2]);
    expect(await storage.listActivity()).toEqual([activity2, activity1]);
    await storage.checkTraining({ s1: [training1], s2: [training2] });
  });

  test("invalid training meta", async () => {
    const book = testBook("MyBook");
    const training = testTraining("/s1/MyBook.pgn", book, "training-1.pgn");
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    await s1.writeMetadata(
      {
        "/s1/ChessfilesTraining/training-1.pgn": training.meta,
        // TrainingMeta entry that doesn't have a corresponding PGN file on disk
        "/s1/ChessfilesTraining/training-2.pgn": {
          trainingBookPath: "/s1/ChessfilesTraining/training-2.pgn",
          sourceBookPath: "/s1/does-not-exist.pgn",
          name: "MyBook2",
          correctCount: 1,
          incorrectCount: 2,
          linesTrained: 3,
          totalLines: 4,
          lastTrained: 1,
        },
      },
      {},
      [],
    );
    await s1.createDir("/ChessfilesTraining");
    await s1.createFile(
      "/ChessfilesTraining/training-1.pgn",
      training.exportPgn(),
    );
    // Training file with no corresponding TrainingMeta
    await s1.createFile(
      "/ChessfilesTraining/training-with-no-meta.pgn",
      "Fake training data",
    );

    const storage = testAppStorage([s1, s2]);
    await storage.checkTraining({ s1: [training], s2: [] });
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
    const activity = await storage.listActivity();
    expect(activity.length).toEqual(1);
    expect(activity[0].type).toEqual("library");
    expect((activity[0] as LibraryActivity).filename).toEqual("MyBook.pgn");

    // updates
    book.rootNodes.push(RootNode.fromInitialPosition(RootNodeType.Normal));
    await storage.writeBook("/s2/MyBook.pgn", book);
    await storage.checkFiles("/s2", {
      "MyBook.pgn": book.export(),
    });
    const activity2 = await storage.listActivity();
    expect(activity2.length).toEqual(2);
    expect(activity2[0].type).toEqual("library");
    expect((activity2[0] as LibraryActivity).filename).toEqual("MyBook.pgn");
    expect(await storage.listTrainingHistory()).toEqual([book.trainingHistory]);
  });

  test("saving training", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    const book = new Book([
      RootNode.fromInitialPosition(RootNodeType.Training),
    ]);
    await s2.createFile("/MyBook.pgn", book.export());

    const storage = testAppStorage([s1, s2]);

    // Initial creation
    const training = await storage.createOrLoadTraining("/s2/MyBook.pgn");
    await storage.checkFiles("/s2/ChessfilesTraining", {
      [filename(training.meta.trainingBookPath)]: training.exportPgn(),
    });

    expect(await storage.listActivity()).toEqual([]);
    const activity = {
      ...newTrainingActivity("MyBook", 1),
      correctCount: 4,
      incorrectCount: 1,
      linesTrained: 2,
    };

    training.activity = activity;

    // Update
    await storage.updateTraining(training);

    expect(await storage.listActivity()).toEqual([activity]);

    // Update without any new activity
    training.activity = newTrainingActivity("MyBook", 1);
    await storage.updateTraining(training);

    await storage.checkFiles("/s2/ChessfilesTraining", {
      [filename(training.meta.trainingBookPath)]: training.exportPgn(),
    });

    expect(await storage.listActivity()).toEqual([activity]);
  });

  test("remove training", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    const book = new Book([
      RootNode.fromInitialPosition(RootNodeType.Training),
    ]);
    await s2.createFile("/MyBook.pgn", book.export());

    const storage = testAppStorage([s1, s2]);

    const training = await storage.createOrLoadTraining("/s2/MyBook.pgn");
    await storage.checkFiles("/s2/ChessfilesTraining", {
      [filename(training.meta.trainingBookPath)]: training.exportPgn(),
    });

    await storage.updateTraining(training);
    await storage.removeTraining(training.meta);
    await storage.checkTraining({ s1: [], s2: [] });
    await storage.checkFiles("/s2/ChessfilesTraining", {});
  });

  test("load existing training", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    const book = new Book([
      RootNode.fromInitialPosition(RootNodeType.Training),
    ]);
    await s2.createFile("/MyBook.pgn", book.export());

    const storage = testAppStorage([s1, s2]);

    await storage.createOrLoadTraining("/s2/MyBook.pgn");
    const training = await storage.createOrLoadTraining("/s2/MyBook.pgn");
    await storage.checkFiles("/s2/ChessfilesTraining", {
      [filename(training.meta.trainingBookPath)]: training.exportPgn(),
    });
  });

  test("move single file", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    const book = testBook("MyBook");
    const training = testTraining("/s1/MyBook.pgn", book, "training.pgn");
    await s1.createFile("/MyBook.pgn", book.export());
    await s1.createDir("/ChessfilesTraining");
    await s1.createFile(
      "/ChessfilesTraining/training.pgn",
      training.exportPgn(),
    );
    await s1.writeMetadata(
      {
        "/s1/ChessfilesTraining/training.pgn": training.meta,
      },
      {
        "/s1/MyBook.pgn": book.trainingHistory,
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
    await storage.checkFiles("/s1", {});
    await storage.checkFiles("/s2", {
      "MyBook.pgn": book.export(),
    });
    training.meta.sourceBookPath = "/s2/MyBook.pgn";
    training.meta.trainingBookPath = "/s2/ChessfilesTraining/training.pgn";
    // The training data should have moved from s1 to s2
    await storage.checkTraining({ s1: [], s2: [training] });
    await storage.checkTrainingHistory({
      s1: {},
      s2: {
        "/s2/MyBook.pgn": book.trainingHistory,
      },
    });
  });

  test("copy single file", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    const book = testBook("MyBook");
    const training = testTraining("/s1/MyBook.pgn", book, "training.pgn");
    await s1.createFile("/MyBook.pgn", book.export());
    await s1.createDir("/ChessfilesTraining");
    await s1.createFile(
      "/ChessfilesTraining/training.pgn",
      training.exportPgn(),
    );
    await s1.writeMetadata(
      {
        "/s1/ChessfilesTraining/training.pgn": training.meta,
      },
      {
        "/s1/MyBook.pgn": book.trainingHistory,
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
    await storage.checkTraining({ s1: [training], s2: [] });

    // The training history should be copied
    await storage.checkTrainingHistory({
      s1: {
        "/s1/MyBook.pgn": book.trainingHistory,
      },
      s2: {
        "/s2/MyBook.pgn": book.trainingHistory,
      },
    });
  });

  test("delete file", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();
    const book = testBook("MyBook");
    const training = testTraining("/s1/MyBook.pgn", book, "training.pgn");
    await s1.createFile("/MyBook.pgn", book.export());
    await s1.createDir("/ChessfilesTraining");
    await s1.createFile(
      "/ChessfilesTraining/training.pgn",
      training.exportPgn(),
    );
    await s1.writeMetadata(
      {
        "/s1/ChessfilesTraining/training.pgn": training.meta,
      },
      {
        "/s1/MyBook.pgn": book.trainingHistory,
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
    await storage.checkTraining({ s1: [], s2: [] });
    await storage.checkTrainingHistory({ s1: {}, s2: {} });
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
  });

  test("move single directory", async () => {
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
  });

  test("move multiple files/directories", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();

    // Data that we move for this test
    await s1.createDir("/My Openings");
    const sicilian = testBook("sicilian");
    const sicilianTraining = testTraining(
      "/s1/Sicilian.pgn",
      sicilian,
      "training-sicilian.pgn",
    );
    const london = testBook("london");
    await s1.createFile("/Sicilian.pgn", sicilian.export());
    await s1.createFile("/My Openings/London.pgn", london.export());
    await s1.createDir("/ChessfilesTraining/");
    await s1.createFile(
      "/ChessfilesTraining/training-sicilian.pgn",
      sicilianTraining.exportPgn(),
    );

    // Data doesn't move
    await s1.createDir("/My Endgames");
    const kingAndPawn = testBook("king-and-pawn");
    await s1.createFile("/My Endgames/king-and-pawn.pgn", kingAndPawn.export());
    const kingsGambit = testBook("kings-gambit");
    const kingsGambitTraining = testTraining(
      "/s1/KingsGambit.pgn",
      kingsGambit,
      "training-kings-gambit.pgn",
    );
    await s1.createFile("/KingsGambit.pgn", kingsGambit.export());
    await s1.createFile(
      "/ChessfilesTraining/training-kings-gambit.pgn",
      kingsGambitTraining.exportPgn(),
    );

    await s1.writeMetadata(
      {
        "/s1/ChessfilesTraining/training-sicilian.pgn": sicilianTraining.meta,
        "/s1/ChessfilesTraining/training-kings-gambit.pgn":
          kingsGambitTraining.meta,
      },
      {
        "/s1/Sicilian.pgn": sicilian.trainingHistory,
        "/s1/KingsGambit.pgn": kingsGambit.trainingHistory,
        "/s1/My Openings/London.pgn": london.trainingHistory,
        "/s1/My Endgames/king-and-pawn.pgn": kingAndPawn.trainingHistory,
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
    sicilianTraining.meta.sourceBookPath = "/s2/Sicilian.pgn";
    sicilianTraining.meta.trainingBookPath =
      "/s2/ChessfilesTraining/training-sicilian.pgn";
    await storage.checkTraining({
      s1: [kingsGambitTraining],
      s2: [sicilianTraining],
    });

    // The training history should be moved
    await storage.checkTrainingHistory({
      s1: {
        "/s1/KingsGambit.pgn": kingsGambit.trainingHistory,
        "/s1/My Endgames/king-and-pawn.pgn": kingAndPawn.trainingHistory,
      },
      s2: {
        "/s2/Sicilian.pgn": sicilian.trainingHistory,
        "/s2/My Openings/London.pgn": london.trainingHistory,
      },
    });
  });

  test("copy multiple files/directories", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();

    // Data that we copy for this test
    await s1.createDir("/My Openings");
    const sicilian = testBook("sicilian");
    const sicilianTraining = testTraining(
      "/s1/Sicilian.pgn",
      sicilian,
      "training-sicilian.pgn",
    );
    const london = testBook("london");
    await s1.createFile("/Sicilian.pgn", sicilian.export());
    await s1.createFile("/My Openings/London.pgn", london.export());
    await s1.createDir("/ChessfilesTraining/");
    await s1.createFile(
      "/ChessfilesTraining/training-sicilian.pgn",
      sicilianTraining.exportPgn(),
    );

    // Data doesn't get copied
    await s1.createDir("/My Endgames");
    const kingAndPawn = testBook("king-and-pawn");
    await s1.createFile("/My Endgames/king-and-pawn.pgn", kingAndPawn.export());
    const kingsGambit = testBook("kings-gambit");
    const kingsGambitTraining = testTraining(
      "/s1/KingsGambit.pgn",
      kingsGambit,
      "training-kings-gambit.pgn",
    );
    await s1.createFile("/KingsGambit.pgn", kingsGambit.export());
    await s1.createFile(
      "/ChessfilesTraining/training-kings-gambit.pgn",
      kingsGambitTraining.exportPgn(),
    );

    await s1.writeMetadata(
      {
        "/s1/ChessfilesTraining/training-sicilian.pgn": sicilianTraining.meta,
        "/s1/ChessfilesTraining/training-kings-gambit.pgn":
          kingsGambitTraining.meta,
      },
      {
        "/s1/Sicilian.pgn": sicilian.trainingHistory,
        "/s1/KingsGambit.pgn": kingsGambit.trainingHistory,
        "/s1/My Openings/London.pgn": london.trainingHistory,
        "/s1/My Endgames/king-and-pawn.pgn": kingAndPawn.trainingHistory,
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
    await storage.checkTraining({
      s1: [kingsGambitTraining, sicilianTraining],
      s2: [],
    });

    // The training history should be copied
    await storage.checkTrainingHistory({
      s1: {
        "/s1/KingsGambit.pgn": kingsGambit.trainingHistory,
        "/s1/Sicilian.pgn": sicilian.trainingHistory,
        "/s1/My Endgames/king-and-pawn.pgn": kingAndPawn.trainingHistory,
        "/s1/My Openings/London.pgn": london.trainingHistory,
      },
      s2: {
        "/s2/Sicilian.pgn": sicilian.trainingHistory,
        "/s2/My Openings/London.pgn": london.trainingHistory,
      },
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
    const training = testTraining("/s1/MyBook.pgn", book, "training-1.pgn");
    await s1.createFile("/MyBook.pgn", book.export());
    await s1.createDir("/ChessfilesTraining");
    await s1.createFile(
      "/ChessfilesTraining/training-1.pgn",
      training.exportPgn(),
    );
    await s1.createDir("/directory");
    await s1.writeMetadata(
      {
        "/s1/ChessfilesTraining/training-1.pgn": training.meta,
      },
      {},
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
    training.meta.sourceBookPath = "/s1/directory/MyBook.pgn";
    await storage.checkTraining({ s1: [training], s2: [] });
  });

  test("move inside source dir", async () => {
    const s1 = new TestChessfilesStorageLocal();
    const s2 = new TestChessfilesStorageLocal();

    const book = testBook("MyBook");
    const training = testTraining(
      "/s1/directory/MyBook.pgn",
      book,
      "training-1.pgn",
    );
    await s1.createDir("/directory");
    await s1.createDir("/directory/subdirectory");
    await s1.createFile("/directory/MyBook.pgn", book.export());
    await s1.createDir("/ChessfilesTraining");
    await s1.createFile(
      "/ChessfilesTraining/training-1.pgn",
      training.exportPgn(),
    );
    await s1.writeMetadata(
      {
        "/s1/ChessfilesTraining/training-1.pgn": training.meta,
      },
      {},
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
    training.meta.sourceBookPath = "/s1/directory/subdirectory/MyBook.pgn";
    await storage.checkTraining({ s1: [training], s2: [] });
  });
});
