import { z } from 'zod';

const credentialSchema = z.string().trim().min(8);

export const registerSchema = z.object({
  loginId: credentialSchema,
  password: credentialSchema
});

export const loginSchema = z.object({
  loginId: credentialSchema,
  password: credentialSchema
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(64).transform((value) => value.replace(/\s+/g, ' '))
});
