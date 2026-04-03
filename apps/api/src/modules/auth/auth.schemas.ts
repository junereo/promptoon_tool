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
