import { createTheme } from '@mui/material/styles';

/**
 * MUI Theme configuration for ThriftHub email client
 * Matches ThriftHub's existing color scheme and design system
 */
export const muiTheme = createTheme({
    palette: {
        primary: {
            main: '#3b82f6', // ThriftHub blue
            light: '#60a5fa',
            dark: '#2563eb',
        },
        secondary: {
            main: '#8b5cf6', // ThriftHub purple
            light: '#a78bfa',
            dark: '#7c3aed',
        },
        background: {
            default: '#ffffff',
            paper: '#f9fafb',
        },
        text: {
            primary: '#111827',
            secondary: '#6b7280',
        },
    },
    typography: {
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: 14,
        h1: { fontWeight: 600 },
        h2: { fontWeight: 600 },
        h3: { fontWeight: 600 },
        h4: { fontWeight: 600 },
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
    },
    shape: {
        borderRadius: 8,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none', // No uppercase
                    fontWeight: 500,
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                },
            },
        },
    },
});
