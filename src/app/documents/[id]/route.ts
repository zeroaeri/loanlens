import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/data";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new NextResponse("Unavailable", { status: 404 });
  const { supabase, userId } = await requireUser();
  const { data: d, error } = await supabase
    .from("documents")
    .select("object_path,filename")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !d) return new NextResponse("Unavailable", { status: 404 });
  const { data, error: signError } = await supabase.storage
    .from("loan-documents")
    .createSignedUrl(d.object_path, 60, { download: d.filename });
  if (signError || !data)
    return new NextResponse("Unable to download file", { status: 503 });
  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
