import type { Color, Move, Nag, Shape, Chess } from "./chess";
import {
  makeFen,
  makeSan,
  moveEquals,
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
  readonly line: readonly EditorNode[];
  readonly ply: number;
  readonly color: Color | undefined;
  readonly rootComment: string | undefined;
  readonly currentNode: EditorCurrentNode;
  readonly position: Chess;
  readonly lastMove?: Move;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly headers: Map<string, string>;
}

export interface EditorNode {
  readonly moves: EditorMove[];
  // Index of the current move, this node represents the position after that move is made
  readonly currentMove: number;
  readonly currentMoveIsDraft: boolean;
  // Is this the currently selected ply?
  readonly selected: boolean;
  readonly comment: string | undefined;
  readonly shapes: readonly Shape[] | undefined;
  readonly nags: readonly Nag[] | undefined;
  readonly priority: Priority;
  // Moves to get to this node from the root node.
  readonly movesToNode: readonly Move[];
  // Amount of "padding" needed to layout this node
  readonly padding: number;
}

export interface EditorMove {
  move: Move;
  san: string;
  nagText: string;
  priority: Priority;
  hasComment: boolean;
}

export interface EditorCurrentNode {
  readonly isDraft: boolean;
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
  cursor: Cursor;
  view: EditorView;
  // Currently selected node
  private undoStack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];

  constructor(rootNode: RootNode) {
    this.rootNode = rootNode;
    this.cursor = new Cursor(rootNode);
    this.view = this.calcView();
  }

  private updateView() {
    this.cursor.updateSelected();
    this.view = this.calcView();
  }

  private calcView(): EditorView {
    const editorNode = this.cursor.editorNode();
    let currentNode;
    if (editorNode !== undefined) {
      currentNode = {
        isDraft: editorNode.currentMoveIsDraft,
        comment: editorNode.comment ?? "",
        nags: editorNode.nags ?? [],
        shapes: editorNode.shapes ?? [],
        priority: editorNode.priority,
      };
    } else {
      currentNode = {
        isDraft: false,
        comment: this.rootNode.comment ?? "",
        nags: [],
        shapes: [],
        priority: Priority.Default,
      };
    }

    const node = this.cursor.node();

    return {
      line: [...this.cursor.line],
      ply: this.cursor.ply,
      currentNode,
      color: this.rootNode.color,
      rootComment: this.rootNode.comment,
      position: this.cursor.position(),
      lastMove: node instanceof ChildNode ? node.move : undefined,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      headers: this.rootNode.headers,
    };
  }

  currentNode(): Node {
    return this.cursor.node();
  }

  private performOp(op: EditorOp, undoType?: "undo" | "redo") {
    const initialMoves = this.cursor.movesToNextNode();
    const reverseOp = op.execute(this.cursor);
    const undoAction = {
      initialMoves,
      op: reverseOp,
    };

    if (undoType === "undo") {
      this.redoStack.push(undoAction);
    } else if (undoType === "redo") {
      this.undoStack.push(undoAction);
    } else {
      this.undoStack.push(undoAction);
      this.redoStack = [];
    }
    this.cursor.pushFirstMovesIfAtLineEnd();
    this.updateView();
  }

  move(move: Move) {
    this.cursor.move(move);
    this.cursor.pushFirstMovesIfAtLineEnd();
    this.updateView();
  }

  moveBackwards() {
    if (this.cursor.ply <= 0) {
      return;
    }
    this.cursor.ply--;
    this.cursor.trimEndDraftNodes();
    this.cursor.pushFirstMovesIfAtLineEnd();
    this.updateView();
  }

  moveForwards() {
    if (this.cursor.atLineEnd()) {
      return;
    }
    this.cursor.ply++;
    this.updateView();
  }

  setMoves(moves: readonly Move[]) {
    this.cursor.ply = 0;
    for (const move of moves) {
      this.cursor.move(move);
    }
    this.cursor.trimEndDraftNodes();
    this.cursor.pushFirstMovesIfAtLineEnd();
    this.cursor.ply = moves.length;
    this.updateView();
  }

  addLine() {
    const currentNode = this.cursor.editorNode();
    if (currentNode === undefined || !currentNode.currentMoveIsDraft) {
      return;
    }
    const movesToNextNode = this.cursor.movesToNextNode();

    this.cursor.ply = 0;
    while (!this.cursor.atLineEnd()) {
      const nextEditorNode = this.cursor.editorNode(this.cursor.ply + 1);
      if (nextEditorNode?.currentMoveIsDraft) {
        const newMoves = movesToNextNode.slice(this.cursor.ply);
        this.performOp(new AddLine(ChildNode.fromMoves(newMoves), newMoves));
        return;
      }
      this.cursor.ply++;
    }
    throw Error("addLine: couldn't find draft move");
  }

  deleteLine() {
    const editorNode = this.cursor.editorNode();

    if (editorNode === undefined || editorNode.currentMoveIsDraft) {
      return;
    }
    this.cursor.ply--;
    this.performOp(new DeleteLine(this.cursor.nextNode()!.move, []));
  }

  setComment(comment: string) {
    if (
      this.cursor.currentNodeIsDraft() ||
      (this.cursor.node().comment ?? "") == comment
    ) {
      return;
    }
    this.performOp(new SetComment(comment));
  }

  toggleNag(nag: Nag) {
    const currentNode = this.cursor.node();
    if (
      this.cursor.currentNodeIsDraft() ||
      !(currentNode instanceof ChildNode)
    ) {
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
    const currentNode = this.cursor.node();
    if (
      this.cursor.currentNodeIsDraft() ||
      !(currentNode instanceof ChildNode)
    ) {
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
    const currentNode = this.cursor.node();
    if (
      this.cursor.currentNodeIsDraft() ||
      !(currentNode instanceof ChildNode)
    ) {
      return;
    }
    this.performOp(new SetPriority(priority));
  }

  reorderMoves(moves: readonly Move[]) {
    const editorNode = this.cursor.editorNode();
    if (editorNode === undefined) {
      return;
    }
    const parent = this.cursor.node(this.cursor.ply - 1);
    if (parent.childrenHaveOrder(moves)) {
      return;
    }
    this.performOp(new ReorderMoves(moves));
  }

  setTrainingColor(color: Color | undefined) {
    if (
      (this.rootNode.color === undefined && color === undefined) ||
      this.rootNode.color == color
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
    this.cursor.ply = 0;
    for (const move of action.initialMoves) {
      this.cursor.move(move);
    }
    this.performOp(action.op, "undo");
  }

  redo() {
    const action = this.redoStack.pop();
    if (action === undefined) {
      return;
    }
    this.cursor.ply = 0;
    for (const move of action.initialMoves) {
      this.cursor.move(move);
    }
    this.performOp(action.op, "redo");
  }

  clearUndo() {
    this.undoStack = [];
    this.redoStack = [];
    this.updateView();
  }
}

// Tracks a position in the node tree so that we can create EditorNodes and mutate the actual nodes.
class Cursor {
  // Editor nodes, one item for each ply except ply==0
  line: EditorNode[] = [];
  positions: Chess[];
  nodes: Node[];
  ply = 0;
  lastSelectedPly = 0;

  constructor(public rootNode: RootNode) {
    this.positions = [rootNode.initialPosition.clone()];
    this.nodes = [rootNode];
    this.pushFirstMovesIfAtLineEnd();
    this.ply = 0;
  }

  reset() {
    this.positions = [this.rootNode.initialPosition.clone()];
    this.nodes = [this.rootNode];
    this.line = [];
    this.pushFirstMovesIfAtLineEnd();
    this.ply = 0;
  }

  // Get an editor node for a ply.
  //
  // For ply==0, there is no editor node
  editorNode(ply?: number): EditorNode | undefined {
    const index = (ply ?? this.ply) - 1;
    return this.line[index];
  }

  position(ply?: number): Chess {
    return this.positions[ply ?? this.ply];
  }

  node(ply?: number): Node {
    return this.nodes[ply ?? this.ply];
  }

  atLineEnd(): boolean {
    return this.ply >= this.line.length;
  }

  nextNode(ply?: number): ChildNode | undefined {
    const index = (ply ?? this.ply) + 1;
    // If there's a next node, we know it's a ChildNode,
    // since only ply=0 stores the root node.
    return this.nodes[index] as ChildNode | undefined;
  }

  movesToNextNode(ply?: number): Move[] {
    const node = this.editorNode(ply);
    return node ? [...node.movesToNode, node.moves[node.currentMove].move] : [];
  }

  currentNodeIsDraft(): boolean {
    return this.editorNode()?.currentMoveIsDraft == true;
  }

  updateEditorNode(update: (node: EditorNode) => EditorNode) {
    const index = this.ply - 1;
    if (index < 0) {
      throw Error("updateEditorNode: ply=0");
    }
    this.line[index] = update(this.line[index]);
  }

  updateSelected() {
    if (this.lastSelectedPly > 0 && this.lastSelectedPly <= this.line.length) {
      const index = this.lastSelectedPly - 1;
      this.line[index] = { ...this.line[index], selected: false };
    }
    if (this.ply > 0) {
      this.updateEditorNode((node) => ({ ...node, selected: true }));
    }
    this.lastSelectedPly = this.ply;
  }

  move(move: Move) {
    const nextNode = this.nextNode();
    if (!(nextNode && moveEquals(nextNode.move, move))) {
      this.trimLine();
      this.pushMove(move);
    } else {
      this.ply++;
    }
  }

  trimLine() {
    this.line = this.line.slice(0, this.ply);
    this.nodes = this.nodes.slice(0, this.ply + 1);
    this.positions = this.positions.slice(0, this.ply + 1);
  }

  trimEndDraftNodes() {
    if (this.editorNode(this.ply + 1)?.currentMoveIsDraft) {
      this.trimLine();
    }
  }

  pushMove(move: Move) {
    const currentNode = this.node();

    const children = [...currentNode.children];
    let childIndex = currentNode.getChildIndex(move);
    let childNodeIsDraft;
    let child;

    if (childIndex == -1) {
      childNodeIsDraft = true;
      child = new ChildNode(move);
      childIndex = children.length;
      children.push(child);
    } else {
      childNodeIsDraft = false;
      child = currentNode.children[childIndex];
    }
    this.push(child, children, childIndex, childNodeIsDraft);
  }

  // Push nodes for `this.currentNode.firstChild()` until we reach the end of the tree.
  pushFirstMovesIfAtLineEnd() {
    if (!this.atLineEnd()) {
      return;
    }
    while (true) {
      const currentNode = this.node();
      const child = currentNode.firstChild();
      if (child === undefined) {
        break;
      }
      this.push(child, currentNode.children, 0, false);
    }
  }

  private push(
    childNode: ChildNode,
    allChildren: ChildNode[],
    currentMove: number,
    currentMoveIsDraft: boolean,
  ) {
    const position = this.position();
    const moves = allChildren.map((child) => this.createMove(position, child));
    this.trimLine(); // TODO: delete?
    const lastNode = this.line[this.ply - 1];

    this.nodes.push(childNode);

    const nextPosition = position.clone();
    nextPosition.play(childNode.move);
    this.positions.push(nextPosition);

    this.line.push({
      moves,
      currentMove,
      currentMoveIsDraft,
      selected: false,
      comment: childNode.comment,
      shapes: childNode.shapes,
      nags: childNode.nags,
      priority: childNode.priority,
      movesToNode: this.movesToNextNode(),
      padding: lastNode ? lastNode.padding + lastNode.currentMove : 0,
    });
    this.ply++;
  }

  refreshEditorNode() {
    if (this.ply == 0) {
      return;
    }
    const parentNode = this.node(this.ply - 1);
    const childNode = this.node(this.ply) as ChildNode;
    const position = this.position(this.ply - 1);

    const moves = parentNode.children.map((child) =>
      this.createMove(position, child),
    );
    let childIndex = parentNode.getChildIndex(childNode.move);
    let childNodeIsDraft;
    if (childIndex == -1) {
      childNodeIsDraft = true;
      childIndex = moves.length;
      moves.push(this.createMove(position, childNode));
    } else {
      childNodeIsDraft = false;
    }

    this.updateEditorNode((editorNode) => ({
      moves,
      currentMove: childIndex,
      currentMoveIsDraft: childNodeIsDraft,
      selected: false,
      comment: childNode.comment,
      shapes: childNode.shapes,
      nags: childNode.nags,
      priority: childNode.priority,
      movesToNode: editorNode.movesToNode,
      padding: editorNode.padding,
    }));
  }

  private createMove(position: Chess, child: ChildNode): EditorMove {
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

  refreshPadding() {
    const lastNode = this.editorNode(this.ply - 1);
    let padding = lastNode ? lastNode.padding + lastNode.currentMove : 0;

    for (let i = Math.max(this.ply - 1, 0); i < this.line.length; i++) {
      this.line[i] = { ...this.line[i], padding };
      padding += this.line[i].currentMove;
    }
  }
}

interface UndoAction {
  initialMoves: readonly Move[];
  op: EditorOp;
}

abstract class EditorOp {
  // Transform a ChildNode and return the reverse operation for the undo/redo stack
  abstract execute(cursor: Cursor): EditorOp;
}

class AddLine extends EditorOp {
  constructor(
    private childNode: ChildNode,
    private movesToMake: Move[],
  ) {
    super();
  }

  execute(cursor: Cursor): EditorOp {
    cursor.node().addChildNode(this.childNode);
    cursor.trimLine();
    for (const move of this.movesToMake) {
      cursor.pushMove(move);
    }
    return new DeleteLine(this.childNode.move, this.movesToMake);
  }
}

class DeleteLine extends EditorOp {
  constructor(
    private move: Move,
    private movesToMake: Move[],
  ) {
    super();
  }

  execute(cursor: Cursor): EditorOp {
    const removed = cursor.node().removeChild(this.move);
    cursor.trimLine();
    for (const move of this.movesToMake) {
      cursor.pushMove(move);
    }
    return new AddLine(removed, this.movesToMake);
  }
}

class SetComment extends EditorOp {
  constructor(private comment: string) {
    super();
  }

  execute(cursor: Cursor): EditorOp {
    const node = cursor.node();
    const oldComment = node.comment;
    node.comment = this.comment.length > 0 ? this.comment : undefined;
    cursor.refreshEditorNode();
    return new SetComment(oldComment ?? "");
  }
}

class SetNags extends EditorOp {
  constructor(private nags: readonly Nag[]) {
    super();
  }

  execute(cursor: Cursor): EditorOp {
    const node = cursor.node();
    if (!(node instanceof ChildNode)) {
      throw Error(`SetNags: invalid node type: ${node}`);
    }
    const oldNags = node.nags;
    node.nags = this.nags.length > 0 ? [...this.nags] : undefined;
    cursor.refreshEditorNode();
    return new SetNags(oldNags ?? []);
  }
}

class SetShapes extends EditorOp {
  constructor(private shapes: readonly Shape[]) {
    super();
  }

  execute(cursor: Cursor): EditorOp {
    const node = cursor.node();
    if (!(node instanceof ChildNode)) {
      throw Error(`SetShapes: invalid node type: ${node}`);
    }
    const oldShapes = node.shapes;
    node.shapes = this.shapes.length > 0 ? [...this.shapes] : undefined;
    cursor.refreshEditorNode();
    return new SetShapes(oldShapes ?? []);
  }
}

class SetPriority extends EditorOp {
  constructor(private priority: Priority) {
    super();
  }

  execute(cursor: Cursor): EditorOp {
    const node = cursor.node();
    if (!(node instanceof ChildNode)) {
      throw Error(`SetPriority: invalid node type: ${node}`);
    }
    const oldPriority = node.priority;
    node.priority = this.priority;
    cursor.refreshEditorNode();
    return new SetPriority(oldPriority);
  }
}

class ReorderMoves extends EditorOp {
  constructor(private readonly order: readonly Move[]) {
    super();
  }

  execute(cursor: Cursor): EditorOp {
    if (cursor.ply == 0) {
      throw Error("ReorderMoves: ply=0");
    }
    const parent = cursor.node(cursor.ply - 1);
    const currentOrder = parent.children.map((n) => n.move);
    parent.reorderChildren(this.order);
    cursor.refreshEditorNode();
    cursor.refreshPadding();
    return new ReorderMoves(currentOrder);
  }
}

class SetTrainingColor extends EditorOp {
  constructor(private readonly color: Color | undefined) {
    super();
  }

  execute(cursor: Cursor): EditorOp {
    const oldColor = cursor.rootNode.color;
    cursor.rootNode.color = this.color;
    return new SetTrainingColor(oldColor);
  }
}

class SetHeaderValue extends EditorOp {
  constructor(
    private name: string,
    private value: string | undefined,
  ) {
    super();
  }

  execute(cursor: Cursor): EditorOp {
    const oldValue = cursor.rootNode.headers.get(this.name);
    if (this.value === undefined) {
      cursor.rootNode.headers.delete(this.name);
    } else {
      cursor.rootNode.headers.set(this.name, this.value);
    }
    return new SetHeaderValue(this.name, oldValue);
  }
}

class SetInitialPosition extends EditorOp {
  constructor(
    private fen: string,
    private restoreChildren: ChildNode[] = [],
  ) {
    super();
  }

  execute(cursor: Cursor): EditorOp {
    const oldFen = makeFen(cursor.rootNode.initialPosition.toSetup());
    const oldChildren = cursor.rootNode.children;
    cursor.rootNode.setInitialPosition(this.fen, this.restoreChildren);
    cursor.reset();
    return new SetInitialPosition(oldFen, oldChildren);
  }
}
