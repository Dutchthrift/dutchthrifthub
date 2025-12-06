import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings as SettingsIcon, Mail, Plug, Server, Save } from "lucide-react";
import { Navigation } from "@/components/layout/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const generalSettingsSchema = z.object({
  companyName: z.string().min(1, "Bedrijfsnaam is verplicht"),
  contactEmail: z.string().email("Voer een geldig e-mailadres in"),
  timeZone: z.string(),
  language: z.string(),
});

const emailSettingsSchema = z.object({
  imapHost: z.string().min(1, "IMAP host is verplicht"),
  imapPort: z.string().min(1, "IMAP poort is verplicht"),
  imapUser: z.string().email("Voer een geldig e-mailadres in"),
  smtpHost: z.string().min(1, "SMTP host is verplicht"),
  smtpPort: z.string().min(1, "SMTP poort is verplicht"),
  syncFrequency: z.string(),
});

const integrationSettingsSchema = z.object({
  shopifyDomain: z.string().optional(),
  shopifyAccessToken: z.string().optional(),
  outlookClientId: z.string().optional(),
  outlookTenantId: z.string().optional(),
});

const systemSettingsSchema = z.object({
  sessionTimeout: z.string(),
  defaultPagination: z.string(),
  enableNotifications: z.boolean(),
  enableEmailSync: z.boolean(),
});

type GeneralSettings = z.infer<typeof generalSettingsSchema>;
type EmailSettings = z.infer<typeof emailSettingsSchema>;
type IntegrationSettings = z.infer<typeof integrationSettingsSchema>;
type SystemSettings = z.infer<typeof systemSettingsSchema>;

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");
  const { toast } = useToast();

  const generalForm = useForm<GeneralSettings>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      companyName: "DutchThrift",
      contactEmail: "info@dutchthrift.com",
      timeZone: "Europe/Amsterdam",
      language: "nl",
    },
  });

  const emailForm = useForm<EmailSettings>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      imapHost: "",
      imapPort: "993",
      imapUser: "",
      smtpHost: "",
      smtpPort: "587",
      syncFrequency: "5",
    },
  });

  const integrationForm = useForm<IntegrationSettings>({
    resolver: zodResolver(integrationSettingsSchema),
    defaultValues: {
      shopifyDomain: "",
      shopifyAccessToken: "",
      outlookClientId: "",
      outlookTenantId: "",
    },
  });

  const systemForm = useForm<SystemSettings>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      sessionTimeout: "3600",
      defaultPagination: "25",
      enableNotifications: true,
      enableEmailSync: true,
    },
  });

  const onSaveGeneral = (data: GeneralSettings) => {
    console.log("General settings:", data);
    toast({
      title: "Instellingen opgeslagen",
      description: "Algemene instellingen zijn succesvol bijgewerkt.",
    });
  };

  const onSaveEmail = (data: EmailSettings) => {
    console.log("Email settings:", data);
    toast({
      title: "Instellingen opgeslagen",
      description: "E-mailinstellingen zijn succesvol bijgewerkt.",
    });
  };

  const onSaveIntegration = (data: IntegrationSettings) => {
    console.log("Integration settings:", data);
    toast({
      title: "Instellingen opgeslagen",
      description: "Integratie-instellingen zijn succesvol bijgewerkt.",
    });
  };

  const onSaveSystem = (data: SystemSettings) => {
    console.log("System settings:", data);
    toast({
      title: "Instellingen opgeslagen",
      description: "Systeeminstellingen zijn succesvol bijgewerkt.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="p-6">
        <div className="mb-6">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <SettingsIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Instellingen</h1>
              <p className="text-sm text-muted-foreground">Beheer systeemconfiguratie en voorkeuren</p>
            </div>
          </div>
        </div>

        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="general" data-testid="tab-general">
                <SettingsIcon className="h-4 w-4 mr-2" />
                Algemeen
              </TabsTrigger>
              <TabsTrigger value="email" data-testid="tab-email">
                <Mail className="h-4 w-4 mr-2" />
                E-mail
              </TabsTrigger>
              <TabsTrigger value="integration" data-testid="tab-integration">
                <Plug className="h-4 w-4 mr-2" />
                Integraties
              </TabsTrigger>
              <TabsTrigger value="system" data-testid="tab-system">
                <Server className="h-4 w-4 mr-2" />
                Systeem
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Algemene Instellingen</CardTitle>
                  <CardDescription>Configureer basis bedrijfs- en applicatie-instellingen</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...generalForm}>
                    <form onSubmit={generalForm.handleSubmit(onSaveGeneral)} className="space-y-6">
                      <FormField
                        control={generalForm.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bedrijfsnaam</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="DutchThrift" data-testid="input-company-name" />
                            </FormControl>
                            <FormDescription>De naam van je bedrijf of organisatie</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={generalForm.control}
                        name="contactEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact E-mail</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="info@dutchthrift.com" data-testid="input-contact-email" />
                            </FormControl>
                            <FormDescription>Hoofd e-mailadres voor klantenservice</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={generalForm.control}
                        name="timeZone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tijdzone</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-timezone">
                                  <SelectValue placeholder="Selecteer tijdzone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Europe/Amsterdam">Europe/Amsterdam</SelectItem>
                                <SelectItem value="Europe/London">Europe/London</SelectItem>
                                <SelectItem value="America/New_York">America/New York</SelectItem>
                                <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>Standaard tijdzone voor de applicatie</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={generalForm.control}
                        name="language"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Taal</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-language">
                                  <SelectValue placeholder="Selecteer taal" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="nl">Nederlands</SelectItem>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="de">Deutsch</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>Standaard taal voor de interface</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" data-testid="button-save-general">
                        <Save className="h-4 w-4 mr-2" />
                        Algemene Instellingen Opslaan
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="email" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Settings</CardTitle>
                  <CardDescription>Configure IMAP and SMTP server settings for email synchronization</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...emailForm}>
                    <form onSubmit={emailForm.handleSubmit(onSaveEmail)} className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">IMAP Configuratie</h3>

                        <FormField
                          control={emailForm.control}
                          name="imapHost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>IMAP Host</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="imap.gmail.com" data-testid="input-imap-host" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={emailForm.control}
                          name="imapPort"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>IMAP Port</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="993" data-testid="input-imap-port" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={emailForm.control}
                          name="imapUser"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>IMAP Gebruikersnaam</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" placeholder="your-email@example.com" data-testid="input-imap-user" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">SMTP Configuratie</h3>

                        <FormField
                          control={emailForm.control}
                          name="smtpHost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Host</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="smtp.gmail.com" data-testid="input-smtp-host" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={emailForm.control}
                          name="smtpPort"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Port</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="587" data-testid="input-smtp-port" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={emailForm.control}
                        name="syncFrequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sync Frequentie (minuten)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" placeholder="5" data-testid="input-sync-frequency" />
                            </FormControl>
                            <FormDescription>Hoe vaak nieuwe e-mails worden opgehaald</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" data-testid="button-save-email">
                        <Save className="h-4 w-4 mr-2" />
                        E-mailinstellingen Opslaan
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integration" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Integration Settings</CardTitle>
                  <CardDescription>Configure third-party integrations and API connections</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...integrationForm}>
                    <form onSubmit={integrationForm.handleSubmit(onSaveIntegration)} className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Shopify Integratie</h3>

                        <FormField
                          control={integrationForm.control}
                          name="shopifyDomain"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Shopify Domain</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="your-store.myshopify.com" data-testid="input-shopify-domain" />
                              </FormControl>
                              <FormDescription>Je Shopify winkel domein</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={integrationForm.control}
                          name="shopifyAccessToken"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Shopify Access Token</FormLabel>
                              <FormControl>
                                <Input {...field} type="password" placeholder="shpat_..." data-testid="input-shopify-token" />
                              </FormControl>
                              <FormDescription>Admin API toegangstoken voor Shopify</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Microsoft Outlook Integratie</h3>

                        <FormField
                          control={integrationForm.control}
                          name="outlookClientId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Client ID</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" data-testid="input-outlook-client-id" />
                              </FormControl>
                              <FormDescription>Microsoft Graph API client ID</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={integrationForm.control}
                          name="outlookTenantId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tenant ID</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" data-testid="input-outlook-tenant-id" />
                              </FormControl>
                              <FormDescription>Microsoft Azure tenant ID</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button type="submit" data-testid="button-save-integration">
                        <Save className="h-4 w-4 mr-2" />
                        Integratie-instellingen Opslaan
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>Configure system-wide application settings and preferences</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...systemForm}>
                    <form onSubmit={systemForm.handleSubmit(onSaveSystem)} className="space-y-6">
                      <FormField
                        control={systemForm.control}
                        name="sessionTimeout"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sessie Timeout (seconden)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" placeholder="3600" data-testid="input-session-timeout" />
                            </FormControl>
                            <FormDescription>Hoe lang voordat gebruikerssessies verlopen (standaard: 3600 = 1 uur)</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={systemForm.control}
                        name="defaultPagination"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Standaard Paginering</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-pagination">
                                  <SelectValue placeholder="Selecteer paginagrootte" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="10">10 items</SelectItem>
                                <SelectItem value="25">25 items</SelectItem>
                                <SelectItem value="50">50 items</SelectItem>
                                <SelectItem value="100">100 items</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>Standaard aantal items per pagina</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={systemForm.control}
                        name="enableNotifications"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable Notifications</FormLabel>
                              <FormDescription>
                                Receive notifications for important events
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-notifications"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={systemForm.control}
                        name="enableEmailSync"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable Email Sync</FormLabel>
                              <FormDescription>
                                Automatically synchronize emails from configured accounts
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-email-sync"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <Button type="submit" data-testid="button-save-system">
                        <Save className="h-4 w-4 mr-2" />
                        Systeeminstellingen Opslaan
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
