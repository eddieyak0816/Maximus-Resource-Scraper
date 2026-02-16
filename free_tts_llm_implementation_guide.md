Below is an extremely detailed, step-by-step guide to implement the free TTS models and backup LLM functionality. This is based on the exact changes made during our conversation. I'll first describe what was done, then provide the precise steps to revert the project to its pre-change state, and finally the steps to re-implement these features from scratch.

## What Was Done

### Free TTS Models
- **TTS Implementation**: The system was configured to use Kokoro (a free TTS model hosted on Hugging Face Spaces) for generating podcast audio from text summaries.
- **Key Components**:
  - A new file `hf_tts.js` was created to handle TTS generation using Puppeteer to interact with the HF Space
  - The `contentProcessor.js` was modified to import and use this TTS function
  - Audio files are saved as WAV files in an `outputs` directory

### Backup LLMs (Hugging Face Fallback)
- **LLM Fallback System**: Added automatic fallback from OpenRouter to Hugging Face's free inference API when OpenRouter fails
- **Model Used**: SmolLM3-3B (free model available on HF Inference)
- **Test Infrastructure**: Added a test button and IPC handlers to verify HF API functionality
- **Logging**: Added emoji indicators (🔵 OpenRouter, 🔄 Hugging Face) to show which API is being used

## Step 1: Revert to Pre-Change State

To revert the project to its state before these changes:

### 1.1 Remove TTS-Related Files
```bash
# Delete the TTS implementation file
rm hf_tts.js
```

### 1.2 Revert contentProcessor.js Changes
Remove the following sections from `contentProcessor.js`:

1. **Remove TTS import** (around line 6):
```javascript
const { generateKokoroTTS } = require('./hf_tts');
```

2. **Remove TTS generation code** (around lines 30-60, the entire TTS generation function):
```javascript
// TTS generation function
async function generateTTS(text, voice) {
  console.log(`🎤 Starting TTS generation for voice: ${voice}`);

  try {
    console.log('🔄 Attempting Kokoro HF Space TTS...');

    // Import the HF TTS module
    const { generateKokoroTTS } = require('./hf_tts');

    // Generate audio using browser automation
    const audioBuffer = await generateKokoroTTS(text, voice);

    if (audioBuffer && audioBuffer.length > 1000) { // Check for reasonable audio size
      console.log('✅ Kokoro HF Space TTS successful! Audio size:', audioBuffer.length, 'bytes');
      return audioBuffer;
    } else {
      console.log('❌ Kokoro HF Space TTS failed - invalid audio buffer');
      return null;
    }
  } catch (error) {
    console.log('❌ TTS generation failed:', error.message);
    return null;
  }
}
```

3. **Remove podcast generation from processContent** (around lines 200-250):
```javascript
    let podcastPath = null;

    if (podcastAudio) {
      // Save audio file
      const audioDir = path.join(__dirname, 'outputs');
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }

      const timestamp = Date.now();
      podcastPath = path.join(audioDir, `podcast_${contentData.sourceId}_${timestamp}.wav`);
      fs.writeFileSync(podcastPath, podcastAudio);

      // Also save the podcast script as text for review
      const scriptPath = path.join(audioDir, `podcast_script_${contentData.sourceId}_${timestamp}.txt`);
      fs.writeFileSync(scriptPath, podcastScript, 'utf8');
    }
```

4. **Remove podcastPath from the return** (change the parentPort.postMessage to):
```javascript
parentPort.postMessage({ content, title, summary, keyPoints });
```

5. **Remove HF API functions**:
   - Remove `callHuggingFaceAPI` function (around lines 70-110)
   - Remove `testHuggingFaceAPI` function (around lines 108-125)

6. **Revert LLM call in processContent** (around lines 140-180, change back to simple OpenRouter call):
```javascript
// Generate summary using OpenRouter
console.log('🔄 WORKER: Using OpenRouter API');
const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
  model: contentData.model || 'meta-llama/llama-3-8b-instruct',
  messages: [{ role: 'user', content: prompt }],
  max_tokens: 3000,
  temperature: 0.7
}, {
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 60000
});

const summary = response.data.choices[0].message.content;
```

7. **Remove HF test logic** (in the worker startup, change back to just `processContent(workerData);`)

### 1.3 Revert main.js Changes
1. **Remove database save logic** from the process-content handler (around lines 210-240):
   - Remove the db.serialize block that saves summary and outputs
   - Change back to just `resolve(result);`

2. **Remove test-hf-api handler** (around lines 144-190)

### 1.4 Revert preload.js Changes
Remove the `testHuggingFace` method (around line 20)

### 1.5 Revert App.js Changes
1. **Remove testHuggingFace function** (around lines 145-155)

2. **Remove test button** from the header (around lines 160-175)

3. **Remove processedContent state** if it exists (though it wasn't added)

### 1.6 Clean Up
```bash
# Remove outputs directory if it exists
rm -rf outputs/

# Remove any .wav files that were generated
find . -name "*.wav" -delete
```

## Step 2: Re-Implement Free TTS Models

### 2.1 Create hf_tts.js
Create a new file `hf_tts.js` in the root directory with this exact content:

```javascript
const puppeteer = require('puppeteer');

async function generateKokoroTTS(text, voice = 'af_bella') {
  console.log('🎤 Starting Kokoro TTS generation...');

  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();

    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Navigate to Kokoro HF Space
    console.log('🔗 Navigating to Kokoro HF Space...');
    await page.goto('https://huggingface.co/spaces/hexgrad/Kokoro-TTS', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for the page to load
    await page.waitForSelector('textarea[data-testid="textbox"]', { timeout: 30000 });

    // Clear and type the text
    console.log('✍️ Entering text...');
    await page.evaluate(() => {
      const textarea = document.querySelector('textarea[data-testid="textbox"]');
      if (textarea) {
        textarea.value = '';
        textarea.focus();
      }
    });

    await page.type('textarea[data-testid="textbox"]', text, { delay: 50 });

    // Select voice
    console.log('🎭 Selecting voice...');
    const voiceSelect = await page.$('select[data-testid="dropdown"]');
    if (voiceSelect) {
      await page.select('select[data-testid="dropdown"]', voice);
    }

    // Click generate button
    console.log('▶️ Clicking generate button...');
    const generateButton = await page.$('button[data-testid="run-button"]');
    if (generateButton) {
      await generateButton.click();
    }

    // Wait for audio generation
    console.log('⏳ Waiting for audio generation...');
    await page.waitForSelector('audio', { timeout: 120000 });

    // Get audio data
    console.log('📥 Extracting audio data...');
    const audioData = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      if (audio && audio.src) {
        return audio.src;
      }
      return null;
    });

    if (!audioData) {
      throw new Error('No audio data found');
    }

    // Convert base64 audio to buffer
    console.log('🔄 Converting audio to buffer...');
    const audioBuffer = Buffer.from(audioData.split(',')[1], 'base64');

    console.log('✅ Kokoro TTS completed successfully!');
    return audioBuffer;

  } catch (error) {
    console.error('❌ Kokoro TTS failed:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateKokoroTTS };
```

### 2.2 Install Puppeteer Dependency
```bash
npm install puppeteer
```

### 2.3 Update contentProcessor.js
1. **Add TTS import** at the top (after other requires):
```javascript
const { generateKokoroTTS } = require('./hf_tts');
```

2. **Add TTS generation function** after the imports:
```javascript
// TTS generation function
async function generateTTS(text, voice) {
  console.log(`🎤 Starting TTS generation for voice: ${voice}`);

  try {
    console.log('🔄 Attempting Kokoro HF Space TTS...');

    // Generate audio using browser automation
    const audioBuffer = await generateKokoroTTS(text, voice);

    if (audioBuffer && audioBuffer.length > 1000) { // Check for reasonable audio size
      console.log('✅ Kokoro HF Space TTS successful! Audio size:', audioBuffer.length, 'bytes');
      return audioBuffer;
    } else {
      console.log('❌ Kokoro HF Space TTS failed - invalid audio buffer');
      return null;
    }
  } catch (error) {
    console.log('❌ TTS generation failed:', error.message);
    return null;
  }
}
```

3. **Add podcast generation to processContent** (before the parentPort.postMessage):
```javascript
    let podcastPath = null;

    if (podcastAudio) {
      // Save audio file
      const audioDir = path.join(__dirname, 'outputs');
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }

      const timestamp = Date.now();
      podcastPath = path.join(audioDir, `podcast_${contentData.sourceId}_${timestamp}.wav`);
      fs.writeFileSync(podcastPath, podcastAudio);

      // Also save the podcast script as text for review
      const scriptPath = path.join(audioDir, `podcast_script_${contentData.sourceId}_${timestamp}.txt`);
      fs.writeFileSync(scriptPath, podcastScript, 'utf8');
    }
```

4. **Update the return statement**:
```javascript
parentPort.postMessage({ content, title, summary, keyPoints, podcastPath });
```

## Step 3: Re-Implement Backup LLMs

### 3.1 Add Hugging Face API Function to contentProcessor.js
Add this function after the generateTTS function:

```javascript
// Hugging Face API fallback function
async function callHuggingFaceAPI(prompt) {
  console.log('🔄 WORKER: Using HUGGING FACE API (SmolLM3-3B)');
  console.log('🔄 WORKER: HF Token present:', !!process.env.HF_TOKEN);

  const response = await axios.post('https://router.huggingface.co/v1/chat/completions', {
    model: 'HuggingFaceTB/SmolLM3-3B',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 3000,
    temperature: 0.7
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.HF_TOKEN}`,
      'Content-Type': 'application/json'
    },
    timeout: 60000
  });

  console.log('✅ WORKER: Hugging Face API response received, length:', response.data.choices[0].message.content.length);
  return response.data;
}
```

### 3.2 Add Test Function
Add this after callHuggingFaceAPI:

```javascript
async function testHuggingFaceAPI() {
  try {
    console.log('🧪 WORKER: Testing Hugging Face API...');
    const testPrompt = 'Say "Hello from Hugging Face!" and nothing else.';
    const result = await callHuggingFaceAPI(testPrompt);
    console.log('✅ WORKER: Hugging Face test successful:', result);
    return { testResult: true, message: 'Hugging Face API success!', data: result };
  } catch (error) {
    console.log('❌ WORKER: Hugging Face test failed:', error.message);
    return { testResult: false, message: `Hugging Face API failed: ${error.message}` };
  }
}
```

### 3.3 Update LLM Call with Fallback
Replace the OpenRouter call in processContent with:

```javascript
// Generate summary with fallback to Hugging Face
let summary;
try {
  console.log('🔵 WORKER: Using OpenRouter API');
  const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model: contentData.model || 'meta-llama/llama-3-8b-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 3000,
    temperature: 0.7
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 60000
  });

  summary = response.data.choices[0].message.content;
  console.log('✅ WORKER: OpenRouter API successful');
} catch (error) {
  console.log('❌ WORKER: OpenRouter failed:', error.message);
  console.log('🔄 WORKER: Falling back to Hugging Face API');

  try {
    const hfResponse = await callHuggingFaceAPI(prompt);
    summary = hfResponse.choices[0].message.content;
    console.log('✅ WORKER: Hugging Face fallback successful');
  } catch (hfError) {
    console.log('❌ WORKER: Hugging Face fallback also failed:', hfError.message);
    throw new Error(`Both OpenRouter and Hugging Face failed. OpenRouter: ${error.message}, HF: ${hfError.message}`);
  }
}
```

### 3.4 Update Worker Startup Logic
Change the end of contentProcessor.js to:

```javascript
if (workerData && workerData.testHF) {
  console.log('Worker: Running HF API test...');
  testHuggingFaceAPI().then(result => {
    console.log('Worker: Test result:', result);
    parentPort.postMessage(result);
  }).catch(error => {
    console.log('Worker: Test error:', error);
    parentPort.postMessage({ testResult: false, message: `Hugging Face API failed: ${error.message}` });
  });
} else {
  processContent(workerData);
}
```

### 3.5 Update main.js
1. **Add database save logic** to the process-content handler (after the worker.on('message')):

```javascript
} else {
  console.log('Main process: Worker completed successfully, saving to database');

  // Save summary to database
  const { content, title, summary, keyPoints, podcastPath } = result;
  const sourceId = contentData.sourceId;

  db.serialize(() => {
    db.run('INSERT INTO summaries (source_id, summary, key_points) VALUES (?, ?, ?)',
      [sourceId, summary, JSON.stringify(keyPoints)], function(err) {
      if (err) {
        console.log('Main process: Error inserting summary:', err);
        reject(new Error('Failed to save summary: ' + err.message));
        return;
      }

      const summaryId = this.lastID;
      console.log('Main process: Summary inserted with ID:', summaryId);

      // Save podcast output if exists
      if (podcastPath) {
        db.run('INSERT INTO outputs (summary_id, type, file_path) VALUES (?, ?, ?)',
          [summaryId, 'podcast', podcastPath], function(err) {
          if (err) {
            console.log('Main process: Error inserting podcast output:', err);
            // Don't reject here, summary is saved
          } else {
            console.log('Main process: Podcast output inserted');
          }
        });
      }

      console.log('Main process: Returning result to renderer');
      resolve(result);
    });
  });
}
```

2. **Add test-hf-api handler**:

```javascript
// Test Hugging Face API handler
ipcMain.handle('test-hf-api', async (event, data) => {
  console.log('Main process: Testing Hugging Face API...');
  try {
    const { Worker } = require('worker_threads');
    const worker = new Worker(path.join(__dirname, 'contentProcessor.js'), {
      workerData: { testHF: true }
    });

    return await new Promise((resolve, reject) => {
      let hasResponded = false;

      worker.on('message', (result) => {
        if (hasResponded) return;
        hasResponded = true;
        console.log('Main process: HF test result:', result);
        resolve(result);
      });

      worker.on('error', (error) => {
        if (hasResponded) return;
        hasResponded = true;
        console.log('Main process: HF test error:', error);
        reject(error);
      });

      worker.on('exit', (code) => {
        if (hasResponded) return;
        hasResponded = true;
        console.log('Main process: HF test worker exited with code:', code);
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });

      // Timeout for test
      setTimeout(() => {
        if (!hasResponded) {
          hasResponded = true;
          console.log('Main process: HF test timeout');
          worker.terminate();
          reject(new Error('HF test timeout'));
        }
      }, 30000);
    });
  } catch (error) {
    console.log('Main process: HF test handler error:', error);
    throw error;
  }
});
```

### 3.6 Update preload.js
Add the testHuggingFace method:

```javascript
testHuggingFace: () => ipcRenderer.invoke('test-hf-api', {}),
```

### 3.7 Update App.js
1. **Add testHuggingFace function**:

```javascript
const testHuggingFace = async () => {
  try {
    console.log('Renderer: Testing Hugging Face API...');
    const result = await window.electronAPI.testHuggingFace();
    console.log('Renderer: HF test result:', JSON.stringify(result, null, 2));
    alert(`Hugging Face test completed. Check console logs for details!`);
  } catch (error) {
    console.error('Renderer: HF test failed:', error);
    alert(`Hugging Face test failed: ${error.message}`);
  }
};
```

2. **Add test button** in the header:

```javascript
<button
  onClick={testHuggingFace}
  style={{
    backgroundColor: '#FF9800',
    color: 'white',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    margin: '10px 5px'
  }}
>
  🧪 Test Hugging Face API
</button>
```

### 3.8 Update .env
Ensure HF_TOKEN is set in .env:
```
HF_TOKEN=your_hugging_face_token_here
```

## Step 4: Testing and Verification

1. **Build and run**:
```bash
npm run build
npm start
```

2. **Test TTS**: Process a YouTube video and check if a .wav file is created in the outputs directory

3. **Test LLM fallback**: Click the "🧪 Test Hugging Face API" button to verify the backup works

4. **Test full processing**: Process content and verify summaries appear in the UI with podcast files

This guide provides the exact steps to revert and re-implement both features. The free TTS uses Kokoro via Puppeteer automation, and the LLM backup uses SmolLM3-3B on Hugging Face's free inference API.