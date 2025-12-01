import { type Express } from "express";
// Force restart for sync fix
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { storage } from "./storage";
import { db } from "./services/supabaseClient";
import { count } from "drizzle-orm";
import { emails } from "@shared/schema";
import { log } from "./vite";
import {
  insertUserSchema,
  insertCustomerSchema,
  insertOrderSchema,
  insertCaseSchema,
  insertCaseLinkSchema,
  insertCaseNoteSchema,
  insertCaseEventSchema,
  insertCaseItemSchema,
  insertActivitySchema,
  insertAuditLogSchema,
  insertReturnSchema,
  insertReturnItemSchema,
  insertNoteSchema,
  insertNoteTagSchema,
  insertNoteTagAssignmentSchema,
  insertNoteMentionSchema,
  insertNoteReactionSchema,
  insertNoteAttachmentSchema,
  insertNoteFollowupSchema,
  insertNoteRevisionSchema,
  insertNoteTemplateSchema,
  insertNoteLinkSchema,
  insertPurchaseOrderSchema,
  notes,
  purchaseOrderItems,
  subtasks,
  todoAttachments,
  systemSettings,
  emailLinks,
} from "@shared/schema";
import { eq, desc, sql, like, and } from "drizzle-orm";

import { shopifyClient } from "./services/shopifyClient";
import { OrderMatchingService } from "./services/orderMatchingService";
import { ObjectStorageService } from "./objectStorage";

import multer from "multer";
import Papa from "papaparse";
import path from "path";
import fs from "fs";
import express from "express";

// Mail system imports
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import DOMPurify from 'isomorphic-dompurify';

// Extend Request type to include session
interface AuthenticatedRequest extends Request {
  session: any;
  user?: any;
}

// Authentication middleware
const requireAuth = async (req: any, res: any, next: any) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    req.session.destroy(() => { });
    return res.status(401).json({ error: "User not found" });
  }

  req.user = user;
  next();
};

// Role-based authorization middleware
const requireRole = (roles: string[]) => {
  return async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      // Log unauthorized access attempt
      await storage.createAuditLog({
        userId: req.user.id,
        action: "UNAUTHORIZED_ACCESS",
        resource: "endpoint",
        resourceId: req.path,
        details: {
          requiredRoles: roles,
          userRole: req.user.role,
          method: req.method,
          endpoint: req.path,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        success: false,
        errorMessage: "Insufficient permissions",
      });

      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
};

// Audit logging helper
const auditLog = async (
  req: any,
  action: string,
  resource: string,
  resourceId?: string,
  details?: any,
) => {
  if (req.user) {
    await storage.createAuditLog({
      userId: req.user.id,
      action,
      resource,
      resourceId,
      details,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      success: true,
    });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize order matching service
  const orderMatchingService = new OrderMatchingService(storage);

  // Configure multer for file uploads (memory storage with limits)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
      files: 10 // max 10 files per request
    }
  });

  // Serve local uploads if in local storage mode
  if (process.env.STORAGE_PROVIDER === "local") {
    const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || "server/uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    app.use("/uploads", express.static(uploadDir));
    console.log(`Serving local uploads from ${uploadDir}`);
  }

  // Authentication routes
  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Log failed login attempt
        await storage.createAuditLog({
          action: "LOGIN_FAILED",
          resource: "auth",
          details: { email, reason: "User not found" },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          success: false,
          errorMessage: "Invalid credentials",
        });
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        // Log failed login attempt
        await storage.createAuditLog({
          userId: user.id,
          action: "LOGIN_FAILED",
          resource: "auth",
          details: { email, reason: "Invalid password" },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          success: false,
          errorMessage: "Invalid credentials",
        });
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Create session
      (req as any).session.userId = user.id;

      // Log successful login
      await storage.createAuditLog({
        userId: user.id,
        action: "LOGIN_SUCCESS",
        resource: "auth",
        details: { email },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        success: true,
      });

      const { password: _, ...userWithoutPassword } = user;
      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      console.error("Sign in error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/signout", requireAuth, async (req: any, res: any) => {
    try {
      // Log logout
      await auditLog(req, "LOGOUT", "auth");

      req.session.destroy((err: any) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res.status(500).json({ error: "Failed to sign out" });
        }
        res.json({ message: "Signed out successfully" });
      });
    } catch (error) {
      console.error("Sign out error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/auth/session", async (req: any, res: any) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "No active session" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        req.session.destroy(() => { });
        return res.status(401).json({ error: "User not found" });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      console.error("Session check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User Management routes
  // Get all users (all authenticated users can view user list for assignment/filtering)
  app.get("/api/users", requireAuth, async (req: any, res: any) => {
    try {
      const users = await storage.getUsers();
      await auditLog(req, "LIST", "users");

      // Remove passwords from response
      const safeUsers = users.map((user) => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // User list for assignment dropdowns (accessible to all authenticated users)
  app.get("/api/users/list", requireAuth, async (req: any, res: any) => {
    try {
      const users = await storage.getUsers();

      // Return only necessary fields for dropdowns
      const userList = users.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      }));

      res.json(userList);
    } catch (error) {
      console.error("Error fetching user list:", error);
      res.status(500).json({ error: "Failed to fetch user list" });
    }
  });

  app.post(
    "/api/users",
    requireAuth,
    requireRole(["ADMIN"]),
    async (req: any, res: any) => {
      try {
        // Create schema for frontend data (without username)
        const createUserSchema = z.object({
          email: z.string().email("Please enter a valid email address"),
          password: z.string().min(6, "Password must be at least 6 characters"),
          firstName: z.string().min(1, "First name is required"),
          lastName: z.string().min(1, "Last name is required"),
          role: z.enum(["ADMIN", "SUPPORT", "TECHNICUS"]),
        });

        const userData = createUserSchema.parse(req.body);

        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        // Generate username from email
        const username = userData.email.split("@")[0];

        const newUser = await storage.createUser({
          ...userData,
          password: hashedPassword,
          username,
        });

        await auditLog(req, "CREATE", "users", newUser.id, {
          email: newUser.email,
          role: newUser.role,
        });

        const { password, ...userWithoutPassword } = newUser;
        res.status(201).json(userWithoutPassword);
      } catch (error: unknown) {
        console.error("Error creating user:", error);
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ error: "Invalid user data", details: error.errors });
        } else if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505"
        ) {
          res.status(409).json({ error: "Email or username already exists" });
        } else {
          res.status(400).json({ error: "Failed to create user" });
        }
      }
    },
  );

  app.patch(
    "/api/users/:id",
    requireAuth,
    requireRole(["ADMIN"]),
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const updateData = req.body;

        // Validate that user exists
        const existingUser = await storage.getUser(id);
        if (!existingUser) {
          return res.status(404).json({ error: "User not found" });
        }

        // Create update schema that excludes password and sensitive fields
        const updateUserSchema = z.object({
          email: z.string().email().optional(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          role: z.enum(["ADMIN", "SUPPORT", "TECHNICUS"]).optional(),
        });

        // Validate update data
        const validatedUpdateData = updateUserSchema.parse(updateData);

        // Update user
        const updatedUser = await storage.updateUser(id, validatedUpdateData);
        await auditLog(req, "UPDATE", "users", id, validatedUpdateData);

        // Return user without password
        const { password, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
      } catch (error: unknown) {
        console.error("Update user error:", error);
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ error: "Invalid update data", details: error.errors });
        } else if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505"
        ) {
          res.status(409).json({ error: "Email already exists" });
        } else {
          res.status(500).json({ error: "Failed to update user" });
        }
      }
    },
  );

  app.delete(
    "/api/users/:id",
    requireAuth,
    requireRole(["ADMIN"]),
    async (req: any, res: any) => {
      try {
        const { id } = req.params;

        // Validate that user exists and is not the current user
        const existingUser = await storage.getUser(id);
        if (!existingUser) {
          return res.status(404).json({ error: "User not found" });
        }

        if (id === req.user.id) {
          return res
            .status(400)
            .json({ error: "Cannot delete your own account" });
        }

        await storage.deleteUser(id);
        await auditLog(req, "DELETE", "users", id, {
          email: existingUser.email,
        });

        res.json({ message: "User deleted successfully" });
      } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ error: "Failed to delete user" });
      }
    },
  );

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Todos
  app.get("/api/todos", requireAuth, async (req: any, res: any) => {
    try {
      const { userId, caseId } = req.query;

      if (caseId) {
        // Get todos linked to a specific case
        const relatedItems = await storage.getCaseRelatedItems(
          caseId as string,
        );
        let todos = relatedItems.todos;

        // Apply role-based filtering even for case-linked todos
        if (req.user.role === "TECHNICUS") {
          // TECHNICUS only sees their own tasks
          todos = todos.filter(
            (todo: any) => todo.assignedUserId === req.user.id,
          );
        }
        // ADMIN and SUPPORT can see all case-linked todos

        res.json(todos);
      } else {
        // Role-based filtering
        let todos: any[];

        if (req.user.role === "ADMIN" || req.user.role === "SUPPORT") {
          // ADMIN and SUPPORT see all tasks or filtered by userId if provided
          todos = await storage.getTodos(userId as string);
        } else if (req.user.role === "TECHNICUS") {
          // TECHNICUS only sees their own tasks
          todos = await storage.getTodos(req.user.id);
        } else {
          // Fallback: return empty array for unknown roles
          todos = [];
        }

        res.json(todos);
      }
    } catch (error) {
      console.error("Error fetching todos:", error);
      res.status(500).json({ message: "Failed to fetch todos" });
    }
  });

  app.post("/api/todos", requireAuth, async (req: any, res: any) => {
    try {
      const validatedData = insertTodoSchema.parse(req.body);

      // Set createdBy from authenticated user
      validatedData.createdBy = req.user.id;

      // Convert dueDate string to Date object if provided
      if (validatedData.dueDate && typeof validatedData.dueDate === "string") {
        validatedData.dueDate = new Date(validatedData.dueDate);
      }

      const todo = await storage.createTodo(validatedData);

      // Create activity
      await storage.createActivity({
        type: "todo_created",
        description: `Created todo: ${todo.title}`,
        userId: todo.assignedUserId,
        metadata: { todoId: todo.id },
      });

      await auditLog(req, "CREATE", "todos", todo.id, {
        title: todo.title,
        category: todo.category,
      });

      res.status(201).json(todo);
    } catch (error) {
      console.error("Error creating todo:", error);
      res.status(400).json({ message: "Failed to create todo" });
    }
  });

  app.patch("/api/todos/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      // Create update schema to validate fields including category
      const updateTodoSchema = z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        category: z
          .enum(["orders", "purchasing", "marketing", "admin", "other"])
          .optional(),
        assignedUserId: z.string().optional(),
        status: z.enum(["todo", "in_progress", "done"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        dueDate: z
          .union([z.string().datetime(), z.date(), z.null()])
          .optional(),
        completedAt: z
          .union([z.string().datetime(), z.date(), z.null()])
          .optional(),
        customerId: z.string().optional(),
        orderId: z.string().optional(),
        repairId: z.string().optional(),
        emailThreadId: z.string().optional(),
        caseId: z.string().optional(),
      });

      // Validate update data
      const validatedData = updateTodoSchema.parse(req.body);

      // Convert date strings to Date objects if provided
      const updateData: any = { ...validatedData };
      if (updateData.dueDate && typeof updateData.dueDate === "string") {
        updateData.dueDate = new Date(updateData.dueDate);
      }
      if (
        updateData.completedAt &&
        typeof updateData.completedAt === "string"
      ) {
        updateData.completedAt = new Date(updateData.completedAt);
      }

      const todo = await storage.updateTodo(id, updateData);

      if (req.body.status === "done") {
        await storage.createActivity({
          type: "todo_completed",
          description: `Completed todo: ${todo.title}`,
          userId: todo.assignedUserId,
          metadata: { todoId: todo.id },
        });
      }

      await auditLog(req, "UPDATE", "todos", id, validatedData);

      res.json(todo);
    } catch (error) {
      console.error("Error updating todo:", error);
      res.status(400).json({ message: "Failed to update todo" });
    }
  });

  app.delete("/api/todos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTodo(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting todo:", error);
      res.status(400).json({ message: "Failed to delete todo" });
    }
  });

  // Repairs
  app.get("/api/repairs", requireAuth, async (req: any, res) => {
    try {
      const { caseId, status, technicianId, startDate, endDate, priority } =
        req.query;

      if (caseId) {
        // Get repairs linked to a specific case
        const relatedItems = await storage.getCaseRelatedItems(
          caseId as string,
        );

        res.json(relatedItems.repairs);
        return;
      }

      // Define filter schema for validation
      const filterSchema = z.object({
        status: z
          .enum([
            "new",
            "diagnosing",
            "waiting_parts",
            "repair_in_progress",
            "quality_check",
            "completed",
            "returned",
            "canceled",
          ])
          .optional(),
        technicianId: z.string().uuid().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      });

      // Validate query parameters
      const validationResult = filterSchema.safeParse({
        status,
        technicianId,
        priority,
        startDate,
        endDate,
      });

      if (!validationResult.success) {
        return res
          .status(400)
          .json({
            message: "Invalid filter parameters",
            errors: validationResult.error.errors,
          });
      }

      const validatedFilters = validationResult.data;

      // Build filters object
      const filters: {
        status?: string;
        technicianId?: string;
        priority?: string;
        startDate?: Date;
        endDate?: Date;
      } = {};

      if (validatedFilters.status) filters.status = validatedFilters.status;
      if (validatedFilters.technicianId)
        filters.technicianId = validatedFilters.technicianId;
      if (validatedFilters.priority)
        filters.priority = validatedFilters.priority;
      if (validatedFilters.startDate)
        filters.startDate = new Date(validatedFilters.startDate);
      if (validatedFilters.endDate)
        filters.endDate = new Date(validatedFilters.endDate);

      const hasFilters = Object.keys(filters).length > 0;

      if (hasFilters) {
        const repairs = await storage.getRepairsWithFilters(filters);
        res.json(repairs);
      } else {
        const repairs = await storage.getRepairs();
        res.json(repairs);
      }
    } catch (error) {
      console.error("Error fetching repairs:", error);
      res.status(500).json({ message: "Failed to fetch repairs" });
    }
  });

  app.get("/api/repairs/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const repair = await storage.getRepair(id);
      if (!repair) {
        return res.status(404).json({ message: "Repair not found" });
      }

      res.json(repair);
    } catch (error) {
      console.error("Error fetching repair:", error);
      res.status(500).json({ message: "Failed to fetch repair" });
    }
  });

  app.post(
    "/api/repairs",
    requireAuth,
    requireRole(["ADMIN", "SUPPORT", "TECHNICUS"]),
    async (req: any, res) => {
      try {
        // Handle date conversion before validation
        const requestData = { ...req.body };
        if (
          requestData.slaDeadline &&
          typeof requestData.slaDeadline === "string"
        ) {
          requestData.slaDeadline = new Date(requestData.slaDeadline);
        }

        const validatedData = insertRepairSchema.parse(requestData);
        const repair = await storage.createRepair(validatedData);

        await storage.createActivity({
          type: "repair_created",
          description: `Created repair: ${repair.title}`,
          userId: req.user.id,
          metadata: { repairId: repair.id },
        });

        await auditLog(req, "CREATE", "repairs", repair.id, validatedData);

        res.status(201).json(repair);
      } catch (error) {
        console.error("Error creating repair:", error);
        res.status(400).json({ message: "Failed to create repair" });
      }
    },
  );

  app.patch("/api/repairs/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Get existing repair to check it exists
      const existingRepair = await storage.getRepair(id);
      if (!existingRepair) {
        return res.status(404).json({ message: "Repair not found" });
      }

      const repair = await storage.updateRepair(id, req.body);

      if (req.body.status) {
        await storage.createActivity({
          type: "repair_status_updated",
          description: `Updated repair status to ${req.body.status}: ${repair.title}`,
          userId: req.user.id,
          metadata: { repairId: repair.id, status: req.body.status },
        });
      }

      await auditLog(req, "UPDATE", "repairs", id, req.body);

      res.json(repair);
    } catch (error) {
      console.error("Error updating repair:", error);
      res.status(400).json({ message: "Failed to update repair" });
    }
  });

  app.delete("/api/returns/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      // Get return data before deletion for audit log
      const returnData = await storage.getReturn(id);
      if (!returnData) {
        return res.status(404).json({ message: "Return not found" });
      }

      await storage.deleteReturn(id);

      await auditLog(req, "DELETE", "returns", id, {
        returnNumber: returnData.returnNumber,
        status: returnData.status,
      });

      res.json({ message: "Return deleted successfully" });
    } catch (error) {
      console.error("Error deleting return:", error);
      res.status(400).json({ message: "Failed to delete return" });
    }
  });

  app.delete("/api/repairs/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Get existing repair to check permissions
      const existingRepair = await storage.getRepair(id);
      if (!existingRepair) {
        return res.status(404).json({ message: "Repair not found" });
      }

      // Only ADMIN and AGENT can delete repairs
      if (!["ADMIN", "AGENT"].includes(req.user.role)) {
        return res
          .status(403)
          .json({ message: "Not authorized to delete repairs" });
      }

      await storage.deleteRepair(id);

      await storage.createActivity({
        type: "repair_deleted",
        description: `Deleted repair: ${existingRepair.title}`,
        userId: req.user.id,
        metadata: { repairId: id, title: existingRepair.title },
      });

      await auditLog(req, "DELETE", "repairs", id, { title: existingRepair.title });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting repair:", error);
      res.status(400).json({ message: "Failed to delete repair" });
    }
  });

  // Upload files (photos/attachments) to a repair
  app.post(
    "/api/repairs/:id/upload",
    requireAuth,
    upload.array("files", 10),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          return res.status(400).json({ message: "No files provided" });
        }

        const repair = await storage.getRepair(id);
        if (!repair) {
          return res.status(404).json({ message: "Repair not found" });
        }

        // TECHNICUS can upload to any repair (restriction removed)
        // if (
        //   req.user.role === "TECHNICUS" &&
        //   repair.assignedUserId !== req.user.id
        // ) {
        //   return res
        //     .status(403)
        //     .json({ message: "Not authorized to upload files to this repair" });
        // }

        const objectStorage = new ObjectStorageService();
        const photoUrls: string[] = [];
        const attachmentUrls: string[] = [];

        for (const file of files) {
          // Determine if file is a photo or attachment based on mimetype
          const isPhoto = file.mimetype.startsWith('image/');
          const fileType = isPhoto ? 'photo' : 'attachment';

          // Create a safe filename
          const timestamp = Date.now();
          const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
          const filename = `repair-${id}-${fileType}-${timestamp}-${safeOriginalName}`;

          console.log(`Uploading repair file: ${filename} (${file.size} bytes, ${file.mimetype})`);
          const url = await objectStorage.saveAttachment(
            filename,
            file.buffer,
            file.mimetype,
          );
          console.log(`Uploaded to: ${url}`);

          if (isPhoto) {
            photoUrls.push(url);
          } else {
            attachmentUrls.push(url);
          }
        }

        // Update repair with new file URLs
        const updates: any = {};

        if (photoUrls.length > 0) {
          const currentPhotos = repair.photos || [];
          updates.photos = [...currentPhotos, ...photoUrls];
        }

        if (attachmentUrls.length > 0) {
          const currentAttachments = repair.attachments || [];
          updates.attachments = [...currentAttachments, ...attachmentUrls];
        }

        if (Object.keys(updates).length > 0) {
          await storage.updateRepair(id, updates);
        }

        console.log(`Successfully uploaded ${photoUrls.length} photos and ${attachmentUrls.length} attachments to repair ${id}`);
        res.json({
          photoUrls,
          attachmentUrls,
          total: photoUrls.length + attachmentUrls.length
        });
      } catch (error) {
        console.error("Error uploading files to repair:", error);
        res.status(500).json({ message: "Failed to upload files" });
      }
    },
  );

  // Create sample repairs for testing
  app.post("/api/repairs/create-samples", async (req, res) => {
    try {
      const sampleRepairs = [
        {
          title: "iPhone 12 Screen Replacement",
          description:
            "Customer dropped device, screen completely shattered. Screen replacement needed.",
          status: "new" as const,
          priority: "high" as const,
          estimatedCost: 15000, // €150.00
          partsNeeded: ["iPhone 12 Screen", "Screen Adhesive"],
          slaDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        },
        {
          title: "MacBook Air M1 Battery Issue",
          description:
            "Battery not holding charge. Diagnostic required to determine replacement necessity.",
          status: "in_progress" as const,
          priority: "medium" as const,
          estimatedCost: 18000, // €180.00
          partsNeeded: ["MacBook Air M1 Battery"],
          slaDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        },
        {
          title: "Samsung Galaxy S21 Water Damage",
          description:
            "Device exposed to water, not powering on. Full diagnostic and cleaning required.",
          status: "waiting_customer" as const,
          priority: "urgent" as const,
          estimatedCost: 25000, // €250.00
          partsNeeded: ["Cleaning Kit", "Possibly Motherboard"],
          slaDeadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
        },
        {
          title: "iPad Pro Charging Port Repair",
          description:
            "Charging port loose, device charges intermittently. Port replacement needed.",
          status: "ready" as const,
          priority: "medium" as const,
          estimatedCost: 8000, // €80.00
          partsNeeded: ["iPad Pro Charging Port"],
          slaDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        },
        {
          title: "PS5 Controller Stick Drift",
          description:
            "Left analog stick drifting, affecting gaming experience. Stick module replacement.",
          status: "closed" as const,
          priority: "low" as const,
          estimatedCost: 3500, // €35.00
          actualCost: 3500,
          partsNeeded: ["PS5 Analog Stick Module"],
          completedAt: new Date(),
        },
      ];

      let created = 0;
      const results = [];

      for (const repairData of sampleRepairs) {
        try {
          // Validate the data with the schema
          const validatedData = insertRepairSchema.parse(repairData);
          await storage.createRepair(validatedData);
          created++;
          results.push({ title: repairData.title, ok: true });
        } catch (error) {
          console.error(`Error creating repair "${repairData.title}":`, error);
          results.push({
            title: repairData.title,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      res.json({
        created,
        results,
        message: `Created ${created} sample repairs`,
      });
    } catch (error) {
      console.error("Error creating sample repairs:", error);
      res.status(500).json({ message: "Failed to create sample repairs" });
    }
  });

  // Orders
  app.get("/api/orders", async (req, res) => {
    try {
      const { caseId, page, limit, search } = req.query;

      if (caseId) {
        // Get orders linked to a specific case
        const relatedItems = await storage.getCaseRelatedItems(
          caseId as string,
        );
        res.json(relatedItems.orders);
      } else if (page) {
        // Get paginated orders with total count and optional search
        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 20;
        const searchQuery = search as string;
        const result = await storage.getOrdersPaginated(
          pageNum,
          limitNum,
          searchQuery,
        );
        res.json(result);
      } else {
        // Get all orders with optional limit for dropdowns (default 1000 to show all orders)
        const limitNum = req.query.limit
          ? parseInt(req.query.limit as string)
          : 1000;
        const orders = await storage.getOrders(limitNum);
        res.json(orders);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Get order statistics (must come before :id route)
  app.get("/api/orders/stats", async (req, res) => {
    try {
      const allOrders = await storage.getOrders(999999); // Get all orders for accurate stats

      // Calculate total amount (sum of all order amounts)
      const totalAmount = allOrders.reduce(
        (sum, order) => sum + (order.totalAmount || 0),
        0,
      );

      const stats = {
        total: allOrders.length,
        totalAmount: totalAmount, // Total monetary amount in cents
        pending: allOrders.filter((o) => o.status === "pending").length,
        processing: allOrders.filter((o) => o.status === "processing").length,
        shipped: allOrders.filter((o) => o.status === "shipped").length,
        delivered: allOrders.filter((o) => o.status === "delivered").length,
      };
      res.json(stats);
    } catch (error) {
      console.error("Error fetching order stats:", error);
      res.status(500).json({ message: "Failed to fetch order stats" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Test Shopify connection
  app.get("/api/shopify/test", async (req, res) => {
    try {
      // Try to get shop info first (lighter request)
      const response = await fetch(
        `${process.env.SHOPIFY_SHOP_DOMAIN
          ? `https://${process.env.SHOPIFY_SHOP_DOMAIN.replace(".myshopify.com", "")}.myshopify.com`
          : "https://shambu-nl.myshopify.com"
        }/admin/api/2024-01/shop.json`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token":
              process.env.SHOPIFY_ACCESS_TOKEN ||
              process.env.SHOPIFY_PASSWORD ||
              "",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: "Shopify connection failed",
          status: response.status,
          message: errorText,
          credentials: {
            hasToken: !!(
              process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_PASSWORD
            ),
            tokenLength: (
              process.env.SHOPIFY_ACCESS_TOKEN ||
              process.env.SHOPIFY_PASSWORD ||
              ""
            ).length,
            shopDomain:
              process.env.SHOPIFY_SHOP_DOMAIN || "shambu-nl.myshopify.com",
          },
        });
      }

      const shopInfo = await response.json();
      res.json({
        success: true,
        shop: shopInfo.shop?.name || "Connected",
        domain: shopInfo.shop?.myshopify_domain,
        message: "Shopify connection successful",
      });
    } catch (error) {
      console.error("Shopify test error:", error);
      res.status(500).json({
        error: "Shopify test failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Full sync endpoint for importing ALL data from Shopify
  app.post("/api/shopify/sync-all", async (req, res) => {
    try {
      console.log(
        "🚀 Starting full Shopify sync - importing ALL customers and orders...",
      );

      let customerStats = {
        synced: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        total: 0,
      };
      let orderStats = {
        synced: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        total: 0,
      };
      let errors: string[] = [];

      // Step 1: Sync all customers
      try {
        console.log("👥 Step 1/2: Syncing all customers from Shopify...");
        const shopifyCustomers = await shopifyClient.getAllCustomers(
          (processed) => {
            console.log(
              `📊 Customer sync progress: ${processed} customers processed`,
            );
          },
        );

        console.log(`Processing ${shopifyCustomers.length} customers...`);

        for (const shopifyCustomer of shopifyCustomers) {
          try {
            if (!shopifyCustomer.email) {
              customerStats.skipped++;
              continue;
            }

            const existingCustomer = await storage.getCustomerByEmail(
              shopifyCustomer.email,
            );

            if (!existingCustomer) {
              await storage.createCustomer({
                email: shopifyCustomer.email,
                firstName: shopifyCustomer.first_name || null,
                lastName: shopifyCustomer.last_name || null,
                phone: shopifyCustomer.phone || null,
                shopifyCustomerId: shopifyCustomer.id.toString(),
              });
              customerStats.created++;
            } else if (
              !existingCustomer.shopifyCustomerId ||
              existingCustomer.shopifyCustomerId !==
              shopifyCustomer.id.toString()
            ) {
              await storage.updateCustomer(existingCustomer.id, {
                shopifyCustomerId: shopifyCustomer.id.toString(),
                phone: shopifyCustomer.phone || existingCustomer.phone,
                firstName:
                  shopifyCustomer.first_name || existingCustomer.firstName,
                lastName:
                  shopifyCustomer.last_name || existingCustomer.lastName,
              });
              customerStats.updated++;
            }
            customerStats.synced++;
          } catch (customerError) {
            console.error(
              `Error processing customer ${shopifyCustomer.id}:`,
              customerError,
            );
            customerStats.skipped++;
            errors.push(
              `Customer ${shopifyCustomer.id}: ${customerError instanceof Error ? customerError.message : String(customerError)}`,
            );
          }
        }

        customerStats.total = shopifyCustomers.length;
        console.log(
          `✅ Customer sync completed: ${customerStats.created} created, ${customerStats.updated} updated, ${customerStats.skipped} skipped from ${customerStats.total} customers`,
        );
      } catch (customerSyncError) {
        console.error("Failed to sync customers:", customerSyncError);
        errors.push(
          `Customer sync failed: ${customerSyncError instanceof Error ? customerSyncError.message : String(customerSyncError)}`,
        );
      }

      // Step 2: Sync all orders
      try {
        console.log("🛒 Step 2/2: Syncing all orders from Shopify...");
        const shopifyOrders = await shopifyClient.getAllOrders((processed) => {
          console.log(`📊 Order sync progress: ${processed} orders processed`);
        });

        console.log(`Processing ${shopifyOrders.length} orders...`);

        // Map Shopify financial status to our enum values
        const mapShopifyStatus = (
          financialStatus: string,
          fulfillmentStatus: string | null,
        ) => {
          if (fulfillmentStatus === "fulfilled") return "delivered";
          if (fulfillmentStatus === "partial") return "shipped";
          if (financialStatus === "paid" || financialStatus === "authorized") {
            return fulfillmentStatus === null ? "processing" : "shipped";
          }
          if (financialStatus === "pending") return "pending";
          if (financialStatus === "refunded") return "refunded";
          if (financialStatus === "voided") return "cancelled";
          return "pending";
        };

        for (const shopifyOrder of shopifyOrders) {
          try {
            const existingOrder = await storage.getOrderByShopifyId(
              shopifyOrder.id.toString(),
            );

            // Handle customer creation/updating first
            let customer = null;
            if (shopifyOrder.customer && shopifyOrder.customer.email) {
              customer = await storage.getCustomerByEmail(
                shopifyOrder.customer.email,
              );
              if (!customer) {
                try {
                  customer = await storage.createCustomer({
                    email: shopifyOrder.customer.email,
                    firstName: shopifyOrder.customer.first_name,
                    lastName: shopifyOrder.customer.last_name,
                    shopifyCustomerId: shopifyOrder.customer.id.toString(),
                  });
                } catch (customerError) {
                  // If customer creation fails due to duplicate, try to get existing customer
                  console.log(
                    `Customer creation failed, attempting to get existing customer: ${shopifyOrder.customer.email}`,
                  );
                  customer = await storage.getCustomerByEmail(
                    shopifyOrder.customer.email,
                  );
                }
              } else if (
                !customer.shopifyCustomerId ||
                customer.shopifyCustomerId !==
                shopifyOrder.customer.id.toString()
              ) {
                // Update existing customer with Shopify ID and any missing data
                try {
                  await storage.updateCustomer(customer.id, {
                    shopifyCustomerId: shopifyOrder.customer.id.toString(),
                    firstName:
                      shopifyOrder.customer.first_name || customer.firstName,
                    lastName:
                      shopifyOrder.customer.last_name || customer.lastName,
                  });
                } catch (updateError) {
                  console.log(
                    `Customer update failed: ${updateError instanceof Error ? updateError.message : updateError}`,
                  );
                }
              }
            }

            if (!existingOrder) {
              try {
                await storage.createOrder({
                  shopifyOrderId: shopifyOrder.id.toString(),
                  orderNumber: shopifyOrder.name,
                  customerId: customer?.id,
                  customerEmail: shopifyOrder.email,
                  totalAmount: Math.round(
                    parseFloat(shopifyOrder.total_price) * 100,
                  ),
                  currency: shopifyOrder.currency,
                  status: mapShopifyStatus(
                    shopifyOrder.financial_status,
                    shopifyOrder.fulfillment_status,
                  ),
                  fulfillmentStatus: shopifyOrder.fulfillment_status,
                  paymentStatus: shopifyOrder.financial_status,
                  orderData: shopifyOrder,
                  orderDate: new Date(shopifyOrder.created_at),
                });
                orderStats.created++;
              } catch (createError) {
                console.error(
                  `Failed to create order ${shopifyOrder.id}: ${createError instanceof Error ? createError.message : createError}`,
                );
                orderStats.skipped++;
                errors.push(
                  `Order ${shopifyOrder.id}: Failed to create - ${createError instanceof Error ? createError.message : String(createError)}`,
                );
                continue;
              }
            } else {
              try {
                await storage.updateOrder(existingOrder.id, {
                  status: mapShopifyStatus(
                    shopifyOrder.financial_status,
                    shopifyOrder.fulfillment_status,
                  ),
                  fulfillmentStatus: shopifyOrder.fulfillment_status,
                  paymentStatus: shopifyOrder.financial_status,
                  orderData: shopifyOrder,
                  totalAmount: Math.round(
                    parseFloat(shopifyOrder.total_price) * 100,
                  ),
                });
                orderStats.updated++;
              } catch (updateError) {
                console.error(
                  `Failed to update order ${shopifyOrder.id}: ${updateError instanceof Error ? updateError.message : updateError}`,
                );
                orderStats.skipped++;
                errors.push(
                  `Order ${shopifyOrder.id}: Failed to update - ${updateError instanceof Error ? updateError.message : String(updateError)}`,
                );
                continue;
              }
            }
            orderStats.synced++;
          } catch (orderError) {
            console.error(
              `Error processing order ${shopifyOrder.id}:`,
              orderError,
            );
            orderStats.skipped++;
            errors.push(
              `Order ${shopifyOrder.id}: ${orderError instanceof Error ? orderError.message : String(orderError)}`,
            );
          }
        }

        orderStats.total = shopifyOrders.length;
        console.log(
          `✅ Order sync completed: ${orderStats.created} created, ${orderStats.updated} updated, ${orderStats.skipped} skipped from ${orderStats.total} orders`,
        );
      } catch (orderSyncError) {
        console.error("Failed to sync orders:", orderSyncError);
        errors.push(
          `Order sync failed: ${orderSyncError instanceof Error ? orderSyncError.message : String(orderSyncError)}`,
        );
      }

      const totalTime = Date.now();
      console.log(
        `🎉 Full Shopify sync completed! Customer: ${customerStats.created + customerStats.updated} processed, Orders: ${orderStats.created + orderStats.updated} processed`,
      );

      res.json({
        success: true,
        customers: customerStats,
        orders: orderStats,
        errors: errors.length > 0 ? errors.slice(0, 10) : [], // Limit error messages
        totalErrors: errors.length,
        message: `Full sync completed: ${customerStats.total} customers and ${orderStats.total} orders processed from Shopify`,
      });
    } catch (error) {
      console.error("Full Shopify sync failed:", error);
      res.status(500).json({
        success: false,
        error: "Full sync failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Incremental sync endpoint - Uses date-based syncing to avoid gaps
  app.post("/api/shopify/sync-incremental", async (req, res) => {
    try {
      console.log("🔄 Starting incremental Shopify sync (date-based)...");

      const LAST_SYNC_KEY = "shopify_last_order_sync_timestamp";

      // Get the last sync timestamp from system settings
      const lastSyncStr = await storage.getSystemSetting(LAST_SYNC_KEY);
      let lastSyncDate: Date;

      if (lastSyncStr) {
        lastSyncDate = new Date(lastSyncStr);
        console.log(`📅 Last sync was at: ${lastSyncDate.toISOString()}`);
      } else {
        // If no previous sync, default to 90 days ago to avoid overwhelming initial sync
        lastSyncDate = new Date();
        lastSyncDate.setDate(lastSyncDate.getDate() - 90);
        console.log(`📅 No previous sync found, syncing from: ${lastSyncDate.toISOString()}`);
      }

      const syncStartTime = new Date(); // Record when this sync started

      let orderStats = {
        synced: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        total: 0,
      };
      let errors: string[] = [];

      try {
        console.log("🛒 Fetching orders from Shopify...");
        const shopifyOrders = await shopifyClient.getOrdersSinceDate(
          lastSyncDate,
          (processed) => {
            console.log(`📊 Order sync progress: ${processed} orders processed`);
          }
        );

        console.log(`Processing ${shopifyOrders.length} orders...`);

        // Map Shopify financial status to our enum values
        const mapShopifyStatus = (
          financialStatus: string,
          fulfillmentStatus: string | null,
        ) => {
          if (fulfillmentStatus === "fulfilled") return "delivered";
          if (fulfillmentStatus === "partial") return "shipped";
          if (financialStatus === "paid" || financialStatus === "authorized") {
            return fulfillmentStatus === null ? "processing" : "shipped";
          }
          if (financialStatus === "pending") return "pending";
          if (financialStatus === "refunded") return "refunded";
          if (financialStatus === "voided") return "cancelled";
          return "pending";
        };

        for (const shopifyOrder of shopifyOrders) {
          try {
            const existingOrder = await storage.getOrderByShopifyId(
              shopifyOrder.id.toString(),
            );

            // Handle customer creation/updating first
            let customer = null;
            if (shopifyOrder.customer && shopifyOrder.customer.email) {
              customer = await storage.getCustomerByEmail(
                shopifyOrder.customer.email,
              );
              if (!customer) {
                try {
                  customer = await storage.createCustomer({
                    email: shopifyOrder.customer.email,
                    firstName: shopifyOrder.customer.first_name,
                    lastName: shopifyOrder.customer.last_name,
                    shopifyCustomerId: shopifyOrder.customer.id.toString(),
                  });
                } catch (customerError) {
                  console.log(
                    `Customer creation failed, attempting to get existing customer: ${shopifyOrder.customer.email}`,
                  );
                  customer = await storage.getCustomerByEmail(
                    shopifyOrder.customer.email,
                  );
                }
              } else if (
                !customer.shopifyCustomerId ||
                customer.shopifyCustomerId !==
                shopifyOrder.customer.id.toString()
              ) {
                try {
                  await storage.updateCustomer(customer.id, {
                    shopifyCustomerId: shopifyOrder.customer.id.toString(),
                    firstName:
                      shopifyOrder.customer.first_name || customer.firstName,
                    lastName:
                      shopifyOrder.customer.last_name || customer.lastName,
                  });
                } catch (updateError) {
                  console.log(
                    `Customer update failed: ${updateError instanceof Error ? updateError.message : updateError}`,
                  );
                }
              }
            }

            if (!existingOrder) {
              try {
                await storage.createOrder({
                  shopifyOrderId: shopifyOrder.id.toString(),
                  orderNumber: shopifyOrder.name,
                  customerId: customer?.id,
                  customerEmail: shopifyOrder.email,
                  totalAmount: Math.round(
                    parseFloat(shopifyOrder.total_price) * 100,
                  ),
                  currency: shopifyOrder.currency,
                  status: mapShopifyStatus(
                    shopifyOrder.financial_status,
                    shopifyOrder.fulfillment_status,
                  ),
                  fulfillmentStatus: shopifyOrder.fulfillment_status,
                  paymentStatus: shopifyOrder.financial_status,
                  orderData: shopifyOrder,
                  orderDate: new Date(shopifyOrder.created_at),
                });
                orderStats.created++;
              } catch (createError) {
                console.error(
                  `Failed to create order ${shopifyOrder.id}: ${createError instanceof Error ? createError.message : createError}`,
                );
                orderStats.skipped++;
                errors.push(
                  `Order ${shopifyOrder.id}: Failed to create - ${createError instanceof Error ? createError.message : String(createError)}`,
                );
                continue;
              }
            } else {
              try {
                await storage.updateOrder(existingOrder.id, {
                  status: mapShopifyStatus(
                    shopifyOrder.financial_status,
                    shopifyOrder.fulfillment_status,
                  ),
                  fulfillmentStatus: shopifyOrder.fulfillment_status,
                  paymentStatus: shopifyOrder.financial_status,
                  orderData: shopifyOrder,
                  totalAmount: Math.round(
                    parseFloat(shopifyOrder.total_price) * 100,
                  ),
                });
                orderStats.updated++;
              } catch (updateError) {
                console.error(
                  `Failed to update order ${shopifyOrder.id}: ${updateError instanceof Error ? updateError.message : updateError}`,
                );
                orderStats.skipped++;
                errors.push(
                  `Order ${shopifyOrder.id}: Failed to update - ${updateError instanceof Error ? updateError.message : String(updateError)}`,
                );
                continue;
              }
            }
            orderStats.synced++;
          } catch (orderError) {
            console.error(
              `Error processing order ${shopifyOrder.id}:`,
              orderError,
            );
            orderStats.skipped++;
            errors.push(
              `Order ${shopifyOrder.id}: ${orderError instanceof Error ? orderError.message : String(orderError)}`,
            );
          }
        }

        orderStats.total = shopifyOrders.length;

        // Only update the last sync timestamp if the sync completed successfully
        await storage.setSystemSetting(LAST_SYNC_KEY, syncStartTime.toISOString());

        console.log(
          `✅ Incremental order sync completed: ${orderStats.created} created, ${orderStats.updated} updated, ${orderStats.skipped} skipped from ${orderStats.total} orders`,
        );
        console.log(`📅 Updated last sync timestamp to: ${syncStartTime.toISOString()}`);
      } catch (orderSyncError) {
        console.error("Failed to sync orders:", orderSyncError);
        errors.push(
          `Order sync failed: ${orderSyncError instanceof Error ? orderSyncError.message : String(orderSyncError)}`,
        );

        // Don't update the timestamp if sync failed - this ensures we retry from the same point
        return res.status(500).json({
          success: false,
          error: "Incremental sync failed",
          message: orderSyncError instanceof Error ? orderSyncError.message : String(orderSyncError),
          orders: orderStats,
          errors: errors.length > 0 ? errors.slice(0, 10) : [],
        });
      }

      console.log("🎉 Incremental Shopify sync completed!");

      res.json({
        success: true,
        orders: orderStats,
        errors: errors.length > 0 ? errors.slice(0, 10) : [],
        totalErrors: errors.length,
        lastSyncTimestamp: syncStartTime.toISOString(),
        message: `Incremental sync completed: ${orderStats.total} orders processed from Shopify since ${lastSyncDate.toISOString()}`,
      });
    } catch (error) {
      console.error("Incremental Shopify sync failed:", error);
      res.status(500).json({
        success: false,
        error: "Incremental sync failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Sync customers from Shopify - Enhanced with bulk import
  app.post("/api/customers/sync", async (req, res) => {
    try {
      const { fullSync } = req.query;
      let shopifyCustomers;

      if (fullSync === "true") {
        console.log("🔄 Starting full customer sync from Shopify...");
        shopifyCustomers = await shopifyClient.getAllCustomers((processed) => {
          console.log(
            `📊 Customer sync progress: ${processed} customers processed`,
          );
        });
      } else {
        console.log("🔄 Starting incremental customer sync from Shopify...");
        shopifyCustomers = await shopifyClient.getCustomers({ limit: 250 });
      }

      let synced = 0;
      let created = 0;
      let updated = 0;
      let skipped = 0;

      console.log(`Processing ${shopifyCustomers.length} customers...`);

      for (const shopifyCustomer of shopifyCustomers) {
        if (!shopifyCustomer.email) {
          skipped++;
          continue; // Skip customers without email
        }

        const existingCustomer = await storage.getCustomerByEmail(
          shopifyCustomer.email,
        );

        if (!existingCustomer) {
          // Create new customer
          await storage.createCustomer({
            email: shopifyCustomer.email,
            firstName: shopifyCustomer.first_name || null,
            lastName: shopifyCustomer.last_name || null,
            phone: shopifyCustomer.phone || null,
            shopifyCustomerId: shopifyCustomer.id.toString(),
          });
          created++;
        } else if (
          !existingCustomer.shopifyCustomerId ||
          existingCustomer.shopifyCustomerId !== shopifyCustomer.id.toString()
        ) {
          // Update existing customer with Shopify ID if missing
          await storage.updateCustomer(existingCustomer.id, {
            shopifyCustomerId: shopifyCustomer.id.toString(),
            phone: shopifyCustomer.phone || existingCustomer.phone,
            firstName: shopifyCustomer.first_name || existingCustomer.firstName,
            lastName: shopifyCustomer.last_name || existingCustomer.lastName,
          });
          updated++;
        }
        synced++;
      }

      console.log(
        `✅ Customer sync completed: ${created} created, ${updated} updated, ${skipped} skipped from ${shopifyCustomers.length} Shopify customers`,
      );

      res.json({
        synced,
        created,
        updated,
        skipped,
        total: shopifyCustomers.length,
        message: `Customer sync completed: ${created} created, ${updated} updated, ${skipped} skipped from ${shopifyCustomers.length} Shopify customers`,
      });
    } catch (error) {
      console.error("Error syncing customers from Shopify:", error);
      res
        .status(500)
        .json({
          message: "Failed to sync customers from Shopify",
          error: error instanceof Error ? error.message : String(error),
        });
    }
  });

  // Sync orders from Shopify - Date-based incremental sync
  app.post("/api/orders/sync", async (req, res) => {
    try {
      const { fullSync } = req.query;
      let shopifyOrders;

      if (fullSync === "true") {
        console.log("🔄 Starting full order sync from Shopify...");
        shopifyOrders = await shopifyClient.getAllOrders((processed) => {
          console.log(`📊 Order sync progress: ${processed} orders processed`);
        });
      } else {
        console.log(`Fetching latest 250 orders from Shopify (sorted by created_at DESC)`);

        // Fetch latest orders sorted by creation date (newest first)
        shopifyOrders = await shopifyClient.getOrders({
          limit: 250,
          status: 'any',
          order: 'created_at desc' // Newest first
        });

        console.log(`Retrieved ${shopifyOrders.length} orders from Shopify`);
      }

      let synced = 0;
      let created = 0;
      let updated = 0;
      let skipped = 0;

      console.log(`Processing ${shopifyOrders.length} orders...`);

      // Map Shopify financial status to our enum values
      const mapShopifyStatus = (
        financialStatus: string,
        fulfillmentStatus: string | null,
      ) => {
        if (fulfillmentStatus === "fulfilled") return "delivered";
        if (fulfillmentStatus === "partial") return "shipped";
        if (financialStatus === "paid" || financialStatus === "authorized") {
          return fulfillmentStatus === null ? "processing" : "shipped";
        }
        if (financialStatus === "pending") return "pending";
        if (financialStatus === "refunded") return "refunded";
        if (financialStatus === "voided") return "cancelled";
        return "pending"; // default fallback
      };

      for (const shopifyOrder of shopifyOrders) {
        try {
          const existingOrder = await storage.getOrderByShopifyId(
            shopifyOrder.id.toString(),
          );

          if (!existingOrder) {
            // Create customer if doesn't exist
            let customer = null;
            if (shopifyOrder.customer && shopifyOrder.customer.email) {
              customer = await storage.getCustomerByEmail(
                shopifyOrder.customer.email,
              );
              if (!customer) {
                customer = await storage.createCustomer({
                  email: shopifyOrder.customer.email,
                  firstName: shopifyOrder.customer.first_name,
                  lastName: shopifyOrder.customer.last_name,
                  shopifyCustomerId: shopifyOrder.customer.id.toString(),
                });
              }
            }

            // Create order
            // Use Shopify's name field as order number (e.g. "#19035" or "05-13886-35414" for eBay)
            // Strip leading # if present, but keep full text for eBay orders
            const orderNumber = shopifyOrder.name?.replace(/^#/, '') || shopifyOrder.order_number?.toString() || '0';

            await storage.createOrder({
              shopifyOrderId: shopifyOrder.id.toString(),
              orderNumber: orderNumber,
              customerId: customer?.id,
              customerEmail: shopifyOrder.email,
              orderDate: shopifyOrder.created_at ? new Date(shopifyOrder.created_at) : undefined,
              totalAmount: Math.round(
                parseFloat(shopifyOrder.total_price) * 100,
              ),
              currency: shopifyOrder.currency,
              status: mapShopifyStatus(
                shopifyOrder.financial_status,
                shopifyOrder.fulfillment_status,
              ),
              fulfillmentStatus: shopifyOrder.fulfillment_status,
              paymentStatus: shopifyOrder.financial_status,
              orderData: shopifyOrder,
            });
            created++;
          } else {
            // Update existing order with latest data from Shopify
            await storage.updateOrder(existingOrder.id, {
              status: mapShopifyStatus(
                shopifyOrder.financial_status,
                shopifyOrder.fulfillment_status,
              ),
              fulfillmentStatus: shopifyOrder.fulfillment_status,
              paymentStatus: shopifyOrder.financial_status,
              orderData: shopifyOrder,
              totalAmount: Math.round(
                parseFloat(shopifyOrder.total_price) * 100,
              ),
            });
            updated++;
          }
          synced++;
        } catch (orderError) {
          console.error(
            `Error processing order ${shopifyOrder.id}:`,
            orderError,
          );
          skipped++;
        }
      }

      // Update last sync time only if not full sync
      if (fullSync !== "true") {
        await storage.setSetting('shopify_orders_last_sync', new Date().toISOString());
      }

      console.log(
        `✅ Order sync completed: ${created} created, ${updated} updated, ${skipped} skipped from ${shopifyOrders.length} Shopify orders`,
      );

      res.json({
        synced,
        created,
        updated,
        skipped,
        total: shopifyOrders.length,
        message: `Order sync completed: ${created} created, ${updated} updated, ${skipped} skipped from ${shopifyOrders.length} Shopify orders`,
      });
    } catch (error) {
      console.error("Error syncing orders:", error);
      res
        .status(500)
        .json({
          message: "Failed to sync orders",
          error: error instanceof Error ? error.message : String(error),
        });
    }
  });

  // CSV Import endpoint for orders (ADMIN only)
  app.post(
    "/api/orders/import-csv",
    requireAuth,
    requireRole(["ADMIN"]),
    upload.single("file"),
    async (req: any, res: any) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        console.log("📂 Starting CSV import...");
        const csvContent = req.file.buffer.toString("utf-8");

        // Parse CSV
        const parseResult = Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => header.trim(),
        });

        if (parseResult.errors.length > 0) {
          console.error("CSV parsing errors:", parseResult.errors);
          return res.status(400).json({
            error: "CSV parsing failed",
            details: parseResult.errors.slice(0, 5),
          });
        }

        const rows = parseResult.data as any[];
        console.log(`📊 Parsed ${rows.length} rows from CSV`);

        // Group rows by order number (Name column contains order number like #8546)
        const orderGroups = new Map<string, any[]>();
        for (const row of rows) {
          const orderNumber = row["Name"]?.toString().trim();
          if (!orderNumber) continue;

          if (!orderGroups.has(orderNumber)) {
            orderGroups.set(orderNumber, []);
          }
          orderGroups.get(orderNumber)!.push(row);
        }

        console.log(`📦 Found ${orderGroups.size} unique orders`);

        let stats = {
          processed: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          errors: [] as string[],
        };

        // Map CSV status to our enum
        const mapCSVStatus = (
          financialStatus: string,
          fulfillmentStatus: string,
        ):
          | "pending"
          | "processing"
          | "shipped"
          | "delivered"
          | "cancelled"
          | "refunded" => {
          const financial = financialStatus?.toLowerCase() || "";
          const fulfillment = fulfillmentStatus?.toLowerCase() || "";

          if (fulfillment === "fulfilled") return "delivered";
          if (fulfillment === "partial") return "shipped";
          if (financial === "paid" || financial === "authorized") {
            return fulfillment === "unfulfilled" || !fulfillment
              ? "processing"
              : "shipped";
          }
          if (financial === "pending") return "pending";
          if (financial === "refunded" || financial === "partially_refunded")
            return "refunded";
          if (financial === "voided") return "cancelled";
          return "pending";
        };

        // Process each order
        for (const [orderNumber, orderRows] of Array.from(
          orderGroups.entries(),
        )) {
          try {
            // Use first row for order-level data
            const firstRow = orderRows[0];
            const email = firstRow["Email"]?.toString().trim();

            if (!email) {
              stats.skipped++;
              stats.errors.push(`Order ${orderNumber}: No email address`);
              continue;
            }

            // Parse amounts (handle both formats: "19.48" and "19,48")
            const parseAmount = (value: string) => {
              if (!value) return 0;
              const cleaned = value.toString().replace(",", ".");
              const parsed = parseFloat(cleaned);
              return isNaN(parsed) ? 0 : Math.round(parsed * 100); // Convert to cents
            };

            const total = parseAmount(firstRow["Total"] || "0");
            const subtotal = parseAmount(firstRow["Subtotal"] || "0");
            const shipping = parseAmount(firstRow["Shipping"] || "0");
            const currency = firstRow["Currency"]?.toString().trim() || "EUR";

            const financialStatus =
              firstRow["Financial Status"]?.toString().trim() || "";
            const fulfillmentStatus =
              firstRow["Fulfillment Status"]?.toString().trim() || "";
            const createdAt = firstRow["Created at"]?.toString().trim() || "";

            // Extract customer info
            const billingName =
              firstRow["Billing Name"]?.toString().trim() || "";
            const nameParts = billingName.split(" ");
            const firstName = nameParts[0] || null;
            const lastName = nameParts.slice(1).join(" ") || null;
            const phone = firstRow["Billing Phone"]?.toString().trim() || null;

            // Create or get customer
            let customer = await storage.getCustomerByEmail(email);
            if (!customer) {
              customer = await storage.createCustomer({
                email,
                firstName,
                lastName,
                phone,
              });
            }

            // Check if order already exists by order number
            const existingOrder =
              await storage.getOrderByOrderNumber(orderNumber);

            // Collect line items from all rows for this order
            const lineItems = orderRows
              .filter((row: any) => row["Lineitem name"])
              .map((row: any) => ({
                name: row["Lineitem name"],
                quantity: parseInt(row["Lineitem quantity"] || "1"),
                price: row["Lineitem price"],
                sku: row["Lineitem sku"],
              }));

            const orderData = {
              shopifyOrderId: orderNumber, // Use order number as Shopify ID for CSV imports
              orderNumber: orderNumber.replace("#", ""), // Remove # prefix
              customerId: customer.id,
              customerEmail: email,
              totalAmount: total,
              currency,
              status: mapCSVStatus(financialStatus, fulfillmentStatus),
              fulfillmentStatus: fulfillmentStatus || null,
              paymentStatus: financialStatus || null,
              orderData: {
                csv_import: true,
                billing_name: billingName,
                subtotal,
                shipping,
                created_at: createdAt,
                line_items: lineItems,
                billing_address: {
                  name: billingName,
                  address1: firstRow["Billing Address1"],
                  city: firstRow["Billing City"],
                  zip: firstRow["Billing Zip"],
                  country: firstRow["Billing Country"],
                },
                shipping_address: {
                  name: firstRow["Shipping Name"],
                  address1: firstRow["Shipping Address1"],
                  city: firstRow["Shipping City"],
                  zip: firstRow["Shipping Zip"],
                  country: firstRow["Shipping Country"],
                },
              },
            };

            if (!existingOrder) {
              await storage.createOrder(orderData);
              stats.created++;
            } else {
              await storage.updateOrder(existingOrder.id, orderData);
              stats.updated++;
            }

            stats.processed++;
          } catch (orderError) {
            console.error(`Error processing order ${orderNumber}:`, orderError);
            stats.skipped++;
            stats.errors.push(
              `Order ${orderNumber}: ${orderError instanceof Error ? orderError.message : String(orderError)}`,
            );
          }
        }

        console.log(
          `✅ CSV import completed: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped`,
        );

        res.json({
          success: true,
          processed: stats.processed,
          created: stats.created,
          updated: stats.updated,
          skipped: stats.skipped,
          errors: stats.errors.slice(0, 10), // Limit error messages
          totalErrors: stats.errors.length,
          message: `CSV import completed: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped from ${orderGroups.size} orders`,
        });
      } catch (error) {
        console.error("CSV import failed:", error);
        res.status(500).json({
          error: "CSV import failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Create sample orders for testing (temporary until Shopify sync works)
  app.post("/api/orders/create-samples", async (req, res) => {
    try {
      const sampleOrders = [
        {
          shopifyOrderId: "5506048598246",
          orderNumber: "1001",
          customerEmail: "john.doe@example.com",
          totalAmount: 15999, // €159.99
          currency: "EUR",
          status: "delivered" as const,
          fulfillmentStatus: "shipped",
          paymentStatus: "paid",
          orderData: {
            id: 5506048598246,
            created_at: "2024-09-10T10:30:00Z",
            line_items: [
              { title: "iPhone 12 Pro - 128GB", quantity: 1, price: "159.99" },
            ],
          },
        },
        {
          shopifyOrderId: "5506048598247",
          orderNumber: "1002",
          customerEmail: "marie.smith@example.com",
          totalAmount: 8999, // €89.99
          currency: "EUR",
          status: "pending" as const,
          fulfillmentStatus: "pending",
          paymentStatus: "pending",
          orderData: {
            id: 5506048598247,
            created_at: "2024-09-10T14:15:00Z",
            line_items: [
              {
                title: "Samsung Galaxy S21 - 64GB",
                quantity: 1,
                price: "89.99",
              },
            ],
          },
        },
        {
          shopifyOrderId: "5506048598248",
          orderNumber: "1003",
          customerEmail: "david.wilson@example.com",
          totalAmount: 25000, // €250.00
          currency: "EUR",
          status: "shipped" as const,
          fulfillmentStatus: "delivered",
          paymentStatus: "paid",
          orderData: {
            id: 5506048598248,
            created_at: "2024-09-09T09:00:00Z",
            line_items: [
              { title: "MacBook Air M1 - 256GB", quantity: 1, price: "250.00" },
            ],
          },
        },
      ];

      let created = 0;
      for (const orderData of sampleOrders) {
        const existingOrder = await storage.getOrderByShopifyId(
          orderData.shopifyOrderId,
        );
        if (!existingOrder) {
          // Create customer if doesn't exist
          let customer = await storage.getCustomerByEmail(
            orderData.customerEmail,
          );
          if (!customer) {
            const [firstName, lastName] = orderData.customerEmail
              .split("@")[0]
              .split(".");
            customer = await storage.createCustomer({
              email: orderData.customerEmail,
              firstName:
                firstName?.charAt(0).toUpperCase() + firstName?.slice(1),
              lastName: lastName?.charAt(0).toUpperCase() + lastName?.slice(1),
              shopifyCustomerId: `customer_${orderData.shopifyOrderId}`,
            });
          }

          await storage.createOrder({
            ...orderData,
            customerId: customer.id,
          });
          created++;
        }
      }

      res.json({ created, message: `Created ${created} sample orders` });
    } catch (error) {
      console.error("Error creating sample orders:", error);
      res.status(500).json({ message: "Failed to create sample orders" });
    }
  });

  // Get mailbox status (newest UID)
  app.get("/api/emails/status", async (req, res) => {
    try {
      const uidNext = await emailService.getLatestUid();
      res.json({ uidNext });
    } catch (error) {
      console.error("Error fetching mailbox status:", error);
      res.status(500).json({ error: "Failed to fetch mailbox status" });
    }
  });

  // Get emails by UID range (direct IMAP fetch + DB metadata merge)
  app.get("/api/emails/list", async (req, res) => {
    try {
      const { startUid, endUid } = req.query;

      if (!startUid || !endUid) {
        return res.status(400).json({ error: "startUid and endUid are required" });
      }

      const range = `${startUid}:${endUid}`;
      console.log(`Fetching emails for range: ${range}`);

      // 1. Fetch from IMAP
      const emails = await emailService.fetchEmails(range);

      // 2. Fetch metadata from DB for these UIDs
      const uids = emails.map(e => e.uid);
      let metadataMap = new Map();

      if (uids.length > 0) {
        const metadata = await db.select({
          uid: emailThreads.uid,
          orderId: emailThreads.orderId,
          caseId: emailThreads.caseId,
          returnId: emailThreads.returnId,
          repairId: emailThreads.repairId,
          starred: emailThreads.starred,
          archived: emailThreads.archived
        })
          .from(emailThreads)
          .where(inArray(emailThreads.uid, uids));

        metadata.forEach(m => {
          if (m.uid) metadataMap.set(m.uid, m);
        });
      }

      // 3. Merge metadata
      const mergedEmails = emails.map(email => {
        const meta = metadataMap.get(email.uid) || {};
        return {
          ...email,
          orderId: meta.orderId,
          caseId: meta.caseId,
          returnId: meta.returnId,
          repairId: meta.repairId,
          starred: meta.starred || false,
          archived: meta.archived || false
        };
      });

      res.json(mergedEmails);
    } catch (error) {
      console.error("Error fetching email list:", error);
      res.status(500).json({ error: "Failed to fetch email list" });
    }
  });

  // Get email body on-demand (for detail view)
  app.get("/api/emails/:uid/body", async (req, res) => {
    try {
      const uid = parseInt(req.params.uid);

      if (isNaN(uid)) {
        return res.status(400).json({ error: "Invalid UID" });
      }

      console.log(`Fetching body for email UID ${uid}...`);
      const body = await emailService.fetchEmailBody(uid);

      res.json(body);
    } catch (error) {
      console.error("Error fetching email body:", error);
      res.status(500).json({ error: "Failed to fetch email body" });
    }
  });

  // Email threads (Legacy/DB-based - keeping for reference or fallback)
  app.get("/api/email-threads", async (req, res) => {
    try {
      const { caseId, folder, starred, archived, isUnread, hasOrder, limit } =
        req.query;

      if (caseId) {
        // Get email threads linked to a specific case
        const relatedItems = await storage.getCaseRelatedItems(
          caseId as string,
        );
        res.json(relatedItems.emails);
      } else {
        // Get email threads with database-level filtering
        const limitVal = limit ? parseInt(limit as string) : 50;
        const cursorVal = req.query.cursor ? parseInt(req.query.cursor as string) : 0;

        const result = await storage.getEmailThreads({
          limit: limitVal,
          offset: cursorVal,
          folder: folder as string,
          starred:
            starred === "true" ? true : starred === "false" ? false : undefined,
          archived:
            archived === "true"
              ? true
              : archived === "false"
                ? false
                : undefined,
          isUnread:
            isUnread === "true"
              ? true
              : isUnread === "false"
                ? false
                : undefined,
          hasOrder:
            hasOrder === "true"
              ? true
              : hasOrder === "false"
                ? false
                : undefined,
        });

        const nextCursor = result.threads.length === limitVal ? cursorVal + limitVal : undefined;

        res.json({
          items: result.threads,
          nextCursor,
          total: result.total
        });
      }
    } catch (error) {
      console.error("Error fetching email threads:", error);
      res.status(500).json({ message: "Failed to fetch email threads" });
    }
  });

  // Match orders for existing email threads that don't have orders linked
  app.post("/api/email-threads/match-orders", async (req, res) => {
    try {
      console.log(`🔄 POST /api/email-threads/match-orders endpoint called`);
      console.log(`🔄 Starting order matching for existing email threads...`);

      // Get all threads that don't have orders linked
      const threads = await storage.getEmailThreads();
      const threadsWithoutOrders = threads.filter((thread) => !thread.orderId);

      console.log(
        `📊 Found ${threadsWithoutOrders.length} threads without orders to process`,
      );

      let matchedCount = 0;
      let processedCount = 0;

      for (const thread of threadsWithoutOrders) {
        processedCount++;
        console.log(
          `🔍 Processing thread ${processedCount}/${threadsWithoutOrders.length}: "${thread.subject}" from ${thread.customerEmail}`,
        );

        try {
          // Try to match order using thread subject and customer email
          const matchedOrder = await orderMatchingService.getOrderForAutoLink(
            "", // no body content for existing threads
            thread.customerEmail || "",
            thread.subject || "",
          );

          if (matchedOrder) {
            console.log(
              `🎯 MATCHED: Order ${matchedOrder.orderNumber} (ID: ${matchedOrder.id}) for thread "${thread.subject}" from ${thread.customerEmail}`,
            );

            // Update the thread with the matched order
            await storage.updateEmailThread(thread.id, {
              orderId: matchedOrder.id,
            });

            matchedCount++;
          } else {
            console.log(
              `🔍 NO MATCH: No order found for thread "${thread.subject}" from ${thread.customerEmail}`,
            );
          }
        } catch (matchingError) {
          console.error(
            `❌ Error matching order for thread ${thread.id}:`,
            matchingError,
          );
        }
      }

      console.log(
        `✅ Order matching completed: ${matchedCount}/${processedCount} threads matched with orders`,
      );

      res.json({
        processed: processedCount,
        matched: matchedCount,
        message: `Successfully processed ${processedCount} threads, matched ${matchedCount} with orders`,
      });
    } catch (error) {
      console.error("❌ Error in match-orders endpoint:", error);
      res
        .status(500)
        .json({ message: "Failed to match orders for existing threads" });
    }
  });

  app.get("/api/email-threads/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const thread = await storage.getEmailThread(id);
      if (!thread) {
        return res.status(404).json({ message: "Email thread not found" });
      }

      const messages = await storage.getEmailMessages(id);
      res.json({ ...thread, messages });
    } catch (error) {
      console.error("Error fetching email thread:", error);
      res.status(500).json({ message: "Failed to fetch email thread" });
    }
  });

  // Create sample emails for testing
  app.post("/api/emails/create-samples", async (req, res) => {
    try {
      console.log("🧪 Creating sample emails...");

      // 1. Create sample customers if they don't exist
      const sampleCustomers = [
        { email: "alice.wonderland@example.com", firstName: "Alice", lastName: "Wonderland" },
        { email: "bob.builder@example.com", firstName: "Bob", lastName: "Builder" },
        { email: "charlie.chocolate@example.com", firstName: "Charlie", lastName: "Bucket" },
      ];

      for (const cust of sampleCustomers) {
        const existing = await storage.getCustomerByEmail(cust.email);
        if (!existing) {
          await storage.createCustomer({
            email: cust.email,
            firstName: cust.firstName,
            lastName: cust.lastName,
            phone: "555-0123",
          });
        }
      }

      // 2. Create sample threads and messages
      const samples = [
        {
          subject: "Order #1001 - Where is my package?",
          from: "alice.wonderland@example.com",
          body: "Hi,\n\nI ordered this 3 days ago and still haven't received a tracking number. Can you please check?\n\nThanks,\nAlice",
          date: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
          isUnread: true,
          folder: "inbox",
          hasOrder: true,
        },
        {
          subject: "Return Request for Order #1002",
          from: "bob.builder@example.com",
          body: "Hello,\n\nThe item I received is damaged. I would like to return it. Please send me a return label.\n\nRegards,\nBob",
          date: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
          isUnread: true,
          folder: "inbox",
          hasOrder: true,
        },
        {
          subject: "Question about iPhone 12 condition",
          from: "charlie.chocolate@example.com",
          body: "Hi there,\n\nI'm interested in the iPhone 12 you have listed. Is the screen scratch-free? Can you send more photos?\n\nBest,\nCharlie",
          date: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
          isUnread: false,
          folder: "inbox",
          hasOrder: false,
        },
        {
          subject: "Newsletter Subscription Confirmed",
          from: "newsletter@thrifthub.com",
          body: "Welcome to ThriftHub Newsletter! Stay tuned for great deals.",
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
          isUnread: false,
          folder: "inbox",
          hasOrder: false,
        },
        {
          subject: "Your order #999 has been delivered",
          from: "shipping@thrifthub.com",
          body: "Good news! Your order #999 has been delivered to your mailbox.",
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 1 week ago
          isUnread: false,
          folder: "archive",
          hasOrder: true,
        }
      ];

      let createdCount = 0;

      for (const sample of samples) {
        // Check if thread already exists to avoid duplicates
        const threadId = `sample-${sample.from}-${sample.subject.replace(/\s+/g, '-')}`;
        const existingThread = await storage.getEmailThreadByThreadId(threadId);

        if (!existingThread) {
          const thread = await storage.createEmailThread({
            threadId: threadId,
            subject: sample.subject,
            customerEmail: sample.from,
            status: "open",
            isUnread: sample.isUnread,
            lastActivity: sample.date,
            hasAttachment: false,
            folder: sample.folder, // Note: Schema might not have folder column directly on thread, usually inferred or separate. 
            // Checking schema... storage.getEmailThreads filters by folder but schema might rely on labels or status.
            // For now, we'll assume default 'inbox' behavior or 'archived' flag.
            archived: sample.folder === 'archive',
          } as any); // Cast as any if folder isn't in schema, likely 'archived' boolean is used.

          // Create the message
          await storage.createEmailMessage({
            messageId: `msg-${Date.now()}-${createdCount}`,
            threadId: thread.id,
            fromEmail: sample.from,
            toEmail: "contact@dutchthrift.com",
            subject: sample.subject,
            body: sample.body,
            isHtml: false,
            sentAt: sample.date,
          });

          createdCount++;
        }
      }

      res.json({ success: true, message: `Created ${createdCount} sample email threads` });
    } catch (error) {
      console.error("Error creating sample emails:", error);
      res.status(500).json({ message: "Failed to create sample emails" });
    }
  });

  // Sync emails
  app.post("/api/emails/sync", async (req, res) => {
    try {
      console.log(`🚀 Starting email sync...`);
      const emails = await syncEmails();
      console.log(`📬 Received ${emails.length} emails from IMAP provider`);

      // Process and store emails
      let processedCount = 0;
      for (const email of emails) {
        processedCount++;
        console.log(
          `📧 Processing email ${processedCount}/${emails.length}: ${email.messageId} (hasAttachment: ${email.hasAttachment})`,
        );

        // Check if extractedAttachments exists and log details
        const extractedAttachments = (email as any).extractedAttachments;
        console.log(
          `🔍 Attachments check - Email ${email.messageId}: extractedAttachments type=${typeof extractedAttachments}, isArray=${Array.isArray(extractedAttachments)}, length=${extractedAttachments?.length || "undefined"}`,
        );
        if (
          extractedAttachments &&
          Array.isArray(extractedAttachments) &&
          extractedAttachments.length > 0
        ) {
          console.log(
            `📎 Found ${extractedAttachments.length} attachments:`,
            extractedAttachments,
          );
        }
        // Check if message already exists (deduplication)
        const existingMessage = await storage.getEmailMessage(email.messageId);
        if (existingMessage) {
          continue; // Skip if already processed
        }

        // Check if thread exists by threadId
        const threadId = email.conversationId || email.messageId;
        let thread = await storage.getEmailThreadByThreadId(threadId);

        if (!thread) {
          // Create new thread with automatic order matching
          try {
            // Try to automatically match orders for this email
            const matchedOrder = await orderMatchingService.getOrderForAutoLink(
              email.body || "",
              email.from || "",
              email.subject || "",
            );

            console.log(
              matchedOrder
                ? `🎯 NEW THREAD: Automatically matched order ${matchedOrder.orderNumber} (ID: ${matchedOrder.id}) for email from ${email.from}`
                : `🔍 NEW THREAD: No automatic order match found for email from ${email.from}`,
            );

            thread = await storage.createEmailThread({
              threadId: threadId,
              subject: email.subject,
              customerEmail: email.from,
              status: "open",
              isUnread: !email.isRead,
              lastActivity: new Date(email.receivedDateTime),
              hasAttachment: email.hasAttachment,
              orderId: matchedOrder?.id || null, // Automatically link order if found
            });
          } catch (error: any) {
            // If duplicate thread ID, fetch the existing one
            if (error.code === "23505") {
              thread = await storage.getEmailThreadByThreadId(threadId);
              if (!thread) {
                throw error; // Re-throw if still can't find it
              }
            } else {
              throw error;
            }
          }
        } else if (!thread.orderId) {
          // Thread exists but doesn't have an order linked - try to match one
          try {
            const matchedOrder = await orderMatchingService.getOrderForAutoLink(
              email.body || "",
              email.from || "",
              email.subject || "",
            );

            if (matchedOrder) {
              console.log(
                `🎯 EXISTING THREAD: Matched order ${matchedOrder.orderNumber} (ID: ${matchedOrder.id}) for existing thread from ${email.from}`,
              );

              // Update the existing thread with the matched order
              thread = await storage.updateEmailThread(thread.id, {
                orderId: matchedOrder.id,
              });
            } else {
              console.log(
                `🔍 EXISTING THREAD: No order match found for existing thread from ${email.from}`,
              );
            }
          } catch (matchingError) {
            console.error(
              `❌ Error matching order for existing thread ${thread.id}:`,
              matchingError,
            );
          }
        } else {
          console.log(
            `✅ EXISTING THREAD: Thread from ${email.from} already has order ${thread.orderId} linked`,
          );
        }

        // Create message (only if not duplicate)
        try {
          const createdMessage = await storage.createEmailMessage({
            messageId: email.messageId,
            threadId: thread.id,
            fromEmail: email.from,
            toEmail: email.to,
            subject: email.subject,
            body: email.body,
            isHtml: email.isHtml,
            sentAt: new Date(email.receivedDateTime),
          });

          // Create attachment records if attachments were extracted
          const extractedAttachments = (email as any).extractedAttachments;
          console.log(
            `🔍 DEBUG: Email ${email.messageId} (hasAttachment: ${email.hasAttachment}) extractedAttachments:`,
            extractedAttachments,
          );
          console.log(
            `🔍 DEBUG: Type check - extractedAttachments isArray: ${Array.isArray(extractedAttachments)}, length: ${extractedAttachments?.length || "undefined"}`,
          );

          if (
            extractedAttachments &&
            Array.isArray(extractedAttachments) &&
            extractedAttachments.length > 0
          ) {
            console.log(
              `📎 Processing ${extractedAttachments.length} attachments for email ${email.messageId}`,
            );
            for (let i = 0; i < extractedAttachments.length; i++) {
              const attachmentUrl = extractedAttachments[i];
              try {
                // Extract filename from storage URL
                const urlParts = attachmentUrl.split("/");
                const filename = urlParts[urlParts.length - 1];

                console.log(
                  `📎 Creating attachment record ${i + 1}/${extractedAttachments.length}: ${filename} -> ${attachmentUrl}`,
                );

                await storage.createEmailAttachment({
                  messageId: createdMessage.id,
                  filename: filename,
                  storageUrl: attachmentUrl,
                  contentType: "application/octet-stream", // Default, could be improved
                  size: 0, // Could be improved to track actual size
                  isInline: false,
                });

                console.log(`✅ Created attachment record: ${filename}`);
              } catch (attachmentError) {
                console.error(
                  `❌ Error creating attachment record for ${attachmentUrl}:`,
                  attachmentError,
                );
              }
            }
          } else if (email.hasAttachment) {
            console.log(
              `⚠️ WARNING: Email ${email.messageId} has hasAttachment=true but extractedAttachments is empty or invalid`,
            );
          }
        } catch (error: any) {
          // Skip duplicates, log others
          if (error.code !== "23505") {
            console.error("Error creating email message:", error);
          }
        }
      }

      res.json({ synced: emails.length });
    } catch (error) {
      console.error("Error syncing emails:", error);
      res.status(500).json({ message: "Failed to sync emails" });
    }
  });

  // Import all emails from 2025-01-01 to now
  app.post("/api/emails/import-all", requireAuth, async (req, res) => {
    try {
      console.log(`🚀 Starting full email import from 2025-01-01...`);
      const result = await importAllEmails();

      if (result.success) {
        // Auto-match orders for newly imported emails
        console.log(`🔄 Auto-matching orders for imported emails...`);
        try {
          const threads = await storage.getEmailThreads({});
          const threadsWithoutOrders = threads.filter((thread) => !thread.orderId);

          let matchedCount = 0;
          for (const thread of threadsWithoutOrders) {
            const messages = await storage.getEmailMessages(thread.id);
            if (messages.length > 0) {
              const firstMessage = messages[0];
              const matchedOrder = await orderMatchingService.getOrderForAutoLink(
                firstMessage.body || "",
                thread.customerEmail || "",
                thread.subject || "",
              );

              if (matchedOrder) {
                await storage.updateEmailThread(thread.id, {
                  orderId: matchedOrder.id,
                });
                matchedCount++;
              }
            }
          }

          console.log(`✅ Matched ${matchedCount} threads with orders`);
        } catch (matchError) {
          console.error("Error auto-matching orders:", matchError);
        }

        res.json({
          success: true,
          imported: result.imported,
          message: `Successfully imported ${result.imported} emails from 2025-01-01 to now`,
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Email import failed",
        });
      }
    } catch (error) {
      console.error("Error importing emails:", error);
      res.status(500).json({
        success: false,
        message: "Failed to import emails",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Update email thread
  app.patch("/api/email-threads/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const thread = await storage.updateEmailThread(id, updateData);

      // Create activity for status changes
      if (updateData.status) {
        await storage.createActivity({
          type: "email_status_updated",
          description: `Email thread status changed to: ${updateData.status}`,
          userId: "default-user", // TODO: Use actual user from session
          metadata: { threadId: id, newStatus: updateData.status },
        });
      }

      res.json(thread);
    } catch (error) {
      console.error("Error updating email thread:", error);
      res.status(500).json({ message: "Failed to update email thread" });
    }
  });

  // Bulk actions for email threads
  app.post("/api/email-threads/bulk/mark-read", async (req, res) => {
    try {
      const { threadIds } = req.body;
      if (!Array.isArray(threadIds) || threadIds.length === 0) {
        return res.status(400).json({ message: "threadIds array is required" });
      }

      const updates = await Promise.all(
        threadIds.map((id) =>
          storage.updateEmailThread(id, { isUnread: false }),
        ),
      );

      res.json({ updated: updates.length, threads: updates });
    } catch (error) {
      console.error("Error marking threads as read:", error);
      res.status(500).json({ message: "Failed to mark threads as read" });
    }
  });

  app.post("/api/email-threads/bulk/mark-unread", async (req, res) => {
    try {
      const { threadIds } = req.body;
      if (!Array.isArray(threadIds) || threadIds.length === 0) {
        return res.status(400).json({ message: "threadIds array is required" });
      }

      const updates = await Promise.all(
        threadIds.map((id) =>
          storage.updateEmailThread(id, { isUnread: true }),
        ),
      );

      res.json({ updated: updates.length, threads: updates });
    } catch (error) {
      console.error("Error marking threads as unread:", error);
      res.status(500).json({ message: "Failed to mark threads as unread" });
    }
  });

  app.post("/api/email-threads/bulk/star", async (req, res) => {
    try {
      const { threadIds } = req.body;
      if (!Array.isArray(threadIds) || threadIds.length === 0) {
        return res.status(400).json({ message: "threadIds array is required" });
      }

      const updates = await Promise.all(
        threadIds.map((id) => storage.updateEmailThread(id, { starred: true })),
      );

      res.json({ updated: updates.length, threads: updates });
    } catch (error) {
      console.error("Error starring threads:", error);
      res.status(500).json({ message: "Failed to star threads" });
    }
  });

  app.post("/api/email-threads/bulk/unstar", async (req, res) => {
    try {
      const { threadIds } = req.body;
      if (!Array.isArray(threadIds) || threadIds.length === 0) {
        return res.status(400).json({ message: "threadIds array is required" });
      }

      const updates = await Promise.all(
        threadIds.map((id) =>
          storage.updateEmailThread(id, { starred: false }),
        ),
      );

      res.json({ updated: updates.length, threads: updates });
    } catch (error) {
      console.error("Error unstarring threads:", error);
      res.status(500).json({ message: "Failed to unstar threads" });
    }
  });

  app.post("/api/email-threads/bulk/archive", async (req, res) => {
    try {
      const { threadIds } = req.body;
      if (!Array.isArray(threadIds) || threadIds.length === 0) {
        return res.status(400).json({ message: "threadIds array is required" });
      }

      const updates = await Promise.all(
        threadIds.map((id) =>
          storage.updateEmailThread(id, { archived: true }),
        ),
      );

      res.json({ updated: updates.length, threads: updates });
    } catch (error) {
      console.error("Error archiving threads:", error);
      res.status(500).json({ message: "Failed to archive threads" });
    }
  });

  app.post("/api/email-threads/bulk/unarchive", async (req, res) => {
    try {
      const { threadIds } = req.body;
      if (!Array.isArray(threadIds) || threadIds.length === 0) {
        return res.status(400).json({ message: "threadIds array is required" });
      }

      const updates = await Promise.all(
        threadIds.map((id) =>
          storage.updateEmailThread(id, { archived: false }),
        ),
      );

      res.json({ updated: updates.length, threads: updates });
    } catch (error) {
      console.error("Error unarchiving threads:", error);
      res.status(500).json({ message: "Failed to unarchive threads" });
    }
  });

  app.delete("/api/email-threads/bulk", async (req, res) => {
    try {
      const { threadIds } = req.body;
      if (!Array.isArray(threadIds) || threadIds.length === 0) {
        return res.status(400).json({ message: "threadIds array is required" });
      }

      await Promise.all(threadIds.map((id) => storage.deleteEmailThread(id)));

      res.json({
        deleted: threadIds.length,
        message: `Deleted ${threadIds.length} threads`,
      });
    } catch (error) {
      console.error("Error deleting threads:", error);
      res.status(500).json({ message: "Failed to delete threads" });
    }
  });

  // Send email
  app.post("/api/emails/send", async (req, res) => {
    try {
      const { to, subject, body } = req.body;

      if (!to || !subject || !body) {
        return res
          .status(400)
          .json({ message: "Missing required fields: to, subject, body" });
      }

      const result = await sendEmail(to, subject, body);
      res.json(result);
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  // === EMAIL METADATA API ENDPOINTS ===
  // These endpoints ONLY store metadata (links), NOT email content
  // Email content stays on IMAP server

  // Link email thread to order
  app.post("/api/emails/link-to-order", async (req, res) => {
    try {
      const { emailThreadId, orderId } = req.body;

      if (!emailThreadId || !orderId) {
        return res.status(400).json({
          message: "Missing required fields: emailThreadId, orderId"
        });
      }

      // Update email thread with order link (metadata only)
      const updatedThread = await storage.updateEmailThread(emailThreadId, {
        orderId: orderId,
      });

      // Create activity log
      await storage.createActivity({
        type: "email_linked_to_order",
        description: `Email thread linked to order`,
        userId: null, // TODO: Get from session
        metadata: { emailThreadId, orderId },
      });

      res.json({
        success: true,
        thread: updatedThread,
        message: "Email successfully linked to order"
      });
    } catch (error) {
      console.error("Error linking email to order:", error);
      res.status(500).json({ message: "Failed to link email to order" });
    }
  });

  // Create case from email thread
  app.post("/api/emails/create-case", async (req, res) => {
    try {
      const { emailThreadId, caseData } = req.body;

      if (!emailThreadId || !caseData) {
        return res.status(400).json({
          message: "Missing required fields: emailThreadId, caseData"
        });
      }

      // Create new case
      const newCase = await storage.createCase({
        title: caseData.title,
        description: caseData.description,
        customerEmail: caseData.customerEmail,
        status: caseData.status || "new",
        priority: "medium",
      });

      // Link email thread to case (metadata only)
      await storage.updateEmailThread(emailThreadId, {
        caseId: newCase.id,
      });

      // Create activity log
      await storage.createActivity({
        type: "case_created_from_email",
        description: `Created case #${newCase.caseNumber} from email`,
        userId: null, // TODO: Get from session
        metadata: { emailThreadId, caseId: newCase.id },
      });

      res.json({
        success: true,
        caseId: newCase.id,
        caseNumber: newCase.caseNumber,
        message: "Case created and linked to email"
      });
    } catch (error) {
      console.error("Error creating case from email:", error);
      res.status(500).json({ message: "Failed to create case" });
    }
  });

  // Create return from email thread
  app.post("/api/emails/create-return", async (req, res) => {
    try {
      const { emailThreadId, orderId, returnData } = req.body;

      if (!emailThreadId || !orderId) {
        return res.status(400).json({
          message: "Missing required fields: emailThreadId, orderId"
        });
      }

      // Get order to fetch customer information
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Create new return
      const newReturn = await storage.createReturn({
        orderId: orderId,
        customerId: order.customerId,
        status: returnData?.status || "nieuw_onderweg",
        returnReason: returnData?.reason || "other",
        customerNotes: returnData?.notes || "",
      });

      // Link email thread to return via case  
      // Create a case for the return
      const returnCase = await storage.createCase({
        title: `Return: ${order.orderNumber}`,
        description: `Return request from email`,
        customerEmail: order.customerEmail || "",
        orderId: orderId,
        status: "new",
        priority: "medium",
      });

      // Update return with case link
      await storage.updateReturn(newReturn.id, {
        caseId: returnCase.id,
      });

      // Link email thread to case
      await storage.updateEmailThread(emailThreadId, {
        caseId: returnCase.id,
      });

      // Create activity log
      await storage.createActivity({
        type: "return_created_from_email",
        description: `Created return #${newReturn.returnNumber} from email`,
        userId: null, // TODO: Get from session
        metadata: { emailThreadId, returnId: newReturn.id, orderId },
      });

      res.json({
        success: true,
        returnId: newReturn.id,
        returnNumber: newReturn.returnNumber,
        message: "Return created and linked to email"
      });
    } catch (error) {
      console.error("Error creating return from email:", error);
      res.status(500).json({ message: "Failed to create return" });
    }
  });

  // Create repair from email thread
  app.post("/api/emails/create-repair", async (req, res) => {
    try {
      const { emailThreadId, repairData } = req.body;

      if (!emailThreadId || !repairData) {
        return res.status(400).json({
          message: "Missing required fields: emailThreadId, repairData"
        });
      }

      // Create new repair
      const newRepair = await storage.createRepair({
        title: repairData.description || "Repair request from email",
        description: repairData.description,
        customerEmail: repairData.customerEmail,
        customerName: repairData.customerName,
        emailThreadId: emailThreadId,
        status: repairData.status || "new",
        priority: "medium",
      });

      // Create activity log
      await storage.createActivity({
        type: "repair_created_from_email",
        description: `Created repair from email`,
        userId: null, // TODO: Get from session
        metadata: { emailThreadId, repairId: newRepair.id },
      });

      res.json({
        success: true,
        repairId: newRepair.id,
        message: "Repair created and linked to email"
      });
    } catch (error) {
      console.error("Error creating repair from email:", error);
      res.status(500).json({ message: "Failed to create repair" });
    }
  });

  // Fetch email body from IMAP
  app.get("/api/emails/:uid/body", async (req, res) => {
    try {
      const { uid } = req.params;
      if (!uid) {
        return res.status(400).json({ message: "UID is required" });
      }

      const result = await fetchEmailBody(parseInt(uid));
      res.json(result);
    } catch (error) {
      console.error("Error fetching email body:", error);
      res.status(500).json({ message: "Failed to fetch email body" });
    }
  });

  // Download attachment from IMAP
  app.get("/api/emails/:uid/attachments/:partId", async (req, res) => {
    try {
      const { uid, partId } = req.params;
      if (!uid || !partId) {
        return res.status(400).json({ message: "UID and Part ID are required" });
      }

      const { buffer, contentType } = await downloadAttachment(parseInt(uid), partId);

      res.setHeader('Content-Type', contentType);
      res.send(buffer);
    } catch (error) {
      console.error("Error downloading attachment:", error);
      res.status(500).json({ message: "Failed to download attachment" });
    }
  });

  // Attachment endpoints - handles both email and repair attachments
  app.get("/api/attachments/*", async (req, res) => {
    try {
      // Extract the path after /api/attachments/
      const pathAfterAttachments = req.path.replace("/api/attachments/", "");
      const forceDownload = req.query.download === '1';
      console.log(
        "Attachment request path:",
        req.path,
        "extracted path:",
        pathAfterAttachments,
        "forceDownload:",
        forceDownload,
      );

      // Construct the storage path with /attachments/ prefix
      const attachmentPath = `/attachments/${pathAfterAttachments}`;
      console.log("Looking for attachment with storageUrl:", attachmentPath);

      // Try to find it as an email attachment first
      const emailAttachment = await storage.getEmailAttachment(attachmentPath);
      if (emailAttachment) {
        console.log(
          "Found email attachment:",
          emailAttachment.filename,
          "contentType:",
          emailAttachment.contentType,
        );
        await storage.downloadAttachment(attachmentPath, res, forceDownload);
        return;
      }

      // If not found as email attachment, serve directly from object storage
      // This handles repair attachments and other files
      console.log("Attempting to serve file directly from object storage");
      const objectStorageService = new ObjectStorageService();
      try {
        const file = await objectStorageService.getAttachmentFile(attachmentPath);
        await objectStorageService.downloadObject(file, res, 3600, forceDownload);
      } catch (storageError) {
        console.log("File not found in object storage:", attachmentPath);
        return res.status(404).json({ error: "Attachment not found" });
      }
    } catch (error) {
      console.error("Error downloading attachment:", error);
      res.status(500).json({ error: "Failed to download attachment" });
    }
  });

  // Get attachments for an email message
  app.get("/api/emails/:messageId/attachments", async (req, res) => {
    try {
      const { messageId } = req.params;
      const attachments = await storage.getEmailMessageAttachments(messageId);
      res.json(attachments);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  });

  // Activities
  app.get("/api/activities", async (req, res) => {
    try {
      const { purchaseOrderId } = req.query;
      let activities = await storage.getActivities();

      // Filter by purchaseOrderId if provided
      if (purchaseOrderId) {
        activities = activities.filter((activity: any) =>
          activity.metadata?.purchaseOrderId === purchaseOrderId
        );
      }

      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post("/api/activities", requireAuth, async (req: any, res) => {
    try {
      const activity = await storage.createActivity({
        ...req.body,
        userId: req.user.id,
      });
      res.status(201).json(activity);
    } catch (error) {
      console.error("Error creating activity:", error);
      res.status(400).json({ message: "Failed to create activity" });
    }
  });

  app.patch("/api/activities/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const activity = await storage.updateActivity(id, req.body);
      res.json(activity);
    } catch (error) {
      console.error("Error updating activity:", error);
      res.status(400).json({ message: "Failed to update activity" });
    }
  });

  app.delete("/api/activities/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteActivity(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting activity:", error);
      res.status(400).json({ message: "Failed to delete activity" });
    }
  });



  // Suppliers
  app.get("/api/suppliers", requireAuth, async (req: any, res: any) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.get("/api/suppliers/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const supplier = await storage.getSupplier(id);
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      res.json(supplier);
    } catch (error) {
      console.error("Error fetching supplier:", error);
      res.status(500).json({ message: "Failed to fetch supplier" });
    }
  });

  app.post("/api/suppliers", requireAuth, async (req: any, res: any) => {
    try {
      const supplier = await storage.createSupplier(req.body);
      await auditLog(req, "CREATE", "suppliers", supplier.id, {
        name: supplier.name,
      });
      res.status(201).json(supplier);
    } catch (error: any) {
      console.error("Error creating supplier:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to create supplier" });
    }
  });

  app.patch("/api/suppliers/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const supplier = await storage.updateSupplier(id, req.body);
      await auditLog(req, "UPDATE", "suppliers", id, req.body);
      res.json(supplier);
    } catch (error: any) {
      console.error("Error updating supplier:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to update supplier" });
    }
  });

  app.delete("/api/suppliers/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.deleteSupplier(id);
      await auditLog(req, "DELETE", "suppliers", id);
      res.json({ message: "Supplier deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting supplier:", error);
      res
        .status(400)
        .json({ message: error.message || "Failed to delete supplier" });
    }
  });

  app.post(
    "/api/suppliers/import-excel",
    requireAuth,
    upload.single("file"),
    async (req: any, res: any) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const XLSX = await import("xlsx");
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const suppliers = data.map((row: any) => ({
          supplierCode: String(row["Relatiecode"] || row["relatiecode"] || ""),
          name: String(row["Naam"] || row["naam"] || ""),
          contactPerson: row["Contactpersoon"] || row["contactpersoon"] || null,
          email: row["Email"] || row["email"] || null,
          phone: row["Telefoon"] ? String(row["Telefoon"]) : null,
          mobile: row["Mobiele telefoon"] || row["mobiele telefoon"] || null,
          address: row["Adres"] || row["adres"] || null,
          postalCode: row["Postcode"] || row["postcode"] || null,
          city: row["Plaats"] || row["plaats"] || null,
          website: row["Website url"] || row["website url"] || null,
          kvkNumber: row["Kvk nummer"] ? String(row["Kvk nummer"]) : null,
          vatNumber: row["Btw nummer"] || row["btw nummer"] || null,
          iban: row["Iban"] || row["iban"] || row["IBAN"] || null,
          bic: row["Bic"] || row["bic"] || row["BIC"] || null,
          bankAccount: row["Bankrekeningnummer"]
            ? String(row["Bankrekeningnummer"])
            : null,
          paymentTerms: row["Krediettermijn"] || 0,
          correspondenceAddress: row["Correspondentie adres"] || null,
          correspondencePostalCode:
            row["Correspondentie adres postcode"] || null,
          correspondenceCity: row["Correspondentie adres plaats"] || null,
          correspondenceContact:
            row["Correspondentie adres contactpersoon"] || null,
          notes: row["Memo"] || row["memo"] || null,
          active: true,
        }));

        await storage.importSuppliers(suppliers);
        await auditLog(req, "IMPORT", "suppliers", undefined, {
          count: suppliers.length,
        });

        res.json({
          message: `Successfully imported ${suppliers.length} suppliers`,
        });
      } catch (error: any) {
        console.error("Error importing suppliers:", error);
        res
          .status(500)
          .json({ message: error.message || "Failed to import suppliers" });
      }
    },
  );

  // Purchase Orders
  app.get("/api/purchase-orders", async (req, res) => {
    try {
      const purchaseOrders = await storage.getPurchaseOrders();
      res.json(purchaseOrders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
  });

  app.get("/api/purchase-orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const purchaseOrder = await storage.getPurchaseOrder(id);
      if (!purchaseOrder) {
        return res.status(404).json({ message: "Purchase order not found" });
      }
      res.json(purchaseOrder);
    } catch (error) {
      console.error("Error fetching purchase order:", error);
      res.status(500).json({ message: "Failed to fetch purchase order" });
    }
  });

  app.post("/api/purchase-orders", async (req, res) => {
    try {
      // Additional validation for photos array size
      if (req.body.photos && Array.isArray(req.body.photos)) {
        if (req.body.photos.length > 3) {
          return res.status(400).json({ message: "Maximum 3 images allowed" });
        }
        // Basic validation for base64 image format
        for (const photo of req.body.photos) {
          if (typeof photo !== "string" || !photo.startsWith("data:image/")) {
            return res.status(400).json({ message: "Invalid image format" });
          }
          // Check approximate size (base64 is ~33% larger than original)
          if (photo.length > 2800000) {
            // ~2MB encoded size
            return res
              .status(400)
              .json({ message: "Image too large, maximum 2MB per image" });
          }
        }
      }

      // Extract lineItems from request body before validation
      const { lineItems, ...purchaseOrderFields } = req.body;

      const validatedData = insertPurchaseOrderSchema.parse(purchaseOrderFields);

      // Convert orderDate string to Date object for database if needed
      const purchaseOrderData = {
        ...validatedData,
        orderDate:
          typeof validatedData.orderDate === "string"
            ? new Date(validatedData.orderDate)
            : validatedData.orderDate,
      };

      // Use createPurchaseOrderWithItems (handles PO number generation, items, and activity)
      const purchaseOrder = await storage.createPurchaseOrderWithItems(
        purchaseOrderData as any,
        lineItems || []
      );

      res.status(201).json(purchaseOrder);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create purchase order";
      res.status(400).json({ message: errorMessage });
    }
  });

  app.patch("/api/purchase-orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { lineItems, ...updateFields } = req.body;

      console.log("DEBUG PATCH PO - Received updateFields:", JSON.stringify(updateFields, null, 2));

      // Always validate with partial schema for data integrity
      const updateData = insertPurchaseOrderSchema.partial().parse(updateFields);

      console.log("DEBUG PATCH PO - After schema parse:", JSON.stringify(updateData, null, 2));

      // Convert orderDate string to Date object for database if present
      const purchaseOrderUpdateData = updateData.orderDate
        ? {
          ...updateData,
          orderDate:
            typeof updateData.orderDate === "string"
              ? new Date(updateData.orderDate)
              : updateData.orderDate,
        }
        : updateData;

      console.log("DEBUG PATCH PO - Final update data:", JSON.stringify(purchaseOrderUpdateData, null, 2));

      const purchaseOrder = await storage.updatePurchaseOrder(
        id,
        purchaseOrderUpdateData as any,
      );

      // Handle line items update atomically if provided
      if (lineItems !== undefined) {
        // Validate line items array
        if (!Array.isArray(lineItems)) {
          return res.status(400).json({ message: "lineItems must be an array" });
        }

        await db.transaction(async (tx) => {
          // Delete all existing line items for this purchase order within transaction
          await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));

          // Create new line items within transaction
          if (lineItems.length > 0) {
            for (const item of lineItems) {
              // Validate each item
              if (!item.productName || item.quantity == null || item.unitPrice == null) {
                throw new Error("Invalid line item: missing required fields");
              }

              await tx.insert(purchaseOrderItems).values({
                purchaseOrderId: id,
                sku: item.sku || "",
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: Math.round(item.unitPrice * 100),
                subtotal: Math.round(item.quantity * item.unitPrice * 100),
              });
            }
          }
        });
      }

      if (req.body.status) {
        await storage.createActivity({
          type: "purchase_order_status_updated",
          description: `Updated purchase order status to ${req.body.status}: ${purchaseOrder.title}`,
          userId: null, // TODO: Get from session
          metadata: {
            purchaseOrderId: purchaseOrder.id,
            status: req.body.status,
          },
        });
      }

      res.json(purchaseOrder);
    } catch (error) {
      console.error("Error updating purchase order:", error);
      res.status(400).json({ message: "Failed to update purchase order" });
    }
  });

  app.delete("/api/purchase-orders/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      // Get purchase order details before deletion for audit log
      const purchaseOrder = await storage.getPurchaseOrder(id);
      if (!purchaseOrder) {
        return res.status(404).json({ message: "Purchase order not found" });
      }

      await storage.deletePurchaseOrder(id);

      await storage.createActivity({
        type: "purchase_order_deleted",
        description: `Deleted purchase order: ${purchaseOrder.title || purchaseOrder.poNumber}`,
        userId: req.user.id,
        metadata: { purchaseOrderId: id, poNumber: purchaseOrder.poNumber },
      });

      await auditLog(req, "DELETE", "purchase_orders", id, {
        poNumber: purchaseOrder.poNumber,
        title: purchaseOrder.title,
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting purchase order:", error);
      res.status(400).json({ message: "Failed to delete purchase order" });
    }
  });

  // Upload files to a purchase order
  app.post(
    "/api/purchase-orders/:id/upload",
    requireAuth,
    upload.array("files", 10),
    async (req: any, res) => {
      const uploadedPaths: string[] = [];
      try {
        const { id } = req.params;
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          return res.status(400).json({ message: "No files provided" });
        }

        const purchaseOrder = await storage.getPurchaseOrder(id);
        if (!purchaseOrder) {
          return res.status(404).json({ message: "Purchase order not found" });
        }

        // Check existing file count
        const existingFiles = await storage.getPurchaseOrderFiles(id);
        if (existingFiles.length + files.length > 20) {
          return res.status(400).json({ message: "Maximum 20 files per purchase order" });
        }

        // Validate files
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        const ALLOWED_TYPES = [
          'application/pdf',
          'image/jpeg',
          'image/jpg',
          'image/png',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];

        for (const file of files) {
          if (file.size > MAX_FILE_SIZE) {
            return res.status(400).json({ message: `File ${file.originalname} is too large (max 10MB)` });
          }
          if (!ALLOWED_TYPES.includes(file.mimetype)) {
            return res.status(400).json({ message: `File type ${file.mimetype} not allowed` });
          }
        }

        const objectStorage = new ObjectStorageService();
        const uploadedFiles: any[] = [];

        for (const file of files) {
          try {
            // Create a safe filename
            const timestamp = Date.now();
            const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filename = `purchase-order-${id}-${timestamp}-${safeOriginalName}`;

            console.log(`Uploading purchase order file: ${filename} (${file.size} bytes, ${file.mimetype})`);
            const url = await objectStorage.saveAttachment(
              filename,
              file.buffer,
              file.mimetype,
            );
            uploadedPaths.push(url);
            console.log(`Uploaded to: ${url}`);

            // Create file record in database
            const fileRecord = await storage.createPurchaseOrderFile({
              purchaseOrderId: id,
              fileName: file.originalname,
              filePath: url,
              fileType: file.mimetype,
              fileSize: file.size,
              uploadedBy: req.user.id,
            });

            uploadedFiles.push({
              id: fileRecord.id,
              fileName: fileRecord.fileName,
              fileSize: fileRecord.fileSize,
              uploadedAt: fileRecord.uploadedAt,
            });
          } catch (fileError) {
            // Rollback: delete already uploaded files
            console.error(`Error uploading file ${file.originalname}, rolling back...`, fileError);
            for (const path of uploadedPaths) {
              try {
                await objectStorage.deleteAttachment(path);
              } catch (cleanupError) {
                console.error(`Failed to cleanup file ${path}:`, cleanupError);
              }
            }
            // Delete DB records
            for (const uploaded of uploadedFiles) {
              try {
                await storage.deletePurchaseOrderFile(uploaded.id);
              } catch (cleanupError) {
                console.error(`Failed to cleanup DB record ${uploaded.id}:`, cleanupError);
              }
            }
            throw fileError;
          }
        }

        // Create activity log with file details
        await storage.createActivity({
          type: "purchase_order_updated",
          description: `Uploaded ${uploadedFiles.length} file(s) to purchase order: ${purchaseOrder.title}`,
          userId: req.user.id,
          metadata: {
            purchaseOrderId: id,
            fileCount: uploadedFiles.length,
            fileNames: uploadedFiles.map(f => f.fileName),
          },
        });

        console.log(`Successfully uploaded ${uploadedFiles.length} files to purchase order ${id}`);
        res.json({
          files: uploadedFiles,
          total: uploadedFiles.length
        });
      } catch (error) {
        console.error("Error uploading files to purchase order:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to upload files",
          uploaded: uploadedPaths.length,
        });
      }
    },
  );

  // Get files for a purchase order
  app.get("/api/purchase-orders/:id/files", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const files = await storage.getPurchaseOrderFiles(id);
      res.json(files);
    } catch (error) {
      console.error("Error fetching purchase order files:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  // Download a purchase order file
  app.get("/api/purchase-order-files/:id/download", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const file = await storage.getPurchaseOrderFile(id);

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      const objectStorage = new ObjectStorageService();
      const fileObj = await objectStorage.getAttachmentFile(file.filePath);
      await objectStorage.downloadObject(fileObj, res, 3600, false);
    } catch (error) {
      console.error("Error downloading purchase order file:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to download file" });
      }
    }
  });

  // Delete a purchase order file
  app.delete("/api/purchase-order-files/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      // Get file details using storage interface
      const file = await storage.getPurchaseOrderFile(id);

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Authorization check: only file uploader or admin can delete (handle null uploadedBy)
      const isUploader = file.uploadedBy === req.user.id;
      const isAdmin = req.user.role === 'admin';
      const noUploader = !file.uploadedBy; // Allow deletion if no uploader set

      if (!isUploader && !isAdmin && !noUploader) {
        return res.status(403).json({ message: "Not authorized to delete this file" });
      }

      // Get purchase order for activity log
      const purchaseOrder = await storage.getPurchaseOrder(file.purchaseOrderId);

      // Delete from object storage first - fail fast if this doesn't work
      const objectStorage = new ObjectStorageService();
      await objectStorage.deleteAttachment(file.filePath);

      // Only delete from database if object storage deletion succeeded
      await storage.deletePurchaseOrderFile(id);

      // Create activity log with detailed file info
      await storage.createActivity({
        type: "purchase_order_updated",
        description: `Deleted file "${file.fileName}" from purchase order: ${purchaseOrder?.title || 'Unknown'}`,
        userId: req.user.id,
        metadata: {
          purchaseOrderId: file.purchaseOrderId,
          fileName: file.fileName,
          fileSize: file.fileSize,
          fileType: file.fileType,
        },
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting purchase order file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Purchase Order Items
  app.get(
    "/api/purchase-order-items/:purchaseOrderId",
    requireAuth,
    async (req: any, res: any) => {
      try {
        const { purchaseOrderId } = req.params;
        const items = await storage.getPurchaseOrderItems(purchaseOrderId);
        res.json(items);
      } catch (error) {
        console.error("Error fetching purchase order items:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch purchase order items" });
      }
    },
  );

  app.post(
    "/api/purchase-order-items",
    requireAuth,
    async (req: any, res: any) => {
      try {
        const item = await storage.createPurchaseOrderItem(req.body);
        res.status(201).json(item);
      } catch (error: any) {
        console.error("Error creating purchase order item:", error);
        res
          .status(400)
          .json({
            message: error.message || "Failed to create purchase order item",
          });
      }
    },
  );

  app.patch(
    "/api/purchase-order-items/:id",
    requireAuth,
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const item = await storage.updatePurchaseOrderItem(id, req.body);
        res.json(item);
      } catch (error: any) {
        console.error("Error updating purchase order item:", error);
        res
          .status(400)
          .json({
            message: error.message || "Failed to update purchase order item",
          });
      }
    },
  );

  app.delete(
    "/api/purchase-order-items/:id",
    requireAuth,
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        await storage.deletePurchaseOrderItem(id);
        res.json({ message: "Purchase order item deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting purchase order item:", error);
        res
          .status(400)
          .json({
            message: error.message || "Failed to delete purchase order item",
          });
      }
    },
  );

  // Returns
  app.get("/api/returns", requireAuth, async (req: any, res: any) => {
    try {
      const { status, customerId, orderId, assignedUserId } = req.query;
      const filters: any = {};
      if (status) filters.status = status;
      if (customerId) filters.customerId = customerId;
      if (orderId) filters.orderId = orderId;
      if (assignedUserId) filters.assignedUserId = assignedUserId;

      const returns = await storage.getReturns(filters);

      // Enhance returns with order numbers
      const enhancedReturns = await Promise.all(
        returns.map(async (returnItem) => {
          if (returnItem.orderId) {
            try {
              const order = await storage.getOrder(returnItem.orderId);
              return {
                ...returnItem,
                orderNumber: order?.orderNumber || null,
              };
            } catch (error) {
              return { ...returnItem, orderNumber: null };
            }
          }
          return { ...returnItem, orderNumber: null };
        })
      );

      res.json(enhancedReturns);
    } catch (error) {
      console.error("Error fetching returns:", error);
      res.status(500).json({ message: "Failed to fetch returns" });
    }
  });

  app.get("/api/returns/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const returnData = await storage.getReturn(id);
      if (!returnData) {
        return res.status(404).json({ message: "Return not found" });
      }

      // Fetch associated order with Shopify data
      let order = null;
      let customer = null;
      let orderTracking = null;

      if (returnData.orderId) {
        order = await storage.getOrder(returnData.orderId);

        // Extract tracking from Shopify order data
        if (order?.orderData) {
          const fulfillments = (order.orderData as any)?.fulfillments || [];
          if (fulfillments.length > 0) {
            const latestFulfillment = fulfillments[fulfillments.length - 1];
            orderTracking = {
              trackingNumber: latestFulfillment.tracking_number,
              trackingUrl: latestFulfillment.tracking_url,
              trackingCompany: latestFulfillment.tracking_company,
            };
          }
        }
      }

      // Fetch customer
      if (returnData.customerId) {
        customer = await storage.getCustomer(returnData.customerId);
      } else if (order?.customerId) {
        customer = await storage.getCustomer(order.customerId);
      }

      // Fetch return items
      const items = await storage.getReturnItems(id);

      // Calculate financial comparison
      const refundAmount = returnData.refundAmount || 0;
      const originalAmount = order?.totalAmount || 0;
      const financialComparison = {
        refundAmount,
        originalAmount,
        difference: originalAmount - refundAmount,
      };

      // Tracking information
      const tracking = {
        returnTracking: {
          trackingNumber: returnData.trackingNumber,
          expectedReturnDate: returnData.expectedReturnDate,
        },
        orderTracking,
      };

      // Get photos from object storage (already in return)
      const photos = returnData.photos || [];

      // Notes are now handled via the unified notes system, not fetched here

      // Get assigned user details
      let assignedUser = null;
      if (returnData.assignedUserId) {
        assignedUser = await storage.getUser(returnData.assignedUserId);
      }

      // Return enriched data
      res.json({
        return: returnData,
        order: order || null,
        customer: customer || null,
        returnItems: items,
        financialComparison,
        tracking,
        photos,
        assignedUser: assignedUser ? {
          id: assignedUser.id,
          fullName: `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() || assignedUser.username,
          email: assignedUser.email,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching return:", error);
      res.status(500).json({ message: "Failed to fetch return" });
    }
  });

  // Get returns with optional search and limit
  app.get("/api/returns", requireAuth, async (req: any, res: any) => {
    try {
      const { search, limit = "20", caseId } = req.query;
      const limitNum = parseInt(limit as string);

      let returns = await storage.getReturns();

      // Filter by caseId if provided
      if (caseId) {
        returns = returns.filter((r: any) => r.caseId === caseId);
      }

      // Filter by search if provided
      if (search) {
        const searchLower = (search as string).toLowerCase();
        returns = returns.filter((r: any) =>
          r.returnNumber?.toLowerCase().includes(searchLower) ||
          r.id?.toLowerCase().includes(searchLower)
        );
      }

      // Sort by creation date (newest first) and limit
      returns = returns
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limitNum);

      res.json(returns);
    } catch (error) {
      console.error("Error fetching returns:", error);
      res.status(500).json({ message: "Failed to fetch returns" });
    }
  });

  app.post("/api/returns", requireAuth, async (req: any, res: any) => {
    try {
      const { items, emailThreadId, ...returnFields } = req.body;
      const validatedData = insertReturnSchema.parse(returnFields);

      // If items are provided, validate and create atomically
      if (items && Array.isArray(items) && items.length > 0) {
        // Validate items
        const validatedItems = items.map((item: any) => insertReturnItemSchema.omit({ returnId: true }).parse(item));

        // If orderId is provided, validate items against order line items
        if (validatedData.orderId) {
          const order = await storage.getOrder(validatedData.orderId);
          if (order && order.orderData) {
            const lineItems = (order.orderData as any).line_items || [];

            // Validate each item exists in order and quantity is valid
            for (const item of validatedItems) {
              const lineItem = lineItems.find((li: any) => li.sku === item.sku || li.title === item.productName);
              if (!lineItem) {
                return res.status(400).json({
                  message: `Item "${item.productName}" not found in order`,
                });
              }
              if ((item.quantity || 0) > lineItem.quantity) {
                return res.status(400).json({
                  message: `Return quantity for "${item.productName}" exceeds ordered quantity`,
                });
              }
            }
          }
        }

        // Create return with items atomically
        const returnData = await storage.createReturnWithItems(
          validatedData as any,
          validatedItems,
        );

        if (emailThreadId && !validatedData.caseId) {
          try {
            // Create a case for this return
            const customer = validatedData.customerId ? await storage.getCustomer(validatedData.customerId) : null;
            const newCase = await storage.createCase({
              title: `Retour: ${returnData.returnNumber}`,
              description: `Retour aangemaakt vanuit email`,
              customerEmail: customer?.email,
              customerId: validatedData.customerId,
              orderId: validatedData.orderId,
              status: "new",
              priority: "medium"
            });

            // Link Return to Case
            await storage.updateReturn(returnData.id, { caseId: newCase.id });

            // Link Email to Case
            await storage.updateEmailThread(emailThreadId, { caseId: newCase.id });

            // Update returnData with new caseId for response
            returnData.caseId = newCase.id;
          } catch (linkError) {
            console.error("Error auto-linking case/email to return:", linkError);
          }
        }

        await auditLog(req, "CREATE", "returns", returnData.id, {
          returnNumber: returnData.returnNumber,
          status: returnData.status,
          itemCount: items.length,
        });

        res.status(201).json(returnData);
      } else {
        // Create return without items (legacy behavior)
        const returnData = await storage.createReturn(validatedData as any);

        if (emailThreadId && !validatedData.caseId) {
          try {
            // Create a case for this return
            const customer = validatedData.customerId ? await storage.getCustomer(validatedData.customerId) : null;
            const newCase = await storage.createCase({
              title: `Retour: ${returnData.returnNumber}`,
              description: `Retour aangemaakt vanuit email`,
              customerEmail: customer?.email,
              customerId: validatedData.customerId,
              orderId: validatedData.orderId,
              status: "new",
              priority: "medium"
            });

            // Link Return to Case
            await storage.updateReturn(returnData.id, { caseId: newCase.id });

            // Link Email to Case
            await storage.updateEmailThread(emailThreadId, { caseId: newCase.id });

            // Update returnData with new caseId for response
            returnData.caseId = newCase.id;
          } catch (linkError) {
            console.error("Error auto-linking case/email to return:", linkError);
          }
        }

        await auditLog(req, "CREATE", "returns", returnData.id, {
          returnNumber: returnData.returnNumber,
          status: returnData.status,
        });

        res.status(201).json(returnData);
      }
    } catch (error: any) {
      console.error("Error creating return:", error);
      res.status(400).json({
        message: error.message || "Failed to create return",
      });
    }
  });


  // Get repairs with optional search and limit
  app.get("/api/repairs", requireAuth, async (req: any, res: any) => {
    try {
      const { search, limit = "20", caseId } = req.query;
      const limitNum = parseInt(limit as string);

      let repairs = await storage.getRepairs();

      // Filter by caseId if provided
      if (caseId) {
        repairs = repairs.filter((r: any) => r.caseId === caseId);
      }

      // Filter by search if provided
      if (search) {
        const searchLower = (search as string).toLowerCase();
        repairs = repairs.filter((r: any) =>
          r.title?.toLowerCase().includes(searchLower) ||
          r.description?.toLowerCase().includes(searchLower) ||
          r.id?.toLowerCase().includes(searchLower)
        );
      }

      // Sort by creation date (newest first) and limit
      repairs = repairs
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limitNum);

      res.json(repairs);
    } catch (error) {
      console.error("Error fetching repairs:", error);
      res.status(500).json({ message: "Failed to fetch repairs" });
    }
  });

  // Create repair
  app.post("/api/repairs", requireAuth, async (req: any, res: any) => {
    try {
      const validatedData = insertRepairSchema.parse(req.body);
      const repair = await storage.createRepair(validatedData as any);

      await auditLog(req, "CREATE", "repairs", repair.id, {
        title: repair.title,
      });

      res.status(201).json(repair);
    } catch (error) {
      console.error("Error creating repair:", error);
      res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to create repair",
      });
    }
  });

  app.patch("/api/returns/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const returnData = await storage.updateReturn(id, req.body);

      // Create activity if status changed
      if (req.body.status) {
        await storage.createActivity({
          type: "return_status_changed",
          description: `Return ${returnData.returnNumber} status changed to ${req.body.status}`,
          userId: req.user.id,
          metadata: { returnId: id, newStatus: req.body.status },
        });
      }

      await auditLog(req, "UPDATE", "returns", id, {
        returnNumber: returnData.returnNumber,
        changes: req.body,
      });

      res.json(returnData);
    } catch (error: any) {
      console.error("Error updating return:", error);
      res.status(400).json({
        message: error.message || "Failed to update return",
      });
    }
  });

  app.delete("/api/returns/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const returnData = await storage.getReturn(id);
      if (!returnData) {
        return res.status(404).json({ message: "Return not found" });
      }

      await storage.deleteReturn(id);

      await storage.createActivity({
        type: "return_deleted",
        description: `Deleted return ${returnData.returnNumber}`,
        userId: req.user.id,
        metadata: { returnId: id, returnNumber: returnData.returnNumber },
      });

      await auditLog(req, "DELETE", "returns", id, {
        returnNumber: returnData.returnNumber,
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting return:", error);
      res.status(400).json({ message: "Failed to delete return" });
    }
  });

  // Convert case to return
  app.post("/api/returns/from-case/:caseId", requireAuth, async (req: any, res: any) => {
    try {
      const { caseId } = req.params;
      const returnData = await storage.createReturnFromCase(caseId);

      await auditLog(req, "CREATE", "returns", returnData.id, {
        returnNumber: returnData.returnNumber,
        source: "case_conversion",
        caseId,
      });

      res.status(201).json(returnData);
    } catch (error: any) {
      console.error("Error creating return from case:", error);
      res.status(400).json({
        message: error.message || "Failed to create return from case",
      });
    }
  });

  // Upload photo for return
  const photoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
      }
    }
  });

  app.post("/api/returns/:id/photos", requireAuth, photoUpload.single('photo'), async (req: any, res: any) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Get the return
      const returnData = await storage.getReturn(id);
      if (!returnData) {
        return res.status(404).json({ message: "Return not found" });
      }

      // Save the photo to object storage
      const objectStorageService = new ObjectStorageService();
      const photoPath = await objectStorageService.saveAttachment(
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype
      );

      // Update the return's photos array
      const currentPhotos = returnData.photos || [];
      const updatedPhotos = [...currentPhotos, photoPath];

      await storage.updateReturn(id, { photos: updatedPhotos });

      await auditLog(req, "UPDATE", "returns", id, {
        action: "photo_uploaded",
        photoPath,
      });

      res.status(201).json({ photoPath, message: "Photo uploaded successfully" });
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      res.status(400).json({
        message: error.message || "Failed to upload photo",
      });
    }
  });

  // Delete photo from return
  app.delete("/api/returns/:id/photos", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { photoPath } = req.body;

      if (!photoPath) {
        return res.status(400).json({ message: "Photo path is required" });
      }

      const returnData = await storage.getReturn(id);
      if (!returnData) {
        return res.status(404).json({ message: "Return not found" });
      }

      // Remove the photo from the array
      const currentPhotos = returnData.photos || [];
      const updatedPhotos = currentPhotos.filter((p: string) => p !== photoPath);

      await storage.updateReturn(id, { photos: updatedPhotos });

      await auditLog(req, "UPDATE", "returns", id, {
        action: "photo_deleted",
        photoPath,
      });

      res.json({ message: "Photo deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting photo:", error);
      res.status(400).json({
        message: error.message || "Failed to delete photo",
      });
    }
  });

  // Return Items
  app.get("/api/return-items/:returnId", requireAuth, async (req: any, res: any) => {
    try {
      const { returnId } = req.params;
      const items = await storage.getReturnItems(returnId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching return items:", error);
      res.status(500).json({ message: "Failed to fetch return items" });
    }
  });

  app.post("/api/return-items", requireAuth, async (req: any, res: any) => {
    try {
      const validatedData = insertReturnItemSchema.parse(req.body);
      const item = await storage.createReturnItem(validatedData as any);
      res.status(201).json(item);
    } catch (error: any) {
      console.error("Error creating return item:", error);
      res.status(400).json({
        message: error.message || "Failed to create return item",
      });
    }
  });

  app.patch("/api/return-items/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const item = await storage.updateReturnItem(id, req.body);
      res.json(item);
    } catch (error: any) {
      console.error("Error updating return item:", error);
      res.status(400).json({
        message: error.message || "Failed to update return item",
      });
    }
  });

  app.delete("/api/return-items/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.deleteReturnItem(id);
      res.json({ message: "Return item deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting return item:", error);
      res.status(400).json({
        message: error.message || "Failed to delete return item",
      });
    }
  });

  // Search
  app.get("/api/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string") {
        return res.status(400).json({ message: "Search query is required" });
      }

      const results = await storage.globalSearch(q);
      res.json(results);
    } catch (error) {
      console.error("Error performing search:", error);
      res.status(500).json({ message: "Failed to perform search" });
    }
  });

  // Customers
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await storage.getCustomer(id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.get("/api/customers/:id/orders", async (req, res) => {
    try {
      const { id } = req.params;
      const orders = await storage.getCustomerOrders(id);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching customer orders:", error);
      res.status(500).json({ message: "Failed to fetch customer orders" });
    }
  });

  app.get("/api/customers/:id/email-threads", async (req, res) => {
    try {
      const { id } = req.params;
      const threads = await storage.getCustomerEmailThreads(id);
      res.json(threads);
    } catch (error) {
      console.error("Error fetching customer email threads:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch customer email threads" });
    }
  });

  app.get("/api/customers/:id/repairs", async (req, res) => {
    try {
      const { id } = req.params;
      const repairs = await storage.getCustomerRepairs(id);
      res.json(repairs);
    } catch (error) {
      console.error("Error fetching customer repairs:", error);
      res.status(500).json({ message: "Failed to fetch customer repairs" });
    }
  });

  // Cases
  app.get("/api/cases", async (req, res) => {
    try {
      const { status, q, emailThreadId } = req.query;
      const cases = await storage.getCases(
        status as string,
        q as string,
        emailThreadId as string,
      );
      res.json(cases);
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ message: "Failed to fetch cases" });
    }
  });

  app.post("/api/cases", async (req, res) => {
    try {
      const { items, ...caseData } = req.body;
      const validatedData = insertCaseSchema.parse(caseData);

      // Validate items if provided
      let validatedItems: any[] = [];
      if (items && items.length > 0) {
        // Create array schema for case items with required non-empty SKU
        const caseItemArraySchema = z.array(
          insertCaseItemSchema.omit({ caseId: true }).refine(
            (item) => item.sku && item.sku.trim().length > 0,
            { message: "SKU is required and cannot be empty" }
          )
        );
        validatedItems = caseItemArraySchema.parse(items);

        // If orderId is provided, validate that items belong to that order
        if (validatedData.orderId) {
          const order = await storage.getOrder(validatedData.orderId);
          if (!order) {
            return res.status(400).json({ message: "Order not found" });
          }

          // Safely extract SKUs from order line items in orderData
          const orderData = order.orderData as any;
          if (!orderData || !orderData.line_items) {
            return res.status(400).json({
              message: "Order does not have line items data. Cannot validate case items against this order."
            });
          }

          const orderLineItems = orderData.line_items;
          const orderSkus = new Set(orderLineItems.map((item: any) => item.sku).filter(Boolean));

          // Validate that all case item SKUs exist in the order
          const invalidItems = validatedItems.filter(item => !orderSkus.has(item.sku));
          if (invalidItems.length > 0) {
            return res.status(400).json({
              message: "Some items do not belong to the specified order",
              invalidSkus: invalidItems.map(item => item.sku)
            });
          }
        }
      }

      // Handle date conversions
      if (
        validatedData.slaDeadline &&
        typeof validatedData.slaDeadline === "string"
      ) {
        validatedData.slaDeadline = new Date(validatedData.slaDeadline);
      }
      if (
        validatedData.resolvedAt &&
        typeof validatedData.resolvedAt === "string"
      ) {
        validatedData.resolvedAt = new Date(validatedData.resolvedAt);
      }
      if (
        validatedData.closedAt &&
        typeof validatedData.closedAt === "string"
      ) {
        validatedData.closedAt = new Date(validatedData.closedAt);
      }

      // Create case with or without items
      const newCase = validatedItems.length > 0
        ? await storage.createCaseWithItems(validatedData, validatedItems)
        : await storage.createCase(validatedData);

      // Create activity
      await storage.createActivity({
        type: "case_created",
        description: `Created case: ${newCase.title}${validatedItems.length > 0 ? ` with ${validatedItems.length} item(s)` : ''}`,
        userId: newCase.assignedUserId,
        metadata: { caseId: newCase.id, caseNumber: newCase.caseNumber, itemCount: validatedItems.length },
      });

      res.status(201).json(newCase);
    } catch (error) {
      console.error("Error creating case:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      res.status(400).json({ message: "Failed to create case" });
    }
  });

  app.get("/api/cases/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const caseItem = await storage.getCase(id);
      if (!caseItem) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Fetch all related data in parallel
      const [caseItems, caseLinks, caseEvents] = await Promise.all([
        storage.getCaseItems(id),
        storage.getCaseLinks(id),
        storage.getCaseEvents(id)
      ]);

      // Return complete case data in one response
      res.json({
        ...caseItem,
        items: caseItems,
        links: caseLinks,
        events: caseEvents,
      });
    } catch (error) {
      console.error("Error fetching case:", error);
      res.status(500).json({ message: "Failed to fetch case" });
    }
  });

  app.get("/api/cases/:id/items", async (req, res) => {
    try {
      const { id } = req.params;
      const items = await storage.getCaseItems(id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching case items:", error);
      res.status(500).json({ message: "Failed to fetch case items" });
    }
  });

  app.patch("/api/cases/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Handle date conversions
      const updateData = { ...req.body };
      if (
        updateData.slaDeadline &&
        typeof updateData.slaDeadline === "string"
      ) {
        updateData.slaDeadline = new Date(updateData.slaDeadline);
      }
      if (updateData.resolvedAt && typeof updateData.resolvedAt === "string") {
        updateData.resolvedAt = new Date(updateData.resolvedAt);
      }
      if (updateData.closedAt && typeof updateData.closedAt === "string") {
        updateData.closedAt = new Date(updateData.closedAt);
      }

      const updatedCase = await storage.updateCase(id, updateData);

      // Create activity for status change
      if (req.body.status) {
        await storage.createActivity({
          type: "case_status_updated",
          description: `Updated case status to ${req.body.status}: ${updatedCase.title}`,
          userId: updatedCase.assignedUserId,
          metadata: { caseId: updatedCase.id, status: req.body.status },
        });
      }

      res.json(updatedCase);
    } catch (error) {
      console.error("Error updating case:", error);
      res.status(400).json({ message: "Failed to update case" });
    }
  });

  app.post("/api/cases/:id/link", async (req, res) => {
    try {
      const { id } = req.params;
      const { entityType, entityId } = req.body;

      if (!entityType || !entityId) {
        return res
          .status(400)
          .json({ message: "entityType and entityId are required" });
      }

      if (!["email", "repair", "todo", "order", "note"].includes(entityType)) {
        return res.status(400).json({ message: "Invalid entityType" });
      }

      await storage.linkEntityToCase(id, entityType, entityId);

      const caseItem = await storage.getCase(id);
      await storage.createActivity({
        type: "case_entity_linked",
        description: `Linked ${entityType} to case: ${caseItem?.title}`,
        userId: caseItem?.assignedUserId,
        metadata: { caseId: id, entityType, entityId },
      });

      res.json({ message: "Entity linked to case successfully" });
    } catch (error) {
      console.error("Error linking entity to case:", error);
      res.status(400).json({ message: "Failed to link entity to case" });
    }
  });

  app.post("/api/cases/:id/unlink", async (req, res) => {
    try {
      const { entityType, entityId } = req.body;

      if (!entityType || !entityId) {
        return res
          .status(400)
          .json({ message: "entityType and entityId are required" });
      }

      if (!["email", "repair", "todo", "order", "note"].includes(entityType)) {
        return res.status(400).json({ message: "Invalid entityType" });
      }

      await storage.unlinkEntityFromCase(entityType, entityId);

      const { id } = req.params;
      const caseItem = await storage.getCase(id);
      await storage.createActivity({
        type: "case_entity_unlinked",
        description: `Unlinked ${entityType} from case: ${caseItem?.title}`,
        userId: caseItem?.assignedUserId,
        metadata: { caseId: id, entityType, entityId },
      });

      res.json({ message: "Entity unlinked from case successfully" });
    } catch (error) {
      console.error("Error unlinking entity from case:", error);
      res.status(400).json({ message: "Failed to unlink entity from case" });
    }
  });

  // Archive a case
  app.patch("/api/cases/:id/archive", async (req, res) => {
    try {
      const { id } = req.params;

      const updatedCase = await storage.updateCase(id, {
        archived: true,
        archivedAt: new Date(),
      });

      if (!updatedCase) {
        return res.status(404).json({ message: "Case not found" });
      }

      await storage.createActivity({
        type: "case_archived",
        description: `Archived case: ${updatedCase.title || updatedCase.caseNumber || "Unknown"}`,
        userId: updatedCase.assignedUserId || null,
        metadata: { caseId: updatedCase.id },
      });

      res.json(updatedCase);
    } catch (error) {
      console.error("Error archiving case:", error);
      res.status(400).json({ message: "Failed to archive case" });
    }
  });

  // Unarchive a case
  app.patch("/api/cases/:id/unarchive", async (req, res) => {
    try {
      const { id } = req.params;

      const updatedCase = await storage.updateCase(id, {
        archived: false,
        archivedAt: null,
      });

      if (!updatedCase) {
        return res.status(404).json({ message: "Case not found" });
      }

      await storage.createActivity({
        type: "case_unarchived",
        description: `Unarchived case: ${updatedCase.title || updatedCase.caseNumber || "Unknown"}`,
        userId: updatedCase.assignedUserId || null,
        metadata: { caseId: updatedCase.id },
      });

      res.json(updatedCase);
    } catch (error) {
      console.error("Error unarchiving case:", error);
      res.status(400).json({ message: "Failed to unarchive case" });
    }
  });

  // Delete a case
  app.delete("/api/cases/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Get case details before deletion for activity log
      const caseItem = await storage.getCase(id);
      if (!caseItem) {
        return res.status(404).json({ message: "Case not found" });
      }

      await storage.deleteCase(id);

      await storage.createActivity({
        type: "case_deleted",
        description: `Deleted case: ${caseItem.title}`,
        userId: caseItem.assignedUserId,
        metadata: { caseId: id, caseNumber: caseItem.caseNumber },
      });

      res.json({ message: "Case deleted successfully" });
    } catch (error) {
      console.error("Error deleting case:", error);
      res.status(400).json({ message: "Failed to delete case" });
    }
  });

  app.post("/api/cases/from-email/:threadId", async (req, res) => {
    try {
      const { threadId } = req.params;

      const newCase = await storage.createCaseFromEmailThread(threadId);

      await storage.createActivity({
        type: "case_created_from_email",
        description: `Created case from email thread: ${newCase.title}`,
        userId: newCase.assignedUserId,
        metadata: { caseId: newCase.id, threadId },
      });

      res.status(201).json(newCase);
    } catch (error) {
      console.error("Error creating case from email thread:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to create case from email thread",
        });
    }
  });

  // Case Links
  app.get("/api/cases/:id/links", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const links = await storage.getCaseLinks(id);
      res.json(links);
    } catch (error) {
      console.error("Error fetching case links:", error);
      res.status(500).json({ message: "Failed to fetch case links" });
    }
  });

  app.post("/api/cases/:id/links", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertCaseLinkSchema.parse({
        caseId: id,
        linkType: req.body.linkType,
        linkedId: req.body.linkedId,
        createdBy: req.user.id,
      });

      const link = await storage.createCaseLink(validatedData);

      await storage.createCaseEvent({
        caseId: id,
        eventType: "link_added",
        message: `Linked ${validatedData.linkType} to case`,
        metadata: {
          linkType: validatedData.linkType,
          linkedId: validatedData.linkedId,
        },
        createdBy: req.user.id,
      });

      res.status(201).json(link);
    } catch (error) {
      console.error("Error creating case link:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to create case link",
        });
    }
  });

  app.delete(
    "/api/cases/:id/links/:linkId",
    requireAuth,
    async (req: any, res) => {
      try {
        const { id, linkId } = req.params;

        await storage.deleteCaseLink(linkId);

        await storage.createCaseEvent({
          caseId: id,
          eventType: "link_removed",
          message: `Removed link from case`,
          createdBy: req.user.id,
        });

        res.json({ message: "Link removed successfully" });
      } catch (error) {
        console.error("Error deleting case link:", error);
        res.status(400).json({ message: "Failed to delete case link" });
      }
    },
  );

  // Case Notes
  app.get("/api/cases/:id/notes", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const notes = await storage.getCaseNotes(id);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching case notes:", error);
      res.status(500).json({ message: "Failed to fetch case notes" });
    }
  });

  app.post("/api/cases/:id/notes", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertCaseNoteSchema.parse({
        caseId: id,
        content: req.body.content,
        createdBy: req.user.id,
      });

      const note = await storage.createCaseNote(validatedData);

      await storage.createCaseEvent({
        caseId: id,
        eventType: "note_added",
        message: `Added a note to case`,
        createdBy: req.user.id,
      });

      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating case note:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to create case note",
        });
    }
  });

  // Case Events (Timeline)
  app.get("/api/cases/:id/events", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const events = await storage.getCaseEvents(id);
      res.json(events);
    } catch (error) {
      console.error("Error fetching case events:", error);
      res.status(500).json({ message: "Failed to fetch case events" });
    }
  });

  // ==========================================
  // NOTES SYSTEM API ROUTES
  // ==========================================

  // DEBUG ROUTE
  app.get("/api/debug/notes", async (req, res) => {
    try {
      const allNotes = await db.select().from(notes).orderBy(desc(notes.createdAt)).limit(10);
      const count = await db.select({ count: sql<number>`count(*)` }).from(notes);
      const caseNotes = await db.select().from(notes).where(eq(notes.entityType, 'case'));

      res.json({
        totalCount: count[0].count,
        recentNotes: allNotes,
        caseNotes: caseNotes
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // DEBUG CREATE ROUTE
  app.post("/api/debug/notes", async (req: any, res: any) => {
    try {
      // 1. Verify Enum
      // Note: This raw query might vary based on postgres version, but works on standard pg
      const enumResult = await db.execute(sql`SELECT unnest(enum_range(NULL::note_entity_type))`);
      const enumValues = enumResult.map((r: any) => r.unnest);

      // 2. Create Note
      const testId = `debug-${Date.now()}`;
      const noteData = {
        entityType: "case",
        entityId: testId,
        content: "<p>Debug note persistence test</p>",
        authorId: "00000000-0000-0000-0000-000000000000", // Force invalid ID
        visibility: "internal",
        source: "debug"
      };

      console.log("DEBUG: Attempting to create note", noteData);

      const created = await storage.createNote(noteData as any);

      console.log("DEBUG: Note created object", created);

      // 3. Query back immediately
      const queried = await db.select().from(notes).where(eq(notes.entityId, testId));

      console.log("DEBUG: Queried back", queried);

      res.json({
        message: "Debug creation test",
        enumValues,
        created,
        queried,
        persisted: queried.length > 0,
        match: queried.length > 0 && queried[0].id === created.id
      });
    } catch (error: any) {
      console.error("DEBUG ERROR:", error);
      res.status(500).json({ error: String(error), stack: error.stack });
    }
  });

  // Disable ETags for all notes routes to prevent 304 cached responses
  app.use('/api/notes*', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('ETag', ''); // Disable ETag
    next();
  });

  // Core Notes Routes
  // GET /api/notes/:entityType/:entityId - Get all notes for an entity
  app.get("/api/notes/:entityType/:entityId", requireAuth, async (req: any, res: any) => {
    try {
      const { entityType, entityId } = req.params;
      const { visibility, tagIds, authorId } = req.query;

      console.log("DEBUG GET: Fetching notes for", entityType, entityId);
      console.log("DEBUG GET: Filters:", { visibility, tagIds, authorId });

      const filters: any = {};
      if (visibility) filters.visibility = visibility;
      if (authorId) filters.authorId = authorId;
      if (tagIds) {
        filters.tagIds = Array.isArray(tagIds) ? tagIds : [tagIds];
      }

      const notes = await storage.getNotes(entityType, entityId, filters);

      console.log("DEBUG GET: Found notes:", notes.length);

      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  // POST /api/notes - Create a new note
  app.post("/api/notes", requireAuth, async (req: any, res: any) => {
    try {
      log(`DEBUG: Creating note with body: ${JSON.stringify(req.body, null, 2)}`);

      // Explicitly remove deletedAt to prevent accidental soft-deletes
      const cleanBody = { ...req.body };
      delete cleanBody.deletedAt;
      delete cleanBody.id; // Ensure ID is generated by DB/App

      const validatedData = insertNoteSchema.parse({
        ...cleanBody,
        authorId: req.user.id,
      });

      log(`DEBUG: Validated data: ${JSON.stringify(validatedData, null, 2)}`);

      const note = await storage.createNote(validatedData);

      log(`DEBUG: Created note: ${JSON.stringify(note, null, 2)}`);

      await auditLog(req, "CREATE", "notes", note.id, {
        entityType: note.entityType,
        entityId: note.entityId,
      });

      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      if (error instanceof z.ZodError) {
        console.log("DEBUG: Zod validation error:", JSON.stringify(error.errors, null, 2));
        res.status(400).json({ error: "Invalid note data", details: error.errors });
      } else {
        res.status(400).json({ error: "Failed to create note" });
      }
    }
  });

  // GET /api/notes/:id - Get a single note
  app.get("/api/notes/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const note = await storage.getNote(id);

      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }

      res.json(note);
    } catch (error) {
      console.error("Error fetching note:", error);
      res.status(500).json({ error: "Failed to fetch note" });
    }
  });

  // PATCH /api/notes/:id - Update a note (creates revision)
  app.patch("/api/notes/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const existingNote = await storage.getNote(id);

      if (!existingNote) {
        return res.status(404).json({ error: "Note not found" });
      }

      // Create revision before updating
      if (req.body.content && req.body.content !== existingNote.content) {
        await storage.createNoteRevision({
          noteId: id,
          editorId: req.user.id,
          previousContent: existingNote.content,
          newContent: req.body.content,
        });
      }

      const updatedNote = await storage.updateNote(id, {
        ...req.body,
        editedAt: new Date(),
      });

      await auditLog(req, "UPDATE", "notes", id, req.body);

      res.json(updatedNote);
    } catch (error) {
      console.error("Error updating note:", error);
      res.status(400).json({ error: "Failed to update note" });
    }
  });

  // DELETE /api/notes/:id - Soft delete a note
  app.delete("/api/notes/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { deleteReason } = req.body;

      if (!deleteReason) {
        return res.status(400).json({ error: "Delete reason is required" });
      }

      await storage.deleteNote(id, deleteReason, req.user.id);

      await auditLog(req, "DELETE", "notes", id, { deleteReason });

      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(400).json({ error: "Failed to delete note" });
    }
  });

  // POST /api/notes/:id/pin - Pin a note
  app.post("/api/notes/:id/pin", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.pinNote(id);

      await auditLog(req, "PIN", "notes", id);

      res.json({ message: "Note pinned successfully" });
    } catch (error) {
      console.error("Error pinning note:", error);
      res.status(400).json({ error: "Failed to pin note" });
    }
  });

  // DELETE /api/notes/:id/pin - Unpin a note
  app.delete("/api/notes/:id/pin", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.unpinNote(id);

      await auditLog(req, "UNPIN", "notes", id);

      res.json({ message: "Note unpinned successfully" });
    } catch (error) {
      console.error("Error unpinning note:", error);
      res.status(400).json({ error: "Failed to unpin note" });
    }
  });

  // GET /api/notes/search - Search notes across all entities
  app.get("/api/notes/search", requireAuth, async (req: any, res: any) => {
    try {
      const { query, entityType, visibility } = req.query;

      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const filters: any = {};
      if (entityType) filters.entityType = entityType;
      if (visibility) filters.visibility = visibility;

      const notes = await storage.searchNotes(query as string, filters);
      res.json(notes);
    } catch (error) {
      console.error("Error searching notes:", error);
      res.status(500).json({ error: "Failed to search notes" });
    }
  });

  // Note Tags Routes
  // GET /api/note-tags - Get all tags
  app.get("/api/note-tags", requireAuth, async (req: any, res: any) => {
    try {
      const tags = await storage.getNoteTags();
      res.json(tags);
    } catch (error) {
      console.error("Error fetching note tags:", error);
      res.status(500).json({ error: "Failed to fetch note tags" });
    }
  });

  // POST /api/note-tags - Create a new tag
  app.post("/api/note-tags", requireAuth, async (req: any, res: any) => {
    try {
      const validatedData = insertNoteTagSchema.parse(req.body);
      const tag = await storage.createNoteTag(validatedData);

      await auditLog(req, "CREATE", "note-tags", tag.id, { name: tag.name });

      res.status(201).json(tag);
    } catch (error) {
      console.error("Error creating note tag:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid tag data", details: error.errors });
      } else {
        res.status(400).json({ error: "Failed to create note tag" });
      }
    }
  });

  // POST /api/notes/:noteId/tags/:tagId - Assign tag to note
  app.post("/api/notes/:noteId/tags/:tagId", requireAuth, async (req: any, res: any) => {
    try {
      const { noteId, tagId } = req.params;
      await storage.assignTagToNote(noteId, tagId);

      await auditLog(req, "ASSIGN_TAG", "notes", noteId, { tagId });

      res.status(201).json({ message: "Tag assigned successfully" });
    } catch (error) {
      console.error("Error assigning tag to note:", error);
      res.status(400).json({ error: "Failed to assign tag to note" });
    }
  });

  // DELETE /api/notes/:noteId/tags/:tagId - Remove tag from note
  app.delete("/api/notes/:noteId/tags/:tagId", requireAuth, async (req: any, res: any) => {
    try {
      const { noteId, tagId } = req.params;
      await storage.removeTagFromNote(noteId, tagId);

      await auditLog(req, "REMOVE_TAG", "notes", noteId, { tagId });

      res.json({ message: "Tag removed successfully" });
    } catch (error) {
      console.error("Error removing tag from note:", error);
      res.status(400).json({ error: "Failed to remove tag from note" });
    }
  });

  // Note Mentions Routes
  // POST /api/notes/:noteId/mentions - Create a mention
  app.post("/api/notes/:noteId/mentions", requireAuth, async (req: any, res: any) => {
    try {
      const { noteId } = req.params;
      const validatedData = insertNoteMentionSchema.parse({
        noteId,
        ...req.body,
      });

      const mention = await storage.createNoteMention(validatedData);

      await auditLog(req, "CREATE", "note-mentions", mention.id, {
        noteId,
        userId: mention.userId,
      });

      res.status(201).json(mention);
    } catch (error) {
      console.error("Error creating note mention:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid mention data", details: error.errors });
      } else {
        res.status(400).json({ error: "Failed to create note mention" });
      }
    }
  });

  // GET /api/notes/:noteId/mentions - Get note mentions
  app.get("/api/notes/:noteId/mentions", requireAuth, async (req: any, res: any) => {
    try {
      const { noteId } = req.params;
      const mentions = await storage.getNoteMentions(noteId);
      res.json(mentions);
    } catch (error) {
      console.error("Error fetching note mentions:", error);
      res.status(500).json({ error: "Failed to fetch note mentions" });
    }
  });

  // PATCH /api/note-mentions/:id/read - Mark mention as read
  app.patch("/api/note-mentions/:id/read", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.markMentionRead(id);

      await auditLog(req, "MARK_READ", "note-mentions", id);

      res.json({ message: "Mention marked as read" });
    } catch (error) {
      console.error("Error marking mention as read:", error);
      res.status(400).json({ error: "Failed to mark mention as read" });
    }
  });

  // Note Reactions Routes
  // POST /api/notes/:noteId/reactions - Add a reaction
  app.post("/api/notes/:noteId/reactions", requireAuth, async (req: any, res: any) => {
    try {
      const { noteId } = req.params;
      const validatedData = insertNoteReactionSchema.parse({
        noteId,
        userId: req.user.id,
        emoji: req.body.emoji,
      });

      const reaction = await storage.addReaction(validatedData);

      await auditLog(req, "CREATE", "note-reactions", reaction.id, {
        noteId,
        emoji: reaction.emoji,
      });

      res.status(201).json(reaction);
    } catch (error) {
      console.error("Error adding note reaction:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid reaction data", details: error.errors });
      } else {
        res.status(400).json({ error: "Failed to add note reaction" });
      }
    }
  });

  // DELETE /api/notes/:noteId/reactions - Remove a reaction
  app.delete("/api/notes/:noteId/reactions", requireAuth, async (req: any, res: any) => {
    try {
      const { noteId } = req.params;
      const { userId, emoji } = req.body;

      if (!userId || !emoji) {
        return res.status(400).json({ error: "userId and emoji are required" });
      }

      await storage.removeReaction(noteId, userId, emoji);

      await auditLog(req, "DELETE", "note-reactions", noteId, { userId, emoji });

      res.json({ message: "Reaction removed successfully" });
    } catch (error) {
      console.error("Error removing note reaction:", error);
      res.status(400).json({ error: "Failed to remove note reaction" });
    }
  });

  // GET /api/notes/:noteId/reactions - Get note reactions
  app.get("/api/notes/:noteId/reactions", requireAuth, async (req: any, res: any) => {
    try {
      const { noteId } = req.params;
      const reactions = await storage.getNoteReactions(noteId);
      res.json(reactions);
    } catch (error) {
      console.error("Error fetching note reactions:", error);
      res.status(500).json({ error: "Failed to fetch note reactions" });
    }
  });

  // Note Attachments Routes
  // POST /api/notes/:noteId/attachments - Upload an attachment
  app.post("/api/notes/:noteId/attachments", requireAuth, upload.array('files', 10), async (req: any, res: any) => {
    try {
      const { noteId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const objectStorage = new ObjectStorageService();
      const attachments = [];

      for (const file of files) {
        const storagePath = await objectStorage.saveAttachment(
          file.originalname,
          file.buffer,
          file.mimetype
        );

        const attachment = await storage.createNoteAttachment({
          noteId,
          fileName: file.originalname,
          filePath: storagePath,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedBy: req.user.id,
        });

        attachments.push(attachment);
      }

      await auditLog(req, "UPLOAD", "note-attachments", noteId, {
        count: attachments.length,
      });

      res.status(201).json(attachments);
    } catch (error) {
      console.error("Error uploading note attachments:", error);
      res.status(400).json({ error: "Failed to upload note attachments" });
    }
  });

  // GET /api/notes/:noteId/attachments - Get note attachments
  app.get("/api/notes/:noteId/attachments", requireAuth, async (req: any, res: any) => {
    try {
      const { noteId } = req.params;
      const attachments = await storage.getNoteAttachments(noteId);
      res.json(attachments);
    } catch (error) {
      console.error("Error fetching note attachments:", error);
      res.status(500).json({ error: "Failed to fetch note attachments" });
    }
  });

  // DELETE /api/note-attachments/:id - Delete an attachment
  app.delete("/api/note-attachments/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.deleteNoteAttachment(id);

      await auditLog(req, "DELETE", "note-attachments", id);

      res.json({ message: "Attachment deleted successfully" });
    } catch (error) {
      console.error("Error deleting note attachment:", error);
      res.status(400).json({ error: "Failed to delete note attachment" });
    }
  });

  // Note Follow-ups Routes
  // POST /api/notes/:noteId/followups - Create a follow-up (also creates a Todo)
  app.post("/api/notes/:noteId/followups", requireAuth, async (req: any, res: any) => {
    try {
      const { noteId } = req.params;
      const note = await storage.getNote(noteId);

      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }

      const validatedData = insertNoteFollowupSchema.parse({
        noteId,
        ...req.body,
      });

      // Convert dueAt to Date if it's a string
      if (typeof validatedData.dueAt === 'string') {
        validatedData.dueAt = new Date(validatedData.dueAt);
      }

      // Create the Todo first
      const todo = await storage.createTodo({
        title: req.body.todoTitle || `Follow-up: ${note.content.substring(0, 50)}...`,
        description: req.body.todoDescription || note.content,
        category: "other",
        assignedUserId: validatedData.assigneeId,
        createdBy: req.user.id,
        status: "todo",
        priority: "medium",
        dueDate: validatedData.dueAt,
      });

      // Create the NoteFollowup with the Todo link
      const followup = await storage.createNoteFollowup({
        ...validatedData,
        todoId: todo.id,
      });

      await auditLog(req, "CREATE", "note-followups", followup.id, {
        noteId,
        todoId: todo.id,
      });

      res.status(201).json({ followup, todo });
    } catch (error) {
      console.error("Error creating note followup:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid followup data", details: error.errors });
      } else {
        res.status(400).json({ error: "Failed to create note followup" });
      }
    }
  });

  // GET /api/notes/:noteId/followups - Get note follow-ups
  app.get("/api/notes/:noteId/followups", requireAuth, async (req: any, res: any) => {
    try {
      const { noteId } = req.params;
      const followups = await storage.getNoteFollowups(noteId);
      res.json(followups);
    } catch (error) {
      console.error("Error fetching note followups:", error);
      res.status(500).json({ error: "Failed to fetch note followups" });
    }
  });

  // Note Revisions Routes
  // GET /api/notes/:noteId/revisions - Get note edit history
  app.get("/api/notes/:noteId/revisions", requireAuth, async (req: any, res: any) => {
    try {
      const { noteId } = req.params;
      const revisions = await storage.getNoteRevisions(noteId);
      res.json(revisions);
    } catch (error) {
      console.error("Error fetching note revisions:", error);
      res.status(500).json({ error: "Failed to fetch note revisions" });
    }
  });

  // Note Templates Routes
  // GET /api/note-templates - Get all templates
  app.get("/api/note-templates", requireAuth, async (req: any, res: any) => {
    try {
      const { entityType } = req.query;
      const templates = await storage.getNoteTemplates(entityType as string);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching note templates:", error);
      res.status(500).json({ error: "Failed to fetch note templates" });
    }
  });

  // POST /api/note-templates - Create a template
  app.post("/api/note-templates", requireAuth, async (req: any, res: any) => {
    try {
      const validatedData = insertNoteTemplateSchema.parse({
        ...req.body,
        createdBy: req.user.id,
      });

      const template = await storage.createNoteTemplate(validatedData);

      await auditLog(req, "CREATE", "note-templates", template.id, {
        name: template.name,
      });

      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating note template:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid template data", details: error.errors });
      } else {
        res.status(400).json({ error: "Failed to create note template" });
      }
    }
  });

  // PATCH /api/note-templates/:id - Update a template
  app.patch("/api/note-templates/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const template = await storage.updateNoteTemplate(id, req.body);

      await auditLog(req, "UPDATE", "note-templates", id, req.body);

      res.json(template);
    } catch (error) {
      console.error("Error updating note template:", error);
      res.status(400).json({ error: "Failed to update note template" });
    }
  });

  // DELETE /api/note-templates/:id - Delete a template
  app.delete("/api/note-templates/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.deleteNoteTemplate(id);

      await auditLog(req, "DELETE", "note-templates", id);

      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Error deleting note template:", error);
      res.status(400).json({ error: "Failed to delete note template" });
    }
  });

  // Note Links Routes
  // GET /api/notes/:noteId/links - Get note smart links
  app.get("/api/notes/:noteId/links", requireAuth, async (req: any, res: any) => {
    try {
      const { noteId } = req.params;
      const links = await storage.getNoteLinks(noteId);
      res.json(links);
    } catch (error) {
      console.error("Error fetching note links:", error);
      res.status(500).json({ error: "Failed to fetch note links" });
    }
  });

  // ============================================
  // TODO SUBTASKS ROUTES
  // ============================================

  // GET /api/todos/:todoId/subtasks
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

  // POST /api/todos/:todoId/subtasks
  app.post("/api/todos/:todoId/subtasks", requireAuth, async (req: any, res: any) => {
    try {
      const { todoId } = req.params;
      const { title } = req.body;

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

  // PATCH /api/subtasks/:id
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

  // DELETE /api/subtasks/:id
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

  // GET /api/todos/:todoId/attachments
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

  // POST /api/todos/:todoId/attachments
  app.post("/api/todos/:todoId/attachments", requireAuth, upload.single("file"), async (req: any, res: any) => {
    try {
      const { todoId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const storageUrl = await objectStorage.uploadFile(file.buffer, file.originalname, file.mimetype);

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

  // DELETE /api/todos/:todoId/attachments/:attachmentId
  app.delete("/api/todos/:todoId/attachments/:attachmentId", requireAuth, async (req: any, res: any) => {
    try {
      const { attachmentId } = req.params;

      const [attachment] = await db
        .select()
        .from(todoAttachments)
        .where(eq(todoAttachments.id, attachmentId));

      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      await objectStorage.deleteFile(attachment.storageUrl);
      await db.delete(todoAttachments).where(eq(todoAttachments.id, attachmentId));

      res.json({ message: "Attachment deleted successfully" });
    } catch (error) {
      console.error("Error deleting attachment:", error);
      res.status(400).json({ error: "Failed to delete attachment" });
    }
  });

  // ============================================
  // MAIL SYSTEM ROUTES (NEW)
  // ============================================



  // POST /api/mail/refresh - Refresh mails from IMAP
  app.post("/api/mail/refresh", requireAuth, async (req: any, res: any) => {
    try {
      const { force } = req.query;

      // Rate limiting: max 1 refresh per 30s
      const lastRefreshAt = await storage.getSetting('mail_last_refresh_at');
      if (lastRefreshAt && !force) {
        const timeSinceLastRefresh = Date.now() - new Date(lastRefreshAt).getTime();
        if (timeSinceLastRefresh < 30000) {
          return res.status(429).json({
            error: 'Please wait 30 seconds between refreshes',
            retryAfter: Math.ceil((30000 - timeSinceLastRefresh) / 1000)
          });
        }
      }

      // Get IMAP credentials from env
      const imapHost = process.env.IMAP_HOST || 'imap.strato.de';
      const imapPort = parseInt(process.env.IMAP_PORT || '993');
      const imapUser = process.env.IMAP_USER;
      const imapPass = process.env.IMAP_PASS;

      if (!imapUser || !imapPass) {
        return res.status(500).json({ error: 'IMAP credentials not configured' });
      }

      // Connect to IMAP
      const client = new ImapFlow({
        host: process.env.IMAP_HOST || '',
        port: parseInt(process.env.IMAP_PORT || '993'),
        secure: true,
        auth: {
          user: process.env.IMAP_USER || '',
          pass: process.env.IMAP_PASS || ''
        },
        logger: false
      });

      await client.connect();
      const mailbox = await client.mailboxOpen('INBOX');

      // Get last sync timestamp
      const lastSyncAt = await storage.getSetting('mail_last_sync_at');
      const initialSyncDone = await storage.getSetting('mail_initial_sync_done');

      let searchCriteria: any;
      let syncMode: string;

      // Determine sync strategy
      if (force || !initialSyncDone) {
        // Force sync or initial sync: Get last 2000 emails (newest)
        const totalMessages = mailbox.exists;
        if (totalMessages > 0) {
          const startUid = Math.max(1, totalMessages - 1999);
          searchCriteria = `${startUid}:*`;
          syncMode = 'force';
        } else {
          searchCriteria = '1:*';
          syncMode = 'force';
        }
      } else if (lastSyncAt) {
        // Normal refresh: Get emails since last sync date
        const lastSync = new Date(lastSyncAt);
        searchCriteria = { since: lastSync };
        syncMode = 'date-based';
      } else {
        // Fallback: get recent emails
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        searchCriteria = { since: yesterday };
        syncMode = 'date-based';
      }

      let newMailCount = 0;

      // Get UIDs to fetch
      let uidsToFetch: number[];
      if (syncMode === 'date-based') {
        uidsToFetch = await client.search(searchCriteria);
      } else {
        uidsToFetch = [];
      }

      // Fetch emails
      const fetchQuery = uidsToFetch.length > 0 ? uidsToFetch : searchCriteria;

      for await (let msg of client.fetch(fetchQuery, { source: true, uid: true })) {
        try {

          // Check if already exists (deduplication)
          const existing = await storage.getEmailByImapUid(msg.uid);
          if (existing) {
            continue;
          }

          // Parse email
          const parsed = await simpleParser(msg.source);

          // Sanitize HTML (server-side for security)
          const cleanHtml = DOMPurify.sanitize(parsed.html || '', {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'img', 'div', 'span', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style']
          });

          // Save email
          const email = await storage.createEmail({
            subject: parsed.subject || '(No subject)',
            fromName: parsed.from?.value?.[0]?.name || '',
            fromEmail: parsed.from?.value?.[0]?.address || '',
            html: cleanHtml,
            text: parsed.text || '',
            date: parsed.date || new Date(),
            imapUid: msg.uid
          });

          // Save attachments if any
          if (parsed.attachments?.length) {
            const attachmentData = [];

            for (const att of parsed.attachments) {
              // TODO: Save attachment to storage (Supabase or local)
              // For now, just create metadata
              const storagePath = `attachments/${email.id}/${att.filename}`;

              attachmentData.push({
                emailId: email.id,
                filename: att.filename,
                mimeType: att.contentType,
                size: att.size,
                storagePath: storagePath
              });
            }

            if (attachmentData.length > 0) {
              await storage.createEmailAttachmentBulk(attachmentData);
            }
          }

          newMailCount++;
        } catch (parseError) {
          console.error('Failed to parse email:', parseError);
          // Continue with next email
        }
      }

      await client.logout();

      // Update settings with current timestamp
      await storage.setSetting('mail_last_sync_at', new Date().toISOString());
      await storage.setSetting('mail_initial_sync_done', 'true');

      // Keep only last 2000 emails
      await storage.deleteOldEmails(2000);

      res.json({
        success: true,
        newMails: newMailCount,
        lastSync: new Date()
      });

    } catch (error: any) {
      console.error('Mail refresh error:', error);

      if (error.code === 'ETIMEDOUT') {
        return res.status(503).json({ error: 'IMAP server timeout' });
      }

      res.status(500).json({
        error: 'Failed to refresh mails',
        message: error.message
      });
    }
  });

  // GET /api/mail/list - Get emails with cursor pagination
  app.get("/api/mail/list", requireAuth, async (req: any, res: any) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const beforeDate = req.query.before as string; // ISO date
      const beforeId = req.query.beforeId as string; // UUID

      console.log('[MAIL] Pagination request:', { limit, beforeDate, beforeId });

      // Fetch emails
      const emails = await storage.getEmails({
        limit,
        beforeDate,
        beforeId,
        orderBy: 'date DESC'
      });

      console.log('[MAIL] Found emails:', emails.length);

      // Check if there are more by fetching one more
      let hasMore = false;
      if (emails.length === limit) {
        // Fetch one more to see if more exist
        const lastEmail = emails[emails.length - 1];
        const checkMore = await storage.getEmails({
          limit: 1,
          beforeDate: lastEmail.date,
          beforeId: lastEmail.id,
          orderBy: 'date DESC'
        });
        hasMore = checkMore.length > 0;
      }

      console.log('[MAIL] Returning:', { count: emails.length, hasMore });

      // Fetch links for all emails
      const emailsWithLinks = await Promise.all(
        emails.map(async (email: any) => {
          const links = await storage.getEmailLinks(email.id);
          return {
            ...email,
            links: links || []
          };
        })
      );

      res.json({
        emails: emailsWithLinks,
        hasMore
      });
    } catch (error) {
      console.error('Error fetching emails:', error);
      res.status(500).json({ error: 'Failed to fetch emails' });
    }
  });

  // GET /api/mail/:id - Get single email with attachments and links
  app.get("/api/mail/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const email = await storage.getEmail(id);
      if (!email) {
        return res.status(404).json({ error: 'Email not found' });
      }

      const attachments = await storage.getEmailAttachmentsByEmailId(id);
      const links = await storage.getEmailLinks(id);

      res.json({
        ...email,
        attachments,
        links
      });
    } catch (error) {
      console.error('Error fetching email:', error);
      res.status(500).json({ error: 'Failed to fetch email' });
    }
  });

  // GET /api/email-threads - Get emails linked to a case
  app.get("/api/email-threads", requireAuth, async (req: any, res: any) => {
    try {
      const { caseId } = req.query;

      if (!caseId) {
        return res.status(400).json({ error: 'caseId is required' });
      }

      console.log('[EMAIL-THREADS] Fetching emails for caseId:', caseId);

      // Get all email links for this case
      const links = await db.select()
        .from(emailLinks)
        .where(and(
          eq(emailLinks.entityType, 'case'),
          eq(emailLinks.entityId, caseId)
        ));

      console.log('[EMAIL-THREADS] Found', links.length, 'links');

      // Fetch the actual emails
      const emailIds = links.map(link => link.emailId);

      if (emailIds.length === 0) {
        return res.json([]);
      }

      const emailsData = await Promise.all(
        emailIds.map(async (emailId) => {
          const email = await storage.getEmail(emailId);
          return email;
        })
      );

      // Filter out any null results and format as email threads
      const emails = emailsData
        .filter(e => e !== null && e !== undefined)
        .map(email => ({
          id: email!.id,
          subject: email!.subject || '(No subject)',
          customerEmail: email!.fromEmail || 'Unknown',
          isUnread: false,
          createdAt: email!.createdAt
        }));

      console.log('[EMAIL-THREADS] Returning', emails.length, 'emails');

      res.json(emails);
    } catch (error) {
      console.error('[EMAIL-THREADS] Error fetching email threads:', error);
      res.status(500).json({ error: 'Failed to fetch email threads' });
    }
  });

  // DELETE /api/cases/:caseId/emails/:emailId - Unlink email from case
  app.delete("/api/cases/:caseId/emails/:emailId", requireAuth, async (req: any, res: any) => {
    try {
      const { caseId, emailId } = req.params;

      if (!caseId || !emailId) {
        return res.status(400).json({ error: 'caseId and emailId are required' });
      }

      console.log('[UNLINK-EMAIL] Unlinking email', emailId, 'from case', caseId);

      // Delete from email_links
      await db.delete(emailLinks)
        .where(and(
          eq(emailLinks.entityType, 'case'),
          eq(emailLinks.entityId, caseId),
          eq(emailLinks.emailId, emailId)
        ));

      res.json({ message: 'Email unlinked successfully' });
    } catch (error) {
      console.error('[UNLINK-EMAIL] Error unlinking email:', error);
      res.status(500).json({ error: 'Failed to unlink email' });
    }
  });


  // DELETE /api/mail/links/:id - Delete an email link
  app.delete("/api/mail/links/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: 'Link ID is required' });
      }

      console.log('[MAIL] Deleting link:', id);

      await db.delete(emailLinks).where(eq(emailLinks.id, id));

      res.json({ message: 'Link deleted successfully' });
    } catch (error) {
      console.error('[MAIL] Error deleting link:', error);
      res.status(500).json({ error: 'Failed to delete link' });
    }
  });

  // POST /api/mail/link - Link email to entity (order/case/return/repair)
  app.post("/api/mail/link", requireAuth, async (req: any, res: any) => {
    try {
      const { emailId, entityType, entityId } = req.body;

      if (!emailId || !entityType || !entityId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const link = await storage.createEmailLink({
        emailId,
        entityType,
        entityId
      });

      await auditLog(req, "LINK", "email_links", link.id, {
        emailId,
        entityType,
        entityId
      });

      res.status(201).json({ link });
    } catch (error) {
      console.error('Error linking email:', error);
      res.status(400).json({ error: 'Failed to link email' });
    }
  });

  // POST /api/mail/threads/:id/link - Link email thread to entity (alternative endpoint format)
  app.post("/api/mail/threads/:id/link", requireAuth, async (req: any, res: any) => {
    try {
      const { id: emailId } = req.params;
      const { type: entityType, entityId } = req.body;

      if (!emailId || !entityType || !entityId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const link = await storage.createEmailLink({
        emailId,
        entityType,
        entityId
      });

      await auditLog(req, "LINK", "email_links", link.id, {
        emailId,
        entityType,
        entityId
      });

      res.status(201).json({ link });
    } catch (error) {
      console.error('Error linking email:', error);
      res.status(400).json({ error: 'Failed to link email' });
    }
  });

  // GET /api/mail/attachments/:id/download - Download attachment
  app.get("/api/mail/attachments/:id/download", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      // Get attachment metadata
      const attachments = await db.select()
        .from(emailAttachments)
        .where(eq(emailAttachments.id, id))
        .limit(1);

      if (attachments.length === 0) {
        return res.status(404).json({ error: 'Attachment not found' });
      }

      const attachment = attachments[0];

      // TODO: In production, retrieve actual file from storage
      // For now, return a placeholder response with metadata
      res.json({
        message: 'Attachment download not yet implemented',
        attachment: {
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          size: attachment.size,
          storagePath: attachment.storagePath
        },
        note: 'File storage integration needed (Supabase Storage or local filesystem)'
      });

      // Future implementation would be:
      // const fileBuffer = await objectStorage.getAttachment(attachment.storagePath);
      // res.setHeader('Content-Type', attachment.mimeType);
      // res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
      // res.send(fileBuffer);

    } catch (error) {
      console.error('Error downloading attachment:', error);
      res.status(500).json({ error: 'Failed to download attachment' });
    }
  });

  // POST /api/shopify/sync-returns - Sync returns from Shopify
  app.post("/api/shopify/sync-returns", async (req: any, res: any) => {
    // Allow internal calls (from scheduled sync) without auth
    const isInternalCall = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';

    if (!isInternalCall && !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      console.log('🔄 Starting Shopify returns sync via API request');

      const { syncShopifyReturns } = await import('./services/shopifyReturnsSync');

      // Check for fullSync parameter (one-time fetch of ALL returns)
      const fullSync = req.query.fullSync === 'true';

      let processedCount = 0;
      let totalCount = 0;
      let currentMessage = '';


      const result = await syncShopifyReturns(storage, (current, total, message) => {
        processedCount = current;
        totalCount = total || processedCount;
        currentMessage = message;
        console.log(`Progress: ${message}`);
      }, fullSync);

      if (isInternalCall || req.user) {
        await auditLog(req, "SYNC", "shopify_returns", null, {
          ...result,
          source: isInternalCall ? 'scheduled' : 'manual'
        });
      }

      res.json({
        success: true,
        ...result,
        message: `${result.created} nieuwe returns geïmporteerd, ${result.updated} bijgewerkt`
      });
    } catch (error: any) {
      console.error('Error syncing Shopify returns:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to sync Shopify returns'
      });
    }
  });

  // POST /api/shopify/webhooks/returns - Webhook endpoint for Shopify returns
  app.post('/api/shopify/webhooks/returns', express.raw({ type: 'application/json' }), async (req: any, res: any) => {
    try {
      const { validateShopifyWebhook, getWebhookTopic, getWebhookShop } = await import('./services/shopifyWebhookValidator');

      // Get webhook secret from environment
      const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('❌ SHOPIFY_WEBHOOK_SECRET not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }

      // Log webhook receipt
      const topic = getWebhookTopic(req);
      const shop = getWebhookShop(req);
      console.log('📨 Received Shopify webhook:', { topic, shop });

      // Validate HMAC signature
      if (!validateShopifyWebhook(req, webhookSecret)) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Parse the body (it's raw buffer from express.raw())
      const payload = JSON.parse(req.body.toString('utf8'));

      console.log('✅ Webhook validated successfully', {
        topic,
        returnId: payload.id,
        returnName: payload.name
      });

      // Process webhook asynchronously (don't block response)
      setImmediate(async () => {
        try {
          const { processReturnWebhook } = await import('./services/shopifyReturnsWebhookProcessor');
          const result = await processReturnWebhook(payload.id, storage);

          if (result.success) {
            console.log(`✅ Webhook processed successfully: ${result.returnNumber}`);
          } else {
            console.error(`❌ Webhook processing failed: ${result.error}`);
          }
        } catch (error) {
          console.error('❌ Error processing return webhook:', error);
        }
      });

      // Respond immediately to Shopify
      res.status(200).json({ received: true });

    } catch (error: any) {
      console.error('❌ Webhook error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
