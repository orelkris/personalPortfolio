import {
  $createTableCellNode,
  $createTableRowNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $isTableCellNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import { $createParagraphNode } from "lexical";

import {
  MAX_COLUMN_AMOUNT,
  MIN_COLUMN_WIDTH,
  MAX_TABLE_WIDTH,
} from "@/plugins/TablePlugin/TablePluginConstants";
import { Grid } from "@lexical/table/LexicalTableSelection";

// eslint-disable-next-line camelcase
export function $getTableCellSiblingsFromTableCellNode(
  tableCellNode: TableCellNode,
  grid: Grid
) {
  const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
  const { x, y } = tableNode.getCordsFromCellNode(tableCellNode, grid);
  return {
    above: tableNode.getCellNodeFromCords(x, y - 1, grid),
    below: tableNode.getCellNodeFromCords(x, y + 1, grid),
    left: tableNode.getCellNodeFromCords(x - 1, y, grid),
    right: tableNode.getCellNodeFromCords(x + 1, y, grid),
  };
}

export function modifyRowHeaders(
  tableRows: Array<TableRowNode>,
  startingIndex: number,
  typeOfAction: string
) {
  const tableRow = tableRows[startingIndex];

  if (!$isTableRowNode(tableRow)) {
    throw new Error("Expected table row");
  }

  tableRow.getChildren().forEach((tableCell) => {
    if (!$isTableCellNode(tableCell)) {
      throw new Error("Expected table cell");
    }

    // 0 if there are none, 1 if there is row, 2 if there is column and 3 if there are both
    if (
      typeOfAction === "remove" &&
      (tableCell.getHeaderStyles() === 3 || tableCell.getHeaderStyles() === 1)
    ) {
      tableCell.toggleHeaderStyle(TableCellHeaderStates.ROW);
    } else if (
      typeOfAction === "add" &&
      (tableCell.getHeaderStyles() === 2 || tableCell.getHeaderStyles() === 0)
    ) {
      tableCell.toggleHeaderStyle(TableCellHeaderStates.ROW);
    }
  });

  return tableRow;
}

export function modifyColumnHeaders(
  tableCells: Array<TableCellNode>,
  tableColumnIndex: number,
  typeOfAction: string
) {
  const tableCell = tableCells[tableColumnIndex];
  if (!$isTableCellNode(tableCell)) {
    throw new Error("Expected table cell");
  }

  if (
    typeOfAction === "remove" &&
    (tableCell.getHeaderStyles() === 3 || tableCell.getHeaderStyles() === 2)
  ) {
    tableCell.toggleHeaderStyle(TableCellHeaderStates.COLUMN);
  } else if (
    typeOfAction === "add" &&
    (tableCell.getHeaderStyles() === 1 || tableCell.getHeaderStyles() === 0)
  ) {
    tableCell.toggleHeaderStyle(TableCellHeaderStates.COLUMN);
  }
  return tableCell;
}

export function $insertTableColumnRight(
  tableNode: TableNode,
  targetIndex: number,
  columnCount: number,
  grid: Grid
) {
  const tableRows = tableNode.getChildren();
  for (let r = 0; r < tableRows.length; r++) {
    const currentTableRowNode = tableRows[r];

    if ($isTableRowNode(currentTableRowNode)) {
      for (let c = 0; c < columnCount; c++) {
        const tableRowChildren = currentTableRowNode.getChildren();

        if (targetIndex >= tableRowChildren.length || targetIndex < 0) {
          throw new Error("Table column target index out of range");
        }

        const targetCell = tableRowChildren[targetIndex];

        if (!$isTableCellNode(targetCell)) {
          throw Error(`Expected table cell`);
        }

        const { left, right } = $getTableCellSiblingsFromTableCellNode(
          targetCell,
          grid
        );
        let headerState = TableCellHeaderStates.NO_STATUS;

        if (
          (left && left.hasHeaderState(TableCellHeaderStates.ROW)) ||
          (right && right.hasHeaderState(TableCellHeaderStates.ROW)) ||
          targetCell.hasHeaderState(TableCellHeaderStates.ROW)
        ) {
          headerState |= TableCellHeaderStates.ROW;
        }

        const newTableCell = $createTableCellNode(headerState);
        console.log(newTableCell, targetCell, targetCell.getColSpan());
        newTableCell.setWidth(MIN_COLUMN_WIDTH);
        newTableCell.append($createParagraphNode());
        targetCell.insertAfter(newTableCell);
      }
    }
  }

  adjustTableColumns(tableNode, targetIndex + 1, columnCount);

  return tableNode;
}

export function $insertTableColumnLeft(
  tableNode: TableNode,
  targetIndex: number,
  columnCount = 1,
  insertCount: number,
  grid: Grid
) {
  const tableRows = tableNode.getChildren();

  for (let r = 0; r < tableRows.length; r++) {
    const currentTableRowNode = tableRows[r];

    if ($isTableRowNode(currentTableRowNode)) {
      for (let c = 0; c < columnCount; c++) {
        const tableRowChildren = currentTableRowNode.getChildren();

        if (targetIndex >= tableRowChildren.length || targetIndex < 0) {
          throw new Error("Table column target index out of range");
        }

        const targetCell = tableRowChildren[targetIndex];

        if (!$isTableCellNode(targetCell)) {
          throw Error(`Expected table cell`);
        }

        const { left, right } = $getTableCellSiblingsFromTableCellNode(
          targetCell,
          grid
        );

        let headerState = TableCellHeaderStates.NO_STATUS;

        if (
          (left && left.hasHeaderState(TableCellHeaderStates.ROW)) ||
          (right && right.hasHeaderState(TableCellHeaderStates.ROW)) ||
          targetCell.hasHeaderState(TableCellHeaderStates.ROW)
        ) {
          headerState |= TableCellHeaderStates.ROW;
        }

        for (let i = 0; i < insertCount; i++) {
          const newTableCell = $createTableCellNode(headerState);
          newTableCell.setWidth(MIN_COLUMN_WIDTH);
          newTableCell.append($createParagraphNode());
          targetCell.insertBefore(newTableCell);
        }
      }
    }
  }
  adjustTableColumns(tableNode, targetIndex, insertCount);

  return tableNode;
}

function adjustTableColumns(
  tableNode: TableNode,
  currentColIndex: number,
  totalAdded = 1
) {
  let currentColPointer = currentColIndex;
  let totalAddedPointer = totalAdded;
  let total = 0;
  const rows = tableNode.getChildren();
  const totalRowLength = rows.length;
  let percentAdjustment = 0;

  const totalColumnLength: number = rows[0].getChildren().length;
  let largestCell: TableCellNode = rows[0].getChildren()[currentColIndex];
  let smallestCell: TableCellNode = rows[0].getChildren()[0];

  const adjustmentAmount = MIN_COLUMN_WIDTH * totalAdded;

  for (let r = 0; r < totalRowLength; r++) {
    const tableRow = rows[r];

    const tableCells: Array<TableCellNode> = tableRow.getChildren();
    total = 0;

    for (let c = 0; c < totalColumnLength; c++) {
      const tableCell = tableCells[c];
      const currentWidth = tableCell.getWidth();

      // short circuit if max amount reached
      if (totalColumnLength === MAX_COLUMN_AMOUNT) {
        tableCell.setWidth(MIN_COLUMN_WIDTH);
        continue;
      }

      if (largestCell.getWidth() < currentWidth) {
        largestCell = tableCell;
      }
      if (smallestCell.getWidth() > currentWidth) {
        smallestCell = tableCell;
      }

      if (c != currentColPointer) {
        // adjustment should consider the current size of cell
        // to make the currently larger cells reduce by a larger amount
        percentAdjustment = Math.ceil(
          adjustmentAmount * (currentWidth / MAX_TABLE_WIDTH)
        );

        if (!(tableCell.getWidth() - percentAdjustment < MIN_COLUMN_WIDTH)) {
          tableCell.setWidth(
            Math.ceil(tableCell.getWidth() - percentAdjustment)
          );

          total += tableCell.getWidth();
        } else {
          tableCell.setWidth(MIN_COLUMN_WIDTH);

          total += MIN_COLUMN_WIDTH;
        }
      } else {
        // keeping track of which cells have been added and therefore
        // should not be adjusted
        totalAddedPointer--;
        if (totalAddedPointer > 0) {
          currentColPointer++;
        }

        total += MIN_COLUMN_WIDTH;
      }
    }

    if (total > MAX_TABLE_WIDTH) {
      largestCell.setWidth(
        Math.round(largestCell.getWidth() - (total - MAX_TABLE_WIDTH))
      );
    }

    totalAddedPointer = totalAdded;
    currentColPointer = currentColIndex;
  }
}

export function adjustTableColumnsAfterDeletion(
  tableNode: TableNode,
  totalWidth: number
) {
  const rows = tableNode.getChildren();
  const totalRowLength = rows.length;
  const totalColumnLength = Number(rows[0].getChildren().length);
  const adjustmentAmount = Math.round(totalWidth / totalColumnLength);

  for (let r = 0; r < totalRowLength; r++) {
    const tableRow = rows[r];
    const tableCells: Array<TableCellNode> = tableRow.getChildren();
    const totalColumnLength = tableCells.length;

    for (let c = 0; c < totalColumnLength; c++) {
      const tableCell = tableCells[c];
      tableCell.setWidth(tableCell.getWidth() + adjustmentAmount);
    }
  }
}

export function findAdjustmentAmountAfterResizing(tableNode: TableNode) {
  const rows = tableNode.getChildren();
  let total = 0;

  for (let r = 0; r < 1; r++) {
    const tableRow = rows[r];
    const tableCells: Array<TableCellNode> = tableRow.getChildren();
    const totalColumnLength = tableCells.length;
    for (let c = 0; c < totalColumnLength; c++) {
      const tableCell = tableCells[c];
      total += tableCell.getWidth();
    }
  }

  return MAX_TABLE_WIDTH - total;
}

export function checkForTableCellKey(
  tableNode: TableNode,
  tableCellNode: TableCellNode
) {
  const rows = tableNode.getChildren();

  for (let r = 0; r < rows.length; r++) {
    const tableCells: Array<TableCellNode> = rows[r].getChildren();

    for (let c = 0; c < tableCells.length; c++) {
      const tableCell: TableCellNode = tableCells[c];
      if (tableCell.getKey() == tableCellNode.getKey()) {
        return true;
      }
    }
  }

  return false;
}

export function $insertTableRow(
  tableNode: TableNode,
  targetIndex: number,
  shouldInsertAfter = true,
  rowCount: number,
  grid: Grid
) {
  const tableRows = tableNode.getChildren();

  if (targetIndex >= tableRows.length || targetIndex < 0) {
    throw new Error("Table row target index out of range");
  }

  const targetRowNode = tableRows[targetIndex];

  if ($isTableRowNode(targetRowNode)) {
    for (let r = 0; r < rowCount; r++) {
      const tableRowCells = targetRowNode.getChildren();
      const tableColumnCount = tableRowCells.length;
      const newTableRowNode = $createTableRowNode();

      for (let c = 0; c < tableColumnCount; c++) {
        const tableCellFromTargetRow = tableRowCells[c];

        if (!$isTableCellNode(tableCellFromTargetRow)) {
          throw Error(`Expected table cell`);
        }

        const { above, below } = $getTableCellSiblingsFromTableCellNode(
          tableCellFromTargetRow,
          grid
        );

        // if there is only one row left then the width is not
        // being captured by looking above and below
        const current = targetRowNode.getChildren()[c];
        let headerState = TableCellHeaderStates.NO_STATUS;
        const width: number =
          (above && above.getWidth()) ||
          (below && below.getWidth()) ||
          current.getWidth();
        if (
          (above && above.hasHeaderState(TableCellHeaderStates.COLUMN)) ||
          (below && below.hasHeaderState(TableCellHeaderStates.COLUMN)) ||
          current.hasHeaderState(TableCellHeaderStates.COLUMN)
        ) {
          headerState |= TableCellHeaderStates.COLUMN;
        }

        const tableCellNode = $createTableCellNode(headerState, 1, width);
        tableCellNode.append($createParagraphNode());
        newTableRowNode.append(tableCellNode);
      }

      if (shouldInsertAfter) {
        targetRowNode.insertAfter(newTableRowNode);
      } else {
        targetRowNode.insertBefore(newTableRowNode);
      }
    }
  } else {
    throw new Error("Row before insertion index does not exist.");
  }

  return tableNode;
}
