import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, GripVertical, Trash2, Edit2, Check, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Subtask {
    id: string;
    todoId: string;
    title: string;
    completed: boolean;
    position: number;
    createdAt: string;
    updatedAt: string;
}

interface SubtasksSectionProps {
    todoId: string;
    subtasks: Subtask[];
}

export function SubtasksSection({ todoId, subtasks }: SubtasksSectionProps) {
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");
    const { toast } = useToast();

    const createSubtaskMutation = useMutation({
        mutationFn: async (title: string) => {
            const response = await fetch(`/api/todos/${todoId}/subtasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title }),
            });
            if (!response.ok) throw new Error("Failed to create subtask");
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/todos", todoId, "subtasks"] });
            setNewSubtaskTitle("");
            toast({
                title: "Subtask created",
                description: "Subtask has been added successfully",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to create subtask",
                variant: "destructive",
            });
        },
    });

    const updateSubtaskMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Subtask> }) => {
            const response = await fetch(`/api/subtasks/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error("Failed to update subtask");
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/todos", todoId, "subtasks"] });
            setEditingId(null);
            toast({
                title: "Subtask updated",
                description: "Subtask has been updated successfully",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to update subtask",
                variant: "destructive",
            });
        },
    });

    const deleteSubtaskMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`/api/subtasks/${id}`, {
                method: "DELETE",
            });
            if (!response.ok) throw new Error("Failed to delete subtask");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/todos", todoId, "subtasks"] });
            toast({
                title: "Subtask deleted",
                description: "Subtask has been removed successfully",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to delete subtask",
                variant: "destructive",
            });
        },
    });

    const handleToggleComplete = (subtask: Subtask) => {
        updateSubtaskMutation.mutate({
            id: subtask.id,
            data: { completed: !subtask.completed },
        });
    };

    const handleCreateSubtask = () => {
        if (newSubtaskTitle.trim()) {
            createSubtaskMutation.mutate(newSubtaskTitle);
        }
    };

    const handleStartEdit = (subtask: Subtask) => {
        setEditingId(subtask.id);
        setEditingTitle(subtask.title);
    };

    const handleSaveEdit = (id: string) => {
        if (editingTitle.trim()) {
            updateSubtaskMutation.mutate({
                id,
                data: { title: editingTitle },
            });
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditingTitle("");
    };

    const completedCount = subtasks.filter((s) => s.completed).length;
    const totalCount = subtasks.length;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                        Subtasks {totalCount > 0 && `(${completedCount}/${totalCount})`}
                    </CardTitle>
                    {totalCount > 0 && (
                        <Badge variant="outline">
                            {Math.round((completedCount / totalCount) * 100)}% Complete
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Subtask List */}
                {subtasks.length > 0 && (
                    <div className="space-y-2">
                        {subtasks.map((subtask) => (
                            <div
                                key={subtask.id}
                                className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                                data-testid={`subtask-${subtask.id}`}
                            >
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                <Checkbox
                                    checked={subtask.completed}
                                    onCheckedChange={() => handleToggleComplete(subtask)}
                                    disabled={updateSubtaskMutation.isPending}
                                    data-testid={`subtask-checkbox-${subtask.id}`}
                                />
                                {editingId === subtask.id ? (
                                    <>
                                        <Input
                                            value={editingTitle}
                                            onChange={(e) => setEditingTitle(e.target.value)}
                                            className="flex-1"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSaveEdit(subtask.id);
                                                if (e.key === "Escape") handleCancelEdit();
                                            }}
                                            data-testid={`subtask-edit-input-${subtask.id}`}
                                        />
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleSaveEdit(subtask.id)}
                                            disabled={!editingTitle.trim()}
                                            data-testid={`subtask-save-${subtask.id}`}
                                        >
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleCancelEdit}
                                            data-testid={`subtask-cancel-${subtask.id}`}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <span
                                            className={`flex-1 text-sm ${subtask.completed ? "line-through text-muted-foreground" : ""
                                                }`}
                                        >
                                            {subtask.title}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleStartEdit(subtask)}
                                            data-testid={`subtask-edit-${subtask.id}`}
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => deleteSubtaskMutation.mutate(subtask.id)}
                                            disabled={deleteSubtaskMutation.isPending}
                                            data-testid={`subtask-delete-${subtask.id}`}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {subtasks.length > 0 && <Separator />}

                {/* Add New Subtask */}
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Add a subtask..."
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateSubtask();
                        }}
                        data-testid="new-subtask-input"
                    />
                    <Button
                        onClick={handleCreateSubtask}
                        disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
                        data-testid="add-subtask-button"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
