import { ClipboardDict } from "./clipboarddict.js";
/**
 * Responsible for handling browser-level Clipboard Events, and drilling them down into actionable elements
 */
export class ClipboardManager {
    constructor(selectionManager, clipboardStore) {
        this.selectionManager = selectionManager;
        this.clipboardStore = clipboardStore;
        /**
         * NOTE: This is unsupported in ALL browsers
         * https://www.w3.org/TR/clipboard-apis/#clipboard-events-and-interfaces
         *
         * This should fire if a user copies something EXTERNALLY
         */
        this.OnClipboardChange = (event) => {
            // When this is supported, it will solve the "System" -> "Internal" use case
            this.clipboardStore.Data = event.clipboardData;
        };
        document.documentElement.oncut = this.OnCut.bind(this);
        document.documentElement.onpaste = this.OnPaste.bind(this);
        document.documentElement.oncopy = this.OnCopy.bind(this);
    }
    /**
     * Also solves the "External" -> "Internal" paste problem, but requires browser permissions so not ideal
     */
    async AttemptReadClipboardData() {
        const clipboard = navigator.clipboard;
        return clipboard.read();
    }
    /**
     * When a browser clipboard copy event is intercepted, check which element has the current focus
     * If it is the INTERNAL clipboard element, then procede with our app-specific copy rules
     * Otherwise, let the action persist natively.
     *
     * Fired:  right-click -> `copy`, ctrl-c, etc. in the browser context
     *
     * Behavior:
     * 1. User fires action request
     * 2. App checks if any canvas / internal elements have focus. If they don't, exit and let the action persist as normal
     * 3. The canvas element has focus, check the current "selected" element.
     *  there is no "selected" element and no judgement can be made, exit and let the action persist as normal
     * 4. Copy the data to both the internal AND external clipboard
     *
     * We copy to both the internal and external buffers so all copy/paste instances are unified.
     */
    OnCopy(event) {
        if (event.type !== ClipboardDict.Copy) {
            throw new Error(`Cannot perform ${event.type} action on copy`);
        }
        if (!event.isTrusted) {
            throw new Error("All external clipboard events must be trusted.");
        }
        const potentialCopy = this.selectionManager.FindActiveCopyable();
        if (potentialCopy === null) {
            // To support External -> Internal paste, I will have to manually convert the copy types
            // Is there a way to do this natively?
            // Alternatively, if "OnClipboardChange" fires, that will solve this use case
            this.clipboardStore.Data = null;
            return;
        }
        potentialCopy.HandleCopy(event.clipboardData);
        event.preventDefault();
    }
    /**
     * External browser-controlled cut action.
     *
     * Fired: ctrl-x, right click -> cut
     *
     * Behavior:
     *
     * 1. User fires action request
     * 2. App checks if any canvas / internal elements have focus. If they don't, exit and let the action persist as normal
     * 3. The canvas element has focus, check the current "selected" element.
     * If there is no "selected" element and no judgement can be made, exit and let the action persist as normal
     * 4a. Fire a "Cut" action and push onto the command stack
     * 4b. Remove the "Selected" element and copy the data to both the internal AND external clipboard
     *
     * We copy to both the internal and external clipboards so all copy/paste instances are unified.
     */
    OnCut(event) {
        if (event.type !== ClipboardDict.Cut) {
            throw new Error(`Cannot perform ${event.type} action on cut`);
        }
        if (!event.isTrusted) {
            throw new Error("All external clipboard events must be trusted.");
        }
        const potentialCut = this.selectionManager.FindActiveCuttable();
        if (potentialCut === null) {
            this.clipboardStore.Data = null;
            return;
        }
        potentialCut.HandleCut(event.clipboardData);
    }
    /**
     * External browser-controlled paste action
     *
     * Fired: ctrl-v, right click -> paste within browser context
     *
     * Behavior:
     *
     * 1. User fires action request
     * 2. App checks if any canvas / internal elements have focus. If they don"t, exit and let the action persist as normal
     * 3. The canvas element has focus, check the current "selected" element.
     * If there is no "selected" element and no judgement can be made, exit and let the action persist as normal
     * 4. Fire a "Paste" action into the command stack with the most-recent "copied" item
     *
     * There is a nuance between the two buffers and "paste". If we DON"T have
     * permission to asynchronously control the buffer, there can be two different sets of data in the "paste" context. Example:
     *
     * 1. User uses browser context to "Copy" a string of data at T:00
     * 2. User uses app context to "Copy" a string of data at T:10
     * 3. User fires an external "Paste" request that can be bound to a context
     *
     * The data that SHOULD be bound would be data #2.
     */
    OnPaste(event) {
        if (event.type !== ClipboardDict.Paste) {
            throw new Error(`Cannot perform ${event.type} action on paste`);
        }
        if (!event.isTrusted) {
            throw new Error("All external clipboard events must be trusted.");
        }
        const pasteContainer = this.selectionManager.FindActivePasteContainer();
        if (pasteContainer === null) {
            return;
        }
        let dataToUse;
        if (this.clipboardStore.Data === null) {
            dataToUse = event.clipboardData;
            event.preventDefault();
        }
        else {
            dataToUse = this.clipboardStore.Data;
        }
        pasteContainer.HandlePaste(dataToUse);
    }
}
//# sourceMappingURL=clipboardmanager.js.map