import { EditorView } from '@codemirror/view';

/** Transactions made by the user: clicks, cursor keys, typing, undo etc. */
const userEvents = ['select', 'input', 'delete', 'move', 'undo', 'redo'];

/**
 * Editor extension that calls back whenever the user moves the cursor or
 * selection of a Markdown editor, including while typing. Other moves are
 * left out: Obsidian also restores the cursor of a tab that becomes active
 * again, e.g. after a presentation is closed.
 */
export function cursorListener(onMove: () => void) {
	return EditorView.updateListener.of((update) => {
		if (
			update.selectionSet &&
			update.transactions.some((tr) =>
				userEvents.some((event) => tr.isUserEvent(event)),
			)
		) {
			onMove();
		}
	});
}
