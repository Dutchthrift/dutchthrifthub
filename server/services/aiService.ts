import OpenAI from 'openai';
import { db } from './supabaseClient';
import {
    emailThreads,
    emailMessages,
    aiSettings,
    aiExamples,
    aiScenarios,
    orders,
    repairs,
    returns,
    cases,
    ilike,
    type EmailMessage,
    type AISettings,
    type AIExample,
    type AIScenario
} from '../../shared/schema';
import { eq, desc, asc, and } from 'drizzle-orm';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export class AIService {
    /**
     * Initializes default settings if they don't exist.
     */
    async ensureSettings() {
        try {
            const existing = await db.query.aiSettings.findFirst();
            if (!existing) {
                await db.insert(aiSettings).values({
                    styleGuide: "Je bent de AI-assistent van de DutchThriftHub. Wees nuchter, vriendelijk en help de gebruiker (Niek) om mails efficiënt te beantwoorden. Gebruik 'je' en 'jij', wees direct maar beleefd. Onze stijl is informeel maar professioneel.",
                    useHonorifics: false,
                    allowEmojis: true,
                    brevityLevel: 5
                });
                console.log("[AI] Default settings initialized.");
            }
        } catch (e) {
            console.error("[AI] Failed to initialize settings:", e);
        }
    }

    /**
     * Main entry point to analyze an email thread.
     * Gets context, queries AI, and saves results to the database.
     */
    async analyzeThread(threadId: string) {
        try {
            // 1. Fetch thread and messages
            const thread = await db.query.emailThreads.findFirst({
                where: eq(emailThreads.threadId, threadId),
            });

            const threadMessages = await db.query.emailMessages.findMany({
                where: eq(emailMessages.threadId, thread.id),
                orderBy: (messages, { asc }) => [asc(messages.sentAt)],
            });

            if (!thread || threadMessages.length === 0) {
                console.log(`[AI] No messages found for thread ${threadId} (DB ID: ${thread?.id})`);
                return null;
            }

            // 2. Get Hub Context (Order, Repair, Customer)
            const context = await this.getHubContext(thread);

            // 3. Get AI Rules (Style, SOPs)
            const rules = await this.getAIRules();

            // 4. Prepare Prompt
            const prompt = await this.buildPrompt(threadMessages, context, rules);

            // 5. Query OpenAI
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            });

            const aiResult = JSON.parse(response.choices[0].message.content || "{}");

            // 6. Save to Database
            await db.update(emailThreads)
                .set({
                    aiSummary: aiResult.summary,
                    sentiment: aiResult.sentiment,
                    detectedIntent: aiResult.intent,
                    suggestedReply: aiResult.suggestedReply,
                    aiInsights: {
                        reasoning: aiResult.reasoning,
                        actionPlan: aiResult.actionPlan,
                        systemStatus: aiResult.systemStatus
                    },
                    lastAiSync: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(emailThreads.threadId, threadId));

            return aiResult;
        } catch (error) {
            console.error("AI Analysis Error:", error);
            return null;
        }
    }

    private async getHubContext(thread: any) {
        const customerEmail = thread.customerEmail;
        if (!customerEmail) return { history: "Geen klant email gevonden." };

        const [customerOrders, customerReturns, customerRepairs, customerCases] = await Promise.all([
            db.query.orders.findMany({ where: ilike(orders.customerEmail, customerEmail), limit: 5, orderBy: [desc(orders.createdAt)] }),
            db.query.returns.findMany({ where: ilike(returns.customerEmail, customerEmail), limit: 5, orderBy: [desc(returns.createdAt)] }),
            db.query.repairs.findMany({ where: ilike(repairs.customerEmail, customerEmail), limit: 5, orderBy: [desc(repairs.createdAt)] }),
            db.query.cases.findMany({ where: ilike(cases.customerEmail, customerEmail), limit: 5, orderBy: [desc(cases.createdAt)] }),
        ]);

        const history = {
            orders: customerOrders.map(o => ({ id: o.orderNumber, status: o.status, date: o.createdAt })),
            returns: customerReturns.map(r => ({ id: r.returnNumber, status: r.status, reason: r.returnReason })),
            repairs: customerRepairs.map(r => ({ id: r.repairNumber, status: r.status, title: r.title })),
            cases: customerCases.map(c => ({ id: c.caseNumber, status: c.status, title: c.title }))
        };

        return { history, currentOrderId: thread.orderId, currentCaseId: thread.caseId };
    }

    private async getAIRules(): Promise<{ settings: AISettings | undefined; examples: AIExample[]; scenarios: AIScenario[] }> {
        await this.ensureSettings(); // Ensure settings exist before fetching
        const settings: AISettings | undefined = await db.query.aiSettings.findFirst();
        const examples: AIExample[] = await db.query.aiExamples.findMany({
            where: (r: any) => eq(r.isActive, true),
            limit: 3
        }) as AIExample[];
        const scenarios: AIScenario[] = await db.query.aiScenarios.findMany({
            where: (r: any) => eq(r.isActive, true)
        }) as AIScenario[];

        return { settings, examples, scenarios };
    }

    private async buildPrompt(threadMessages: EmailMessage[], context: any, rules: { settings: AISettings | undefined; examples: AIExample[]; scenarios: AIScenario[] }): Promise<string> {
        const { settings, examples, scenarios } = rules;

        const prompt = `
Je bent een senior AI email-assistent voor DutchThrift. 
VAT DE VOLGENDE CONVERSATIE SAMEN EN GEEF DIEPE CONSTRUCTIEVE INZICHTEN.

BELANGRIJK: 
1. Gebruik de "HUB CONTEXT" hieronder om te zien of een klant al een bestelling, retour of reparatie heeft. 
2. Als er in de HUB CONTEXT een retour, case of order staat, zeg dan NOOIT dat er "geen records zijn". 
3. De "systemStatus" moet specifiek vermelden wat er in de Hub staat (bijv: "Er is een actieve retour RET-2025-030 onderweg").

CONVERSATIE:
${threadMessages.map((m: EmailMessage) => `VAN: ${m.fromName} (${m.fromEmail})\nDATUM: ${m.sentAt}\nINHOUD: ${m.bodyText || m.snippet}`).join('\n---\n')}

HUB CONTEXT (KLANT GESCHIEDENIS):
${JSON.stringify(context.history, null, 2)}
Huidige gekoppelde Order: ${context.currentOrderId || 'Geen'}
Huidige gekoppelde Case: ${context.currentCaseId || 'Geen'}

STIJLGIDS:
${settings?.styleGuide || "Wees vriendelijk, nuchter en professioneel in het Nederlands. Gebruik 'je' tenzij anders aangegeven."}
- Gebruik ${settings?.useHonorifics ? "u" : "je/jij"}
- Emojis: ${settings?.allowEmojis ? "Toegestaan (beperkt)" : "Niet toegestaan"}
- Beknoptheid: ${settings?.brevityLevel || 5}/10 (1=kort, 10=uitgebreid)

OUTPUT FORMAT (JSON):
{
  "summary": "Korte samenvatting (1-2 zinnen)",
  "sentiment": "positive" | "negative" | "neutral",
  "intent": "REPAIR" | "ORDER_STATUS" | "RETURN" | "QUESTION" | "OTHER",
  "reasoning": "Diepere analyse van het probleem van de klant (bijv. compatibiliteit, eerdere klachten). Gebruik info uit de HUB CONTEXT.",
  "systemStatus": "Status-update EXCLUSIEF gebaseerd op de HUB CONTEXT (bijv. 'Klant heeft 1 open retour RET-2025-XXX op status onderweg').",
  "actionPlan": "Stapsgewijs plan voor Niek (bijv. 1. Check Shopify docs, 2. Mail klant terug).",
  "suggestedReply": "Een perfect, kant-en-klaar antwoord in de DutchThrift stijl."
}
`;

        return prompt;
    }
}

export const aiService = new AIService();
