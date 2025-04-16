import { describe, test, expect } from "vitest";
import { Priority, getChild, getDescendant, lineCount, lineCountByPriority } from "./node";
import { buildNode } from "./testutil";

describe("Node", function () {
    test("getDescendant", () => {
        const node = buildNode({
            e5: {
                Nf3: {
                    Nc6: {
                        Bc4: {},
                    },
                    Nf6: {},
                },
            },
            e6: {},
        });
        expect(getDescendant(node, [])).toEqual(node);
        expect(getDescendant(node, ["e5"])).toEqual(getChild(node, "e5"));
        expect(getDescendant(node, ["e5", "Nf3"])).toEqual(
            getChild(getChild(node, "e5")!, "Nf3"),
        );
    });

    test("line counts", () => {
        const node = buildNode({
            e5: {
                Nf3: {
                    Nc6: {
                        Bc4: {},
                    },
                    Nf6: {},
                },
            },
            e6: {},
        });
        expect(lineCount(node)).toEqual(3);
        expect(lineCount(getDescendant(node, ["e5"])!)).toEqual(2);
        expect(lineCount(getDescendant(node, ["e5", "Nf3"]))).toEqual(2);
        expect(lineCount(getDescendant(node, ["e5", "Nf3", "Nc6"]))).toEqual(
            1,
        );
        expect(lineCount(getDescendant(node, ["e6"])!)).toEqual(0);
    });

    test("line count by priority", () => {
        const node = buildNode({
            e5: {
                Nf3: {
                    Nc6: {
                        Bc4: {},
                    },
                    Nf6: {},
                    d6: {},
                    f5: {
                        priority: Priority.TrainLast,
                    },
                },
            },
            e6: {
                priority: Priority.TrainFirst,
            },
        });
        expect(lineCountByPriority(node)).toEqual({
            default: 3,
            trainFirst: 1,
            trainLast: 1,
        });
    });
});
