import Community from "@/pages/tabs/Community";

/**
 * Admin Community view = same feed users see, just embedded in the admin shell.
 * Admins get full like / comment / reply functionality, plus delete-any-post
 * via the RLS admin delete policy (the PostCard already checks isAdmin).
 */
export default function AdminCommunity() {
  return (
    <div className="min-h-full bg-background">
      <Community />
    </div>
  );
}
