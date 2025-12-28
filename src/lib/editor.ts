import type { Color, Move, Nag, Shape, Chess } from "./chess";
import {
  makeFen,
  makeSan,
  moveListEquals,
  shapeEquals,
  MOVE_NAGS,
  POSITION_NAGS,
} from "./chess";
import type { Node } from "./node";
import { Priority } from "./node";
import { ChildNode, RootNode } from "./node";

// Editor view
//
// This is what gets rendered in the DOM.
// Everything is immutable for easy change detection
export interface EditorView {
  readonly tree: EditorTree;
  readonly position: Chess;
  readonly selectedNode: Node;
  readonly shapes: readonly Shape[];
  readonly initialPly: number;
  readonly ply: number;
  readonly color: Color | undefined;
  readonly rootComment: string | undefined;
  readonly currentNode: EditorCurrentNode;
  readonly lastMove?: Move;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly headers: Map<string, string>;
}

/**
 * The node tree representation used when rendering the editor/game dialog
 */
export type EditorTree = readonly EditorTreeItem[];

export interface EditorTreeItem {
  readonly moves: readonly EditorMove[];
  // Comment for the last move in the sequence
  readonly comment: string;
  // The first move in earch branch is an alternate to the last move in `moves`
  readonly branches: EditorBranch[];
}

export interface EditorMove {
  readonly node: ChildNode;
  readonly san: string;
  readonly nags: readonly Nag[];
  readonly hasShape: boolean;
}

export interface EditorBranch {
  selected: boolean;
  line: EditorTree;
}

// Editor node, this represents a child node with some extra information to help rendering.
export interface EditorNode {
  // Node for the current branch
  readonly node: ChildNode;
  readonly movesToParent: readonly Move[];
  readonly branches: Branch[];
  readonly position: Chess;
}

export interface Branch {
  node: ChildNode;
  selected: boolean;
  move: Move;
  san: string;
  nagText: string;
  priority: Priority;
  hasComment: boolean;
}

export interface EditorCurrentNode {
  readonly node: Node;
  readonly movesToNode: readonly Move[];
  readonly siblingCount: number;
  readonly move: Move | null;
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
  line: EditorLine;
  view: EditorView;
  initialPly: number;
  // Currently selected node
  private undoStack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];
  private canMergeUndoPlayMove = false;

  constructor(rootNode: RootNode) {
    this.rootNode = rootNode;
    this.line = new EditorLine(rootNode);
    this.initialPly = rootNode.initialPosition.turn == "white" ? 0 : 1;
    this.view = this.calcView();
  }

  private makeTree(): EditorTree {
    return this.branch(this.rootNode, this.rootNode.initialPosition.clone(), -1)
      .line;
  }

  private branch(node: Node, position: Chess, index: number): EditorBranch {
    const line: EditorTreeItem[] = [];
    let moves: EditorMove[] = [];
    let selected = true;
    if (node instanceof ChildNode) {
      moves.push(this.editorMove(node, position));
      position.play(node.move);
      selected = this.line.nodeAt(index) === node;
    } else if (
      node instanceof RootNode &&
      node.comment &&
      node.comment.length > 0
    ) {
      line.push({
        moves: [],
        comment: node.comment,
        branches: [],
      });
    }
    while (true) {
      const [firstChild, ...otherChildren] = node.children;
      if (firstChild === undefined) {
        break;
      }
      moves.push(this.editorMove(firstChild, position));
      index++;
      const comment = firstChild.comment ?? "";

      if (comment || otherChildren.length > 0) {
        line.push({
          moves,
          comment,
          branches: otherChildren.map((child) => {
            const branch = this.branch(child, position.clone(), index);
            return branch;
          }),
        });
        moves = [];
      }
      position.play(firstChild.move);
      node = firstChild;
    }
    if (moves.length > 0) {
      line.push({ moves, comment: "", branches: [] });
    }
    return {
      selected,
      line,
    };
  }

  private editorMove(node: ChildNode, position: Chess): EditorMove {
    return {
      node,
      san: makeSan(position, node.move),
      nags: node.nags ?? [],
      hasShape: node.shapes !== undefined && node.shapes.length > 0,
    };
  }

  private updateView() {
    this.view = this.calcView();
  }

  private calcView(): EditorView {
    let currentNode: EditorCurrentNode;
    let lastMove;

    const pos = this.line.pos();
    if (pos.type == "child") {
      currentNode = {
        node: pos.child,
        comment: pos.child.comment ?? "",
        nags: pos.child.nags ?? [],
        shapes: pos.child.shapes ?? [],
        priority: pos.child.priority,
        siblingCount: pos.parent.children.length,
        move: pos.child.move,
        movesToNode: this.line.moves(),
      };
      lastMove = pos.child.move;
    } else {
      currentNode = {
        node: this.rootNode,
        comment: this.rootNode.comment ?? "",
        nags: [],
        shapes: [],
        priority: Priority.Default,
        movesToNode: this.line.moves(),
        siblingCount: 0,
        move: null,
      };
      lastMove = undefined;
    }

    return {
      tree: this.makeTree(),
      position: this.line.position(),
      selectedNode: currentNode.node,
      rootComment: this.rootNode.comment,
      shapes: currentNode.shapes,
      initialPly: this.initialPly,
      ply: this.line.ply(),
      currentNode,
      color: this.rootNode.color(),
      lastMove,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      headers: this.rootNode.headers,
    };
  }

  private performOp(op: EditorOp, undoType?: "undo" | "redo") {
    const undoAction = op.execute(this.line);

    if (undoType === "undo") {
      this.redoStack.push(undoAction);
    } else if (undoType === "redo") {
      this.undoStack.push(undoAction);
    } else {
      this.undoStack.push(undoAction);
      this.redoStack = [];
    }
    this.updateView();
  }

  private addUndoForNewMove(move: Move) {
    const moves = this.line.moves();
    if (moves.length == 0) {
      throw Error("addUndoForNewMove: moves empty");
    }
    const initialMoves = moves.slice(0, -1);

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
    const changed = this.line.move(move);
    if (changed) {
      this.addUndoForNewMove(move);
      this.canMergeUndoPlayMove = true;
    } else {
      this.canMergeUndoPlayMove = false;
    }
    this.updateView();
  }

  canMoveBackward(): boolean {
    return this.line.canMoveBackward();
  }

  canMoveForward(): boolean {
    return this.line.canMoveForward();
  }

  moveBackward() {
    if (this.line.canMoveBackward()) {
      this.line.moveBackward();
      this.updateView();
      this.canMergeUndoPlayMove = false;
    }
  }

  moveForward() {
    if (this.line.canMoveForward()) {
      this.line.moveForward();
      this.updateView();
      this.canMergeUndoPlayMove = false;
    }
  }

  canMoveBackwardGameView(): boolean {
    return this.line.canMoveBackwardGameView();
  }

  canMoveForwardGameView(): boolean {
    return this.line.canMoveForwardGameView();
  }

  moveBackwardGameView() {
    this.line.moveBackwardGameView();
    this.updateView();
    this.canMergeUndoPlayMove = false;
  }

  moveForwardGameView() {
    this.line.moveForwardGameView();
    this.updateView();
    this.canMergeUndoPlayMove = false;
  }

  setMoves(moves: readonly Move[]) {
    this.line.setMoves(moves);
    this.updateView();
    this.canMergeUndoPlayMove = false;
  }

  deleteNode() {
    const node = this.line.childNode();
    if (node === undefined) {
      throw Error("deleteNode: no child node");
    }
    this.performOp(new DeleteNode(node.move));
  }

  setComment(comment: string) {
    if ((this.line.node().comment ?? "") == comment) {
      return;
    }
    this.performOp(new SetComment(comment));
  }

  toggleNag(nag: Nag) {
    const currentNode = this.line.node();
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
    const currentNode = this.line.node();
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
    const currentNode = this.line.node();
    if (!(currentNode instanceof ChildNode)) {
      return;
    }
    this.performOp(new SetPriority(priority));
  }

  reorderMoves(moves: readonly Move[]) {
    const parent = this.line.parentNode();
    if (parent === undefined) {
      return;
    }
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
    this.line.setMoves(action.initialMoves);
    this.performOp(action.op, "undo");
    this.canMergeUndoPlayMove = false;
  }

  redo() {
    const action = this.redoStack.pop();
    if (action === undefined) {
      return;
    }
    this.line.setMoves(action.initialMoves);
    this.performOp(action.op, "redo");
    this.canMergeUndoPlayMove = false;
  }

  clearUndo() {
    this.undoStack = [];
    this.redoStack = [];
    this.updateView();
  }
}

type EditorLinePosition =
  | {
      type: "root";
      root: RootNode;
    }
  | {
      type: "child";
      parent: Node;
      child: ChildNode;
    };

// Manages the current editor line and the user's position inside it
class EditorLine {
  rootNode: RootNode;
  // Child nodes and positions for the current line
  private childNodes: ChildNode[];
  private positions: Chess[];
  // Index of the current position in the line, -1 means that the root node is selected
  private index: number;

  constructor(rootNode: RootNode) {
    this.rootNode = rootNode;
    this.childNodes = [];
    this.positions = [];
    this.index = -1;
    this.extendWithFirstMoves();
  }

  node(): Node {
    return this.index == -1 ? this.rootNode : this.childNodes[this.index];
  }

  nodeAt(index: number): Node {
    return index == -1 ? this.rootNode : this.childNodes[index];
  }

  childNode(): ChildNode | undefined {
    return this.index == -1 ? undefined : this.childNodes[this.index];
  }

  parentNode(): Node | undefined {
    if (this.index == -1) {
      return undefined;
    } else if (this.index == 0) {
      return this.rootNode;
    } else {
      return this.childNodes[this.index - 1];
    }
  }

  grandParentNode(): Node | undefined {
    if (this.index <= 0) {
      return undefined;
    }
    return this.childNodes[this.index - 2] ?? this.rootNode;
  }

  ply(): number {
    return this.index + 1;
  }

  pos(): EditorLinePosition {
    if (this.index == -1) {
      return {
        type: "root",
        root: this.rootNode,
      };
    } else if (this.index == 0) {
      return {
        type: "child",
        parent: this.rootNode,
        child: this.childNodes[0],
      };
    } else {
      return {
        type: "child",
        parent: this.childNodes[this.index - 1],
        child: this.childNodes[this.index],
      };
    }
  }

  moves(): Move[] {
    return this.childNodes.slice(0, this.index + 1).map((n) => n.move);
  }

  position(): Chess {
    return this.index == -1
      ? this.rootNode.initialPosition.clone()
      : this.positions[this.index].clone();
  }

  /**
   * Play a move
   *
   * Returns true if this is a new move for the game
   */
  move(move: Move): boolean {
    const parent = this.node();
    const child = parent.getChild(move);
    if (child === undefined) {
      // Adding new move
      this.trimLine();
      this.push(parent.addChild(move));
      this.index++;
      this.extendWithFirstMoves();
      return true;
    } else if (child === this.childNodes[this.index + 1]) {
      // Move is the next move in the current line
      this.index++;
      return false;
    } else {
      // Existing move that's not part of the current line
      this.trimLine();
      this.push(child);
      this.extendWithFirstMoves();
      this.index++;
      return false;
    }
  }

  setMoves(moves: readonly Move[]) {
    let node: Node = this.rootNode;
    this.index = -1;

    for (const move of moves) {
      let child = node.getChild(move);
      if (child === undefined) {
        child = node.addChild(move);
        this.trimLine();
        this.push(child);
      } else if (child === this.childNodes[this.index + 1]) {
        // Move is the next move in the current line
      } else {
        // Existing move that's not part of the current line
        this.trimLine();
        this.push(child);
      }
      this.index++;
      node = child;
    }
    this.extendWithFirstMoves();
  }

  private push(child: ChildNode) {
    const pos = (
      this.positions.at(-1) ?? this.rootNode.initialPosition
    ).clone();
    pos.play(child.move);
    this.positions.push(pos);
    this.childNodes.push(child);
  }

  canMoveForward(): boolean {
    return this.index + 1 < this.childNodes.length;
  }

  canMoveBackward(): boolean {
    return this.index > -1;
  }

  moveForward() {
    if (!this.canMoveForward()) {
      throw Error("EditorLine.moveForward: at end of line");
    }
    this.index++;
  }

  moveBackward() {
    if (!this.canMoveBackward()) {
      throw Error("EditorLine.moveBackward: at start of line");
    }
    this.index--;
  }

  canMoveForwardGameView(): boolean {
    if (this.index + 1 < this.childNodes.length) {
      // can move forward on the current line
      return true;
    }
    for (let i = 0; i < this.childNodes.length; i++) {
      const parent = this.childNodes[i - 1] ?? this.rootNode;
      const child = this.childNodes[i];
      const childIndex = parent.children.indexOf(child);
      if (
        i == this.index &&
        childIndex == 0 &&
        parent.children[1] &&
        !parent.children[1].isEmpty()
      ) {
        // can move to an alternate branch
        return true;
      }
      if (childIndex > 0 && !parent.children[0].isEmpty()) {
        // Can move forward back to the main line
        return true;
      }
      if (childIndex > 0 && childIndex + 1 < parent.children.length) {
        // Can move forward to the next branch
        return true;
      }
    }
    return false;
  }

  canMoveBackwardGameView(): boolean {
    return this.index > -1;
  }

  // Move forward in game view mode
  //
  // Returns true if we were able to move backward
  moveForwardGameView() {
    const pos = this.pos();

    if (pos.type == "root") {
      const firstChild = pos.root.firstChild();
      if (firstChild === undefined) {
        return;
      }
      this.move(firstChild.move);
      return;
    }
    const childIndex = pos.parent.children.indexOf(pos.child);
    if (childIndex == 0 && childIndex + 1 < pos.parent.children.length) {
      // We just moved past a branch, backtrack and enter the branch
      this.index--;
      this.trimLine();
      this.push(pos.parent.children[childIndex + 1]);
      this.extendWithFirstMoves();
      this.index++;
      return;
    }

    if (this.index + 1 < this.childNodes.length) {
      // Move forward on the current branch
      this.index++;
      return;
    }

    for (let i = this.childNodes.length - 1; i >= 0; i--) {
      const parent = this.childNodes[i - 1] ?? this.rootNode;
      const child = this.childNodes[i];
      const childIndex = parent.children.indexOf(child);
      const nextChild = parent.children[childIndex + 1];

      if (childIndex > 0 && nextChild) {
        // Switch to the next branch
        this.index = i - 1;
        this.trimLine();
        this.push(nextChild);
        this.extendWithFirstMoves();
        this.index++;
        return;
      }
      if (childIndex > 0 && !parent.children[0].isEmpty()) {
        // Switch back to the main line
        this.index = i - 1;
        this.trimLine();
        this.push(parent.children[0]);
        this.push(parent.children[0].children[0]);
        this.extendWithFirstMoves();
        this.index += 2;
        return;
      }
    }
  }

  // Move backward in game view mode
  //
  // Returns true if we were able to move backward
  moveBackwardGameView() {
    const pos = this.pos();

    if (pos.type == "root") {
      // At root node, can't move backward
      return;
    }
    const { parent, child } = pos;

    const childIndex = parent.children.indexOf(child);
    if (childIndex == 1) {
      // First branch, switch to the main line first move
      this.index--;
      this.trimLine();
      this.push(parent.children[childIndex - 1]);
      this.index++;
      return;
    }
    if (childIndex > 1) {
      // 3rd or more branch, switch to the end of the previous branch
      this.index--;
      this.trimLine();
      this.push(parent.children[childIndex - 1]);
      this.extendForMoveBackwards();
      this.index = this.childNodes.length - 1;
      return;
    }

    const grandParent = this.grandParentNode();
    if (
      grandParent &&
      grandParent.children.length >= 2 &&
      grandParent.firstChild() === parent
    ) {
      // Parent is the main branch and there's an alternate, move to the last alternate branch
      // On the main line, move to the first alternate move
      this.index -= 2;
      this.trimLine();
      this.push(grandParent.children.at(-1)!);
      this.extendForMoveBackwards();
      this.index = this.childNodes.length - 1;
      return;
    }

    // Move backwards in the current line
    this.index--;
  }

  private trimLine() {
    this.positions.splice(this.index + 1);
    this.childNodes.splice(this.index + 1);
  }

  private extendWithFirstMoves() {
    let node: Node = this.childNodes.at(-1) ?? this.rootNode;
    const position = (
      this.positions.at(-1) ?? this.rootNode.initialPosition
    ).clone();

    while (true) {
      const firstChild = node.firstChild();
      if (firstChild === undefined) {
        break;
      }

      this.childNodes.push(firstChild);
      position.play(firstChild.move);
      this.positions.push(position.clone());
      node = firstChild;
    }
  }

  private extendForMoveBackwards() {
    let node: Node = this.childNodes.at(-1) ?? this.rootNode;
    const position = (
      this.positions.at(-1) ?? this.rootNode.initialPosition
    ).clone();

    while (true) {
      let child = node.firstChild();
      if (child === undefined) {
        break;
      }
      // If the line ends here and there's additional children, then pick the last one of those
      if (child.isEmpty() && node.children.length > 1) {
        child = node.children.at(-1)!;
      }

      this.childNodes.push(child);
      position.play(child.move);
      this.positions.push(position.clone());
      node = child;
    }
  }
}

interface UndoAction {
  initialMoves: readonly Move[];
  op: EditorOp;
}

abstract class EditorOp {
  // Transform a ChildNode and return the reverse operation for the undo/redo stack
  abstract execute(line: EditorLine): UndoAction;
}

/**
 * EditorOp for playing new moves.
 *
 * This one is a bit special since it's only used for redo purposes.  The initial mutation
 * conditionally happens inside the `line.move` method.
 */
class PlayMoves extends EditorOp {
  constructor(private moves: Move[]) {
    super();
  }

  execute(line: EditorLine): UndoAction {
    const initialMoves = line.moves();
    for (const move of this.moves) {
      line.move(move);
    }
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

  execute(line: EditorLine): UndoAction {
    const firstMove = this.moves[0];
    if (!firstMove) {
      throw Error("UndoPlayMoves: move list is empty");
    }

    const node = line.node();
    node.removeChild(firstMove);
    return {
      initialMoves: line.moves(),
      op: new PlayMoves(this.moves),
    };
  }
}

class DeleteNode extends EditorOp {
  constructor(private move: Move) {
    super();
  }

  execute(line: EditorLine): UndoAction {
    if (!line.canMoveBackward()) {
      throw Error("DeleteNode: no parent node");
    }
    line.moveBackward();
    const parent = line.node();
    const deletedNode = parent.removeChild(this.move);
    if (deletedNode === undefined) {
      throw Error(`DeleteNode: move not found: ${this.move}`);
    }

    return {
      initialMoves: line.moves(),
      op: new UndoDeleteNode(deletedNode),
    };
  }
}

class UndoDeleteNode extends EditorOp {
  constructor(private childNode: ChildNode) {
    super();
  }

  execute(line: EditorLine): UndoAction {
    line.node().addChildNode(this.childNode);
    line.move(this.childNode.move);
    return {
      initialMoves: line.moves(),
      op: new DeleteNode(this.childNode.move),
    };
  }
}

class SetComment extends EditorOp {
  constructor(private comment: string) {
    super();
  }

  execute(line: EditorLine): UndoAction {
    const node = line.node();
    const oldComment = node.comment;
    node.comment = this.comment.length > 0 ? this.comment : undefined;
    return {
      initialMoves: line.moves(),
      op: new SetComment(oldComment ?? ""),
    };
  }
}

class SetNags extends EditorOp {
  constructor(private nags: readonly Nag[]) {
    super();
  }

  execute(line: EditorLine): UndoAction {
    const node = line.childNode();
    if (node === undefined) {
      throw Error("SetNags: no child node");
    }
    const oldNags = node.nags;
    node.nags = this.nags.length > 0 ? [...this.nags] : undefined;
    return {
      initialMoves: line.moves(),
      op: new SetNags(oldNags ?? []),
    };
  }
}

class SetShapes extends EditorOp {
  constructor(private shapes: readonly Shape[]) {
    super();
  }

  execute(line: EditorLine): UndoAction {
    const node = line.childNode();
    if (node === undefined) {
      throw Error("SetShapes: no child node");
    }
    const oldShapes = node.shapes;
    node.shapes = this.shapes.length > 0 ? [...this.shapes] : undefined;
    return {
      initialMoves: line.moves(),
      op: new SetShapes(oldShapes ?? []),
    };
  }
}

class SetPriority extends EditorOp {
  constructor(private priority: Priority) {
    super();
  }

  execute(line: EditorLine): UndoAction {
    const node = line.childNode();
    if (node === undefined) {
      throw Error("SetPriority: no child node");
    }
    const oldPriority = node.priority;
    node.priority = this.priority;
    return {
      initialMoves: line.moves(),
      op: new SetPriority(oldPriority),
    };
  }
}

class ReorderMoves extends EditorOp {
  constructor(private readonly order: readonly Move[]) {
    super();
  }

  execute(line: EditorLine): UndoAction {
    const parent = line.parentNode();
    if (parent === undefined) {
      throw Error("ReorderMoves: no parent node");
    }
    const currentOrder = parent.children.map((n) => n.move);
    parent.reorderChildren(this.order);
    return {
      initialMoves: line.moves(),
      op: new ReorderMoves(currentOrder),
    };
  }
}

class SetTrainingColor extends EditorOp {
  constructor(private readonly color: Color | undefined) {
    super();
  }

  execute(line: EditorLine): UndoAction {
    const oldColor = line.rootNode.color();
    line.rootNode.setColor(this.color);
    return {
      initialMoves: line.moves(),
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

  execute(line: EditorLine): UndoAction {
    const oldValue = line.rootNode.headers.get(this.name);
    if (this.value === undefined) {
      line.rootNode.headers.delete(this.name);
    } else {
      line.rootNode.headers.set(this.name, this.value);
    }
    return {
      initialMoves: line.moves(),
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

  execute(line: EditorLine): UndoAction {
    const oldFen = makeFen(line.rootNode.initialPosition.toSetup());
    const oldChildren = line.rootNode.children;
    line.rootNode.setInitialPosition(this.fen, this.restoreChildren);
    line.setMoves([]);
    return {
      initialMoves: [],
      op: new SetInitialPosition(oldFen, oldChildren),
    };
  }
}
