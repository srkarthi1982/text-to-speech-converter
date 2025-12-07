/**
 * Text-to-Speech Converter - generate audio from text.
 *
 * Design goals:
 * - Track TTS jobs with voice, speed, and output location.
 * - Support history for replay/download.
 * - Ready for analytics like total characters & duration.
 */

import { defineTable, column, NOW } from "astro:db";

export const TtsJobs = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),

    inputText: column.text(),                          // full input text
    language: column.text({ optional: true }),         // "en-US", "en-IN", etc.
    voiceName: column.text({ optional: true }),        // "female-1", "male-2", etc.
    speakingRate: column.number({ optional: true }),   // 1.0 = normal
    pitch: column.number({ optional: true }),          // semitone offset, if used
    audioFormat: column.text({ optional: true }),      // "mp3", "wav", "ogg"

    audioUrl: column.text({ optional: true }),         // generated audio file
    durationSeconds: column.number({ optional: true }),
    characterCount: column.number({ optional: true }),

    status: column.text({ optional: true }),           // "queued", "processing", "completed", "failed"
    errorMessage: column.text({ optional: true }),

    createdAt: column.date({ default: NOW }),
    completedAt: column.date({ optional: true }),
  },
});

export const tables = {
  TtsJobs,
} as const;
