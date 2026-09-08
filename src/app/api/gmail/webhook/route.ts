import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { parseNoticePdfBuffer } from "@/lib/pdf-parser";
import { formatDateIso } from "@/lib/calculations";
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

async function logEmailImport(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  opts: {
    emailId: string;
    subject: string;
    filename: string;
    noticeType: string;
    importedRows: number;
    status: "SUCCESS" | "FAILED" | "DUPLICATE" | "SKIPPED";
    error?: string;
  }
) {
  await supabase.from("email_import_logs").insert({
    email_id: opts.emailId,
    subject: opts.subject,
    filename: opts.filename,
    notice_type: opts.noticeType,
    imported_rows: opts.importedRows,
    status: opts.status,
    error_message: opts.error || null,
  });
}

function flattenParts(parts: any[]): any[] {
  const result: any[] = [];
  for (const p of parts) {
    result.push(p);
    if (p.parts?.length) result.push(...flattenParts(p.parts));
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const expectedToken = process.env.PUBSUB_VERIFICATION_TOKEN;
    if (expectedToken && !authHeader.includes(expectedToken)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const messageData = body?.message?.data;
    if (!messageData) return NextResponse.json({ ok: true, skipped: "No message data" });

    const decoded = JSON.parse(Buffer.from(messageData, "base64").toString("utf-8"));
    const emailAddress = decoded.emailAddress as string;
    const historyId = decoded.historyId as string;
    if (!emailAddress || !historyId) return NextResponse.json({ ok: true, skipped: "Missing fields" });

    const gmail = getGmailClient();
    const supabase = getSupabaseAdmin();

    const { data: stateRow } = await supabase
      .from("gmail_sync_state")
      .select("last_history_id")
      .eq("email", emailAddress)
      .single();

    const startHistoryId = stateRow?.last_history_id || historyId;

    const historyRes = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      labelId: "INBOX",
    });

    const histories = historyRes.data.history || [];
    const processedIds: string[] = [];

    for (const h of histories) {
      for (const msg of h.messagesAdded || []) {
        const msgId = msg.message?.id;
        if (!msgId || processedIds.includes(msgId)) continue;
        processedIds.push(msgId);

        const fullMsg = await gmail.users.messages.get({ userId: "me", id: msgId, format: "full" });
        const headers = fullMsg.data.payload?.headers || [];
        const from = headers.find((h: any) => h.name?.toLowerCase() === "from")?.value || "";
        const subject = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "";

        const allowedSender = process.env.PHILHEALTH_SENDER_EMAIL || "erth.region7@gmail.com";
        if (!from.toLowerCase().includes(allowedSender.toLowerCase())) continue;

        const upperSubject = subject.toUpperCase();
        let noticeType: "RTH" | "DENIED" = upperSubject.includes("DENIED") ? "DENIED" : "RTH";

        const parts = flattenParts(fullMsg.data.payload?.parts || []);
        const pdfParts = parts.filter(
          (p: any) => p.mimeType === "application/pdf" || p.filename?.toLowerCase().endsWith(".pdf")
        );

        if (!pdfParts.length) {
          await logEmailImport(supabase, { emailId: msgId, subject, filename: "N/A", noticeType, importedRows: 0, status: "SKIPPED", error: "No PDF attachment" });
          continue;
        }

        for (const pdfPart of pdfParts) {
          const filename = pdfPart.filename || "notice.pdf";
          const attachmentId = pdfPart.body?.attachmentId;
          if (!attachmentId) continue;

          try {
            const attRes = await gmail.users.messages.attachments.get({ userId: "me", messageId: msgId, id: attachmentId });
            const attData = attRes.data.data;
            if (!attData) continue;

            const pdfBuffer = Buffer.from(attData.replace(/-/g, "+").replace(/_/g, "/"), "base64");

            // Detect type from PDF text
            const rawText = pdfBuffer.toString("latin1").toUpperCase();
            if (rawText.includes("DENIED NOTICE")) noticeType = "DENIED";
            else if (rawText.includes("RTH NOTICE")) noticeType = "RTH";

            const parsed = await parseNoticePdfBuffer(pdfBuffer, noticeType);
            if (!parsed.rows.length) {
              await logEmailImport(supabase, { emailId: msgId, subject, filename, noticeType, importedRows: 0, status: "FAILED", error: "No rows parsed from PDF" });
              continue;
            }

            const table = noticeType === "RTH" ? "rth_notices" : "denied_notices";
            const { data: existing } = await supabase.from(table).select("series_number,expiry_date").in("series_number", parsed.rows.map((r: any) => r.seriesNumber));
            const existingSet = new Set((existing || []).map((e: any) => `${e.series_number}|${e.expiry_date}`));
            const newRows = parsed.rows.filter((r: any) => !existingSet.has(`${r.seriesNumber}|${formatDateIso(r.deadline)}`));

            if (!newRows.length) {
              await logEmailImport(supabase, { emailId: msgId, subject, filename, noticeType, importedRows: 0, status: "DUPLICATE", error: `All ${parsed.rows.length} rows already exist` });
              continue;
            }

            const insertPayload = newRows.map((r: any) => {
              const base = {
                notice_row_no: r.noticeRowNo,
                series_number: r.seriesNumber,
                member_category: r.memberCategory,
                patient_name: r.patientName,
                admitted_date: formatDateIso(r.admitted) || null,
                discharged_date: formatDateIso(r.discharged) || null,
                claim_amount: r.claimAmount,
                total_charges: r.totalCharges,
                deficiency: r.deficiency,
                claim_received_date: formatDateIso(r.claimReceived) || null,
                notice_date: formatDateIso(r.noticeDate) || null,
                expiry_date: formatDateIso(r.deadline) || null,
                control_number: r.controlNumber,
                remarks: "",
              };
              return noticeType === "RTH" ? { ...base, retrieved: false, refiled: false } : { ...base, retrieved: false };
            });

            const { error: insertErr } = await supabase.from(table).upsert(insertPayload, { onConflict: "series_number,expiry_date" });
            if (insertErr) {
              await logEmailImport(supabase, { emailId: msgId, subject, filename, noticeType, importedRows: 0, status: "FAILED", error: insertErr.message });
              continue;
            }

            await supabase.from("audit_logs").insert({
              username: "email-automation",
              action: "AUTO_IMPORT_EMAIL",
              module: noticeType,
              source_ref: subject,
              details: { emailId: msgId, filename, from, importedCount: newRows.length },
            });

            await logEmailImport(supabase, { emailId: msgId, subject, filename, noticeType, importedRows: newRows.length, status: "SUCCESS" });

          } catch (pdfErr: any) {
            await logEmailImport(supabase, { emailId: msgId, subject, filename, noticeType, importedRows: 0, status: "FAILED", error: pdfErr?.message });
          }
        }
      }
    }

    await supabase.from("gmail_sync_state").upsert({ email: emailAddress, last_history_id: historyId, last_synced_at: new Date().toISOString() }, { onConflict: "email" });

    return NextResponse.json({ ok: true, processed: processedIds.length });
  } catch (err: any) {
    console.error("[Gmail Webhook Error]", err);
    return NextResponse.json({ ok: false, error: err?.message }, { status: 200 });
  }
}
