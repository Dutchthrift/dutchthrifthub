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