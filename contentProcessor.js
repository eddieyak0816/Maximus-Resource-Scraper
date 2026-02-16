const { parentPort, workerData } = require('worker_threads');
const { YoutubeTranscript } = require('youtube-transcript');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
require('dotenv').config();

// Generate TTS audio using Windows built-in TTS (free, unlimited)
async function generateTTS(text, voice = 'Microsoft Zira Desktop') {
  try {
    console.log('Generating TTS with Windows Speech...');
    
    // Create a temporary text file
    const tempTextPath = path.join(__dirname, `temp_tts_${Date.now()}.txt`);
    const tempAudioPath = path.join(__dirname, `temp_tts_${Date.now()}.wav`);
    
    // Write text to temp file
    fs.writeFileSync(tempTextPath, text, 'utf8');
    
    // Use PowerShell to generate speech with Windows TTS
    const psCommand = `powershell -Command "Add-Type -AssemblyName System.Speech; $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speak.SelectVoice('${voice}'); $speak.SetOutputToWaveFile('${tempAudioPath}'); $speak.Speak([IO.File]::ReadAllText('${tempTextPath}')); $speak.Dispose()"`;
    
    console.log('Running PowerShell TTS command...');
    await execAsync(psCommand, { timeout: 60000 });
    
    // Read the generated WAV file
    const audioBuffer = fs.readFileSync(tempAudioPath);
    
    // Convert WAV to MP3 (optional - for now we'll keep as WAV)
    // For simplicity, let's just return the WAV data
    
    // Clean up temp files
    try {
      fs.unlinkSync(tempTextPath);
      fs.unlinkSync(tempAudioPath);
    } catch (cleanupError) {
      console.log('Warning: Could not clean up temp files:', cleanupError.message);
    }
    
    console.log('TTS generation successful, audio size:', audioBuffer.length, 'bytes');
    return audioBuffer;
    
  } catch (error) {
    console.error('Windows TTS generation failed:', error.message);
    return null;
  }
}

// Process content based on type
async function processContent(contentData) {
  try {
    let content = '';
    let title = '';

    if (contentData.type === 'article') {
      const response = await axios.get(contentData.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      content = response.data;
      // Simple title extraction
      const titleMatch = content.match(/<title>(.*?)<\/title>/i);
      title = titleMatch ? titleMatch[1] : 'Article';
    } else if (contentData.type === 'youtube') {
      // Extract video ID from URL
      const videoIdMatch = contentData.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;
      
      if (videoId) {
        try {
          // Get video details
          const youtubeApiKey = process.env.YOUTUBE_API_KEY;
          const videoResponse = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
            params: {
              part: 'snippet',
              id: videoId,
              key: youtubeApiKey
            }
          });
          
          let videoTitle = 'YouTube Video';
          let videoDescription = '';
          if (videoResponse.data.items.length > 0) {
            const video = videoResponse.data.items[0].snippet;
            videoTitle = video.title;
            videoDescription = video.description;
          }
          
          // Get transcript
          const transcript = await YoutubeTranscript.fetchTranscript(videoId);
          const transcriptText = transcript.map(item => item.text).join(' ');
          
          // Create a more balanced content summary
          let contentSummary = `${videoTitle}\n\nDescription: ${videoDescription}\n\n`;
          
          // Take first 1000 chars of transcript, then sample from middle and end
          if (transcriptText.length > 3000) {
            const firstPart = transcriptText.substring(0, 1000);
            const middleStart = Math.floor(transcriptText.length / 2) - 500;
            const middlePart = transcriptText.substring(middleStart, middleStart + 1000);
            const endPart = transcriptText.substring(transcriptText.length - 1000);
            
            contentSummary += `Transcript (sampled):\n${firstPart}...\n\n[middle section]\n${middlePart}...\n\n[end section]\n${endPart}`;
          } else {
            contentSummary += `Transcript: ${transcriptText}`;
          }
          
          content = contentSummary;
          title = videoTitle;
        } catch (transcriptError) {
          // Fallback to title and description only
          const youtubeApiKey = process.env.YOUTUBE_API_KEY;
          const videoResponse = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
            params: {
              part: 'snippet',
              id: videoId,
              key: youtubeApiKey
            }
          });
          
          if (videoResponse.data.items.length > 0) {
            const video = videoResponse.data.items[0].snippet;
            title = video.title;
            content = `${video.title}\n\n${video.description}`;
          } else {
            content = `YouTube video: ${contentData.url}`;
            title = 'YouTube Video';
          }
        }
      } else {
        content = `YouTube video: ${contentData.url}`;
        title = 'YouTube Video';
      }
    } else {
      content = `Content from ${contentData.type}: ${contentData.url}`;
      title = contentData.type;
    }

    // Call OpenRouter API for summary
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key not found');
    }

    const summaryResponse = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: contentData.model || 'openai/gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: `Create a comprehensive, educational summary of this content for learning purposes.

Provide an in-depth analysis that includes:
- Main topic and objectives
- Key concepts and techniques explained
- Step-by-step implementation guidance where applicable
- Examples and use cases
- Benefits and potential applications
- Resources mentioned

Then, provide exactly 5 key learning points with actionable takeaways, formatted as:

**Key Learning Points:**
1. [First actionable takeaway]
2. [Second actionable takeaway]
3. [Third actionable takeaway]
4. [Fourth actionable takeaway]
5. [Fifth actionable takeaway]

Content: ${content.substring(0, 6000)}`
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const summary = summaryResponse.data.choices[0].message.content;
    console.log('Raw AI response:', summary.substring(0, 500)); // Debug log
    
    let keyPoints = ['Key point 1', 'Key point 2', 'Key point 3', 'Key point 4', 'Key point 5'];
    
    // Try to parse key points from the response - improved parsing
    const lines = summary.split('\n');
    let keyPointsStart = -1;
    
    // Look for various possible headers for key points
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      if (line.includes('key learning points') || 
          line.includes('key points') || 
          line.includes('learning points') ||
          line.includes('actionable takeaways') ||
          (line.includes('key') && line.includes('points'))) {
        keyPointsStart = i;
        break;
      }
    }
    
    if (keyPointsStart !== -1) {
      const points = [];
      for (let i = keyPointsStart + 1; i < lines.length && points.length < 10; i++) {
        const line = lines[i].trim();
        // Match numbered points like "1.", "2.", etc. or bullet points
        if (line.match(/^\d+\./) || line.match(/^[•\-\*]/) || line.match(/^\(\d+\)/)) {
          let cleanPoint = line.replace(/^\d+\.\s*/, '').replace(/^[•\-\*]\s*/, '').replace(/^\(\d+\)\s*/, '');
          if (cleanPoint.length > 10 && cleanPoint.length < 200) { // Reasonable length check
            points.push(cleanPoint);
          }
        } else if (line === '' || line.startsWith('**') || line.startsWith('#')) {
          continue;
        } else if (points.length > 0) {
          // If we have points but hit non-point content, stop
          break;
        }
      }
      if (points.length >= 3) {
        keyPoints = points.slice(0, 5);
      }
    }

    console.log('Parsed key points:', keyPoints); // Debug log

    // Generate podcast audio from a shorter version of the summary
    let ttsText = summary;
    
    // Try to extract just the main summary part (before key points) for TTS
    const ttsLines = summary.split('\n');
    const keyPointsIndex = ttsLines.findIndex(line => 
      line.toLowerCase().includes('key learning points') || 
      line.toLowerCase().includes('key points') ||
      line.toLowerCase().includes('learning points')
    );
    
    if (keyPointsIndex !== -1) {
      ttsText = ttsLines.slice(0, keyPointsIndex).join('\n').trim();
    }
    
    // Limit TTS text to reasonable length (about 2000 characters for ~3-4 minutes of speech)
    if (ttsText.length > 2000) {
      ttsText = ttsText.substring(0, 2000) + '...';
    }
    
    console.log('TTS text length:', ttsText.length); // Debug log
    
    const podcastAudio = await generateTTS(ttsText);
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
    }

    parentPort.postMessage({ content, title, summary, keyPoints, podcastPath });
  } catch (error) {
    parentPort.postMessage({ error: `Failed to process content: ${error.message}` });
  }
}

processContent(workerData);