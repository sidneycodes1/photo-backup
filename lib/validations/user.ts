import { z } from 'zod'

export const UpdateUserSchema = z
  .object({
    email: z.string().email().nullable().optional(),
    displayName: z.string().trim().min(1).max(120).nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .strict()

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
