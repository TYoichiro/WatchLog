import { auth } from "@/auth";
import { getDashboardNotices } from "@/lib/dashboard-notices";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return Response.json({
      notices: await getDashboardNotices(),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
