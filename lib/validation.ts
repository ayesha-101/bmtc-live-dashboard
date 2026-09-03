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

const money = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(9_999_999_999.99, `${label} is too large`);

// Stage 1 — the Estimation team logs an enquiry, optionally quoting it in
// the same step.
export const createDealSchema = z
  .object({
    enquiryDate: z.coerce.date({ invalid_type_error: "Enquiry date is required" }),
    customer: z.string().trim().min(1, "Customer is required").max(160),
    projectName: z.string().trim().min(1, "Project name is required").max(200),
    salesPerson: z.string().trim().max(120).optional().or(z.literal("")),
    deResponsible: z.string().trim().max(120).optional().or(z.literal("")),
    // Quotation is optional at this point.
    quoteRef: z.string().trim().max(120).optional().or(z.literal("")),
    quoteValue: money("Quote value").optional(),
    quoteGp: money("Quote GP").optional(),
    quoteDate: z.coerce.date().optional(),
  })
  .refine((v) => v.quoteGp === undefined || v.quoteValue === undefined || v.quoteGp <= v.quoteValue, {
    message: "GP cannot exceed the quote value",
    path: ["quoteGp"],
  });

// Stage 2 — the customer awards the job.
export const lpoSchema = z
  .object({
    lpoRef: z.string().trim().min(1, "LPO reference is required").max(120),
    lpoValue: money("LPO value"),
    lpoGp: money("LPO GP").optional(),
    lpoDate: z.coerce.date({ invalid_type_error: "LPO date is required" }),
  })
  .refine((v) => v.lpoGp === undefined || v.lpoGp <= v.lpoValue, {
    message: "GP cannot exceed the LPO value",
    path: ["lpoGp"],
  });

// Stage 3 — Sales Admin bills it. This is the figure revenue is counted on.
export const invoiceSchema = z
  .object({
    invoiceRef: z.string().trim().min(1, "Invoice number is required").max(120),
    invoiceValue: money("Invoice value"),
    invoiceGp: money("Invoice GP").optional(),
    invoiceDate: z.coerce.date({ invalid_type_error: "Invoice date is required" }),
  })
  .refine((v) => v.invoiceGp === undefined || v.invoiceGp <= v.invoiceValue, {
    message: "GP cannot exceed the invoice value",
    path: ["invoiceGp"],
  });

export const quoteSchema = z
  .object({
    quoteRef: z.string().trim().min(1, "Quote reference is required").max(120),
    quoteValue: money("Quote value"),
    quoteGp: money("Quote GP").optional(),
    quoteDate: z.coerce.date({ invalid_type_error: "Quote date is required" }),
  })
  .refine((v) => v.quoteGp === undefined || v.quoteGp <= v.quoteValue, {
    message: "GP cannot exceed the quote value",
    path: ["quoteGp"],
  });

// Showroom: one form, one step. The LPO is the sale.
export const showroomSaleSchema = z
  .object({
    lpoDate: z.coerce.date({ invalid_type_error: "Date is required" }),
    customer: z.string().trim().min(1, "Customer is required").max(160),
    projectName: z.string().trim().min(1, "Description is required").max(200),
    salesPerson: z.string().trim().max(120).optional().or(z.literal("")),
    lpoRef: z.string().trim().min(1, "LPO reference is required").max(120),
    lpoValue: money("Value"),
    lpoGp: money("GP").optional(),
  })
  .refine((v) => v.lpoGp === undefined || v.lpoGp <= v.lpoValue, {
    message: "GP cannot exceed the value",
    path: ["lpoGp"],
  });

export const targetSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  revenueTarget: money("Revenue target"),
  gpTarget: money("GP target"),
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
