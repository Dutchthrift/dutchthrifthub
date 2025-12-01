import { formatDistanceToNow } from "date-fns";
import {
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Checkbox,
  IconButton,
  Chip,
  Box,
  Typography,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Star,
  StarBorder,
  Archive as ArchiveIcon,
  Delete as DeleteIcon,
  FiberManualRecord,
  Mail as MailIcon
} from '@mui/icons-material';
import { EmailThread } from "@shared/schema";

interface EmailListProps {
  threads: EmailThread[];
  selectedThreadId?: string | null;
  onSelectThread: (threadId: string) => void;
  onToggleStar?: (threadId: string, e: React.MouseEvent) => void;
  onArchive?: (threadId: string, e: React.MouseEvent) => void;
  onDelete?: (threadId: string, e: React.MouseEvent) => void;
  onToggleRead?: (threadId: string, e: React.MouseEvent) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function EmailList({
  threads,
  selectedThreadId,
  onSelectThread,
  onToggleStar,
  onArchive,
  onDelete,
  onToggleRead,
  onLoadMore,
  hasMore,
  isLoadingMore
}: EmailListProps) {
  if (threads.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          p: 8,
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            bgcolor: 'action.hover',
            p: 4,
            borderRadius: '50%',
            mb: 4,
          }}
        >
          <MailIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
        </Box>
        <Typography variant="h6" gutterBottom>
          No emails found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your inbox is empty
        </Typography>
      </Box>
    );
  }

  return (
    <List sx={{ height: '100%', overflow: 'auto', p: 0, bgcolor: 'background.paper' }}>
      {threads.map((thread) => {
        const isSelected = selectedThreadId === thread.id;
        const isUnread = thread.isUnread;

        // Get initials for avatar
        const initials = (thread.customerEmail || "?")
          .split("@")[0]
          .substring(0, 2)
          .toUpperCase();

        // Generate a consistent color based on email
        const colors = [
          { bg: '#fee2e2', text: '#b91c1c' },
          { bg: '#dcfce7', text: '#15803d' },
          { bg: '#dbeafe', text: '#1d4ed8' },
          { bg: '#fef3c7', text: '#a16207' },
          { bg: '#f3e8ff', text: '#7c3aed' },
          { bg: '#fce7f3', text: '#be185d' },
        ];
        const colorIndex = (thread.customerEmail?.length || 0) % colors.length;
        const avatarColor = colors[colorIndex];

        return (
          <ListItem
            key={thread.id}
            disablePadding
            secondaryAction={
              <Box
                sx={{
                  display: 'none',
                  gap: 0.5,
                  '.MuiListItem-root:hover &': {
                    display: 'flex',
                  },
                }}
              >
                <Tooltip title={thread.starred ? "Unstar" : "Star"}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar?.(thread.id, e);
                    }}
                  >
                    {thread.starred ? (
                      <Star sx={{ color: '#eab308', fontSize: 20 }} />
                    ) : (
                      <StarBorder sx={{ fontSize: 20 }} />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Archive">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive?.(thread.id, e);
                    }}
                  >
                    <ArchiveIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(thread.id, e);
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={isUnread ? "Mark as read" : "Mark as unread"}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleRead?.(thread.id, e);
                    }}
                  >
                    <FiberManualRecord
                      sx={{
                        fontSize: 12,
                        color: isUnread ? 'primary.main' : 'action.disabled',
                      }}
                    />
                  </IconButton>
                </Tooltip>
              </Box>
            }
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: isSelected
                ? 'primary.light'
                : isUnread
                  ? 'background.paper'
                  : 'action.hover',
              '&:hover': {
                bgcolor: isSelected ? 'primary.light' : 'action.hover',
              },
              borderLeft: isSelected ? 4 : 0,
              borderLeftColor: 'primary.main',
            }}
          >
            <ListItemButton
              selected={isSelected}
              onClick={() => onSelectThread(thread.id)}
              sx={{
                py: 1.5,
                px: 2,
              }}
            >
              <ListItemAvatar>
                <Avatar
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: avatarColor.bg,
                    color: avatarColor.text,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  {initials}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isUnread ? 700 : 500,
                        color: isUnread ? 'text.primary' : 'text.secondary',
                      }}
                      noWrap
                    >
                      {thread.customerEmail}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: isUnread ? 'primary.main' : 'text.secondary',
                        fontWeight: isUnread ? 600 : 400,
                        ml: 1,
                      }}
                    >
                      {thread.lastActivity ? formatDistanceToNow(new Date(thread.lastActivity), { addSuffix: true }) : ''}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isUnread ? 600 : 400,
                        color: isUnread ? 'text.primary' : 'text.secondary',
                        mb: 0.5,
                      }}
                      noWrap
                    >
                      {thread.subject}
                    </Typography>
                    {thread.orderId && (
                      <Chip
                        label={`Order #${thread.orderId}`}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.75rem' }}
                      />
                    )}
                  </Box>
                }
              />
            </ListItemButton>
          </ListItem>
        );
      })}

      {/* Loading indicator and infinite scroll trigger */}
      {hasMore && (
        <Box
          sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'center',
            opacity: isLoadingMore ? 1 : 0.5
          }}
        >
          {isLoadingMore ? (
            <CircularProgress size={24} />
          ) : (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ cursor: 'pointer' }}
              onClick={onLoadMore}
            >
              Load more
            </Typography>
          )}
        </Box>
      )}

      {/* Intersection observer target could be added here for auto-loading */}
      <div
        style={{ height: 20 }}
        ref={(node) => {
          if (node && hasMore && !isLoadingMore && onLoadMore) {
            const observer = new IntersectionObserver(
              (entries) => {
                if (entries[0].isIntersecting) {
                  onLoadMore();
                }
              },
              { threshold: 0.5 }
            );
            observer.observe(node);
            return () => observer.disconnect();
          }
        }}
      />
    </List>
  );
}
