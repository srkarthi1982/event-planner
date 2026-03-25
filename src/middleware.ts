import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./lib/auth";

const COOKIE_DOMAIN = import.meta.env.ANSIVERSA_COOKIE_DOMAIN ?? "ansiversa.com";
const ROOT_APP_URL = import.meta.env.PUBLIC_ROOT_APP_URL ?? `https://${COOKIE_DOMAIN}`;

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, locals, url } = context;
  const pathname = url.pathname;

  locals.user = undefined;
  locals.sessionToken = null;
  locals.isAuthenticated = false;
  locals.rootAppUrl = ROOT_APP_URL;

  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const payload = verifySessionToken(token);
    if (payload?.userId) {
      locals.user = {
        id: payload.userId,
        email: payload.email,
        name: payload.name,
        roleId: payload.roleId ?? undefined,
        stripeCustomerId: payload.stripeCustomerId ?? undefined,
      };
      locals.sessionToken = token;
      locals.isAuthenticated = true;
    }
  }

  const needsAuth = pathname.startsWith("/app");

  if (needsAuth && !locals.isAuthenticated) {
    const loginUrl = new URL("/login", ROOT_APP_URL);
    loginUrl.searchParams.set("returnTo", url.toString());
    return context.redirect(loginUrl.toString());
  }

  return next();
});
