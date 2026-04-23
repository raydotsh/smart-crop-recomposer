import "@spectrum-web-components/theme/express/scale-medium.js";
import "@spectrum-web-components/theme/express/theme-light.js";

import { Theme } from "@swc-react/theme";
import React, { useCallback, useMemo, useRef, useState } from "react";
import "./App.css";

const BACKEND_URL = "http://localhost:3000/recompose";

const FIXES = [
    {
        value: "make-it-feel-intentional",
        badge: "Core",
        title: "Make It Feel Intentional",
        description: "Reframe the subject with cleaner balance so the image stops feeling awkward or accidental.",
        reason: "Best first pass when the composition just feels a little off."
    },
    {
        value: "fix-off-balance-framing",
        badge: "Core",
        title: "Fix Off-Balance Framing",
        description: "Correct drifting subjects and awkward spacing using balanced composition logic.",
        reason: "Useful when the subject feels pushed too far into a corner."
    },
    {
        value: "make-room-for-headline",
        badge: "Pro",
        title: "Make Room for Headline",
        description: "Push the subject aside and preserve clean negative space for text or offers.",
        reason: "Designed for posters, promos, ads, and student presentations."
    },
    {
        value: "prepare-for-social-post",
        badge: "Core",
        title: "Prepare for Social Post",
        description: "Build a square-ready crop that keeps the subject visible and centered for feeds.",
        reason: "Fastest way to make a post asset feel platform-ready."
    },
    {
        value: "keep-subject-clean",
        badge: "Pro",
        title: "Keep Subject Clean",
        description: "Favor a portrait-safe crop that protects the main face or product from awkward trimming.",
        reason: "Helpful when the subject already fills a lot of the frame."
    }
];

function getDocumentApi(addOnUISdk) {
    return addOnUISdk?.app?.document || addOnUISdk?.document || null;
}

async function getSelectedNodes(addOnUISdk) {
    const documentApi = getDocumentApi(addOnUISdk);

    if (!documentApi) {
        return [];
    }

    if (typeof documentApi.getSelectedNodes === "function") {
        const result = await documentApi.getSelectedNodes();
        return Array.isArray(result) ? result : result ? [result] : [];
    }

    if (typeof documentApi.getSelection === "function") {
        const selection = await documentApi.getSelection();
        if (Array.isArray(selection)) {
            return selection;
        }
        if (Array.isArray(selection?.items)) {
            return selection.items;
        }
        return selection ? [selection] : [];
    }

    return [];
}

function isImageNode(node) {
    const candidates = [
        node?.type,
        node?.kind,
        node?.nodeType,
        node?.contentType,
        node?.mimeType
    ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

    return candidates.some((value) => value.includes("image") || value.includes("bitmap") || value.includes("media"));
}

async function exportNodeImage(node) {
    const methodNames = [
        "exportImage",
        "exportAsBlob",
        "exportAsFile",
        "getBlob",
        "getImageBlob",
        "toBlob"
    ];

    for (const methodName of methodNames) {
        if (typeof node?.[methodName] !== "function") {
            continue;
        }

        const result = await node[methodName]({
            type: "image/jpeg",
            mimeType: "image/jpeg"
        });

        if (result instanceof Blob) {
            return result;
        }

        if (result?.blob instanceof Blob) {
            return result.blob;
        }

        if (typeof result?.arrayBuffer === "function") {
            return new Blob([await result.arrayBuffer()], { type: "image/jpeg" });
        }
    }

    throw new Error("This Express environment did not expose the selected image for export.");
}

async function exportCanvasSelection(selectionNode, sandboxProxy) {
    if (selectionNode) {
        try {
            return await exportNodeImage(selectionNode);
        } catch (error) {
            console.warn("Direct node export failed, falling back to document sandbox export.", error);
        }
    }

    if (typeof sandboxProxy?.exportSelectedImage === "function") {
        const result = await sandboxProxy.exportSelectedImage();
        if (result?.success && result?.blob instanceof Blob) {
            return result.blob;
        }

        throw new Error(result?.error || "Could not export the selected image from Adobe Express.");
    }

    throw new Error("This Express environment did not expose the selected image for export.");
}

async function replaceNodeImage(node, blob, addOnUISdk, sandboxProxy) {
    if (typeof node?.replaceImage === "function") {
        await node.replaceImage(blob);
        return { mode: "replace" };
    }

    if (typeof node?.replaceWithImage === "function") {
        await node.replaceWithImage(blob);
        return { mode: "replace" };
    }

    if (typeof sandboxProxy?.replaceSelectedImage === "function") {
        const result = await sandboxProxy.replaceSelectedImage(blob);
        if (result?.success) {
            return { mode: "replace" };
        }
    }

    await addOnUISdk.app.document.addImage(blob, { title: "Smart Crop Result" });
    return { mode: "add" };
}

const App = ({ addOnUISdk, sandboxProxy }) => {
    const [selectedFix, setSelectedFix] = useState(FIXES[0].value);
    const [status, setStatus] = useState({ text: "Select an image on the canvas or upload one to test a composition fix.", type: "info" });
    const [loading, setLoading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [selectionState, setSelectionState] = useState({
        checked: false,
        hasSelection: false,
        isImage: false,
        nodeType: null,
        node: null
    });
    const [uploadedFile, setUploadedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [resultBlob, setResultBlob] = useState(null);
    const [resultUrl, setResultUrl] = useState(null);

    const fileInputRef = useRef(null);
    const activeFix = useMemo(
        () => FIXES.find((fix) => fix.value === selectedFix) || FIXES[0],
        [selectedFix]
    );

    const clearResult = useCallback(() => {
        if (resultUrl) {
            URL.revokeObjectURL(resultUrl);
        }
        setResultBlob(null);
        setResultUrl(null);
    }, [resultUrl]);

    const handleFile = useCallback((file) => {
        if (!file) {
            return;
        }

        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.type)) {
            setStatus({ text: "Upload a JPEG, PNG, or WebP image.", type: "error" });
            return;
        }

        if (file.size > 15 * 1024 * 1024) {
            setStatus({ text: "Image is too large. The max size is 15 MB.", type: "error" });
            return;
        }

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        clearResult();

        const url = URL.createObjectURL(file);
        setUploadedFile(file);
        setPreviewUrl(url);
        setStatus({ text: "Uploaded source ready. Pick the kind of fix you want, then apply it.", type: "info" });
    }, [clearResult, previewUrl]);

    const handleInputChange = useCallback((event) => {
        const file = event.target.files?.[0];
        handleFile(file);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, [handleFile]);

    const handleDrop = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragOver(false);
        handleFile(event.dataTransfer?.files?.[0]);
    }, [handleFile]);

    const removeUploadedImage = useCallback(() => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setUploadedFile(null);
        setPreviewUrl(null);
        clearResult();
        setStatus({ text: "Upload another image or use the current canvas selection.", type: "info" });
    }, [clearResult, previewUrl]);

    const inspectSelection = useCallback(async () => {
        try {
            let sandboxInfo = null;
            if (typeof sandboxProxy?.getSelectedImageInfo === "function") {
                sandboxInfo = await sandboxProxy.getSelectedImageInfo();
            }

            const nodes = await getSelectedNodes(addOnUISdk);
            const imageNode = nodes.find(isImageNode) || null;
            const hasSelection = Boolean(nodes.length || sandboxInfo?.hasSelection);
            const isImage = Boolean(imageNode || sandboxInfo?.isMedia);
            const nodeType = imageNode?.type || imageNode?.kind || sandboxInfo?.nodeType || null;

            setSelectionState({
                checked: true,
                hasSelection,
                isImage,
                nodeType,
                node: imageNode
            });

            if (!hasSelection) {
                setStatus({ text: "No canvas selection yet. Select an image in Express or upload one below.", type: "info" });
                return;
            }

            if (!isImage) {
                setStatus({ text: "Something is selected, but it does not look like an image. Pick a photo or graphic frame.", type: "error" });
                return;
            }

            setStatus({ text: "Selected image detected. You can apply a composition fix directly to the canvas item.", type: "success" });
        } catch (error) {
            console.error("Selection inspection failed:", error);
            setSelectionState({
                checked: true,
                hasSelection: false,
                isImage: false,
                nodeType: null,
                node: null
            });
            setStatus({ text: error.message || "Could not inspect the current Express selection.", type: "error" });
        }
    }, [addOnUISdk, sandboxProxy]);

    const createRequestPayload = useCallback(async () => {
        if (selectionState.isImage) {
            const blob = await exportCanvasSelection(selectionState.node, sandboxProxy);
            return {
                blob,
                sourceLabel: "canvas",
                node: selectionState.node,
                fileName: "selected-image.png"
            };
        }

        if (uploadedFile) {
            return {
                blob: uploadedFile,
                sourceLabel: "upload",
                node: null,
                fileName: uploadedFile.name || "upload.jpg"
            };
        }

        throw new Error("Select an image on the canvas or upload one before applying a fix.");
    }, [sandboxProxy, selectionState, uploadedFile]);

    const handleApplyFix = useCallback(async () => {
        setLoading(true);
        clearResult();
        setStatus({ text: `Applying "${activeFix.title}"...`, type: "info" });

        try {
            const source = await createRequestPayload();
            const formData = new FormData();
            formData.append("image", source.blob, source.fileName);
            formData.append("intent", activeFix.value);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            let response;
            try {
                response = await fetch(BACKEND_URL, {
                    method: "POST",
                    body: formData,
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeoutId);
            }

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`Backend returned ${response.status}: ${errBody}`);
            }

            const processedBlob = await response.blob();
            if (!processedBlob.size) {
                throw new Error("Backend returned an empty image.");
            }

            const nextResultUrl = URL.createObjectURL(processedBlob);
            setResultBlob(processedBlob);
            setResultUrl(nextResultUrl);

            if (source.sourceLabel === "canvas") {
                const applyResult = await replaceNodeImage(source.node, processedBlob, addOnUISdk, sandboxProxy);
                setStatus({
                    text: applyResult.mode === "replace"
                        ? `${activeFix.title} applied to the selected image.`
                        : `${activeFix.title} generated a new image and added it to the canvas.`,
                    type: "success"
                });
                return;
            }

            setStatus({ text: `${activeFix.title} is ready. Review the preview and add it to the canvas if you want.`, type: "success" });
        } catch (error) {
            console.error("Apply fix error:", error);

            if (error.name === "AbortError") {
                setStatus({ text: "The request timed out. Make sure the backend is running on localhost:3000.", type: "error" });
            } else if (String(error.message || "").includes("fetch")) {
                setStatus({ text: "Could not reach the backend. Start the processing server on localhost:3000 and try again.", type: "error" });
            } else {
                setStatus({ text: error.message || "Something went wrong while applying the composition fix.", type: "error" });
            }
        } finally {
            setLoading(false);
        }
    }, [activeFix, addOnUISdk, clearResult, createRequestPayload, sandboxProxy]);

    const handleAddToCanvas = useCallback(async () => {
        if (!resultBlob) {
            return;
        }

        setStatus({ text: "Adding result to the canvas...", type: "info" });

        try {
            await addOnUISdk.app.document.addImage(resultBlob, { title: `Smart Crop - ${activeFix.title}` });
            setStatus({ text: "Result added to the canvas.", type: "success" });
        } catch (error) {
            console.error("Add to canvas error:", error);
            setStatus({ text: error.message || "Could not add the processed image to the canvas.", type: "error" });
        }
    }, [activeFix.title, addOnUISdk, resultBlob]);

    return (
        <Theme system="express" scale="medium" color="light">
            <div className="container">
                <div className="hero">
                    <p className="eyebrow">Adobe Express Add-On</p>
                    <h2 className="title">Smart Crop Recomposer</h2>
                    <p className="subtitle">Make awkward image framing feel designed, balanced, and ready for real content.</p>
                </div>

                <div className="panel-card">
                    <div className="section-header">
                        <div>
                            <p className="section-kicker">Step 1</p>
                            <p className="section-title">Find your image</p>
                        </div>
                        <button className="secondary-btn" onClick={inspectSelection} disabled={loading}>
                            Check Selection
                        </button>
                    </div>

                    <div className={`selection-summary${selectionState.isImage ? " selection-summary--ready" : ""}`}>
                        {selectionState.checked ? (
                            selectionState.isImage ? (
                                <span>Canvas image selected{selectionState.nodeType ? `: ${selectionState.nodeType}` : ""}</span>
                            ) : selectionState.hasSelection ? (
                                <span>Current selection is not an image{selectionState.nodeType ? `: ${selectionState.nodeType}` : ""}</span>
                            ) : (
                                <span>No canvas image selected yet</span>
                            )
                        ) : (
                            <span>Use the current Express selection for the fastest workflow</span>
                        )}
                    </div>

                    <div
                        className={
                            "upload-zone" +
                            (dragOver ? " upload-zone--dragover" : "") +
                            (previewUrl ? " upload-zone--has-image" : "")
                        }
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                    >
                        {previewUrl ? (
                            <div className="preview-wrapper">
                                <img className="preview-img" src={previewUrl} alt="Uploaded preview" />
                                <button
                                    className="preview-remove"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        removeUploadedImage();
                                    }}
                                    title="Remove image"
                                >
                                    x
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="upload-illustration" />
                                <span className="upload-label">No usable canvas image? Drop one here or browse.</span>
                                <span className="upload-hint">JPEG, PNG, or WebP up to 15 MB</span>
                            </>
                        )}
                        {!previewUrl && (
                            <input
                                ref={fileInputRef}
                                className="upload-input"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleInputChange}
                            />
                        )}
                    </div>
                </div>

                <div className="panel-card">
                    <div className="section-header">
                        <div>
                            <p className="section-kicker">Step 2</p>
                            <p className="section-title">Choose the fix</p>
                        </div>
                    </div>

                    <div className="fix-grid">
                        {FIXES.map((fix) => (
                            <button
                                key={fix.value}
                                className={`fix-card${selectedFix === fix.value ? " fix-card--active" : ""}`}
                                onClick={() => setSelectedFix(fix.value)}
                                disabled={loading}
                            >
                                <span className="fix-badge">{fix.badge}</span>
                                <span className="fix-title">{fix.title}</span>
                                <span className="fix-description">{fix.description}</span>
                            </button>
                        ))}
                    </div>

                    <div className="recommendation">
                        <p className="recommendation-label">Why this works</p>
                        <p className="recommendation-text">{activeFix.reason}</p>
                    </div>

                    <button
                        className="primary-btn"
                        onClick={handleApplyFix}
                        disabled={loading || (!selectionState.isImage && !uploadedFile)}
                    >
                        {loading ? "Applying Fix..." : `Apply ${activeFix.title}`}
                    </button>
                </div>

                <p className={`status status--${status.type}`}>{status.text}</p>

                {loading && (
                    <div className="progress-track">
                        <div className="progress-fill" />
                    </div>
                )}

                {resultUrl && (
                    <div className="result-section">
                        <div className="section-header">
                            <div>
                                <p className="section-kicker">Result</p>
                                <p className="section-title">Processed preview</p>
                            </div>
                            {selectionState.isImage ? (
                                <span className="result-note">Already applied to the canvas selection</span>
                            ) : (
                                <button className="secondary-btn" onClick={handleAddToCanvas}>
                                    Add to Canvas
                                </button>
                            )}
                        </div>
                        <img className="result-img" src={resultUrl} alt="Processed result" />
                    </div>
                )}
            </div>
        </Theme>
    );
};

export default App;
