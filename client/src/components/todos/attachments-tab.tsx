import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Upload, File, Download, Trash2, Paperclip, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Attachment {
    id: string;
    todoId: string;
    filename: string;
    storageUrl: string;
    contentType: string | null;
    size: number | null;
    uploadedBy: string | null;
    uploadedAt: string;
}

interface AttachmentsTabProps {
    todoId: string;
}

export function AttachmentsTab({ todoId }: AttachmentsTabProps) {
    const [isDragging, setIsDragging] = useState(false);
    const { toast } = useToast();

    const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
        queryKey: ["/api/todos", todoId, "attachments"],
        queryFn: async () => {
            const response = await fetch(`/api/todos/${todoId}/attachments`);
            if (!response.ok) throw new Error("Failed to fetch attachments");
            return response.json();
        },
    });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`/api/todos/${todoId}/attachments`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Failed to upload file");
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/todos", todoId, "attachments"] });
            toast({
                title: "File uploaded",
                description: "Your file has been uploaded successfully",
            });
        },
        onError: () => {
            toast({
                title: "Upload failed",
                description: "Failed to upload file",
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (attachmentId: string) => {
            const response = await fetch(`/api/todos/${todoId}/attachments/${attachmentId}`, {
                method: "DELETE",
            });
            if (!response.ok) throw new Error("Failed to delete attachment");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/todos", todoId, "attachments"] });
            toast({
                title: "File deleted",
                description: "Attachment has been removed",
            });
        },
        onError: () => {
            toast({
                title: "Delete failed",
                description: "Failed to delete attachment",
                variant: "destructive",
            });
        },
    });

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        files.forEach((file) => uploadMutation.mutate(file));
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        files.forEach((file) => uploadMutation.mutate(file));
    };

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return "Unknown size";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileIcon = (contentType: string | null) => {
        if (!contentType) return <File className="h-8 w-8" />;
        if (contentType.startsWith("image/")) return <File className="h-8 w-8 text-blue-500" />;
        if (contentType.startsWith("video/")) return <File className="h-8 w-8 text-purple-500" />;
        if (contentType.includes("pdf")) return <File className="h-8 w-8 text-red-500" />;
        return <File className="h-8 w-8" />;
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="text-center py-12">
                        <Paperclip className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50 animate-pulse" />
                        <p className="text-sm text-muted-foreground">Loading attachments...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                    <span>Attachments ({attachments.length})</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Upload Area */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                        }`}
                >
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm font-medium mb-2">Drag and drop files here</p>
                    <p className="text-xs text-muted-foreground mb-4">or</p>
                    <label htmlFor="file-upload">
                        <Button variant="outline" size="sm" asChild>
                            <span>
                                <Paperclip className="h-4 w-4 mr-2" />
                                Browse Files
                            </span>
                        </Button>
                    </label>
                    <input
                        id="file-upload"
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>

                {/* Attachments List */}
                {attachments.length > 0 && (
                    <>
                        <Separator />
                        <div className="space-y-2">
                            {attachments.map((attachment) => (
                                <div
                                    key={attachment.id}
                                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    {getFileIcon(attachment.contentType)}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{attachment.filename}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{formatFileSize(attachment.size)}</span>
                                            <span>•</span>
                                            <span>{formatDistanceToNow(new Date(attachment.uploadedAt), { addSuffix: true })}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => window.open(attachment.storageUrl, "_blank")}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => deleteMutation.mutate(attachment.id)}
                                            disabled={deleteMutation.isPending}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {attachments.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        No attachments yet
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
