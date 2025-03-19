import { loadModels, textModel, imageModel, recognizeHandwriting } from 'https://drkimogad.github.io/kimo/models.js';

document.addEventListener('DOMContentLoaded', async () => {
  // ************** INITIALIZATIONS **************
  let isListening = false;
  let recognition;
  let sessionHistory = JSON.parse(localStorage.getItem('sessionHistory')) || [];
  let imageModel; // MobileNet instance

  // ************** MODEL INITIALIZATION **************
  try {
    await loadModels();
    console.log('All models loaded successfully');
  } catch (error) {
    console.error('Model initialization failed:', error);
    displayResponse('Some features might be unavailable', true);
  }

  // ************** IMAGE PROCESSING **************
  async function handleImageUpload(file) {
    try {
      showLoading();
      const img = await loadImage(file);
      const predictions = await imageModel.classify(img);
      
      const resultText = predictions
        .map(p => `${p.className} (${Math.round(p.probability * 100)}%)`)
        .join('\n');
      
      displayResponse(`Image Analysis:\n${resultText}`);
      updateSessionHistory('image', { file: file.name, results: predictions });
    } catch (error) {
      console.error('Image processing error:', error);
      displayResponse('Failed to analyze image', true);
    } finally {
      hideLoading();
    }
  }

  // ************** UNIFIED FILE UPLOAD HANDLER **************
  document.getElementById('file-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      showLoading();
      
      if (file.type.startsWith('image/')) {
        // Handle image classification
        await handleImageUpload(file);
        
        // Handle handwriting recognition
        const img = await loadImage(file);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const recognizedText = await recognizeHandwriting.recognize(canvas);
        displayResponse(`Handwriting Recognition: ${recognizedText}`);
        updateSessionHistory('handwriting', { file: file.name, text: recognizedText });
        
      } else if (file.type === 'text/plain') {
        const textContent = await file.text();
        const plagiarismResult = await textModel.checkPlagiarism(textContent);
        displayResponse(`Plagiarism Score: ${plagiarismResult.score.toFixed(1)}%`);
        updateSessionHistory('text', { content: textContent, score: plagiarismResult.score });
      }
      
    } catch (error) {
      console.error('File processing error:', error);
      displayResponse('Error processing file', true);
    } finally {
      hideLoading();
    }
  });

  // ************** VOICE INPUT HANDLING **************
  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      document.getElementById('user-input').value = transcript;
      toggleListeningUI(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      toggleListeningUI(false);
    };

    recognition.onend = () => {
      isListening = false;
      toggleListeningUI(false);
    };
  }

  function toggleListeningUI(listening) {
    const voiceBtn = document.getElementById('voice-btn');
    voiceBtn.classList.toggle('recording', listening);
    isListening = listening;
  }

  document.getElementById('voice-btn').addEventListener('click', () => {
    if (!isListening) {
      recognition.start();
      toggleListeningUI(true);
    } else {
      recognition.stop();
      toggleListeningUI(false);
    }
  });

  // ************** CANVAS DRAWING IMPLEMENTATION **************
  const canvas = document.getElementById('drawing-canvas');
  const ctx = canvas.getContext('2d');
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  // Canvas setup
  canvas.width = 800;
  canvas.height = 200;

  // Drawing event handlers
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', endDrawing);
  canvas.addEventListener('mouseout', endDrawing);

  document.getElementById('clear-canvas').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  document.getElementById('recognize-btn').addEventListener('click', async () => {
    const recognizedText = await recognizeHandwriting.recognize(canvas);
    displayResponse(`Handwriting: ${recognizedText}`);
    updateSessionHistory('drawing', { text: recognizedText });
  });

  // ************** IMPROVED FETCH WITH TIMEOUT **************
  async function fetchDuckDuckGoResults(query) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`,
        { signal: controller.signal }
      );
      if (!response.ok) throw new Error('Network response was not OK');
      return await response.json();
    } catch (error) {
      console.error("Search failed:", error);
      return { AbstractText: "Search unavailable. Showing local results...", RelatedTopics: [] };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ************** HELPER FUNCTIONS **************
  function updateSessionHistory(type, data) {
    const entry = {
      type,
      ...data,
      timestamp: new Date().toISOString()
    };
    sessionHistory.push(entry);
    localStorage.setItem('sessionHistory', JSON.stringify(sessionHistory));
  }

  function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
  }

  function draw(e) {
    if (!isDrawing) return;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
  }

  function endDrawing() {
    isDrawing = false;
  }

  function toggleListeningUI(listening) {
    const voiceBtn = document.getElementById('voice-btn');
    voiceBtn.classList.toggle('recording', listening);
    isListening = listening;
  }

  // ************** REMAINING CORE FUNCTIONALITY **************
  // ************** THEME MANAGEMENT **************
  const themeToggle = document.getElementById('theme-toggle');
  const currentTheme = localStorage.getItem('theme') || 'light';
  document.body.dataset.theme = currentTheme;

  themeToggle.addEventListener('click', () => {
    const newTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = newTheme;
    localStorage.setItem('theme', newTheme);
  });

  // ************** SEARCH/QUERY HANDLING **************
  document.getElementById('submit-btn').addEventListener('click', async () => {
    const input = document.getElementById('user-input').value.trim();
    if (!input) return;

    try {
      displayResponse("Processing...", true);
      
      if (isSearchQuery(input)) {
        const searchResults = await fetchDuckDuckGoResults(input);
        sessionHistory.push({ 
          type: 'search', 
          query: input, 
          results: searchResults,
          timestamp: new Date().toISOString()
        });
        displayResponse(searchResults.AbstractText || "No results found.");
      } else {
        const aiResponse = await generateAIResponse(input);
        sessionHistory.push({ 
          type: 'ai', 
          query: input, 
          response: aiResponse,
          timestamp: new Date().toISOString()
        });
        displayResponse(aiResponse);
      }
      
      localStorage.setItem('sessionHistory', JSON.stringify(sessionHistory));
    } catch (error) {
      console.error('Processing error:', error);
      displayResponse('An error occurred. Please try again.');
    }
  });

  // ************** UTILITY FUNCTIONS **************
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function showLoading() {
    document.getElementById('loading').classList.remove('loading-hidden');
  }

  function hideLoading() {
    document.getElementById('loading').classList.add('loading-hidden');
  }

  function displayResponse(content, clear = false) {
    const responseArea = document.getElementById('response-area');
    if (clear) responseArea.innerHTML = '';
    responseArea.innerHTML += `<div class="response">${content}</div>`;
    responseArea.scrollTop = responseArea.scrollHeight;
  }

  // ************** HELPER FUNCTION FROM UTILS **************
  function humanizeText(aiText) {
    return aiText
      .replace(/AI thinks.../g, "In my opinion,")
      .replace(/\[Local Processing\]/g, "(Generated by AI, refined)");
  }
  
  // ************** SERVICE WORKER **************
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('https://drkimogad.github.io/kimo/sw.js')
      .then(registration => {
        console.log('SW registered');
        setInterval(() => registration.update(), 3600000);
      })
      .catch(err => console.log('SW registration failed:', err));
  }

  // ************** INITIALIZE APP **************
  initializeModels();
});
