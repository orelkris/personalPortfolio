import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/Dropdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getTableCellNodeFromLexicalNode,
  $getTableNodeFromLexicalNodeOrThrow,
  getTableSelectionFromTableElement,
  HTMLTableElementWithWithTableSelectionState,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
} from "@lexical/table";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_EDITOR,
  DEPRECATED_$getNodeTriplet,
  DEPRECATED_$isGridCellNode,
  // eslint-disable-next-line camelcase
  DEPRECATED_$isGridSelection,
  DEPRECATED_GridCellNode,
  ElementNode,
  GridSelection,
  LexicalCommand,
  LexicalEditor,
  LexicalNode,
  createCommand,
} from "lexical";
import * as React from "react";
import { ReactPortal, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ReactComponent as ChevronDown } from "@/assets/images/icons/chevron-down.svg";
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
} from "@radix-ui/react-dropdown-menu";
import {} from "./utils/TableActionMenuUtils";
import {
  TableModificationConfirmation,
  TableModificationToolbarPlugin,
} from "../TableToolbarPlugin";
import useModal from "@/components/hooks/useModal";
import {
  clearTable,
  clearTableCell,
  clearTableColumn,
  clearTableRows,
  deleteTableAtSelection,
  deleteTableColumnAtSelection,
  deleteTableRowAtSelection,
  equilizeTableColumns,
  toggleTableColumnIsHeader,
  toggleTableRowIsHeader,
} from "./TableActionHelpers";

import { useDocument } from "react-firebase-hooks/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/components/firebase";
import { useRouter } from "next/router";
import { doc } from "firebase/firestore";
import {
  $canUnmerge,
  $unmergeCell,
  mergeTableCellsAtSelection,
} from "./TableMergeHelpers";

export type TableInfo = {
  rows: number;
  columns: number;
};

export const UPDATE_MENU_BUTTON_LOCATION: LexicalCommand<boolean> =
  createCommand();

export const UPDATE_TABLE_CELL: LexicalCommand<TableCellNode> = createCommand();

type TableCellActionMenuProps = Readonly<{
  contextRef: { current: null | HTMLElement };
  onClose: () => JSX.Element | void;
  setIsMenuOpen: (isOpen: boolean) => void;
  tableCellNode: TableCellNode;
  showModal: (
    title: string,
    showModal: (onClose: () => void) => JSX.Element
  ) => void;
  activeEditor: LexicalEditor;
}>;

function TableActionMenu({
  onClose,
  tableCellNode: _tableCellNode,
  setIsMenuOpen,
  contextRef,
  showModal,
}: TableCellActionMenuProps) {
  const [editor] = useLexicalComposerContext();
  const dropDownRef = useRef<HTMLDivElement | null>(null);
  const [tableCellNode, updateTableCellNode] =
    useState<TableCellNode>(_tableCellNode);
  const [selectionCounts, updateSelectionCounts] = useState({
    columns: 1,
    rows: 1,
  });

  const [currentTableInfo, updateCurrentTableInfo] = useState<TableInfo>({
    rows: 1,
    columns: 1,
  });

  useEffect(() => {
    return editor.registerMutationListener(TableCellNode, (nodeMutations) => {
      const nodeUpdated =
        nodeMutations.get(tableCellNode.getKey()) === "updated";
      if (nodeUpdated) {
        editor.getEditorState().read(() => {
          updateTableCellNode(tableCellNode.getLatest());
        });
      }
    });
  }, [editor, tableCellNode]);

  useEffect(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();

      try {
        // eslint-disable-next-line new-cap
        if (DEPRECATED_$isGridSelection(selection)) {
          const selectionShape = selection.getShape();

          updateSelectionCounts({
            columns: selectionShape.toX - selectionShape.fromX + 1,
            rows: selectionShape.toY - selectionShape.fromY + 1,
          });
        }
      } catch (e) {
        console.error(e);
      }
    });
  }, [editor]);

  useEffect(() => {
    function handleClickOutside() {
      setIsMenuOpen(false);
    }

    window.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, [setIsMenuOpen, contextRef]);

  const clearTableSelectionHelper = useCallback(
    (tableCellNode: TableCellNode) => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
      const tableElement = editor.getElementByKey(
        tableNode.getKey()
      ) as HTMLTableElementWithWithTableSelectionState;

      if (!tableElement) {
        throw new Error("Expected to find tableElement in DOM");
      }

      const tableSelection = getTableSelectionFromTableElement(tableElement);
      if (tableSelection !== null) {
        tableSelection.clearHighlight();
      }

      tableNode.markDirty();
      updateTableCellNode(tableCellNode);
    },
    [editor]
  );

  const clearTableSelection = useCallback(
    (
      afterDeletion: boolean,
      newFocus?: TableCellNode | LexicalNode,
      isTableRemoved?: boolean
    ) => {
      editor.update(() => {
        if (tableCellNode.isAttached()) {
          clearTableSelectionHelper(tableCellNode);
        }

        if (afterDeletion && !isTableRemoved) {
          clearTableSelectionHelper(newFocus as TableCellNode);
        } else if (isTableRemoved) {
          newFocus.selectStart();
        } else {
          const rootNode = $getRoot();
          rootNode.selectStart();
        }
      });
    },
    [editor, tableCellNode, clearTableSelectionHelper]
  );

  useEffect(() => {
    const getTableInfo = () => {
      editor.update(() => {
        const tableNode: TableNode =
          $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
        const rows: number = tableNode.getChildren().length;
        const columns: number = tableNode.getChildren()[0].getChildren().length;
        updateCurrentTableInfo({ rows, columns });
      });
    };
    getTableInfo();
  }, [editor, tableCellNode]);

  return (
    <>
      <DropdownMenuContent align="start" ref={dropDownRef}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <button>Insert</button>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent
              className="animate-in slide-in-from-left-1 z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-100 bg-white p-1 text-slate-700 shadow-md dark:border-slate-800 dark:bg-dark_background dark:text-dark_text"
              sideOffset={2}
              alignOffset={-5}
            >
              <DropdownMenuItem
                className="space-x-2"
                onClick={() => {
                  showModal("Insert Rows Above", (onClose) => (
                    <TableModificationToolbarPlugin
                      onClose={onClose}
                      modifyingRow={true}
                      shouldInsertAfter={false}
                      editor={editor}
                      tableCellNode={tableCellNode}
                      clearTableSelection={() => clearTableSelection(false)}
                      tableInfo={currentTableInfo}
                    />
                  ));
                }}
              >
                <span className="text">Insert row(s) above</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />
              <DropdownMenuItem
                className="space-x-2"
                onClick={() => {
                  showModal("Insert Rows Below", (onClose) => (
                    <TableModificationToolbarPlugin
                      onClose={onClose}
                      modifyingRow={true}
                      shouldInsertAfter={true}
                      editor={editor}
                      tableCellNode={tableCellNode}
                      clearTableSelection={() => clearTableSelection(false)}
                      tableInfo={currentTableInfo}
                    />
                  ));
                }}
              >
                <span className="text">Insert row(s) below</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />
              <DropdownMenuItem
                className="space-x-2"
                onClick={() => {
                  showModal("Insert Columns Left", (onClose) => (
                    <TableModificationToolbarPlugin
                      onClose={onClose}
                      modifyingRow={false}
                      shouldInsertAfter={false}
                      editor={editor}
                      tableCellNode={tableCellNode}
                      clearTableSelection={() => clearTableSelection(false)}
                      tableInfo={currentTableInfo}
                    />
                  ));
                }}
              >
                <span className="text">Insert column(s) left</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />
              <DropdownMenuItem
                className="space-x-2"
                onClick={() => {
                  showModal("Insert Columns Right", (onClose) => (
                    <TableModificationToolbarPlugin
                      onClose={onClose}
                      modifyingRow={false}
                      shouldInsertAfter={true}
                      editor={editor}
                      tableCellNode={tableCellNode}
                      clearTableSelection={() => clearTableSelection(false)}
                      tableInfo={currentTableInfo}
                    />
                  ));
                }}
              >
                <span className="text">Insert column(s) right</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div>Delete</div>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="animate-in slide-in-from-left-1 z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-100 bg-white p-1 text-slate-700 shadow-md dark:border-slate-800 dark:bg-dark_background dark:text-dark_text">
              <DropdownMenuItem
                className="space-x-2"
                onClick={() => {
                  showModal("Delete Row Action", (onClose) => (
                    <TableModificationConfirmation
                      onClose={onClose}
                      callback={() =>
                        deleteTableRowAtSelection(
                          editor,
                          tableCellNode,
                          clearTableSelection,
                          onClose
                        )
                      }
                      tableInfo={currentTableInfo}
                      message={`Are you sure you would like to delete ${
                        selectionCounts.rows === 1
                          ? "row"
                          : `${selectionCounts.rows} rows`
                      }?`}
                    />
                  ));
                }}
              >
                <span className="text">
                  Delete{" "}
                  {selectionCounts.rows === 1
                    ? "row"
                    : `${selectionCounts.rows} rows`}{" "}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />
              <DropdownMenuItem
                className="space-x-2"
                onClick={() => {
                  showModal("Delete Column Action", (onClose) => (
                    <TableModificationConfirmation
                      onClose={onClose}
                      callback={() =>
                        deleteTableColumnAtSelection(
                          editor,
                          tableCellNode,
                          clearTableSelection,
                          onClose
                        )
                      }
                      tableInfo={currentTableInfo}
                      message={`Are you sure you would like to delete ${
                        selectionCounts.columns === 1
                          ? "column"
                          : `${selectionCounts.columns} columns`
                      }?`}
                    />
                  ));
                }}
              >
                <span className="text">
                  Delete{" "}
                  {selectionCounts.columns === 1
                    ? "column"
                    : `${selectionCounts.columns} columns`}{" "}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />
              <DropdownMenuItem
                className="warning space-x-2"
                onClick={() => {
                  showModal("Delete Table Action", (onClose) => (
                    <TableModificationConfirmation
                      onClose={onClose}
                      callback={() =>
                        deleteTableAtSelection(
                          editor,
                          tableCellNode,
                          clearTableSelection,
                          onClose
                        )
                      }
                      tableInfo={currentTableInfo}
                      message={
                        "Are you sure you would like to delete the entire table?"
                      }
                    />
                  ));
                }}
              >
                <span className="text">Delete Table</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div>Headers</div>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="animate-in slide-in-from-left-1 z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-100 bg-white p-1 text-slate-700 shadow-md dark:border-slate-800 dark:bg-dark_background dark:text-dark_text">
              <DropdownMenuItem
                className="space-x-2"
                onClick={() => {
                  const typeOfAction =
                    (tableCellNode.__headerState &
                      TableCellHeaderStates.ROW) ===
                    TableCellHeaderStates.ROW
                      ? "remove"
                      : "add";
                  toggleTableRowIsHeader(
                    editor,
                    tableCellNode,
                    clearTableSelection,
                    onClose,
                    typeOfAction
                  );
                }}
              >
                <span className="text">
                  {(tableCellNode.__headerState & TableCellHeaderStates.ROW) ===
                  TableCellHeaderStates.ROW
                    ? "Remove"
                    : "Add"}
                  {selectionCounts.rows === 1
                    ? " row header"
                    : ` ${selectionCounts.rows} row headers`}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />
              <DropdownMenuItem
                className="space-x-2"
                onClick={() => {
                  const typeOfAction =
                    (tableCellNode.__headerState &
                      TableCellHeaderStates.COLUMN) ===
                    TableCellHeaderStates.COLUMN
                      ? "remove"
                      : "add";
                  toggleTableColumnIsHeader(
                    editor,
                    tableCellNode,
                    clearTableSelection,
                    onClose,
                    typeOfAction
                  );
                }}
              >
                <span className="text">
                  {(tableCellNode.__headerState &
                    TableCellHeaderStates.COLUMN) ===
                  TableCellHeaderStates.COLUMN
                    ? "Remove"
                    : "Add"}
                  {selectionCounts.columns === 1
                    ? " column header"
                    : ` ${selectionCounts.columns} column headers`}
                </span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div>Clear</div>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="animate-in slide-in-from-left-1 z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-100 bg-white p-1 text-slate-700 shadow-md dark:border-slate-800 dark:bg-dark_background dark:text-dark_text">
              <DropdownMenuItem
                className="space-x-2"
                onClick={() => {
                  showModal("Clear Cell Action", (onClose) => (
                    <TableModificationConfirmation
                      onClose={onClose}
                      callback={() =>
                        clearTableCell(
                          editor,
                          tableCellNode,
                          clearTableSelection,
                          onClose
                        )
                      }
                      tableInfo={currentTableInfo}
                      message={"Are you sure you would like to clear the cell?"}
                    />
                  ));
                }}
              >
                <span className="text">Clear cell</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />

              <DropdownMenuItem
                className="space-x-2"
                onClick={() => {
                  showModal("Clear Row Action", (onClose) => (
                    <TableModificationConfirmation
                      onClose={onClose}
                      callback={() =>
                        clearTableRows(
                          editor,
                          tableCellNode,
                          clearTableSelection,
                          onClose
                        )
                      }
                      tableInfo={currentTableInfo}
                      message={`Are you sure you would like to clear ${
                        selectionCounts.rows === 1
                          ? "the row"
                          : `${selectionCounts.rows} rows`
                      }?`}
                    />
                  ));
                }}
              >
                <span className="text">
                  Clear{" "}
                  {selectionCounts.rows === 1
                    ? "the row"
                    : `${selectionCounts.rows} rows`}{" "}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />
              <DropdownMenuItem
                className="space-x-2"
                onClick={() => {
                  showModal("Clear Column Action", (onClose) => (
                    <TableModificationConfirmation
                      onClose={onClose}
                      callback={() =>
                        clearTableColumn(
                          editor,
                          tableCellNode,
                          clearTableSelection,
                          onClose
                        )
                      }
                      tableInfo={currentTableInfo}
                      message={`Are you sure you would like to clear ${
                        selectionCounts.columns === 1
                          ? "the column"
                          : `${selectionCounts.columns} columns`
                      }?`}
                    />
                  ));
                }}
              >
                <span className="text">
                  Clear{" "}
                  {selectionCounts.columns === 1
                    ? "the column"
                    : `${selectionCounts.columns} columns`}{" "}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />
              <DropdownMenuItem
                className="warning space-x-2"
                onClick={() => {
                  showModal("Clear Table Action", (onClose) => (
                    <TableModificationConfirmation
                      onClose={onClose}
                      callback={() =>
                        clearTable(
                          editor,
                          tableCellNode,
                          clearTableSelection,
                          onClose
                        )
                      }
                      tableInfo={currentTableInfo}
                      message={
                        "Are you sure you would like to clear the table?"
                      }
                    />
                  ));
                }}
              >
                <span className="text">Clear Table</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />
        <DropdownMenuSub>
          <DropdownMenuItem
            onClick={() => {
              showModal("Equilize Columns Action", (onClose) => (
                <TableModificationConfirmation
                  onClose={onClose}
                  callback={() => equilizeTableColumns(editor, tableCellNode)}
                  tableInfo={currentTableInfo}
                  message={
                    "Are you sure you would like to make all columns the same size?"
                  }
                />
              ));
            }}
          >
            <div>Distribute Columns</div>
          </DropdownMenuItem>
        </DropdownMenuSub>
        <DropdownMenuSeparator className="mx-1 my-2 h-px bg-slate-100 dark:bg-slate-700" />
        <DropdownMenuSub>
          <DropdownMenuItem
            onClick={() => {
              showModal("Equilize Columns Action", (onClose) => (
                <TableModificationConfirmation
                  onClose={onClose}
                  callback={() => {
                    if ($canUnmerge(editor)) {
                      $unmergeCell(editor);
                      return;
                    }

                    mergeTableCellsAtSelection(editor, onClose);
                  }}
                  tableInfo={currentTableInfo}
                  message={`Are you sure you would like to merge the selected cells?`}
                />
              ));
            }}
          >
            <div>{$canUnmerge(editor) ? "Unmerge Cells" : "Merge Cells"}</div>
          </DropdownMenuItem>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </>
  );
}

function TableCellActionMenuContainer({
  anchorElem,
}: {
  anchorElem: HTMLElement;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();

  const menuButtonRef = useRef<HTMLDivElement>(null);
  const menuRootRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [activeEditor] = useState<LexicalEditor>(editor);
  const [modal, showModal] = useModal();
  const [tableCellNode, setTableMenuCellNode] = useState<TableCellNode | null>(
    null
  );
  // check permissions
  const router = useRouter();
  const docRef = React.useMemo(
    () => doc(db, `/projects/${router.query.id as string}`),
    [router.query.id]
  );
  const [documentSnapshop, docLoading] = useDocument(docRef);
  const [user] = useAuthState(auth);
  const [permissions, setPermissions] = useState<Array<string>>([]);

  const onClose = () => {
    setTableMenuCellNode(null);
    setIsMenuOpen(false);
  };

  const isStaff =
    user?.emailVerified &&
    (user?.email.includes("@dibbly.com") ||
      user?.email.includes("@theurbanwriters.com"));

  useEffect(() => {
    if (docLoading === true) return;
    try {
      const projectPermissions =
        (documentSnapshop.data().permissions[
          user.uid
        ] as Array<string> | null) || [];
      if (isStaff && !projectPermissions.includes("read"))
        projectPermissions.push("read");

      if (isStaff && !projectPermissions.includes("comment"))
        projectPermissions.push("comment");

      setPermissions(projectPermissions);
    } catch (error) {
      console.error(error);
    }
  }, [documentSnapshop, docLoading, user, isStaff]);

  useEffect(() => {
    if (permissions.includes("write")) {
      onClose();
    }
  }, [permissions]);

  useEffect(() => {
    const draggableMenuIcon = document.querySelector(".draggable-block-menu");
    if (draggableMenuIcon !== null) {
      draggableMenuIcon.addEventListener("drag", onClose);
    }

    return () => {
      draggableMenuIcon &&
        draggableMenuIcon.removeEventListener("drag", onClose);
    };
  }, []);

  const moveMenu = useCallback(() => {
    const menu = menuButtonRef.current;
    const selection = $getSelection();
    const nativeSelection = window.getSelection();
    const activeElement = document.activeElement;

    if (selection == null || menu == null) {
      setTableMenuCellNode(null);
      return;
    }

    const rootElement = editor.getRootElement();

    if (
      $isRangeSelection(selection) &&
      rootElement !== null &&
      nativeSelection !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      const tableCellNodeFromSelection = $getTableCellNodeFromLexicalNode(
        selection.anchor.getNode()
      );

      if (tableCellNodeFromSelection == null) {
        setTableMenuCellNode(null);
        return;
      }

      const tableCellParentNodeDOM = editor.getElementByKey(
        tableCellNodeFromSelection.getKey()
      );

      if (tableCellParentNodeDOM == null) {
        setTableMenuCellNode(null);
        return;
      }

      setTableMenuCellNode(tableCellNodeFromSelection);
    } else if (!activeElement) {
      setTableMenuCellNode(null);
    }
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        moveMenu();
      });
    });
  });

  editor.registerCommand(
    UPDATE_MENU_BUTTON_LOCATION,
    () => {
      onClose();

      return false;
    },
    COMMAND_PRIORITY_EDITOR
  );

  editor.registerCommand(
    UPDATE_TABLE_CELL,
    (payload) => {
      setTableMenuCellNode(payload);

      payload.selectStart();
      return false;
    },
    COMMAND_PRIORITY_EDITOR
  );

  useEffect(() => {
    const menuButtonDOM =
      menuButtonRef.current as unknown as HTMLButtonElement | null;

    if (menuButtonDOM != null && tableCellNode != null) {
      const tableCellNodeDOM = editor.getElementByKey(tableCellNode.getKey());

      if (tableCellNodeDOM != null) {
        const tableCellRect = tableCellNodeDOM.getBoundingClientRect();
        const menuRect = menuButtonDOM.getBoundingClientRect();
        const anchorRect = anchorElem.getBoundingClientRect();

        menuButtonDOM.style.opacity = "1";

        menuButtonDOM.style.left = `${
          tableCellRect.right - menuRect.width - 10 - anchorRect.left
        }px`;

        menuButtonDOM.style.top = `${tableCellRect.top - anchorRect.top + 4}px`;
      } else {
        menuButtonDOM.style.opacity = "0";
      }
    }
  }, [menuButtonRef, tableCellNode, editor, anchorElem]);

  const prevTableCellDOM = useRef(tableCellNode);

  useEffect(() => {
    if (prevTableCellDOM.current !== tableCellNode) {
      setIsMenuOpen(false);
    }

    prevTableCellDOM.current = tableCellNode;
  }, [prevTableCellDOM, tableCellNode]);

  useEffect(() => {
    return editor.registerMutationListener(TableCellNode, (nodeMutations) => {
      if (tableCellNode !== null) {
        const nodeUpdated =
          nodeMutations.get(tableCellNode.getKey()) === "updated";
        if (nodeUpdated) {
          editor.getEditorState().read(() => {
            setTableMenuCellNode(tableCellNode.getLatest());
          });
        }
      }
    });
  }, [editor, tableCellNode, setTableMenuCellNode]);

  return (
    <div className="table-cell-action-button-container" ref={menuButtonRef}>
      <div id="table-toolbar-anchor"></div>
      {tableCellNode != null &&
        (permissions.includes("write") || permissions.includes("owner")) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="space-x-2 px-1 py-1 h-6 z-0"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
              >
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            {isMenuOpen && (
              <TableActionMenu
                contextRef={menuRootRef}
                setIsMenuOpen={setIsMenuOpen}
                onClose={onClose}
                tableCellNode={tableCellNode}
                showModal={showModal}
                activeEditor={activeEditor}
              />
            )}
          </DropdownMenu>
        )}
      {modal}
    </div>
  );
}

export default function TableActionMenuPlugin({
  anchorElem = document.getElementById("table-toolbar-anchor"),
}: {
  anchorElem?: HTMLElement;
}): ReactPortal {
  return createPortal(
    <TableCellActionMenuContainer anchorElem={anchorElem} />,
    anchorElem
  );
}
