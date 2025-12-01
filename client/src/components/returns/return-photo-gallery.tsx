import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Upload, X, Image as ImageIcon, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ReturnPhotoGalleryProps {
    returnId: string;
    photos: string[];
}

export function ReturnPhotoGallery({ returnId, photos }: ReturnPhotoGalleryProps) {
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();

    const uploadPhotoMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append("photo", file);

            const response = await fetch(`/api/returns/${returnId}/photos`, {
                method: "POST",
                body: formData,
                credentials: "include",
            });

            if (!response.ok) throw new Error("Upload failed");
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/returns", returnId] });
            toast({ title: "Photo uploaded successfully" });
        },
        onError: () => {
            toast({
                title: "Upload failed",
                description: "Failed to upload photo",
                variant: "destructive",
            });
        },
    });

    const deletePhotoMutation = useMutation({
        mutationFn: async (photoUrl: string) => {
            const photoIndex = photos.indexOf(photoUrl);
            const response = await fetch(`/api/returns/${returnId}/photos/${photoIndex}`, {
                method: "DELETE",
                credentials: "include",
            });

            if (!response.ok) throw new Error("Delete failed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/returns", returnId] });
            toast({ title: "Photo deleted successfully" });
        },
        onError: () => {
            toast({
                title: "Delete failed",
                description: "Failed to delete photo",
                variant: "destructive",
            });
        },
    });

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            await uploadPhotoMutation.mutateAsync(file);
        } finally {
            setIsUploading(false);
            event.target.value = "";
        }
    };

    const handleDrop = async (event: React.DragEvent) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            await uploadPhotoMutation.mutateAsync(file);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Photos ({photos.length})</CardTitle>
                        <label htmlFor="photo-upload">
                            <Button size="sm" disabled={isUploading} asChild>
                                <span>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload
                                </span>
                            </Button>
                        </label>
                        <input
                            id="photo-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {photos.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {photos.map((photo, index) => (
                                <div key={index} className="relative group">
                                    <div
                                        className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => setSelectedPhoto(photo)}
                                    >
                                        <img
                                            src={photo}
                                            alt={`Return photo ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deletePhotoMutation.mutate(photo);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div
                            className="border-2 border-dashed rounded-lg p-12 text-center"
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mb-2">
                                No photos uploaded yet
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Drag and drop or click Upload to add photos
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Lightbox Dialog */}
            <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
                <DialogContent className="max-w-4xl">
                    <div className="relative">
                        <img
                            src={selectedPhoto || ""}
                            alt="Full size"
                            className="w-full h-auto max-h-[80vh] object-contain"
                        />
                        <Button
                            size="sm"
                            variant="ghost"
                            className="absolute top-2 right-2"
                            onClick={() => setSelectedPhoto(null)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
