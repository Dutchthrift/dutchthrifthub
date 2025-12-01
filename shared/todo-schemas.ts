// ============================================
// TODO SUBTASKS & ATTACHMENTS
// ============================================

export const subtasks = pgTable("subtasks", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    todoId: varchar("todo_id").notNull(), // References todos table
    title: text("title").notNull(),
    completed: boolean("completed").default(false),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const todoAttachments = pgTable("todo_attachments", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    todoId: varchar("todo_id").notNull(), // References todos table
    filename: text("filename").notNull(),
    storageUrl: text("storage_url").notNull(),
    contentType: text("content_type"),
    size: integer("size"),
    uploadedBy: varchar("uploaded_by"), // References users table
    uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Zod schemas for validation
export const insertSubtaskSchema = createInsertSchema(subtasks);
export const insertTodoAttachmentSchema = createInsertSchema(todoAttachments);

// TypeScript types
export type Subtask = typeof subtasks.$inferSelect;
export type InsertSubtask = z.infer<typeof insertSubtaskSchema>;

export type TodoAttachment = typeof todoAttachments.$inferSelect;
export type InsertTodoAttachment = z.infer<typeof insertTodoAttachmentSchema>;
