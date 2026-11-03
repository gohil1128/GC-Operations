import { NextResponse } from "next/server";
import { scopeFor } from "@/lib/scope";
import { searchIngredients } from "@/modules/invoices/queries";

export async function GET(req: Request) {
  const scope = await scopeFor("purchasing");
  if (!scope) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const ingredients = await searchIngredients(scope.businessId, q, 30);
  return NextResponse.json({ ingredients });
}
