import { Router } from 'express';
import { storage } from './storage';
import { aiService } from './services/aiService';
import { insertAiKnowledgeSchema } from '@shared/schema';

const router = Router();

// ============================================
// AI KNOWLEDGE HUB ROUTES
// ============================================

// Get all knowledge items
router.get('/knowledge', async (req, res) => {
    try {
        const { category, isActive } = req.query;
        const items = await storage.getAiKnowledge({
            category: category as string,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
        });
        res.json(items);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get single knowledge item
router.get('/knowledge/:id', async (req, res) => {
    try {
        const item = await storage.getAiKnowledgeItem(req.params.id);
        if (!item) return res.status(404).json({ message: 'Knowledge item not found' });
        res.json(item);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Create knowledge item
router.post('/knowledge', async (req, res) => {
    try {
        const parsed = insertAiKnowledgeSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: 'Invalid knowledge data', errors: parsed.error.errors });
        }
        const item = await storage.createAiKnowledge(parsed.data);
        res.status(201).json(item);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Update knowledge item
router.patch('/knowledge/:id', async (req, res) => {
    try {
        const item = await storage.updateAiKnowledge(req.params.id, req.body);
        res.json(item);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Delete knowledge item
router.delete('/knowledge/:id', async (req, res) => {
    try {
        await storage.deleteAiKnowledge(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// AI Search (Databank)
router.post('/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ message: 'Query is required' });

        const answer = await aiService.searchKnowledge(query);
        res.json({ answer });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
