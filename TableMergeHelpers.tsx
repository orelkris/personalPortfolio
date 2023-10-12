import { $createTableCellNode, TableCellHeaderStates } from "@lexical/table";
import { $insertFirst } from "../TablePlugin";

import {
  DEPRECATED_$computeGridMap,
  DEPRECATED_$isGridRowNode,
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  DEPRECATED_$getNodeTriplet,
  DEPRECATED_$isGridCellNode,
  // eslint-disable-next-line camelcase
  DEPRECATED_$isGridSelection,
  DEPRECATED_GridCellNode,
  ElementNode,
  GridSelection,
} from "lexical";

export const mergeTableCellsAtSelection = (editor, onClose) => {
  editor.update(() => {
    const selection = $getSelection();
    if (DEPRECATED_$isGridSelection(selection)) {
      const { columns, rows } = computeSelectionCount(selection);
      const nodes = selection.getNodes();
      let firstCell: null | DEPRECATED_GridCellNode = null;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (DEPRECATED_$isGridCellNode(node)) {
          if (firstCell === null) {
            node.setColSpan(columns).setRowSpan(rows);
            firstCell = node;
            const isEmpty = $cellContainsEmptyParagraph(node);
            let firstChild;
            if (
              isEmpty &&
              $isParagraphNode((firstChild = node.getFirstChild()))
            ) {
              firstChild.remove();
            }
          } else if (DEPRECATED_$isGridCellNode(firstCell)) {
            const isEmpty = $cellContainsEmptyParagraph(node);
            if (!isEmpty) {
              firstCell.append(...node.getChildren());
            }
            node.remove();
          }
        }
      }
      if (firstCell !== null) {
        if (firstCell.getChildrenSize() === 0) {
          firstCell.append($createParagraphNode());
        }
        $selectLastDescendant(firstCell);
      }
      onClose();
    }
  });
};

export function computeSelectionCount(selection: GridSelection): {
  columns: number;
  rows: number;
} {
  const selectionShape = selection.getShape();
  return {
    columns: selectionShape.toX - selectionShape.fromX + 1,
    rows: selectionShape.toY - selectionShape.fromY + 1,
  };
}

export function $cellContainsEmptyParagraph(
  cell: DEPRECATED_GridCellNode
): boolean {
  if (cell.getChildrenSize() !== 1) {
    return false;
  }
  const firstChild = cell.getFirstChildOrThrow();
  if (!$isParagraphNode(firstChild) || !firstChild.isEmpty()) {
    return false;
  }
  return true;
}

export function $selectLastDescendant(node: ElementNode): void {
  const lastDescendant = node.getLastDescendant();
  if ($isTextNode(lastDescendant)) {
    lastDescendant.select();
  } else if ($isElementNode(lastDescendant)) {
    lastDescendant.selectEnd();
  } else if (lastDescendant !== null) {
    lastDescendant.selectNext();
  }
}

export function $canUnmerge(editor) {
  let canUnmerge = false;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (
      ($isRangeSelection(selection) && !selection.isCollapsed()) ||
      (DEPRECATED_$isGridSelection(selection) &&
        !selection.anchor.is(selection.focus)) ||
      (!$isRangeSelection(selection) && !DEPRECATED_$isGridSelection(selection))
    ) {
      return false;
    }
    const [cell] = DEPRECATED_$getNodeTriplet(selection.anchor);
    canUnmerge = cell.__colSpan > 1 || cell.__rowSpan > 1;
    return canUnmerge;
  });

  return canUnmerge;
}

export function $unmergeCell(editor) {
  editor.update(() => {
    const selection = $getSelection();

    if (
      !($isRangeSelection(selection) || DEPRECATED_$isGridSelection(selection))
    ) {
      throw Error(`Expected a RangeSelection or GridSelection`);
    }

    const anchor = selection.anchor.getNode();
    const [cell, row, grid] = DEPRECATED_$getNodeTriplet(anchor);
    const colSpan = cell.__colSpan;
    const rowSpan = cell.__rowSpan;

    if (colSpan > 1) {
      for (let i = 1; i < colSpan; i++) {
        cell.insertAfter($createTableCellNode(TableCellHeaderStates.NO_STATUS));
      }

      cell.setColSpan(1);
    }

    if (rowSpan > 1) {
      const [map, cellMap] = DEPRECATED_$computeGridMap(grid, cell, cell);
      const { startColumn, startRow } = cellMap;
      let currentRowNode;

      for (let i = 1; i < rowSpan; i++) {
        const currentRow = startRow + i;
        const currentRowMap = map[currentRow];
        currentRowNode = (currentRowNode || row).getNextSibling();

        if (!DEPRECATED_$isGridRowNode(currentRowNode)) {
          throw Error(`Expected row next sibling to be a row`);
        }

        let insertAfterCell = null;

        for (let column = 0; column < startColumn; column++) {
          const currentCellMap = currentRowMap[column];
          const currentCell = currentCellMap.cell;

          if (currentCellMap.startRow === currentRow) {
            insertAfterCell = currentCell;
          }

          if (currentCell.__colSpan > 1) {
            column += currentCell.__colSpan - 1;
          }
        }

        if (insertAfterCell === null) {
          for (let j = 0; j < colSpan; j++) {
            $insertFirst(
              currentRowNode,
              $createTableCellNode(TableCellHeaderStates.NO_STATUS)
            );
          }
        } else {
          for (let j = 0; j < colSpan; j++) {
            insertAfterCell.insertAfter(
              $createTableCellNode(TableCellHeaderStates.NO_STATUS)
            );
          }
        }
      }

      cell.setRowSpan(1);
    }
  });
}
