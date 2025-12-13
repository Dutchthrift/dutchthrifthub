import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Navigation } from "@/components/layout/navigation";
import { EmailThreadMessage } from '@/components/email/email-thread-message';
import { parseEmailThread } from '@/lib/email-thread-parser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    RefreshCw,
    Search,
    Reply,
    Forward,
    Trash2,
    Archive,
    Star,
    Mail,
    MailOpen,
    Paperclip,
    Link as LinkIcon,
    Inbox,
    Send,
    FileText,
    Trash,
    Package,
    Briefcase,
    RotateCcw,
    Wrench,
    Filter,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    ChevronsDownUp
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import DOMPurify from 'isomorphic-dompurify';
import { CreateCaseModal } from '@/components/forms/create-case-modal';
import { CreateReturnDialog } from '@/components/mail/dialogs/CreateReturnDialog';
import { CreateRepairDialog } from '@/components/mail/dialogs/CreateRepairDialog';
import { LinkOrderDialog } from '@/components/mail/dialogs/LinkOrderDialog';
import { LinkCaseDialog } from '@/components/mail/dialogs/LinkCaseDialog';
import { LinkReturnDialog } from '@/components/mail/dialogs/LinkReturnDialog';
import { LinkRepairDialog } from '@/components/mail/dialogs/LinkRepairDialog';
import { EmailContextMenu } from '@/components/mail/EmailContextMenu';
import { CaseDetailModal } from '@/components/cases/case-detail-modal';
import { RepairDetailModal } from '@/components/repairs/repair-detail-modal';
import { ReturnDetailModalContent } from '@/components/returns/return-detail-modal-content';

// Types
interface Email {
    id: string;
    subject: string;
    fromName: string;
    fromEmail: string;
    html?: string;
    text?: string;
    date: string;
    imapUid: number;
    createdAt: string;
    links?: Array<{
        id: string;
        entityType: 'order' | 'case' | 'return' | 'repair';
        entityId: string;
        createdAt: string;
    }>;
}

interface EmailDetails extends Email {
    attachments: Array<{
        id: string;
        filename: string;
        mimeType: string;
        size: number;
        storagePath: string;
    }>;
    links: Array<{
        id: string;
        entityType: 'order' | 'case' | 'return' | 'repair';
        entityId: string;
        createdAt: string;
    }>;
    threadId?: string; // Link to email thread
}

// Thread message from emailMessages table
interface ThreadMessage {
    id: string;
    messageId: string;
    threadId: string;
    fromEmail: string;
    toEmail: string;
    subject?: string;
    body?: string;
    isHtml?: boolean;
    isOutbound?: boolean;
    sentAt?: string;
    createdAt?: string;
    attachments?: any;
}

// Thread with all messages
interface ThreadWithMessages {
    id: string;
    threadId: string;
    subject: string;
    customerEmail: string;
    messages: ThreadMessage[];
}

export default function MailPage() {
    const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'drafts' | 'trash'>('inbox');
    const [linkFilter, setLinkFilter] = useState<'all' | 'linked' | 'unlinked' | 'order' | 'case' | 'return' | 'repair'>('all');
    const [isMobile, setIsMobile] = useState(false);
    const queryClient = useQueryClient();
    const { toast } = useToast();



    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Dialog states
    const [showCreateCase, setShowCreateCase] = useState(false);
    const [showCreateReturn, setShowCreateReturn] = useState(false);
    const [showCreateRepair, setShowCreateRepair] = useState(false);
    const [showLinkOrder, setShowLinkOrder] = useState(false);
    const [showLinkCase, setShowLinkCase] = useState(false);
    const [showLinkReturn, setShowLinkReturn] = useState(false);
    const [showLinkRepair, setShowLinkRepair] = useState(false);

    // Detail modal states
    const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
    const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
    const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null);

    // Thread message expansion state
    const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set());

    // Toggle message expansion
    const toggleMessageExpanded = (messageId: string) => {
        setExpandedMessageIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
            } else {
                newSet.add(messageId);
            }
            return newSet;
        });
    };

    // Expand/collapse all messages
    const expandAllMessages = (messageIds: string[]) => {
        setExpandedMessageIds(new Set(messageIds));
    };

    const collapseAllMessages = () => {
        setExpandedMessageIds(new Set());
    };

    // Fetch mail list with infinite scroll
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: isLoadingList
    } = useInfiniteQuery<
        { emails: Email[]; hasMore: boolean },
        Error,
        unknown,
        string[],
        { date: string; id: string } | undefined
    >({
        queryKey: ['emails', activeFolder, searchQuery],
        queryFn: async ({ pageParam }: { pageParam?: { date: string; id: string } }) => {
            let url = '/api/mail/list?limit=50';

            if (activeFolder && activeFolder !== 'inbox') {
                url += `&folder=${activeFolder}`;
            }

            if (pageParam) {
                url += `&before=${encodeURIComponent(pageParam.date)}&beforeId=${pageParam.id}`;
            }

            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch emails');
            return res.json() as Promise<{ emails: Email[]; hasMore: boolean }>;
        },
        getNextPageParam: (lastPage: { emails: Email[]; hasMore: boolean }) => {
            if (!lastPage.hasMore || lastPage.emails.length === 0) return undefined;

            const lastEmail = lastPage.emails[lastPage.emails.length - 1];
            return { date: lastEmail.date, id: lastEmail.id };
        },
        initialPageParam: undefined
    });

    // Flatten all pages into single email list
    const allEmails = data?.pages.flatMap((page: any) => page.emails) || [];

    // Fetch selected email details
    const { data: emailDetails, isLoading: isLoadingDetails } = useQuery({
        queryKey: ['email', selectedEmailId],
        queryFn: async () => {
            if (!selectedEmailId) return null;
            const res = await fetch(`/api/mail/${selectedEmailId}`, {
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Failed to fetch email');
            return res.json() as Promise<EmailDetails>;
        },
        enabled: !!selectedEmailId
    });

    // Fetch orders for the current sender (Must be after emailDetails is defined)
    const { data: customerOrders } = useQuery({
        queryKey: ['orders', 'search', emailDetails?.fromEmail],
        queryFn: async () => {
            if (!emailDetails?.fromEmail) return [];
            const res = await fetch(`/api/orders?search=${encodeURIComponent(emailDetails.fromEmail)}&limit=5`);
            if (!res.ok) return [];
            const data = await res.json();
            return Array.isArray(data) ? data : data.orders || [];
        },
        enabled: !!emailDetails?.fromEmail
    });


    // Thread messages come directly from emailDetails (thread-first architecture)
    // No separate API call needed - /api/mail/:id now returns thread with all messages
    const threadMessages = emailDetails?.messages?.slice().sort((a: any, b: any) => {
        const dateA = new Date(a.sentAt || a.createdAt || 0);
        const dateB = new Date(b.sentAt || b.createdAt || 0);
        return dateA.getTime() - dateB.getTime();
    }) || [];

    // Gmail-style threading: messages come from database with proper headers
    const parsedMessages = threadMessages;

    const unlinkMutation = useMutation({
        mutationFn: async (linkId: string) => {
            const res = await fetch(`/api/mail/links/${linkId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Failed to unlink');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['email', selectedEmailId] });
            queryClient.invalidateQueries({ queryKey: ['emails'] });
            toast({ title: "Link verwijderd", description: "De koppeling is verwijderd" });
        },
        onError: () => {
            toast({ title: "Fout", description: "Kon koppeling niet verwijderen", variant: "destructive" });
        }
    });


    // Refresh mutation
    const refreshMutation = useMutation({
        mutationFn: async () => {
            // Normal refresh - only fetch new emails since last sync
            const res = await fetch('/api/mail/refresh', {
                method: 'POST',
                credentials: 'include'
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to refresh');
            }
            return res.json();
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['emails'] });
            toast({
                title: "Emails vernieuwd",
                description: `${data.newMails} nieuwe email(s) gesynchroniseerd`,
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Vernieuwen mislukt",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    // Link handlers
    const handleLinkOrder = async (order: any) => {
        if (!selectedEmailId) return;
        try {
            await fetch(`/api/mail/threads/${selectedEmailId}/link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ type: 'order', entityId: order.id })
            });
            queryClient.invalidateQueries({ queryKey: ['email', selectedEmailId] });
            queryClient.invalidateQueries({ queryKey: ['emails'] }); // Refresh list for filters
            toast({ title: "Bestelling gekoppeld", description: `Gekoppeld aan ${order.orderNumber}` });
            setShowLinkOrder(false);
        } catch (error) {
            toast({ title: "Koppelen mislukt", variant: "destructive" });
        }
    };

    const handleLinkCase = async (caseItem: any) => {
        if (!selectedEmailId) return;
        try {
            await fetch(`/api/mail/threads/${selectedEmailId}/link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ type: 'case', entityId: caseItem.id })
            });
            queryClient.invalidateQueries({ queryKey: ['email', selectedEmailId] });
            queryClient.invalidateQueries({ queryKey: ['emails'] }); // Refresh list for filters
            queryClient.invalidateQueries({ queryKey: ['/api/email-threads'] }); // Refresh case detail
            toast({ title: "Case gekoppeld", description: `Gekoppeld aan #${caseItem.caseNumber}` });
            setShowLinkCase(false);
        } catch (error) {
            toast({ title: "Koppelen mislukt", variant: "destructive" });
        }
    };

    const handleLinkReturn = async (returnItem: any) => {
        if (!selectedEmailId) return;
        try {
            await fetch(`/api/mail/threads/${selectedEmailId}/link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ type: 'return', entityId: returnItem.id })
            });
            queryClient.invalidateQueries({ queryKey: ['email', selectedEmailId] });
            queryClient.invalidateQueries({ queryKey: ['emails'] }); // Refresh list for filters
            toast({ title: "Retour gekoppeld", description: `Gekoppeld aan ${returnItem.returnNumber || returnItem.id}` });
            setShowLinkReturn(false);
        } catch (error) {
            toast({ title: "Koppelen mislukt", variant: "destructive" });
        }
    };

    const handleLinkRepair = async (repair: any) => {
        if (!selectedEmailId) return;
        try {
            await fetch(`/api/mail/threads/${selectedEmailId}/link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ type: 'repair', entityId: repair.id })
            });
            queryClient.invalidateQueries({ queryKey: ['email', selectedEmailId] });
            queryClient.invalidateQueries({ queryKey: ['emails'] }); // Refresh list for filters
            toast({ title: "Reparatie gekoppeld", description: `Gekoppeld aan ${repair.title || repair.id}` });
            setShowLinkRepair(false);
        } catch (error) {
            toast({ title: "Koppelen mislukt", variant: "destructive" });
        }
    };

    // Filter emails by search and link status
    const filteredEmails = allEmails.filter((email: Email) => {
        // Search filter
        const matchesSearch = !searchQuery ||
            email.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            email.fromName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            email.fromEmail?.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        // Link filter
        if (linkFilter === 'all') return true;

        const hasLinks = email.links && email.links.length > 0;

        if (linkFilter === 'linked') {
            return hasLinks;
        }

        if (linkFilter === 'unlinked') {
            return !hasLinks;
        }

        // Filter by specific entity type
        if (hasLinks) {
            return email.links.some(link => link.entityType === linkFilter);
        }

        return false;
    }) || [];

    // Mail actions
    const handleReply = () => {
        toast({ title: "Antwoorden", description: "Antwoorden functie komt binnenkort" });
    };

    const handleForward = () => {
        toast({ title: "Doorsturen", description: "Doorsturen functie komt binnenkort" });
    };

    const handleDelete = () => {
        toast({ title: "Verwijderen", description: "Verwijderen functie komt binnenkort" });
    };

    const handleArchive = () => {
        toast({ title: "Archiveren", description: "Archiveren functie komt binnenkort" });
    };

    const handleStar = () => {
        toast({ title: "Ster", description: "Ster functie komt binnenkort" });
    };

    const handleMarkRead = () => {
        toast({ title: "Markeer als gelezen", description: "Markeer als gelezen functie komt binnenkort" });
    };

    // Intersection Observer for infinite scroll
    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const currentRef = loadMoreRef.current;
        if (!currentRef || !hasNextPage || isFetchingNextPage) return;

        const observer = new IntersectionObserver(
            (entries) => {
                // Only trigger if element is intersecting AND we can load more
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            {
                threshold: 0.1, // Trigger when 10% visible
                rootMargin: '100px' // Start loading 100px before element is visible
            }
        );

        observer.observe(currentRef);

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
            observer.disconnect();
        };
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Helper to get current email thread info
    const currentEmailThread = emailDetails ? {
        id: emailDetails.id,
        subject: emailDetails.subject,
        customerEmail: emailDetails.fromEmail
    } : undefined;

    const linkedCase = emailDetails?.links?.find(l => l.entityType === 'case');
    const linkedCaseId = linkedCase?.entityId;

    return (
        <div className="flex flex-col h-screen bg-background">
            <Navigation />

            <main className="flex-1 flex flex-col overflow-hidden px-6 py-4">
                {/* Compact Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Mail</h1>
                    </div>
                    <Button
                        onClick={() => refreshMutation.mutate()}
                        disabled={refreshMutation.isPending}
                        variant="default"
                        size="sm"
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                        {refreshMutation.isPending ? 'Synchroniseren...' : 'Vernieuwen'}
                    </Button>
                </div>

                {/* Filter Tabs */}
                <Tabs value={linkFilter} onValueChange={(value: any) => setLinkFilter(value)} className="mb-4">
                    <TabsList className="bg-muted">
                        <TabsTrigger value="all" className="gap-2">
                            <Mail className="h-4 w-4" />
                            Alle
                            <Badge variant="secondary" className="ml-1">{allEmails.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="order" className="gap-2">
                            <Package className="h-4 w-4" />
                            Orders
                            <Badge variant="secondary" className="ml-1">
                                {allEmails.filter((e: Email) => e.links?.some((l: any) => l.entityType === 'order')).length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="case" className="gap-2">
                            <Briefcase className="h-4 w-4" />
                            Cases
                            <Badge variant="secondary" className="ml-1">
                                {allEmails.filter((e: Email) => e.links?.some((l: any) => l.entityType === 'case')).length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="return" className="gap-2">
                            <RotateCcw className="h-4 w-4" />
                            Retouren
                            <Badge variant="secondary" className="ml-1">
                                {allEmails.filter((e: Email) => e.links?.some((l: any) => l.entityType === 'return')).length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="repair" className="gap-2">
                            <Wrench className="h-4 w-4" />
                            Reparaties
                            <Badge variant="secondary" className="ml-1">
                                {allEmails.filter((e: Email) => e.links?.some((l: any) => l.entityType === 'repair')).length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="unlinked" className="gap-2">
                            <Mail className="h-4 w-4 opacity-50" />
                            Niet gekoppeld
                            <Badge variant="secondary" className="ml-1">
                                {allEmails.filter((e: Email) => !e.links || e.links.length === 0).length}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Mail Layout - Full width 3-column layout */}
                <div className="flex-1 flex gap-4 overflow-hidden">
                    {/* Mail List - Wider sidebar */}
                    <Card className="w-96 min-w-96 max-w-96 flex-shrink-0 flex flex-col">
                        <CardContent className="p-4 flex flex-col gap-3 flex-1 overflow-hidden">
                            {/* Folder Tabs */}
                            <Tabs value={activeFolder} onValueChange={(value) => setActiveFolder(value as any)}>
                                <TabsList className="grid w-full grid-cols-2 mb-2">
                                    <TabsTrigger value="inbox" className="text-xs gap-1">
                                        <Inbox className="h-3 w-3" />
                                        Postvak IN
                                    </TabsTrigger>
                                    <TabsTrigger value="sent" className="text-xs gap-1">
                                        <Send className="h-3 w-3" />
                                        Verzonden
                                    </TabsTrigger>
                                </TabsList>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="drafts" className="text-xs gap-1">
                                        <FileText className="h-3 w-3" />
                                        Concepten
                                    </TabsTrigger>
                                    <TabsTrigger value="trash" className="text-xs gap-1">
                                        <Trash className="h-3 w-3" />
                                        Prullenbak
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Zoek emails..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>



                            {/* Mail List */}
                            <div className="flex-1 overflow-auto space-y-1">
                                {isLoadingList ? (
                                    <div className="flex justify-center py-8">
                                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : filteredEmails.length === 0 && !isLoadingList ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        Geen emails gevonden in {activeFolder === 'sent' ? 'Verzonden' :
                                            activeFolder === 'drafts' ? 'Concepten' :
                                                activeFolder === 'trash' ? 'Prullenbak' : 'Postvak IN'}
                                    </div>
                                ) : (
                                    <>
                                        {filteredEmails.map((email: Email) => (
                                            <EmailContextMenu
                                                key={email.id}
                                                onCreateCase={() => {
                                                    setSelectedEmailId(email.id);
                                                    setShowCreateCase(true);
                                                }}
                                                onCreateReturn={() => {
                                                    setSelectedEmailId(email.id);
                                                    setShowCreateReturn(true);
                                                }}
                                                onCreateRepair={() => {
                                                    setSelectedEmailId(email.id);
                                                    setShowCreateRepair(true);
                                                }}
                                                onLinkOrder={() => {
                                                    setSelectedEmailId(email.id);
                                                    setShowLinkOrder(true);
                                                }}
                                                onLinkCase={() => {
                                                    setSelectedEmailId(email.id);
                                                    setShowLinkCase(true);
                                                }}
                                                onLinkReturn={() => {
                                                    setSelectedEmailId(email.id);
                                                    setShowLinkReturn(true);
                                                }}
                                                onLinkRepair={() => {
                                                    setSelectedEmailId(email.id);
                                                    setShowLinkRepair(true);
                                                }}
                                            >
                                                <div
                                                    onClick={() => setSelectedEmailId(email.id)}
                                                    className={`p-3 rounded-lg cursor-pointer transition-colors border ${selectedEmailId === email.id
                                                        ? 'bg-primary/10 border-primary'
                                                        : 'hover:bg-muted border-transparent'
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between mb-1">
                                                        <span className="font-semibold text-sm line-clamp-1">
                                                            {email.fromName || email.fromEmail}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                                            {new Date(email.date).toLocaleDateString('nl-NL')}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm line-clamp-1 mb-1">
                                                        {email.subject || '(Geen onderwerp)'}
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-xs text-muted-foreground line-clamp-1 flex-1">
                                                            {email.fromEmail}
                                                        </div>
                                                        {email.links && email.links.length > 0 && (
                                                            <div className="flex gap-1 flex-shrink-0">
                                                                {email.links.map(link => {
                                                                    const iconMap = {
                                                                        order: Package,
                                                                        case: Briefcase,
                                                                        return: RotateCcw,
                                                                        repair: Wrench
                                                                    };
                                                                    const Icon = iconMap[link.entityType];
                                                                    return Icon ? (
                                                                        <div key={link.id} title={`Gekoppeld aan ${link.entityType}`}>
                                                                            <Icon className="h-3 w-3 text-primary" />
                                                                        </div>
                                                                    ) : null;
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </EmailContextMenu>
                                        ))}

                                        {/* Infinite scroll trigger */}
                                        {hasNextPage && (
                                            <div ref={loadMoreRef} className="py-4 text-center">
                                                {isFetchingNextPage ? (
                                                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Scrollen voor meer...</span>
                                                )}
                                            </div>
                                        )}

                                        {/* End of emails */}
                                        {!hasNextPage && filteredEmails.length > 0 && (
                                            <div className="py-4 text-center text-xs text-muted-foreground">
                                                Geen oudere emails
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Email Viewer - Full height */}
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                            {!selectedEmailId ? (
                                <div className="flex items-center justify-center flex-1 text-muted-foreground">
                                    <div className="text-center">
                                        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p className="text-lg font-medium">Selecteer een email om te bekijken</p>
                                        <p className="text-sm mt-1">Kies een email uit de lijst om de inhoud te lezen</p>
                                    </div>
                                </div>
                            ) : isLoadingDetails ? (
                                <div className="flex justify-center items-center flex-1">
                                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : emailDetails ? (
                                <div className="flex flex-col flex-1 overflow-hidden">
                                    {/* Email Header */}
                                    <div className="p-6 border-b bg-muted/30">
                                        <div className="flex gap-6">
                                            <div className="flex-1">
                                                <h2 className="text-2xl font-bold mb-3">
                                                    {emailDetails.subject || '(Geen onderwerp)'}
                                                </h2>
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold">{emailDetails.fromName || 'Onbekend'}</span>
                                                            <Badge variant="outline" className="text-xs">
                                                                {emailDetails.fromEmail}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {new Date(emailDetails.date).toLocaleString('nl-NL')}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Suggested Orders Sidebar */}
                                            {customerOrders && customerOrders.length > 0 && (
                                                <div className="w-72 border-l pl-4 hidden xl:block">
                                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-muted-foreground">
                                                        <Package className="h-4 w-4" />
                                                        Gevonden Orders
                                                    </h4>
                                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                        {customerOrders.map((order: any) => {
                                                            const isLinked = emailDetails.links?.some(l => l.entityType === 'order' && l.entityId === order.id);
                                                            return (
                                                                <div key={order.id} className="text-sm border rounded p-2 bg-background/50 hover:bg-background transition-colors group">
                                                                    <div className="flex justify-between items-start mb-1">
                                                                        <span className="font-medium">#{order.orderNumber}</span>
                                                                        <Badge variant="outline" className="text-[10px] h-5 px-1">
                                                                            {new Date(order.orderDate).toLocaleDateString()}
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-xs text-muted-foreground">€{(order.totalAmount / 100).toFixed(2)}</span>
                                                                        {!isLinked && (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                className="h-6 text-xs px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                onClick={() => handleLinkOrder(order)}
                                                                            >
                                                                                <LinkIcon className="h-3 w-3 mr-1" />
                                                                                Koppelen
                                                                            </Button>
                                                                        )}
                                                                        {isLinked && (
                                                                            <span className="text-xs text-emerald-600 flex items-center">
                                                                                <LinkIcon className="h-3 w-3 mr-1" />
                                                                                Gekoppeld
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Linked Entities */}
                                        {emailDetails.links && emailDetails.links.length > 0 && (
                                            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                    <LinkIcon className="h-4 w-4" />
                                                    Gekoppeld aan:
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {emailDetails.links.map(link => {
                                                        const getEntityInfo = () => {
                                                            switch (link.entityType) {
                                                                case 'order':
                                                                    return { icon: Package, label: 'Bestelling', path: `/orders?orderId=${link.entityId}` };
                                                                case 'case':
                                                                    return { icon: Briefcase, label: 'Case', path: `/cases/${link.entityId}` };
                                                                case 'return':
                                                                    return { icon: RotateCcw, label: 'Retour', path: `/returns/${link.entityId}` };
                                                                case 'repair':
                                                                    return { icon: Wrench, label: 'Reparatie', path: `/repairs/${link.entityId}` };
                                                                default:
                                                                    return { icon: LinkIcon, label: link.entityType, path: '#' };
                                                            }
                                                        };
                                                        const { icon: Icon, label, path } = getEntityInfo();

                                                        // Handler to open appropriate modal or navigate
                                                        const handleEntityClick = () => {
                                                            switch (link.entityType) {
                                                                case 'case':
                                                                    setSelectedCaseId(link.entityId);
                                                                    break;
                                                                case 'return':
                                                                    setSelectedReturnId(link.entityId);
                                                                    break;
                                                                case 'repair':
                                                                    setSelectedRepairId(link.entityId);
                                                                    break;
                                                                case 'order':
                                                                default:
                                                                    // Navigate to page for orders (no modal available)
                                                                    window.location.href = path;
                                                                    break;
                                                            }
                                                        };

                                                        return (
                                                            <div key={link.id} className="flex items-center gap-1 bg-background border rounded-md pl-1 pr-1">
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="gap-2 h-8 px-2"
                                                                    onClick={handleEntityClick}
                                                                >
                                                                    <Icon className="h-3 w-3" />
                                                                    {label}
                                                                </Button>
                                                                <div className="h-4 w-[1px] bg-border" />
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                    onClick={() => unlinkMutation.mutate(link.id)}
                                                                    title="Ontkoppelen"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}


                                        {/* Action Buttons */}
                                        <div className="flex gap-2 flex-wrap">
                                            <Button onClick={handleReply} size="sm" variant="default">
                                                <Reply className="mr-2 h-4 w-4" />
                                                Beantwoorden
                                            </Button>
                                            <Button onClick={handleForward} size="sm" variant="outline">
                                                <Forward className="mr-2 h-4 w-4" />
                                                Doorsturen
                                            </Button>
                                            <Button onClick={handleArchive} size="sm" variant="outline">
                                                <Archive className="mr-2 h-4 w-4" />
                                                Archiveren
                                            </Button>
                                            <Button onClick={handleDelete} size="sm" variant="outline">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Verwijderen
                                            </Button>
                                            <Button onClick={handleStar} size="sm" variant="outline">
                                                <Star className="mr-2 h-4 w-4" />
                                                Markeren
                                            </Button>
                                            <Button onClick={handleMarkRead} size="sm" variant="outline">
                                                <MailOpen className="mr-2 h-4 w-4" />
                                                Als gelezen
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Email Thread Messages - Gmail Style */}
                                    <div className="flex-1 overflow-auto p-4">
                                        {/* Thread header with expand/collapse controls */}
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm text-muted-foreground">
                                                Conversatie {parsedMessages.length > 1 && `(${parsedMessages.length} berichten)`}
                                            </span>
                                            {parsedMessages.length > 1 && (
                                                <div className="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => expandAllMessages(parsedMessages.map(m => m.id))}
                                                        className="h-7 px-2 text-xs"
                                                    >
                                                        <ChevronsUpDown className="h-3 w-3 mr-1" />
                                                        Alles uitvouwen
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={collapseAllMessages}
                                                        className="h-7 px-2 text-xs"
                                                    >
                                                        <ChevronsDownUp className="h-3 w-3 mr-1" />
                                                        Alles invouwen
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Thread messages */}
                                        <div className="space-y-2">
                                            {parsedMessages.length > 0 ? (
                                                // Render all messages in thread (from DB or parsed from body)
                                                parsedMessages.map((message, index) => (
                                                    <EmailThreadMessage
                                                        key={message.id}
                                                        message={message}
                                                        isExpanded={
                                                            expandedMessageIds.has(message.id) ||
                                                            (expandedMessageIds.size === 0 && index === parsedMessages.length - 1)
                                                        }
                                                        onToggle={() => toggleMessageExpanded(message.id)}
                                                        isLatest={index === parsedMessages.length - 1}
                                                    />
                                                ))
                                            ) : (
                                                // Fallback: render current email as single message
                                                <EmailThreadMessage
                                                    message={{
                                                        id: emailDetails.id,
                                                        messageId: emailDetails.id,
                                                        threadId: '',
                                                        fromEmail: emailDetails.fromEmail,
                                                        toEmail: 'contact@dutchthrift.com',
                                                        subject: emailDetails.subject,
                                                        body: emailDetails.html || emailDetails.text,
                                                        isHtml: !!emailDetails.html,
                                                        isOutbound: false,
                                                        sentAt: emailDetails.date,
                                                        attachments: emailDetails.attachments,
                                                    }}
                                                    isExpanded={true}
                                                    onToggle={() => { }}
                                                    isLatest={true}
                                                />
                                            )}
                                        </div>

                                        {/* Attachments */}
                                        {emailDetails.attachments && emailDetails.attachments.length > 0 && (
                                            <div className="mt-6 pt-6 border-t">
                                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                    <Paperclip className="h-4 w-4" />
                                                    Bijlagen ({emailDetails.attachments.length})
                                                </h3>
                                                <div className="space-y-2">
                                                    {emailDetails.attachments.map(att => (
                                                        <div key={att.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                                            <div className="flex items-center gap-2">
                                                                <Paperclip className="h-4 w-4 text-muted-foreground" />
                                                                <div>
                                                                    <div className="font-medium text-sm">{att.filename}</div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {(att.size / 1024).toFixed(1)} KB
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={async () => {
                                                                    try {
                                                                        const res = await fetch(`/api/mail/attachments/${att.id}/download`, {
                                                                            credentials: 'include'
                                                                        });
                                                                        const data = await res.json();
                                                                        toast({
                                                                            title: "Download",
                                                                            description: data.message || "Attachment download coming soon",
                                                                        });
                                                                    } catch (error) {
                                                                        toast({
                                                                            title: "Download failed",
                                                                            description: "Could not download attachment",
                                                                            variant: "destructive"
                                                                        });
                                                                    }
                                                                }}
                                                            >
                                                                Downloaden
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Linked Entities */}
                                        {emailDetails.links && emailDetails.links.length > 0 && (
                                            <div className="mt-6 pt-6 border-t">
                                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                    <LinkIcon className="h-4 w-4" />
                                                    Gekoppeld aan ({emailDetails.links.length})
                                                </h3>
                                                <div className="flex gap-2 flex-wrap">
                                                    {emailDetails.links.map(link => (
                                                        <Badge key={link.id} variant="secondary" className="px-3 py-1">
                                                            {link.entityType.toUpperCase()}: {link.entityId}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                </div >
            </main >

            {/* Mobile Email Viewer Dialog - Only shown on mobile */}
            <Dialog open={isMobile && !!selectedEmailId} onOpenChange={(open) => !open && setSelectedEmailId(null)}>
                <DialogContent className="max-w-full h-[85vh] p-0 flex flex-col">
                    {isLoadingDetails ? (
                        <div className="flex justify-center items-center h-full">
                            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : emailDetails ? (
                        <>
                            {/* Email Header */}
                            <DialogHeader className="p-4 border-b bg-muted/30 flex-shrink-0">
                                <DialogTitle className="text-lg font-bold line-clamp-2">
                                    {emailDetails.subject || '(Geen onderwerp)'}
                                </DialogTitle>
                                <div className="space-y-1 mt-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-sm">{emailDetails.fromName || 'Onbekend'}</span>
                                        <Badge variant="outline" className="text-xs">
                                            {emailDetails.fromEmail}
                                        </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {new Date(emailDetails.date).toLocaleString('nl-NL')}
                                    </div>
                                </div>
                            </DialogHeader>

                            {/* Email Body - Scrollable */}
                            <div className="flex-1 overflow-auto p-4">
                                {emailDetails.html ? (
                                    <div
                                        className="prose prose-sm max-w-none dark:prose-invert"
                                        dangerouslySetInnerHTML={{
                                            __html: DOMPurify.sanitize(emailDetails.html, {
                                                ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'img', 'div', 'span', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'],
                                                ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style']
                                            })
                                        }}
                                    />
                                ) : (
                                    <pre className="whitespace-pre-wrap font-sans text-sm">
                                        {emailDetails.text || '(Geen inhoud)'}
                                    </pre>
                                )}

                                {/* Attachments */}
                                {emailDetails.attachments && emailDetails.attachments.length > 0 && (
                                    <div className="mt-4 pt-4 border-t">
                                        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                                            <Paperclip className="h-4 w-4" />
                                            Bijlagen ({emailDetails.attachments.length})
                                        </h3>
                                        <div className="space-y-2">
                                            {emailDetails.attachments.map(att => (
                                                <div key={att.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                        <span className="text-sm truncate">{att.filename}</span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground flex-shrink-0">
                                                        {(att.size / 1024).toFixed(1)} KB
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Linked Entities */}
                                {emailDetails.links && emailDetails.links.length > 0 && (
                                    <div className="mt-4 pt-4 border-t">
                                        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                                            <LinkIcon className="h-4 w-4" />
                                            Gekoppeld aan ({emailDetails.links.length})
                                        </h3>
                                        <div className="flex gap-2 flex-wrap">
                                            {emailDetails.links.map(link => (
                                                <Badge key={link.id} variant="secondary" className="text-xs">
                                                    {link.entityType.toUpperCase()}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons - Fixed at bottom */}
                            <div className="p-4 border-t bg-background flex-shrink-0">
                                <div className="flex gap-2 flex-wrap">
                                    <Button onClick={handleReply} size="sm" className="flex-1">
                                        <Reply className="h-4 w-4 mr-1" />
                                        Antwoord
                                    </Button>
                                    <Button onClick={handleForward} size="sm" variant="outline" className="flex-1">
                                        <Forward className="h-4 w-4 mr-1" />
                                        Doorsturen
                                    </Button>
                                    <Button onClick={handleArchive} size="sm" variant="outline">
                                        <Archive className="h-4 w-4" />
                                    </Button>
                                    <Button onClick={handleDelete} size="sm" variant="outline">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Dialogs */}
            < CreateCaseModal
                open={showCreateCase}
                onOpenChange={setShowCreateCase}
                emailThread={currentEmailThread}
            />
            <CreateReturnDialog
                open={showCreateReturn}
                onOpenChange={setShowCreateReturn}
                emailThread={currentEmailThread}
                caseId={linkedCaseId}
            />
            <CreateRepairDialog
                open={showCreateRepair}
                onOpenChange={setShowCreateRepair}
                emailThread={currentEmailThread}
                caseId={linkedCaseId}
            />
            <LinkOrderDialog
                open={showLinkOrder}
                onOpenChange={setShowLinkOrder}
                onLink={handleLinkOrder}
            />
            <LinkCaseDialog
                open={showLinkCase}
                onOpenChange={setShowLinkCase}
                onLink={handleLinkCase}
            />
            <LinkReturnDialog
                open={showLinkReturn}
                onOpenChange={setShowLinkReturn}
                onLink={handleLinkReturn}
            />
            <LinkRepairDialog
                open={showLinkRepair}
                onOpenChange={setShowLinkRepair}
                onLink={handleLinkRepair}
            />

            {/* Detail Modals */}
            {selectedCaseId && (
                <CaseDetailModal
                    caseId={selectedCaseId}
                    open={!!selectedCaseId}
                    onClose={() => setSelectedCaseId(null)}
                />
            )}

            {selectedRepairId && (
                <RepairDetailModal
                    repairId={selectedRepairId}
                    open={!!selectedRepairId}
                    onClose={() => setSelectedRepairId(null)}
                />
            )}

            {selectedReturnId && (
                <Dialog open={!!selectedReturnId} onOpenChange={(open) => !open && setSelectedReturnId(null)}>
                    <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                        <ReturnDetailModalContent returnId={selectedReturnId} />
                    </DialogContent>
                </Dialog>
            )}
        </div >
    );
}
