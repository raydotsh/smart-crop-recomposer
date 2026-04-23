const BACKEND_URL = "http://localhost:3000/recompose";

const dropZone = document.getElementById("dropZone");
const imageInput = document.getElementById("imageInput");
const browseBtn = document.getElementById("browseBtn");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const imagePreview = document.getElementById("imagePreview");
const removeImgBtn = document.getElementById("removeImgBtn");
const layoutSelect = document.getElementById("layoutSelect");
const recomposeBtn = document.getElementById("recomposeBtn");
const resultModal = document.getElementById("resultModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const resultImage = document.getElementById("resultImage");
const downloadBtn = document.getElementById("downloadBtn");
const loader = document.querySelector(".loader");
const btnText = document.querySelector(".btn-text");

let currentFile = null;
let currentResultBlobUrl = null;

// Handle Drag and Drop
["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});
function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

["dragenter", "dragover"].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add("dragover"), false);
});
["dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove("dragover"), false);
});

dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
});

browseBtn.addEventListener("click", () => imageInput.click());
dropZone.addEventListener("click", (e) => {
    if (e.target !== removeImgBtn) imageInput.click();
});
imageInput.addEventListener("change", function () { handleFiles(this.files); });

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const VALID_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        if (!VALID_TYPES.has(file.type)) {
            alert(`Unsupported file type: ${file.type}. Please upload a JPEG, PNG or WebP image.`);
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            alert("File is too large. Maximum size is 15MB.");
            return;
        }
        currentFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreviewContainer.classList.remove("hidden");
            recomposeBtn.disabled = false;
        };
        reader.readAsDataURL(currentFile);
    }
}

removeImgBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    currentFile = null;
    imageInput.value = "";
    imagePreview.src = "";
    imagePreviewContainer.classList.add("hidden");
    recomposeBtn.disabled = true;
});

// Call Backend
recomposeBtn.addEventListener("click", async () => {
    if (!currentFile) return;

    btnText.classList.add("hidden");
    loader.classList.remove("hidden");
    recomposeBtn.disabled = true;

    const formData = new FormData();
    formData.append("image", currentFile);
    formData.append("layout", layoutSelect.value);

    try {
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("Processing failed: " + response.statusText);

        const blob = await response.blob();
        if (currentResultBlobUrl) URL.revokeObjectURL(currentResultBlobUrl);
        currentResultBlobUrl = URL.createObjectURL(blob);

        resultImage.src = currentResultBlobUrl;
        resultModal.classList.remove("hidden");

    } catch (err) {
        alert("Error: Make sure the backend server is running and accessible at " + BACKEND_URL);
        console.error(err);
    } finally {
        btnText.classList.remove("hidden");
        loader.classList.add("hidden");
        recomposeBtn.disabled = false;
    }
});

// Modal specific logic
closeModalBtn.addEventListener("click", () => {
    resultModal.classList.add("hidden");
});

resultModal.addEventListener("click", (e) => {
    if (e.target === resultModal) resultModal.classList.add("hidden");
});

downloadBtn.addEventListener("click", () => {
    if (!currentResultBlobUrl) return;
    const a = document.createElement("a");
    a.href = currentResultBlobUrl;
    a.download = "recomposed-" + layoutSelect.value + ".jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});
