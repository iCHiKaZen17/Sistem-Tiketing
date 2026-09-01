import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi').max(100),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const userPasswordSchema = z
  .string()
  .min(10, 'Password harus terdiri dari minimal 10 karakter.')
  .max(128, 'Password tidak boleh lebih dari 128 karakter.');

export const createTicketSchema = z.object({
  reporter_id: z.string().uuid('ID reporter tidak valid'),
  app_name: z.string().max(200).optional(),
  error_desc: z.string().optional(),
  repro_steps: z.string().optional(),
});

export const assignStaffSchema = z.object({
  staff_id: z.string().uuid('ID staff tidak valid'),
  reason: z.string().max(500, 'Alasan maksimal 500 karakter').optional(),
});

export const resolveTicketSchema = z.object({
  resolution_note: z
    .string()
    .transform((str) => str.trim())
    .refine((val) => val.length >= 10, 'Catatan resolusi minimal 10 karakter')
    .refine((val) => val.length <= 2000, 'Catatan resolusi maksimal 2000 karakter'),
});

const ticketStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);

export const ticketFilterSchema = z.object({
  status: z.union([ticketStatusEnum, z.array(ticketStatusEnum)]).optional(),
  app_name: z.string().optional(),
  assigned_to: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().min(3, 'Pencarian minimal 3 karakter').optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username harus terdiri dari minimal 3 karakter.')
    .max(100, 'Username tidak boleh lebih dari 100 karakter.'),
  password: userPasswordSchema,
  full_name: z
    .string()
    .min(1, 'Nama lengkap wajib diisi.')
    .max(200, 'Nama lengkap tidak boleh lebih dari 200 karakter.'),
  role: z.enum(['STAFF', 'SUPERVISOR']),
});
