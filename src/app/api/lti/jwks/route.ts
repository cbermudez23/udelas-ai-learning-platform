import { NextResponse } from "next/server";
import { getToolPublicJwks } from "@/lib/lti";

export async function GET() {
  try {
    const jwks = await getToolPublicJwks();
    return NextResponse.json(jwks);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ keys: [] }, { status: 200 });
  }
}
