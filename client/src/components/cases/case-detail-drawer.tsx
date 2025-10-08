import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  Package,
  Wrench,
  CheckSquare,
  StickyNote,
  Clock,
  User,
  Calendar,
  AlertCircle,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import type { CaseWithDetails, EmailThread, Order, Repair, Todo, InternalNote } from "@/lib/types";

interface CaseDetailDrawerProps {
  caseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CaseDetailDrawer({ caseId, open, onOpenChange }: CaseDetailDrawerProps) {
  const { data, isLoading } = useQuery<{
    case: CaseWithDetails;
    emails: EmailThread[];
    orders: Order[];
    repairs: Repair[];
    todos: Todo[];
    notes: InternalNote[];
  }>({
    queryKey: [`/api/cases/${caseId}`],
    enabled: !!caseId && open,
  });

  if (!caseId) return null;

  const caseData = data?.case;
  const emails = data?.emails || [];
  const orders = data?.orders || [];
  const repairs = data?.repairs || [];
  const todos = data?.todos || [];
  const notes = data?.notes || [];

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "secondary";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-chart-4";
      case "in_progress": return "bg-primary";
      case "waiting_customer": return "bg-chart-1";
      case "waiting_part": return "bg-chart-3";
      case "resolved": return "bg-chart-2";
      case "closed": return "bg-muted-foreground";
      default: return "bg-muted";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading case details...</div>
          </div>
        ) : caseData ? (
          <>
            <SheetHeader className="px-6 py-4 border-b">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-xl mb-2">{caseData.title}</SheetTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono">
                      #{caseData.caseNumber}
                    </Badge>
                    <div className={`h-2 w-2 rounded-full ${getStatusColor(caseData.status)}`} />
                    <span className="text-sm text-muted-foreground capitalize">
                      {caseData.status?.replace('_', ' ')}
                    </span>
                    <Badge variant={getPriorityColor(caseData.priority)}>
                      {caseData.priority}
                    </Badge>
                  </div>
                </div>
              </div>
              {caseData.description && (
                <SheetDescription className="text-sm mt-2">
                  {caseData.description}
                </SheetDescription>
              )}
            </SheetHeader>

            <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-6 mt-4 w-auto">
                <TabsTrigger value="overview" className="text-xs">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="linked" className="text-xs">
                  Linked Items ({orders.length + repairs.length + emails.length + todos.length})
                </TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs">
                  Timeline
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 px-6">
                <TabsContent value="overview" className="mt-4 space-y-6">
                  {/* Customer Info */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer Information
                    </h4>
                    <div className="space-y-2 text-sm">
                      {caseData.customer ? (
                        <div>
                          <p className="font-medium">
                            {caseData.customer.firstName} {caseData.customer.lastName}
                          </p>
                          <p className="text-muted-foreground">{caseData.customer.email}</p>
                          {caseData.customer.phone && (
                            <p className="text-muted-foreground">{caseData.customer.phone}</p>
                          )}
                        </div>
                      ) : caseData.customerEmail ? (
                        <p className="text-muted-foreground">{caseData.customerEmail}</p>
                      ) : (
                        <p className="text-muted-foreground">No customer information</p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Assignment & Dates */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Status & Assignment
                    </h4>
                    <div className="space-y-3 text-sm">
                      {caseData.assignedUser && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Assigned to:</span>
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {(caseData.assignedUser.firstName?.[0] || '') + (caseData.assignedUser.lastName?.[0] || '')}
                            </AvatarFallback>
                          </Avatar>
                          <span>{caseData.assignedUser.firstName} {caseData.assignedUser.lastName}</span>
                        </div>
                      )}
                      
                      {caseData.slaDeadline && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">SLA Deadline:</span>
                          <span className={new Date(caseData.slaDeadline) < new Date() ? 'text-destructive font-medium' : ''}>
                            {format(new Date(caseData.slaDeadline), 'MMM d, yyyy HH:mm')}
                          </span>
                          {new Date(caseData.slaDeadline) < new Date() && (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Created:</span>
                        <span>{caseData.createdAt ? format(new Date(caseData.createdAt), 'MMM d, yyyy HH:mm') : 'N/A'}</span>
                      </div>

                      {caseData.resolvedAt && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Resolved:</span>
                          <span>{format(new Date(caseData.resolvedAt), 'MMM d, yyyy HH:mm')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="linked" className="mt-4 space-y-6">
                  {/* Linked Orders */}
                  {orders.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Linked Orders ({orders.length})
                      </h4>
                      <div className="space-y-2">
                        {orders.map((order) => (
                          <Link key={order.id} href={`/orders/${order.id}`}>
                            <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">Order #{order.orderNumber}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {order.customerEmail} • {order.paymentStatus || 'N/A'}
                                  </p>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Linked Repairs */}
                  {repairs.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        Linked Repairs ({repairs.length})
                      </h4>
                      <div className="space-y-2">
                        {repairs.map((repair) => (
                          <div key={repair.id} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{repair.title}</p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {repair.status?.replace('_', ' ')} • {repair.priority}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs">{repair.id.slice(0, 8)}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Linked Emails */}
                  {emails.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email Threads ({emails.length})
                      </h4>
                      <div className="space-y-2">
                        {emails.map((thread) => (
                          <Link key={thread.id} href={`/inbox?thread=${thread.id}`}>
                            <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-sm line-clamp-1">{thread.subject}</p>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {thread.customerEmail || 'No sender'}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Linked To-Dos */}
                  {todos.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <CheckSquare className="h-4 w-4" />
                        Related Tasks ({todos.length})
                      </h4>
                      <div className="space-y-2">
                        {todos.map((todo) => (
                          <div key={todo.id} className="p-3 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${todo.completedAt ? 'bg-chart-2' : 'bg-muted'}`} />
                              <p className="text-sm flex-1">{todo.title}</p>
                              {todo.priority && (
                                <Badge variant="outline" className="text-xs">{todo.priority}</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No linked items message */}
                  {orders.length === 0 && repairs.length === 0 && emails.length === 0 && todos.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <LinkIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No linked items yet</p>
                      <p className="text-xs mt-1">Link orders, repairs, or emails to this case</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="timeline" className="mt-4 space-y-4">
                  {/* Internal Notes */}
                  {notes.length > 0 ? (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="p-4 border rounded-lg">
                          <div className="flex items-start gap-3">
                            <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm">{note.content}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {note.createdAt ? format(new Date(note.createdAt), 'MMM d, yyyy HH:mm') : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <StickyNote className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No timeline entries yet</p>
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Case not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
