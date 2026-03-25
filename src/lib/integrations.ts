import { db, desc, eq, Events } from "astro:db";

type DashboardSummaryPayload = {
  appId: "event-planner";
  userId: string;
  summary: {
    totalEvents: number;
    upcomingPlanned: number;
    completed: number;
    mostRecentEventTitle: string | null;
  };
};

async function postJson(url: string, body: unknown, token?: string) {
  await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export async function syncDashboardSummary(userId: string) {
  const webhookUrl = import.meta.env.ANSIVERSA_DASHBOARD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const items = await db
    .select()
    .from(Events)
    .where(eq(Events.userId, userId));

  const latest = (
    await db
      .select({ title: Events.title })
      .from(Events)
      .where(eq(Events.userId, userId))
      .orderBy(desc(Events.updatedAt))
      .limit(1)
  )[0];

  const payload: DashboardSummaryPayload = {
    appId: "event-planner",
    userId,
    summary: {
      totalEvents: items.filter((item) => item.status !== "archived").length,
      upcomingPlanned: items.filter((item) => item.status === "planned" || item.status === "draft").length,
      completed: items.filter((item) => item.status === "completed").length,
      mostRecentEventTitle: latest?.title ?? null,
    },
  };

  await postJson(webhookUrl, payload, import.meta.env.ANSIVERSA_DASHBOARD_WEBHOOK_TOKEN);
}

export async function sendHighSignalNotification(input: {
  userId: string;
  title: string;
  body: string;
  level?: "info" | "success";
}) {
  const webhookUrl = import.meta.env.ANSIVERSA_NOTIFICATIONS_WEBHOOK_URL;
  if (!webhookUrl) return;

  await postJson(
    webhookUrl,
    {
      appId: "event-planner",
      userId: input.userId,
      title: input.title,
      body: input.body,
      level: input.level ?? "info",
    },
    import.meta.env.ANSIVERSA_NOTIFICATIONS_WEBHOOK_TOKEN,
  );
}
