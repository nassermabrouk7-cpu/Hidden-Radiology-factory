import { getMetaTokenHealth } from "@/lib/meta-token-health";

export async function GET() {
  const health = await getMetaTokenHealth("facebook");
  return Response.json({ health });
}