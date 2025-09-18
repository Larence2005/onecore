
import * as z from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export const signUpSchema = z.object({
    organizationName: z.string().min(1, "Organization name is required."),
    domain: z.string().min(1, "Domain is required.").regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/, "Invalid domain format."),
    name: z.string().min(1, "Your name is required."),
    email: z.string().email("Invalid email address."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
}).refine((data) => data.email.endsWith(`@${data.domain}`), {
    message: "Email address must match the organization's domain.",
    path: ["email"],
});

export const memberSignUpSchema = z.object({
    email: z.string().email("Invalid email address."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type MemberSignUpFormData = z.infer<typeof memberSignUpSchema>;
