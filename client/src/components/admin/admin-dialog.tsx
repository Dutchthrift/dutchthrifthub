import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus } from "lucide-react";

const createUserSchema = z.object({
  username: z.string().min(3, "Gebruikersnaam moet minstens 3 karakters lang zijn"),
  email: z.string().email("Ongeldig email adres"),
  password: z.string().min(6, "Wachtwoord moet minstens 6 karakters lang zijn"),
  role: z.enum(["beheerder", "technicus", "support"], {
    required_error: "Selecteer een rol",
  }),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

interface AdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminDialog({ open, onOpenChange }: AdminDialogProps) {
  const [activeTab, setActiveTab] = useState("create-user");
  const { toast } = useToast();

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      role: undefined,
      firstName: "",
      lastName: "",
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const response = await apiRequest('POST', '/api/admin/users', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Gebruiker aangemaakt",
        description: "De nieuwe gebruiker is succesvol aangemaakt",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij aanmaken gebruiker",
        description: error.message || "Er is een fout opgetreden bij het aanmaken van de gebruiker",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateUserForm) => {
    createUserMutation.mutate(data);
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "beheerder":
        return "Beheerder (Administrator)";
      case "technicus":
        return "Technicus (Technician/Mechanic)";
      case "support":
        return "Support (Customer Service)";
      default:
        return role;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="admin-dialog">
        <DialogHeader>
          <DialogTitle>Admin Beheer</DialogTitle>
          <DialogDescription>
            Beheer gebruikers en systeem instellingen
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="create-user" data-testid="create-user-tab">
              <UserPlus className="mr-2 h-4 w-4" />
              Gebruiker Aanmaken
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create-user" className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gebruikersnaam</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Voer gebruikersnaam in"
                          {...field}
                          data-testid="username-input"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Adres</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Voer email adres in"
                          {...field}
                          data-testid="email-input"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wachtwoord</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Voer wachtwoord in"
                          {...field}
                          data-testid="password-input"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="role-select">
                            <SelectValue placeholder="Selecteer een rol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beheerder" data-testid="role-beheerder">
                            {getRoleDisplayName("beheerder")}
                          </SelectItem>
                          <SelectItem value="technicus" data-testid="role-technicus">
                            {getRoleDisplayName("technicus")}
                          </SelectItem>
                          <SelectItem value="support" data-testid="role-support">
                            {getRoleDisplayName("support")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Voornaam (optioneel)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Voornaam"
                            {...field}
                            data-testid="firstname-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Achternaam (optioneel)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Achternaam"
                            {...field}
                            data-testid="lastname-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    data-testid="cancel-button"
                  >
                    Annuleren
                  </Button>
                  <Button
                    type="submit"
                    disabled={createUserMutation.isPending}
                    data-testid="create-user-button"
                  >
                    {createUserMutation.isPending ? "Aanmaken..." : "Gebruiker Aanmaken"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}