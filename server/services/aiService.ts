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

// =============================================================================
// INTENT ROUTING - Priority-based category selection
// =============================================================================

// Category priority order (high → low)
const CATEGORY_PRIORITY = [
    'Technisch',      // Technical Support (highest priority)
    'Producten',      // Products & Compatibility
    'Retouren',       // Returns & Refunds
    'Garantie',       // Warranty & Repairs
    'Verzending',     // Shipping & Delivery
    'Betaling',       // Payment & Billing
    'FAQ',            // FAQ & Common Questions
    'Voorwaarden',    // Terms & Policies
    'Algemeen',       // General (lowest priority)
];

// Always-on categories (Layer 1 - Global)
const ALWAYS_ON_CATEGORIES = ['Stijl', 'Intern'];

// Category exclusion rules (if X matches, exclude Y)
const EXCLUSION_RULES: Record<string, string[]> = {
    'Technisch': ['FAQ', 'Algemeen'],
    'Retouren': ['Verzending'],
    'Producten': ['Algemeen'],
};

// Keyword mapping for intent detection
const INTENT_KEYWORDS: Record<string, string[]> = {
    'Technisch': ['defect', 'kapot', 'werkt niet', 'error', 'fout', 'probleem', 'stuk', 'broken', 'not working', 'issue', 'repair', 'reparatie', 'firmware', 'update', 'reset', 'instellingen', 'settings'],
    'Producten': ['lens', 'body', 'camera', 'objectief', 'compatibel', 'compatible', 'past', 'fits', 'adapter', 'mount', 'sensor', 'megapixel', 'conditie', 'condition', 'staat', 'tweedehands', 'used'],
    'Retouren': ['retour', 'return', 'terugsturen', 'send back', 'ruilen', 'exchange', 'niet tevreden', 'unhappy', 'verkeerd', 'wrong', 'omruilen', 'terug'],
    'Garantie': ['garantie', 'warranty', 'defect', 'kapot', 'reparatie', 'repair', 'vervangen', 'replace', 'maanden', 'months', 'jaar', 'year'],
    'Verzending': ['verzending', 'shipping', 'levering', 'delivery', 'track', 'tracking', 'bezorging', 'pakket', 'package', 'onderweg', 'transit', 'postnl', 'dhl', 'ups', 'wanneer', 'when', 'arrive'],
    'Betaling': ['betaling', 'payment', 'factuur', 'invoice', 'terugbetaling', 'refund', 'geld', 'money', 'euro', 'prijs', 'price', 'korting', 'discount', 'btw', 'vat'],
    'FAQ': ['vraag', 'question', 'hoe', 'how', 'wat', 'what', 'waarom', 'why', 'wanneer', 'when', 'info', 'informatie'],
};

interface AILogEntry {
    threadId: string;
    timestamp: Date;
    categoriesUsed: string[];
    inputTokens: number;
    outputTokens: number;
    intent: string;
    success: boolean;
}

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

    // =========================================================================
    // LAYER 1: Global/System Layer (always active)
    // =========================================================================
    private async buildLayer1Global(settings: AiSettings | undefined): Promise<string> {
        // Fetch always-on knowledge (Stijl & Intern)
        const alwaysOnKnowledge = await db.query.aiKnowledge.findMany({
            where: and(
                eq(aiKnowledge.isActive, true),
                or(
                    eq(aiKnowledge.category, 'Stijl'),
                    eq(aiKnowledge.category, 'Intern')
                )
            )
        });

        // Build compact global context (max ~500 tokens target)
        const stijlDoc = alwaysOnKnowledge.find(k => k.category === 'Stijl');
        const internDoc = alwaysOnKnowledge.find(k => k.category === 'Intern');

        return `
=== LAAG 1: IDENTITEIT (ALTIJD ACTIEF) ===
BEDRIJF: DutchThrift - Tweedehands camera's & lenzen specialist.
${internDoc ? `KERNINFO: ${this.truncateContent(internDoc.content, 200)}` : ''}

STIJL: ${settings?.styleGuide || "Vriendelijk, nuchter, professioneel. Gebruik 'je'."}
- Aanspreking: ${settings?.useHonorifics ? "u" : "je/jij"}
- Emoji's: ${settings?.allowEmojis ? "Ja (beperkt)" : "Nee"}
- Beknoptheid: ${settings?.brevityLevel || 5}/10
${settings?.emailHeader ? `AANHEF: ${settings.emailHeader}` : ''}
${settings?.emailFooter ? `AFSLUITING: ${settings.emailFooter}` : ''}
${settings?.prohibitedPhrases?.length ? `VERBODEN: ${settings.prohibitedPhrases.join(', ')}` : ''}
`;
    }

    // =========================================================================
    // LAYER 2: Context Layer (dynamic, selective)
    // =========================================================================
    private detectIntent(messageText: string): string[] {
        const text = messageText.toLowerCase();
        const matchedCategories: { category: string; score: number }[] = [];

        for (const [category, keywords] of Object.entries(INTENT_KEYWORDS)) {
            const matchCount = keywords.filter(kw => text.includes(kw)).length;
            if (matchCount > 0) {
                matchedCategories.push({ category, score: matchCount });
            }
        }

        // Sort by score (most keyword matches first), then by priority
        matchedCategories.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return CATEGORY_PRIORITY.indexOf(a.category) - CATEGORY_PRIORITY.indexOf(b.category);
        });

        return matchedCategories.map(m => m.category);
    }

    private applyExclusionRules(categories: string[]): string[] {
        const excluded = new Set<string>();

        for (const cat of categories) {
            const toExclude = EXCLUSION_RULES[cat] || [];
            toExclude.forEach(e => excluded.add(e));
        }

        return categories.filter(c => !excluded.has(c));
    }

    private truncateContent(content: string, maxChars: number): string {
        if (content.length <= maxChars) return content;
        return content.substring(0, maxChars).trim() + '...';
    }

    private async buildLayer2Context(messages: EmailMessage[]): Promise<{ layer: string; categoriesUsed: string[] }> {
        // Get last customer message for intent detection
        const lastInbound = messages.filter(m => !m.isOutbound).pop();
        const messageText = lastInbound?.bodyText || lastInbound?.snippet || messages[messages.length - 1]?.bodyText || '';

        // Detect intent and get matching categories
        let detectedCategories = this.detectIntent(messageText);

        // Apply exclusion rules
        detectedCategories = this.applyExclusionRules(detectedCategories);

        // Limit to max 3 categories
        const selectedCategories = detectedCategories.slice(0, 3);

        // Fetch knowledge for selected categories (excluding always-on)
        const relevantKnowledge = await db.query.aiKnowledge.findMany({
            where: eq(aiKnowledge.isActive, true)
        });

        const matchingDocs = relevantKnowledge.filter(k =>
            selectedCategories.includes(k.category) &&
            !ALWAYS_ON_CATEGORIES.includes(k.category)
        );

        // Build context layer with truncated content (max ~300 chars per doc)
        let contextParts: string[] = [];
        for (const doc of matchingDocs.slice(0, 3)) { // Max 3 documents
            const truncated = this.truncateContent(doc.content, 300);
            contextParts.push(`[${doc.category}] ${doc.title}:\n${truncated}`);
        }

        const categoriesUsed = [...new Set([...ALWAYS_ON_CATEGORIES, ...selectedCategories])];

        return {
            layer: contextParts.length > 0
                ? `\n=== LAAG 2: CONTEXT (${selectedCategories.join(', ') || 'Algemeen'}) ===\n${contextParts.join('\n\n')}`
                : '',
            categoriesUsed
        };
    }

    // =========================================================================
    // LAYER 3: Conversation Layer
    // =========================================================================
    private buildLayer3Conversation(messages: EmailMessage[]): string {
        // Only use last 5 messages
        const recentMessages = messages.slice(-5);

        // For long threads (>5 messages), add a summary note
        const summaryNote = messages.length > 5
            ? `[Thread bevat ${messages.length} berichten, hieronder de laatste 5]\n\n`
            : '';

        const formattedMessages = recentMessages.map((m: EmailMessage) => {
            const direction = m.isOutbound ? '→ UIT' : '← IN';
            const content = this.truncateContent(m.bodyText || m.snippet || '', 500);
            return `${direction} | ${m.fromName} (${new Date(m.sentAt || '').toLocaleDateString('nl-NL')})\n${content}`;
        }).join('\n---\n');

        return `
=== LAAG 3: CONVERSATIE ===
${summaryNote}${formattedMessages}
`;
    }

    /**
     * Main entry point to analyze an email thread.
     * Uses 3-layer architecture for optimal token usage.
     */
    async analyzeThread(threadId: string) {
        const startTime = Date.now();
        let logEntry: Partial<AILogEntry> = {
            threadId,
            timestamp: new Date(),
            success: false
        };

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
                console.log(`[AI] No messages found for thread ${threadId}`);
                return null;
            }

            // 2. Get settings
            await this.ensureSettings();
            const settings = await db.query.aiSettings.findFirst();

            // 3. Get Hub Context (Order, Repair, Customer)
            const hubContext = await this.getHubContext(thread);

            // 4. Build 3-Layer Prompt
            const layer1 = await this.buildLayer1Global(settings);
            const { layer: layer2, categoriesUsed } = await this.buildLayer2Context(threadMessages);
            const layer3 = this.buildLayer3Conversation(threadMessages);

            logEntry.categoriesUsed = categoriesUsed;

            // 5. Build final prompt
            const prompt = `
${layer1}
${layer2}
${layer3}

=== HUB CONTEXT (KLANT DATA) ===
${JSON.stringify(hubContext.history, null, 2)}
Gekoppelde Order: ${hubContext.currentOrderId || 'Geen'}
Gekoppelde Case: ${hubContext.currentCaseId || 'Geen'}

=== INSTRUCTIES ===
1. Analyseer de conversatie en geef een samenvatting.
2. Detecteer het sentiment en de intent van de klant.
3. Genereer een perfect antwoord in de STIJL van Laag 1.
4. Gebruik ALLEEN info uit de CONTEXT en HUB DATA - verzin niets.
5. Als de klant Engels spreekt, antwoord in het Engels.

=== OUTPUT (JSON) ===
{
  "summary": "Korte samenvatting (1-2 zinnen)",
  "sentiment": "positive" | "negative" | "neutral",
  "intent": "TECHNICAL" | "PRODUCT" | "RETURN" | "WARRANTY" | "SHIPPING" | "PAYMENT" | "QUESTION" | "OTHER",
  "reasoning": "Analyse van het probleem",
  "systemStatus": "Status uit HUB CONTEXT (orders/returns/cases)",
  "actionPlan": "Aanbevolen actie voor het team",
  "suggestedReply": {
    "customer": "Antwoord in klanttaal",
    "english": "English version"
  }
}`;

            // 6. Query OpenAI
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                temperature: 0.4 // Lower for more consistent outputs
            });

            // Log token usage
            logEntry.inputTokens = response.usage?.prompt_tokens || 0;
            logEntry.outputTokens = response.usage?.completion_tokens || 0;

            const aiReply = response.choices[0].message.content || "{}";
            const aiResult = JSON.parse(aiReply);

            logEntry.intent = aiResult.intent;
            logEntry.success = true;

            // 7. Log the request
            console.log(`[AI] ✓ Thread ${threadId} | Intent: ${aiResult.intent} | Categories: ${categoriesUsed.join(', ')} | Tokens: ${logEntry.inputTokens}/${logEntry.outputTokens} | Time: ${Date.now() - startTime}ms`);

            // 8. Save to Database
            await db.update(emailThreads)
                .set({
                    aiSummary: aiResult.summary,
                    sentiment: aiResult.sentiment,
                    detectedIntent: aiResult.intent,
                    suggestedReply: aiResult.suggestedReply,
                    aiInsights: {
                        reasoning: aiResult.reasoning,
                        actionPlan: aiResult.actionPlan,
                        systemStatus: aiResult.systemStatus,
                        categoriesUsed: categoriesUsed,
                        tokensUsed: { input: logEntry.inputTokens, output: logEntry.outputTokens }
                    },
                    lastAiSync: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(emailThreads.threadId, threadId));

            return aiResult;
        } catch (error) {
            console.error("[AI] Analysis Error:", error);
            return null;
        }
    }

    private async getHubContext(thread: any) {
        const customerEmail = thread.customerEmail;
        const customerId = thread.customerId;

        if (!customerEmail && !customerId) {
            return { history: "Geen klantgegevens gevonden." };
        }

        const getWhere = (table: any) => {
            const conds = [];
            if (customerEmail) conds.push(ilike(table.customerEmail, customerEmail));
            if (customerId) conds.push(eq(table.customerId, customerId));
            return conds.length > 1 ? or(...conds) : conds[0];
        };

        const [customerOrders, customerReturns, customerRepairs, customerCases] = await Promise.all([
            db.query.orders.findMany({ where: getWhere(orders), limit: 5, orderBy: [desc(orders.createdAt)] }),
            db.query.returns.findMany({ where: getWhere(returns), limit: 5, orderBy: [desc(returns.createdAt)] }),
            db.query.repairs.findMany({ where: getWhere(repairs), limit: 5, orderBy: [desc(repairs.createdAt)] }),
            db.query.cases.findMany({ where: getWhere(cases), limit: 5, orderBy: [desc(cases.createdAt)] }),
        ]);

        return {
            history: {
                orders: customerOrders.map(o => ({ id: o.orderNumber, status: o.status, date: o.createdAt })),
                returns: customerReturns.map(r => ({ id: r.returnNumber, status: r.status, reason: r.returnReason })),
                repairs: customerRepairs.map(r => ({ id: r.repairNumber, status: r.status, title: r.title })),
                cases: customerCases.map(c => ({ id: c.caseNumber, status: c.status, title: c.title }))
            },
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
                ],
                temperature: 0.3
            });

            return response.choices[0].message.content;
        } catch (e) {
            console.error("[AI] Knowledge search failed:", e);
            return "Er is een fout opgetreden bij het doorzoeken van de kennisbank.";
        }
    }

    /**
     * Rewrite text based on the selected mode.
     * Also used for generating new draft replies (when text is empty).
     */
    async rewriteText(text: string, mode: 'rewrite' | 'english' | 'customer_english', threadId?: string) {
        try {
            // Fetch settings for style
            await this.ensureSettings();
            const settings = await db.query.aiSettings.findFirst();

            let lastCustomerMessage = "";
            let allRecentMessages: string[] = [];
            let contextData = null;
            let customerLanguage = "Nederlands"; // Default
            let relevantKnowledge: AiKnowledge[] = []; // Knowledge base content

            // Fetch thread context if available
            if (threadId) {
                try {
                    // Try finding by database ID first, then by Gmail threadId
                    let thread = await db.query.emailThreads.findFirst({ where: eq(emailThreads.id, threadId) });
                    if (!thread) {
                        thread = await db.query.emailThreads.findFirst({ where: eq(emailThreads.threadId, threadId) });
                    }

                    if (thread) {
                        console.log(`[AI] Rewrite: Found thread ${thread.id}, subject: "${thread.subject?.substring(0, 40)}..."`);

                        const threadMessages = await db.query.emailMessages.findMany({
                            where: eq(emailMessages.threadId, thread.id),
                            orderBy: (messages, { asc }) => [asc(messages.sentAt)],
                        });

                        console.log(`[AI] Rewrite: Found ${threadMessages.length} messages in thread`);

                        // Get last 3 messages for context
                        const recentMsgs = threadMessages.slice(-3);
                        allRecentMessages = recentMsgs.map(m => {
                            const dir = m.isOutbound ? '→ DutchThrift' : '← Klant';
                            return `${dir}: ${this.truncateContent(m.bodyText || m.snippet || '', 400)}`;
                        });

                        // Find last customer message for language detection
                        const inboundMessages = threadMessages.filter(m => !m.isOutbound);
                        const lastMsg = inboundMessages.length > 0 ? inboundMessages[inboundMessages.length - 1] : null;
                        lastCustomerMessage = lastMsg?.bodyText || lastMsg?.snippet || "";

                        console.log(`[AI] Rewrite: Last customer msg (${lastCustomerMessage.length} chars): "${lastCustomerMessage.substring(0, 80)}..."`);


                        // Improved language detection based on common words and patterns
                        const msgLower = lastCustomerMessage.toLowerCase();

                        // Spanish detection
                        const spanishWords = ['buenas', 'gracias', 'quería', 'hola', 'buenos', 'días', 'tardes', 'noches', 'por favor', 'tengo', 'quiero', 'puede', 'cámara', 'lente', 'envío', 'precio'];
                        const isSpanish = spanishWords.some(w => msgLower.includes(w));

                        // French detection
                        const frenchWords = ['bonjour', 'merci', 's\'il vous', 'je voudrais', 'bonsoir', 'pourriez', 'appareil photo', 'objectif', 'livraison', 'prix'];
                        const isFrench = frenchWords.some(w => msgLower.includes(w));

                        // German detection
                        const germanWords = ['guten', 'danke', 'bitte', 'möchte', 'hallo', 'ich habe', 'können sie', 'kamera', 'objektiv', 'versand', 'preis', 'mfg', 'grüße'];
                        const isGerman = germanWords.some(w => msgLower.includes(w));

                        // English detection (extensive list)
                        const englishWords = ['hi', 'hello', 'hey', 'dear', 'good morning', 'good afternoon', 'thank you', 'thanks', 'please', 'would like', 'i have', 'i am', 'i\'m', 'my camera', 'my lens', 'is broken', 'doesn\'t work', 'not working', 'how do', 'what do', 'can you', 'could you', 'i need', 'i want', 'shipping', 'delivery', 'price', 'order', 'return', 'refund', 'warranty', 'regards', 'best regards', 'kind regards', 'cheers'];
                        const isEnglish = englishWords.some(w => msgLower.includes(w));

                        // Check for Dutch (to avoid false English detection)
                        const dutchWords = ['hallo', 'bedankt', 'dank je', 'graag', 'kunt u', 'zou ik', 'mijn camera', 'mijn lens', 'kapot', 'werkt niet', 'verzending', 'bestelling', 'retour', 'garantie', 'groeten', 'mvg'];
                        const isDutch = dutchWords.some(w => msgLower.includes(w));

                        // Priority: Spanish > French > German > English > Dutch (default)
                        if (isSpanish && !isDutch) {
                            customerLanguage = "Spaans";
                        } else if (isFrench) {
                            customerLanguage = "Frans";
                        } else if (isGerman && !isDutch) {
                            customerLanguage = "Duits";
                        } else if (isEnglish && !isDutch) {
                            customerLanguage = "Engels";
                        }
                        // Default remains "Nederlands"

                        contextData = await this.getHubContext(thread);

                        // Fetch relevant knowledge base documents
                        const { layer: knowledgeLayer, categoriesUsed } = await this.buildLayer2Context(threadMessages);
                        console.log(`[AI] Rewrite: Using categories: ${categoriesUsed.join(', ')}`);

                        // Store the knowledge layer for use in prompt
                        (contextData as any).knowledgeLayer = knowledgeLayer;
                    }
                } catch (e) {
                    console.warn("[AI] Failed to fetch context for rewrite:", e);
                }
            }

            // Build system prompt with full context
            let systemPrompt = `Je bent een professionele email-expert voor DutchThrift (tweedehands camera's & lenzen).

BELANGRIJK: Jij BENT DutchThrift. Als een klant vraagt over garantie, reparatie, of problemen met een camera:
- Verwijs NOOIT naar "de winkel waar je het hebt gekocht" - wij ZIJN die winkel!
- Verwijs NOOIT naar externe reparatiediensten - wij bieden ZELF reparaties aan!
- Gebruik de KENNISBANK hieronder voor correcte procedures en beleid.

=== STIJL ===
${settings?.styleGuide || "Vriendelijk, nuchter, professioneel."}
- Aanspreking: ${settings?.useHonorifics ? "u" : "je/jij"}
- Emoji's: ${settings?.allowEmojis ? "Toegestaan" : "Nee"}
${settings?.emailHeader ? `AANHEF: ${settings.emailHeader}` : ''}
${settings?.emailFooter ? `AFSLUITING: ${settings.emailFooter}` : ''}
${settings?.prohibitedPhrases?.length ? `VERBODEN WOORDEN: ${settings.prohibitedPhrases.join(', ')}` : ''}

=== GEDETECTEERDE KLANTTAAL ===
De klant schrijft in: **${customerLanguage}**
BELANGRIJK: Antwoord ALTIJD in ${customerLanguage}! Dit is de taal die de klant gebruikt.

=== CONVERSATIE CONTEXT ===
${allRecentMessages.length > 0 ? allRecentMessages.join('\n\n') : 'Geen eerdere berichten.'}

=== KLANT DATA (HUB) ===
${contextData?.history ? JSON.stringify(contextData.history, null, 2) : 'Geen klantdata gevonden.'}

=== KENNISBANK (DUTCHTHRIFT BELEID & PROCEDURES) ===
${(contextData as any)?.knowledgeLayer || 'Geen specifieke documentatie gevonden. Antwoord op basis van algemene DutchThrift kennis.'}`;

            let userContent = text;

            // Handle draft generation (empty text)
            if (!text || text.trim() === "") {
                if (!threadId) throw new Error("Thread ID vereist voor concept generatie");

                // Determine if we need to translate header/footer
                const needsTranslation = customerLanguage !== "Nederlands";
                // Only generate two versions if customer language is NOT English (to avoid duplicate English)
                const needsDualVersion = customerLanguage !== "Engels" && customerLanguage !== "Nederlands";

                systemPrompt += `

=== TAAK ===
Genereer een VOLLEDIG, INHOUDELIJK antwoord op de vraag van de klant.
- Beantwoord de specifieke vraag van de klant
- Gebruik de HUB data indien relevant
- NIET generiek antwoorden zoals "Hoe kan ik je helpen?" - de klant heeft al een vraag gesteld!
${needsTranslation ? `
VERPLICHTE VERTALING (KLANTTAAL = ${customerLanguage}):
- ALLES moet in ${customerLanguage}, inclusief aanhef en afsluiting!
- "Met vriendelijke groeten" wordt:
  * Engels: "Kind regards" of "Best regards"
  * Spaans: "Saludos cordiales" of "Un saludo"
  * Frans: "Cordialement"
  * Duits: "Mit freundlichen Grüßen"
- Gebruik NOOIT Nederlandse woorden in een ${customerLanguage} antwoord!
` : ''}
${needsDualVersion ? `
GENEREER TWEE VERSIES gescheiden door "---":
1. Eerst: Volledig antwoord in ${customerLanguage}
2. Dan: Dezelfde inhoud in het Engels

OUTPUT FORMAT (GEEN headers, alleen de tekst):
(volledig antwoord in ${customerLanguage})

---

(same content in English)` : `
Genereer het antwoord in ${customerLanguage}.`}`;

                userContent = `De klant vraagt: "${this.truncateContent(lastCustomerMessage, 600)}"

${needsDualVersion
                        ? `Genereer een volledig antwoord in ${customerLanguage}, gevolgd door --- en de Engelse versie.`
                        : `Genereer een volledig antwoord in ${customerLanguage}.`}`;
            } else {
                // Handle rewriting existing text
                systemPrompt += `

=== TAAK ===
Herschrijf de onderstaande tekst.`;

                if (mode === 'rewrite') {
                    systemPrompt += `
- Behoud de oorspronkelijke taal van de tekst
- Maak het klantvriendelijker en professioneler
- Verbeter grammatica en zinsbouw`;
                } else if (mode === 'customer_english') {
                    systemPrompt += `
- Genereer TWEE versies:
  1. Versie in ${customerLanguage} (de taal van de klant)
  2. Versie in Engels

FORMAT:
[${customerLanguage}]
(tekst hier)

---

[English]
(text here)`;
                }
            }

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                ],
                temperature: 0.6
            });

            console.log(`[AI] Rewrite | Mode: ${mode} | Lang: ${customerLanguage} | Tokens: ${response.usage?.prompt_tokens}/${response.usage?.completion_tokens}`);

            return response.choices[0].message.content;
        } catch (error) {
            console.error("[AI] Rewrite/Generate failed:", error);
            throw new Error("Kon tekst niet genereren/herschrijven");
        }
    }
}

export const aiService = new AIService();
