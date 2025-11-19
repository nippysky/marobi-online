
import { NextResponse } from "next/server";

export async function POST() {
  // Simply clear our “loggedIn” cookie:
  const response = NextResponse.json({ message: "Logged out" });
  response.cookies.set("loggedIn", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0, // immediately expire
  });
  return response;
}
