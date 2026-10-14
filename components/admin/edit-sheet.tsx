"use client";

import { useState, type ReactNode } from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Side panel used to create or edit one entry, with save and (confirmed) delete.
export function EditSheet({
  open, onOpenChange, title, description, canEdit, onSave, onDelete, saveDisabled, children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  canEdit: boolean;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  saveDisabled?: boolean;
  children: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const run = async (fn: () => Promise<void>, done: string) => {
    setSaving(true);
    try {
      await fn();
      toast.success(done);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <fieldset disabled={!canEdit} className="space-y-5 px-4">{children}</fieldset>
        {canEdit && (
          <SheetFooter className="flex-row justify-between">
            {onDelete ? (
              <Button variant="ghost" className="text-destructive" onClick={() => setConfirming(true)} disabled={saving}>
                <Trash2Icon /> Delete
              </Button>
            ) : <span />}
            <Button onClick={() => run(onSave, "Saved")} disabled={saving || saveDisabled}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        )}
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
              <AlertDialogDescription>This removes it from the knowledge base for good.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => onDelete && run(onDelete, "Deleted")}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
