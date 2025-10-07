import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

interface ImportProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: {
    type: string;
    processed?: number;
    total?: number;
    created?: number;
    updated?: number;
    message: string;
  } | null;
}

export function ImportProgressDialog({ open, onOpenChange, progress }: ImportProgressDialogProps) {
  const percentage = progress?.total 
    ? Math.round((progress.processed || 0) / progress.total * 100) 
    : 0;

  const isComplete = progress?.type === 'complete';
  const isError = progress?.type === 'error';
  const isInProgress = progress && !isComplete && !isError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="import-progress-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isComplete && <CheckCircle className="h-5 w-5 text-green-500" />}
            {isError && <XCircle className="h-5 w-5 text-destructive" />}
            {isInProgress && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {isComplete ? 'Import Voltooid' : isError ? 'Import Mislukt' : 'Bezig met importeren...'}
          </DialogTitle>
          <DialogDescription>
            {progress?.message || 'Voorbereiden...'}
          </DialogDescription>
        </DialogHeader>

        {progress?.total && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Voortgang</span>
                <span className="font-medium" data-testid="progress-count">
                  {progress.processed || 0} / {progress.total}
                </span>
              </div>
              <Progress value={percentage} className="h-2" data-testid="progress-bar" />
              <div className="text-xs text-muted-foreground text-right">
                {percentage}%
              </div>
            </div>

            {(progress.created !== undefined || progress.updated !== undefined) && (
              <div className="flex gap-4 text-sm">
                {progress.created !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Nieuw: </span>
                    <span className="font-medium text-green-600 dark:text-green-400" data-testid="created-count">
                      {progress.created}
                    </span>
                  </div>
                )}
                {progress.updated !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Bijgewerkt: </span>
                    <span className="font-medium text-blue-600 dark:text-blue-400" data-testid="updated-count">
                      {progress.updated}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isComplete && (
          <div className="text-sm text-center text-green-600 dark:text-green-400 py-2" data-testid="complete-message">
            ✓ Import succesvol afgerond
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
