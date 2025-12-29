import OpenAI from 'openai';
import { db } from './database';
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
    aiKnowledge,
    type EmailMessage,
    type AiSettings,
    type AiExample,
    type AiScenario,
    type AiKnowledge
} from '../../shared/schema';
import { eq, desc, asc, and, ilike, or } from 'drizzle-orm';

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

            if (!thread) {
                console.log(`[AI] Thread not found: ${threadId}`);
                return null;
            }

            const threadMessages = await db.query.emailMessages.findMany({
                where: eq(emailMessages.threadId, thread.id),
                orderBy: (messages, { asc }) => [asc(messages.sentAt)],
            });

            if (threadMessages.length === 0) {
                console.log(`[AI] No messages found for thread ${threadId} (DB ID: ${thread.id})`);
                return null;
            }

            // 2. Get Hub Context (Order, Repair, Customer)
            const context = await this.getHubContext(thread);

            // 3. Get AI Rules (Style, SOPs, Knowledge)
            const rules = await this.getAIRules(threadMessages);

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

            const aiReply = response.choices[0].message.content || "{}";
            const aiResult = JSON.parse(aiReply);
            console.log(`[AI] Result for thread ${threadId}:`, JSON.stringify(aiResult, null, 2));

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

            const updatedThread = await db.query.emailThreads.findFirst({
                where: eq(emailThreads.threadId, threadId),
            });
            console.log(`[AI] Saved suggestedReply for thread ${threadId}:`, JSON.stringify(updatedThread?.suggestedReply, null, 2));

            return aiResult;
        } catch (error) {
            console.error("AI Analysis Error:", error);
            return null;
        }
    }

    private async getHubContext(thread: any) {
        const customerEmail = thread.customerEmail;
        const customerId = thread.customerId;

        if (!customerEmail && !customerId) {
            return { history: "Geen klantgegevens gevonden in dit maildraadje." };
        }

        const conditions = [];
        if (customerEmail) conditions.push(ilike(orders.customerEmail, customerEmail));
        if (customerId) conditions.push(eq(orders.customerId, customerId));

        const getWhere = (table: any) => {
            const conds = [];
            if (customerEmail) conds.push(ilike(table.customerEmail, customerEmail));
            if (customerId) conds.push(eq(table.customerId, customerId));
            return conds.length > 1 ? or(...conds) : conds[0];
        };

        const [customerOrders, customerReturns, customerRepairs, customerCases] = await Promise.all([
            db.query.orders.findMany({
                where: getWhere(orders),
                limit: 10,
                orderBy: [desc(orders.createdAt)]
            }),
            db.query.returns.findMany({
                where: getWhere(returns),
                limit: 10,
                orderBy: [desc(returns.createdAt)]
            }),
            db.query.repairs.findMany({
                where: getWhere(repairs),
                limit: 10,
                orderBy: [desc(repairs.createdAt)]
            }),
            db.query.cases.findMany({
                where: getWhere(cases),
                limit: 10,
                orderBy: [desc(cases.createdAt)]
            }),
        ]);

        const history = {
            orders: customerOrders.map(o => ({ id: o.orderNumber, status: o.status, date: o.createdAt, total: o.totalAmount })),
            returns: customerReturns.map(r => ({ id: r.returnNumber, status: r.status, reason: r.returnReason, date: r.createdAt })),
            repairs: customerRepairs.map(r => ({ id: r.repairNumber, status: r.status, title: r.title, date: r.createdAt })),
            cases: customerCases.map(c => ({ id: c.caseNumber, status: c.status, title: c.title, date: c.createdAt }))
        };

        return {
            history,
            currentOrderId: thread.orderId,
            currentCaseId: thread.caseId,
            customerEmail,
            customerId
        };
    }

    /**
     * Search the knowledge base via AI.
     */
    async searchKnowledge(query: string) {
        try {
            const knowledgeBase = await db.query.aiKnowledge.findMany({
                where: eq(aiKnowledge.isActive, true)
            });

            const systemPrompt = `
Je bent een expert in de databank van DutchThrift. 
BEANTWOORD DE VRAAG GEBASEERD OP DE ONDERSTAANDE KENNISBANK.
Als het antwoord niet in de kennisbank staat, zeg dat dan eerlijk.

KENNISBANK:
${knowledgeBase.map(k => `[${k.category}] ${k.title}\n${k.content}`).join('\n\n')}
`;

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: query }
                ]
            });

            return response.choices[0].message.content;
        } catch (e) {
            console.error("[AI] Knowledge search failed:", e);
            return "Er is een fout opgetreden bij het doorzoeken van de kennisbank.";
        }
    }

    private async getRelevantKnowledge(messages: EmailMessage[]): Promise<AiKnowledge[]> {
        const lastMessage = messages[messages.length - 1]?.bodyText || "";
        const allKnowledge = await db.query.aiKnowledge.findMany({
            where: eq(aiKnowledge.isActive, true)
        });

        // Simple keyword-based filtering for now. Could be upgraded to vector search.
        const relevant = allKnowledge.filter(k => {
            const words = k.title.toLowerCase().split(' ');
            return words.some(word => word.length > 3 && lastMessage.toLowerCase().includes(word));
        });

        // If no specific match, return general documents if any
        return relevant.length > 0 ? relevant : allKnowledge.filter(k => k.category === "Algemeen");
    }

    private async getAIRules(messages: EmailMessage[]): Promise<{ settings: AiSettings | undefined; examples: AiExample[]; scenarios: AiScenario[]; knowledge: AiKnowledge[] }> {
        await this.ensureSettings();
        const settings: AiSettings | undefined = await db.query.aiSettings.findFirst();
        const examples: AiExample[] = await db.query.aiExamples.findMany({
            where: (r: any) => eq(r.isActive, true),
            limit: 3
        }) as AiExample[];
        const scenarios: AiScenario[] = await db.query.aiScenarios.findMany({
            where: (r: any) => eq(r.isActive, true)
        }) as AiScenario[];

        const knowledge = await this.getRelevantKnowledge(messages);

        return { settings, examples, scenarios, knowledge };
    }

    private async buildPrompt(threadMessages: EmailMessage[], context: any, rules: { settings: AiSettings | undefined; examples: AiExample[]; scenarios: AiScenario[]; knowledge: AiKnowledge[] }): Promise<string> {
        const { settings, examples, scenarios, knowledge } = rules;

        const prompt = `
Je bent een senior AI email-assistent voor DutchThrift. 
VAT DE VOLGENDE CONVERSATIE SAMEN EN GEEF DIEPE CONSTRUCTIEVE INZICHTEN.
VERBETER HET ANTWOORD EN MAAK HET KLANTVRIENDELIJKER.
GIVE THE SUGGESTED REPLY IN BOTH THE CUSTOMER'S LANGUAGE AND ENGLISH.

BELANGRIJK VOOR DE "suggestedReply": 
1. Gebruik ALTIJD de "Vaste Aanhef/Header" als de eerste zin van het bericht.
2. Gebruik ALTIJD de "Vaste Afsluiting/Footer" als de laatste zin van het bericht.
3. Houd je STRIKT aan de "Structurele Regels" en de "STIJLGIDS".
4. Gebruik NOOIT de "VERBODEN WOORDEN/ZINNEN".
5. Gebruik de "HUB CONTEXT" hieronder om te zien of een klant al een bestelling, retour of reparatie heeft. 
6. Als er in de HUB CONTEXT een retour, case of order staat, zeg dan NOOIT dat er "geen records zijn". 
7. De "systemStatus" moet specifiek vermelden wat er in de Hub staat.

CONVERSATIE:
${threadMessages.map((m: EmailMessage) => `VAN: ${m.fromName} (${m.fromEmail})\nDATUM: ${m.sentAt}\nINHOUD: ${m.bodyText || m.snippet}`).join('\n---\n')}

HUB CONTEXT (KLANT GESCHIEDENIS):
${JSON.stringify(context.history, null, 2)}
Huidige gekoppelde Order: ${context.currentOrderId || 'Geen'}
Huidige gekoppelde Case: ${context.currentCaseId || 'Geen'}

KENNISBANK (DOCUMENTATIE & VOORWAARDEN):
${knowledge.length > 0 ? knowledge.map(k => `[${k.category}] ${k.title}:\n${k.content}`).join('\n\n') : "Geen specifieke documentatie gevonden voor deze context."}

STIJLGIDS & STRUCTUUR:
${settings?.styleGuide || "Wees vriendelijk, nuchter en professioneel in het Nederlands. Gebruik 'je' tenzij anders aangegeven."}
- Gebruik ${settings?.useHonorifics ? "u" : "je/jij"}
- Emojis: ${settings?.allowEmojis ? "Toegestaan (beperkt)" : "Niet toegestaan"}
- Beknoptheid: ${settings?.brevityLevel || 5}/10 (1=kort, 10=uitgebreid)

${settings?.emailHeader ? `Vaste Aanhef/Header:\n${settings.emailHeader}` : ""}
${settings?.emailFooter ? `Vaste Afsluiting/Footer:\n${settings.emailFooter}` : ""}
${settings?.structureRules ? `Structurele Regels:\n${settings.structureRules}` : ""}
${settings?.prohibitedPhrases?.length ? `VERBODEN WOORDEN/ZINNEN (NIET GEBRUIKEN):\n${settings.prohibitedPhrases.join(', ')}` : ""}

OUTPUT FORMAT (JSON):
{
  "summary": "Korte samenvatting (1-2 zinnen)",
  "sentiment": "positive" | "negative" | "neutral",
  "intent": "REPAIR" | "ORDER_STATUS" | "RETURN" | "QUESTION" | "OTHER",
  "reasoning": "Diepere analyse van het probleem van de klant (bijv. compatibiliteit, eerdere klachten). Gebruik info uit de HUB CONTEXT en KENNISBANK.",
  "systemStatus": "Status-update EXCLUSIEF gebaseerd op de HUB CONTEXT (bijv. 'Klant heeft 1 open retour RET-2025-XXX op status onderweg').",
  "actionPlan": "Stapsgewijs plan voor Niek (bijv. 1. Check Shopify docs, 2. Mail klant terug).",
  "suggestedReply": {
    "customer": "Een perfect, kant-en-klaar antwoord in de DutchThrift stijl, in de taal die de klant gebruikt. Verbeter het bericht en maak het uiterst klantvriendelijk en professioneel. Gebruik de KENNISBANK info indien relevant.",
    "english": "The same perfect, customer-friendly reply translated into professional English."
  }
}
`;

        return prompt;
    }

    /**
     * Rewrite text based on the selected mode.
     */
    async rewriteText(text: string, mode: 'rewrite' | 'english' | 'customer_english', threadId?: string) {
        try {
            let systemPrompt = `Je bent een professionele business communication expert voor DutchThrift.
            Je doel is om concept-teksten te verbeteren naar professionele, klantvriendelijke e-mails.
            Gebruik de 'je'-vorm, wees nuchter, vriendelijk en helpend.`;

            let userContent = text;

            // FETCH CONTEXT (Always try to get context if threadId is present)
            let lastCustomerMessage = "";
            let contextData = null;

            if (threadId) {
                try {
                    const thread = await db.query.emailThreads.findFirst({ where: eq(emailThreads.threadId, threadId) });
                    if (thread) {
                        const threadMessages = await db.query.emailMessages.findMany({
                            where: eq(emailMessages.threadId, thread.id),
                            orderBy: (messages, { asc }) => [asc(messages.sentAt)],
                        });

                        // Find last message that is NOT from us (inbound)
                        // This ensures we detect the language of the CUSTOMER, not our own previous reply.
                        const inboundMessages = threadMessages.filter(m => !m.isOutbound);
                        const lastMsg = inboundMessages.length > 0 ? inboundMessages[inboundMessages.length - 1] : threadMessages[threadMessages.length - 1];
                        lastCustomerMessage = lastMsg?.bodyText || lastMsg?.snippet || "";

                        // Only fetch full hub context if generating draft to save tokens/time on simple rewrites? 
                        // Actually, hub context is good for rewrites too (order details etc).
                        contextData = await this.getHubContext(thread);
                    }
                } catch (e) {
                    console.warn("[AI] Failed to fetch context for rewrite:", e);
                }
            }

            // HANDLE DRAFT GENERATION (Empty Text) vs REWRITE
            if (!text || text.trim() === "") {
                if (!threadId) throw new Error("Thread ID vereist voor concept generatie");
                // ...(Use contextData we just fetched)...

                systemPrompt += `
                
                SITUATIE: Je schrijft een NIEUW ANTWOORD op een lopende conversatie.
                Gebruik de onderstaande informatie/context slim.
                
                LAATSTE BERICHT VAN KLANT (Gebruik dit om de TAAL van de klant te bepalen):
                "${lastCustomerMessage}"
                
                HUB CONTEXT:
                ${contextData ? JSON.stringify(contextData.history, null, 2) : 'Geen'}
                `;

                userContent = "Genereer een passend antwoord.";
            } else {
                // NORMAL REWRITE (Text Provided)
                systemPrompt += `
                SITUATIE: Je herschrijft een concept tekst.
                
                CONTEXT (Gebruik dit voor feiten en TAAL detectie):
                Laatste bericht van klant: "${lastCustomerMessage}"
                `;
            }

            // ADD OUTPUT MODE INSTRUCTIONS
            if (mode === 'rewrite') {
                systemPrompt += `
                TAAK: Herschrijf de tekst.
                BELANGRIJK: 
                1. BEHOUD DE TAAL VAN DE INVOER. Als de invoer Engels is, MOET het antwoord Engels zijn. Als het Nederlands is, Nederlands. Vertaal NIET (tenzij expliciet gevraagd in de tekst).
                2. MAAK HET EXTRA KLANTVRIENDELIJK. Gebruik een warme, behulpzame toon. Niet te formeel, maar wel professioneel.
                3. Verbeter grammatica en zinsbouw.`;
            } else if (mode === 'customer_english') {
                systemPrompt += `
                TAAK: Genereer TWEE versies.
                1. [Klanttaal]: Detecteer de taal uit het "Laatste bericht van klant". Is dat Spaans? Duits? Frans? Schrijf dan in die taal. Als niet te bepalen, gebruik Nederlands.
                2. [English]: Professioneel Engels.
                
                OUTPUT FORMAAT VERPLICHT:
                [Versie in Klanttaal]
                
                ---
                
                [English Version]
                `;
            }

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                ],
                temperature: 0.7
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error("[AI] Rewrite/Generate failed:", error);
            throw new Error("Kon tekst niet genereren/herschrijven");
        }
    }
}

export const aiService = new AIService();
