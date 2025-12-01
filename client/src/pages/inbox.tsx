import { Navigation } from "@/components/layout/navigation";

export default function Inbox() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-foreground">
                📧 Email Inbox
              </h1>
              <p className="text-lg text-muted-foreground max-w-md">
                This is your blank inbox page, ready to be rebuilt from scratch.
              </p>
              
              <div className="mt-8 p-6 bg-card border border-border rounded-lg text-left space-y-3">
                <h2 className="text-xl font-semibold">Ready to build?</h2>
                <p className="text-sm text-muted-foreground">
                  All previous email code has been removed. You can now implement
                  your email system from scratch with a clean slate.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
