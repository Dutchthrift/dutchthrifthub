# SnappyMail Integration - Quick Reference

## 📋 What's Been Created

### Database (`/db/migrations/`)
- **0015_email_metadata.sql** - Email metadata table (messageId → caseId/orderId/etc.)

### Backend (`/server/`)
- **emailMetadataRoutes.ts** - API endpoints for email metadata CRUD

### Frontend (`/client/src/`)
- **pages/mail.tsx** - React page with iframe and postMessage handlers

### SnappyMail Plugin (`/snappymail-plugin/thrifthub/`)
- **index.php** - Plugin entry point
- **js/thrifthub-actions.js** - Custom action buttons
- **css/thrifthub-theme.css** - ThriftHub branding

### Documentation (`/docs/`)
- **SNAPPYMAIL_SETUP.md** - Complete installation guide

## 🚀 Next Steps (Manual)

1. **Download SnappyMail**
   - https://github.com/the-djmaze/snappymail/releases
   - Get `snappymail-*.tar.gz` (PHP version, NOT Docker)

2. **Upload via FTP**
   ```
   hub.dutchthrift.com/mail/  ← Upload here
   ```

3. **Configure**
   - Access: `https://hub.dutchthrift.com/mail/?admin`
   - Add Strato domain (imap.strato.com, smtp.strato.com)
   - Enable auto-login for support@dutchthrift.com

4. **Install Plugin**
   - Copy `/snappymail-plugin/thrifthub/` to:
     ```
     /mail/data/_data_/_default_/plugins/thrifthub/
     ```
   - Enable in SnappyMail admin → Plugins

5. **Add React Route**
   - In `client/src/App.tsx`:
     ```tsx
     <Route path="/mail" element={<Mail />} />
     ```

6. **Run Migration**
   ```bash
   npm run db:push
   ```

7. **Test**
   - Navigate to `/mail` in ThriftHub
   - Open email, click action buttons
   - Verify case/order/return/repair creation

## 🔑 Key Features

✅ **Auto-login** - No separate login for SnappyMail  
✅ **Metadata-only** - Emails stay on Strato IMAP  
✅ **Custom Actions** - Create Case, Link Order, Create Return, Create Repair  
✅ **Branded UI** - Custom theme matching ThriftHub colors  
✅ **Secure** - postMessage with origin validation  
✅ **Shared Hosting** - Pure PHP, no Node.js backend needed

## 📚 Files Summary

| File | Purpose |
|------|---------|
| `0015_email_metadata.sql` | Database table for email→entity links |
| `emailMetadataRoutes.ts` | Backend API for metadata CRUD |
| `mail.tsx` | React page with iframe + postMessage |
| `index.php` | SnappyMail plugin entry point |
| `thrifthub-actions.js` | Action buttons + postMessage sender |
| `thrifthub-theme.css` | Custom branding for SnappyMail |
| `SNAPPYMAIL_SETUP.md` | Step-by-step installation guide |
