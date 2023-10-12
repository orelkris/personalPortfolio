import {
  $deleteTableColumn,
  $getElementGridForTableNode,
  $getTableColumnIndexFromTableCellNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowIndexFromTableCellNode,
  $isTableRowNode,
  $removeTableRowAtIndex,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,

  // eslint-disable-next-line camelcase
  DEPRECATED_$isGridSelection,
  GridSelection,
  GridSelectionShape,
  LexicalEditor,
  LexicalNode,
  NodeSelection,
  RangeSelection,
  TextNode,
} from "lexical";
import {
  $insertTableColumnLeft,
  $insertTableColumnRight,
  $insertTableRow,
  adjustTableColumnsAfterDeletion,
  modifyColumnHeaders,
  modifyRowHeaders,
} from "./utils/TableActionMenuUtils";
import { Grid } from "@lexical/table/LexicalTableSelection";
import {
  MAX_COLUMN_AMOUNT,
  MAX_ROW_AMOUNT,
  MAX_TABLE_WIDTH,
} from "../TablePlugin/TablePluginConstants";

// INSERT ACTIONS
export const insertTableRowAtSelection = (
  editor: LexicalEditor,
  tableCellNode: TableCellNode,
  clearTableSelection: (
    afterDeletion: boolean,
    newFocus?: TableCellNode | LexicalNode,
    isTableRemoved?: boolean
  ) => void,
  onClose: () => JSX.Element | void,
  shouldInsertAfter: boolean,
  amount?: number
) => {
  editor.update(() => {
    const selection = $getSelection();

    const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
    let tableRowIndex: number;

    try {
      // eslint-disable-next-line new-cap
      if (DEPRECATED_$isGridSelection(selection)) {
        const selectionShape = selection.getShape();
        tableRowIndex = shouldInsertAfter
          ? selectionShape.toY
          : selectionShape.fromY;
      } else {
        tableRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);
      }
    } catch (e) {
      console.error(e);
    }

    const grid = $getElementGridForTableNode(editor, tableNode);

    $insertTableRow(tableNode, tableRowIndex, shouldInsertAfter, amount, grid);

    clearTableSelection(false);
    onClose();
  });
};

export const insertTableColumnAtSelection = (
  editor: LexicalEditor,
  tableCellNode: TableCellNode,
  clearTableSelection: (
    afterDeletion: boolean,
    newFocus?: TableCellNode | LexicalNode,
    isTableRemoved?: boolean
  ) => void,
  onClose: () => JSX.Element | void,
  shouldInsertAfter: boolean,
  amount: number
) => {
  editor.update(() => {
    const selection = $getSelection();

    const tableNode: TableNode =
      $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
    let tableColumnIndex: number;
    try {
      // eslint-disable-next-line new-cap
      if (DEPRECATED_$isGridSelection(selection)) {
        const selectionShape = selection.getShape();
        tableColumnIndex = shouldInsertAfter
          ? selectionShape.toX
          : selectionShape.fromX;
      } else {
        tableColumnIndex = $getTableColumnIndexFromTableCellNode(tableCellNode);
      }
    } catch (e) {
      console.error(e);
    }

    const grid: Grid = $getElementGridForTableNode(editor, tableNode);

    if (shouldInsertAfter) {
      $insertTableColumnRight(tableNode, tableColumnIndex, amount, grid);
    } else {
      $insertTableColumnLeft(tableNode, tableColumnIndex, 1, amount, grid);
    }

    clearTableSelection(false);
    onClose();
  });
};

// DELETE ACTIONS
export const deleteTableAtSelection = (
  editor: LexicalEditor,
  tableCellNode: TableCellNode,
  clearTableSelection: (
    afterDeletion: boolean,
    newFocus?: TableCellNode | LexicalNode,
    isTableRemoved?: boolean
  ) => void,
  onClose: () => JSX.Element | void
) => {
  editor.update(() => {
    const tableNode: TableNode =
      $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
    if (tableNode.getPreviousSibling() != null) {
      const newFocus: LexicalNode = tableNode.getPreviousSibling();
      tableNode.remove();
      clearTableSelection(true, newFocus, true);
      onClose();
      return;
    }
    const root = $getRoot();
    tableNode.remove();
    clearTableSelection(true, root, true);
    onClose();
  });
};

export const deleteTableRowAtSelection = (
  editor: LexicalEditor,
  tableCellNode: TableCellNode,
  clearTableSelection: (
    afterDeletion: boolean,
    newFocus?: TableCellNode | LexicalNode,
    isTableRemoved?: boolean
  ) => void,
  onClose: () => JSX.Element | void
) => {
  editor.update(() => {
    const tableNode: TableNode =
      $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
    const tableRowIndex: number =
      $getTableRowIndexFromTableCellNode(tableCellNode);
    const selection = $getSelection();

    try {
      // eslint-disable-next-line new-cap
      if (DEPRECATED_$isGridSelection(selection)) {
        const grid = $getElementGridForTableNode(editor, tableNode);
        const selectionShape = selection.getShape();

        const startingCell = Math.min(selectionShape.fromY, selectionShape.toY);

        const endingCell = Math.max(selectionShape.fromY, selectionShape.toY);
        const numOfRows = endingCell - startingCell + 1;

        if (numOfRows >= grid.rows) {
          deleteTableAtSelection(
            editor,
            tableCellNode,
            clearTableSelection,
            onClose
          );
          return;
        }

        for (let i = startingCell; i < endingCell + 1; i++) {
          $removeTableRowAtIndex(tableNode, startingCell);
        }
      } else {
        if (tableNode.getChildren().length === 1) {
          deleteTableAtSelection(
            editor,
            tableCellNode,
            clearTableSelection,
            onClose
          );
          return;
        }
        $removeTableRowAtIndex(tableNode, tableRowIndex);
      }
    } catch (e) {
      console.error(e);
    }

    // new focus is the first table cell of the first row
    const newFocus: TableCellNode | LexicalNode = tableNode
      .getFirstChild()
      .getChildren()[0];
    clearTableSelection(true, newFocus, false);
    onClose();
  });
};
export const deleteTableColumnAtSelection = (
  editor: LexicalEditor,
  tableCellNode: TableCellNode,
  clearTableSelection: (
    afterDeletion: boolean,
    newFocus?: TableCellNode | LexicalNode,
    isTableRemoved?: boolean
  ) => void,
  onClose: () => JSX.Element | void
) => {
  editor.update(() => {
    const tableNode: TableNode =
      $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
    const tableColumnIndex: number =
      $getTableColumnIndexFromTableCellNode(tableCellNode);

    const selection = $getSelection();
    let totalWidthToDelete = 0;

    try {
      // eslint-disable-next-line new-cap
      if (DEPRECATED_$isGridSelection(selection)) {
        const grid: Grid = $getElementGridForTableNode(editor, tableNode);
        const selectionShape: GridSelectionShape = selection.getShape();

        const startingCell: number = Math.min(
          selectionShape.fromX,
          selectionShape.toX
        );

        const endingCell: number = Math.max(
          selectionShape.fromX,
          selectionShape.toX
        );
        const numOfColumns: number = endingCell - startingCell + 1;

        if (numOfColumns >= grid.columns) {
          deleteTableAtSelection(
            editor,
            tableCellNode,
            clearTableSelection,
            onClose
          );
          return;
        }

        // delete each selected column
        for (let i = startingCell; i < endingCell + 1; i++) {
          totalWidthToDelete += tableNode
            .getChildren()[0]
            .getChildren()
            [startingCell].getWidth();

          $deleteTableColumn(tableNode, startingCell);
        }
        adjustTableColumnsAfterDeletion(tableNode, totalWidthToDelete);
      } else {
        // to make sure the table node has been completely removed from lexical tree,
        // you must check to see if the column being deleted is the last one
        // then delete the entire table node
        if (
          !tableCellNode.getPreviousSibling() &&
          !tableCellNode.getNextSibling()
        ) {
          deleteTableAtSelection(
            editor,
            tableCellNode,
            clearTableSelection,
            onClose
          );
          return;
        }
        totalWidthToDelete = tableNode
          .getChildren()[0]
          .getChildren()
          [tableColumnIndex].getWidth();

        $deleteTableColumn(tableNode, tableColumnIndex);
        adjustTableColumnsAfterDeletion(tableNode, totalWidthToDelete);
      }
    } catch (e) {
      console.error(e);
    }

    const newFocus: TableCellNode | LexicalNode = tableNode
      .getFirstChild()
      .getChildren()[0];

    clearTableSelection(true, newFocus, false);
    onClose();
  });
};

// CLEAR CELLS ACTIONS
export const clearTableCell = (
  editor: LexicalEditor,
  tableCellNode: TableCellNode,
  clearTableSelection: (
    afterDeletion: boolean,
    newFocus?: TableCellNode | LexicalNode,
    isTableRemoved?: boolean
  ) => void,
  onClose: () => JSX.Element | void
) => {
  editor.update(() => {
    tableCellNode.clear();
    tableCellNode.append($createParagraphNode());
    clearTableSelection(false);
    onClose();
  });
};

export const clearTableRows = (
  editor: LexicalEditor,
  tableCellNode: TableCellNode,
  clearTableSelection: (
    afterDeletion: boolean,
    newFocus?: TableCellNode | LexicalNode,
    isTableRemoved?: boolean
  ) => void,
  onClose: () => JSX.Element | void
) => {
  editor.update(() => {
    const tableNode: TableNode =
      $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
    const selection = $getSelection();
    const rows: LexicalNode[] = tableNode.getChildren();
    const tableRowIndex: number =
      $getTableRowIndexFromTableCellNode(tableCellNode);
    const columns: Array<TableCellNode> = rows[tableRowIndex].getChildren();

    // eslint-disable-next-line new-cap
    if (DEPRECATED_$isGridSelection(selection)) {
      try {
        const selectionShape: GridSelectionShape = selection.getShape();

        const startingCell: number = Math.min(
          selectionShape.fromY,
          selectionShape.toY
        );

        const endingCell: number = Math.max(
          selectionShape.fromY,
          selectionShape.toY
        );

        for (let r = startingCell; r < endingCell + 1; r++) {
          const tableCells = rows[r].getChildren();
          tableCells.forEach((tableCell: TableCellNode) => {
            tableCell.clear();
            tableCell.append($createParagraphNode());
          });
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      columns.forEach((tableCell: TableCellNode) => {
        tableCell.clear();
        tableCell.append($createParagraphNode());
      });
    }

    clearTableSelection(false);
    onClose();
  });
};

export const clearTableColumn = (
  editor: LexicalEditor,
  tableCellNode: TableCellNode,
  clearTableSelection: (
    afterDeletion: boolean,
    newFocus?: TableCellNode | LexicalNode,
    isTableRemoved?: boolean
  ) => void,
  onClose: () => JSX.Element | void
) => {
  editor.update(() => {
    const tableNode: TableNode =
      $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
    const selection = $getSelection();
    const rows: LexicalNode[] = tableNode.getChildren();
    const tableColumnIndex: number =
      $getTableColumnIndexFromTableCellNode(tableCellNode);

    // eslint-disable-next-line new-cap
    if (DEPRECATED_$isGridSelection(selection)) {
      try {
        const selectionShape: GridSelectionShape = selection.getShape();

        const startingCell: number = Math.min(
          selectionShape.fromX,
          selectionShape.toX
        );

        const endingCell: number = Math.max(
          selectionShape.fromX,
          selectionShape.toX
        );

        rows.forEach((row) => {
          for (let i = startingCell; i < endingCell + 1; i++) {
            const tableCell: TableCellNode = row.getChildren()[i];
            tableCell.clear();
            tableCell.append($createParagraphNode());
          }
        });
      } catch (e) {
        console.error(e);
      }
    } else {
      rows.forEach((row) => {
        const tableCell: TableCellNode = row.getChildren()[tableColumnIndex];
        tableCell.clear();
        tableCell.append($createParagraphNode());
      });
    }

    clearTableSelection(false);
    onClose();
  });
};

export const clearTable = (
  editor: LexicalEditor,
  tableCellNode: TableCellNode,
  clearTableSelection: (
    afterDeletion: boolean,
    newFocus?: TableCellNode | LexicalNode,
    isTableRemoved?: boolean
  ) => void,
  onClose: () => JSX.Element | void
) => {
  editor.update(() => {
    const tableNode: TableNode =
      $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
    const rows: LexicalNode[] = tableNode.getChildren();

    rows.forEach((row) => {
      const tableCells: Array<TableCellNode> = row.getChildren();
      tableCells.forEach((cell) => {
        cell.clear();
        cell.append($createParagraphNode());
      });
    });

    clearTableSelection(false);
    onClose();
  });
};

// TOGGLE HEADERS ACTIONS
export const toggleTableRowIsHeader = (
  editor: LexicalEditor,
  tableCellNode: TableCellNode,
  clearTableSelection: (
    afterDeletion: boolean,
    newFocus?: TableCellNode | LexicalNode,
    isTableRemoved?: boolean
  ) => void,
  onClose: () => JSX.Element | void,
  typeOfAction: string
) => {
  editor.update(() => {
    const selection = $getSelection();
    const tableNode: TableNode =
      $getTableNodeFromLexicalNodeOrThrow(tableCellNode);

    const tableRowIndex: number =
      $getTableRowIndexFromTableCellNode(tableCellNode);

    const tableRows: LexicalNode[] = tableNode.getChildren();

    if (tableRowIndex >= tableRows.length || tableRowIndex < 0) {
      throw new Error("Expected table cell to be inside of table row.");
    }

    try {
      // eslint-disable-next-line new-cap
      if (DEPRECATED_$isGridSelection(selection)) {
        const selectionShape: GridSelectionShape = selection.getShape();

        const startingCell: number = Math.min(
          selectionShape.fromY,
          selectionShape.toY
        );
        const endingCell: number = Math.max(
          selectionShape.fromY,
          selectionShape.toY
        );

        for (let i = startingCell; i < endingCell + 1; i++) {
          modifyRowHeaders(tableRows as TableRowNode[], i, typeOfAction);
        }
      } else {
        modifyRowHeaders(
          tableRows as TableRowNode[],
          tableRowIndex,
          typeOfAction
        );
      }
    } catch (e) {
      console.error(e);
    }

    clearTableSelection(false);
    onClose();
  });
};

export const toggleTableColumnIsHeader = (
  editor: LexicalEditor,
  tableCellNode: TableCellNode,
  clearTableSelection: (
    afterDeletion: boolean,
    newFocus?: TableCellNode | LexicalNode,
    isTableRemoved?: boolean
  ) => void,
  onClose: () => JSX.Element | void,
  typeOfAction: string
) => {
  editor.update(() => {
    const selection = $getSelection();
    const tableNode: TableNode =
      $getTableNodeFromLexicalNodeOrThrow(tableCellNode);

    const tableColumnIndex: number =
      $getTableColumnIndexFromTableCellNode(tableCellNode);

    const tableRows: LexicalNode[] = tableNode.getChildren();

    tableRows.forEach((row) => {
      if (!$isTableRowNode(row)) {
        throw new Error("Expected table row");
      }

      const tableCells: LexicalNode[] = row.getChildren();

      if (tableColumnIndex >= tableCells.length || tableColumnIndex < 0) {
        throw new Error("Expected table cell to be inside of table row.");
      }

      try {
        // eslint-disable-next-line new-cap
        if (DEPRECATED_$isGridSelection(selection)) {
          const selectionShape: GridSelectionShape = selection.getShape();
          const startingCell: number = Math.min(
            selectionShape.fromX,
            selectionShape.toX
          );
          const endingCell: number = Math.max(
            selectionShape.fromX,
            selectionShape.toX
          );

          for (let i = startingCell; i < endingCell + 1; i++) {
            modifyColumnHeaders(tableCells as TableCellNode[], i, typeOfAction);
          }
        } else {
          modifyColumnHeaders(
            tableCells as TableCellNode[],
            tableColumnIndex,
            typeOfAction
          );
        }
      } catch (e) {
        console.error(e);
      }
    });

    clearTableSelection(false);
    onClose();
  });
};

export const isValidTable = (tableNode: TableNode) => {
  const rows = tableNode.getChildren().length;
  const columns = tableNode.getChildren()[0].getChildren().length;

  if (rows < MAX_ROW_AMOUNT && columns < MAX_COLUMN_AMOUNT) {
    return true;
  }

  return false;
};

export const rowAmount = (tableNode: TableNode) => {
  return tableNode.getChildren().length;
};

export const columnAmount = (tableNode: TableNode) => {
  return tableNode.getChildren()[0].getChildren().length;
};

export const isInsideTable = (
  selection: RangeSelection | NodeSelection | GridSelection
) => {
  if (selection !== null) {
    const selectionCopy = selection.clone();
    let current = selectionCopy.getNodes()[0];
    while (current !== null) {
      if (current instanceof TableNode) {
        return true;
      }
      current = current.getParent();
    }
  }

  return false;
};

export const createTableDictionary = (tableNode: TableNode) => {
  const dictionary: Map<string, string | LexicalNode | TextNode[]> = new Map();
  const rows: Array<TableRowNode> = tableNode.getChildren();

  rows.forEach((row) => {
    const columns: Array<TableCellNode> = row.getChildren();
    columns.forEach((column) => {
      if ($isParagraphNode(column.getFirstChild())) {
        dictionary.set(`${column.getKey()}`, column.getTextContent());
      } else {
        dictionary.set(`${column.getKey()}`, column.getAllTextNodes());
      }
    });
  });
};

export function equilizeTableColumns(
  editor: LexicalEditor,
  tableCellNode: TableCellNode
) {
  editor.update(() => {
    const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
    const rows = tableNode.getChildren();
    const numOfColumns = rows[0].getChildren().length;
    const totalRowLength = rows.length;
    const equilizedWidth = Math.round(MAX_TABLE_WIDTH / numOfColumns);

    for (let r = 0; r < totalRowLength; r++) {
      const tableRow = rows[r];
      const tableCells: Array<TableCellNode> = tableRow.getChildren();
      const totalColumnLength = tableCells.length;

      for (let c = 0; c < totalColumnLength; c++) {
        const tableCell = tableCells[c];
        console.log(tableCell.getColSpan());
        tableCell.setWidth(equilizedWidth);
      }

      for (let c = 0; c < totalColumnLength; c++) {
        const tableCell = tableCells[c];

        console.log(equilizedWidth, tableCell, numOfColumns, MAX_TABLE_WIDTH);
      }
    }
  });
}
