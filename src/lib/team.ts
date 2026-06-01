import type { RequestEventCommon } from "@builder.io/qwik-city";
import { getAdminSupabaseClient } from "./supabase";
import { getCurrentUser } from "./auth";
import { captureError } from "./sentry";

export interface TeamInfo {
  id: string;
  name: string;
}

export interface TeamMemberInfo {
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export async function getUserTeam(event: RequestEventCommon): Promise<TeamInfo | null> {
  const user = getCurrentUser(event.cookie);
  if (!user) return null;
  const supabase = getAdminSupabaseClient(event.env);
  const { data } = await supabase
    .from("team_members")
    .select("team:teams(*)")
    .eq("user_id", user.user_id)
    .single();
  if (!data) return null;
  const t = data.team as any;
  return { id: t.id, name: t.name };
}

export async function getTeamMembers(event: RequestEventCommon): Promise<TeamMemberInfo[]> {
  const team = await getUserTeam(event);
  if (!team) return [];
  const supabase = getAdminSupabaseClient(event.env);
  const { data } = await supabase
    .from("team_members")
    .select("user_id, role, created_at, profile:auth.users(email, raw_user_meta_data)")
    .eq("team_id", team.id);
  if (!data) return [];
  return data.map((d: any) => ({
    user_id: d.user_id,
    name: d.profile?.raw_user_meta_data?.display_name || d.profile?.email?.split("@")[0] || "Unknown",
    email: d.profile?.email || "",
    role: d.role,
    created_at: d.created_at,
  }));
}

export async function inviteMember(
  event: RequestEventCommon,
  email: string,
  role: string
): Promise<boolean> {
  const user = getCurrentUser(event.cookie);
  if (!user) return false;
  const supabase = getAdminSupabaseClient(event.env);
  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", user.user_id)
    .single();
  if (!membership || membership.role === "member") return false;
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  try {
    const { error } = await supabase.from("invitations").insert({
      team_id: membership.team_id,
      email,
      role,
      token,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    return !error;
  } catch (e) {
    captureError(e, { action: "inviteMember", email });
    return false;
  }
}
