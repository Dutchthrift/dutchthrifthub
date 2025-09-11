import { useState, useRef, useId } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  maxSizeMB?: number;
  className?: string;
}

export function ImageUpload({ 
  images, 
  onChange, 
  maxImages = 5, 
  maxSizeMB = 5,
  className 
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const { toast } = useToast();

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;

    const newImages: string[] = [];
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    for (let i = 0; i < files.length && images.length + newImages.length < maxImages; i++) {
      const file = files[i];
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Ongeldig bestand",
          description: `${file.name} is geen geldig afbeelding bestand.`,
          variant: "destructive"
        });
        continue;
      }

      // Check file size
      if (file.size > maxSizeBytes) {
        toast({
          title: "Bestand te groot",
          description: `${file.name} is te groot. Maximum grootte is ${maxSizeMB}MB.`,
          variant: "destructive"
        });
        continue;
      }

      try {
        // Convert to base64
        const reader = new FileReader();
        const result = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        newImages.push(result);
      } catch (error) {
        console.error('Error reading file:', error);
        toast({
          title: "Upload fout",
          description: `Kon ${file.name} niet laden.`,
          variant: "destructive"
        });
      }
    }

    if (newImages.length > 0) {
      onChange([...images, ...newImages]);
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    event.target.value = ''; // Reset input
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onChange(newImages);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragging ? "border-primary bg-primary/10" : "border-gray-300 dark:border-gray-600",
          images.length >= maxImages ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => {
          if (images.length < maxImages) {
            fileInputRef.current?.click();
          }
        }}
        data-testid="image-upload-drop-zone"
      >
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
          disabled={images.length >= maxImages}
          data-testid="input-image-upload"
        />
        
        <div className="space-y-2">
          <Upload className="h-8 w-8 mx-auto text-gray-400" />
          <div>
            <p className="text-sm font-medium">
              {images.length >= maxImages 
                ? `Maximum ${maxImages} afbeeldingen bereikt`
                : "Klik om afbeeldingen te uploaden"
              }
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Sleep en laat los, of klik om bestanden te selecteren
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PNG, JPG, GIF tot {maxSizeMB}MB
            </p>
          </div>
        </div>
      </div>

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <Card key={index} className="relative group overflow-hidden">
              <CardContent className="p-2">
                <div className="aspect-square relative">
                  <img
                    src={image}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-full object-cover rounded"
                    data-testid={`image-preview-${index}`}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                    data-testid={`button-remove-image-${index}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ImageIcon className="h-4 w-4" />
          <span>{images.length} van {maxImages} afbeeldingen</span>
        </div>
      )}
    </div>
  );
}