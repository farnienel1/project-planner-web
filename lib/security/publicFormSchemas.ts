import { z } from 'zod'
import { isValidEmail, isValidUuid } from '@/lib/security/validation'

const website = z.string().max(200).optional().default('')

const email = z
  .string()
  .trim()
  .max(254)
  .refine(isValidEmail, 'Please add a valid email address.')

export const interestRegisterBodySchema = z.object({
  firstName: z.string().max(200),
  lastName: z.string().max(200),
  company: z.string().max(400),
  email,
  phone: z.string().max(80).optional().default(''),
  role: z.string().max(120).optional().default(''),
  teamSize: z.string().max(80).optional().default(''),
  sectors: z.array(z.string().max(80)).max(20).optional().default([]),
  currentTools: z.string().max(120).optional().default(''),
  message: z.string().max(4000).optional().default(''),
  consent: z.boolean(),
  website,
  source: z.string().max(120).optional().default(''),
  campaign: z.string().max(200).optional().default(''),
  referrer: z.string().max(800).optional().default(''),
  pagePath: z.string().max(300).optional().default(''),
  userAgent: z.string().max(1200).optional().default(''),
})

export const supportContactBodySchema = z.object({
  name: z.string().trim().min(1, 'Please add your name.').max(120),
  email,
  topic: z.enum(['General question', 'Sales and pricing', 'Technical support', 'Billing']),
  message: z.string().trim().min(1, 'Please add a message.').max(4000),
  website,
})

export const publicGateBodySchema = z.discriminatedUnion('form', [
  z.object({ form: z.literal('login'), email, website }),
  z.object({
    form: z.literal('signup'),
    email,
    firstName: z.string().trim().min(1, 'Please add your first name.').max(99),
    lastName: z.string().trim().min(1, 'Please add your last name.').max(99),
    mobileNumber: z.string().max(39).optional().default(''),
    website,
  }),
  z.object({ form: z.literal('reset-request'), email, website }),
  z.object({ form: z.literal('reset-complete'), website }),
  z.object({ form: z.literal('developer-login'), website }),
  z.object({
    form: z.literal('invite-setup'),
    invitationId: z.string().trim().refine(isValidUuid, 'invitationId is required'),
    website,
  }),
])

export type InterestRegisterBody = z.infer<typeof interestRegisterBodySchema>
export type SupportContactBody = z.infer<typeof supportContactBodySchema>
export type PublicGateBody = z.infer<typeof publicGateBodySchema>

export function honeypotFilled(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message || 'Check the form and try again.'
}
