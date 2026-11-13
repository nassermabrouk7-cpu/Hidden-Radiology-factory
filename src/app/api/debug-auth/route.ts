export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  return Response.json({
    hasSecret: !!secret,
    secretLength: secret ? secret.length : 0,
    secretFirst3: secret ? secret.substring(0,3) : null,
    hasNonAscii: secret ? /[^\x00-\x7F]/.test(secret) : false,
    hasAuthHeader: !!auth,
    authLength: auth ? auth.length : 0,
  });
}
export async function POST(request: Request) { return GET(request); }
