import { z } from 'zod';

export const requiredText = (max: number, label = 'This field') =>
  z.string().trim().min(1, `${label} is required`).max(max, `Use at most ${max} characters`);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .nullable()
    .transform((v) => (v ? v : null));

const EMAIL_PATTERN =
  /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9_%+-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

export const isEmail = (value: string) => {
  const v = value.trim().toLowerCase();
  return v.length <= 150 && EMAIL_PATTERN.test(v) && !v.includes('..');
};

const EMAIL_MESSAGE = 'Enter a valid email address, e.g. name@example.com';

export const emailString = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .refine(isEmail, EMAIL_MESSAGE)
  .transform((v) => v.toLowerCase());

export const optionalEmail = z
  .string()
  .trim()
  .max(150)
  .nullable()
  .refine((v) => !v || isEmail(v), EMAIL_MESSAGE)
  .transform((v) => (v ? v.toLowerCase() : null));

export const moneyString = (label = 'Amount') =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Use a number with up to 2 decimals');

export const quantityString = (label = 'Quantity') =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(/^\d{1,10}(\.\d{1,3})?$/, 'Use a number with up to 3 decimals');

export const positiveQuantity = (label = 'Quantity') =>
  quantityString(label).refine((v) => Number(v) > 0, `${label} must be more than zero`);

export const phoneString = z
  .string()
  .trim()
  .regex(/^[0-9+\- ]{5,30}$/, 'Use digits, +, - or spaces');

export const usernameString = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,50}$/, '3–50 letters, digits, dot, dash or underscore');

export const passwordString = z.string().min(8, 'Use at least 8 characters').max(72);

export const patientPhone = z
  .string()
  .trim()
  .min(1, 'Phone is required')
  .max(30)
  .refine((v) => /^[0-9+\- ]+$/.test(v), 'Use digits, +, - or spaces')
  .refine((v) => v.replace(/\D/g, '').length >= 10, 'Enter a full phone number, e.g. 923001234567');

export const optionalAge = z
  .string()
  .trim()
  .regex(/^(\d{1,3})?$/, 'Use a whole number')
  .refine((v) => !v || Number(v) <= 150, 'Use an age up to 150');

export const timeString = (label = 'Time') =>
  z
    .string()
    .min(1, `${label} is required`)
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
