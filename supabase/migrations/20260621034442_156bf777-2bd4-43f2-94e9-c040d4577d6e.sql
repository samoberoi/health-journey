
-- Allow admins to delete any post/comment; allow coaches to delete posts/comments by their assigned patients.

CREATE POLICY "Admins can delete any post"
ON public.community_posts FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can delete assigned patients posts"
ON public.community_posts FOR DELETE
TO authenticated
USING (public.coach_owns_patient(user_id));

CREATE POLICY "Admins can delete any comment"
ON public.community_comments FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can delete assigned patients comments"
ON public.community_comments FOR DELETE
TO authenticated
USING (public.coach_owns_patient(user_id));
