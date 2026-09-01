import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyAdminRequest } from "@/lib/supabase/verifyAdmin";
import { certificateTypeSchema } from "@/lib/validations/certification-request";

export async function GET(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = getAdminClient();
  const { data, error } = await client.from("certificate_types").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = certificateTypeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const client = getAdminClient();
  const { data, error } = await client
    .from("certificate_types")
    .insert({
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      curriculum_id: parsed.data.curriculumId ?? null,
      is_active: parsed.data.isActive ?? true,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json(data, { status: 201 });
}
