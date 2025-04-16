import * as pgn from "chessops/pgn";

/**
 * Move string (SAN)
 */
export type Move = string;

/**
 * Single position in a move tree
 */
export interface Node {
    // Split out the Node metadata so that we can have efficient updates in react-style frontends.
    // If a `children` changes, but `metadata` doesn't then we can often re-use the existing DOM
    // element.  This is also extends to the `NodeChild.move` field.
    meta: NodeMetadata;
    children: NodeChild[];
}

export interface NodeMetadata {
    comment: string;
    annotations: Annotations;
    nags: Nag[];
    priority: Priority;
}

/**
 * Node child -- i.e. an edge in the node graph
 */
export interface NodeChild {
    move: Move;
    node: Node;
}

/**
 * Annotations for a node
 *
 * @field squares %csl squares to higlight squares
 * @field arrows %cal squares draw arrows
 */
export interface Annotations {
    squares: string[];
    arrows: string[];
}

/**
 * NAG value (Numeric Annotation Glyph)
 */
export enum Nag {
    GoodMove = 1,
    PoorMove = 2,
    BrilliantMove = 3,
    BlunderMove = 4,
    InterestingMove = 5,
    DubiousMove = 6,
    ForcedMove = 7,
    EqualPosition = 10,
    UnclearPosition = 13,
    PlusEqualsPosition = 14,
    EqualsPlusPosition = 15,
    PlusMinusPosition = 16,
    MinusPlusPosition = 17,
    PlusOverMinusPosition = 18,
    MinusOverPlusPosition = 19,
    // Specialized Nags for chess-tree, according to Wikipedia all values in the range [222-237] are
    // unused by other software
    PriorityTrainFirst = 222,
    PriorityTrainLast = 223,
}

export const MOVE_NAGS = [
    Nag.GoodMove,
    Nag.PoorMove,
    Nag.BrilliantMove,
    Nag.BlunderMove,
    Nag.InterestingMove,
    Nag.DubiousMove,
    Nag.ForcedMove,
];

export const POSITION_NAGS = [
    Nag.EqualPosition,
    Nag.UnclearPosition,
    Nag.PlusEqualsPosition,
    Nag.EqualsPlusPosition,
    Nag.PlusMinusPosition,
    Nag.MinusPlusPosition,
    Nag.PlusOverMinusPosition,
    Nag.MinusOverPlusPosition,
];

const nagTextMap = new Map<Nag, string>();
nagTextMap.set(Nag.BrilliantMove, "!!");
nagTextMap.set(Nag.GoodMove, "!");
nagTextMap.set(Nag.InterestingMove, "!?");
nagTextMap.set(Nag.DubiousMove, "?!");
nagTextMap.set(Nag.PoorMove, "?");
nagTextMap.set(Nag.BlunderMove, "??");
nagTextMap.set(Nag.PlusMinusPosition, "+-");
nagTextMap.set(Nag.PlusEqualsPosition, "+");
nagTextMap.set(Nag.EqualPosition, "=");
nagTextMap.set(Nag.UnclearPosition, "\u221E");
nagTextMap.set(Nag.EqualsPlusPosition, "=+");
nagTextMap.set(Nag.MinusPlusPosition, "-+");

/**
 * Get a text string for a NAG
 */
export function nagText(nag: Nag): string {
    return nagTextMap.get(nag) ?? "<?>";
}

/**
 * Move priority values
 */
export enum Priority {
    Default = 0,
    TrainFirst = 1,
    TrainLast = -1,
}

export interface LineCountByPriority {
    default: number;
    trainFirst: number;
    trainLast: number;
}

export function newNode(): Node {
    return {
        meta: {
            comment: "",
            annotations: {
                squares: [],
                arrows: [],
            },
            nags: [],
            priority: Priority.Default,
        },
        children: [],
    }
}

export function getChild(node: Node, move: Move): Node | undefined {
    return node.children.find((child) => child.move === move)?.node;
}

export function hasChild(node: Node, move: Move): boolean {
    return getChildIndex(node, move) !== undefined;
}

export function removeChild(node: Node, move: Move) {
    const idx = getChildIndex(node, move);
    if (idx !== undefined) {
        node.children.splice(idx, 1);
    }
}

function getChildIndex(node: Node, move: Move): number | undefined {
    const idx = node.children.findIndex((child) => child.move === move);
    return idx === -1 ? undefined : idx;
}

export function getDescendant(node: Node, moves: Move[]): Node | undefined {
    for (const move of moves) {
        node = getChild(node, move);
        if (node === undefined) {
            return undefined;
        }
    }
    return node;
}

export function getOrInsertChild(node: Node, move: Move): Node {
    const childNode = getChild(node, move);
    if (childNode === undefined) {
        const node = newNode();
        node.children.push({move, node});
        return node;
    } else {
        return childNode;
    }
}

/**
 * If there is exactly 1 child node, return it
 */
export function getSingleChild(node: Node): Node | undefined {
    if (node.children.length === 1) {
        return node.children[0].node;
    } else {
        return undefined;
    }
}

export function mergeNodes(dest: Node, merging: Node) {
    for (const child of merging.children) {
        const currentChild = getChild(dest, child.move);
        if (currentChild === undefined) {
            dest.children.push(child);
        } else {
            mergeNodes(currentChild, child.node);
        }
    }
}

export function isEmpty(node: Node): boolean {
    return node.children.length == 0;
}

export function lineCount(node: Node): number {
    let count = 0;
    for (const child of node.children) {
        if (isEmpty(child.node)) {
            count += 1;
        } else {
            count += lineCount(child.node);
        }
    }
    return count;
}

export function lineCountByPriority(node: Node): LineCountByPriority {
    if (isEmpty(node)) {
        if (node.meta.priority === Priority.TrainFirst) {
            return {
                default: 0,
                trainFirst: 1,
                trainLast: 0,
            };
        } else if (node.meta.priority == Priority.TrainLast) {
            return {
                default: 0,
                trainFirst: 0,
                trainLast: 1,
            };
        } else {
            return {
                default: 1,
                trainFirst: 0,
                trainLast: 0,
            };
        }
    }
    const result: LineCountByPriority = {
        default: 0,
        trainFirst: 0,
        trainLast: 0,
    };
    for (const child of node.children) {
        const childResult = lineCountByPriority(child.node);
        result.default += childResult.default;
        result.trainFirst += childResult.trainFirst;
        result.trainLast += childResult.trainLast;
    }
    return result;
}

export function hasCommentOrNag(meta: NodeMetadata): boolean {
    return (
        meta.comment.length > 0 ||
        meta.nags.length > 0 ||
        meta.annotations.squares.length > 0 ||
        meta.annotations.arrows.length > 0
    );
}

export function fromPgnNode(pgnNode: pgn.Node<pgn.PgnNodeData>): Node {
    const node = newNode();
    node.children = pgnNode.children.map((node) => ({
        move: node.data.san,
        node: nodeFromPgnChild(node),
    }));
    return node;
}

function nodeFromPgnChild(child: pgn.ChildNode<pgn.PgnNodeData>): Node {
    const node = newNode();
    if (child.data.comments.length > 0) {
        node.meta.comment = child.data.comments
            .join("\n");
        // TODO: parse annotations
    }
    if (child.data.nags) {
        for (const nag of child.data.nags) {
            if (nag == Nag.PriorityTrainFirst) {
                node.meta.priority = Priority.TrainFirst;
            } else if (nag == Nag.PriorityTrainLast) {
                node.meta.priority = Priority.TrainLast;
            } else {
                node.meta.nags.push(nag);
            }
        }
    }
    node.children = child.children.map((node) => ({
        move: node.data.san,
        node: nodeFromPgnChild(node),
    }));

    return node;
}

