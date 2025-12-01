import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import {
  ObjectAclPolicy,
  ObjectPermission,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// Interface for storage strategies
interface IStorageStrategy {
  saveAttachment(filename: string, data: Buffer, contentType?: string): Promise<string>;
  downloadObject(fileOrPath: any, res: Response, cacheTtlSec?: number, forceDownload?: boolean): Promise<void>;
  deleteAttachment(attachmentPath: string): Promise<void>;
}

// GCP Storage Strategy (Existing Logic)
class GCPStorageStrategy implements IStorageStrategy {
  private client: Storage;

  constructor() {
    this.client = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: {
            type: "json",
            subject_token_field_name: "access_token",
          },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
  }

  private getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error("PRIVATE_OBJECT_DIR not set.");
    }
    return dir;
  }

  private parseObjectPath(path: string): { bucketName: string; objectName: string } {
    if (!path.startsWith("/")) {
      path = `/${path}`;
    }
    const pathParts = path.split("/");
    if (pathParts.length < 3) {
      throw new Error("Invalid path: must contain at least a bucket name");
    }
    return {
      bucketName: pathParts[1],
      objectName: pathParts.slice(2).join("/"),
    };
  }

  async saveAttachment(filename: string, data: Buffer, contentType?: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const attachmentId = randomUUID();
    const fullPath = `${privateObjectDir}/attachments/${attachmentId}/${filename}`;

    const { bucketName, objectName } = this.parseObjectPath(fullPath);
    const bucket = this.client.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(data, {
      metadata: {
        contentType: contentType || 'application/octet-stream',
      },
    });

    const aclPolicy: ObjectAclPolicy = {
      owner: 'system',
      visibility: 'public',
    };
    await setObjectAclPolicy(file, aclPolicy);

    return `/attachments/${attachmentId}/${filename}`;
  }

  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600, forceDownload: boolean = false) {
    try {
      const [metadata] = await file.getMetadata();
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";

      const contentType = metadata.contentType || "application/octet-stream";
      const filename = file.name.split('/').pop() || 'attachment';
      const isPreviewable = contentType.startsWith('image/') || contentType.includes('pdf');

      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "Content-Length": metadata.size?.toString() || "",
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
        "X-Content-Type-Options": "nosniff",
      };

      if (forceDownload || !isPreviewable) {
        headers["Content-Disposition"] = `attachment; filename="${filename}"`;
        headers["X-Frame-Options"] = "DENY";
      } else {
        headers["Content-Disposition"] = `inline; filename="${filename}"`;
        if (contentType.includes('pdf')) {
          headers["X-Frame-Options"] = "SAMEORIGIN";
        }
      }

      res.set(headers);
      const stream = file.createReadStream();
      stream.on("error", (err: any) => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) res.status(500).json({ error: "Error downloading file" });
    }
  }

  async deleteAttachment(attachmentPath: string): Promise<void> {
    try {
      const privateObjectDir = this.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}${attachmentPath}`;
      const { bucketName, objectName } = this.parseObjectPath(fullPath);
      const bucket = this.client.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  }

  // Helper to get file object for existing code compatibility if needed
  async getFile(attachmentPath: string): Promise<File> {
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}${attachmentPath}`;
    const { bucketName, objectName } = this.parseObjectPath(fullPath);
    const bucket = this.client.bucket(bucketName);
    return bucket.file(objectName);
  }
}

// Local Storage Strategy
class LocalStorageStrategy implements IStorageStrategy {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || "server/uploads");
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveAttachment(filename: string, data: Buffer, contentType?: string): Promise<string> {
    const attachmentId = randomUUID();
    const dirPath = path.join(this.uploadDir, "attachments", attachmentId);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, filename);
    await fs.promises.writeFile(filePath, data);

    // Return path relative to upload dir root, similar to GCP structure
    return `/attachments/${attachmentId}/${filename}`;
  }

  async downloadObject(relativePath: string, res: Response, cacheTtlSec: number = 3600, forceDownload: boolean = false) {
    try {
      // Sanitize path to prevent directory traversal
      const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(this.uploadDir, safePath);

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const stats = await fs.promises.stat(filePath);
      const filename = path.basename(filePath);
      // Simple content type detection based on extension
      const ext = path.extname(filename).toLowerCase();
      let contentType = "application/octet-stream";
      if (['.jpg', '.jpeg'].includes(ext)) contentType = "image/jpeg";
      else if (ext === '.png') contentType = "image/png";
      else if (ext === '.gif') contentType = "image/gif";
      else if (ext === '.pdf') contentType = "application/pdf";

      const isPreviewable = contentType.startsWith('image/') || contentType.includes('pdf');

      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "Content-Length": stats.size.toString(),
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      };

      if (forceDownload || !isPreviewable) {
        headers["Content-Disposition"] = `attachment; filename="${filename}"`;
      } else {
        headers["Content-Disposition"] = `inline; filename="${filename}"`;
      }

      res.set(headers);
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (error) {
      console.error("Error reading local file:", error);
      if (!res.headersSent) res.status(500).json({ error: "Error reading file" });
    }
  }

  async deleteAttachment(attachmentPath: string): Promise<void> {
    const safePath = path.normalize(attachmentPath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(this.uploadDir, safePath);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      // Try to remove the parent directory if empty (it was created for this attachment)
      try {
        await fs.promises.rmdir(path.dirname(filePath));
      } catch (e) {
        // Ignore if not empty
      }
    }
  }
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  private strategy: IStorageStrategy;
  private isLocal: boolean;

  constructor() {
    this.isLocal = process.env.STORAGE_PROVIDER === "local";
    this.strategy = this.isLocal ? new LocalStorageStrategy() : new GCPStorageStrategy();
    console.log(`ObjectStorageService initialized with strategy: ${this.isLocal ? 'Local' : 'GCP'}`);
  }

  // Legacy method support - throws if in local mode as it's GCP specific
  getPublicObjectSearchPaths(): Array<string> {
    if (this.isLocal) return [];
    // ... existing logic if needed, or just return empty
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    return pathsStr.split(",").map(p => p.trim()).filter(p => p.length > 0);
  }

  async downloadObject(fileOrPath: any, res: Response, cacheTtlSec: number = 3600, forceDownload: boolean = false) {
    return this.strategy.downloadObject(fileOrPath, res, cacheTtlSec, forceDownload);
  }

  async saveAttachment(filename: string, data: Buffer, contentType?: string): Promise<string> {
    return this.strategy.saveAttachment(filename, data, contentType);
  }

  async deleteAttachment(attachmentPath: string): Promise<void> {
    return this.strategy.deleteAttachment(attachmentPath);
  }

  // Helper to get raw file object - only works in GCP mode
  async getAttachmentFile(attachmentPath: string): Promise<File> {
    if (this.isLocal) {
      throw new Error("getAttachmentFile is not supported in local storage mode");
    }
    return (this.strategy as GCPStorageStrategy).getFile(attachmentPath);
  }
}