import type { Color, Move, Nag, PgnChildNode, PgnGame, Shape } from "./chess";
import { v4 as uuidv4 } from "uuid";
import {
  Chess,
  INITIAL_FEN,
  makeSanAndPlay,
  moveEquals,
  newPgnChildNode,
  newPgnGame,
  parseFen,
  parsePgn,
  parseSan,
  pgnParseComment,
  pgnStartingPosition,
  pgnToString,
} from "./chess";

/**
 * Move priority values
 */
export enum Priority {
  Default = 0,
  TrainFirst = 1,
  TrainLast = -1,
}

export enum BookType {
  Normal = 0,
  Opening = 1,
}

export class Book {
  constructor(
    public type: BookType,
    public rootNodes: RootNode[],
  ) {}

  static import(pgn: string): Book {
    const games = parsePgn(pgn);
    let type = BookType.Normal;
    if (
      games.length == 1 &&
      games[0].headers.get("ChessfilesType") == "Opening"
    ) {
      type = BookType.Opening;
    }
    return new Book(type, games.map(RootNode.import));
  }

  export(): string {
    this.ensureBookIdSet();
    const games = this.rootNodes.map((node) => node.export());
    if (this.type == BookType.Opening && games.length == 1) {
      // Opening book, set ChessfilesType to be "Opening"
      games[0].headers.set("ChessfilesType", "Opening");
    } else {
      // Normal book, unset ChessfilesType if it's set.
      for (const game of games) {
        game.headers.delete("ChessfilesType");
      }
    }
    return games.map(pgnToString).join("\n\n");
  }

  id(): string {
    this.ensureBookIdSet();
    return this.rootNodes[0].bookId!;
  }

  private ensureBookIdSet() {
    if (this.rootNodes.length == 0) {
      throw Error("No nodes in book");
    }
    if (this.rootNodes[0].bookId !== undefined) {
      return;
    }
    const id = uuidv4();
    for (const rootNode of this.rootNodes) {
      rootNode.bookId = id;
    }
  }
}

/**
 * Single position in a move tree
 *
 * The root node contains children and nothing else, while `ChildNode` also contain things
 * like comments and the last move played.
 *
 * Node fields are immutable.  If one changes then a new object will be created.  However, the node
 * itself won't be recreated and neither will any ancestors.
 */
export class Node {
  children: ChildNode[];
  comment?: string;

  constructor(children: ChildNode[] = []) {
    this.children = children;
  }

  firstChild(): ChildNode | undefined {
    return this.children[0];
  }

  getChild(move: Move): ChildNode | undefined {
    return this.children.find((child) => moveEquals(child.move, move));
  }

  getChildIndex(move: Move): number {
    return this.children.findIndex((child) => moveEquals(child.move, move));
  }

  hasChild(move: Move): boolean {
    return this.children.some((child) => moveEquals(child.move, move));
  }

  removeChild(move: Move): ChildNode {
    let removed: ChildNode | undefined;
    this.children = this.children.filter((child) => {
      if (moveEquals(child.move, move)) {
        removed = child;
        return false;
      } else {
        return true;
      }
    });
    if (!removed) {
      throw Error("removeChild: child not present");
    }
    return removed;
  }

  addChild(move: Move): ChildNode {
    const child = new ChildNode(move);
    this.addChildNode(child);
    return child;
  }

  addChildNode(child: ChildNode) {
    if (this.getChild(child.move) !== undefined) {
      throw Error("AddChildNode: child already present");
    }
    this.children = [...this.children, child];
  }

  reorderChildren(order: readonly Move[]) {
    if (order.length != this.children.length) {
      throw Error("reorderChildren: order.length != children.length");
    }
    const children = order.map((move) => {
      const child = this.getChild(move);
      if (child === undefined) {
        throw Error(`reorderChildren: no child with move: ${move}`);
      }
      return child;
    });
    this.children = children;
  }

  childrenHaveOrder(order: readonly Move[]): boolean {
    if (order.length != this.children.length) {
      return false;
    }
    return this.children.every((node, i) => moveEquals(node.move, order[i]));
  }

  getDescendant(moves: readonly Move[]): ChildNode | undefined {
    const [firstMove, ...rest] = moves;
    if (firstMove === undefined) {
      return undefined;
    }
    let node = this.getChild(firstMove);
    for (const move of rest) {
      if (node === undefined) {
        return undefined;
      }
      node = node.getChild(move);
    }
    return node;
  }

  /**
   * If there is exactly 1 child node, return it
   */
  getSingleChild(): Node | undefined {
    if (this.children.length === 1) {
      return this.children[0];
    } else {
      return undefined;
    }
  }

  isEmpty(): boolean {
    return this.children.length == 0;
  }

  lineCount(): number {
    if (this.isEmpty()) {
      return 1;
    }

    let count = 0;
    for (const child of this.children) {
      count += child.lineCount();
    }
    return count;
  }

  lineCountByPriority(): Record<Priority, number> {
    return {
      [Priority.TrainFirst]: 0,
      [Priority.Default]: this.lineCount(),
      [Priority.TrainLast]: 0,
    };
  }
}

export class RootNode extends Node {
  readonly initialPosition: Chess;
  initialMoves: readonly Move[];
  shapes?: readonly Shape[];
  headers: Map<string, string>;

  constructor(
    initialPosition: Chess,
    children: ChildNode[] = [],
    headers?: Map<string, string>,
  ) {
    super(children);
    this.initialPosition = initialPosition;
    this.headers = headers ?? new Map();
    this.initialMoves = [];
  }

  static fromInitialPosition(): RootNode {
    return new RootNode(
      Chess.fromSetup(parseFen(INITIAL_FEN).unwrap()).unwrap(),
    );
  }

  toPgnString(): string {
    return pgnToString(this.export());
  }

  get bookId(): string | undefined {
    return this.headers.get("ChessfilesId");
  }

  set bookId(id: string) {
    this.headers.set("ChessfilesId", id);
  }

  get color(): Color | undefined {
    const value = this.headers.get("ChessfilesColor");
    if (value != "white" && value != "black") {
      return undefined;
    }
    return value;
  }

  set color(color: Color | undefined) {
    if (color === undefined) {
      this.headers.delete("ChessfilesColor");
      return;
    }
    this.headers.set("ChessfilesColor", color);
  }

  static import(game: PgnGame): RootNode {
    const position = pgnStartingPosition(game);
    return new RootNode(
      position,
      game.moves.children.map((childNode) =>
        ChildNode.import(position.clone(), childNode),
      ),
      game.headers,
    );
  }

  export(): PgnGame {
    const children = this.children.map((child) =>
      child.export(this.initialPosition.clone()),
    );
    const headers = new Map([...this.headers]);
    return newPgnGame(headers, children, this.comment);
  }
}

export class ChildNode extends Node {
  readonly move: Move;
  nags?: readonly Nag[];
  shapes?: readonly Shape[];
  priority = Priority.Default;

  constructor(move: Move, children: ChildNode[] = []) {
    super(children);
    this.move = move;
  }

  static fromMoves(moves: Move[]): ChildNode {
    const [first, ...rest] = moves;
    if (first === undefined) {
      throw Error("ChildNode.fromMoves: No moves passed");
    }
    if (rest.length === 0) {
      return new ChildNode(first);
    } else {
      return new ChildNode(first, [ChildNode.fromMoves(rest)]);
    }
  }

  export(position: Chess): PgnChildNode {
    const san = makeSanAndPlay(position, this.move);
    const children = this.children.map((node) => node.export(position.clone()));
    const pgnNode = newPgnChildNode(san, children, {
      comment: this.comment,
      shapes: this.shapes,
      nags: this.nags,
    });
    return pgnNode;
  }

  static import(position: Chess, child: PgnChildNode): ChildNode {
    const move = parseSan(position, child.data.san);
    if (!(move && "from" in move)) {
      throw Error(`Invalid move: ${child.data.san}`);
    }
    position.play(move);
    const node = new ChildNode(move, []);
    if (child.data.comments && child.data.comments.length > 0) {
      const textParts = [];
      const shapes = [];
      for (const commentText of child.data.comments) {
        const comment = pgnParseComment(commentText);
        if (comment.text) {
          textParts.push(comment.text);
        }
        if (comment.shapes.length > 0) {
          shapes.push(...comment.shapes);
        }
      }
      if (textParts.length > 0) {
        node.comment = textParts.join("\n\n");
      }
      if (shapes.length > 0) {
        node.shapes = shapes;
      }
    }
    if (child.data.nags && child.data.nags.length > 0) {
      node.nags = child.data.nags;
    }
    node.children = child.children.map((pgnNode) =>
      ChildNode.import(position.clone(), pgnNode),
    );
    return node;
  }
}
