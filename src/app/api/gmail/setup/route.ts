import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { google } from "googleapis";

function getGmailClient() {
  const auth = new google.auth.JWT({
    email: process.env.GMAIL_CLIENT_EMAIL!,
    key: (process.env.GMAIL_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    subject: process.env.GMAIL_USER!,
  });
  return google.gmail({ version: "v1", auth });
}

// Admin-only endpoint: call once to register Gmail watch with Pub/Sub
export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload || payload.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
    }

    const gmail = getGmailClient();
    const topicName = process.env.GOOGLE_PUBSUB_TOPIC;
    if (!topicName) {
      return NextResponse.json({ ok: false, error: "GOOGLE_PUBSUB_TOPIC env variable not set." }, { status: 500 });
    }

    // Register watch — expires every 7 days, must be renewed
    const watchRes = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName,
        labelIds: ["INBOX"],
        labelFilterAction: "include",
      },
    });

    const expiration = watchRes.data.expiration;
    const historyId = watchRes.data.historyId;

    // Save initial historyId to avoid replaying old messages
    const supabase = getSupabaseAdmin();
    await supabase.from("gmail_sync_state").upsert({
      email: process.env.GMAIL_USER!,
      last_history_id: historyId,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: "email" });

    return NextResponse.json({
      ok: true,
      message: "Gmail watch registered successfully.",
      historyId,
      expiration: expiration ? new Date(Number(expiration)).toISOString() : null,
      note: "This watch expires in 7 days. Re-call this endpoint before expiry to renew.",
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Setup error" }, { status: 500 });
  }
}

// Check current watch status
export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload || payload.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("gmail_sync_state")
      .select("*")
      .eq("email", process.env.GMAIL_USER!)
      .single();

    const { data: logs } = await supabase
      .from("email_import_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({ ok: true, syncState: data, recentLogs: logs || [] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
