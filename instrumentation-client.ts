import * as Sentry from "@sentry/nextjs";
import { env } from "@/env";

Sentry.init({
	dsn: env.NEXT_PUBLIC_SENTRY_DSN,
	tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
	beforeSend(event) {
		if (event.user) {
			delete event.user.email;
			delete event.user.ip_address;
		}
		return event;
	},
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
