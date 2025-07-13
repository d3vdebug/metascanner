/**
 * @fileoverview Handles all interactions with the AI model (Gemini),
 * including one-off analysis and the interactive chatbot functionality.
 */

// Helper function for robust API calls, now scoped to this module
async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                if (response.status === 429 || response.status >= 500) {
                    console.warn(`Attempt ${i + 1} failed with status ${response.status}. Retrying in ${delay / 1000}s...`);
                    throw new Error(`Server error: ${response.status}`);
                }
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
            }
            return response.json();
        } catch (error) {
            if (i === retries - 1) {
                console.error("All retry attempts failed.");
                throw error;
            }
            await new Promise(res => setTimeout(res, delay));
            delay *= 2;
        }
    }
}

/**
 * Analyzes an image using the Gemini AI model.
 * @param {string} base64ImageData The compressed base64 string of the image.
 * @param {string} locationName The reverse-geocoded location name.
 * @param {object|null} coords The coordinates object {lat, lon}.
 * @returns {Promise<string>} A promise that resolves with the AI-generated text analysis.
 */
export async function analyzeImageWithAI(base64ImageData, locationName, coords) {
    const prompt = `Analyze the content of this image. If GPS coordinates ${coords ? `${coords.lat}, ${coords.lon}` : 'are not available'} and location name "${locationName}" are provided, consider them in your analysis. Describe what you see in the image and how it relates to the given location, if applicable. Be concise and informative.`;
    
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
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };

    const result = await fetchWithRetry(apiUrl, fetchOptions);
    
    if (result.candidates && result.candidates.length > 0) {
        return result.candidates[0].content.parts.map(part => part.text).join("");
    } else {
        console.error("AI analysis response structure unexpected:", result);
        throw new Error("Unable to generate analysis. The model did not return any candidates.");
    }
}

// --- Chatbot Specific Logic ---

// Module-level variables to hold references to DOM elements and state provider
let chatMessagesEl, chatInputEl, sendMessageBtnEl, getAppContext;
let isChatbotInitialized = false;

function addMessageToChat(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    
    if (sender === 'loading') {
        messageElement.innerHTML = `<div class="spinner"></div><span>ANALYZING...</span>`;
    } else {
        messageElement.textContent = message;
    }
    
    chatMessagesEl.appendChild(messageElement);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    return messageElement;
}

async function getChatbotResponse(userMessage) {
    const loadingElement = addMessageToChat('loading');
    sendMessageBtnEl.disabled = true;

    // Get the latest context from the main app
    const { extractedMetadata, currentImageBase64 } = getAppContext();
    const hasImage = !!currentImageBase64;
    
    const prompt = `You are a helpful multimodal photo analysis assistant named Metascan AI. Your task is to answer the user's question based on the provided image and its metadata.
- Analyze the visual content of the image.
- give precise and relevant answers.
- dont include stars or emojis in your responses.
- User says Hi or hello, greet them back.
- Refer to the structured metadata for technical details (camera, location, etc.).
- Combine both sources of information for a comprehensive answer.
- If the information isn't in the image or the metadata, state that clearly. Be concise.

Here is the available metadata: ${JSON.stringify(extractedMetadata, null, 2)}

User's Question: "${userMessage}"`;
    
    const textOnlyPrompt = `You are a helpful photo analysis assistant named Metascan AI. An image was NOT provided, so you can only answer questions based on the metadata below. If the user asks about visual content, politely state that you cannot see the image.

Here is the available metadata:
${JSON.stringify(extractedMetadata, null, 2)}

User's Question: "${userMessage}"`;

    const payload = {
        contents: [{ parts: [{ text: hasImage ? prompt : textOnlyPrompt }] }]
    };

    if (hasImage) {
        payload.contents[0].parts.push({
            inlineData: { mimeType: "image/jpeg", data: currentImageBase64 }
        });
    }

    try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
        }
        
        const result = await response.json();
        loadingElement.remove();

        if (result.candidates && result.candidates[0].content?.parts) {
            const text = result.candidates[0].content.parts.map(part => part.text).join("");
            addMessageToChat('bot', text);
        } else {
            addMessageToChat('bot', "I'm sorry, I couldn't generate a response. The model may have returned an empty result.");
        }
    } catch (error) {
        loadingElement.remove();
        addMessageToChat('bot', `Error: ${error.message}. Please check your connection or API key.`);
    } finally {
        sendMessageBtnEl.disabled = false;
        chatInputEl.focus();
    }
}

function handleSendMessage() {
    const message = chatInputEl.value.trim();
    if (message) {
        addMessageToChat('user', message);
        chatInputEl.value = '';
        getChatbotResponse(message);
    }
}

/**
 * Initializes the chatbot UI and event listeners.
 * @param {object} elements - An object containing all necessary DOM elements for the chatbot.
 * @param {function} appContextProvider - A function that returns the current app context.
 */
export function initializeChatbot(elements, appContextProvider) {
    const { toggle, window, close, messages, input, sendBtn } = elements;
    chatMessagesEl = messages;
    chatInputEl = input;
    sendMessageBtnEl = sendBtn;
    getAppContext = appContextProvider;
    
    toggle.onclick = () => {
        window.classList.toggle('open');
        if (window.classList.contains('open') && !isChatbotInitialized) {
            addMessageToChat('bot', 'Metascan AI initiated. I have access to the current image and its metadata. How can I assist you?');
            isChatbotInitialized = true;
        }
    };
    close.onclick = () => window.classList.remove('open');
    sendBtn.onclick = handleSendMessage;
    input.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };
}

/**
 * Resets the chatbot state for a new analysis.
 */
export function resetChatbot() {
    isChatbotInitialized = false;
    if (chatMessagesEl) chatMessagesEl.innerHTML = '';
}