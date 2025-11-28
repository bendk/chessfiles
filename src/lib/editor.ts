import type { Color, Move, Nag, Shape, Chess } from "./chess";
import {
  makeFen,
  makeSan,
  moveEquals,
  moveListEquals,
  nagText,
  shapeEquals,
  MOVE_NAGS,
  POSITION_NAGS,
} from "./chess";
import type { RootNode, Node } from "./node";
import { Priority } from "./node";
import { ChildNode } from "./node";

// Editor view
//
// This is what gets rendered in the DOM.
// Everything is immutable for easy change detection
export interface EditorView {
  readonly initialPly: number;
  readonly ply: number;
  // Current line, the index of the selected node is `ply-1`
  // ply=0 represents the root node being selected.
  readonly line: readonly EditorNode[];
  readonly color: Color | undefined;
  readonly rootComment: string | undefined;
  readonly currentNode: EditorCurrentNode;
  readonly position: Chess;
  readonly lastMove?: Move;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly headers: Map<string, string>;
}

// Editor node, this represents a child node with some extra information to help rendering.
export interface EditorNode {
  readonly node: ChildNode;
  readonly movesToParent: readonly Move[];
  readonly parentMoves: EditorMove[];
  readonly position: Chess;
}

export interface EditorMove {
  move: Move;
  san: string;
  nagText: string;
  priority: Priority;
  hasComment: boolean;
}

export interface EditorCurrentNode {
  readonly node: Node;
  readonly comment: string;
  readonly nags: readonly Nag[];
  readonly shapes: readonly Shape[];
  readonly priority: Priority;
}

/**
 * Editor -- a game editor/viewer
 */
export class Editor {
  rootNode: RootNode;
  currentLine: CurrentLine;
  view: EditorView;
  initialPly: number;
  // Currently selected node
  private undoStack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];
  private canMergeUndoPlayMove = false;

  constructor(rootNode: RootNode) {
    this.rootNode = rootNode;
    this.currentLine = new CurrentLine(rootNode);
    this.initialPly = rootNode.initialPosition.turn == "white" ? 0 : 1;
    this.view = this.calcView();
  }

  private updateView() {
    this.view = this.calcView();
  }

  private calcView(): EditorView {
    const editorNode = this.currentLine.editorNode();
    let currentNode;
    let lastMove;
    if (editorNode !== undefined) {
      currentNode = {
        node: editorNode.node,
        comment: editorNode.node.comment ?? "",
        nags: editorNode.node.nags ?? [],
        shapes: editorNode.node.shapes ?? [],
        priority: editorNode.node.priority,
      };
      lastMove = editorNode.node.move;
    } else {
      currentNode = {
        node: this.rootNode,
        comment: this.rootNode.comment ?? "",
        nags: [],
        shapes: [],
        priority: Priority.Default,
      };
      lastMove = undefined;
    }

    return {
      line: [...this.currentLine.line],
      initialPly: this.initialPly,
      ply: this.currentLine.index + 1,
      currentNode,
      color: this.rootNode.color(),
      rootComment: this.rootNode.comment,
      position: this.currentLine.currentPosition(),
      lastMove,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      headers: this.rootNode.headers,
    };
  }

  private performOp(op: EditorOp, undoType?: "undo" | "redo") {
    const undoAction = op.execute(this.currentLine);

    if (undoType === "undo") {
      this.redoStack.push(undoAction);
    } else if (undoType === "redo") {
      this.undoStack.push(undoAction);
    } else {
      this.undoStack.push(undoAction);
      this.redoStack = [];
    }
    this.currentLine.extendLineWithFirstMoves();
    this.updateView();
  }

  private addUndoForNewMove(move: Move) {
    const editorNode = this.currentLine.editorNode();
    if (editorNode === undefined) {
      throw Error("addUndoForNewMove: no editor node");
    }
    const initialMoves = editorNode.movesToParent;

    // Try to extend the previes undo entry if possible
    const lastUndo = this.undoStack.at(-1);
    if (
      this.canMergeUndoPlayMove &&
      lastUndo &&
      lastUndo.op instanceof UndoPlayMoves &&
      moveListEquals(
        [...lastUndo.initialMoves, ...lastUndo.op.moves],
        initialMoves,
      )
    ) {
      // The DeleteNode undo will also delete this move, the only thing to do is extend the
      // `addNodePlayMoves` list
      lastUndo.op.moves.push(move);
    } else {
      this.undoStack.push({
        initialMoves,
        op: new UndoPlayMoves([move]),
      });
      this.redoStack = [];
    }
  }

  move(move: Move) {
    const changed = this.currentLine.move(move);
    if (changed) {
      this.addUndoForNewMove(move);
      this.canMergeUndoPlayMove = true;
    } else {
      this.canMergeUndoPlayMove = false;
    }
    this.updateView();
  }

  moveBackward() {
    if (this.currentLine.canMoveBackward()) {
      this.currentLine.moveBackward();
      this.updateView();
      this.canMergeUndoPlayMove = false;
    }
  }

  moveForward() {
    if (this.currentLine.canMoveForward()) {
      this.currentLine.moveForward();
      this.updateView();
      this.canMergeUndoPlayMove = false;
    }
  }

  setMoves(moves: readonly Move[]) {
    this.currentLine.setMoves(moves);
    this.updateView();
    this.canMergeUndoPlayMove = false;
  }

  deleteNode() {
    const editorNode = this.currentLine.editorNode();
    if (editorNode === undefined) {
      throw Error("deleteNode: no editor node");
    }
    this.performOp(new DeleteNode(editorNode.node.move));
  }

  setComment(comment: string) {
    if ((this.currentLine.node().comment ?? "") == comment) {
      return;
    }
    this.performOp(new SetComment(comment));
  }

  toggleNag(nag: Nag) {
    const currentNode = this.currentLine.node();
    if (!(currentNode instanceof ChildNode)) {
      return;
    }
    const currentNags = currentNode.nags ?? [];
    const nextNags = [];
    const isMoveNag = MOVE_NAGS.has(nag);
    const isPositionNag = POSITION_NAGS.has(nag);
    let removedNag = false;
    for (const currentNag of currentNags) {
      if (currentNag == nag) {
        removedNag = true;
        continue;
      }
      if (
        (isMoveNag && MOVE_NAGS.has(currentNag)) ||
        (isPositionNag && POSITION_NAGS.has(currentNag))
      ) {
        continue;
      }
      nextNags.push(currentNag);
    }
    if (!removedNag) {
      nextNags.push(nag);
    }
    nextNags.sort((left, right) => left - right);
    this.performOp(new SetNags(nextNags));
  }

  toggleShape(shape: Shape) {
    const currentNode = this.currentLine.node();
    if (!(currentNode instanceof ChildNode)) {
      return;
    }
    const shapes = currentNode.shapes ?? [];
    const newShapes = shapes.filter((s) => !shapeEquals(s, shape));
    if (shapes.length == newShapes.length) {
      newShapes.push(shape);
    }
    this.performOp(new SetShapes(newShapes));
  }

  setPriority(priority: Priority) {
    const currentNode = this.currentLine.node();
    if (!(currentNode instanceof ChildNode)) {
      return;
    }
    this.performOp(new SetPriority(priority));
  }

  reorderMoves(moves: readonly Move[]) {
    const editorNode = this.currentLine.editorNode();
    if (editorNode === undefined) {
      return;
    }
    const parent = this.currentLine.node(this.currentLine.index - 1);
    if (parent.childrenHaveOrder(moves)) {
      return;
    }
    this.performOp(new ReorderMoves(moves));
  }

  setTrainingColor(color: Color | undefined) {
    if (
      (this.rootNode.color() === undefined && color === undefined) ||
      this.rootNode.color() == color
    ) {
      return;
    }
    this.performOp(new SetTrainingColor(color));
  }

  setHeaderValue(name: string, value: string | undefined) {
    this.performOp(new SetHeaderValue(name, value));
  }

  setInitialPosition(fen: string) {
    if (fen == makeFen(this.rootNode.initialPosition.toSetup())) {
      return;
    }
    this.performOp(new SetInitialPosition(fen));
  }

  undo() {
    const action = this.undoStack.pop();
    if (action === undefined) {
      return;
    }
    this.currentLine.setMoves(action.initialMoves);
    this.currentLine.index = action.initialMoves.length - 1;
    this.performOp(action.op, "undo");
    this.canMergeUndoPlayMove = false;
  }

  redo() {
    const action = this.redoStack.pop();
    if (action === undefined) {
      return;
    }
    this.currentLine.setMoves(action.initialMoves);
    this.currentLine.index = action.initialMoves.length - 1;
    this.performOp(action.op, "redo");
    this.canMergeUndoPlayMove = false;
  }

  clearUndo() {
    this.undoStack = [];
    this.redoStack = [];
    this.updateView();
  }
}

// Manages the current editor line and the user's position inside it
class CurrentLine {
  rootNode: RootNode;
  line: EditorNode[] = [];
  // Current index in line, -1 indicates we're on the root node, before the first element.
  index = -1;

  constructor(rootNode: RootNode) {
    this.rootNode = rootNode;
    this.extendLineWithFirstMoves();
  }

  reset(extendLine?: boolean) {
    this.line = [];
    this.index = -1;
    if (extendLine !== false) {
      this.extendLineWithFirstMoves();
    }
  }

  // Makes a move and update the line
  //
  // Returns true if this added a new move to the tree.
  move(move: Move, extendLine?: boolean): boolean {
    let added = false;
    const next = this.line[this.index + 1]?.node;
    if (next && moveEquals(next.move, move)) {
      this.moveForward();
      return added;
    } else {
      const node = this.node();
      let childIndex = node.getChildIndex(move);
      if (childIndex == -1) {
        node.addChild(move);
        childIndex = node.children.length - 1;
        added = true;
      }
      this.trimLine(false);
      this.pushToLine(node, childIndex);
      this.moveForward();
      if (extendLine !== false) {
        this.extendLineWithFirstMoves();
      }
      return added;
    }
  }

  setMoves(moves: readonly Move[]) {
    this.reset(false);
    for (const move of moves) {
      this.move(move, false);
    }
    this.extendLineWithFirstMoves();
  }

  canMoveBackward(): boolean {
    return this.index >= 0;
  }

  canMoveForward(): boolean {
    return this.index + 1 < this.line.length;
  }

  moveBackward() {
    if (!this.canMoveBackward()) {
      throw Error("can't move backward");
    }
    this.index--;
  }

  // Move forward if we can
  moveForward() {
    if (!this.canMoveForward()) {
      throw Error("can't move forward");
    }
    this.index++;
  }

  // Update the current editor node
  updateEditorNode(update: (node: EditorNode) => EditorNode) {
    if (this.index < 0) {
      throw Error(`updateEditorNode: index=${this.index}`);
    }
    this.line[this.index] = update(this.line[this.index]);
  }

  trimLine(extendLine?: boolean) {
    this.line = this.line.slice(0, this.index + 1);
    if (extendLine !== false) {
      this.extendLineWithFirstMoves();
    }
  }

  // Push nodes for `this.currentNode.firstChild()` until we reach the end of the tree.
  extendLineWithFirstMoves() {
    let node: Node = this.line.at(-1)?.node ?? this.rootNode;

    while (node.children.length > 0) {
      this.pushToLine(node, 0);
      node = node.children[0];
    }
  }

  private pushToLine(parent: Node, moveIndex: number) {
    const child = parent.children[moveIndex];

    let position, movesToParent: Move[];
    const lastNode = this.line.at(-1);
    if (!lastNode) {
      position = this.rootNode.initialPosition.clone();
      movesToParent = [];
    } else {
      position = lastNode.position.clone();
      movesToParent = [...lastNode.movesToParent, lastNode.node.move];
    }
    const parentMoves = parent.children.map((child) =>
      this.createEditorMove(position, child),
    );
    position.play(child.move);

    this.line.push({
      parentMoves,
      position,
      node: child,
      movesToParent,
    });
  }

  private createEditorMove(position: Chess, child: ChildNode): EditorMove {
    const nagTextParts = [];
    for (const nag of child.nags ?? []) {
      nagTextParts.push(nagText(nag));
    }
    const hasComment =
      (child.comment !== undefined && child.comment.length > 0) ||
      (child.shapes !== undefined && child.shapes.length > 0);
    return {
      move: child.move,
      san: makeSan(position, child.move),
      nagText: nagTextParts.join(""),
      priority: child.priority,
      hasComment,
    };
  }

  // "Refresh" the current node, which:
  //   * Creates a new object for it, which makes solid re-render it.
  //   * Updates the `parentMoves` field
  //
  // Call this when the comments or other metadata changes.
  refreshEditorNode() {
    const editorNode = this.editorNode();
    if (editorNode === undefined) {
      return;
    }

    let parentNode, parentPosition;
    if (this.index == 0) {
      parentNode = this.rootNode;
      parentPosition = this.rootNode.initialPosition;
    } else {
      const parentEditorNode = this.line[this.index - 1];
      parentNode = parentEditorNode.node;
      parentPosition = parentEditorNode.position;
    }

    this.updateEditorNode((editorNode) => ({
      parentMoves: parentNode.children.map((child) =>
        this.createEditorMove(parentPosition, child),
      ),
      position: editorNode.position,
      node: editorNode.node,
      movesToParent: editorNode.movesToParent,
    }));
  }

  editorNode(index?: number): EditorNode | undefined {
    return this.line[index ?? this.index];
  }

  node(index?: number): Node {
    const editorNode = this.editorNode(index);
    return editorNode ? editorNode.node : this.rootNode;
  }

  currentPosition(index?: number): Chess {
    const editorNode = this.editorNode(index);
    if (editorNode) {
      return editorNode.position.clone();
    } else {
      return this.rootNode.initialPosition.clone();
    }
  }

  movesToCurrentNode(): Move[] {
    const editorNode = this.editorNode();
    if (editorNode) {
      return [...editorNode.movesToParent, editorNode.node.move];
    } else {
      return [];
    }
  }
}

interface UndoAction {
  initialMoves: readonly Move[];
  op: EditorOp;
}

abstract class EditorOp {
  // Transform a ChildNode and return the reverse operation for the undo/redo stack
  abstract execute(cursor: CurrentLine): UndoAction;
}

/**
 * EditorOp for playing new moves.
 *
 * This one is a bit special since it's only used for redo purposes.  The initial mutation
 * conditionally happens inside the `cursor.play` method.
 */
class PlayMoves extends EditorOp {
  constructor(private moves: Move[]) {
    super();
  }

  execute(cursor: CurrentLine): UndoAction {
    const initialMoves = cursor.movesToCurrentNode();
    cursor.trimLine(false);
    for (const move of this.moves) {
      cursor.move(move, false);
    }
    cursor.extendLineWithFirstMoves();
    return {
      initialMoves,
      op: new UndoPlayMoves(this.moves),
    };
  }
}

class UndoPlayMoves extends EditorOp {
  constructor(public moves: Move[]) {
    super();
  }

  execute(cursor: CurrentLine): UndoAction {
    const firstMove = this.moves[0];
    if (!firstMove) {
      throw Error("UndoPlayMoves: move list is empty");
    }

    const node = cursor.node();
    node.removeChild(firstMove);
    cursor.trimLine(false);
    cursor.extendLineWithFirstMoves();
    return {
      initialMoves: cursor.movesToCurrentNode(),
      op: new PlayMoves(this.moves),
    };
  }
}

class DeleteNode extends EditorOp {
  constructor(private move: Move) {
    super();
  }

  execute(cursor: CurrentLine): UndoAction {
    if (cursor.index < 0) {
      throw Error(`DeleteNode: index is ${cursor.index}`);
    }
    cursor.moveBackward();
    const parent = cursor.node();
    const deletedNode = parent.getChild(this.move);
    if (deletedNode === undefined) {
      throw Error(`DeleteNode: move not found: ${this.move}`);
    }
    parent.removeChild(deletedNode.move);
    cursor.trimLine(false);
    cursor.extendLineWithFirstMoves();

    return {
      initialMoves: cursor.movesToCurrentNode(),
      op: new UndoDeleteNode(deletedNode),
    };
  }
}

class UndoDeleteNode extends EditorOp {
  constructor(private childNode: ChildNode) {
    super();
  }

  execute(cursor: CurrentLine): UndoAction {
    cursor.node().addChildNode(this.childNode);
    cursor.trimLine(false);
    cursor.move(this.childNode.move, false);
    cursor.extendLineWithFirstMoves();
    return {
      initialMoves: cursor.movesToCurrentNode(),
      op: new DeleteNode(this.childNode.move),
    };
  }
}

class SetComment extends EditorOp {
  constructor(private comment: string) {
    super();
  }

  execute(cursor: CurrentLine): UndoAction {
    const node = cursor.node();
    const oldComment = node.comment;
    node.comment = this.comment.length > 0 ? this.comment : undefined;
    cursor.refreshEditorNode();
    return {
      initialMoves: cursor.movesToCurrentNode(),
      op: new SetComment(oldComment ?? ""),
    };
  }
}

class SetNags extends EditorOp {
  constructor(private nags: readonly Nag[]) {
    super();
  }

  execute(cursor: CurrentLine): UndoAction {
    const editorNode = cursor.editorNode();
    if (editorNode === undefined) {
      throw Error("SetNags: no editor node");
    }
    const oldNags = editorNode.node.nags;
    editorNode.node.nags = this.nags.length > 0 ? [...this.nags] : undefined;
    cursor.refreshEditorNode();
    return {
      initialMoves: cursor.movesToCurrentNode(),
      op: new SetNags(oldNags ?? []),
    };
  }
}

class SetShapes extends EditorOp {
  constructor(private shapes: readonly Shape[]) {
    super();
  }

  execute(cursor: CurrentLine): UndoAction {
    const node = cursor.node();
    if (!(node instanceof ChildNode)) {
      throw Error(`SetShapes: invalid node type: ${node}`);
    }
    const oldShapes = node.shapes;
    node.shapes = this.shapes.length > 0 ? [...this.shapes] : undefined;
    cursor.refreshEditorNode();
    return {
      initialMoves: cursor.movesToCurrentNode(),
      op: new SetShapes(oldShapes ?? []),
    };
  }
}

class SetPriority extends EditorOp {
  constructor(private priority: Priority) {
    super();
  }

  execute(cursor: CurrentLine): UndoAction {
    const node = cursor.node();
    if (!(node instanceof ChildNode)) {
      throw Error(`SetPriority: invalid node type: ${node}`);
    }
    const oldPriority = node.priority;
    node.priority = this.priority;
    cursor.refreshEditorNode();
    return {
      initialMoves: cursor.movesToCurrentNode(),
      op: new SetPriority(oldPriority),
    };
  }
}

class ReorderMoves extends EditorOp {
  constructor(private readonly order: readonly Move[]) {
    super();
  }

  execute(cursor: CurrentLine): UndoAction {
    if (cursor.index < -1) {
      throw Error(`ReorderMoves: index: ${cursor.index}`);
    }
    const parent = cursor.node(cursor.index - 1);
    const currentOrder = parent.children.map((n) => n.move);
    parent.reorderChildren(this.order);
    cursor.refreshEditorNode();
    return {
      initialMoves: cursor.movesToCurrentNode(),
      op: new ReorderMoves(currentOrder),
    };
  }
}

class SetTrainingColor extends EditorOp {
  constructor(private readonly color: Color | undefined) {
    super();
  }

  execute(cursor: CurrentLine): UndoAction {
    const oldColor = cursor.rootNode.color();
    cursor.rootNode.setColor(this.color);
    return {
      initialMoves: cursor.movesToCurrentNode(),
      op: new SetTrainingColor(oldColor),
    };
  }
}

class SetHeaderValue extends EditorOp {
  constructor(
    private name: string,
    private value: string | undefined,
  ) {
    super();
  }

  execute(cursor: CurrentLine): UndoAction {
    const oldValue = cursor.rootNode.headers.get(this.name);
    if (this.value === undefined) {
      cursor.rootNode.headers.delete(this.name);
    } else {
      cursor.rootNode.headers.set(this.name, this.value);
    }
    return {
      initialMoves: cursor.movesToCurrentNode(),
      op: new SetHeaderValue(this.name, oldValue),
    };
  }
}

class SetInitialPosition extends EditorOp {
  constructor(
    private fen: string,
    private restoreChildren: ChildNode[] = [],
  ) {
    super();
  }

  execute(cursor: CurrentLine): UndoAction {
    const oldFen = makeFen(cursor.rootNode.initialPosition.toSetup());
    const oldChildren = cursor.rootNode.children;
    cursor.rootNode.setInitialPosition(this.fen, this.restoreChildren);
    cursor.reset();
    return {
      initialMoves: [],
      op: new SetInitialPosition(oldFen, oldChildren),
    };
  }
}
