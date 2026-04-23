import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor, constants } from "express-document-sdk";

const { runtime } = addOnSandboxSdk.instance;

function start() {
    const sandboxApi = {
        /**
         * Check the current selection and return info about it.
         * Called from the iframe UI before attempting a recompose.
         */
        getSelectedImageInfo() {
            try {
                if (!editor.context.hasSelection) {
                    return { hasSelection: false, isMedia: false, nodeType: null };
                }

                const selectedNode = editor.context.selection[0];
                const nodeType = selectedNode.type || "unknown";
                const isMedia = nodeType === constants.SceneNodeType.mediaContainer;

                return { hasSelection: true, isMedia, nodeType };
            } catch (err) {
                console.error("[Sandbox] getSelectedImageInfo error:", err);
                return { hasSelection: false, isMedia: false, nodeType: null, error: err.message };
            }
        },

        /**
         * Replace the currently selected MediaContainerNode with a new image.
         * @param {Blob} imageBlob - The processed image blob from the backend.
         */
        async replaceSelectedImage(imageBlob) {
            try {
                if (!editor.context.hasSelection) {
                    return { success: false, error: "No node is selected." };
                }

                const selectedNode = editor.context.selection[0];

                if (selectedNode.type !== constants.SceneNodeType.mediaContainer) {
                    return {
                        success: false,
                        error: `Selected node is "${selectedNode.type}", not a media container. Please select an image.`
                    };
                }

                // Load the new image as a BitmapImage.
                const bitmapImage = await editor.loadBitmapImage(imageBlob);

                // replaceMedia must run inside queueAsyncEdit because loadBitmapImage is async.
                editor.queueAsyncEdit(() => {
                    selectedNode.replaceMedia(bitmapImage);
                });

                return { success: true };
            } catch (err) {
                console.error("[Sandbox] replaceSelectedImage error:", err);
                return { success: false, error: err.message || "Failed to replace the image." };
            }
        }
    };

    runtime.exposeApi(sandboxApi);
}

start();
