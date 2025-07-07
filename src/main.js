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
  
      // DOM Elements
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
      const analyzeImageAIBtn = document.getElementById('analyzeImageAIBtn'); // New AI button
      const aiAnalysisOutput = document.getElementById('aiAnalysisOutput'); // New AI output div
      
      // Profile and Logout Elements
      const profileIcon = document.getElementById('profileIcon');
      const profileDropdownContent = document.getElementById('profileDropdownContent');
      const currentUserEmailSpan = document.getElementById('currentUserEmail'); 
      const logoutBtn = document.getElementById('logoutBtn'); 
  
      const hamburgerMenu = document.getElementById('hamburgerMenu'); 
      const navbarLinks = document.getElementById('navbarLinks'); 
  
      const OPENCAGE_API_KEY = import.meta.env.VITE_OPENCAGE_API_KEY;
  
      let map, marker, currentTileLayer;
      let extractedMetadata = {};
      let rawExifData = {};
      let currentLatLng = null;
      let isRawMetadataVisible = false;
      let currentImageBase64 = null; // To store the base64 of the current image
  
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
  
      // Firebase Authentication State Listener
      auth.onAuthStateChanged((user) => {
          if (!user) {
              window.location.href = 'auth.html'; 
          } else {
              currentUserEmailSpan.textContent = `USER: ${user.email.toUpperCase()}`;
          }
      });
  
      // Logout function
      const performLogout = async () => {
          showMessage("LOGGING OUT...", 'info');
          try {
              await auth.signOut();
          } catch (error) {
              console.error("Sign out error:", error);
              showMessage(`LOGOUT ERROR: ${error.message.toUpperCase()}`, 'error');
          }
      };
  
      logoutBtn.addEventListener('click', performLogout);
  
      // Function to display messages (info, error, toast)
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
  
      // Function to clear messages
      function clearMessage() {
        messageBox.classList.add('hidden');
        messageBox.innerHTML = '';
        toastNotification.classList.remove('show');
        toastMessage.textContent = '';
      }
  
      // Formats bytes into human-readable sizes
      function formatBytes(bytes) {
        if (bytes === 0) return '0 BYTES';
        const k = 1024;
        const sizes = ['BYTES', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
      }
      
      // Updates the map header with coordinates
      function updateMapHeaderCoordinates(lat, lon) {
          mapHeaderCoords.innerHTML = (lat !== null && lon !== null)
              ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe" style="display: inline-block; vertical-align: middle; margin-right: 5px;"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> ${lat.toFixed(6)}, ${lon.toFixed(6)}`
              : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe" style="display: inline-block; vertical-align: middle; margin-right: 5px;"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> NO GPS DATA`;
      }
  
      // Initializes the world map
      function initializeWorldMap() {
        if (map) map.remove();
        map = L.map("map").setView([0, 0], 2);
        mapTypeSelect.value = 'satellite'; 
        currentTileLayer = tileLayers[mapTypeSelect.value].addTo(map);
        marker = null;
        updateMapHeaderCoordinates(null, null);
        viewOnGoogleMapsBtn.classList.add('hidden');
        analyzeImageAIBtn.classList.add('hidden'); // Hide AI button on reset
        aiAnalysisOutput.classList.add('hidden'); // Hide AI output on reset
        aiAnalysisOutput.innerHTML = '';
      }
  
      // Switches the map tile layer
      function switchMapLayer(type) {
          if (map && currentTileLayer) map.removeLayer(currentTileLayer);
          currentTileLayer = tileLayers[type].addTo(map);
      }
  
      // Closes the history sidebar
      function closeHistorySidebar() {
          historySidebar.classList.remove('open');
          sidebarOverlay.classList.remove('visible');
      }
  
      // Resets the application to its initial state
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
        toggleRawMetadataBtn.classList.add('hidden'); 
        isRawMetadataVisible = false; 
        rawMetadataOutput.classList.add('hidden'); 
        rawMetadataOutput.innerHTML = ''; 
        extractedMetadata = {};
        rawExifData = {}; 
        currentLatLng = null;
        currentImageBase64 = null; // Clear stored image
        clearMessage();
        initializeWorldMap();
        updateMetadataDisplay();
        profileDropdownContent.classList.remove('show');
        analyzeImageAIBtn.classList.add('hidden'); // Hide AI button on reset
        aiAnalysisOutput.classList.add('hidden'); // Hide AI output on reset
        aiAnalysisOutput.innerHTML = '';
      }
  
      // Performs reverse geocoding using OpenCage API
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
      
      // Saves image analysis history to Firestore
      async function saveHistory(lat, lon, address) {
          const user = auth.currentUser;
          if (!user) return;
          
          const newHistoryItem = {
              latitude: lat,
              longitude: lon,
              address: address || 'Unknown Location',
              timestamp: new Date() 
          };
  
          const historyRef = db.collection('userHistory').doc(user.uid);
  
          try {
              const doc = await historyRef.get();
  
              if (doc.exists) {
                  const existingHistory = doc.data().history || [];
                  const updatedHistory = [newHistoryItem, ...existingHistory];
                  await historyRef.update({ history: updatedHistory });
              } else {
                  await historyRef.set({ history: [newHistoryItem] });
              }
              console.log("History saved successfully to Firestore.");
          } catch (error) {
              console.error("Error saving history to Firestore:", error);
          }
      }
  
      // Main function to process the uploaded image file
      async function processFile(file) {
        if (!file) return;
        resetApplication(); 
        showMessage("ANALYZING IMAGE DATA...", 'info');
  
        const reader = new FileReader();
        reader.onload = (e) => {
          uploadedImagePreview.src = e.target.result;
          uploadedImagePreview.classList.remove('hidden');
          currentImageBase64 = e.target.result.split(',')[1]; // Store base64 data
        };
        reader.readAsDataURL(file);
  
        try {
          const exifData = await exifr.parse(file, { iptc: true, xmp: true });
          rawExifData = exifData || {}; 
          clearMessage();
          const lat = exifData?.latitude;
          const lon = exifData?.longitude;
          let address = 'Location Not Found';
  
          if (typeof lat === 'number' && typeof lon === 'number') {
              currentLatLng = { lat, lon };
              updateMapHeaderCoordinates(lat, lon);
              const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
              coordinatesTextDiv.innerHTML = `<p>GPS COORDINATES: <span>${lat.toFixed(6)}, ${lon.toFixed(6)}</span></p>`;
              
              address = await reverseGeocode(lat, lon);
              await saveHistory(lat, lon, address);
  
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
  
          displayMetadata(exifData, file.size); 
          infoSection.classList.remove('hidden');
          updateMetadataDisplay();
  
          if (Object.keys(extractedMetadata).length > 0 || Object.keys(rawExifData).length > 0) {
              downloadPdfBtn.classList.remove('hidden');
              toggleRawMetadataBtn.classList.remove('hidden'); 
              showMessage("ANALYSIS COMPLETE. DATA RETRIEVED.", 'toast-success');
          } else {
              downloadPdfBtn.classList.add('hidden'); 
              toggleRawMetadataBtn.classList.add('hidden'); 
              showMessage("ANALYSIS COMPLETE. NO METADATA FOUND.", 'toast-success');
          }
  
          // Call AI analysis after all data is processed and available
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
      
      // Displays extracted metadata
      function displayMetadata(data, fileSize) {
        extractedMetadata = {}; 
        if (data?.latitude && data?.longitude) {
          extractedMetadata['Coordinates'] = `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`;
        }
        if (reversedGeocodingOutput.textContent && !reversedGeocodingOutput.classList.contains('hidden') ) {
          extractedMetadata['REVERSED GEOLOCATION'] = reversedGeocodingOutput.textContent.trim();
        }
        if (fileSize !== undefined && fileSize !== null) {
          extractedMetadata['File Size'] = formatBytes(fileSize);
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
            extractedMetadata[key] = String(displayValue).toUpperCase();
          }
        }
      }
      
      // Updates the metadata display based on visibility toggle
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
      
      // PDF download functionality (existing code)
      downloadPdfBtn.addEventListener("click", async () => {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          
          doc.setFont('helvetica');
          doc.setFontSize(18);
          doc.setTextColor(40);
          doc.text("Image Metadata Report", 14, 22);
  
          let yPos = 30;
  
          // Add image preview if available
          if (!uploadedImagePreview.classList.contains('hidden') && uploadedImagePreview.src) {
              const imgData = uploadedImagePreview.src;
              const imgWidth = doc.internal.pageSize.getWidth() - 28; // Max width with margins
              const imgHeight = (uploadedImagePreview.naturalHeight * imgWidth) / uploadedImagePreview.naturalWidth;
              
              // Ensure image fits on one page, scale down if necessary
              const maxHeight = doc.internal.pageSize.getHeight() - yPos - 20; // Remaining height on page
              if (imgHeight > maxHeight) {
                  const scaleFactor = maxHeight / imgHeight;
                  doc.addImage(imgData, 'JPEG', 14, yPos, imgWidth * scaleFactor, imgHeight * scaleFactor);
                  yPos += (imgHeight * scaleFactor) + 10;
              } else {
                  doc.addImage(imgData, 'JPEG', 14, yPos, imgWidth, imgHeight);
                  yPos += imgHeight + 10;
              }
          }
  
          // Add coordinates and reversed geocoding
          if (coordinatesTextDiv.textContent) {
              doc.setFontSize(12);
              doc.text(`GPS Coordinates: ${coordinatesTextDiv.textContent.replace('GPS COORDINATES:', '').trim()}`, 14, yPos);
              yPos += 7;
          }
          if (reversedGeocodingOutput.textContent && !reversedGeocodingOutput.classList.contains('hidden')) {
              doc.text(`Location: ${reversedGeocodingOutput.textContent.trim()}`, 14, yPos);
              yPos += 7;
          }
  
          yPos += 10; // Add some space before metadata
  
          doc.setFontSize(14);
          doc.text("Extracted Metadata:", 14, yPos);
          yPos += 7;
  
          doc.setFontSize(10);
          const metadataLines = [];
          const orderedKeys = ['Coordinates', 'REVERSED GEOLOCATION', ...Object.keys(extractedMetadata).filter(k => k !== 'Coordinates' && k !== 'REVERSED GEOLOCATION').sort()];
          for (const key of orderedKeys) {
              const value = extractedMetadata[key];
              if (value !== undefined && value !== null && value !== '') {
                  metadataLines.push(`${key.toUpperCase()}: ${String(value).toUpperCase()}`);
              }
          }
          
          // Add AI Analysis if available
          if (!aiAnalysisOutput.classList.contains('hidden') && aiAnalysisOutput.textContent.trim() !== '') {
              metadataLines.push("\nAI IMAGE ANALYSIS:");
              const aiText = aiAnalysisOutput.textContent.trim();
              // Split AI text into lines that fit the PDF width
              const splitText = doc.splitTextToSize(aiText, doc.internal.pageSize.getWidth() - 28);
              splitText.forEach(line => metadataLines.push(line));
          }
  
          doc.text(metadataLines, 14, yPos);
          yPos += (metadataLines.length * 5) + 10; // Estimate height for metadata
  
          // Add raw metadata if visible
          if (isRawMetadataVisible && rawMetadataOutput.textContent) {
              if (yPos + 20 > doc.internal.pageSize.getHeight()) { // Check if new page is needed
                  doc.addPage();
                  yPos = 22;
              }
              doc.setFontSize(14);
              doc.text("Raw Metadata:", 14, yPos);
              yPos += 7;
              doc.setFontSize(8);
              const rawText = rawMetadataOutput.textContent;
              const splitRawText = doc.splitTextToSize(rawText, doc.internal.pageSize.getWidth() - 28);
              doc.text(splitRawText, 14, yPos);
          }
  
          doc.save("image_metadata_report.pdf");
      });
  
  
      // --- AI Image Analysis Function ---
      async function analyzeImageAI(base64ImageData, locationName, coords) {
          aiAnalysisOutput.classList.remove('hidden');
          aiAnalysisOutput.innerHTML = `<div class="spinner"></div> ANALYZING IMAGE WITH AI...`;
  
          const prompt = `Analyze the content of this image. If GPS coordinates ${coords.lat}, ${coords.lon} and location name "${locationName}" are provided, consider them in your analysis. Describe what you see in the image and how it relates to the given location, if applicable. Be concise and informative.`;
          
          try {
              let chatHistory = [];
              chatHistory.push({ role: "user", parts: [{ text: prompt }] });
              const payload = {
                  contents: [
                      {
                          role: "user",
                          parts: [
                              { text: prompt },
                              {
                                  inlineData: {
                                      mimeType: "image/jpeg", // Assuming JPEG, adjust if other types are handled
                                      data: base64ImageData
                                  }
                              }
                          ]
                      }
                  ],
              };
              const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // Canvas will automatically provide this
              const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  
              const response = await fetch(apiUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
              });
              const result = await response.json();
  
              if (result.candidates && result.candidates.length > 0 &&
                  result.candidates[0].content && result.candidates[0].content.parts &&
                  result.candidates[0].content.parts.length > 0) {
                  const text = result.candidates[0].content.parts[0].text;
                  aiAnalysisOutput.innerHTML = `<p><strong>AI ANALYSIS:</strong> ${text}</p>`;
              } else {
                  aiAnalysisOutput.innerHTML = `<p><strong>AI ANALYSIS:</strong> <em>UNABLE TO GENERATE ANALYSIS.</em></p>`;
                  console.error("AI analysis response structure unexpected:", result);
              }
          } catch (error) {
              console.error("Error during AI image analysis:", error);
              aiAnalysisOutput.innerHTML = `<p><strong>AI ANALYSIS:</strong> <em>ERROR DURING ANALYSIS: ${error.message.toUpperCase()}.</em></p>`;
          }
      }
  
      // --- Event Listeners ---
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
      
      // --- History Sidebar Logic ---
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
                  const historyData = doc.data().history || [];
                  historyList.innerHTML = '';
                  if (historyData.length === 0) {
                       historyList.innerHTML = '<li>NO HISTORY FOUND.</li>';
                  } else {
                      historyData.forEach(item => {
                          const li = document.createElement('li');
                          li.dataset.lat = item.latitude;
                          li.dataset.lon = item.longitude;
                          li.dataset.address = item.address;
                          const date = item.timestamp.toDate().toLocaleString();
                          li.innerHTML = `<span class="history-address">${item.address}</span><span class="history-date">${date}</span>`;
                          historyList.appendChild(li);
                      });
                  }
              } else {
                  historyList.innerHTML = '<li>NO HISTORY FOUND.</li>';
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
          if (!li || !li.dataset.lat) return;
  
          resetApplication();
  
          const lat = parseFloat(li.dataset.lat);
          const lon = parseFloat(li.dataset.lon);
          const address = li.dataset.address;
  
          if (map) {
              map.setView([lat, lon], 15);
              if(marker) { marker.setLatLng([lat, lon]); } 
              else { marker = L.marker([lat, lon], { icon: customGreenIcon }).addTo(map); }
              marker.bindPopup("SAVED LOCATION").openPopup();
          }
          
          updateMapHeaderCoordinates(lat, lon);
          coordinatesTextDiv.innerHTML = `<p>GPS COORDINATES: <span>${lat.toFixed(6)}, ${lon.toFixed(6)}</span></p>`;
          reversedGeocodingOutput.innerHTML = `<p>${address}</p>`;
          reversedGeocodingOutput.classList.remove('hidden');
          
          infoSection.classList.remove('hidden');
          uploadedImagePreview.classList.add('hidden');
          metadataDiv.innerHTML = "<p class='italic'><em>DISPLAYING SAVED LOCATION. UPLOAD AN IMAGE TO SEE ITS METADATA.</em></p>";
          rawMetadataOutput.classList.add('hidden');
          toggleRawMetadataBtn.classList.add('hidden');
          downloadPdfBtn.classList.add('hidden');
          analyzeImageAIBtn.classList.add('hidden'); // Hide AI button when displaying history item
          aiAnalysisOutput.classList.add('hidden'); // Hide AI output when displaying history item
          aiAnalysisOutput.innerHTML = '';
  
          const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
          viewOnGoogleMapsBtn.classList.remove('hidden');
          viewOnGoogleMapsBtn.onclick = () => window.open(gmapsLink, '_blank');
  
          closeHistorySidebar();
      });
  
      // Hamburger menu toggle logic
      hamburgerMenu.addEventListener('click', () => {
          navbarLinks.classList.toggle('open');
      });
  
      // Profile icon dropdown toggle logic
      profileIcon.addEventListener('click', (event) => {
          profileDropdownContent.classList.toggle('show');
          event.stopPropagation(); 
          navbarLinks.classList.remove('open');
      });
  
      // Close the dropdown if the user clicks outside of it
      window.addEventListener('click', (event) => {
          if (!profileDropdownContent.contains(event.target) && !profileIcon.contains(event.target)) {
              profileDropdownContent.classList.remove('show');
          }
      });
  
      initializeWorldMap();