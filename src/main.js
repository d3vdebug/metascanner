import './style.css';

// Import modularized logic
import { initFirebaseAuth, performLogout, loadUserHistory, syncHistoryWithFirestore } from './firebase.js';
import { analyzeImageWithAI, initializeChatbot, resetChatbot } from './bot.js';

// --- DOM Elements ---
const input = document.getElementById("imgInput");
const resetBtn = document.getElementById("resetBtn");
const historyBtn = document.getElementById("historyBtn");
const historySidebar = document.getElementById("historySidebar");
const closeHistoryBtn = document.getElementById("closeHistoryBtn");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const historyList = document.getElementById("historyList");
const coordinatesTextDiv = document.getElementById("coordinates-text"); 
const reversedGeocodingOutput = document.getElementById("reversedGeocodingOutput"); 
const metadataDiv = document.getElementById("metadata");
const infoSection = document.getElementById("infoSection");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const exportJsonBtn = document.getElementById('exportJsonBtn');
const messageBox = document.getElementById("messageBox");
const uploadedImagePreview = document.getElementById("uploadedImagePreview");
const toggleRawMetadataBtn = document.getElementById("toggleRawMetadataBtn"); 
const rawMetadataOutput = document.getElementById("rawMetadataOutput");
const mapTypeSelect = document.getElementById("mapTypeSelect");
const mapHeaderCoords = document.getElementById("mapHeaderCoords"); 
const toastNotification = document.getElementById("toastNotification"); 
const toastMessage = document.getElementById("toastMessage"); 
const viewOnGoogleMapsBtn = document.getElementById('viewOnGoogleMapsBtn'); 
const analyzeImageAIBtn = document.getElementById('analyzeImageAIBtn');
const aiAnalysisOutput = document.getElementById('aiAnalysisOutput');

// --- Profile and Nav Elements ---
const profileIcon = document.getElementById('profileIcon');
const profileDropdownContent = document.getElementById('profileDropdownContent');
const currentUserEmailSpan = document.getElementById('currentUserEmail'); 
const logoutBtn = document.getElementById('logoutBtn'); 
const hamburgerMenu = document.getElementById('hamburgerMenu'); 
const navbarLinks = document.getElementById('navbarLinks'); 

// --- Chatbot DOM Elements (Grouped for easier passing) ---
const chatbotElements = {
    toggle: document.getElementById('chatbotToggle'),
    window: document.getElementById('chatWindow'),
    close: document.getElementById('closeChat'),
    messages: document.getElementById('chatMessages'),
    input: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendMessageBtn')
};

const OPENCAGE_API_KEY = import.meta.env.VITE_OPENCAGE_API_KEY;

// --- Global State and Map Configuration ---
let map, marker, currentTileLayer;
let extractedMetadata = {};
let rawExifData = {};
let currentLatLng = null;
let isRawMetadataVisible = false;
let currentImageBase64 = null;
let userHistoryCache = [];

const customGreenIcon = L.divIcon({
    className: 'custom-marker-icon',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

const tileLayers = {
    'streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '', noWrap: true }),
    'satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '', noWrap: true }),
    'topography': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: '', noWrap: true })
};

// --- Authentication Flow ---
initFirebaseAuth(async (user) => {
    if (!user) {
        window.location.href = 'auth.html'; 
    } else {
        currentUserEmailSpan.textContent = `USER: ${user.email.toUpperCase()}`;
        try {
            userHistoryCache = await loadUserHistory(user);
            renderHistoryList();
        } catch (error) {
            showMessage(error.message.toUpperCase(), 'error');
            userHistoryCache = [];
            renderHistoryList();
        }
    }
});

logoutBtn.addEventListener('click', async () => {
    showMessage("LOGGING OUT...", 'info');
    try {
        await performLogout();
    } catch (error) {
        console.error("Sign out error:", error);
        showMessage(`LOGOUT ERROR: ${error.message.toUpperCase()}`, 'error');
    }
});

// --- UI and Helper Functions ---
function showMessage(message, type = 'info') {
  clearMessage();
  if (type === 'toast-success') {
    toastMessage.textContent = message;
    toastNotification.classList.add('show');
    setTimeout(() => toastNotification.classList.remove('show'), 3000);
  } else {
    messageBox.className = 'p-5 rounded-lg shadow-xl text-lg text-center max-w-md w-full mx-auto flex items-center justify-content: center;'; 
    messageBox.innerHTML = '';
    if (type === 'info') {
      messageBox.classList.add('info-message');
      messageBox.innerHTML = `<div class="spinner"></div> ${message}`;
    } else if (type === 'error') {
      messageBox.classList.add('error-message');
      messageBox.innerHTML = message;
    }
    messageBox.classList.remove('hidden');
  }
}

function clearMessage() {
  messageBox.classList.add('hidden');
  messageBox.innerHTML = '';
  toastNotification.classList.remove('show');
  toastMessage.textContent = '';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 BYTES';
  const k = 1024;
  const sizes = ['BYTES', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function compressImage(base64String, quality = 0.7, maxDimension = 500) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = `data:image/jpeg;base64,${base64String}`;
        img.onload = () => {
            let { width, height } = img;
            if (width > height) { if (width > maxDimension) { height = Math.round(height * (maxDimension / width)); width = maxDimension; } }
            else { if (height > maxDimension) { width = Math.round(width * (maxDimension / height)); height = maxDimension; } }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64.split(',')[1]);
        };
        img.onerror = (error) => {
            console.error("Error loading image for compression:", error);
            reject("Could not compress image.");
        };
    });
}

function updateMapHeaderCoordinates(lat, lon) {
    mapHeaderCoords.innerHTML = (lat !== null && lon !== null)
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe" style="display: inline-block; vertical-align: middle; margin-right: 5px;"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> ${lat.toFixed(6)}, ${lon.toFixed(6)}`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe" style="display: inline-block; vertical-align: middle; margin-right: 5px;"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> NO GPS DATA`;
}

function initializeWorldMap() {
  if (map) map.remove();
  map = L.map("map").setView([0, 0], 2);
  mapTypeSelect.value = 'satellite'; 
  currentTileLayer = tileLayers[mapTypeSelect.value].addTo(map);
  marker = null;
  updateMapHeaderCoordinates(null, null);
  viewOnGoogleMapsBtn.classList.add('hidden');
  analyzeImageAIBtn.classList.add('hidden');
  aiAnalysisOutput.classList.add('hidden');
  aiAnalysisOutput.innerHTML = '';
}

function switchMapLayer(type) {
    if (map && currentTileLayer) map.removeLayer(currentTileLayer);
    currentTileLayer = tileLayers[type].addTo(map);
}

function closeHistorySidebar() {
    historySidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
}

function resetApplication() {
  input.value = '';
  uploadedImagePreview.src = '';
  uploadedImagePreview.classList.add('hidden');
  viewOnGoogleMapsBtn.classList.add('hidden'); 
  coordinatesTextDiv.innerHTML = "";
  reversedGeocodingOutput.innerHTML = "";
  reversedGeocodingOutput.classList.add('hidden');
  infoSection.classList.add('hidden');
  closeHistorySidebar();
  downloadPdfBtn.classList.add('hidden');
  exportJsonBtn.classList.add('hidden');
  toggleRawMetadataBtn.classList.add('hidden'); 
  isRawMetadataVisible = false; 
  rawMetadataOutput.classList.add('hidden'); 
  rawMetadataOutput.innerHTML = ''; 
  extractedMetadata = {};
  rawExifData = {}; 
  currentLatLng = null;
  currentImageBase64 = null;
  clearMessage();
  initializeWorldMap();
  updateMetadataDisplay();
  profileDropdownContent.classList.remove('show');
  
  analyzeImageAIBtn.classList.add('hidden');
  aiAnalysisOutput.classList.add('hidden');
  aiAnalysisOutput.innerHTML = '';
  chatbotElements.toggle.classList.remove('visible');
  chatbotElements.window.classList.remove('open');
  resetChatbot();
}

// --- API and Data Processing Functions ---
async function reverseGeocode(lat, lon) {
    if (!OPENCAGE_API_KEY) { 
        console.warn("OpenCage API Key not configured.");
        reversedGeocodingOutput.innerHTML = `<p><em>REVERSE GEOCODING API KEY MISSING.</em></p>`;
        return 'API Key Missing';
    }
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${OPENCAGE_API_KEY}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.results?.[0]?.formatted) {
            const formatted = data.results[0].formatted;
            reversedGeocodingOutput.innerHTML = `<p>${formatted}</p>`;
            return formatted;
        }
        reversedGeocodingOutput.innerHTML = `<p><em>NO HUMAN-READABLE LOCATION FOUND.</em></p>`;
        return 'Location Not Found';
    } catch (error) {
        console.error("Error during reverse geocoding:", error);
        reversedGeocodingOutput.innerHTML = `<p><em>REVERSE GEOCODING ERROR.</em></p>`;
        return 'Geocoding Error';
    } finally {
        reversedGeocodingOutput.classList.remove('hidden');
    }
}

function extractAndFormatMetadata(data, fileSize, address) {
  const newMetadata = {}; 
  if (data?.latitude && data?.longitude) {
    newMetadata['Coordinates'] = `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`;
  }
  if (address && !['Location Not Found', 'Geocoding Error', 'API Key Missing'].includes(address)) {
    newMetadata['REVERSED GEOLOCATION'] = address.trim();
  }
  if (fileSize !== undefined && fileSize !== null) {
    newMetadata['File Size'] = formatBytes(fileSize);
  }
  const metaToProcess = {
    'Make': data?.Make, 'Model': data?.Model, 'Date/Time Original': data?.DateTimeOriginal, 'Exposure Time': data?.ExposureTime ? `${data.ExposureTime}s` : null, 'F-Number': data?.FNumber ? `f/${data.FNumber}` : null, 'ISO Speed Ratings': data?.ISOSpeedRatings, 'Focal Length': data?.FocalLength ? `${data.FocalLength}mm` : null, 'GPS Altitude': data?.GPSAltitude ? `${data.GPSAltitude.toFixed(2)}m` : null, 'Software': data?.Software
  };
  for (const [key, value] of Object.entries(metaToProcess)) {
    if (value) {
        let displayValue = value;
        if (value instanceof Date) {
            displayValue = value.toLocaleString('en-US', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        newMetadata[key] = String(displayValue).toUpperCase();
    }
  }
  return newMetadata;
}

async function processFile(file) {
  if (!file) return;
  resetApplication(); 
  showMessage("ANALYZING IMAGE DATA...", 'info');
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
        const imageDataUrl = e.target.result;
        const fullResBase64 = imageDataUrl.split(',')[1];
        
        const [compressedData, exifData] = await Promise.all([
            compressImage(fullResBase64).catch(err => { console.warn(err); return null; }),
            exifr.parse(file, { iptc: true, xmp: true })
        ]);

        currentImageBase64 = compressedData;
        rawExifData = exifData || {};

        clearMessage();
        uploadedImagePreview.src = imageDataUrl;
        uploadedImagePreview.classList.remove('hidden');

        const { latitude: lat, longitude: lon } = rawExifData;
        let address = 'Location Not Found';

        if (typeof lat === 'number' && typeof lon === 'number') {
            currentLatLng = { lat, lon };
            updateMapHeaderCoordinates(lat, lon);
            coordinatesTextDiv.innerHTML = `<p>GPS COORDINATES: <span>${lat.toFixed(6)}, ${lon.toFixed(6)}</span></p>`;
            address = await reverseGeocode(lat, lon);
            viewOnGoogleMapsBtn.classList.remove('hidden');
            viewOnGoogleMapsBtn.onclick = () => window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`, '_blank');
            map.setView([lat, lon], 15);
            if (marker) marker.remove();
            marker = L.marker([lat, lon], { icon: customGreenIcon }).addTo(map).bindPopup("IMAGE LOCATION").openPopup();
        } else {
            showMessage("NOTICE: GPS DATA NOT FOUND IN IMAGE.", 'info');
            initializeWorldMap();
            coordinatesTextDiv.innerHTML = `<p>GPS COORDINATES: <span>NOT FOUND</span></p>`;
            reversedGeocodingOutput.innerHTML = `<p><em>NO REVERSED GEOLOCATION DATA.</em></p>`; 
            reversedGeocodingOutput.classList.remove('hidden');
        }

        extractedMetadata = extractAndFormatMetadata(rawExifData, file.size, address);
        
        userHistoryCache.unshift({ latitude: lat, longitude: lon, address, timestamp: new Date(), metadata: extractedMetadata, imagePreview: currentImageBase64 });
        if (userHistoryCache.length > 50) userHistoryCache.pop();
        await syncHistoryWithFirestore(userHistoryCache).catch(err => showMessage(err.message.toUpperCase(), 'error'));
        
        renderHistoryList();
        infoSection.classList.remove('hidden');
        updateMetadataDisplay();

        if (Object.keys(extractedMetadata).length > 0) {
            downloadPdfBtn.classList.remove('hidden');
            exportJsonBtn.classList.remove('hidden');
            toggleRawMetadataBtn.classList.remove('hidden');
            showMessage("ANALYSIS COMPLETE.", 'toast-success');
        } else {
            showMessage("ANALYSIS COMPLETE. NO METADATA FOUND.", 'toast-success');
        }
        
        if (currentImageBase64) {
            analyzeImageAIBtn.classList.remove('hidden');
            analyzeImageAIBtn.onclick = () => handleAIAnalysis(address);
        }
        chatbotElements.toggle.classList.add('visible');
        initializeChatbot(chatbotElements, () => ({ extractedMetadata, currentImageBase64 }));

    } catch (err) {
        console.error("File processing error:", err);
        showMessage(`ERROR: ${err.message.toUpperCase()}. FILE FAILED.`, 'error');
        resetApplication();
    }
  };
  reader.readAsDataURL(file);
}

async function handleAIAnalysis(address) {
    if (!currentImageBase64) {
        showMessage("NO IMAGE DATA FOR AI ANALYSIS.", 'error');
        return;
    }
    aiAnalysisOutput.classList.remove('hidden');
    aiAnalysisOutput.innerHTML = `<div class="spinner"></div> ANALYZING IMAGE WITH AI...`;
    try {
        const analysisText = await analyzeImageWithAI(currentImageBase64, address, currentLatLng);
        aiAnalysisOutput.innerHTML = `<p><strong>AI ANALYSIS:</strong> ${analysisText}</p>`;
    } catch (error) {
        console.error("Error during AI analysis:", error);
        aiAnalysisOutput.innerHTML = `<p><strong>AI ANALYSIS:</strong> <em>ERROR: ${error.message.toUpperCase()}.</em></p>`;
    }
}
      
function updateMetadataDisplay() {
  if (isRawMetadataVisible) {
    metadataDiv.classList.add('hidden');
    rawMetadataOutput.classList.remove('hidden');
    rawMetadataOutput.textContent = JSON.stringify(rawExifData, null, 2);
    toggleRawMetadataBtn.textContent = 'HIDE RAW DATA';
  } else {
    rawMetadataOutput.classList.add('hidden');
    metadataDiv.classList.remove('hidden');
    metadataDiv.innerHTML = ''; 
    const orderedKeys = ['Coordinates', 'REVERSED GEOLOCATION', ...Object.keys(extractedMetadata).filter(k => !['Coordinates', 'REVERSED GEOLOCATION'].includes(k)).sort()];
    for (const key of orderedKeys) { 
        if (extractedMetadata[key]) {
            metadataDiv.innerHTML += `<p><strong>${key.toUpperCase()}:</strong> <span>${String(extractedMetadata[key]).toUpperCase()}</span></p>`;
        }
    }
    if (!metadataDiv.innerHTML.trim()) {
        metadataDiv.innerHTML = "<p class='italic'><em>NO METADATA FOUND.</em></p>";
    }
    toggleRawMetadataBtn.textContent = 'VIEW RAW DATA';
  }
}

// --- PDF and JSON Export Logic ---

// Helper function for jsPDF to handle page breaks
function checkAndAddPage(doc, yPos, requiredSpace) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const bottomMargin = 40;
    if (yPos + requiredSpace > pageHeight - bottomMargin) {
        doc.addPage();
        return 40; // New yPos on the new page
    }
    return yPos;
}

// THIS IS THE CORRECTED PDF EXPORT LISTENER
downloadPdfBtn.addEventListener("click", async () => {
    if (Object.keys(extractedMetadata).length === 0 && !currentImageBase64) {
        showMessage("NO DATA TO GENERATE PDF.", 'error');
        return;
    }
    showMessage("GENERATING PDF...", 'info');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'px', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 40;
    const maxWidth = pageW - (margin * 2);
    let yPos = 40;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text("Image Metadata Report", margin, yPos);
    yPos += 30;

    if (!uploadedImagePreview.classList.contains('hidden') && uploadedImagePreview.src) {
        try {
            const imgDataUrl = uploadedImagePreview.src;
            const mimeTypeMatch = imgDataUrl.match(/^data:image\/(\w+);base64,/);
            const format = mimeTypeMatch ? mimeTypeMatch[1].toUpperCase() : 'JPEG';
            const imgProps = doc.getImageProperties(imgDataUrl);
            let imgHeight = (imgProps.height * maxWidth) / imgProps.width;
            const maxHeightOnPage = doc.internal.pageSize.getHeight() - yPos - margin;
            yPos = checkAndAddPage(doc, yPos, Math.min(imgHeight, maxHeightOnPage));
            if (imgHeight > maxHeightOnPage) {
                imgHeight = maxHeightOnPage;
            }
            doc.addImage(imgDataUrl, format, margin, yPos, maxWidth, imgHeight);
            yPos += imgHeight + 20;
        } catch (e) {
            console.error("Error adding image to PDF:", e);
        }
    }

    const addSection = (title, contentLines, fontSize, titleFontSize = 14) => {
        yPos = checkAndAddPage(doc, yPos, 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(titleFontSize);
        doc.text(title, margin, yPos);
        yPos += titleFontSize + 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        contentLines.forEach(line => {
            const splitLines = doc.splitTextToSize(line, maxWidth);
            splitLines.forEach(splitLine => {
                yPos = checkAndAddPage(doc, yPos, fontSize * 1.2);
                doc.text(splitLine, margin, yPos);
                yPos += fontSize * 1.2;
            });
        });
        yPos += 15;
    };

    const metadataLines = [];
    const orderedKeys = ['Coordinates', 'REVERSED GEOLOCATION', ...Object.keys(extractedMetadata).filter(k => k !== 'Coordinates' && k !== 'REVERSED GEOLOCATION').sort()];
    for (const key of orderedKeys) {
        const value = extractedMetadata[key];
        if (value) {
            metadataLines.push(`${key.toUpperCase()}: ${String(value).toUpperCase()}`);
        }
    }
    if (metadataLines.length > 0) {
        addSection("Extracted Metadata", metadataLines, 9);
    }

    if (!aiAnalysisOutput.classList.contains('hidden') && aiAnalysisOutput.textContent.trim().length > 0 && !aiAnalysisOutput.querySelector('.spinner')) {
        const aiText = aiAnalysisOutput.textContent.replace('AI ANALYSIS:', '').trim();
        addSection("AI Image Analysis", [aiText], 9);
    }
    
    if (Object.keys(rawExifData).length > 0) {
        const rawText = JSON.stringify(rawExifData, null, 2);
        addSection("Raw Metadata (JSON)", [rawText], 6, 14);
    }

    doc.save("image_metadata_report.pdf");
    clearMessage();
    showMessage("PDF GENERATED SUCCESSFULLY.", 'toast-success');
});


function exportMetadataAsJson() {
    if (!rawExifData || Object.keys(rawExifData).length === 0) {
        showMessage("NO METADATA TO EXPORT.", 'error');
        return;
    }
    const jsonString = JSON.stringify(rawExifData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'image_metadata.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showMessage("JSON EXPORTED.", 'toast-success');
}

// --- Event Listeners ---
function renderHistoryList() {
    historyList.innerHTML = '';
    if (userHistoryCache.length === 0) {
        historyList.innerHTML = '<li>NO HISTORY FOUND.</li>';
        return;
    }
    userHistoryCache.forEach((item, index) => {
        const li = document.createElement('li');
        li.dataset.index = index;
        const date = item.timestamp instanceof Date ? item.timestamp.toLocaleString() : new Date(item.timestamp).toLocaleString();
        li.innerHTML = `
            <div class="history-item-content">
                <span class="history-address">${item.address || 'Unknown Location'}</span>
                <span class="history-date">${date}</span>
            </div>
            <button class="history-item-delete" data-delete-index="${index}" title="Delete Entry">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>`;
        historyList.appendChild(li);
    });
}

// Bind all major event listeners
input.addEventListener("change", (e) => processFile(e.target.files[0]));
resetBtn.addEventListener("click", resetApplication);
exportJsonBtn.addEventListener('click', exportMetadataAsJson);
mapTypeSelect.addEventListener('change', (e) => switchMapLayer(e.target.value));
toggleRawMetadataBtn.addEventListener('click', () => { isRawMetadataVisible = !isRawMetadataVisible; updateMetadataDisplay(); });
historyBtn.addEventListener('click', () => { historySidebar.classList.add('open'); sidebarOverlay.classList.add('visible'); });
closeHistoryBtn.addEventListener('click', closeHistorySidebar);
sidebarOverlay.addEventListener('click', closeHistorySidebar);
hamburgerMenu.addEventListener('click', () => {
    navbarLinks.classList.toggle('open');
    hamburgerMenu.classList.toggle('active');
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!navbarLinks.contains(e.target) && !hamburgerMenu.contains(e.target)) {
        navbarLinks.classList.remove('open');
        hamburgerMenu.classList.remove('active');
    }
});
profileIcon.addEventListener('click', (e) => { profileDropdownContent.classList.toggle('show'); e.stopPropagation(); });
window.addEventListener('click', (e) => { if (!profileDropdownContent.contains(e.target) && !profileIcon.contains(e.target)) profileDropdownContent.classList.remove('show'); });

document.body.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('drag-over'); });
document.body.addEventListener('dragleave', () => document.body.classList.remove('drag-over'));
document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        processFile(files[0]);
    } else {
        showMessage("ONLY IMAGE FILES ARE SUPPORTED.", 'error');
    }
});

historyList.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.history-item-delete');
    if (deleteBtn) {
        e.stopPropagation();
        const index = parseInt(deleteBtn.dataset.deleteIndex, 10);
        userHistoryCache.splice(index, 1);
        await syncHistoryWithFirestore(userHistoryCache);
        renderHistoryList();
        showMessage("History entry deleted.", 'toast-success');
        return;
    }
    
    const li = e.target.closest('li[data-index]');
    if (!li) return;

    resetApplication();

    const index = parseInt(li.dataset.index, 10);
    const item = userHistoryCache[index];
    if (!item) return;

    extractedMetadata = item.metadata || {};
    currentImageBase64 = item.imagePreview || null;
    rawExifData = {};

    const { latitude: lat, longitude: lon, address } = item;
    if (typeof lat === 'number' && typeof lon === 'number') {
        currentLatLng = { lat, lon };
        map.setView([lat, lon], 15);
        if (marker) marker.remove();
        marker = L.marker([lat, lon], { icon: customGreenIcon }).addTo(map).bindPopup("SAVED LOCATION").openPopup();
        updateMapHeaderCoordinates(lat, lon);
        coordinatesTextDiv.innerHTML = `<p>GPS COORDINATES: <span>${lat.toFixed(6)}, ${lon.toFixed(6)}</span></p>`;
        const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
        viewOnGoogleMapsBtn.classList.remove('hidden');
        viewOnGoogleMapsBtn.onclick = () => window.open(gmapsLink, '_blank');
    } else {
        currentLatLng = null;
        updateMapHeaderCoordinates(null, null);
        coordinatesTextDiv.innerHTML = `<p>GPS COORDINATES: <span>NOT FOUND</span></p>`;
    }

    reversedGeocodingOutput.innerHTML = `<p>${address || 'Address not available'}</p>`;
    reversedGeocodingOutput.classList.remove('hidden');
    infoSection.classList.remove('hidden');

    if (currentImageBase64) {
        uploadedImagePreview.src = `data:image/jpeg;base64,${currentImageBase64}`;
        uploadedImagePreview.classList.remove('hidden');
    }

    updateMetadataDisplay();
    if (Object.keys(extractedMetadata).length > 0) {
        downloadPdfBtn.classList.remove('hidden');
    }

    toggleRawMetadataBtn.classList.add('hidden');
    exportJsonBtn.classList.add('hidden');

    if (currentImageBase64) {
        analyzeImageAIBtn.classList.remove('hidden');
        analyzeImageAIBtn.onclick = () => handleAIAnalysis(address);
    }
    
    chatbotElements.toggle.classList.add('visible');
    initializeChatbot(chatbotElements, () => ({ extractedMetadata, currentImageBase64 }));

    closeHistorySidebar();
});


// --- Initial App Load ---
initializeWorldMap();