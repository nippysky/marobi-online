import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

type SimpleRow = {
  id?: string;
  order?: number;
  bodySize: string;
  productSize: string;
  code: string;
};

export async function GET() {
  await prismaReady;
  try {
    // Ensure singleton
    let chart = await prisma.sizeChart.findFirst({
      include: { rows: { orderBy: { order: "asc" } } },
    });

    if (!chart) {
      chart = await prisma.sizeChart.create({
        data: { name: "" },
        include: { rows: true },
      });
    }

    return NextResponse.json({
      id: chart.id,
      name: chart.name,
      rows: chart.rows
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((r) => ({
          id: r.id,
          order: r.order,
          bodySize: r.bodySize,
          productSize: r.productSize,
          code: r.code,
        })),
    });
  } catch (err) {
    console.error("SIZE CHART GET ERROR", err);
    return NextResponse.json({ message: "Failed to load size chart" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  await prismaReady;
  try {
    const { id, rows }: { id: string; rows: SimpleRow[] } = await req.json();
    if (typeof id !== "string" || !Array.isArray(rows)) {
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }

    // Ensure the chart exists
    const chart = await prisma.sizeChart.upsert({
      where: { id },
      create: { id, name: "" },
      update: {},
    });

    // Clean + validate rows
    const cleaned = rows
      .map((r, idx) => ({
        ...r,
        order: Number.isFinite(r.order as any) ? Number(r.order) : idx,
        bodySize: String(r.bodySize || "").trim(),
        productSize: String(r.productSize || "").trim(),
        code: String(r.code || "").trim(),
      }))
      .filter((r) => r.bodySize && r.productSize && r.code);

    const keepIds = cleaned.map((r) => r.id).filter(Boolean) as string[];

    await prisma.$transaction([
      prisma.sizeChartRow.deleteMany({
        where: { chartId: chart.id, ...(keepIds.length ? { id: { notIn: keepIds } } : {}) },
      }),
      ...cleaned.map((r) =>
        prisma.sizeChartRow.upsert({
          where: { id: r.id ?? "" },
          create: {
            chartId: chart.id,
            order: r.order!,
            bodySize: r.bodySize,
            productSize: r.productSize,
            code: r.code,
          },
          update: {
            order: r.order!,
            bodySize: r.bodySize,
            productSize: r.productSize,
            code: r.code,
          },
        })
      ),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("SIZE CHART PUT ERROR", err);
    return NextResponse.json({ message: "Failed to save size chart" }, { status: 500 });
  }
}
