import { Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// Local Storage Implementation - stores files on server filesystem
export class ObjectStorageService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || "server/uploads");
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(data: Buffer, filename: string, contentType?: string): Promise<string> {
    return this.saveAttachment(filename, data, contentType);
  }

  async saveAttachment(filename: string, data: Buffer, contentType?: string): Promise<string> {
    const attachmentId = randomUUID();
    const dirPath = path.join(this.uploadDir, "attachments", attachmentId);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, filename);
    await fs.promises.writeFile(filePath, data);

    // Return path relative to upload dir root
    return `/attachments/${attachmentId}/${filename}`;
  }

  async downloadObject(relativePath: string, res: Response, cacheTtlSec: number = 3600, forceDownload: boolean = false) {
    try {
      // Sanitize path to prevent directory traversal
      const safePath = path.normalize(relativePath).replace(/^(\.\.[\\/])+/, '');
      const filePath = path.join(this.uploadDir, safePath);

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const stats = await fs.promises.stat(filePath);
      const filename = path.basename(filePath);

      // Content type detection based on extension
      const ext = path.extname(filename).toLowerCase();
      let contentType = "application/octet-stream";
      if (['.jpg', '.jpeg'].includes(ext)) contentType = "image/jpeg";
      else if (ext === '.png') contentType = "image/png";
      else if (ext === '.gif') contentType = "image/gif";
      else if (ext === '.webp') contentType = "image/webp";
      else if (ext === '.pdf') contentType = "application/pdf";
      else if (ext === '.doc') contentType = "application/msword";
      else if (ext === '.docx') contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (ext === '.xls') contentType = "application/vnd.ms-excel";
      else if (ext === '.xlsx') contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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

  // Convenience method for downloading by attachment path
  async downloadAttachmentByPath(attachmentPath: string, res: Response, forceDownload: boolean = false) {
    return this.downloadObject(attachmentPath, res, 3600, forceDownload);
  }

  async deleteAttachment(attachmentPath: string): Promise<void> {
    const safePath = path.normalize(attachmentPath).replace(/^(\.\.[\\/])+/, '');
    const filePath = path.join(this.uploadDir, safePath);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      // Try to remove the parent directory if empty
      try {
        await fs.promises.rmdir(path.dirname(filePath));
      } catch (e) {
        // Ignore if not empty
      }
    }
  }

  // Legacy compatibility method - now just returns the path for local storage
  async getAttachmentFile(attachmentPath: string): Promise<string> {
    return attachmentPath;
  }
}

export const objectStorage = new ObjectStorageService();