# DutchThrift Dashboard

## Overview

DutchThrift Dashboard is a comprehensive customer service and order management platform built with modern web technologies. The application serves as a centralized hub for managing customer communications, order processing, repair workflows, and team collaboration. It features a responsive React frontend with TypeScript, Express.js backend, and PostgreSQL database with Drizzle ORM.

The platform integrates with external services including Shopify for order management and Microsoft Graph API for email synchronization, providing a unified interface for customer service operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: Radix UI primitives with Tailwind CSS for styling
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for client-side routing
- **Styling**: Tailwind CSS with CSS variables for theming
- **Component Library**: Custom component system built on Radix UI with shadcn/ui design patterns

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JSON communication
- **Error Handling**: Centralized error handling middleware
- **Request Logging**: Custom middleware for API request/response logging
- **Scheduled Jobs**: Node-cron for automated background tasks (hourly Shopify sync)

### Database Design
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Management**: Type-safe schema definitions with validation using Zod
- **Migrations**: Drizzle Kit for database migrations
- **Connection**: Neon serverless PostgreSQL database

### Key Data Models
- **Users**: Role-based access control (admin, agent, repair_tech, viewer)
- **Customers**: Customer information with Shopify integration
- **Orders**: Synchronized with Shopify, includes status tracking
- **Email Threads**: Email communication management with status tracking
- **Repairs**: Repair workflow management with status progression
- **Todos**: Task management with priority and assignment
- **Activities**: Audit trail and team activity tracking
- **Notes Domain**: Advanced notes system with threading, attachments, mentions, reactions, templates, and smart linking (see Notes System section below)

### Authentication & Authorization
- **Session Management**: Express sessions with PostgreSQL storage
- **Role-Based Access Control**: Four user roles with different permission levels
- **Security**: Password hashing and session-based authentication

### User Interface Design
- **Navigation**: Top navigation bar with global search and command palette
- **Theme Support**: Light/dark theme switching with system preference detection
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Accessibility**: ARIA labels and keyboard navigation support

### Email Management
- **Integration**: Microsoft Graph API for Outlook email synchronization
- **Thread Management**: Grouped email conversations with status tracking
- **Compose & Reply**: Built-in email composition with rich text support
- **Search**: Global search across email threads and messages

### Order Management
- **Shopify Integration**: Real-time synchronization of order data
- **Automatic Sync**: Scheduled hourly sync running in background (every hour at :00)
- **Manual Sync**: On-demand sync button for immediate synchronization
- **Incremental Sync**: Only fetches new/updated orders since last sync for efficiency
- **Status Tracking**: Order lifecycle management from pending to completion
- **Customer Linking**: Automatic customer profile creation and linking

### Repair Workflow
- **Kanban Board**: Visual repair status management
- **Priority System**: Four-level priority system (low, medium, high, urgent)
- **SLA Tracking**: Deadline management with alert system
- **Status Progression**: Six-stage repair workflow (new → in_progress → waiting_customer → waiting_part → ready → closed)

### Task Management
- **Personal Todos**: User-specific task assignments
- **Priority Management**: Task prioritization with deadline tracking
- **Team Collaboration**: Task assignment and status updates

### Notes System (Advanced)
The platform features a comprehensive Shopify-quality Notes system for centralized communication, decisions, and evidence tracking across all entities (customers, orders, repairs, email threads, cases, returns).

**Core Features:**
- **Polymorphic Linking**: Notes can be attached to any entity type via entity_type and entity_id fields
- **Visibility Control**: Three visibility levels (internal, customer_visible, system) with backend enforcement
- **Threading**: Reply support with parent_note_id and thread_depth tracking (max depth enforced via application logic)
- **Rich Content**: HTML content with server-side sanitization (rendered_html) and plain text extraction for search

**Collaboration Features:**
- **Mentions**: @user autocomplete with notification tracking (note_mentions table)
- **Reactions**: Emoji reactions (👍 👀 ✅) with unique constraint per user+emoji combination
- **Pinning**: Up to 3 pinned notes per entity for visibility
- **Tags**: Freeform categorization with note_tags catalog and note_tag_assignments junction table

**Content Management:**
- **Attachments**: File uploads via note_attachments linking to object storage
- **Templates**: Reusable note templates with variable substitution (note_templates)
- **Smart Links**: Auto-detection and linking of order IDs, tracking codes, SKUs (note_links)
- **Status Prompts**: Contextual templates based on entity status

**Workflow Integration:**
- **Follow-ups**: Convertible to Todos with due dates and assignees (note_followups)
- **Audit Trail**: Complete edit history with delta tracking (note_revisions)
- **Soft Delete**: Deletion requires reason, preserves audit log

**Search & Export:**
- **Full-Text Search**: GIN index on plain_text for efficient searching
- **Filters**: By visibility, tag, author, date range, attachments
- **Export**: Markdown export with visibility filtering

**Performance Optimization:**
- Composite indexes on (entity_type, entity_id, deleted_at, created_at) for listing
- Partial indexes on parent_note_id (threading) and is_pinned (quick pin lookup)
- Unique constraints prevent duplicate tags, mentions, and reactions
- GIN index for full-text search on note content

**Data Integrity:**
- CASCADE DELETE on all child tables (tags, mentions, reactions, attachments, revisions, links, follow-ups)
- NO ACTION on user references to preserve audit trail
- Unique constraints on note_tag_assignments, note_mentions, and note_reactions

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless database
- **File Storage**: Supabase for secure file storage and attachments

### Third-Party Integrations
- **Shopify API**: Order management and customer data synchronization
- **Microsoft Graph API**: Email synchronization and management via Outlook
- **IMAP Protocol**: Direct mailbox access for email synchronization

### Development Tools
- **Drizzle ORM**: Type-safe database interactions and migrations
- **TanStack Query**: Server state management and caching
- **Zod**: Runtime type validation and schema definition
- **React Hook Form**: Form handling with validation
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework

### Build & Deployment
- **Vite**: Frontend build tool with hot module replacement
- **ESBuild**: Backend bundling for production
- **TypeScript**: Type safety across the entire application
- **PostCSS**: CSS processing with Tailwind and Autoprefixer

### Monitoring & Development
- **Replit Integration**: Development environment with runtime error overlay
- **Custom Logging**: Request/response logging with performance metrics
- **Error Boundaries**: React error handling with user-friendly fallbacks