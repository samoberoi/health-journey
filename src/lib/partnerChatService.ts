import { supabase } from "@/integrations/supabase/client";

export type PartnerChatRole = "subscriber" | "partner";

export interface PartnerChatConversation {
  id: string;
  subscriber_id: string;
  partner_id: string;
  last_message_at: string;
  subscriber_unread_count: number;
  partner_unread_count: number;
  created_at: string;
}

export interface PartnerChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: PartnerChatRole;
  message: string;
  read_at: string | null;
  created_at: string;
}

/** Get or create a conversation between subscriber and partner */
export async function getOrCreatePartnerConversation(
  subscriberId: string,
  partnerId: string,
): Promise<PartnerChatConversation | null> {
  const { data: existing } = await supabase
    .from("partner_chat_conversations" as any)
    .select("*")
    .eq("subscriber_id", subscriberId)
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (existing) return existing as unknown as PartnerChatConversation;

  const { data: created, error } = await supabase
    .from("partner_chat_conversations" as any)
    .insert({ subscriber_id: subscriberId, partner_id: partnerId } as any)
    .select()
    .single();

  if (error) {
    console.error("Failed to create partner conversation:", error);
    return null;
  }
  return created as unknown as PartnerChatConversation;
}

export async function fetchPartnerMessages(conversationId: string, limit = 100): Promise<PartnerChatMessage[]> {
  const { data, error } = await supabase
    .from("partner_chat_messages" as any)
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("Failed to fetch partner messages:", error);
    return [];
  }
  return (data || []) as unknown as PartnerChatMessage[];
}

export async function sendPartnerMessage(
  conversationId: string,
  senderId: string,
  senderRole: PartnerChatRole,
  message: string,
): Promise<PartnerChatMessage | null> {
  const { data, error } = await supabase
    .from("partner_chat_messages" as any)
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_role: senderRole,
      message,
    } as any)
    .select()
    .single();
  if (error) {
    console.error("Failed to send partner message:", error);
    return null;
  }
  return data as unknown as PartnerChatMessage;
}

export async function markPartnerConversationRead(
  conversationId: string,
  reader: PartnerChatRole,
): Promise<void> {
  const patch =
    reader === "subscriber"
      ? { subscriber_unread_count: 0 }
      : { partner_unread_count: 0 };
  await supabase
    .from("partner_chat_conversations" as any)
    .update(patch as any)
    .eq("id", conversationId);

  const otherRole: PartnerChatRole = reader === "subscriber" ? "partner" : "subscriber";
  await supabase
    .from("partner_chat_messages" as any)
    .update({ read_at: new Date().toISOString() } as any)
    .eq("conversation_id", conversationId)
    .eq("sender_role", otherRole)
    .is("read_at", null);
}

/** Partner-side: list conversations with subscriber names */
export interface PartnerInboxRow extends PartnerChatConversation {
  subscriber_name: string | null;
  subscriber_phone: string | null;
}

export async function fetchPartnerInbox(partnerId: string): Promise<PartnerInboxRow[]> {
  const { data, error } = await supabase
    .from("partner_chat_conversations" as any)
    .select("*")
    .eq("partner_id", partnerId)
    .order("last_message_at", { ascending: false });
  if (error || !data) return [];

  const convos = data as unknown as PartnerChatConversation[];
  const ids = Array.from(new Set(convos.map((c) => c.subscriber_id)));
  if (ids.length === 0) return convos.map((c) => ({ ...c, subscriber_name: null, subscriber_phone: null }));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, name, phone")
    .in("user_id", ids);

  const byId = new Map((profiles || []).map((p: any) => [p.user_id, p]));
  return convos.map((c) => {
    const p = byId.get(c.subscriber_id);
    return {
      ...c,
      subscriber_name: p?.name ?? null,
      subscriber_phone: p?.phone ?? null,
    };
  });
}
