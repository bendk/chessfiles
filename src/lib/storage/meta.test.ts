import { describe, test, expect } from "vitest";

import { ChessfilesStorageLocal } from "./local";
import { AppMetaManager } from "./meta";
import { newLibraryActivity } from "~/lib/activity";
import type { TrainingMeta } from "~/lib/training";

async function trainingFiles(s: ChessfilesStorageLocal): Promise<string[]> {
  const entries = await s.listDir("/ChessfilesTraining");
  return entries.map((e) => e.filename);
}

class MockLocalStorage {
  private data: Map<string, string> = new Map;

  get length() {
    return this.data.size
  }

  key(index: number): string|null {
    const iter = this.data.keys();
    for (var i = 0; i < index; i++) {
      iter.next();
    }
    return iter.next().value ?? null
  }

  getItem(key: string): string|null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.data.set(key, value)
  }

  removeItem(key: string) {
    this.data.delete(key)
  }

  clear() {
    this.data.clear();
  }
}

function trainingMeta(storageName: string, trainingFilename: string, bookName: string, lastTrained: number): TrainingMeta {
  return {
    trainingBookPath: `/${storageName}/ChessfilesTraining/${trainingFilename}`,
    sourceBookPath: `/${storageName}/${bookName}.pgn`,
    name: bookName,
    correctCount: 1,
    incorrectCount: 2,
    linesTrained: 3,
    totalLines: 4,
    lastTrained,
  }
}

describe("StorageMeta", function () {
  test("initial load", async () => {
    const s = new ChessfilesStorageLocal(new MockLocalStorage());
    const metaManager = await AppMetaManager.load([
      ["storage1", s],
    ]);
    expect(metaManager.listActivity()).toEqual([]);
    expect(metaManager.listTraining()).toEqual([]);
  });

  test("load with stored data", async () => {
    const meta1 = trainingMeta("storage1", "training-1.pgn", "MyBook", 100);
    const activity = newLibraryActivity("MyBook.pgn", 1);
    const s = new ChessfilesStorageLocal(new MockLocalStorage());
    s.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [ meta1 ],
      activity: [activity],
    }));
    s.createDir("/ChessfilesTraining");
    s.createFile("/ChessfilesTraining/training-1.pgn", "Fake training data");

    const metaManager = await AppMetaManager.load([
      ["storage1", s],
    ]);
    expect(metaManager.listActivity()).toEqual([activity]);
    expect(metaManager.listTraining()).toEqual([meta1]);
  });

  test("merge engine data", async () => {
    const meta1 = trainingMeta("storage1", "training-1.pgn", "MyBook", 100);
    const meta2 = trainingMeta("storage2", "training-2.pgn", "MyOtherBook", 200);
    const activity1 = newLibraryActivity("MyBook.pgn", 1);
    const activity2 = newLibraryActivity("MyOtherBook.pgn", 2);
    const s1 = new ChessfilesStorageLocal(new MockLocalStorage());
    await s1.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [meta1],
      activity: [activity1],
    }));
    await s1.createDir("/ChessfilesTraining");
    await s1.createFile("/ChessfilesTraining/training-1.pgn", "Fake training data");

    const s2 = new ChessfilesStorageLocal(new MockLocalStorage());
    await s2.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [meta2],
      activity: [activity2],
    }));
    await s2.createDir("/ChessfilesTraining");
    await s2.createFile("/ChessfilesTraining/training-2.pgn", "Fake training data");

    const metaManager = await AppMetaManager.load([
      ["storage1", s1],
      ["storage2", s2],
    ]);
    expect(metaManager.listActivity()).toEqual([activity2, activity1]);
    expect(metaManager.listTraining()).toEqual([meta2, meta1]);
  });

  test("invalid training meta", async () => {
    const meta1 = trainingMeta("storage1", "training-1.pgn", "MyBook", 100);
    const s = new ChessfilesStorageLocal(new MockLocalStorage());
    s.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [
        meta1,
        // TrainingMeta entry that doesn't have a corresponding PGN file on disk
        trainingMeta("storage1", "non-existent-filename.pgn", "MyBook2", 200),
      ],
    }));
    s.createDir("/ChessfilesTraining");
    s.createFile("/ChessfilesTraining/training-1.pgn", "Fake training data");
    // Training file with no corresponding TrainingMeta
    s.createFile("/ChessfilesTraining/training-with-no-meta.pgn", "Fake training data");

    const metaManager = await AppMetaManager.load([
      ["storage1", s],
    ]);
    expect(metaManager.listTraining()).toEqual([meta1]);
    // Make training-with-no-meta.pgn should be deleted during load
    expect(await trainingFiles(s)).toEqual(["training-1.pgn"]);
  });

  test("addActivity", async () => {
    const s = new ChessfilesStorageLocal(new MockLocalStorage());
    const activity = newLibraryActivity("MyBook.pgn", 1);
    s.createFile("/ChessfilesData.json", JSON.stringify({
      activity: [activity],
    }));

    const metaManager = await AppMetaManager.load([
      ["storage1", s],
    ]);

    // Add new activity entry
    const activity2 = newLibraryActivity("MyOtherBook.pgn", 2);
    metaManager.addActivity(activity2, "/storage1/MyOtherBook.pgn")
    expect(metaManager.listActivity()).toEqual([activity2, activity]);
  });

  test("saveTrainingMeta", async () => {
    const meta = trainingMeta("storage1", "training-1.pgn", "MyBook", 100);
    const s = new ChessfilesStorageLocal(new MockLocalStorage());
    s.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [meta],
      activity: [],
    }));
    s.createDir("/ChessfilesTraining");
    s.createFile("/ChessfilesTraining/training-1.pgn", "Fake training data");

    const metaManager = await AppMetaManager.load([
      ["storage1", s],
    ]);

    const newTrainingMeta = trainingMeta("storage1", "training-2.pgn", "MyOtherBook", 200);
    await metaManager.saveTrainingMeta(newTrainingMeta);

    const updatedTrainingMeta = {
      ...meta,
      correctCount: 2,
      incorrectCount: 2,
      linesTrained: 3,
      totalLines: 4,
      lastTrained: 300,
    }
    await metaManager.saveTrainingMeta(updatedTrainingMeta);

    expect(metaManager.listTraining()).toEqual([
      updatedTrainingMeta, newTrainingMeta,
    ]);
  });

  test("removeTraining", async () => {
    const meta = trainingMeta("storage1", "training-1.pgn", "MyBook", 100);
    const s = new ChessfilesStorageLocal(new MockLocalStorage());
    s.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [meta],
      activity: [],
    }));
    s.createDir("/ChessfilesTraining");
    s.createFile("/ChessfilesTraining/training-1.pgn", "Fake training data");

    const metaManager = await AppMetaManager.load([
      ["storage1", s],
    ]);
    await metaManager.removeTrainingMeta(meta)
    expect(metaManager.listTraining()).toEqual([]);
    expect(await trainingFiles(s)).toEqual([]);
  });

  test("files deleted", async () => {
    const meta = trainingMeta("storage1", "training-1.pgn", "MyBook", 100);
    const s1 = new ChessfilesStorageLocal(new MockLocalStorage());
    await s1.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [meta],
      activity: [],
    }));
    await s1.createDir("/ChessfilesTraining");
    await s1.createFile("/ChessfilesTraining/training-1.pgn", "Fake training data");
    const s2 = new ChessfilesStorageLocal(new MockLocalStorage());

    const metaManager = await AppMetaManager.load([
      ["storage1", s1],
      ["storage2", s2],
    ]);
    expect(metaManager.listTraining()).toEqual([meta]);

    // Deleting books with no associated training should be a no-op
    await metaManager.onFilesDeleted([
      "/storage1/MyOtherBook.pgn",
      "/storage2/MyBook.pgn",
    ]);
    expect(metaManager.listTraining()).toEqual([meta]);

    // Deleting books for a training should cause the training to be deleted
    await metaManager.onFilesDeleted([
      "/storage1/MyBook.pgn",
    ]);
    expect(metaManager.listTraining()).toEqual([]);
  });

  test("files moved", async () => {
    const meta = trainingMeta("storage1", "training-1.pgn", "MyBook", 100);
    const s1 = new ChessfilesStorageLocal(new MockLocalStorage());
    await s1.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [meta],
      activity: [],
    }));
    await s1.createDir("/ChessfilesTraining");
    await s1.createFile("/ChessfilesTraining/training-1.pgn", "Fake training data");

    const metaManager = await AppMetaManager.load([
      ["storage1", s1],
    ]);
    expect(metaManager.listTraining()).toEqual([meta]);

    // Moving books with no associated training should be a no-op
    await metaManager.onFilesMoved([
      ["/storage1/RandomBook.pgn", "/storage1/Openings/RandomBook.pgn"],
    ]);
    expect(metaManager.listTraining()).toEqual([meta]);

    // Moving books should updated the `sourceBookPath`
    await metaManager.onFilesMoved([
      ["/storage1/MyBook.pgn", "/storage1/Openings/MyNewBookName.pgn"],
    ]);
    expect(metaManager.listTraining()).toEqual([
      {
        ...meta,
        sourceBookPath: "/storage1/Openings/MyNewBookName.pgn",
      }
    ]);
  });

  test("files moved between storages", async () => {
    const meta = trainingMeta("storage1", "training-1.pgn", "MyBook", 100);
    const s1 = new ChessfilesStorageLocal(new MockLocalStorage());
    await s1.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [meta],
      activity: [],
    }));
    await s1.createDir("/ChessfilesTraining");
    await s1.createFile("/ChessfilesTraining/training-1.pgn", "Fake training data");
    await s1.createFile("/MyBook.pgn", "fake book data");
    const s2 = new ChessfilesStorageLocal(new MockLocalStorage());

    const metaManager = await AppMetaManager.load([
      ["storage1", s1],
      ["storage2", s2],
    ]);

    await metaManager.onFilesMoved([
      ["/storage1/MyBook.pgn", "/storage2/MyBook.pgn"],
    ]);
    const expectedNewMeta = {
        ...meta,
        sourceBookPath: "/storage2/MyBook.pgn",
        trainingBookPath: "/storage2/ChessfilesTraining/training-1.pgn",
    }
    expect(metaManager.listTraining()).toEqual([expectedNewMeta]);
    // The training meta should be in `s2` now, since that's where the book file is
    expect(JSON.parse(await s1.readFile("/ChessfilesData.json")).trainingMeta).toEqual([]);
    expect(JSON.parse(await s2.readFile("/ChessfilesData.json")).trainingMeta).toEqual([expectedNewMeta]);

    // The training files assocated with the moved book should also move to the new storages
    expect(await trainingFiles(s1)).toEqual([]);
    expect(await trainingFiles(s2)).toEqual(["training-1.pgn"]);
  });

  test("bulk file moves", async () => {
    const meta1 = trainingMeta("storage1", "training-1.pgn", "MyBook1", 100);
    const meta2 = trainingMeta("storage1", "training-2.pgn", "MyBook2", 101);
    const meta3 = trainingMeta("storage1", "training-3.pgn", "MyBook3", 102);
    const meta4 = trainingMeta("storage2", "training-4.pgn", "MyBook4", 103);
    const meta5 = trainingMeta("storage2", "training-5.pgn", "MyBook5", 104);
    const meta6 = trainingMeta("storage2", "training-6.pgn", "MyBook6", 105);
    const s1 = new ChessfilesStorageLocal(new MockLocalStorage());
    await s1.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [
        meta1, // This will not move
        meta2, // This will move, but stay on s1
        meta3, // This will move to s2
      ],
      activity: [],
    }));
    await s1.createDir("/ChessfilesTraining");
    await s1.createFile("/ChessfilesTraining/training-1.pgn", "Fake training data");
    await s1.createFile("/ChessfilesTraining/training-2.pgn", "Fake training data");
    await s1.createFile("/ChessfilesTraining/training-3.pgn", "Fake training data");

    const s2 = new ChessfilesStorageLocal(new MockLocalStorage());
    await s2.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [
        meta4, // This will move, but stay on s2
        meta5, // This will move to s1
        meta6, // This will not move
      ],
      activity: [],
    }));
    await s2.createDir("/ChessfilesTraining");
    await s2.createFile("/ChessfilesTraining/training-4.pgn", "Fake training data");
    await s2.createFile("/ChessfilesTraining/training-5.pgn", "Fake training data");
    await s2.createFile("/ChessfilesTraining/training-6.pgn", "Fake training data");

    const metaManager = await AppMetaManager.load([
      ["storage1", s1],
      ["storage2", s2],
    ]);

    await metaManager.onFilesMoved([
      ["/storage1/MyBook2.pgn", "/storage1/Openings/MyBook2.pgn"],
      ["/storage1/MyBook3.pgn", "/storage2/MyBook3WithANewName.pgn"],
      ["/storage2/MyBook4.pgn", "/storage2/MyBook4WithANewName.pgn"],
      ["/storage2/MyBook5.pgn", "/storage1/MyBook5.pgn"],
    ]);

    const expectedNewMetaS1 = [
      meta1,
      {
          ...meta2,
          sourceBookPath: "/storage1/Openings/MyBook2.pgn",
          trainingBookPath: "/storage1/ChessfilesTraining/training-2.pgn",
      },
      {
          ...meta5,
          sourceBookPath: "/storage1/MyBook5.pgn",
          trainingBookPath: "/storage1/ChessfilesTraining/training-5.pgn",
      },
    ]
    const expectedNewMetaS2 = [
      meta6,
      {
          ...meta3,
          sourceBookPath: "/storage2/MyBook3WithANewName.pgn",
          trainingBookPath: "/storage2/ChessfilesTraining/training-3.pgn",
      },
      {
          ...meta4,
          sourceBookPath: "/storage2/MyBook4WithANewName.pgn",
          trainingBookPath: "/storage2/ChessfilesTraining/training-4.pgn",
      },
    ]

    expect(new Set(metaManager.listTraining())).toEqual(new Set([...expectedNewMetaS1, ...expectedNewMetaS2]))
    // The training meta should be in `s2` now, since that's where the book file is
    expect(JSON.parse(await s1.readFile("/ChessfilesData.json")).trainingMeta).toEqual(expectedNewMetaS1);
    expect(JSON.parse(await s2.readFile("/ChessfilesData.json")).trainingMeta).toEqual(expectedNewMetaS2);

    // The training files assocated with the moved book should also move to the new storages
    expect(new Set(await trainingFiles(s1))).toEqual(new Set([
      "training-1.pgn",
      "training-2.pgn",
      "training-5.pgn",
    ]));
    expect(new Set(await trainingFiles(s2))).toEqual(new Set([
      "training-3.pgn",
      "training-4.pgn",
      "training-6.pgn",
    ]));
  });

  test("updateStorage", async () => {
    const activity1 = newLibraryActivity("MyBook1.pgn", 1);
    const activity2 = newLibraryActivity("MyBook2.pgn", 2);
    const activity3 = newLibraryActivity("MyBook3.pgn", 3);

    const s1 = new ChessfilesStorageLocal(new MockLocalStorage());
    s1.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [],
      activity: [activity1],
    }));
    const s2 = new ChessfilesStorageLocal(new MockLocalStorage());
    s2.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [],
      activity: [activity2],
    }));
    const s3 = new ChessfilesStorageLocal(new MockLocalStorage());
    s3.createFile("/ChessfilesData.json", JSON.stringify({
      trainingMeta: [],
      activity: [activity3],
    }));

    const metaManager = await AppMetaManager.load([
      ["storage1", s1],
      ["storage2", s2],
    ]);
    expect(metaManager.listActivity()).toEqual([activity2, activity1]);

    await metaManager.updateStorageEngines([
      ["storage2", s2],
      ["storage3", s3],
    ]);
    expect(metaManager.listActivity()).toEqual([activity3, activity2]);
  });
});
