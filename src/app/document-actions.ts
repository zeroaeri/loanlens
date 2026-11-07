"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { detectFile, MAX_UPLOAD_BYTES, safeFilename } from "@/lib/uploads";
import type { ActionResult } from "@/lib/validation";

export async function uploadDocument(form: FormData): Promise<ActionResult> {
  const loanId = form.get("loan_id"),
    paymentId = form.get("payment_id") || null,
    file = form.get("file");
  if (
    !z.uuid().safeParse(loanId).success ||
    (paymentId && !z.uuid().safeParse(paymentId).success)
  )
    return { ok: false, message: "Invalid record." };
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_UPLOAD_BYTES)
    return {
      ok: false,
      message: "Choose a PDF, PNG, or JPEG of at most 4 MB.",
    };
  const bytes = new Uint8Array(await file.arrayBuffer()),
    mime = detectFile(bytes);
  if (!mime || mime !== file.type)
    return {
      ok: false,
      message: "File content must match its PDF, PNG, or JPEG type.",
    };
  const { supabase, userId } = await requireUser();
  const { data: l } = await supabase
    .from("loans")
    .select("id")
    .eq("id", loanId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!l) return { ok: false, message: "Record unavailable." };
  if (paymentId) {
    const { data: p } = await supabase
      .from("payments")
      .select("id")
      .eq("id", paymentId)
      .eq("loan_id", loanId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!p) return { ok: false, message: "Payment unavailable." };
  }
  const extension =
    mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
  const path = `${userId}/${loanId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("loan-documents")
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (uploadError)
    return {
      ok: false,
      message:
        "Upload failed. Check the private bucket and ownership policies.",
    };
  const { error } = await supabase.rpc("register_document", {
    payload: {
      loan_id: loanId,
      payment_id: paymentId,
      filename: safeFilename(file.name),
      object_path: path,
      mime_type: mime,
      size_bytes: file.size,
    },
  });
  if (error) {
    await supabase.storage.from("loan-documents").remove([path]);
    return {
      ok: false,
      message:
        "Could not attach the file; the orphan upload was submitted for cleanup.",
    };
  }
  revalidatePath(`/loans/${loanId}`);
  return {
    ok: true,
    message: "Private document attached. This is user-provided evidence.",
  };
}
