# SnappyMail Installation & Setup Guide

This guide covers the installation and configuration of SnappyMail for ThriftHub.

## 📥 Step 1: Download SnappyMail

1. Download the latest **PHP version** of SnappyMail:
   - URL: https://github.com/the-djmaze/snappymail/releases
   - Look for: `snappymail-<version>.tar.gz` (NOT Docker)

2. Extract the archive:
   ```bash
   tar -xzf snappymail-*.tar.gz
   ```

## 📂 Step 2: Upload to Shared Hosting

Upload SnappyMail to your shared hosting via FTP:

```
/hub.dutchthrift.com/
└── mail/                    ← Upload SnappyMail here
    ├── index.php
    ├── data/
    ├── snappymail/
    └── _include.php
```

### FTP Upload Steps:
1. Connect to your shared hosting via FTP (FileZilla, WinSCP, etc.)
2. Navigate to `hub.dutchthrift.com/`
3. Create folder `mail/`
4. Upload extracted SnappyMail files to `mail/`

## ⚙️ Step 3: Initial Configuration

1. Access admin panel:
   ```
   https://hub.dutchthrift.com/mail/?admin
   ```

2. Set admin password on first visit

3. Configure Strato IMAP/SMTP:
   - Go to **Domains** → **Add Domain**
   - IMAP Server: `imap.strato.com`
   - IMAP Port: `993`
   - IMAP Security: `SSL/TLS`
   - SMTP Server: `smtp.strato.com`
   - SMTP Port: `465`
   - SMTP Security: `SSL/TLS`

4. **Disable user registration:**
   - Go to **Login** → Uncheck "Allow new users"

## 🔐 Step 4: Auto-Login Configuration

Create auto-login plugin for seamless UX:

1. Go to **Plugins** in admin panel

2. Enable **Login by URL** or create custom auto-login

3. Or configure single-account mode:
   - Edit `data/_data_/_default_/domains/dutchthrift.com.ini`
   - Add:
     ```ini
     [login]
     default_login = "support@dutchthrift.com"
     determine_user_domain = Off
     login_lowercase = On
     ```

4. Optional: Create PHP auto-login script in `mail/autologin.php`:
   ```php
   <?php
   // Auto-login script for support mailbox
   $_ENV['SNAPPYMAIL_AUTOLOGIN'] = 'support@dutchthrift.com';
   include 'index.php';
   ?>
   ```

## 🔌 Step 5: Install ThriftHub Plugin

1. Copy plugin folder to SnappyMail:
   ```
   /mail/
   └── data/
       └── _data_/_default_/
           └── plugins/
               └── thrifthub/          ← Copy from snappymail-plugin/thrifthub/
                   ├── index.php
                   ├── js/
                   │   └── thrifthub-actions.js
                   └── css/
                       └── thrifthub-theme.css
   ```

2. Enable plugin in admin panel:
   - Go to **Plugins**
   - Find "ThriftHub Actions"
   - Click "Enable"

## 🎨 Step 6: Apply Custom Theme

1. Go to **Themes** in admin panel

2. Upload `thrifthub-theme.css` or select existing theme

3. Customize colors to match ThriftHub:
   - Primary: `#3b82f6`
   - Secondary: `#8b5cf6`
   - Font: `Inter`

## ✅ Step 7: Verify Installation

1. Access SnappyMail:
   ```
   https://hub.dutchthrift.com/mail/
   ```

2. Verify:
   - Auto-login works (no login screen)
   - Emails load from Strato IMAP
   - Custom action buttons appear in email view
   - Clicking buttons sends postMessage to parent

## 🔗 Step 8: Update React App Route

The React route is already created in `client/src/pages/mail.tsx`.

Add to `client/src/App.tsx`:

```tsx
import Mail from './pages/mail';

// In routes:
<Route path="/mail" element={<Mail />} />
```

## 🧪 Step 9: Test Integration

1. Navigate to `https://hub.dutchthrift.com/mail` in ThriftHub
2. Open an email in SnappyMail
3. Click "Create Case" button
4. Verify:
   - Case is created in ThriftHub
   - Email metadata is stored in database
   - Navigation to case page works

## 📝 Step 10: Cleanup Old Code

After verifying SnappyMail works, remove old email code:

```bash
# Delete old email components
rm -rf client/src/components/email/

# Delete old inbox page
rm client/src/pages/inbox.tsx

# Remove IMAP provider (optional - keep if needed for other features)
# rm server/services/imapSmtpProvider.ts
```

## 🎯 Final Checklist

- [  ] SnappyMail downloaded and uploaded via FTP
- [ ] Admin panel configured with Strato IMAP/SMTP
- [ ] Auto-login enabled (no login screen)
- [ ] ThriftHub plugin installed and enabled
- [ ] Custom theme applied
- [ ] React `/mail` route added
- [ ] Test: Create case from email
- [ ] Test: Link order to email
- [ ] Test: Create return from email
- [ ] Test: Create repair from email
- [ ] Old email code removed

## 🆘 Troubleshooting

**Issue: 404 on /mail/**
- Verify SnappyMail files uploaded to correct folder
- Check `.htaccess` rules on shared hosting

**Issue: Auto-login not working**
- Check `data/_data_/_default_/domains/*.ini`
- Verify plugin enabled in admin panel

**Issue: Plugin buttons not appearing**
- Check browser console for JavaScript errors
- Verify plugin files uploaded correctly
- Check SnappyMail version compatibility

**Issue: postMessage not working**
- Verify iframe sandbox attributes
- Check browser console for CORS errors
- Ensure same-origin policy (both on dutchthrift.com)

## 📚 Resources

- SnappyMail docs: https://snappymail.eu/
- Plugin development: https://github.com/the-djmaze/snappymail/wiki/Plugins
- Strato IMAP settings: https://www.strato.de/faq/
