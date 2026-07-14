import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { createConsultationRequest } from "@/lib/recommendationService";
import { Loader2, MessageSquareWarning } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  userId: string;
  coachId: string | null;
  onCreated?: () => void;
}

export default function RequestConsultationDialog({ open, onOpenChange, userId, coachId, onCreated }: Props) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "urgent">("normal");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!topic.trim()) return toast({ title: "Tell your coach what you need help with", variant: "destructive" });
    try {
      setSaving(true);
      await createConsultationRequest({ user_id: userId, coach_id: coachId, topic, urgency });
      toast({ title: "Request sent", description: "Your coach will reach out soon." });
      onCreated?.();
      onOpenChange(false);
      setTopic("");
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquareWarning className="w-4 h-4 text-primary" /> Request a consultation</DialogTitle>
          <DialogDescription>Your coach will schedule a call and share a meeting link.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>What do you need help with?</Label>
            <Textarea rows={4} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. My fasting glucose is going up despite the plan…" />
          </div>
          <div>
            <Label>Urgency</Label>
            <RadioGroup value={urgency} onValueChange={(v) => setUrgency(v as any)} className="flex gap-3 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="normal" /> <span className="text-sm">Normal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="urgent" /> <span className="text-sm text-destructive">Urgent</span>
              </label>
            </RadioGroup>
          </div>
          <Button onClick={submit} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Send request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
