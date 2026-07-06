import * as fs from 'fs';
import * as path from 'path';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel voice

if (ELEVENLABS_API_KEY) {
  console.log('[ElevenLabs Service] ElevenLabs API configured.');
} else {
  console.warn('[ElevenLabs Service] WARNING: ELEVENLABS_API_KEY is not defined. Voiceover will fall back to Frontend Web Speech API Synthesis.');
}

export async function generateVoiceover(segmentId: string, text: string, outputDir: string): Promise<string | null> {
  if (!ELEVENLABS_API_KEY) {
    return null; // Will trigger high-fidelity frontend SpeechSynthesis
  }

  const audioFileName = `voiceover-${segmentId}.mp3`;
  const audioFilePath = path.join(outputDir, audioFileName);

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API returned status code ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(audioFilePath, buffer);

    console.log(`[ElevenLabs Service] Voiceover synthesized successfully at: ${audioFilePath}`);
    return audioFilePath;
  } catch (error) {
    console.error('[ElevenLabs Service] Error calling ElevenLabs API, falling back to frontend TTS:', error);
    return null;
  }
}
