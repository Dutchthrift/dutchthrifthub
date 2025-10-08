import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { storage } from "./storage";
import { insertTodoSchema, insertRepairSchema, insertInternalNoteSchema, insertPurchaseOrderSchema, insertCaseSchema, insertUserSchema, insertAuditLogSchema } from "@shared/schema";
import { syncEmails, sendEmail } from "./services/emailService";
import { shopifyClient } from "./services/shopifyClient";
import { OrderMatchingService } from "./services/orderMatchingService";
import { ObjectStorageService } from "./objectStorage";
import multer from "multer";
import Papa from "papaparse";

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
    req.session.destroy(() => {});
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
          endpoint: req.path
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        success: false,
        errorMessage: "Insufficient permissions"
      });

      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
};

// Audit logging helper
const auditLog = async (req: any, action: string, resource: string, resourceId?: string, details?: any) => {
  if (req.user) {
    await storage.createAuditLog({
      userId: req.user.id,
      action,
      resource,
      resourceId,
      details,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      success: true
    });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize order matching service
  const orderMatchingService = new OrderMatchingService(storage);
  
  // Configure multer for file uploads (memory storage for CSV)
  const upload = multer({ storage: multer.memoryStorage() });

  // Authentication routes
  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
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
          errorMessage: "Invalid credentials"
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
          errorMessage: "Invalid credentials"
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
        success: true
      });

      const { password: _, ...userWithoutPassword } = user;
      res.json({ 
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName
        }
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
        req.session.destroy(() => {});
        return res.status(401).json({ error: "User not found" });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName
        }
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
      const safeUsers = users.map(user => {
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
      const userList = users.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }));
      
      res.json(userList);
    } catch (error) {
      console.error("Error fetching user list:", error);
      res.status(500).json({ error: "Failed to fetch user list" });
    }
  });

  app.post("/api/users", requireAuth, requireRole(["ADMIN"]), async (req: any, res: any) => {
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
      const username = userData.email.split('@')[0];
      
      const newUser = await storage.createUser({
        ...userData,
        password: hashedPassword,
        username
      });

      await auditLog(req, "CREATE", "users", newUser.id, { email: newUser.email, role: newUser.role });

      const { password, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error: unknown) {
      console.error("Error creating user:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid user data", details: error.errors });
      } else if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        res.status(409).json({ error: "Email or username already exists" });
      } else {
        res.status(400).json({ error: "Failed to create user" });
      }
    }
  });

  app.patch("/api/users/:id", requireAuth, requireRole(["ADMIN"]), async (req: any, res: any) => {
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
        res.status(400).json({ error: "Invalid update data", details: error.errors });
      } else if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        res.status(409).json({ error: "Email already exists" });
      } else {
        res.status(500).json({ error: "Failed to update user" });
      }
    }
  });

  app.delete("/api/users/:id", requireAuth, requireRole(["ADMIN"]), async (req: any, res: any) => {
    try {
      const { id } = req.params;

      // Validate that user exists and is not the current user
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (id === req.user.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      await storage.deleteUser(id);
      await auditLog(req, "DELETE", "users", id, { email: existingUser.email });

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

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
        const relatedItems = await storage.getCaseRelatedItems(caseId as string);
        let todos = relatedItems.todos;
        
        // Apply role-based filtering even for case-linked todos
        if (req.user.role === 'TECHNICUS') {
          // TECHNICUS only sees their own tasks
          todos = todos.filter((todo: any) => todo.assignedUserId === req.user.id);
        }
        // ADMIN and SUPPORT can see all case-linked todos
        
        res.json(todos);
      } else {
        // Role-based filtering
        let todos: any[];
        
        if (req.user.role === 'ADMIN' || req.user.role === 'SUPPORT') {
          // ADMIN and SUPPORT see all tasks or filtered by userId if provided
          todos = await storage.getTodos(userId as string);
        } else if (req.user.role === 'TECHNICUS') {
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
      if (validatedData.dueDate && typeof validatedData.dueDate === 'string') {
        validatedData.dueDate = new Date(validatedData.dueDate);
      }
      
      const todo = await storage.createTodo(validatedData);
      
      // Create activity
      await storage.createActivity({
        type: "todo_created",
        description: `Created todo: ${todo.title}`,
        userId: todo.assignedUserId,
        metadata: { todoId: todo.id }
      });

      await auditLog(req, "CREATE", "todos", todo.id, { title: todo.title, category: todo.category });

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
        category: z.enum(["orders", "purchasing", "marketing", "admin", "other"]).optional(),
        assignedUserId: z.string().optional(),
        status: z.enum(["todo", "in_progress", "done"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        dueDate: z.union([z.string().datetime(), z.date(), z.null()]).optional(),
        completedAt: z.union([z.string().datetime(), z.date(), z.null()]).optional(),
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
      if (updateData.dueDate && typeof updateData.dueDate === 'string') {
        updateData.dueDate = new Date(updateData.dueDate);
      }
      if (updateData.completedAt && typeof updateData.completedAt === 'string') {
        updateData.completedAt = new Date(updateData.completedAt);
      }
      
      const todo = await storage.updateTodo(id, updateData);
      
      if (req.body.status === 'done') {
        await storage.createActivity({
          type: "todo_completed",
          description: `Completed todo: ${todo.title}`,
          userId: todo.assignedUserId,
          metadata: { todoId: todo.id }
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
      const { caseId, status, technicianId, startDate, endDate, priority } = req.query;
      
      if (caseId) {
        // Get repairs linked to a specific case
        const relatedItems = await storage.getCaseRelatedItems(caseId as string);
        
        // TECHNICUS role: only see own repairs
        const filteredRepairs = req.user.role === 'TECHNICUS' 
          ? relatedItems.repairs.filter((repair: any) => repair.assignedUserId === req.user.id)
          : relatedItems.repairs;
        
        res.json(filteredRepairs);
        return;
      }
      
      // Define filter schema for validation
      const filterSchema = z.object({
        status: z.enum(['new', 'diagnosing', 'waiting_parts', 'repair_in_progress', 'quality_check', 'completed', 'returned', 'canceled']).optional(),
        technicianId: z.string().uuid().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      });
      
      // Validate query parameters
      const validationResult = filterSchema.safeParse({ status, technicianId, priority, startDate, endDate });
      
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid filter parameters", errors: validationResult.error.errors });
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
      if (validatedFilters.technicianId) filters.technicianId = validatedFilters.technicianId;
      if (validatedFilters.priority) filters.priority = validatedFilters.priority;
      if (validatedFilters.startDate) filters.startDate = new Date(validatedFilters.startDate);
      if (validatedFilters.endDate) filters.endDate = new Date(validatedFilters.endDate);
      
      // TECHNICUS role: only see own repairs
      if (req.user.role === 'TECHNICUS') {
        filters.technicianId = req.user.id;
      }
      
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
      
      // TECHNICUS can only view own repairs
      if (req.user.role === 'TECHNICUS' && repair.assignedUserId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to view this repair" });
      }
      
      res.json(repair);
    } catch (error) {
      console.error("Error fetching repair:", error);
      res.status(500).json({ message: "Failed to fetch repair" });
    }
  });

  app.post("/api/repairs", requireAuth, requireRole(["ADMIN", "SUPPORT", "TECHNICUS"]), async (req: any, res) => {
    try {
      // Handle date conversion before validation
      const requestData = { ...req.body };
      if (requestData.slaDeadline && typeof requestData.slaDeadline === 'string') {
        requestData.slaDeadline = new Date(requestData.slaDeadline);
      }
      
      const validatedData = insertRepairSchema.parse(requestData);
      const repair = await storage.createRepair(validatedData);
      
      await storage.createActivity({
        type: "repair_created",
        description: `Created repair: ${repair.title}`,
        userId: req.user.id,
        metadata: { repairId: repair.id }
      });

      await auditLog(req, "CREATE", "repairs", repair.id, validatedData);

      res.status(201).json(repair);
    } catch (error) {
      console.error("Error creating repair:", error);
      res.status(400).json({ message: "Failed to create repair" });
    }
  });

  app.patch("/api/repairs/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get existing repair to check permissions
      const existingRepair = await storage.getRepair(id);
      if (!existingRepair) {
        return res.status(404).json({ message: "Repair not found" });
      }
      
      // TECHNICUS can only edit own repairs
      if (req.user.role === 'TECHNICUS' && existingRepair.assignedUserId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to edit this repair" });
      }
      
      const repair = await storage.updateRepair(id, req.body);
      
      if (req.body.status) {
        await storage.createActivity({
          type: "repair_status_updated",
          description: `Updated repair status to ${req.body.status}: ${repair.title}`,
          userId: req.user.id,
          metadata: { repairId: repair.id, status: req.body.status }
        });
      }

      await auditLog(req, "UPDATE", "repairs", id, req.body);

      res.json(repair);
    } catch (error) {
      console.error("Error updating repair:", error);
      res.status(400).json({ message: "Failed to update repair" });
    }
  });

  // Upload files (photos/attachments) to a repair
  app.post("/api/repairs/:id/upload", requireAuth, upload.array('files', 10), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { type } = req.body; // 'photo' or 'attachment'
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files provided" });
      }

      const repair = await storage.getRepair(id);
      if (!repair) {
        return res.status(404).json({ message: "Repair not found" });
      }
      
      // TECHNICUS can only upload to own repairs
      if (req.user.role === 'TECHNICUS' && repair.assignedUserId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to upload files to this repair" });
      }

      const objectStorage = new ObjectStorageService();
      const uploadedUrls: string[] = [];

      for (const file of files) {
        const filename = `repair-${id}-${type}-${Date.now()}-${file.originalname}`;
        const url = await objectStorage.saveAttachment(filename, file.buffer, file.mimetype);
        uploadedUrls.push(url);
      }

      // Update repair with new file URLs
      const currentFiles = type === 'photo' ? (repair.photos || []) : (repair.attachments || []);
      const updatedFiles = [...currentFiles, ...uploadedUrls];

      await storage.updateRepair(id, {
        [type === 'photo' ? 'photos' : 'attachments']: updatedFiles
      });

      res.json({ urls: uploadedUrls });
    } catch (error) {
      console.error("Error uploading files to repair:", error);
      res.status(500).json({ message: "Failed to upload files" });
    }
  });

  // Create sample repairs for testing
  app.post("/api/repairs/create-samples", async (req, res) => {
    try {
      const sampleRepairs = [
        {
          title: "iPhone 12 Screen Replacement",
          description: "Customer dropped device, screen completely shattered. Screen replacement needed.",
          status: "new" as const,
          priority: "high" as const,
          estimatedCost: 15000, // €150.00
          partsNeeded: ["iPhone 12 Screen", "Screen Adhesive"],
          slaDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
        },
        {
          title: "MacBook Air M1 Battery Issue",
          description: "Battery not holding charge. Diagnostic required to determine replacement necessity.",
          status: "in_progress" as const,
          priority: "medium" as const,
          estimatedCost: 18000, // €180.00
          partsNeeded: ["MacBook Air M1 Battery"],
          slaDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
        },
        {
          title: "Samsung Galaxy S21 Water Damage",
          description: "Device exposed to water, not powering on. Full diagnostic and cleaning required.",
          status: "waiting_customer" as const,
          priority: "urgent" as const,
          estimatedCost: 25000, // €250.00
          partsNeeded: ["Cleaning Kit", "Possibly Motherboard"],
          slaDeadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // 1 day from now
        },
        {
          title: "iPad Pro Charging Port Repair",
          description: "Charging port loose, device charges intermittently. Port replacement needed.",
          status: "ready" as const,
          priority: "medium" as const,
          estimatedCost: 8000, // €80.00
          partsNeeded: ["iPad Pro Charging Port"],
          slaDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
        },
        {
          title: "PS5 Controller Stick Drift",
          description: "Left analog stick drifting, affecting gaming experience. Stick module replacement.",
          status: "closed" as const,
          priority: "low" as const,
          estimatedCost: 3500, // €35.00
          actualCost: 3500,
          partsNeeded: ["PS5 Analog Stick Module"],
          completedAt: new Date()
        }
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
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      res.json({ created, results, message: `Created ${created} sample repairs` });
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
        const relatedItems = await storage.getCaseRelatedItems(caseId as string);
        res.json(relatedItems.orders);
      } else if (page) {
        // Get paginated orders with total count and optional search
        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 20;
        const searchQuery = search as string;
        const result = await storage.getOrdersPaginated(pageNum, limitNum, searchQuery);
        res.json(result);
      } else {
        // Get all orders with optional limit for dropdowns (default 20 for UI performance)
        const limitNum = req.query.limit ? parseInt(req.query.limit as string) : 20;
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
      const totalAmount = allOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      
      const stats = {
        total: allOrders.length,
        totalAmount: totalAmount, // Total monetary amount in cents
        pending: allOrders.filter(o => o.status === 'pending').length,
        processing: allOrders.filter(o => o.status === 'processing').length,
        shipped: allOrders.filter(o => o.status === 'shipped').length,
        delivered: allOrders.filter(o => o.status === 'delivered').length,
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
      const response = await fetch(`${process.env.SHOPIFY_SHOP_DOMAIN ? 
        `https://${process.env.SHOPIFY_SHOP_DOMAIN.replace('.myshopify.com', '')}.myshopify.com` : 
        'https://shambu-nl.myshopify.com'
      }/admin/api/2024-01/shop.json`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_PASSWORD || ''
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: 'Shopify connection failed',
          status: response.status,
          message: errorText,
          credentials: {
            hasToken: !!(process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_PASSWORD),
            tokenLength: (process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_PASSWORD || '').length,
            shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || 'shambu-nl.myshopify.com'
          }
        });
      }
      
      const shopInfo = await response.json();
      res.json({
        success: true,
        shop: shopInfo.shop?.name || 'Connected',
        domain: shopInfo.shop?.myshopify_domain,
        message: 'Shopify connection successful'
      });
    } catch (error) {
      console.error('Shopify test error:', error);
      res.status(500).json({
        error: 'Shopify test failed',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Full sync endpoint for importing ALL data from Shopify
  app.post("/api/shopify/sync-all", async (req, res) => {
    try {
      console.log('🚀 Starting full Shopify sync - importing ALL customers and orders...');
      
      let customerStats = { synced: 0, created: 0, updated: 0, skipped: 0, total: 0 };
      let orderStats = { synced: 0, created: 0, updated: 0, skipped: 0, total: 0 };
      let errors: string[] = [];

      // Step 1: Sync all customers
      try {
        console.log('👥 Step 1/2: Syncing all customers from Shopify...');
        const shopifyCustomers = await shopifyClient.getAllCustomers((processed) => {
          console.log(`📊 Customer sync progress: ${processed} customers processed`);
        });
        
        console.log(`Processing ${shopifyCustomers.length} customers...`);
        
        for (const shopifyCustomer of shopifyCustomers) {
          try {
            if (!shopifyCustomer.email) {
              customerStats.skipped++;
              continue;
            }
            
            const existingCustomer = await storage.getCustomerByEmail(shopifyCustomer.email);
            
            if (!existingCustomer) {
              await storage.createCustomer({
                email: shopifyCustomer.email,
                firstName: shopifyCustomer.first_name || null,
                lastName: shopifyCustomer.last_name || null,
                phone: shopifyCustomer.phone || null,
                shopifyCustomerId: shopifyCustomer.id.toString()
              });
              customerStats.created++;
            } else if (!existingCustomer.shopifyCustomerId || existingCustomer.shopifyCustomerId !== shopifyCustomer.id.toString()) {
              await storage.updateCustomer(existingCustomer.id, {
                shopifyCustomerId: shopifyCustomer.id.toString(),
                phone: shopifyCustomer.phone || existingCustomer.phone,
                firstName: shopifyCustomer.first_name || existingCustomer.firstName,
                lastName: shopifyCustomer.last_name || existingCustomer.lastName
              });
              customerStats.updated++;
            }
            customerStats.synced++;
          } catch (customerError) {
            console.error(`Error processing customer ${shopifyCustomer.id}:`, customerError);
            customerStats.skipped++;
            errors.push(`Customer ${shopifyCustomer.id}: ${customerError instanceof Error ? customerError.message : String(customerError)}`);
          }
        }
        
        customerStats.total = shopifyCustomers.length;
        console.log(`✅ Customer sync completed: ${customerStats.created} created, ${customerStats.updated} updated, ${customerStats.skipped} skipped from ${customerStats.total} customers`);
        
      } catch (customerSyncError) {
        console.error('Failed to sync customers:', customerSyncError);
        errors.push(`Customer sync failed: ${customerSyncError instanceof Error ? customerSyncError.message : String(customerSyncError)}`);
      }

      // Step 2: Sync all orders
      try {
        console.log('🛒 Step 2/2: Syncing all orders from Shopify...');
        const shopifyOrders = await shopifyClient.getAllOrders((processed) => {
          console.log(`📊 Order sync progress: ${processed} orders processed`);
        });
        
        console.log(`Processing ${shopifyOrders.length} orders...`);
        
        // Map Shopify financial status to our enum values
        const mapShopifyStatus = (financialStatus: string, fulfillmentStatus: string | null) => {
          if (fulfillmentStatus === 'fulfilled') return 'delivered';
          if (fulfillmentStatus === 'partial') return 'shipped';
          if (financialStatus === 'paid' || financialStatus === 'authorized') {
            return fulfillmentStatus === null ? 'processing' : 'shipped';
          }
          if (financialStatus === 'pending') return 'pending';
          if (financialStatus === 'refunded') return 'refunded';
          if (financialStatus === 'voided') return 'cancelled';
          return 'pending';
        };
        
        for (const shopifyOrder of shopifyOrders) {
          try {
            const existingOrder = await storage.getOrderByShopifyId(shopifyOrder.id.toString());
            
            // Handle customer creation/updating first
            let customer = null;
            if (shopifyOrder.customer && shopifyOrder.customer.email) {
              customer = await storage.getCustomerByEmail(shopifyOrder.customer.email);
              if (!customer) {
                try {
                  customer = await storage.createCustomer({
                    email: shopifyOrder.customer.email,
                    firstName: shopifyOrder.customer.first_name,
                    lastName: shopifyOrder.customer.last_name,
                    shopifyCustomerId: shopifyOrder.customer.id.toString()
                  });
                } catch (customerError) {
                  // If customer creation fails due to duplicate, try to get existing customer
                  console.log(`Customer creation failed, attempting to get existing customer: ${shopifyOrder.customer.email}`);
                  customer = await storage.getCustomerByEmail(shopifyOrder.customer.email);
                }
              } else if (!customer.shopifyCustomerId || customer.shopifyCustomerId !== shopifyOrder.customer.id.toString()) {
                // Update existing customer with Shopify ID and any missing data
                try {
                  await storage.updateCustomer(customer.id, {
                    shopifyCustomerId: shopifyOrder.customer.id.toString(),
                    firstName: shopifyOrder.customer.first_name || customer.firstName,
                    lastName: shopifyOrder.customer.last_name || customer.lastName
                  });
                } catch (updateError) {
                  console.log(`Customer update failed: ${updateError instanceof Error ? updateError.message : updateError}`);
                }
              }
            }

            if (!existingOrder) {
              try {
                await storage.createOrder({
                  shopifyOrderId: shopifyOrder.id.toString(),
                  orderNumber: shopifyOrder.order_number,
                  customerId: customer?.id,
                  customerEmail: shopifyOrder.email,
                  totalAmount: Math.round(parseFloat(shopifyOrder.total_price) * 100),
                  currency: shopifyOrder.currency,
                  status: mapShopifyStatus(shopifyOrder.financial_status, shopifyOrder.fulfillment_status),
                  fulfillmentStatus: shopifyOrder.fulfillment_status,
                  paymentStatus: shopifyOrder.financial_status,
                  orderData: shopifyOrder
                });
                orderStats.created++;
              } catch (createError) {
                console.error(`Failed to create order ${shopifyOrder.id}: ${createError instanceof Error ? createError.message : createError}`);
                orderStats.skipped++;
                errors.push(`Order ${shopifyOrder.id}: Failed to create - ${createError instanceof Error ? createError.message : String(createError)}`);
                continue;
              }
            } else {
              try {
                await storage.updateOrder(existingOrder.id, {
                  status: mapShopifyStatus(shopifyOrder.financial_status, shopifyOrder.fulfillment_status),
                  fulfillmentStatus: shopifyOrder.fulfillment_status,
                  paymentStatus: shopifyOrder.financial_status,
                  orderData: shopifyOrder,
                  totalAmount: Math.round(parseFloat(shopifyOrder.total_price) * 100)
                });
                orderStats.updated++;
              } catch (updateError) {
                console.error(`Failed to update order ${shopifyOrder.id}: ${updateError instanceof Error ? updateError.message : updateError}`);
                orderStats.skipped++;
                errors.push(`Order ${shopifyOrder.id}: Failed to update - ${updateError instanceof Error ? updateError.message : String(updateError)}`);
                continue;
              }
            }
            orderStats.synced++;
          } catch (orderError) {
            console.error(`Error processing order ${shopifyOrder.id}:`, orderError);
            orderStats.skipped++;
            errors.push(`Order ${shopifyOrder.id}: ${orderError instanceof Error ? orderError.message : String(orderError)}`);
          }
        }
        
        orderStats.total = shopifyOrders.length;
        console.log(`✅ Order sync completed: ${orderStats.created} created, ${orderStats.updated} updated, ${orderStats.skipped} skipped from ${orderStats.total} orders`);
        
      } catch (orderSyncError) {
        console.error('Failed to sync orders:', orderSyncError);
        errors.push(`Order sync failed: ${orderSyncError instanceof Error ? orderSyncError.message : String(orderSyncError)}`);
      }

      const totalTime = Date.now();
      console.log(`🎉 Full Shopify sync completed! Customer: ${customerStats.created + customerStats.updated} processed, Orders: ${orderStats.created + orderStats.updated} processed`);
      
      res.json({
        success: true,
        customers: customerStats,
        orders: orderStats,
        errors: errors.length > 0 ? errors.slice(0, 10) : [], // Limit error messages
        totalErrors: errors.length,
        message: `Full sync completed: ${customerStats.total} customers and ${orderStats.total} orders processed from Shopify`
      });
      
    } catch (error) {
      console.error('Full Shopify sync failed:', error);
      res.status(500).json({
        success: false,
        error: 'Full sync failed',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Sync customers from Shopify - Enhanced with bulk import
  app.post("/api/customers/sync", async (req, res) => {
    try {
      const { fullSync } = req.query;
      let shopifyCustomers;

      if (fullSync === 'true') {
        console.log('🔄 Starting full customer sync from Shopify...');
        shopifyCustomers = await shopifyClient.getAllCustomers((processed) => {
          console.log(`📊 Customer sync progress: ${processed} customers processed`);
        });
      } else {
        console.log('🔄 Starting incremental customer sync from Shopify...');
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
        
        const existingCustomer = await storage.getCustomerByEmail(shopifyCustomer.email);
        
        if (!existingCustomer) {
          // Create new customer
          await storage.createCustomer({
            email: shopifyCustomer.email,
            firstName: shopifyCustomer.first_name || null,
            lastName: shopifyCustomer.last_name || null,
            phone: shopifyCustomer.phone || null,
            shopifyCustomerId: shopifyCustomer.id.toString()
          });
          created++;
        } else if (!existingCustomer.shopifyCustomerId || existingCustomer.shopifyCustomerId !== shopifyCustomer.id.toString()) {
          // Update existing customer with Shopify ID if missing
          await storage.updateCustomer(existingCustomer.id, {
            shopifyCustomerId: shopifyCustomer.id.toString(),
            phone: shopifyCustomer.phone || existingCustomer.phone,
            firstName: shopifyCustomer.first_name || existingCustomer.firstName,
            lastName: shopifyCustomer.last_name || existingCustomer.lastName
          });
          updated++;
        }
        synced++;
      }
      
      console.log(`✅ Customer sync completed: ${created} created, ${updated} updated, ${skipped} skipped from ${shopifyCustomers.length} Shopify customers`);
      
      res.json({ 
        synced, 
        created, 
        updated,
        skipped,
        total: shopifyCustomers.length,
        message: `Customer sync completed: ${created} created, ${updated} updated, ${skipped} skipped from ${shopifyCustomers.length} Shopify customers` 
      });
    } catch (error) {
      console.error("Error syncing customers from Shopify:", error);
      res.status(500).json({ message: "Failed to sync customers from Shopify", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Sync orders from Shopify - Enhanced with bulk import
  app.post("/api/orders/sync", async (req, res) => {
    try {
      const { fullSync } = req.query;
      let shopifyOrders;

      if (fullSync === 'true') {
        console.log('🔄 Starting full order sync from Shopify...');
        shopifyOrders = await shopifyClient.getAllOrders((processed) => {
          console.log(`📊 Order sync progress: ${processed} orders processed`);
        });
      } else {
        console.log('🔄 Starting incremental order sync from Shopify...');
        shopifyOrders = await shopifyClient.getOrders({ limit: 250 });
      }
      
      let synced = 0;
      let created = 0;
      let updated = 0;
      let skipped = 0;
      
      console.log(`Processing ${shopifyOrders.length} orders...`);
      
      // Map Shopify financial status to our enum values
      const mapShopifyStatus = (financialStatus: string, fulfillmentStatus: string | null) => {
        if (fulfillmentStatus === 'fulfilled') return 'delivered';
        if (fulfillmentStatus === 'partial') return 'shipped';
        if (financialStatus === 'paid' || financialStatus === 'authorized') {
          return fulfillmentStatus === null ? 'processing' : 'shipped';
        }
        if (financialStatus === 'pending') return 'pending';
        if (financialStatus === 'refunded') return 'refunded';
        if (financialStatus === 'voided') return 'cancelled';
        return 'pending'; // default fallback
      };
      
      for (const shopifyOrder of shopifyOrders) {
        try {
          const existingOrder = await storage.getOrderByShopifyId(shopifyOrder.id.toString());
          
          if (!existingOrder) {
            // Create customer if doesn't exist
            let customer = null;
            if (shopifyOrder.customer && shopifyOrder.customer.email) {
              customer = await storage.getCustomerByEmail(shopifyOrder.customer.email);
              if (!customer) {
                customer = await storage.createCustomer({
                  email: shopifyOrder.customer.email,
                  firstName: shopifyOrder.customer.first_name,
                  lastName: shopifyOrder.customer.last_name,
                  shopifyCustomerId: shopifyOrder.customer.id.toString()
                });
              }
            }

            // Create order
            await storage.createOrder({
              shopifyOrderId: shopifyOrder.id.toString(),
              orderNumber: shopifyOrder.order_number,
              customerId: customer?.id,
              customerEmail: shopifyOrder.email,
              totalAmount: Math.round(parseFloat(shopifyOrder.total_price) * 100),
              currency: shopifyOrder.currency,
              status: mapShopifyStatus(shopifyOrder.financial_status, shopifyOrder.fulfillment_status),
              fulfillmentStatus: shopifyOrder.fulfillment_status,
              paymentStatus: shopifyOrder.financial_status,
              orderData: shopifyOrder
            });
            created++;
          } else {
            // Update existing order with latest data from Shopify
            await storage.updateOrder(existingOrder.id, {
              status: mapShopifyStatus(shopifyOrder.financial_status, shopifyOrder.fulfillment_status),
              fulfillmentStatus: shopifyOrder.fulfillment_status,
              paymentStatus: shopifyOrder.financial_status,
              orderData: shopifyOrder,
              totalAmount: Math.round(parseFloat(shopifyOrder.total_price) * 100)
            });
            updated++;
          }
          synced++;
        } catch (orderError) {
          console.error(`Error processing order ${shopifyOrder.id}:`, orderError);
          skipped++;
        }
      }
      
      console.log(`✅ Order sync completed: ${created} created, ${updated} updated, ${skipped} skipped from ${shopifyOrders.length} Shopify orders`);
      
      res.json({ 
        synced, 
        created, 
        updated,
        skipped,
        total: shopifyOrders.length,
        message: `Order sync completed: ${created} created, ${updated} updated, ${skipped} skipped from ${shopifyOrders.length} Shopify orders` 
      });
    } catch (error) {
      console.error("Error syncing orders:", error);
      res.status(500).json({ message: "Failed to sync orders", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // CSV Import endpoint for orders (ADMIN only)
  app.post("/api/orders/import-csv", requireAuth, requireRole(["ADMIN"]), upload.single('file'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log('📂 Starting CSV import...');
      const csvContent = req.file.buffer.toString('utf-8');
      
      // Parse CSV
      const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim()
      });

      if (parseResult.errors.length > 0) {
        console.error('CSV parsing errors:', parseResult.errors);
        return res.status(400).json({ 
          error: 'CSV parsing failed', 
          details: parseResult.errors.slice(0, 5)
        });
      }

      const rows = parseResult.data as any[];
      console.log(`📊 Parsed ${rows.length} rows from CSV`);

      // Group rows by order number (Name column contains order number like #8546)
      const orderGroups = new Map<string, any[]>();
      for (const row of rows) {
        const orderNumber = row['Name']?.toString().trim();
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
        errors: [] as string[]
      };

      // Map CSV status to our enum
      const mapCSVStatus = (financialStatus: string, fulfillmentStatus: string): 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' => {
        const financial = financialStatus?.toLowerCase() || '';
        const fulfillment = fulfillmentStatus?.toLowerCase() || '';
        
        if (fulfillment === 'fulfilled') return 'delivered';
        if (fulfillment === 'partial') return 'shipped';
        if (financial === 'paid' || financial === 'authorized') {
          return fulfillment === 'unfulfilled' || !fulfillment ? 'processing' : 'shipped';
        }
        if (financial === 'pending') return 'pending';
        if (financial === 'refunded' || financial === 'partially_refunded') return 'refunded';
        if (financial === 'voided') return 'cancelled';
        return 'pending';
      };

      // Process each order
      for (const [orderNumber, orderRows] of Array.from(orderGroups.entries())) {
        try {
          // Use first row for order-level data
          const firstRow = orderRows[0];
          const email = firstRow['Email']?.toString().trim();
          
          if (!email) {
            stats.skipped++;
            stats.errors.push(`Order ${orderNumber}: No email address`);
            continue;
          }

          // Parse amounts (handle both formats: "19.48" and "19,48")
          const parseAmount = (value: string) => {
            if (!value) return 0;
            const cleaned = value.toString().replace(',', '.');
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : Math.round(parsed * 100); // Convert to cents
          };

          const total = parseAmount(firstRow['Total'] || '0');
          const subtotal = parseAmount(firstRow['Subtotal'] || '0');
          const shipping = parseAmount(firstRow['Shipping'] || '0');
          const currency = firstRow['Currency']?.toString().trim() || 'EUR';
          
          const financialStatus = firstRow['Financial Status']?.toString().trim() || '';
          const fulfillmentStatus = firstRow['Fulfillment Status']?.toString().trim() || '';
          const createdAt = firstRow['Created at']?.toString().trim() || '';

          // Extract customer info
          const billingName = firstRow['Billing Name']?.toString().trim() || '';
          const nameParts = billingName.split(' ');
          const firstName = nameParts[0] || null;
          const lastName = nameParts.slice(1).join(' ') || null;
          const phone = firstRow['Billing Phone']?.toString().trim() || null;

          // Create or get customer
          let customer = await storage.getCustomerByEmail(email);
          if (!customer) {
            customer = await storage.createCustomer({
              email,
              firstName,
              lastName,
              phone
            });
          }

          // Check if order already exists by order number
          const existingOrder = await storage.getOrderByOrderNumber(orderNumber);
          
          // Collect line items from all rows for this order
          const lineItems = orderRows
            .filter((row: any) => row['Lineitem name'])
            .map((row: any) => ({
              name: row['Lineitem name'],
              quantity: parseInt(row['Lineitem quantity'] || '1'),
              price: row['Lineitem price'],
              sku: row['Lineitem sku']
            }));

          const orderData = {
            shopifyOrderId: orderNumber, // Use order number as Shopify ID for CSV imports
            orderNumber: orderNumber.replace('#', ''), // Remove # prefix
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
                address1: firstRow['Billing Address1'],
                city: firstRow['Billing City'],
                zip: firstRow['Billing Zip'],
                country: firstRow['Billing Country']
              },
              shipping_address: {
                name: firstRow['Shipping Name'],
                address1: firstRow['Shipping Address1'],
                city: firstRow['Shipping City'],
                zip: firstRow['Shipping Zip'],
                country: firstRow['Shipping Country']
              }
            }
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
          stats.errors.push(`Order ${orderNumber}: ${orderError instanceof Error ? orderError.message : String(orderError)}`);
        }
      }

      console.log(`✅ CSV import completed: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped`);

      res.json({
        success: true,
        processed: stats.processed,
        created: stats.created,
        updated: stats.updated,
        skipped: stats.skipped,
        errors: stats.errors.slice(0, 10), // Limit error messages
        totalErrors: stats.errors.length,
        message: `CSV import completed: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped from ${orderGroups.size} orders`
      });

    } catch (error) {
      console.error('CSV import failed:', error);
      res.status(500).json({
        error: 'CSV import failed',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

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
              { title: "iPhone 12 Pro - 128GB", quantity: 1, price: "159.99" }
            ]
          }
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
              { title: "Samsung Galaxy S21 - 64GB", quantity: 1, price: "89.99" }
            ]
          }
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
              { title: "MacBook Air M1 - 256GB", quantity: 1, price: "250.00" }
            ]
          }
        }
      ];

      let created = 0;
      for (const orderData of sampleOrders) {
        const existingOrder = await storage.getOrderByShopifyId(orderData.shopifyOrderId);
        if (!existingOrder) {
          // Create customer if doesn't exist
          let customer = await storage.getCustomerByEmail(orderData.customerEmail);
          if (!customer) {
            const [firstName, lastName] = orderData.customerEmail.split('@')[0].split('.');
            customer = await storage.createCustomer({
              email: orderData.customerEmail,
              firstName: firstName?.charAt(0).toUpperCase() + firstName?.slice(1),
              lastName: lastName?.charAt(0).toUpperCase() + lastName?.slice(1),
              shopifyCustomerId: `customer_${orderData.shopifyOrderId}`
            });
          }

          await storage.createOrder({
            ...orderData,
            customerId: customer.id
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

  // Email threads with filtering
  app.get("/api/email-threads", async (req, res) => {
    try {
      const { caseId, folder, starred, archived, isUnread, hasOrder, limit } = req.query;
      
      if (caseId) {
        // Get email threads linked to a specific case
        const relatedItems = await storage.getCaseRelatedItems(caseId as string);
        res.json(relatedItems.emails);
      } else {
        // Get email threads with database-level filtering
        const threads = await storage.getEmailThreads({
          limit: limit ? parseInt(limit as string) : undefined,
          folder: folder as string,
          starred: starred === 'true' ? true : starred === 'false' ? false : undefined,
          archived: archived === 'true' ? true : archived === 'false' ? false : undefined,
          isUnread: isUnread === 'true' ? true : isUnread === 'false' ? false : undefined,
          hasOrder: hasOrder === 'true' ? true : hasOrder === 'false' ? false : undefined,
        });
        
        res.json(threads);
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
      const threadsWithoutOrders = threads.filter(thread => !thread.orderId);
      
      console.log(`📊 Found ${threadsWithoutOrders.length} threads without orders to process`);
      
      let matchedCount = 0;
      let processedCount = 0;
      
      for (const thread of threadsWithoutOrders) {
        processedCount++;
        console.log(`🔍 Processing thread ${processedCount}/${threadsWithoutOrders.length}: "${thread.subject}" from ${thread.customerEmail}`);
        
        try {
          // Try to match order using thread subject and customer email
          const matchedOrder = await orderMatchingService.getOrderForAutoLink(
            '', // no body content for existing threads
            thread.customerEmail || '', 
            thread.subject || ''
          );

          if (matchedOrder) {
            console.log(`🎯 MATCHED: Order ${matchedOrder.orderNumber} (ID: ${matchedOrder.id}) for thread "${thread.subject}" from ${thread.customerEmail}`);
            
            // Update the thread with the matched order
            await storage.updateEmailThread(thread.id, {
              orderId: matchedOrder.id
            });
            
            matchedCount++;
          } else {
            console.log(`🔍 NO MATCH: No order found for thread "${thread.subject}" from ${thread.customerEmail}`);
          }
        } catch (matchingError) {
          console.error(`❌ Error matching order for thread ${thread.id}:`, matchingError);
        }
      }
      
      console.log(`✅ Order matching completed: ${matchedCount}/${processedCount} threads matched with orders`);
      
      res.json({ 
        processed: processedCount, 
        matched: matchedCount, 
        message: `Successfully processed ${processedCount} threads, matched ${matchedCount} with orders` 
      });
    } catch (error) {
      console.error("❌ Error in match-orders endpoint:", error);
      res.status(500).json({ message: "Failed to match orders for existing threads" });
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
        console.log(`📧 Processing email ${processedCount}/${emails.length}: ${email.messageId} (hasAttachment: ${email.hasAttachment})`);
        
        // Check if extractedAttachments exists and log details
        const extractedAttachments = (email as any).extractedAttachments;
        console.log(`🔍 Attachments check - Email ${email.messageId}: extractedAttachments type=${typeof extractedAttachments}, isArray=${Array.isArray(extractedAttachments)}, length=${extractedAttachments?.length || 'undefined'}`);
        if (extractedAttachments && Array.isArray(extractedAttachments) && extractedAttachments.length > 0) {
          console.log(`📎 Found ${extractedAttachments.length} attachments:`, extractedAttachments);
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
              email.body || '', 
              email.from || '', 
              email.subject || ''
            );

            console.log(matchedOrder ? 
              `🎯 NEW THREAD: Automatically matched order ${matchedOrder.orderNumber} (ID: ${matchedOrder.id}) for email from ${email.from}` : 
              `🔍 NEW THREAD: No automatic order match found for email from ${email.from}`
            );

            thread = await storage.createEmailThread({
              threadId: threadId,
              subject: email.subject,
              customerEmail: email.from,
              status: 'open',
              isUnread: !email.isRead,
              lastActivity: new Date(email.receivedDateTime),
              hasAttachment: email.hasAttachment,
              orderId: matchedOrder?.id || null // Automatically link order if found
            });
          } catch (error: any) {
            // If duplicate thread ID, fetch the existing one
            if (error.code === '23505') {
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
              email.body || '', 
              email.from || '', 
              email.subject || ''
            );

            if (matchedOrder) {
              console.log(`🎯 EXISTING THREAD: Matched order ${matchedOrder.orderNumber} (ID: ${matchedOrder.id}) for existing thread from ${email.from}`);
              
              // Update the existing thread with the matched order
              thread = await storage.updateEmailThread(thread.id, {
                orderId: matchedOrder.id
              });
            } else {
              console.log(`🔍 EXISTING THREAD: No order match found for existing thread from ${email.from}`);
            }
          } catch (matchingError) {
            console.error(`❌ Error matching order for existing thread ${thread.id}:`, matchingError);
          }
        } else {
          console.log(`✅ EXISTING THREAD: Thread from ${email.from} already has order ${thread.orderId} linked`);
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
            sentAt: new Date(email.receivedDateTime)
          });

          // Create attachment records if attachments were extracted
          const extractedAttachments = (email as any).extractedAttachments;
          console.log(`🔍 DEBUG: Email ${email.messageId} (hasAttachment: ${email.hasAttachment}) extractedAttachments:`, extractedAttachments);
          console.log(`🔍 DEBUG: Type check - extractedAttachments isArray: ${Array.isArray(extractedAttachments)}, length: ${extractedAttachments?.length || 'undefined'}`);
          
          if (extractedAttachments && Array.isArray(extractedAttachments) && extractedAttachments.length > 0) {
            console.log(`📎 Processing ${extractedAttachments.length} attachments for email ${email.messageId}`);
            for (let i = 0; i < extractedAttachments.length; i++) {
              const attachmentUrl = extractedAttachments[i];
              try {
                // Extract filename from storage URL
                const urlParts = attachmentUrl.split('/');
                const filename = urlParts[urlParts.length - 1];
                
                console.log(`📎 Creating attachment record ${i + 1}/${extractedAttachments.length}: ${filename} -> ${attachmentUrl}`);
                
                await storage.createEmailAttachment({
                  messageId: createdMessage.id,
                  filename: filename,
                  storageUrl: attachmentUrl,
                  contentType: 'application/octet-stream', // Default, could be improved
                  size: 0, // Could be improved to track actual size
                  isInline: false
                });
                
                console.log(`✅ Created attachment record: ${filename}`);
              } catch (attachmentError) {
                console.error(`❌ Error creating attachment record for ${attachmentUrl}:`, attachmentError);
              }
            }
          } else if (email.hasAttachment) {
            console.log(`⚠️ WARNING: Email ${email.messageId} has hasAttachment=true but extractedAttachments is empty or invalid`);
          }
        } catch (error: any) {
          // Skip duplicates, log others
          if (error.code !== '23505') {
            console.error('Error creating email message:', error);
          }
        }
      }
      
      res.json({ synced: emails.length });
    } catch (error) {
      console.error("Error syncing emails:", error);
      res.status(500).json({ message: "Failed to sync emails" });
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
          metadata: { threadId: id, newStatus: updateData.status }
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
        threadIds.map(id => storage.updateEmailThread(id, { isUnread: false }))
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
        threadIds.map(id => storage.updateEmailThread(id, { isUnread: true }))
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
        threadIds.map(id => storage.updateEmailThread(id, { starred: true }))
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
        threadIds.map(id => storage.updateEmailThread(id, { starred: false }))
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
        threadIds.map(id => storage.updateEmailThread(id, { archived: true }))
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
        threadIds.map(id => storage.updateEmailThread(id, { archived: false }))
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
      
      await Promise.all(
        threadIds.map(id => storage.deleteEmailThread(id))
      );
      
      res.json({ deleted: threadIds.length, message: `Deleted ${threadIds.length} threads` });
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
        return res.status(400).json({ message: "Missing required fields: to, subject, body" });
      }

      const result = await sendEmail(to, subject, body);
      res.json(result);
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  // Attachment endpoints
  app.get("/api/attachments/*", async (req, res) => {
    try {
      // Extract the path after /api/attachments/
      const pathAfterAttachments = req.path.replace('/api/attachments/', '');
      console.log('Attachment request path:', req.path, 'extracted path:', pathAfterAttachments);
      
      // Construct the storage path with /attachments/ prefix
      const attachmentPath = `/attachments/${pathAfterAttachments}`;
      console.log('Looking for attachment with storageUrl:', attachmentPath);
      
      const attachment = await storage.getEmailAttachment(attachmentPath);
      if (!attachment) {
        console.log('Attachment not found in database with path:', attachmentPath);
        return res.status(404).json({ error: 'Attachment not found' });
      }
      
      console.log('Found attachment:', attachment.filename, 'contentType:', attachment.contentType);
      await storage.downloadAttachment(attachmentPath, res);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      res.status(500).json({ error: 'Failed to download attachment' });
    }
  });

  // Get attachments for an email message
  app.get("/api/emails/:messageId/attachments", async (req, res) => {
    try {
      const { messageId } = req.params;
      const attachments = await storage.getEmailMessageAttachments(messageId);
      res.json(attachments);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      res.status(500).json({ error: 'Failed to fetch attachments' });
    }
  });

  // Activities
  app.get("/api/activities", async (req, res) => {
    try {
      const activities = await storage.getActivities();
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Internal notes
  app.get("/api/notes/:entityType/:entityId", async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const notes = await storage.getInternalNotes(entityId, entityType);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      const validatedData = insertInternalNoteSchema.parse(req.body);
      const note = await storage.createInternalNote(validatedData);
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(400).json({ message: "Failed to create note" });
    }
  });

  // Internal notes endpoint (alternate naming for frontend compatibility)
  app.get("/api/internal-notes", async (req, res) => {
    try {
      const { entityType, entityId, caseId } = req.query;
      
      if (caseId) {
        // Get notes linked to a specific case
        const relatedItems = await storage.getCaseRelatedItems(caseId as string);
        res.json(relatedItems.notes);
      } else if (entityType && entityId) {
        // Get notes for a specific entity  
        const notes = await storage.getInternalNotes(entityId as string, entityType as any);
        res.json(notes);
      } else {
        res.status(400).json({ message: "Either caseId or entityType+entityId required" });
      }
    } catch (error) {
      console.error("Error fetching internal notes:", error);
      res.status(500).json({ message: "Failed to fetch internal notes" });
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
      await auditLog(req, "CREATE", "suppliers", supplier.id, { name: supplier.name });
      res.status(201).json(supplier);
    } catch (error: any) {
      console.error("Error creating supplier:", error);
      res.status(400).json({ message: error.message || "Failed to create supplier" });
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
      res.status(400).json({ message: error.message || "Failed to update supplier" });
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
      res.status(400).json({ message: error.message || "Failed to delete supplier" });
    }
  });

  app.post("/api/suppliers/import-excel", requireAuth, upload.single("file"), async (req: any, res: any) => {
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
        supplierCode: String(row['Relatiecode'] || row['relatiecode'] || ''),
        name: String(row['Naam'] || row['naam'] || ''),
        contactPerson: row['Contactpersoon'] || row['contactpersoon'] || null,
        email: row['Email'] || row['email'] || null,
        phone: row['Telefoon'] ? String(row['Telefoon']) : null,
        mobile: row['Mobiele telefoon'] || row['mobiele telefoon'] || null,
        address: row['Adres'] || row['adres'] || null,
        postalCode: row['Postcode'] || row['postcode'] || null,
        city: row['Plaats'] || row['plaats'] || null,
        website: row['Website url'] || row['website url'] || null,
        kvkNumber: row['Kvk nummer'] ? String(row['Kvk nummer']) : null,
        vatNumber: row['Btw nummer'] || row['btw nummer'] || null,
        iban: row['Iban'] || row['iban'] || row['IBAN'] || null,
        bic: row['Bic'] || row['bic'] || row['BIC'] || null,
        bankAccount: row['Bankrekeningnummer'] ? String(row['Bankrekeningnummer']) : null,
        paymentTerms: row['Krediettermijn'] || 0,
        correspondenceAddress: row['Correspondentie adres'] || null,
        correspondencePostalCode: row['Correspondentie adres postcode'] || null,
        correspondenceCity: row['Correspondentie adres plaats'] || null,
        correspondenceContact: row['Correspondentie adres contactpersoon'] || null,
        notes: row['Memo'] || row['memo'] || null,
        active: true,
      }));

      await storage.importSuppliers(suppliers);
      await auditLog(req, "IMPORT", "suppliers", undefined, { count: suppliers.length });
      
      res.json({ message: `Successfully imported ${suppliers.length} suppliers` });
    } catch (error: any) {
      console.error("Error importing suppliers:", error);
      res.status(500).json({ message: error.message || "Failed to import suppliers" });
    }
  });

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
          if (typeof photo !== 'string' || !photo.startsWith('data:image/')) {
            return res.status(400).json({ message: "Invalid image format" });
          }
          // Check approximate size (base64 is ~33% larger than original)
          if (photo.length > 2800000) { // ~2MB encoded size
            return res.status(400).json({ message: "Image too large, maximum 2MB per image" });
          }
        }
      }

      const validatedData = insertPurchaseOrderSchema.parse(req.body);
      
      // Convert orderDate string to Date object for database if needed
      const purchaseOrderData = {
        ...validatedData,
        orderDate: typeof validatedData.orderDate === 'string' 
          ? new Date(validatedData.orderDate) 
          : validatedData.orderDate,
        // Also generate PO number if not provided
        poNumber: await storage.generatePONumber(),
      };
      
      const purchaseOrder = await storage.createPurchaseOrder(purchaseOrderData as any);
      
      // Create activity
      await storage.createActivity({
        type: "purchase_order_created",
        description: `Created purchase order: ${purchaseOrder.title}`,
        userId: null, // TODO: Get from session
        metadata: { purchaseOrderId: purchaseOrder.id }
      });

      res.status(201).json(purchaseOrder);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(400).json({ message: "Failed to create purchase order" });
    }
  });

  app.patch("/api/purchase-orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Always validate with partial schema for data integrity
      const updateData = insertPurchaseOrderSchema.partial().parse(req.body);
      
      // Convert orderDate string to Date object for database if present
      const purchaseOrderUpdateData = updateData.orderDate 
        ? {
            ...updateData,
            orderDate: typeof updateData.orderDate === 'string' 
              ? new Date(updateData.orderDate) 
              : updateData.orderDate
          }
        : updateData;
      
      const purchaseOrder = await storage.updatePurchaseOrder(id, purchaseOrderUpdateData as any);
      
      if (req.body.status) {
        await storage.createActivity({
          type: "purchase_order_status_updated",
          description: `Updated purchase order status to ${req.body.status}: ${purchaseOrder.title}`,
          userId: null, // TODO: Get from session
          metadata: { purchaseOrderId: purchaseOrder.id, status: req.body.status }
        });
      }

      res.json(purchaseOrder);
    } catch (error) {
      console.error("Error updating purchase order:", error);
      res.status(400).json({ message: "Failed to update purchase order" });
    }
  });

  app.delete("/api/purchase-orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePurchaseOrder(id);
      
      await storage.createActivity({
        type: "purchase_order_deleted",
        description: `Deleted purchase order`,
        userId: null, // TODO: Get from session
        metadata: { purchaseOrderId: id }
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting purchase order:", error);
      res.status(400).json({ message: "Failed to delete purchase order" });
    }
  });

  // Purchase Order Items
  app.get("/api/purchase-order-items/:purchaseOrderId", requireAuth, async (req: any, res: any) => {
    try {
      const { purchaseOrderId } = req.params;
      const items = await storage.getPurchaseOrderItems(purchaseOrderId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching purchase order items:", error);
      res.status(500).json({ message: "Failed to fetch purchase order items" });
    }
  });

  app.post("/api/purchase-order-items", requireAuth, async (req: any, res: any) => {
    try {
      const item = await storage.createPurchaseOrderItem(req.body);
      res.status(201).json(item);
    } catch (error: any) {
      console.error("Error creating purchase order item:", error);
      res.status(400).json({ message: error.message || "Failed to create purchase order item" });
    }
  });

  app.patch("/api/purchase-order-items/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const item = await storage.updatePurchaseOrderItem(id, req.body);
      res.json(item);
    } catch (error: any) {
      console.error("Error updating purchase order item:", error);
      res.status(400).json({ message: error.message || "Failed to update purchase order item" });
    }
  });

  app.delete("/api/purchase-order-items/:id", requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.deletePurchaseOrderItem(id);
      res.json({ message: "Purchase order item deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting purchase order item:", error);
      res.status(400).json({ message: error.message || "Failed to delete purchase order item" });
    }
  });

  // Search
  app.get("/api/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
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
      res.status(500).json({ message: "Failed to fetch customer email threads" });
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
      const cases = await storage.getCases(status as string, q as string, emailThreadId as string);
      res.json(cases);
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ message: "Failed to fetch cases" });
    }
  });

  app.post("/api/cases", async (req, res) => {
    try {
      const validatedData = insertCaseSchema.parse(req.body);
      
      // Handle date conversions
      if (validatedData.slaDeadline && typeof validatedData.slaDeadline === 'string') {
        validatedData.slaDeadline = new Date(validatedData.slaDeadline);
      }
      if (validatedData.resolvedAt && typeof validatedData.resolvedAt === 'string') {
        validatedData.resolvedAt = new Date(validatedData.resolvedAt);
      }
      if (validatedData.closedAt && typeof validatedData.closedAt === 'string') {
        validatedData.closedAt = new Date(validatedData.closedAt);
      }
      
      const newCase = await storage.createCase(validatedData);
      
      // Create activity
      await storage.createActivity({
        type: "case_created",
        description: `Created case: ${newCase.title}`,
        userId: newCase.assignedUserId,
        metadata: { caseId: newCase.id, caseNumber: newCase.caseNumber }
      });

      res.status(201).json(newCase);
    } catch (error) {
      console.error("Error creating case:", error);
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
      
      // Get related items
      const relatedItems = await storage.getCaseRelatedItems(id);
      
      res.json({
        case: caseItem,
        ...relatedItems
      });
    } catch (error) {
      console.error("Error fetching case:", error);
      res.status(500).json({ message: "Failed to fetch case" });
    }
  });

  app.patch("/api/cases/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Handle date conversions
      const updateData = { ...req.body };
      if (updateData.slaDeadline && typeof updateData.slaDeadline === 'string') {
        updateData.slaDeadline = new Date(updateData.slaDeadline);
      }
      if (updateData.resolvedAt && typeof updateData.resolvedAt === 'string') {
        updateData.resolvedAt = new Date(updateData.resolvedAt);
      }
      if (updateData.closedAt && typeof updateData.closedAt === 'string') {
        updateData.closedAt = new Date(updateData.closedAt);
      }
      
      const updatedCase = await storage.updateCase(id, updateData);
      
      // Create activity for status change
      if (req.body.status) {
        await storage.createActivity({
          type: "case_status_updated",
          description: `Updated case status to ${req.body.status}: ${updatedCase.title}`,
          userId: updatedCase.assignedUserId,
          metadata: { caseId: updatedCase.id, status: req.body.status }
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
        return res.status(400).json({ message: "entityType and entityId are required" });
      }
      
      if (!['email', 'repair', 'todo', 'order', 'note'].includes(entityType)) {
        return res.status(400).json({ message: "Invalid entityType" });
      }
      
      await storage.linkEntityToCase(id, entityType, entityId);
      
      const caseItem = await storage.getCase(id);
      await storage.createActivity({
        type: "case_entity_linked",
        description: `Linked ${entityType} to case: ${caseItem?.title}`,
        userId: caseItem?.assignedUserId,
        metadata: { caseId: id, entityType, entityId }
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
        return res.status(400).json({ message: "entityType and entityId are required" });
      }
      
      if (!['email', 'repair', 'todo', 'order', 'note'].includes(entityType)) {
        return res.status(400).json({ message: "Invalid entityType" });
      }
      
      await storage.unlinkEntityFromCase(entityType, entityId);
      
      const { id } = req.params;
      const caseItem = await storage.getCase(id);
      await storage.createActivity({
        type: "case_entity_unlinked",
        description: `Unlinked ${entityType} from case: ${caseItem?.title}`,
        userId: caseItem?.assignedUserId,
        metadata: { caseId: id, entityType, entityId }
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
        archivedAt: new Date()
      });
      
      if (!updatedCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      await storage.createActivity({
        type: "case_archived",
        description: `Archived case: ${updatedCase.title || updatedCase.caseNumber || 'Unknown'}`,
        userId: updatedCase.assignedUserId || null,
        metadata: { caseId: updatedCase.id }
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
        archivedAt: null
      });
      
      if (!updatedCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      await storage.createActivity({
        type: "case_unarchived",
        description: `Unarchived case: ${updatedCase.title || updatedCase.caseNumber || 'Unknown'}`,
        userId: updatedCase.assignedUserId || null,
        metadata: { caseId: updatedCase.id }
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
        metadata: { caseId: id, caseNumber: caseItem.caseNumber }
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
        metadata: { caseId: newCase.id, threadId }
      });
      
      res.status(201).json(newCase);
    } catch (error) {
      console.error("Error creating case from email thread:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create case from email thread" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
