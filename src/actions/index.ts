import type { ActionAPIContext } from "astro:actions";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { and, count, db, desc, eq, TtsJobs } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

export const server = {
  createTtsJob: defineAction({
    input: z.object({
      inputText: z.string().min(1),
      language: z.string().optional(),
      voiceName: z.string().optional(),
      speakingRate: z.number().positive().optional(),
      pitch: z.number().optional(),
      audioFormat: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const job = {
        id: crypto.randomUUID(),
        userId: user.id,
        inputText: input.inputText,
        language: input.language,
        voiceName: input.voiceName,
        speakingRate: input.speakingRate,
        pitch: input.pitch,
        audioFormat: input.audioFormat,
        characterCount: input.inputText.length,
        status: "queued",
        createdAt: now,
      } satisfies typeof TtsJobs.$inferInsert;

      await db.insert(TtsJobs).values(job);

      return {
        success: true,
        data: { job },
      };
    },
  }),

  updateTtsJob: defineAction({
    input: z.object({
      id: z.string().min(1),
      status: z.enum(["queued", "processing", "completed", "failed"]).optional(),
      audioUrl: z.string().url().optional(),
      durationSeconds: z.number().nonnegative().optional(),
      characterCount: z.number().int().nonnegative().optional(),
      language: z.string().optional(),
      voiceName: z.string().optional(),
      speakingRate: z.number().positive().optional(),
      pitch: z.number().optional(),
      audioFormat: z.string().optional(),
      errorMessage: z.string().optional(),
      completedAt: z.date().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [existingJob] = await db
        .select()
        .from(TtsJobs)
        .where(and(eq(TtsJobs.id, input.id), eq(TtsJobs.userId, user.id)));

      if (!existingJob) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "TTS job not found.",
        });
      }

      const updateData: Partial<typeof TtsJobs.$inferInsert> = {};

      if (input.status) updateData.status = input.status;
      if (input.audioUrl) updateData.audioUrl = input.audioUrl;
      if (input.durationSeconds !== undefined) {
        updateData.durationSeconds = input.durationSeconds;
      }
      if (input.characterCount !== undefined) {
        updateData.characterCount = input.characterCount;
      }
      if (input.language !== undefined) updateData.language = input.language;
      if (input.voiceName !== undefined) updateData.voiceName = input.voiceName;
      if (input.speakingRate !== undefined) {
        updateData.speakingRate = input.speakingRate;
      }
      if (input.pitch !== undefined) updateData.pitch = input.pitch;
      if (input.audioFormat !== undefined) updateData.audioFormat = input.audioFormat;
      if (input.errorMessage !== undefined) updateData.errorMessage = input.errorMessage;

      if (input.completedAt) {
        updateData.completedAt = input.completedAt;
      } else if (input.status === "completed") {
        updateData.completedAt = new Date();
      }

      if (Object.keys(updateData).length === 0) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Provide at least one field to update.",
        });
      }

      await db
        .update(TtsJobs)
        .set(updateData)
        .where(and(eq(TtsJobs.id, input.id), eq(TtsJobs.userId, user.id)));

      const [job] = await db
        .select()
        .from(TtsJobs)
        .where(and(eq(TtsJobs.id, input.id), eq(TtsJobs.userId, user.id)));

      return {
        success: true,
        data: { job },
      };
    },
  }),

  getTtsJob: defineAction({
    input: z.object({
      id: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [job] = await db
        .select()
        .from(TtsJobs)
        .where(and(eq(TtsJobs.id, input.id), eq(TtsJobs.userId, user.id)));

      if (!job) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "TTS job not found.",
        });
      }

      return {
        success: true,
        data: { job },
      };
    },
  }),

  listMyTtsJobs: defineAction({
    input: z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const offset = (input.page - 1) * input.pageSize;

      const [{ value: total }] = await db
        .select({ value: count() })
        .from(TtsJobs)
        .where(eq(TtsJobs.userId, user.id));

      const items = await db
        .select()
        .from(TtsJobs)
        .where(eq(TtsJobs.userId, user.id))
        .orderBy(desc(TtsJobs.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      return {
        success: true,
        data: {
          items,
          total,
          page: input.page,
          pageSize: input.pageSize,
        },
      };
    },
  }),
};
