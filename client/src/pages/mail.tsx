import { useState, useEffect, useRef } from 'react';
import { Navigation } from "@/components/layout/navigation";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { CreateCaseModal } from '@/components/forms/create-case-modal';
import { CreateReturnWizard } from '@/components/returns/create-return-wizard';
import { CreateRepairWizard } from '@/components/repairs/create-repair-wizard';

import { EmailThreadMessage } from '@/components/email/email-thread-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
    RefreshCw,
    Search,
    Archive,
    Star,
    Mail,
    Inbox,
    Send,
    Package,
    Briefcase,
    RotateCcw,
    Wrench,
    ChevronRight,
    User,
    Paperclip,
    Clock,
    ExternalLink,
    Plus,
    X
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useLocation } from 'wouter';
import { Textarea } from '@/components/ui/textarea';
import { CaseDetailModal } from '@/components/cases/case-detail-modal';
import { ReturnDetailModalContent } from '@/components/returns/return-detail-modal-content';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

// --- Types ---

interface Participant {
    name: string;
    email: string;
}

interface EmailThread {
    id: string;
    threadId: string;
    subject: string;
    snippet: string;
    participants: Participant[];
    messageCount: number;
    lastActivity: string;
    isUnread: boolean;
    starred: boolean;
    archived: boolean;
    folder: string;
    orderId?: string;
    caseId?: string;
}

interface ThreadMessage {
    id: string;
    messageId: string; // Gmail message ID for API calls
    fromName: string;
    fromEmail: string;
    to: Participant[];
    cc: Participant[];
    subject: string;
    body: string;
    bodyText?: string;
    bodyClean?: string;
    snippet: string;
    sentAt: string;
    isOutbound: boolean;
    isHtml: boolean;
    attachments?: { filename: string; mimeType: string; size: number; gmailAttachmentId: string }[];
}

interface ThreadDetails extends EmailThread {
    messages: ThreadMessage[];
    links: any[];
}

// --- Main Page ---

export default function MailPage() {
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'archived' | 'starred' | 'linked' | 'unlinked'>('inbox');
    const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
    const [isReplying, setIsReplying] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isComposing, setIsComposing] = useState(false);
    const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [location, navigate] = useLocation();

    // Check URL parameters for thread selection on load
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const threadId = searchParams.get('threadId');
        if (threadId) {
            setSelectedThreadId(threadId);
            // Optionally clear the query param after handling
            // navigate('/mail', { replace: true }); 
        }
    }, []);

    // Fetch Threads
    const { data: threadsData, isLoading: isLoadingThreads } = useQuery<{ threads: EmailThread[], total: number }>({
        queryKey: ['mailThreads', activeTab, searchQuery],
        queryFn: async () => {
            let url = `/api/mail/list?limit=50&folder=${activeTab === 'inbox' ? 'inbox' : activeTab === 'sent' ? 'sent' : ''}&archived=${activeTab === 'archived'}&starred=${activeTab === 'starred'}`;
            if (activeTab === 'linked') url += '&hasOrder=true';
            if (activeTab === 'unlinked') url += '&hasOrder=false';

            const res = await fetch(url);
            if (!res.ok) throw new Error('Kon threads niet laden');
            return res.json();
        }
    });

    // State for creation wizards from context menu
    const [createCaseOpen, setCreateCaseOpen] = useState(false);
    const [createReturnOpen, setCreateReturnOpen] = useState(false);
    const [createRepairOpen, setCreateRepairOpen] = useState(false);
    const [contextThread, setContextThread] = useState<EmailThread | null>(null);

    // Helper to open wizard with thread context
    const openWizardWithContext = (thread: EmailThread, type: 'case' | 'return' | 'repair') => {
        setContextThread(thread);
        if (type === 'case') setCreateCaseOpen(true);
        if (type === 'return') setCreateReturnOpen(true);
        if (type === 'repair') setCreateRepairOpen(true);
    };

    // Fetch Thread Details
    const { data: threadDetails, isLoading: isLoadingDetails } = useQuery<ThreadDetails>({
        queryKey: ['mailThread', selectedThreadId],
        queryFn: async () => {
            const res = await fetch(`/api/mail/${selectedThreadId}`);
            if (!res.ok) throw new Error('Kon thread niet laden');
            return res.json();
        },
        enabled: !!selectedThreadId
    });

    // Fetch related context (orders, cases, returns) based on sender email
    const { data: contextData } = useQuery<{
        customerEmail: string | null;
        orders: any[];
        cases: any[];
        returns: any[];
    }>({
        queryKey: ['mailContext', selectedThreadId],
        queryFn: async () => {
            const res = await fetch(`/api/mail/${selectedThreadId}/context`);
            if (!res.ok) throw new Error('Kon context niet laden');
            return res.json();
        },
        enabled: !!selectedThreadId
    });

    // Fetch order details for modal
    const { data: selectedOrder, isLoading: isLoadingOrder } = useQuery<any>({
        queryKey: ['order', selectedOrderId],
        queryFn: async () => {
            const res = await fetch(`/api/orders/${selectedOrderId}`);
            if (!res.ok) throw new Error('Kon order niet laden');
            return res.json();
        },
        enabled: !!selectedOrderId
    });

    // Fetch return details for modal
    const { data: selectedReturnData, isLoading: isLoadingReturn } = useQuery<any>({
        queryKey: ['/api/returns', selectedReturnId],
        enabled: !!selectedReturnId
    });

    // Refresh Mutation

    const refreshMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/mail/refresh', { method: 'POST' });
            if (!res.ok) throw new Error('Fout bij synchronisatie');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mailThreads'] });
            toast({ title: "Bijgewerkt", description: "Mailbox gesynchroniseerd met Gmail" });
        },
        onError: (err: any) => {
            toast({ title: "Fout", description: err.message, variant: "destructive" });
        }
    });

    // Reply mutation
    const replyMutation = useMutation({
        mutationFn: async (data: { threadId: string; to: string; subject: string; body: string; inReplyTo?: string }) => {
            const res = await fetch('/api/mail/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Fout bij verzenden');
            }
            return res.json();
        },
        onSuccess: () => {
            setIsReplying(false);
            setReplyText('');
            queryClient.invalidateQueries({ queryKey: ['mailThread', selectedThreadId] });
            toast({ title: "Verzonden", description: "Je antwoord is verzonden" });
        },
        onError: (err: any) => {
            toast({ title: "Fout", description: err.message, variant: "destructive" });
        }
    });

    // Compose mutation
    const composeMutation = useMutation({
        mutationFn: async (data: { to: string; subject: string; body: string }) => {
            const res = await fetch('/api/mail/compose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Fout bij verzenden');
            }
            return res.json();
        },
        onSuccess: (data) => {
            setIsComposing(false);
            setComposeData({ to: '', subject: '', body: '' });
            queryClient.invalidateQueries({ queryKey: ['mailThreads'] });
            toast({ title: "Verzonden", description: "Je email is verzonden" });

            // Optionally select the new thread
            if (data.threadId) {
                // Wait for sync to complete (happening in background on server)
                setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: ['mailThreads'] });
                }, 3000);
            }
        },
        onError: (err: any) => {
            toast({ title: "Fout", description: err.message, variant: "destructive" });
        }
    });

    const threads = threadsData?.threads || [];

    return (
        <>
            <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
                <Navigation />

                <div className="flex-1 flex overflow-hidden">
                    {/* Column 1: Thread List */}
                    <div className="w-96 flex-shrink-0 flex flex-col border-r bg-muted/20">
                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h1 className="text-xl font-bold">Mail</h1>
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="sm"
                                        className="bg-orange-500 hover:bg-orange-600 gap-2 h-8"
                                        onClick={() => setIsComposing(true)}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Nieuw bericht
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
                                        <RefreshCw className={cn("h-4 w-4", refreshMutation.isPending && "animate-spin")} />
                                    </Button>
                                </div>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Zoek in mailbox..."
                                    className="pl-9 h-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                                <FilterChip active={activeTab === 'inbox'} label="Inbox" icon={<Inbox className="h-3 w-3" />} onClick={() => setActiveTab('inbox')} />
                                <FilterChip active={activeTab === 'sent'} label="Verzonden" icon={<Send className="h-3 w-3" />} onClick={() => setActiveTab('sent')} />
                                <FilterChip active={activeTab === 'starred'} label="Ster" icon={<Star className="h-3 w-3" />} onClick={() => setActiveTab('starred')} />
                                <FilterChip active={activeTab === 'linked'} label="Gekoppeld" icon={<Package className="h-3 w-3" />} onClick={() => setActiveTab('linked')} />
                                <FilterChip active={activeTab === 'unlinked'} label="Niet gekoppeld" icon={<Mail className="h-3 w-3" />} onClick={() => setActiveTab('unlinked')} />
                                <FilterChip active={activeTab === 'archived'} label="Archief" icon={<Archive className="h-3 w-3" />} onClick={() => setActiveTab('archived')} />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {isLoadingThreads ? (
                                <div className="p-4 space-y-4">
                                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                                </div>
                            ) : threads.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">Geen berichten gevonden</div>
                            ) : (
                                threads.map(thread => (
                                    <ContextMenu key={thread.id}>
                                        <ContextMenuTrigger>
                                            <ThreadCard
                                                thread={thread}
                                                isSelected={selectedThreadId === thread.id}
                                                onClick={() => setSelectedThreadId(thread.id)}
                                            />
                                        </ContextMenuTrigger>
                                        <ContextMenuContent>
                                            <ContextMenuLabel className="font-normal text-xs text-muted-foreground ml-2">
                                                Acties voor {thread.subject.substring(0, 20)}...
                                            </ContextMenuLabel>
                                            <ContextMenuSeparator />
                                            {thread.caseId ? (
                                                <ContextMenuItem onClick={() => setSelectedCaseId(thread.caseId || null)}>
                                                    <Briefcase className="mr-2 h-4 w-4 text-emerald-500" />
                                                    Bekijk Case
                                                </ContextMenuItem>
                                            ) : (
                                                <ContextMenuItem onClick={() => openWizardWithContext(thread, 'case')}>
                                                    <Briefcase className="mr-2 h-4 w-4 text-blue-500" />
                                                    Nieuwe Case
                                                </ContextMenuItem>
                                            )}
                                            <ContextMenuItem onClick={() => openWizardWithContext(thread, 'return')}>
                                                <RotateCcw className="mr-2 h-4 w-4 text-purple-500" />
                                                Nieuw Retour
                                            </ContextMenuItem>
                                            <ContextMenuItem onClick={() => openWizardWithContext(thread, 'repair')}>
                                                <Wrench className="mr-2 h-4 w-4 text-amber-500" />
                                                Reparatie Inplannen
                                            </ContextMenuItem>
                                        </ContextMenuContent>
                                    </ContextMenu>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Column 2: Conversation View */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-background">
                        {!selectedThreadId ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                                <Mail className="h-12 w-12 mb-4 opacity-10" />
                                <p>Selecteer een bericht om te lezen</p>
                            </div>
                        ) : isLoadingDetails ? (
                            <div className="flex-1 p-8 space-y-8">
                                <Skeleton className="h-10 w-2/3" />
                                <Skeleton className="h-40 w-full" />
                                <Skeleton className="h-40 w-full" />
                            </div>
                        ) : threadDetails ? (
                            <>
                                {/* Thread Header */}
                                <div className="p-6 border-b flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-semibold mb-1">{threadDetails.subject}</h2>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {(threadDetails.participants || []).map(p => p.name || p.email).join(', ') || 'Unknown'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                Sinds {formatDistanceToNow(new Date(threadDetails.lastActivity), { addSuffix: true, locale: nl })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" className="gap-2">
                                            <Star className={cn("h-4 w-4", threadDetails.starred && "fill-yellow-400 text-yellow-400")} />
                                            Ster
                                        </Button>
                                        <Button variant="outline" size="sm" className="gap-2">
                                            <Archive className="h-4 w-4" />
                                            Archiveer
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="gap-2 bg-orange-500 hover:bg-orange-600"
                                            onClick={() => {
                                                setIsReplying(true);
                                                // Pre-scroll to composer
                                                setTimeout(() => {
                                                    document.getElementById('reply-composer')?.scrollIntoView({ behavior: 'smooth' });
                                                }, 100);
                                            }}
                                        >
                                            <Reply className="h-4 w-4" />
                                            Beantwoorden
                                        </Button>
                                    </div>
                                </div>

                                {/* Messages List - Newest first */}
                                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
                                    {[...threadDetails.messages].reverse().map((msg, idx, arr) => (
                                        <MessageItem
                                            key={msg.id}
                                            message={msg}
                                            isFirst={idx === arr.length - 1}
                                            isLatest={idx === 0}
                                        />
                                    ))}

                                    {/* Reply Composer */}
                                    {isReplying && (
                                        <div id="reply-composer" className="mt-8 p-4 border rounded-lg bg-card shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
                                            <div className="flex items-center justify-between mb-4 pb-2 border-b">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                                                        J
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold">Concept antwoord</p>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            Aan: {threadDetails.messages[threadDetails.messages.length - 1].fromEmail}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button size="icon" variant="ghost" onClick={() => setIsReplying(false)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <Textarea
                                                placeholder="Schrijf je antwoord hier..."
                                                className="min-h-[200px] mb-4 border-none focus-visible:ring-0 resize-none p-0"
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                autoFocus
                                            />

                                            <div className="flex items-center justify-between pt-2 border-t">
                                                <div className="flex items-center gap-2">
                                                    {/* Future: Attachments, Bold, Italic buttons */}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="ghost" onClick={() => setIsReplying(false)}>
                                                        Annuleren
                                                    </Button>
                                                    <Button
                                                        className="bg-orange-600 hover:bg-orange-700 gap-2"
                                                        disabled={!replyText.trim() || replyMutation.isPending}
                                                        onClick={() => {
                                                            const latestMsg = threadDetails.messages[threadDetails.messages.length - 1];
                                                            replyMutation.mutate({
                                                                threadId: threadDetails.id,
                                                                to: latestMsg.fromEmail,
                                                                subject: threadDetails.subject.startsWith('Re:') ? threadDetails.subject : `Re: ${threadDetails.subject}`,
                                                                body: replyText.replace(/\n/g, '<br/>'),
                                                                inReplyTo: latestMsg.messageId
                                                            });
                                                        }}
                                                    >
                                                        {replyMutation.isPending ? (
                                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Send className="h-4 w-4" />
                                                        )}
                                                        Verzenden
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>


                            </>
                        ) : null}
                    </div>

                    {/* Column 3: Context Sidebar */}
                    {selectedThreadId && threadDetails && (
                        <div className="w-80 flex-shrink-0 border-l bg-muted/10 p-4 overflow-y-auto">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Context</h3>
                            {contextData?.customerEmail && (
                                <p className="text-xs text-muted-foreground mb-4">
                                    Klant: <span className="font-medium">{contextData.customerEmail}</span>
                                </p>
                            )}

                            <div className="space-y-6">
                                {/* Related Orders */}
                                <ContextSection
                                    title={`📦 Orders (${contextData?.orders?.length || 0})`}
                                    isLinked={!!threadDetails.orderId}
                                    onLink={() => toast({ title: "Koppelen", description: "Order koppelings-venster..." })}
                                >
                                    {contextData?.orders && contextData.orders.length > 0 ? (
                                        <div className="space-y-3">
                                            {contextData.orders.slice(0, 5).map((order: any) => (
                                                <div
                                                    key={order.id}
                                                    className="group relative p-3 bg-white/50 hover:bg-white border rounded-lg cursor-pointer transition-all hover:shadow-sm"
                                                    onClick={() => setSelectedOrderId(order.id)}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-bold text-sm tracking-tight">{order.orderNumber}</span>
                                                        <Badge variant="secondary" className={cn(
                                                            "text-[10px] uppercase font-bold px-1.5",
                                                            (order.fulfillmentStatus === 'fulfilled' || order.status === 'completed') ? "bg-green-100 text-green-700" :
                                                                (order.fulfillmentStatus === 'partial' || order.status === 'processing') ? "bg-blue-100 text-blue-700" :
                                                                    "bg-gray-100 text-gray-700"
                                                        )}>
                                                            {order.fulfillmentStatus || order.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                        <span>{order.orderDate ? format(new Date(order.orderDate), 'd MMM', { locale: nl }) : '-'}</span>
                                                        <span className="font-medium text-foreground">€{((order.totalAmount || 0) / 100).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {contextData.orders.length > 5 && (
                                                <p className="text-xs text-center text-muted-foreground italic">
                                                    +{contextData.orders.length - 5} oudere orders...
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center p-4 border border-dashed rounded-lg bg-muted/20">
                                            <p className="text-xs text-muted-foreground">Geen orders gevonden</p>
                                        </div>
                                    )}
                                </ContextSection>

                                {/* Related Cases */}
                                <ContextSection
                                    title={`📂 Cases (${contextData?.cases?.length || 0})`}
                                    isLinked={!!threadDetails.caseId}
                                    onLink={() => toast({ title: "Case maken", description: "Case creatie venster..." })}
                                >
                                    {contextData?.cases && contextData.cases.length > 0 ? (
                                        <div className="space-y-3">
                                            {contextData.cases.slice(0, 5).map((c: any) => {
                                                const statusColor = c.status === 'new' ? "bg-blue-100 text-blue-700" :
                                                    c.status === 'in_progress' ? "bg-amber-100 text-amber-700" :
                                                        c.status === 'closed' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700";
                                                return (
                                                    <div
                                                        key={c.id}
                                                        className="p-3 bg-white/50 hover:bg-white border rounded-lg cursor-pointer transition-all hover:shadow-sm"
                                                        onClick={() => setSelectedCaseId(c.id)}
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="font-bold text-sm">{c.caseNumber}</span>
                                                            <Badge variant="outline" className={cn("text-[10px] uppercase font-bold border-0", statusColor)}>
                                                                {c.status}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{c.title}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center p-4 border border-dashed rounded-lg bg-muted/20">
                                            <p className="text-xs text-muted-foreground">Geen cases gevonden</p>
                                        </div>
                                    )}
                                </ContextSection>

                                {/* Related Returns */}
                                <ContextSection
                                    title={`↩️ Retouren (${contextData?.returns?.length || 0})`}
                                    isLinked={false}
                                    onLink={() => { }}
                                >
                                    {contextData?.returns && contextData.returns.length > 0 ? (
                                        <div className="space-y-3">
                                            {contextData.returns.slice(0, 5).map((ret: any) => (
                                                <div
                                                    key={ret.id}
                                                    className="p-3 bg-white/50 hover:bg-white border rounded-lg cursor-pointer transition-all hover:shadow-sm"
                                                    onClick={() => setSelectedReturnId(ret.id)}
                                                >
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-sm">{ret.returnNumber}</span>
                                                        <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-700">
                                                            {ret.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {ret.items && ret.items.length > 0 ? (
                                                            <span>{ret.items.length} item{ret.items.length > 1 ? 's' : ''}</span>
                                                        ) : (
                                                            <span>Geen items</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center p-4 border border-dashed rounded-lg bg-muted/20">
                                            <p className="text-xs text-muted-foreground">Geen retouren gevonden</p>
                                        </div>
                                    )}
                                </ContextSection>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Case Detail Modal */}
            {selectedCaseId && (
                <CaseDetailModal
                    caseId={selectedCaseId}
                    open={!!selectedCaseId}
                    onClose={() => setSelectedCaseId(null)}
                />
            )}

            {/* Creation Modals from Context Menu */}
            <CreateCaseModal
                open={createCaseOpen}
                onOpenChange={setCreateCaseOpen}
                emailThread={contextThread}
            />

            <CreateReturnWizard
                open={createReturnOpen}
                onOpenChange={setCreateReturnOpen}
                emailThreadId={contextThread?.id}
                customerEmail={contextThread?.participants?.[0]?.email}
            />

            <CreateRepairWizardWrapper
                open={createRepairOpen}
                onOpenChange={setCreateRepairOpen}
                emailThreadId={contextThread?.id}
            />

            {/* Order Detail Modal */}
            <Dialog open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Order {selectedOrder?.orderNumber}</DialogTitle>
                        <DialogDescription>Order details</DialogDescription>
                    </DialogHeader>
                    {isLoadingOrder ? (
                        <div className="p-4 text-center text-muted-foreground">Laden...</div>
                    ) : selectedOrder ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-muted/30 rounded-lg">
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    <Badge className="mt-1">{selectedOrder.fulfillmentStatus || selectedOrder.status}</Badge>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg">
                                    <p className="text-sm text-muted-foreground">Totaal</p>
                                    <p className="font-bold">€{((selectedOrder.totalAmount || 0) / 100).toFixed(2)}</p>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg">
                                    <p className="text-sm text-muted-foreground">Klant Email</p>
                                    <p className="text-sm">{selectedOrder.customerEmail || '-'}</p>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg">
                                    <p className="text-sm text-muted-foreground">Order Datum</p>
                                    <p className="text-sm">{selectedOrder.orderDate ? format(new Date(selectedOrder.orderDate), 'd MMM yyyy', { locale: nl }) : '-'}</p>
                                </div>
                            </div>
                            {selectedOrder.orderData?.line_items && (
                                <div className="border rounded-lg p-3">
                                    <h4 className="font-medium mb-2">Producten</h4>
                                    <div className="space-y-2">
                                        {selectedOrder.orderData.line_items.map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between text-sm">
                                                <span>{item.title || item.name} × {item.quantity}</span>
                                                <span>€{(parseFloat(item.price) || 0).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <Button variant="outline" className="w-full" onClick={() => navigate(`/orders`)}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Bekijk op Orders pagina
                            </Button>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Return Detail Modal */}
            <Dialog open={!!selectedReturnId} onOpenChange={(open) => !open && setSelectedReturnId(null)}>
                <DialogContent className="w-full max-w-[calc(100vw-1rem)] sm:max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
                    <DialogHeader className="pb-2">
                        <DialogTitle className="text-xl font-semibold">
                            {selectedReturnData?.return?.returnNumber || 'Retour'}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Retourinformatie
                        </DialogDescription>
                    </DialogHeader>
                    {isLoadingReturn ? (
                        <div className="p-4 text-center text-muted-foreground">Laden...</div>
                    ) : selectedReturnData ? (
                        <ReturnDetailModalContent
                            enrichedData={selectedReturnData}
                            onUpdate={async (data) => {
                                try {
                                    const response = await fetch(`/api/returns/${selectedReturnId}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(data),
                                    });
                                    if (!response.ok) throw new Error('Failed to update');
                                    queryClient.invalidateQueries({ queryKey: ['/api/returns', selectedReturnId] });
                                    toast({ title: 'Bijgewerkt', description: 'Retour is bijgewerkt' });
                                } catch (error) {
                                    toast({ title: 'Fout', description: 'Kon retour niet bijwerken', variant: 'destructive' });
                                    throw error;
                                }
                            }}
                            isUpdating={false}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Compose Email Modal */}
            <Dialog open={isComposing} onOpenChange={setIsComposing}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Nieuw bericht opstellen</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Aan</label>
                            <Input
                                placeholder="ontvanger@example.com"
                                value={composeData.to}
                                onChange={(e) => setComposeData(prev => ({ ...prev, to: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Onderwerp</label>
                            <Input
                                placeholder="Onderwerp van je bericht"
                                value={composeData.subject}
                                onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Bericht</label>
                            <Textarea
                                placeholder="Typ hier je bericht..."
                                className="min-h-[300px]"
                                value={composeData.body}
                                onChange={(e) => setComposeData(prev => ({ ...prev, body: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsComposing(false)}>
                            Annuleren
                        </Button>
                        <Button
                            className="bg-orange-600 hover:bg-orange-700 gap-2"
                            disabled={!composeData.to || !composeData.subject || !composeData.body || composeMutation.isPending}
                            onClick={() => {
                                composeMutation.mutate({
                                    to: composeData.to,
                                    subject: composeData.subject,
                                    body: composeData.body.replace(/\n/g, '<br/>')
                                });
                            }}
                        >
                            {composeMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            Verzenden
                        </Button>
                    </div>
                </DialogContent>
            </Dialog >
        </>
    );
}

// --- Sub-components ---


function FilterChip({ active, label, icon, onClick }: { active: boolean, label: string, icon: any, onClick: () => void }) {
    return (
        <Button
            variant={active ? "default" : "outline"}
            size="sm"
            onClick={onClick}
            className={cn("rounded-full h-8 text-xs gap-1.5 whitespace-nowrap px-3", !active && "bg-background")}
        >
            {icon}
            {label}
        </Button>
    );
}

function ThreadCard({ thread, isSelected, onClick }: { thread: EmailThread, isSelected: boolean, onClick: () => void }) {
    const lastDate = new Date(thread.lastActivity);
    const isToday = lastDate.toDateString() === new Date().toDateString();

    const displayDate = isToday
        ? lastDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
        : lastDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

    return (
        <div
            onClick={onClick}
            className={cn(
                "p-4 border-b cursor-pointer transition-all hover:bg-muted/50 relative overflow-hidden",
                isSelected ? "bg-orange-50 dark:bg-orange-950/20 border-l-4 border-l-orange-500 shadow-sm z-10" : "bg-transparent border-l-4 border-l-transparent",
                thread.isUnread && !isSelected && "bg-blue-500/5 group"
            )}
        >
            {thread.isUnread && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}

            <div className="flex justify-between items-start mb-1 gap-2">
                <span className={cn("text-xs font-bold truncate", thread.isUnread ? "text-foreground" : "text-muted-foreground")}>
                    {(thread.participants || []).map(p => p.name || p.email.split('@')[0]).join(', ') || 'Unknown'}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase">{displayDate}</span>
            </div>

            <h3 className={cn("text-sm truncate mb-1", thread.isUnread ? "font-bold" : "font-medium")}>
                {thread.subject}
            </h3>

            <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                {thread.snippet}
            </p>

            <div className="flex items-center gap-2">
                {thread.messageCount > 1 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                        {thread.messageCount} ber.
                    </Badge>
                )}
                {thread.orderId && <Package className="h-3 w-3 text-orange-500" />}
                {thread.caseId && <Briefcase className="h-3 w-3 text-blue-500" />}
                {thread.starred && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 ml-auto" />}
            </div>
        </div>
    );
}

function MessageItem({ message, isFirst, isLatest }: { message: ThreadMessage, isFirst: boolean, isLatest: boolean }) {
    const [expanded, setExpanded] = useState(isLatest);
    const sentDate = new Date(message.sentAt);

    return (
        <div className={cn(
            "border rounded-lg transition-all",
            expanded ? "bg-card border-border shadow-sm" : "bg-muted/30 border-transparent hover:bg-muted/50 cursor-pointer"
        )}>
            <div
                className={cn(
                    "p-4 flex items-center gap-3 cursor-pointer transition-colors select-none",
                    expanded
                        ? "bg-muted/20 border-b hover:bg-muted/30"
                        : "hover:bg-muted/60"
                )}
                onClick={() => setExpanded(!expanded)}
            >
                <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0",
                    message.isOutbound ? "bg-orange-500" : "bg-blue-600 font-serif"
                )}>
                    {message.isOutbound ? 'J' : (message.fromName?.charAt(0) || message.fromEmail.charAt(0)).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold truncate">
                            {message.isOutbound ? 'Jijzelf' : (message.fromName || message.fromEmail)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {sentDate.toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    {!expanded && (
                        <p className="text-xs text-muted-foreground truncate">{message.snippet}</p>
                    )}
                </div>

                {/* Expand/Collapse indicator */}
                <ChevronRight className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
                    expanded && "rotate-90"
                )} />
            </div>


            {expanded && (
                <div className="px-4 pb-6 pt-0 ml-11">
                    <div className="text-[11px] text-muted-foreground mb-4">
                        Aan: {message.to.map(p => p.email).join(', ')}
                        {message.cc.length > 0 && ` | Cc: ${message.cc.map(p => p.email).join(', ')}`}
                    </div>

                    <div
                        className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-2"
                        dangerouslySetInnerHTML={{ __html: message.body }}
                    />

                    {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-6 pt-4 border-t">
                            <p className="text-xs font-medium text-muted-foreground mb-3">
                                {message.attachments.length} bijlage{message.attachments.length > 1 ? 'n' : ''}
                            </p>

                            {/* Image attachments - show as gallery */}
                            {message.attachments.filter(att => att.mimeType?.startsWith('image/')).length > 0 && (
                                <div className="flex flex-wrap gap-3 mb-3">
                                    {message.attachments
                                        .filter(att => att.mimeType?.startsWith('image/'))
                                        .map((att, i) => (
                                            <a
                                                key={i}
                                                href={`/api/mail/attachment/${message.messageId}/${att.gmailAttachmentId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block rounded-lg overflow-hidden border hover:border-primary transition-colors"
                                            >
                                                <img
                                                    src={`/api/mail/attachment/${message.messageId}/${att.gmailAttachmentId}`}
                                                    alt={att.filename}
                                                    className="w-32 h-32 object-cover bg-muted"
                                                    loading="lazy"
                                                />
                                            </a>
                                        ))}
                                </div>
                            )}

                            {/* Non-image attachments - show as buttons */}
                            <div className="flex flex-wrap gap-2">
                                {message.attachments
                                    .filter(att => !att.mimeType?.startsWith('image/'))
                                    .map((att, i) => (
                                        <a
                                            key={i}
                                            href={`/api/mail/attachment/${message.messageId}/${att.gmailAttachmentId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Button variant="outline" size="sm" className="h-8 text-xs gap-2">
                                                <Paperclip className="h-3 w-3" />
                                                {att.filename}
                                            </Button>
                                        </a>
                                    ))}
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}

function ContextSection({ title, isLinked, onLink, children }: { title: string, isLinked: boolean, onLink: () => void, children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 tracking-tight">
                    {title}
                </div>
                {!isLinked && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-muted/80" onClick={onLink}>
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>
            {children}
        </div>
    );
}

function Reply({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
        </svg>
    );
}

function CreateRepairWizardWrapper({ open, onOpenChange, emailThreadId }: { open: boolean, onOpenChange: (open: boolean) => void, emailThreadId?: string }) {
    const { data: users = [] } = useQuery<any[]>({
        queryKey: ['/api/users'],
        enabled: open
    });

    return (
        <CreateRepairWizard
            open={open}
            onOpenChange={onOpenChange}
            users={users}
            emailThreadId={emailThreadId}
            repairType="customer"
        />
    );
}
