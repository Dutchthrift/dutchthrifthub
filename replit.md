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

### Notes System (Universal - Production Ready)
The platform features a comprehensive Shopify-quality Notes system for centralized communication, decisions, and evidence tracking across all entities (customers, orders, repairs, email threads, cases, returns). **Status: Fully implemented and deployed website-wide.**

**Core Features:**
- **Polymorphic Linking**: Notes can be attached to any entity type via entity_type and entity_id fields
- **Visibility Control**: Three visibility levels (internal, customer_visible, system) with backend enforcement
- **Threading**: Reply support with parent_note_id and thread_depth tracking (max depth 2)
- **Rich Content**: TipTap rich text editor with HTML sanitization and plain text extraction for search

**Collaboration Features:**
- **Mentions**: @user autocomplete with live user search and notification tracking
- **Reactions**: Emoji reactions (👍 👀 ✅) with unique constraint per user+emoji combination
- **Pinning**: Up to 3 pinned notes per entity enforced via partial unique index
- **Tags**: Color-coded tags with multi-select filtering and badge display

**Content Management:**
- **Attachments**: File upload with preview, drag-and-drop support, object storage integration
- **Templates**: Template dropdown with variable substitution ({{orderNumber}}, {{customerName}}, {{today}})
- **Smart Links**: Auto-detection of order IDs, tracking codes, SKUs (planned)
- **Edit History**: Full revision tracking with delta visualization (planned)

**Workflow Integration:**
- **Follow-ups**: Dialog to convert notes to Todos with due dates and assignee selection
- **Audit Trail**: Soft delete with required reason, preserves full history
- **Status Integration**: Contextual templates based on entity status

**Search & Filtering:**
- **Multi-Dimensional Filters**: Search bar, author dropdown, tag multi-select, date range, visibility toggle
- **Clear Filters**: Single-click to reset all active filters
- **Real-time Results**: Client-side filtering with server-side support for visibility/author/tags
- **Result Counts**: Shows "X notes (filtered from Y)" when filters active

**UI Components (Production):**
- **NotesPanel**: Main container with filters, composer, note list (pinned + unpinned + deleted sections)
- **NoteComposer**: TipTap rich text editor with formatting toolbar, visibility toggle, tag selector, template dropdown
- **NoteItem**: Note display with author avatar, timestamp, content, reactions, action menu (pin/edit/delete/reply/followup)
- **NoteThread**: Threaded reply display with max depth 2 and visual indentation
- **AttachmentUpload**: Drag-and-drop file upload with progress and preview
- **MentionsAutocomplete**: @-triggered user search with keyboard navigation
- **NoteEditDialog**: Edit note with revision history
- **NoteFollowupDialog**: Create Todo from note with due date picker

**Keyboard Shortcuts:**
- Ctrl+Enter: Submit note
- /: Focus composer (planned)
- @: Trigger mentions autocomplete
- Esc: Close dialogs

**Accessibility:**
- ARIA labels on all interactive elements
- Keyboard navigation support
- Role attributes for semantic structure
- Screen reader friendly content

**Performance Optimization:**
- Composite indexes on (entity_type, entity_id, deleted_at, created_at) for listing
- Partial indexes on parent_note_id (threading) and is_pinned (quick pin lookup)
- Unique constraints prevent duplicate tags, mentions, and reactions
- GIN index for full-text search on note content
- TanStack Query caching with smart invalidation

**Data Integrity:**
- CASCADE DELETE on all child tables (tags, mentions, reactions, attachments, revisions, links, follow-ups)
- NO ACTION on user references to preserve audit trail
- Unique constraints on note_tag_assignments, note_mentions, and note_reactions

**Integration Status:**
- ✅ Orders page (client/src/pages/orders.tsx)
- ✅ Returns page (client/src/pages/returns.tsx)
- ✅ Return detail page (client/src/pages/return-detail.tsx)
- ✅ Cases page (client/src/pages/case-detail.tsx)
- ✅ Case detail modal (client/src/components/cases/case-detail-modal.tsx)
- ✅ Customer detail page (client/src/pages/customer-detail.tsx)
- ✅ Task detail modal (client/src/components/todos/task-detail-modal.tsx)

**Recent Updates (Nov 11, 2025):**
- Fixed critical apiRequest parameter order bug (method, url, data)
- Added null date handling for createdAt fields
- Completed universal rollout across all entity types
- Added comprehensive filters and template support
- Implemented keyboard shortcuts and accessibility features

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