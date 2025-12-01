import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create the connection with pool configuration
// Supabase Session mode has limited connections, so we configure a small pool with fast timeout
const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString, {
  max: 10,                // Maximum 10 connections in pool
  idle_timeout: 20,       // Close idle connections after 20 seconds
  connect_timeout: 10,    // Connection timeout
});

// Initialize Drizzle with the schema
export const db = drizzle(client, { schema });

export type Database = typeof db;
