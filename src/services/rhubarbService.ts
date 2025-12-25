import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export interface RhubarbRequestPayload {
  audioContent: string;
  audioEncoding: 'LINEAR16' | 'WAV' | 'OGG' | 'MP3';
  sampleRateHertz?: number;
  channels?: number;
  text?: string;
}

export interface RhubarbMouthCue {
  start: number;
  end: number;
  value: string;
}

export interface RhubarbResult {
  metadata: {
    soundFile: string;
    duration: number;
  };
  mouthCues: RhubarbMouthCue[];
}

const RHUBARB_BINARY = process.env.RHUBARB_BINARY || '/home/cloud/Rhubarb-Lip-Sync-1.14.0-Linux/rhubarb';
const FFMPEG_BINARY = process.env.FFMPEG_BINARY || 'ffmpeg';

const runProcess = (command: string, args: string[], cwd?: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
};

const ensureFileExists = async (filePath: string) => {
  await fs.access(filePath);
};

const writeWavFromPcm = async (
  pcmBuffer: Buffer,
  sampleRate: number,
  channels: number,
  wavPath: string
) => {
  const header = Buffer.alloc(44);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  await fs.writeFile(wavPath, Buffer.concat([header, pcmBuffer]));
};

export const analyzeWithRhubarb = async (payload: RhubarbRequestPayload): Promise<RhubarbResult> => {
  const tempRoot = process.env.RHUBARB_TMP_DIR || path.join(process.cwd(), '.rhubarb-tmp');
  await fs.mkdir(tempRoot, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(tempRoot, 'job-'));
  const inputPath = path.join(tempDir, 'input.audio');
  const wavPath = path.join(tempDir, 'input.wav');
  const dialogPath = path.join(tempDir, 'dialog.txt');
  const outputPath = path.join(tempDir, 'output.json');

  try {
    const audioBuffer = Buffer.from(payload.audioContent, 'base64');
    const channels = payload.channels || 1;
    const sampleRate = payload.sampleRateHertz || 24000;
    const header = audioBuffer.subarray(0, 4).toString('ascii');
    const looksLikeWav = header === 'RIFF';
    const looksLikeOgg = header === 'OggS';

    if (payload.audioEncoding === 'LINEAR16' && !looksLikeWav && !looksLikeOgg) {
      await writeWavFromPcm(audioBuffer, sampleRate, channels, wavPath);
    } else if (payload.audioEncoding === 'WAV' || looksLikeWav) {
      await fs.writeFile(wavPath, audioBuffer);
    } else {
      await fs.writeFile(inputPath, audioBuffer);
      await ensureFileExists(inputPath);
      await runProcess(FFMPEG_BINARY, [
        '-y',
        '-i', inputPath,
        wavPath
      ]);
    }

    if (payload.text && payload.text.trim()) {
      await fs.writeFile(dialogPath, payload.text, 'utf8');
    }

    const rhubarbArgs = [
      '-f', 'json',
      '-o', outputPath,
      '--recognizer', 'pocketSphinx',
      '--extendedShapes', 'GHX'
    ];

    if (payload.text && payload.text.trim()) {
      rhubarbArgs.push('--dialogFile', dialogPath);
    }

    rhubarbArgs.push(wavPath);

    await runProcess(RHUBARB_BINARY, rhubarbArgs);

    const result = await fs.readFile(outputPath, 'utf8');
    return JSON.parse(result) as RhubarbResult;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};
