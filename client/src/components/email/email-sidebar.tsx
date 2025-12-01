import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
  Divider,
  Typography,
  Box,
  Badge
} from '@mui/material';
import {
  Inbox as InboxIcon,
  Send as SendIcon,
  Archive as ArchiveIcon,
  Star as StarIcon,
  Delete as DeleteIcon,
  Mail as MailIcon,
  ShoppingCart as ShoppingCartIcon,
  Edit as EditIcon,
  Sync as SyncIcon
} from '@mui/icons-material';

interface EmailSidebarProps {
  folder: string;
  setFolder: (folder: string) => void;
  unreadCounts?: Record<string, number>;
  onCompose?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

export function EmailSidebar({ folder, setFolder, unreadCounts, onCompose, onSync, isSyncing }: EmailSidebarProps) {
  const navItems = [
    { id: "inbox", label: "Inbox", icon: InboxIcon },
    { id: "sent", label: "Sent", icon: SendIcon },
    { id: "starred", label: "Starred", icon: StarIcon },
    { id: "archive", label: "Archive", icon: ArchiveIcon },
    { id: "trash", label: "Trash", icon: DeleteIcon },
  ];

  const filters = [
    { id: "unread", label: "Unread", icon: MailIcon },
    { id: "has-order", label: "Orders", icon: ShoppingCartIcon },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        p: 2,
        gap: 2,
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      {/* Compose Button */}
      <Box sx={{ px: 1 }}>
        <Button
          onClick={onCompose}
          variant="contained"
          fullWidth
          startIcon={<EditIcon />}
          sx={{
            height: 48,
            borderRadius: 6,
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            boxShadow: 2,
            '&:hover': {
              boxShadow: 4,
            },
          }}
        >
          Compose
        </Button>

        <Button
          onClick={onSync}
          disabled={isSyncing}
          variant="outlined"
          fullWidth
          startIcon={<SyncIcon sx={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />}
          sx={{
            mt: 1,
            height: 40,
            borderRadius: 6,
            textTransform: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          {isSyncing ? 'Syncing...' : 'Sync Emails'}
        </Button>
      </Box>

      {/* Main Navigation */}
      <List sx={{ flex: 1, pt: 0 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isSelected = folder === item.id;
          const unreadCount = unreadCounts?.[item.id] || 0;

          return (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => setFolder(item.id)}
                sx={{
                  borderRadius: '0 100px 100px 0',
                  mr: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                    fontWeight: 600,
                    '&:hover': {
                      bgcolor: 'primary.light',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: isSelected ? 'inherit' : 'text.secondary' }}>
                  <Icon />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isSelected ? 600 : 400,
                  }}
                />
                {unreadCount > 0 && (
                  <Badge
                    badgeContent={unreadCount}
                    color="primary"
                    sx={{ ml: 1 }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}

        <Divider sx={{ my: 2, mx: 2 }} />

        {/* Filters Header */}
        <Typography
          variant="caption"
          sx={{
            px: 3,
            py: 1,
            fontWeight: 600,
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Filters
        </Typography>

        {/* Filter Items */}
        {filters.map((item) => {
          const Icon = item.icon;
          const isSelected = folder === item.id;

          return (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => setFolder(item.id)}
                sx={{
                  borderRadius: '0 100px 100px 0',
                  mr: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                    fontWeight: 600,
                    '&:hover': {
                      bgcolor: 'primary.light',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: isSelected ? 'inherit' : 'text.secondary' }}>
                  <Icon />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isSelected ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}
