import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      {
        error:
          "Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REDIRECT_URI",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  if (error) {
    return NextResponse.json(
      {
        error: `Google OAuth error: ${error}`,
      },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      {
        error: "Missing authorization code",
      },
      { status: 400 }
    );
  }

  const expectedState = request.cookies.get("gmail_oauth_state")?.value;

  if (!expectedState || !state || state !== expectedState) {
    return NextResponse.json(
      {
        error: "Invalid OAuth state",
      },
      { status: 400 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    return NextResponse.json(
      {
        error:
          "Google did not return a refresh token. Revoke the previous FleetLog authorization and try again.",
      },
      { status: 400 }
    );
  }

  console.log("========================================");
  console.log("GMAIL REFRESH TOKEN");
  console.log(tokens.refresh_token);
  console.log("========================================");

  return new NextResponse(
    "Gmail authorization successful. The refresh token has been written to the server logs. You can close this page.",
    {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    }
  );
}