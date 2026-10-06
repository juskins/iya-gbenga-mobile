import { z } from "zod";

export const LAGOS_LGAS = [
  "Lekki / Eti-Osa",
  "Ajah / Sangotedo",
  "Ikoyi / Victoria Island",
  "Ikeja",
  "Surulere",
  "Yaba / Mainland",
  "Maryland / Ikorodu Road",
  "Festac / Amuwo-Odofin",
] as const;

export const NIGERIAN_MOBILE = /^0[7-9][01]\d{8}$/;

export const stripPhone = (value: string): string => value.replace(/[\s-]/g, "");

export const checkoutSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(60, "Max 60 characters"),
  lastName: z.string().trim().min(1, "Enter your last name").max(60, "Max 60 characters"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().refine((v) => NIGERIAN_MOBILE.test(stripPhone(v)), "Enter a valid Nigerian mobile number"),
  street: z.string().trim().min(5, "Enter your street address").max(150, "Max 150 characters"),
  unit: z.string().trim().max(100, "Max 100 characters"),
  state: z.literal("Lagos", { message: "We only deliver within Lagos for now" }),
  lga: z.enum(LAGOS_LGAS, { message: "Choose your area" }),
  landmark: z.string().trim().max(250, "Max 250 characters"),
  shippingMethod: z.string().min(1, "Choose a delivery option"),
  paymentMethod: z.enum(["pay_on_delivery", "bank_transfer"]),
  saveAsDefault: z.boolean(),
});

export type CheckoutValues = z.infer<typeof checkoutSchema>;
