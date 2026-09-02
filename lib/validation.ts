import { z } from "zod";
import { Department, UserRole } from "@prisma/client";

// Every external input is parsed through one of these before it reaches
// the database (plan Phase 6).

export const loginSchema = z.object({
  // Deliberately not .email() here: this is only a lookup key, and any
  // legacy account created before the email switch must still be able to
  // sign in. Format is enforced where accounts are *created*, below.
  email: z.string().trim().toLowerCase().min(1, "Email is required").max(160),
  password: z.string().min(1, "Password is required").max(200),
});

export const createLpoSchema = z.object({
  projectName: z.string().trim().min(1, "Project name is required").max(200),
  amount: z.coerce
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Amount must be greater than zero")
    .max(9_999_999_999.99, "Amount is too large"),
  // Margin is optional and only ever surfaced to managers.
  margin: z.coerce
    .number({ invalid_type_error: "Margin must be a number" })
    .min(0)
    .max(9_999_999_999.99)
    .optional(),
  customerLpoRef: z.string().trim().max(120).optional().or(z.literal("")),
  // An employee can save a quote or record a converted LPO directly.
  status: z.enum(["quoted", "converted_lpo"]),
});

export const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(160)
    .email("Enter a valid email address"),
  fullName: z.string().trim().min(1, "Full name is required").max(120),
  department: z.nativeEnum(Department),
  role: z.nativeEnum(UserRole),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(5, "New password must be at least 5 characters")
      .max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "The two passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "New password must be different from the current one",
    path: ["newPassword"],
  });
