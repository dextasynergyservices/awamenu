import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { enforceRateLimit, getClientIpFromRequest } from "@/lib/ratelimit";
import { getRedis, notificationChannelKey } from "@/lib/redis";
import { getStaffSession } from "@/lib/staff-auth";

// Auth (staff-session cookie via node:crypto, better-auth session via
// Prisma) requires the Node.js runtime — it also gives this route longer-
// lived connections than the Edge runtime's 60s cap on Vercel Hobby.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE endpoint for real-time notifications.
 *
 * Uses Upstash Redis (HTTP) list polling instead of TCP-based pub/sub.
 * The client connects and receives notifications as they arrive.
 *
 * Polling interval: 2 seconds (a good balance between latency and cost).
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ restaurantId: string }> },
) {
	const { restaurantId } = await params;

	if (!restaurantId) {
		return new Response("Missing restaurantId", { status: 400 });
	}

	const [session, staffSession] = await Promise.all([
		getSession(),
		getStaffSession(),
	]);

	const isAuthorizedStaff = staffSession?.restaurantId === restaurantId;
	let isAuthorizedAdmin = false;

	if (!isAuthorizedStaff && session?.user) {
		const restaurant = await db.restaurant.findFirst({
			where: { id: restaurantId, ownerId: session.user.id },
			select: { id: true },
		});
		isAuthorizedAdmin = Boolean(restaurant);
	}

	if (!isAuthorizedStaff && !isAuthorizedAdmin) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		await enforceRateLimit(
			"sse",
			`${getClientIpFromRequest(request)}:${restaurantId}`,
		);
	} catch {
		return new Response("Too many requests", { status: 429 });
	}

	const redis = getRedis();
	if (!redis) {
		return new Response("Notification service unavailable", { status: 503 });
	}

	const key = notificationChannelKey(restaurantId);
	const encoder = new TextEncoder();
	let closed = false;
	// Track the last timestamp we sent so we only send new events
	let lastTimestamp = Date.now();

	const stream = new ReadableStream({
		async start(controller) {
			// Send initial connection event
			controller.enqueue(
				encoder.encode(
					`event: connected\ndata: ${JSON.stringify({ restaurantId })}\n\n`,
				),
			);

			const poll = async () => {
				while (!closed) {
					try {
						// Fetch recent events from the list
						const events = await redis.lrange(key, 0, 9);

						if (events && events.length > 0) {
							for (const event of events) {
								const parsed =
									typeof event === "string" ? JSON.parse(event) : event;
								const eventTs = parsed._ts ?? 0;

								// Only send events newer than our last timestamp
								if (eventTs > lastTimestamp) {
									controller.enqueue(
										encoder.encode(
											`event: notification\ndata: ${JSON.stringify(parsed)}\n\n`,
										),
									);
									lastTimestamp = eventTs;
								}
							}
						}

						// Send a heartbeat every poll to keep the connection alive
						controller.enqueue(encoder.encode(": heartbeat\n\n"));
					} catch (error) {
						if (closed) break;
						Sentry.captureException(error, {
							tags: { component: "sse-stream" },
							extra: { restaurantId },
						});
					}

					// Wait 2 seconds between polls
					await new Promise((resolve) => setTimeout(resolve, 2000));
				}
			};

			poll().catch(() => {
				if (!closed) {
					closed = true;
					try {
						controller.close();
					} catch {
						// Already closed
					}
				}
			});
		},
		cancel() {
			closed = true;
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}
