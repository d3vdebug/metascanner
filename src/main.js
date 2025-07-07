import './style.css';

// Firebase configuration - Replace with your actual API Key if using a different project
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

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
const uploadFileLabel = document.getElementById('uploadFileLabel'); 
const analyzeImageAIBtn = document.getElementById('analyzeImageAIBtn');
const aiAnalysisOutput = document.getElementById('aiAnalysisOutput');

// --- Profile and Nav Elements ---
const profileIcon = document.getElementById('profileIcon');
const profileDropdownContent = document.getElementById('profileDropdownContent');
const currentUserEmailSpan = document.getElementById('currentUserEmail'); 
const logoutBtn = document.getElementById('logoutBtn'); 
const hamburgerMenu = document.getElementById('hamburgerMenu'); 
const navbarLinks = document.getElementById('navbarLinks'); 

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

// --- Authentication and User Functions ---

auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'auth.html'; 
    } else {
        currentUserEmailSpan.textContent = `USER: ${user.email.toUpperCase()}`;
    }
});

const performLogout = async () => {
    showMessage("LOGGING OUT...", 'info');
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Sign out error:", error);
        showMessage(`LOGOUT ERROR: ${error.message.toUpperCase()}`, 'error');
    }
};

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
            if (width > height) {
                if (width > maxDimension) {
                    height = Math.round(height * (maxDimension / width));
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width = Math.round(width * (maxDimension / height));
                    height = maxDimension;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
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
  document.getElementById('viewOnGoogleMapsBtn').classList.add('hidden'); 
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
}

// --- API and Data Processing Functions ---

async function reverseGeocode(lat, lon) {
    if (!OPENCAGE_API_KEY) { 
        console.warn("OpenCage API Key not configured.");
        reversedGeocodingOutput.innerHTML = `<p><em>REVERSE GEOCODING API KEY MISSING.</em></p>`;
        reversedGeocodingOutput.classList.remove('hidden');
        return 'API Key Missing';
    }
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${OPENCAGE_API_KEY}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.results && data.results.length > 0 && data.results[0].formatted) {
            const formatted = data.results[0].formatted;
            reversedGeocodingOutput.innerHTML = `<p>${formatted}</p>`;
            reversedGeocodingOutput.classList.remove('hidden');
            return formatted;
        }
        reversedGeocodingOutput.innerHTML = `<p><em>NO HUMAN-READABLE LOCATION FOUND.</em></p>`;
        reversedGeocodingOutput.classList.remove('hidden');
        return 'Location Not Found';
    } catch (error) {
        console.error("Error during reverse geocoding:", error);
        reversedGeocodingOutput.innerHTML = `<p><em>REVERSE GEOCODING ERROR.</em></p>`;
        reversedGeocodingOutput.classList.remove('hidden');
        return 'Geocoding Error';
    }
}

async function saveHistory(lat, lon, address, metadata, imagePreview) {
    const user = auth.currentUser;
    if (!user) return;
    
    const newHistoryItem = {
        latitude: lat,
        longitude: lon,
        address: address || 'Unknown Location',
        timestamp: new Date(),
        metadata: metadata || {},
        imagePreview: imagePreview || null
    };

    const historyRef = db.collection('userHistory').doc(user.uid);

    try {
        const doc = await historyRef.get();
        if (doc.exists) {
            const existingHistory = doc.data().history || [];
            const updatedHistory = [newHistoryItem, ...existingHistory];
            if (updatedHistory.length > 50) {
                updatedHistory.length = 50;
            }
            await historyRef.update({ history: updatedHistory });
        } else {
            await historyRef.set({ history: [newHistoryItem] });
        }
        console.log("History saved successfully to Firestore.");
    } catch (error) {
        console.error("Error saving history to Firestore:", error);
    }
}

function extractAndFormatMetadata(data, fileSize, address) {
  const newMetadata = {}; 
  if (data?.latitude && data?.longitude) {
    newMetadata['Coordinates'] = `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`;
  }
  if (address && address !== 'Location Not Found' && address !== 'Geocoding Error' && address !== 'API Key Missing') {
    newMetadata['REVERSED GEOLOCATION'] = address.trim();
  }
  if (fileSize !== undefined && fileSize !== null) {
    newMetadata['File Size'] = formatBytes(fileSize);
  }
  const metaToProcess = {
    'Make': data?.Make, 'Model': data?.Model, 'Date/Time Original': data?.DateTimeOriginal, 'Exposure Time': data?.ExposureTime ? `${data.ExposureTime}s` : null, 'F-Number': data?.FNumber ? `f/${data.FNumber}` : null, 'ISO Speed Ratings': data?.ISOSpeedRatings, 'Focal Length': data?.FocalLength ? `${data.FocalLength}mm` : null, 'GPS Altitude': data?.GPSAltitude ? `${data.GPSAltitude.toFixed(2)}m` : null, 'GPS Speed': data?.GPSSpeed ? `${data.GPSSpeed.toFixed(2)} km/h` : null, 'GPS Image Direction': data?.GPSImgDirection ? `${data.GPSImgDirection.toFixed(2)}°` : null, 'GPS DOP (Precision)': data?.GPSDOP ? data.GPSDOP.toFixed(2) : null, 'Lens Make': data?.LensMake, 'Lens Model': data?.LensModel, 'Software': data?.Software, 'Orientation': data?.Orientation, 'Color Space': data?.ColorSpace, 'Pixel X Dimension': data?.PixelXDimension, 'Pixel Y Dimension': data?.PixelYDimension, 'X Resolution': data?.XResolution ? `${data.XResolution} DPI` : null, 'Y Resolution': data?.YResolution ? `${data.YResolution} DPI` : null, 'Creator': data?.Creator, 'Headline': data?.Headline, 'Description': data?.Description, 'Copyright': data?.Copyright, 'Flash': data?.Flash ? (data.Flash & 1 ? 'FLASH FIRED' : 'FLASH NOT FIRED') : null, 'Image Width': data?.ImageWidth, 'Image Height': data?.ImageHeight,
  };
  for (const [key, value] of Object.entries(metaToProcess)) {
    if (value !== undefined && value !== null && value !== '') {
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
  reader.onload = (e) => {
    uploadedImagePreview.src = e.target.result;
    uploadedImagePreview.classList.remove('hidden');
    currentImageBase64 = e.target.result.split(',')[1];
  };
  reader.readAsDataURL(file);

  try {
    const exifData = await exifr.parse(file, { iptc: true, xmp: true });
    rawExifData = exifData || {}; 
    clearMessage();
    const lat = exifData?.latitude;
    const lon = exifData?.longitude;
    let address = 'Location Not Found';
    let compressedPreview = null;

    if (currentImageBase64) {
        try {
            compressedPreview = await compressImage(currentImageBase64);
        } catch (compressionError) {
            console.warn("Image compression failed:", compressionError);
        }
    }
    
    if (typeof lat === 'number' && typeof lon === 'number') {
        currentLatLng = { lat, lon };
        updateMapHeaderCoordinates(lat, lon);
        const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
        coordinatesTextDiv.innerHTML = `<p>GPS COORDINATES: <span>${lat.toFixed(6)}, ${lon.toFixed(6)}</span></p>`;
        
        address = await reverseGeocode(lat, lon);

        viewOnGoogleMapsBtn.classList.remove('hidden');
        viewOnGoogleMapsBtn.onclick = () => window.open(gmapsLink, '_blank');
        
        if (map) {
            map.setView([lat, lon], 15);
            if (marker) { marker.remove(); }
        } else {
            map = L.map("map").setView([lat, lon], 15);
            currentTileLayer = tileLayers[mapTypeSelect.value].addTo(map);
        }
        marker = L.marker([lat, lon], { icon: customGreenIcon }).addTo(map).bindPopup("IMAGE LOCATION").openPopup();
    } else {
        showMessage("NOTICE: GPS DATA NOT FOUND IN IMAGE.", 'info');
        initializeWorldMap();
        coordinatesTextDiv.innerHTML = `<p>GPS COORDINATES: <span>NOT FOUND</span></p>`;
        reversedGeocodingOutput.innerHTML = `<p><em>NO REVERSED GEOLOCATION DATA.</em></p>`; 
        reversedGeocodingOutput.classList.remove('hidden'); 
        viewOnGoogleMapsBtn.classList.add('hidden');
    }

    const formattedMetadata = extractAndFormatMetadata(exifData, file.size, address);
    extractedMetadata = formattedMetadata;
    await saveHistory(lat, lon, address, formattedMetadata, compressedPreview);

    infoSection.classList.remove('hidden');
    updateMetadataDisplay();

    if (Object.keys(extractedMetadata).length > 0 || Object.keys(rawExifData).length > 0) {
        downloadPdfBtn.classList.remove('hidden');
        exportJsonBtn.classList.remove('hidden');
        toggleRawMetadataBtn.classList.remove('hidden'); 
        showMessage("ANALYSIS COMPLETE. DATA RETRIEVED.", 'toast-success');
    } else {
        downloadPdfBtn.classList.add('hidden'); 
        exportJsonBtn.classList.add('hidden');
        toggleRawMetadataBtn.classList.add('hidden'); 
        showMessage("ANALYSIS COMPLETE. NO METADATA FOUND.", 'toast-success');
    }
    
    if (currentImageBase64) {
        analyzeImageAIBtn.classList.remove('hidden');
        analyzeImageAIBtn.onclick = () => analyzeImageAI(currentImageBase64, address, currentLatLng);
    } else {
        analyzeImageAIBtn.classList.add('hidden');
    }

  } catch (err) {
    console.error("File processing error:", err); 
    showMessage(`ERROR: ${err.message.toUpperCase()}. FILE PROCESSING FAILED.`, 'error');
    resetApplication();
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
    let metadataFound = false;
    const orderedKeys = ['Coordinates', 'REVERSED GEOLOCATION', ...Object.keys(extractedMetadata).filter(k => k !== 'Coordinates' && k !== 'REVERSED GEOLOCATION').sort()];
    for (const key of orderedKeys) { 
        const value = extractedMetadata[key];
        if (value !== undefined && value !== null && value !== '') {
            metadataDiv.innerHTML += `<p><strong>${key.toUpperCase()}:</strong> <span>${String(value).toUpperCase()}</span></p>`;
            metadataFound = true;
        }
    }
    if (!metadataFound) {
        metadataDiv.innerHTML = "<p class='italic'><em>NO METADATA FOUND.</em></p>";
    }
    toggleRawMetadataBtn.textContent = 'VIEW RAW DATA';
  }
}

// --- PDF and JSON Export Logic ---

function checkAndAddPage(doc, yPos, requiredSpace) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const bottomMargin = 40;
    if (yPos + requiredSpace > pageHeight - bottomMargin) {
        doc.addPage();
        return 40;
    }
    return yPos;
}

downloadPdfBtn.addEventListener("click", async () => {
    if (Object.keys(rawExifData).length === 0 && !currentImageBase64 && Object.keys(extractedMetadata).length === 0) {
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
        if (value !== undefined && value !== null && value !== '') {
            metadataLines.push(`${key.toUpperCase()}: ${String(value).toUpperCase()}`);
        }
    }
    if(metadataLines.length > 0) {
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
    try {
        const jsonString = JSON.stringify(rawExifData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'image_metadata.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage("JSON FILE EXPORTED.", 'toast-success');
    } catch (error) {
        console.error("Error exporting JSON:", error);
        showMessage(`ERROR EXPORTING JSON: ${error.message.toUpperCase()}`, 'error');
    }
}

// --- AI Image Analysis Function ---
async function analyzeImageAI(base64ImageData, locationName, coords) {
    if (!base64ImageData) {
        showMessage("NO IMAGE DATA AVAILABLE FOR AI ANALYSIS.", 'error');
        return;
    }
    aiAnalysisOutput.classList.remove('hidden');
    aiAnalysisOutput.innerHTML = `<div class="spinner"></div> ANALYZING IMAGE WITH AI...`;

    const prompt = `Analyze the content of this image. If GPS coordinates ${coords ? `${coords.lat}, ${coords.lon}` : 'are not available'} and location name "${locationName}" are provided, consider them in your analysis. Describe what you see in the image and how it relates to the given location, if applicable. Be concise and informative.`;
    
    try {
        const payload = {
            contents: [{
                role: "user",
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: "image/jpeg", data: base64ImageData } }
                ]
            }],
        };
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
        }
        
        const result = await response.json();

        if (result.candidates && result.candidates.length > 0) {
            const text = result.candidates[0].content.parts.map(part => part.text).join("");
            aiAnalysisOutput.innerHTML = `<p><strong>AI ANALYSIS:</strong> ${text}</p>`;
        } else {
            aiAnalysisOutput.innerHTML = `<p><strong>AI ANALYSIS:</strong> <em>UNABLE TO GENERATE ANALYSIS. The model did not return any candidates.</em></p>`;
            console.error("AI analysis response structure unexpected:", result);
        }
    } catch (error) {
        console.error("Error during AI image analysis:", error);
        aiAnalysisOutput.innerHTML = `<p><strong>AI ANALYSIS:</strong> <em>ERROR DURING ANALYSIS: ${error.message.toUpperCase()}.</em></p>`;
    }
}

// --- Event Listeners ---
logoutBtn.addEventListener('click', performLogout);
exportJsonBtn.addEventListener('click', exportMetadataAsJson);
mapTypeSelect.addEventListener('change', (e) => switchMapLayer(e.target.value));
toggleRawMetadataBtn.addEventListener('click', () => {
    isRawMetadataVisible = !isRawMetadataVisible; 
    updateMetadataDisplay(); 
});
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
input.addEventListener("change", function () {
    if (this.files.length > 0) processFile(this.files[0]);
});
resetBtn.addEventListener("click", resetApplication);

historyBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    historySidebar.classList.add('open');
    sidebarOverlay.classList.add('visible');
    profileDropdownContent.classList.remove('show'); 

    historyList.innerHTML = '<li>FETCHING HISTORY...</li>';
    try {
        const doc = await db.collection('userHistory').doc(user.uid).get();
        if (doc.exists) {
            userHistoryCache = doc.data().history || [];
            historyList.innerHTML = '';
            if (userHistoryCache.length === 0) {
                 historyList.innerHTML = '<li>NO HISTORY FOUND.</li>';
            } else {
                userHistoryCache.forEach((item, index) => {
                    const li = document.createElement('li');
                    li.dataset.index = index;
                    const date = item.timestamp.toDate().toLocaleString();
                    li.innerHTML = `<span class="history-address">${item.address}</span><span class="history-date">${date}</span>`;
                    historyList.appendChild(li);
                });
            }
        } else {
            historyList.innerHTML = '<li>NO HISTORY FOUND.</li>';
            userHistoryCache = [];
        }
    } catch (error) {
        console.error("Error fetching history:", error);
        historyList.innerHTML = '<li>ERROR LOADING HISTORY.</li>';
    }
});

closeHistoryBtn.addEventListener('click', closeHistorySidebar);
sidebarOverlay.addEventListener('click', closeHistorySidebar);

historyList.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li || li.dataset.index === undefined) return;

    resetApplication();

    const index = parseInt(li.dataset.index, 10);
    const item = userHistoryCache[index];
    if (!item) return;

    const lat = item.latitude;
    const lon = item.longitude;
    const address = item.address;

    if (typeof lat === 'number' && typeof lon === 'number') {
        if (map) {
            map.setView([lat, lon], 15);
            if (marker) { marker.setLatLng([lat, lon]); } 
            else { marker = L.marker([lat, lon], { icon: customGreenIcon }).addTo(map); }
            marker.bindPopup("SAVED LOCATION").openPopup();
        }
        updateMapHeaderCoordinates(lat, lon);
        coordinatesTextDiv.innerHTML = `<p>GPS COORDINATES: <span>${lat.toFixed(6)}, ${lon.toFixed(6)}</span></p>`;
        const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
        viewOnGoogleMapsBtn.classList.remove('hidden');
        viewOnGoogleMapsBtn.onclick = () => window.open(gmapsLink, '_blank');
    } else {
        updateMapHeaderCoordinates(null, null);
        coordinatesTextDiv.innerHTML = `<p>GPS COORDINATES: <span>NOT FOUND</span></p>`;
    }
    
    reversedGeocodingOutput.innerHTML = `<p>${address}</p>`;
    reversedGeocodingOutput.classList.remove('hidden');
    infoSection.classList.remove('hidden');

    if (item.imagePreview) {
        uploadedImagePreview.src = `data:image/jpeg;base64,${item.imagePreview}`;
        uploadedImagePreview.classList.remove('hidden');
    } else {
        uploadedImagePreview.classList.add('hidden');
    }

    if (item.metadata && Object.keys(item.metadata).length > 0) {
        extractedMetadata = item.metadata;
        rawExifData = {}; 
        updateMetadataDisplay();
        downloadPdfBtn.classList.remove('hidden'); 
    } else {
        extractedMetadata = {};
        updateMetadataDisplay();
        metadataDiv.innerHTML = "<p class='italic'><em>NO METADATA SAVED FOR THIS ENTRY.</em></p>";
    }

    toggleRawMetadataBtn.classList.add('hidden');
    exportJsonBtn.classList.add('hidden');
    
    // --- REVISED: AI Button Logic for History ---
    if (item.imagePreview) {
        // We have a saved image, so show the AI button and wire it up
        analyzeImageAIBtn.classList.remove('hidden');
        const historyCoords = (typeof lat === 'number' && typeof lon === 'number') ? { lat, lon } : null;
        analyzeImageAIBtn.onclick = () => analyzeImageAI(item.imagePreview, item.address, historyCoords);
        
        // Hide the output div until the user clicks the button
        aiAnalysisOutput.classList.add('hidden');
        aiAnalysisOutput.innerHTML = '';
    } else {
        // No saved image, so hide the AI button
        analyzeImageAIBtn.classList.add('hidden');
        aiAnalysisOutput.classList.add('hidden');
        aiAnalysisOutput.innerHTML = '';
    }

    closeHistorySidebar();
});


// --- Nav and Dropdown Toggles ---
hamburgerMenu.addEventListener('click', () => {
    navbarLinks.classList.toggle('open');
});

profileIcon.addEventListener('click', (event) => {
    profileDropdownContent.classList.toggle('show');
    event.stopPropagation(); 
    navbarLinks.classList.remove('open');
});

window.addEventListener('click', (event) => {
    if (!profileDropdownContent.contains(event.target) && !profileIcon.contains(event.target)) {
        profileDropdownContent.classList.remove('show');
    }
});

// --- Initial App Load ---
initializeWorldMap();