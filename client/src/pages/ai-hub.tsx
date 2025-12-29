import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Brain,
    Search,
    Book,
    Settings,
    Plus,
    Trash2,
    Save,
    ChevronRight,
    MessageSquare,
    Lightbulb,
    FileText,
    History,
    Sparkles
} from "lucide-react";
import { Navigation } from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AiKnowledge, AiSettings } from "@shared/schema";

export default function AiHub() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResult, setSearchResult] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<AiKnowledge | null>(null);

    // Queries
    const { data: knowledge = [] } = useQuery<AiKnowledge[]>({
        queryKey: ["/api/ai/knowledge"],
    });

    const { data: aiSettings } = useQuery<AiSettings>({
        queryKey: ["/api/mail/settings/ai"],
    });

    // Mutations
    const searchMutation = useMutation({
        mutationFn: async (query: string) => {
            const res = await apiRequest("POST", "/api/ai/search", { query });
            const data = await res.json();
            return data.answer;
        },
        onSuccess: (data) => {
            setSearchResult(data);
            setIsSearching(false);
        },
        onError: () => {
            toast({ title: "Fout", description: "Kon de databank niet doorzoeken.", variant: "destructive" });
            setIsSearching(false);
        }
    });

    const createMutation = useMutation({
        mutationFn: async (item: any) => {
            const res = await apiRequest("POST", "/api/ai/knowledge", item);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/ai/knowledge"] });
            setIsCreateModalOpen(false);
            toast({ title: "Succes", description: "Document toegevoegd aan de databank." });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
            const res = await apiRequest("PATCH", `/api/ai/knowledge/${id}`, updates);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/ai/knowledge"] });
            toast({ title: "Bijgewerkt", description: "Document bijgewerkt." });
        }
    });

    const updateSettingsMutation = useMutation({
        mutationFn: async (updates: Partial<AiSettings>) => {
            const res = await apiRequest("PATCH", "/api/mail/settings/ai", updates);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/mail/settings/ai"] });
            toast({ title: "Opgeslagen", description: "Instellingen bijgewerkt." });
        },
        onError: () => {
            toast({ title: "Fout", description: "Kon instellingen niet opslaan.", variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/ai/knowledge/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/ai/knowledge"] });
            toast({ title: "Verwijderd", description: "Document verwijderd uit de databank." });
        }
    });

    const handleSearch = () => {
        if (!searchQuery) return;
        setIsSearching(true);
        setSearchResult(null);
        searchMutation.mutate(searchQuery);
    };

    return (
        <div className="min-h-screen bg-background">
            <Navigation />
            <main className="container mx-auto px-4 py-6 animate-in fade-in duration-500">
                {/* Header Card */}
                <div className="bg-card rounded-lg p-6 mb-6 border">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                                <Brain className="h-8 w-8 text-[#FF6600]" />
                                AI Hub
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Beheer de kennis en stijl van je AI assistent.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="gap-2 bg-[#FF6600] hover:bg-[#E65C00]"
                            >
                                <Plus className="h-4 w-4" />
                                Nieuw Document
                            </Button>
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="search" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 md:w-[600px] mb-8">
                        <TabsTrigger value="search" className="gap-2">
                            <Search className="h-4 w-4" />
                            AI Databank
                        </TabsTrigger>
                        <TabsTrigger value="knowledge" className="gap-2">
                            <Book className="h-4 w-4" />
                            Kennisbank
                        </TabsTrigger>
                        <TabsTrigger value="style" className="gap-2">
                            <Settings className="h-4 w-4" />
                            Stijl & Structuur
                        </TabsTrigger>
                    </TabsList>

                    {/* AI SEARCH PANEL */}
                    <TabsContent value="search" className="space-y-6">
                        <Card className="border-[#FF6600]/10 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-yellow-500" />
                                    Vraag de AI Databank
                                </CardTitle>
                                <CardDescription>
                                    Stel een vraag over je opgeslagen voorwaarden, documenten of processen.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Bijv: 'Wanneer heeft een klant recht op gratis retourneren?'"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="text-lg py-6"
                                    />
                                    <Button size="lg" onClick={handleSearch} disabled={isSearching} className="bg-[#FF6600] hover:bg-[#E65C00]">
                                        {isSearching ? "Zoeken..." : "Vraag"}
                                    </Button>
                                </div>

                                {searchResult && (
                                    <div className="mt-8 p-6 bg-muted/50 rounded-xl border border-[#FF6600]/10 animate-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Badge variant="secondary" className="gap-1">
                                                <Sparkles className="h-3 w-3" /> AI Antwoord
                                            </Badge>
                                        </div>
                                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-foreground">
                                            {searchResult}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="bg-muted/30">
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-[#FF6600]/10 rounded-lg">
                                            <Lightbulb className="h-5 w-5 text-[#FF6600]" />
                                        </div>
                                        <span className="font-medium">Direct Inzicht</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Krijg direct antwoord op basis van je eigen documentatie.
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="bg-muted/30">
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                                            <History className="h-5 w-5 text-yellow-600" />
                                        </div>
                                        <span className="font-medium">Altijd Up-to-date</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        De AI gebruikt altijd de nieuwste versie van je documenten.
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="bg-muted/30">
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-500/10 rounded-lg">
                                            <MessageSquare className="h-5 w-5 text-green-600" />
                                        </div>
                                        <span className="font-medium">Mail Koppeling</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Dezelfde kennis wordt gebruikt bij automatische mail-analyses.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* KNOWLEDGE MANAGER */}
                    <TabsContent value="knowledge" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-card rounded-xl border p-1 shadow-sm overflow-hidden h-[700px]">
                            {/* Sidebar list */}
                            <div className="md:col-span-1 bg-muted/20 border-r flex flex-col h-full">
                                <div className="p-4 border-b flex justify-between items-center">
                                    <h3 className="font-semibold text-sm text-foreground uppercase tracking-wider">Databank</h3>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsCreateModalOpen(true)}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                                <ScrollArea className="flex-1">
                                    <div className="p-2 space-y-1">
                                        {knowledge.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => setSelectedItem(item)}
                                                className={`w-full text-left px-4 py-3 rounded-lg transition-all flex flex-col gap-1 relative overflow-hidden group ${selectedItem?.id === item.id
                                                    ? 'bg-white shadow-sm ring-1 ring-[#FF6600]/20'
                                                    : 'hover:bg-muted/50 text-muted-foreground'
                                                    }`}
                                            >
                                                {selectedItem?.id === item.id && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF6600]" />
                                                )}
                                                <div className="flex justify-between items-start gap-2">
                                                    <span className={`text-sm font-semibold truncate ${selectedItem?.id === item.id ? 'text-[#FF6600]' : 'text-foreground'}`}>
                                                        {item.title}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className="text-[10px] opacity-70 uppercase font-bold tracking-wider">{item.category}</span>
                                                    <Badge variant={item.isActive ? "secondary" : "destructive"} className="text-[9px] h-3.5 px-1.5 font-bold uppercase">
                                                        {item.isActive ? "Actief" : "Uit"}
                                                    </Badge>
                                                </div>
                                            </button>
                                        ))}
                                        {knowledge.length === 0 && (
                                            <div className="p-8 text-center space-y-2 opacity-50">
                                                <Book className="h-8 w-8 mx-auto mb-2" />
                                                <p className="text-xs italic">Geen documenten.</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* Editor area */}
                            <div className="md:col-span-3 h-full overflow-hidden flex flex-col bg-white">
                                {selectedItem ? (
                                    <div className="h-full flex flex-col">
                                        <div className="p-6 border-b flex justify-between items-center bg-card/10">
                                            <div className="space-y-1 flex-1 pr-4">
                                                <Input
                                                    value={selectedItem.title}
                                                    onChange={(e) => setSelectedItem({ ...selectedItem, title: e.target.value })}
                                                    className="text-2xl font-bold bg-transparent border-none p-0 focus-visible:ring-0 h-auto text-[#FF6600]"
                                                />
                                                <div className="flex gap-2 items-center">
                                                    <Badge variant="outline" className="text-[10px]">{selectedItem.category}</Badge>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <History className="h-3 w-3" />
                                                        {new Date(selectedItem.updatedAt || '').toLocaleDateString('nl-NL')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-muted-foreground hover:text-destructive"
                                                    onClick={() => deleteMutation.mutate(selectedItem.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="gap-2 bg-[#FF6600] hover:bg-[#E65C00]"
                                                    onClick={() => updateMutation.mutate({ id: selectedItem.id, updates: selectedItem })}
                                                >
                                                    <Save className="h-4 w-4" />
                                                    Opslaan
                                                </Button>
                                            </div>
                                        </div>

                                        <ScrollArea className="flex-1 p-6">
                                            <div className="space-y-8 max-w-4xl">
                                                <div className="grid grid-cols-2 gap-8 bg-muted/20 p-4 rounded-lg border border-border/50">
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categorie</label>
                                                        <Select
                                                            value={selectedItem.category}
                                                            onValueChange={(val) => setSelectedItem({ ...selectedItem, category: val })}
                                                        >
                                                            <SelectTrigger className="bg-white">
                                                                <SelectValue placeholder="Kies categorie" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Voorwaarden">Voorwaarden</SelectItem>
                                                                <SelectItem value="Logistiek">Logistiek</SelectItem>
                                                                <SelectItem value="Reparaties">Reparaties</SelectItem>
                                                                <SelectItem value="Garantie">Garantie</SelectItem>
                                                                <SelectItem value="Algemeen">Algemeen</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">Status</label>
                                                        <div className="flex items-center space-x-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedItem.isActive || false}
                                                                onChange={(e) => setSelectedItem({ ...selectedItem, isActive: e.target.checked })}
                                                                id="isActive"
                                                                className="h-4 w-4 rounded border-gray-300 text-[#FF6600] focus:ring-[#FF6600]"
                                                            />
                                                            <label htmlFor="isActive" className="text-sm font-medium">
                                                                Actief gebruiken door AI
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inhoud (Markdown)</label>
                                                        <Badge variant="outline" className="text-[9px] opacity-70">Rich text ondersteund</Badge>
                                                    </div>
                                                    <Textarea
                                                        value={selectedItem.content}
                                                        onChange={(e) => setSelectedItem({ ...selectedItem, content: e.target.value })}
                                                        placeholder="Plak hier je tekst..."
                                                        className="min-h-[400px] font-mono text-sm leading-relaxed p-6 bg-white border border-border/50 shadow-inner focus-visible:ring-1 focus-visible:ring-[#FF6600]/20 resize-none"
                                                    />
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4 bg-muted/5">
                                        <div className="relative">
                                            <FileText className="h-16 w-16 opacity-10" />
                                            <Plus className="h-6 w-6 text-[#FF6600] opacity-20 absolute -top-1 -right-1" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-semibold text-foreground">Selecteer een document</p>
                                            <p className="text-xs mt-1">Kies een document uit de lijst om te bewerken of verwijderen.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* STYLE DESIGNER */}
                    <TabsContent value="style" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Card className="border-[#FF6600]/10 shadow-sm overflow-hidden">
                                <CardHeader className="bg-muted/30 border-b">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-[#FF6600]/10 rounded-lg">
                                            <MessageSquare className="h-5 w-5 text-[#FF6600]" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">Mailing Structuur</CardTitle>
                                            <CardDescription>Definieer hoe een automatische mail eruit moet zien.</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vaste Aanhef (Header)</label>
                                            <Badge variant="outline" className="text-[9px]">Verplicht</Badge>
                                        </div>
                                        <Textarea
                                            placeholder="Bijv: 'Hallo [Klantnaam], \n\nBedankt voor je bericht!'"
                                            className="h-28 bg-muted/5 border-none focus-visible:ring-1 focus-visible:ring-[#FF6600]/20"
                                            defaultValue={aiSettings?.emailHeader || ""}
                                            onBlur={(e) => {
                                                updateSettingsMutation.mutate({ emailHeader: e.target.value });
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vaste Afsluiting (Footer)</label>
                                            <Badge variant="outline" className="text-[9px]">Verplicht</Badge>
                                        </div>
                                        <Textarea
                                            placeholder="Bijv: 'Met vriendelijke groet, \n\nNiek - DutchThrift'"
                                            className="h-28 bg-muted/5 border-none focus-visible:ring-1 focus-visible:ring-[#FF6600]/20"
                                            defaultValue={aiSettings?.emailFooter || ""}
                                            onBlur={(e) => {
                                                updateSettingsMutation.mutate({ emailFooter: e.target.value });
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Structurele Regels</label>
                                        <Textarea
                                            placeholder="Bijv: 'Altijd eindigen met een afsluitende vraag.', 'Houd het bericht onder de 200 woorden.'"
                                            className="h-28 bg-muted/5 border-none focus-visible:ring-1 focus-visible:ring-[#FF6600]/20"
                                            defaultValue={aiSettings?.structureRules || ""}
                                            onBlur={(e) => {
                                                updateSettingsMutation.mutate({ structureRules: e.target.value });
                                            }}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-dashed border-muted-foreground/30 bg-muted/2 shadow-none overflow-hidden">
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-destructive/10 rounded-lg">
                                            <Trash2 className="h-5 w-5 text-destructive" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">Verboden Woorden & Zinnen</CardTitle>
                                            <CardDescription>Zorg dat de AI deze woorden of zinnen nooit gebruikt.</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Voeg hier woorden toe die niet passen bij je merk of die juridisch gevoelig liggen.
                                    </p>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Voeg verboden woord toe..."
                                            id="prohibited-input"
                                            className="bg-white"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const input = e.currentTarget;
                                                    if (!input.value) return;
                                                    const newList = [...(aiSettings?.prohibitedPhrases || []), input.value];
                                                    updateSettingsMutation.mutate({ prohibitedPhrases: newList });
                                                    input.value = "";
                                                }
                                            }}
                                        />
                                        <Button
                                            onClick={() => {
                                                const input = document.getElementById('prohibited-input') as HTMLInputElement;
                                                if (!input.value) return;
                                                const newList = [...(aiSettings?.prohibitedPhrases || []), input.value];
                                                updateSettingsMutation.mutate({ prohibitedPhrases: newList });
                                                input.value = "";
                                            }}
                                            className="bg-foreground hover:bg-foreground/90"
                                        >
                                            Voeg toe
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {(aiSettings?.prohibitedPhrases || []).map((phrase: string, idx: number) => (
                                            <Badge key={phrase + idx} variant="destructive" className="gap-1 pr-1 pl-3 py-1 text-xs font-medium bg-destructive/90 hover:bg-destructive">
                                                {phrase}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-4 w-4 hover:bg-white/20 ml-1 rounded-sm p-0"
                                                    onClick={() => {
                                                        const newList = (aiSettings?.prohibitedPhrases || []).filter((_, i) => i !== idx);
                                                        updateSettingsMutation.mutate({ prohibitedPhrases: newList });
                                                    }}
                                                >
                                                    <Trash2 className="h-2 w-2" />
                                                </Button>
                                            </Badge>
                                        ))}
                                        {(!aiSettings?.prohibitedPhrases || aiSettings.prohibitedPhrases.length === 0) && (
                                            <div className="w-full py-8 text-center border-2 border-dashed rounded-lg opacity-40">
                                                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Geen verboden filters</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* CREATE MODAL */}
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>Nieuw Document Toevoegen</DialogTitle>
                            <DialogDescription>
                                Maak een nieuw document aan voor de AI kennisbank.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Titel</label>
                                <Input id="new-title" placeholder="Bijv: Retourvoorwaarden 2024" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Categorie</label>
                                <input type="hidden" id="new-category-hidden" defaultValue="Algemeen" />
                                <Select defaultValue="Algemeen" onValueChange={(val) => {
                                    const el = document.getElementById('new-category-hidden') as HTMLInputElement;
                                    if (el) el.value = val;
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Kies categorie" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Voorwaarden">Voorwaarden</SelectItem>
                                        <SelectItem value="Logistiek">Logistiek</SelectItem>
                                        <SelectItem value="Reparaties">Reparaties</SelectItem>
                                        <SelectItem value="Garantie">Garantie</SelectItem>
                                        <SelectItem value="Algemeen">Algemeen</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Inhoud</label>
                                <Textarea id="new-content" placeholder="Plak hier je tekst..." className="min-h-[200px]" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Annuleren</Button>
                            <Button onClick={() => {
                                const title = (document.getElementById('new-title') as HTMLInputElement).value;
                                const content = (document.getElementById('new-content') as HTMLTextAreaElement).value;
                                const category = (document.getElementById('new-category-hidden') as HTMLInputElement).value || "Algemeen";

                                if (!title || !content) {
                                    toast({ title: "Fout", description: "Titel en inhoud zijn verplicht.", variant: "destructive" });
                                    return;
                                }

                                createMutation.mutate({ title, content, category, isActive: true });
                            }}>Document Toevoegen</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}
