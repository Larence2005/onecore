
import * as z from "zod";

const passwordValidation = z
  .string()
  .min(8, { message: "Password must be at least 8 characters long." })
  .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter." })
  .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter." })
  .regex(/[0-9]/, { message: "Password must contain at least one number." })
  .regex(/[^A-Za-z0-9]/, { message: "Password must contain at least one special character." });


export const loginSchema = z.object({
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export const signUpSchema = z.object({
    organizationName: z.string().min(1, "Organization name is required."),
    domain: z.string().min(1, "Domain is required.").regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/, "Invalid domain format."),
    name: z.string().min(1, "Your name is required."),
    email: z.string().email("Invalid email address."),
    password: passwordValidation,
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
    password: passwordValidation,
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type MemberSignUpFormData = z.infer<typeof memberSignUpSchema>;


export interface Employee {
    name: string;
    email: string;
    address?: string;
    mobile?: string;
    landline?: string;
    status: 'Uninvited' | 'Invited' | 'Registered';
}

export interface OrganizationMember {
    uid: string | null;
    name: string;
    email: string;
    address?: string;
    mobile?: string;
    landline?: string;
    status: 'Uninvited' | 'Invited' | 'Registered' | 'Not Verified' | 'Verified';
    isClient?: boolean;
}
