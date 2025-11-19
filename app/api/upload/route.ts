import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const upload = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: "panthart" }, (err, result) =>
        err ? reject(err) : resolve(result)
      )
      .end(buffer);
  });
  return NextResponse.json({ success: true, data: upload });
}
