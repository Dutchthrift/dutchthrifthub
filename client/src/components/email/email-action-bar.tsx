import { useState } from 'react';
import {
    ButtonGroup,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Box,
    Typography,
    Alert,
    CircularProgress
} from '@mui/material';
import {
    ShoppingCart,
    Description,
    Undo,
    Build
} from '@mui/icons-material';
import { extractOrderNumber, extractCustomerInfo } from '@/lib/email-content-parser';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

interface EmailActionBarProps {
    threadId: string;
    emailContent: string;
    emailSubject: string;
    customerEmail: string;
    uid?: number;
}

export function EmailActionBar({
    threadId,
    emailContent,
    emailSubject,
    customerEmail,
    uid
}: EmailActionBarProps) {
    const [dialogOpen, setDialogOpen] = useState<'order' | 'case' | 'return' | 'repair' | null>(null);
    const [orderNumber, setOrderNumber] = useState('');
    const [caseTitle, setCaseTitle] = useState('');
    const [caseDescription, setCaseDescription] = useState('');
    const { toast } = useToast();

    const { data: fetchedBodyData } = useQuery({
        queryKey: ['email-body', uid],
        queryFn: async () => {
            if (!uid) return null;
            const response = await fetch(`/api/emails/${uid}/body`);
            if (!response.ok) throw new Error('Failed to fetch email body');
            return response.json();
        },
        enabled: !!uid && !emailContent,
    });

    const effectiveContent = emailContent || fetchedBodyData?.body || '';

    // Auto-extract order number when opening dialogs
    const handleOpenDialog = (type: 'order' | 'case' | 'return' | 'repair') => {
        const extractedOrderNumber = extractOrderNumber(effectiveContent + ' ' + emailSubject);
        if (extractedOrderNumber) {
            setOrderNumber(extractedOrderNumber);
        }

        if (type === 'case') {
            setCaseTitle(emailSubject);
            setCaseDescription(effectiveContent.substring(0, 500)); // First 500 chars
        }

        setDialogOpen(type);
    };

    // Mutation: Link to Order
    const linkToOrderMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/emails/link-to-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emailThreadId: threadId,
                    orderId: orderNumber,
                }),
            });
            if (!response.ok) throw new Error('Failed to link order');
            return response.json();
        },
        onSuccess: () => {
            toast({
                title: 'Success',
                description: `Email linked to order #${orderNumber}`,
            });
            queryClient.invalidateQueries({ queryKey: ['/api/email-threads'] });
            setDialogOpen(null);
        },
        onError: () => {
            toast({
                title: 'Error',
                description: 'Failed to link email to order',
                variant: 'destructive',
            });
        },
    });

    // Mutation: Create Case
    const createCaseMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/emails/create-case', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emailThreadId: threadId,
                    caseData: {
                        title: caseTitle,
                        description: caseDescription,
                        customerEmail,
                        status: 'open',
                    },
                }),
            });
            if (!response.ok) throw new Error('Failed to create case');
            return response.json();
        },
        onSuccess: (data) => {
            toast({
                title: 'Success',
                description: 'Case created successfully',
            });
            queryClient.invalidateQueries({ queryKey: ['/api/email-threads'] });
            setDialogOpen(null);
            // Navigate to case
            window.location.href = `/cases/${data.caseId}`;
        },
        onError: () => {
            toast({
                title: 'Error',
                description: 'Failed to create case',
                variant: 'destructive',
            });
        },
    });

    // Mutation: Create Return
    const createReturnMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/emails/create-return', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emailThreadId: threadId,
                    orderId: orderNumber,
                    returnData: {
                        reason: 'Customer request via email',
                        status: 'pending',
                    },
                }),
            });
            if (!response.ok) throw new Error('Failed to create return');
            return response.json();
        },
        onSuccess: (data) => {
            toast({
                title: 'Success',
                description: 'Return created successfully',
            });
            queryClient.invalidateQueries({ queryKey: ['/api/email-threads'] });
            setDialogOpen(null);
            window.location.href = `/returns/${data.returnId}`;
        },
        onError: () => {
            toast({
                title: 'Error',
                description: 'Failed to create return',
                variant: 'destructive',
            });
        },
    });

    // Mutation: Create Repair
    const createRepairMutation = useMutation({
        mutationFn: async () => {
            const customerInfo = extractCustomerInfo(effectiveContent, customerEmail);
            const response = await fetch('/api/emails/create-repair', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emailThreadId: threadId,
                    repairData: {
                        description: emailSubject,
                        customerEmail,
                        customerName: customerInfo.name,
                        status: 'intake',
                    },
                }),
            });
            if (!response.ok) throw new Error('Failed to create repair');
            return response.json();
        },
        onSuccess: (data) => {
            toast({
                title: 'Success',
                description: 'Repair created successfully',
            });
            queryClient.invalidateQueries({ queryKey: ['/api/email-threads'] });
            setDialogOpen(null);
            window.location.href = `/repairs/${data.repairId}`;
        },
        onError: () => {
            toast({
                title: 'Error',
                description: 'Failed to create repair',
                variant: 'destructive',
            });
        },
    });

    return (
        <>
            <ButtonGroup variant="outlined" size="small" sx={{ mt: 2 }}>
                <Button
                    startIcon={<ShoppingCart />}
                    onClick={() => handleOpenDialog('order')}
                >
                    Order Koppelen
                </Button>
                <Button
                    startIcon={<Description />}
                    onClick={() => handleOpenDialog('case')}
                >
                    Case Aanmaken
                </Button>
                <Button
                    startIcon={<Undo />}
                    onClick={() => handleOpenDialog('return')}
                >
                    Retour Aanmaken
                </Button>
                <Button
                    startIcon={<Build />}
                    onClick={() => handleOpenDialog('repair')}
                >
                    Reparatie Aanmaken
                </Button>
            </ButtonGroup>

            {/* Order Dialog */}
            <Dialog open={dialogOpen === 'order'} onClose={() => setDialogOpen(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Koppel Email aan Order</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        {extractOrderNumber(effectiveContent + ' ' + emailSubject) && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Ordernummer automatisch gedetecteerd!
                            </Alert>
                        )}
                        <TextField
                            label="Ordernummer"
                            value={orderNumber}
                            onChange={(e) => setOrderNumber(e.target.value)}
                            fullWidth
                            placeholder="Bijv: 12345"
                            helperText="Voer het ordernummer in"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(null)}>Annuleren</Button>
                    <Button
                        onClick={() => linkToOrderMutation.mutate()}
                        variant="contained"
                        disabled={!orderNumber || linkToOrderMutation.isPending}
                    >
                        {linkToOrderMutation.isPending ? <CircularProgress size={20} /> : 'Koppelen'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Case Dialog */}
            <Dialog open={dialogOpen === 'case'} onClose={() => setDialogOpen(null)} maxWidth="md" fullWidth>
                <DialogTitle>Nieuwe Case Aanmaken</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Case Titel"
                            value={caseTitle}
                            onChange={(e) => setCaseTitle(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="Beschrijving"
                            value={caseDescription}
                            onChange={(e) => setCaseDescription(e.target.value)}
                            fullWidth
                            multiline
                            rows={4}
                        />
                        <Typography variant="caption" color="text.secondary">
                            Klant: {customerEmail}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(null)}>Annuleren</Button>
                    <Button
                        onClick={() => createCaseMutation.mutate()}
                        variant="contained"
                        disabled={!caseTitle || createCaseMutation.isPending}
                    >
                        {createCaseMutation.isPending ? <CircularProgress size={20} /> : 'Case Aanmaken'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Return Dialog */}
            <Dialog open={dialogOpen === 'return'} onClose={() => setDialogOpen(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Retour Aanmaken</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        {extractOrderNumber(effectiveContent + ' ' + emailSubject) && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Ordernummer automatisch gedetecteerd!
                            </Alert>
                        )}
                        <TextField
                            label="Ordernummer"
                            value={orderNumber}
                            onChange={(e) => setOrderNumber(e.target.value)}
                            fullWidth
                            placeholder="Bijv: 12345"
                            helperText="Voer het ordernummer in voor de retour"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(null)}>Annuleren</Button>
                    <Button
                        onClick={() => createReturnMutation.mutate()}
                        variant="contained"
                        disabled={!orderNumber || createReturnMutation.isPending}
                    >
                        {createReturnMutation.isPending ? <CircularProgress size={20} /> : 'Retour Aanmaken'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Repair Dialog */}
            <Dialog open={dialogOpen === 'repair'} onClose={() => setDialogOpen(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Reparatie Aanmaken</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Reparatie wordt aangemaakt voor: {customerEmail}
                        </Alert>
                        <Typography variant="body2" color="text.secondary">
                            Onderwerp: {emailSubject}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(null)}>Annuleren</Button>
                    <Button
                        onClick={() => createRepairMutation.mutate()}
                        variant="contained"
                        disabled={createRepairMutation.isPending}
                    >
                        {createRepairMutation.isPending ? <CircularProgress size={20} /> : 'Reparatie Aanmaken'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
