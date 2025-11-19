import { prisma } from "@/lib/db";
import SizeChartManager from "./SizeChartManager";

export default async function SizeChartPage() {
  let chart = await prisma.sizeChart.findFirst({
    include: { rows: { orderBy: { order: "asc" } } },
  });

  if (!chart) {
    chart = await prisma.sizeChart.create({
      data: { name: "" },
      include: { rows: true },
    });
  }

  const initialChart = {
    id: chart.id,
    name: chart.name,
    rows: chart.rows.map((r) => ({
      id: r.id,
      order: r.order,
      bodySize: r.bodySize,
      productSize: r.productSize,
      code: r.code,
    })),
  };

  return (
    <div className="bg-gray-50 min-h-screen p-6 sm:p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Size Chart</h1>
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow p-6">
        <SizeChartManager initialChart={initialChart} />
      </div>
    </div>
  );
}
