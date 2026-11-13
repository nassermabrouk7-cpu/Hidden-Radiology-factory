export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const xCron = request.headers.get("x-cron-secret");
  
  return Response.json({
    hasSecret: !!secret,
    secretLength: secret ? secret.length : 0,
    secretFirst3: secret ? secret.substring(0,3) : null,
    secretLast3: secret ? secret.substring(secret.length-3) : null,
    hasNonAscii: secret ? /[^\x00-\x7F]/.test(secret) : false,
    hasAuthHeader: !!auth,
    authLength: auth ? auth.length : 0,
    authStartsWithBearer: auth ? auth.startsWith("Bearer ") : false,
    hasXCron: !!xCron,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
