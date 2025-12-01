import { ReactNode } from "react";
import { Box } from '@mui/material';

interface EmailLayoutProps {
    sidebar: ReactNode;
    list: ReactNode;
    thread: ReactNode;
    className?: string;
}

export function EmailLayout({ sidebar, list, thread, className }: EmailLayoutProps) {
    return (
        <Box
            sx={{
                display: 'flex',
                height: 'calc(100vh - 4rem)',
                overflow: 'hidden',
                bgcolor: 'background.default',
            }}
            className={className}
        >
            {/* Sidebar - Gmail style fixed width */}
            <Box
                sx={{
                    width: 256,
                    minWidth: 256,
                    height: '100%',
                    borderRight: 1,
                    borderColor: 'divider',
                    display: { xs: 'none', md: 'block' },
                    bgcolor: 'background.paper',
                }}
            >
                {sidebar}
            </Box>

            {/* Email List - fixed width like Gmail */}
            <Box
                sx={{
                    width: 420,
                    minWidth: 350,
                    maxWidth: 500,
                    height: '100%',
                    borderRight: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    overflow: 'hidden',
                }}
            >
                {list}
            </Box>

            {/* Email Thread View - takes remaining space */}
            <Box
                sx={{
                    flex: 1,
                    height: '100%',
                    overflow: 'hidden',
                    bgcolor: 'background.default',
                }}
            >
                {thread}
            </Box>
        </Box>
    );
}
