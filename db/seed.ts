import { db, Events } from "astro:db";

export default async function seed() {
  const now = new Date();
  await db.insert(Events).values({
    id: crypto.randomUUID(),
    userId: "demo-user",
    title: "Welcome event",
    eventType: "personal",
    location: "",
    startsAt: now,
    endsAt: null,
    notes: "Seeded sample event",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });
}
