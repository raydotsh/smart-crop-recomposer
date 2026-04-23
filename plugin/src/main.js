const BACKEND_URL = "http://localhost:3000/recompose";

const layoutSelect = document.getElementById("layoutSelect");
const recomposeButton = document.getElementById("recomposeButton");
const selectImageButton = document.getElementById("selectImageButton");
const loadingIndicator = document.getElementById("loadingIndicator");
const statusMessage = document.getElementById("statusMessage");
const selectionSummary = document.getElementById("selectionSummary");

function setStatus(message, tone = "") {
  statusMessage.textContent = message;
  if (tone) {
    statusMessage.dataset.tone = tone;
  } else {
    delete statusMessage.dataset.tone;
  }
}

function setLoading(isLoading) {
  recomposeButton.disabled = isLoading;
  selectImageButton.disabled = isLoading;
  loadingIndicator.classList.toggle("hidden", !isLoading);
}

function getSdk() {
  return globalThis.addOnUISdk || globalThis.addOnSdk || globalThis.uxp?.addOnUISdk || null;
}

async function getSelectedNodes() {
  const sdk = getSdk();
  const documentApi = sdk?.app?.document || sdk?.document;

  if (!documentApi) {
    throw new Error("Adobe Express document API is not available in this environment.");
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

  throw new Error("Could not read the current selection from Adobe Express.");
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

  return candidates.some((value) => value.includes("image") || value.includes("bitmap"));
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

    if (result?.arrayBuffer instanceof Function) {
      return new Blob([await result.arrayBuffer()], { type: "image/jpeg" });
    }
  }

  throw new Error("The selected image could not be exported from Adobe Express.");
}

async function replaceNodeImage(node, blob) {
  const sdk = getSdk();
  const documentApi = sdk?.app?.document || sdk?.document;

  if (typeof node?.replaceImage === "function") {
    await node.replaceImage(blob);
    return;
  }

  if (typeof node?.replaceWithImage === "function") {
    await node.replaceWithImage(blob);
    return;
  }

  if (typeof documentApi?.replaceImage === "function") {
    await documentApi.replaceImage(node, blob);
    return;
  }

  throw new Error("Could not replace the selected image on the canvas.");
}

async function inspectSelection() {
  const nodes = await getSelectedNodes();
  if (!nodes.length) {
    selectionSummary.textContent = "No selected node found.";
    return null;
  }

  const imageNode = nodes.find(isImageNode) || nodes[0];
  const typeLabel = imageNode?.type || imageNode?.kind || "selected node";
  selectionSummary.textContent = `Ready to process: ${typeLabel}`;
  return imageNode;
}

async function recomposeSelectedImage() {
  setStatus("");
  setLoading(true);

  try {
    const node = await inspectSelection();
    if (!node) {
      throw new Error("Please select an image first.");
    }

    if (!isImageNode(node)) {
      throw new Error("The current selection is not recognized as an image.");
    }

    const imageBlob = await exportNodeImage(node);
    const payload = new FormData();
    payload.append("image", imageBlob, "selected-image.jpg");
    payload.append("layout", layoutSelect.value);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let backendResponse;
    try {
      backendResponse = await fetch(BACKEND_URL, {
        method: "POST",
        body: payload,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!backendResponse.ok) {
      throw new Error(`Processing failed with status ${backendResponse.status}.`);
    }

    const resultBlob = await backendResponse.blob();
    if (!resultBlob.size) {
      throw new Error("Backend returned an empty image.");
    }

    await replaceNodeImage(node, resultBlob);
    setStatus("Image recomposed successfully.", "success");
  } catch (error) {
    console.error(error);

    if (String(error.message || "").includes("fetch")) {
      setStatus("Could not reach processing server. Make sure the backend is running.", "error");
    } else {
      setStatus(error.message || "Something went wrong while recomposing the image.", "error");
    }
  } finally {
    setLoading(false);
  }
}

selectImageButton.addEventListener("click", async () => {
  setStatus("");

  try {
    const node = await inspectSelection();
    if (!node) {
      setStatus("Please select an image first.", "error");
      return;
    }

    if (!isImageNode(node)) {
      setStatus("The current selection is not an image.", "error");
      return;
    }

    setStatus("Image selection looks valid.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not read the current selection.", "error");
  }
});

recomposeButton.addEventListener("click", recomposeSelectedImage);
