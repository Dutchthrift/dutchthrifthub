import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Send, 
  Save
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface EmailComposeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  to?: string;
  subject?: string;
}

export function EmailCompose({ open, onOpenChange, to = "", subject = "" }: EmailComposeProps) {
  const [toEmail, setToEmail] = useState(to);
  const [emailSubject, setEmailSubject] = useState(subject);
  const [emailBody, setEmailBody] = useState("");
  const { toast } = useToast();

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { to: string; subject: string; body: string }) => {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to send email");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email sent",
        description: "Your email has been sent successfully",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Failed to send email",
        description: "There was an error sending your email",
        variant: "destructive",
      });
    }
  });

  const handleSend = () => {
    const bodyText = emailBody.replace(/<[^>]*>/g, '').trim();
    
    if (!toEmail.trim() || !emailSubject.trim() || !bodyText) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    sendEmailMutation.mutate({
      to: toEmail,
      subject: emailSubject,
      body: emailBody,
    });
  };

  const handleClose = () => {
    setToEmail("");
    setEmailSubject("");
    setEmailBody("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="email-compose-dialog">
        <DialogHeader>
          <DialogTitle>Compose Email</DialogTitle>
          <DialogDescription>
            Send a new email to a customer
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to">To *</Label>
            <Input
              id="to"
              type="email"
              placeholder="customer@example.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              data-testid="compose-to-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder="Email subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              data-testid="compose-subject-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message *</Label>
            <RichTextEditor
              content={emailBody}
              onChange={setEmailBody}
              placeholder="Type your message..."
              className="min-h-[200px]"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" data-testid="save-draft-button">
              <Save className="h-4 w-4 mr-1" />
              Save Draft
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={handleClose}
              data-testid="compose-cancel-button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendEmailMutation.isPending}
              data-testid="compose-send-button"
            >
              <Send className="h-4 w-4 mr-1" />
              {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
