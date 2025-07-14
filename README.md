<h1>Metascanner</h1> 

**Metascanner** is a sophisticated, web-based tool designed for in-depth image analysis. It provides a secure, **hacker-themed interface** for users to upload images, extract and view detailed EXIF metadata, pinpoint GPS coordinates on an interactive map, and leverage the power of **Google's Gemini AI** for visual content analysis and interactive chat.

The application focuses on modularity, security (via Firebase Authentication), and a rich user experience — including persistent history and export features.

<img width="1903" height="906" alt="image" src="https://github.com/user-attachments/assets/c7f04a22-3eca-4b48-b315-9a84b0c97983" />

---

# ✨ Key Features

- 🔐 **Secure User Authentication**  
  Firebase Authentication (Email/Password) for access control and user data management.

- 🧠 **Advanced Metadata Extraction**  
  Uses `exifr.js` to extract EXIF, IPTC, and XMP metadata.

- 🗺️ **Interactive GPS Mapping**  
  Extracts and displays location on Leaflet.js map with multiple tile layers (Streets, Satellite, Topography).

- 🌍 **Reverse Geocoding**  
  Uses OpenCage API to convert coordinates into a human-readable address.

- 🧠 **AI-Powered Image Analysis**  
  One-click AI description of image using **Google Gemini API**.

- 💬 **Multimodal Chatbot**  
  Persistent chatbot knows the current image context and metadata.

- 🧾 **Persistent User History**  
  Auto-saves image analysis (preview, metadata, address) in Firestore.

- 📁 **Data Export**  
  Export metadata as `.json` and generate a `.pdf` report.

- 💻 **Modern Frontend**  
  Responsive hacker-themed UI built with vanilla JS and drag-and-drop image support.

---

## 🧰 Technology Stack

| Purpose             | Tool                          |
|---------------------|-------------------------------|
| Frontend            | HTML5, CSS3, Vanilla JS (ESM) |
| Build Tool          | Vite                          |
| Authentication      | Firebase Authentication       |
| Database            | Firestore                     |
| Mapping             | Leaflet.js                    |
| Metadata Parsing    | exifr.js                      |
| Geocoding           | OpenCage Geocoding API        |
| AI Analysis         | Google Gemini API             |
| PDF Generation      | jsPDF                         |
| Icons               | Lucide Icons                  |

---

## 🚀 Project Setup & Installation

### ✅ Prerequisites

- **Node.js** (includes npm) installed: https://nodejs.org/

---

### 📦 Step 1: Clone the Repository

```bash
git clone https://github.com/debmalyamondal/metascanner.git
cd metascanner
```

---

### 🔥 Step 2: Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add Project"** → follow the steps to create a Firebase project.
3. After project creation:
   - Go to **Authentication > Sign-in method** → Enable **Email/Password**
   - Go to **Firestore Database** → Click **Create Database**
     - Start in **production mode**
     - Choose a nearby region
4. Go to **Project Overview** → Click the **web (</>) icon**
   - Register a new web app
   - Copy the Firebase config keys — you'll use these in `.env.local`

---

### 🧪 Step 3: Get API Keys

To enable AI and geolocation features:

- **Google Gemini API Key**
  - Visit [Google AI Studio](https://makersuite.google.com/app)
  - Click **"Get API Key"**
  - Create a project in Google Cloud if needed
  - Copy your key

- **OpenCage API Key**
  - Visit [https://opencagedata.com/](https://opencagedata.com/)
  - Register for a free developer account
  - Copy your API key

---

### 🔐 Step 4: Configure Environment Variables

In the root of the project, create a file named **`.env.local`** and paste the following:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY="YOUR_FIREBASE_API_KEY"
VITE_FIREBASE_AUTH_DOMAIN="YOUR_FIREBASE_AUTH_DOMAIN"
VITE_FIREBASE_PROJECT_ID="YOUR_FIREBASE_PROJECT_ID"
VITE_FIREBASE_STORAGE_BUCKET="YOUR_FIREBASE_STORAGE_BUCKET"
VITE_FIREBASE_MESSAGING_SENDER_ID="YOUR_FIREBASE_MESSAGING_SENDER_ID"
VITE_FIREBASE_APP_ID="YOUR_FIREBASE_APP_ID"

# Gemini AI Key
VITE_GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# OpenCage Geolocation Key
VITE_OPENCAGE_API_KEY="YOUR_OPENCAGE_API_KEY"
```

Replace each `"YOUR_..."` placeholder with actual values from the previous steps.

---

### 📁 Step 5: Install Dependencies

In the root directory of your project, create a file named `package.json` and paste the following:

```json
{
  "name": "metascanner",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  },
  "dependencies": {
    "exifr": "^7.1.3",
    "firebase": "^9.6.0",
    "html2canvas": "^1.4.1",
    "jspdf": "^2.5.1",
    "leaflet": "^1.9.4",
    "lucide": "^0.309.0"
  }
}
```

Then, open your terminal in the project’s root folder and run:

```bash
npm install
```

This will install all required packages and create a `node_modules` folder and `package-lock.json` file.

---

### 💻 Step 6: Run the App

Start the development server with:

```bash
npm run dev
```

Then open your browser and go to:

```
http://localhost:5173
```

You’ll see the login/signup screen (via Firebase Authentication). Once logged in, you can:

- Upload and analyze images  
- View complete EXIF metadata  
- Display GPS location on a Leaflet map  
- Generate AI insights using Gemini  
- Chat with the AI about the image  
- Export metadata as `.json` or `.pdf`

Metascanner is now up and running locally! ✅

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙌 Contributing

Contributions are welcome!  
Please submit a pull request or open an issue with feature suggestions or bug reports.

---

## ✉️ Contact

Created by **[@your-username](https://github.com/debmalyamondal)**  
Want to collaborate? Reach out anytime!
