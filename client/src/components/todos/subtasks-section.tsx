import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Check, X, ListTodo } from "lucide-react";
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
                title: "Subtaak toegevoegd",
                description: "Subtaak is succesvol aangemaakt",
            });
        },
        onError: () => {
            toast({
                title: "Fout",
                description: "Kon subtaak niet aanmaken",
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
        },
        onError: () => {
            toast({
                title: "Fout",
                description: "Kon subtaak niet bijwerken",
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
                title: "Subtaak verwijderd",
            });
        },
        onError: () => {
            toast({
                title: "Fout",
                description: "Kon subtaak niet verwijderen",
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
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
        <div className="space-y-3">
            {/* Header with progress */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Subtaken</span>
                    {totalCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                            {completedCount}/{totalCount}
                        </Badge>
                    )}
                </div>
                {totalCount > 0 && (
                    <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <span className="text-xs text-muted-foreground">{progressPercent}%</span>
                    </div>
                )}
            </div>

            {/* Subtask List */}
            {subtasks.length > 0 && (
                <div className="space-y-1">
                    {subtasks.map((subtask) => (
                        <div
                            key={subtask.id}
                            className={`flex items-center gap-2 p-2 rounded-md transition-colors ${subtask.completed ? 'bg-muted/30' : 'bg-muted/50 hover:bg-muted/70'
                                }`}
                            data-testid={`subtask-${subtask.id}`}
                        >
                            <Checkbox
                                checked={subtask.completed}
                                onCheckedChange={() => handleToggleComplete(subtask)}
                                disabled={updateSubtaskMutation.isPending}
                                className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                                data-testid={`subtask-checkbox-${subtask.id}`}
                            />
                            {editingId === subtask.id ? (
                                <>
                                    <Input
                                        value={editingTitle}
                                        onChange={(e) => setEditingTitle(e.target.value)}
                                        className="flex-1 h-7 text-sm"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSaveEdit(subtask.id);
                                            if (e.key === "Escape") handleCancelEdit();
                                        }}
                                        data-testid={`subtask-edit-input-${subtask.id}`}
                                    />
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={() => handleSaveEdit(subtask.id)}
                                        disabled={!editingTitle.trim()}
                                        data-testid={`subtask-save-${subtask.id}`}
                                    >
                                        <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={handleCancelEdit}
                                        data-testid={`subtask-cancel-${subtask.id}`}
                                    >
                                        <X className="h-3 w-3" />
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
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
                                        onClick={() => handleStartEdit(subtask)}
                                        data-testid={`subtask-edit-${subtask.id}`}
                                    >
                                        <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 hover:opacity-100"
                                        onClick={() => deleteSubtaskMutation.mutate(subtask.id)}
                                        disabled={deleteSubtaskMutation.isPending}
                                        data-testid={`subtask-delete-${subtask.id}`}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Add New Subtask */}
            <div className="flex items-center gap-2">
                <Input
                    placeholder="Nieuwe subtaak..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateSubtask();
                    }}
                    className="h-8 text-sm"
                    data-testid="new-subtask-input"
                />
                <Button
                    size="sm"
                    onClick={handleCreateSubtask}
                    disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
                    data-testid="add-subtask-button"
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
