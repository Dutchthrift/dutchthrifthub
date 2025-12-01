// ============================================
// TODO SUBTASKS ROUTES
// ============================================

// GET /api/todos/:todoId/subtasks - Get all subtasks for a todo
app.get("/api/todos/:todoId/subtasks", requireAuth, async (req: any, res: any) => {
    try {
        const { todoId } = req.params;
        const result = await db
            .select()
            .from(subtasks)
            .where(eq(subtasks.todoId, todoId))
            .orderBy(subtasks.position);
        res.json(result);
    } catch (error) {
        console.error("Error fetching subtasks:", error);
        res.status(500).json({ error: "Failed to fetch subtasks" });
    }
});

// POST /api/todos/:todoId/subtasks - Create a new subtask
app.post("/api/todos/:todoId/subtasks", requireAuth, async (req: any, res: any) => {
    try {
        const { todoId } = req.params;
        const { title } = req.body;

        // Get the current max position
        const maxPosition = await db
            .select({ max: sql<number>`MAX(${subtasks.position})` })
            .from(subtasks)
            .where(eq(subtasks.todoId, todoId));

        const position = (maxPosition[0]?.max || 0) + 1;

        const [subtask] = await db
            .insert(subtasks)
            .values({
                todoId,
                title,
                position,
                completed: false,
            })
            .returning();

        res.status(201).json(subtask);
    } catch (error) {
        console.error("Error creating subtask:", error);
        res.status(400).json({ error: "Failed to create subtask" });
    }
});

// PATCH /api/subtasks/:id - Update a subtask
app.patch("/api/subtasks/:id", requireAuth, async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const [subtask] = await db
            .update(subtasks)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(subtasks.id, id))
            .returning();

        res.json(subtask);
    } catch (error) {
        console.error("Error updating subtask:", error);
        res.status(400).json({ error: "Failed to update subtask" });
    }
});

// DELETE /api/subtasks/:id - Delete a subtask
app.delete("/api/subtasks/:id", requireAuth, async (req: any, res: any) => {
    try {
        const { id } = req.params;
        await db.delete(subtasks).where(eq(subtasks.id, id));
        res.json({ message: "Subtask deleted successfully" });
    } catch (error) {
        console.error("Error deleting subtask:", error);
        res.status(400).json({ error: "Failed to delete subtask" });
    }
});

// ============================================
// TODO ATTACHMENTS ROUTES
// ============================================

// GET /api/todos/:todoId/attachments - Get all attachments for a todo
app.get("/api/todos/:todoId/attachments", requireAuth, async (req: any, res: any) => {
    try {
        const { todoId } = req.params;
        const result = await db
            .select()
            .from(todoAttachments)
            .where(eq(todoAttachments.todoId, todoId))
            .orderBy(desc(todoAttachments.uploadedAt));
        res.json(result);
    } catch (error) {
        console.error("Error fetching attachments:", error);
        res.status(500).json({ error: "Failed to fetch attachments" });
    }
});

// POST /api/todos/:todoId/attachments - Upload attachment
app.post("/api/todos/:todoId/attachments", requireAuth, upload.single("file"), async (req: any, res: any) => {
    try {
        const { todoId } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: "No file provided" });
        }

        // Upload to storage
        const storageUrl = await objectStorage.uploadFile(file.buffer, file.originalname, file.mimetype);

        // Save to database
        const [attachment] = await db
            .insert(todoAttachments)
            .values({
                todoId,
                filename: file.originalname,
                storageUrl,
                contentType: file.mimetype,
                size: file.size,
                uploadedBy: req.user.id,
            })
            .returning();

        res.status(201).json(attachment);
    } catch (error) {
        console.error("Error uploading attachment:", error);
        res.status(400).json({ error: "Failed to upload attachment" });
    }
});

// DELETE /api/todos/:todoId/attachments/:attachmentId - Delete attachment
app.delete("/api/todos/:todoId/attachments/:attachmentId", requireAuth, async (req: any, res: any) => {
    try {
        const { attachmentId } = req.params;

        // Get attachment info
        const [attachment] = await db
            .select()
            .from(todoAttachments)
            .where(eq(todoAttachments.id, attachmentId));

        if (!attachment) {
            return res.status(404).json({ error: "Attachment not found" });
        }

        // Delete from storage
        await objectStorage.deleteFile(attachment.storageUrl);

        // Delete from database
        await db.delete(todoAttachments).where(eq(todoAttachments.id, attachmentId));

        res.json({ message: "Attachment deleted successfully" });
    } catch (error) {
        console.error("Error deleting attachment:", error);
        res.status(400).json({ error: "Failed to delete attachment" });
    }
});
