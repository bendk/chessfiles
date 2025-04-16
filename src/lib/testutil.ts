import { Node, newNode } from "./node";

/**
 * Quick way to build a node tree
 *
 * @param nodeSpec like a node, except moves are stored inside the `node` object directly rather
 *    than inside the `children` field.
 */
export function buildNode(nodeSpec: object): Node {
    const currentNode = newNode();

    for (const [key, value] of Object.entries(nodeSpec)) {
        if (key === "comment" || key === "nags") {
            currentNode.meta[key] = value;
        } else if (key === "priority") {
            currentNode.meta.priority = value;
        } else if (key === "squares") {
            currentNode.meta.annotations.squares = value;
        } else if (key === "arrows") {
            currentNode.meta.annotations.arrows = value;
        } else {
            currentNode.children.push({
                move: key,
                node: buildNode(value),
            });
        }
    }
    return currentNode;
}
