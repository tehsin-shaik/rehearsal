import { z } from "zod";
export const reportSchema = z.object({ id: z.string().min(1).max(200), receivedAt: z.string().datetime({ offset: true }), subject: z.string().min(1).max(500), body: z.string().min(1).max(20000), senderName: z.string().max(200).optional(), senderEmail: z.string().email().optional(), unread: z.boolean().optional(), threadId: z.string().max(200).optional() }).strict();
export const modelUnderstandingSchema = z.object({
    category: z.enum(["authentication", "api_timeout", "billing", "sales", "logistics", "product", "privacy", "unresolved"]),
    department: z.enum(["technical_support", "billing", "sales", "logistics", "engineering", "legal", "unresolved"]),
    severity: z.enum(["low", "medium", "high", "unresolved"]), labels: z.array(z.string().max(40)).max(6),
    evidence: z.array(z.string().min(3).max(250)).max(6), confidence: z.number().min(0).max(1),
}).strict();
