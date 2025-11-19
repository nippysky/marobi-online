// app/api/reviews/[reviewId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

/** Ensure consistent Node runtime */
export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ reviewId: string }> }
) {
  try {
    await prismaReady;

    const { reviewId } = await context.params;

    // 1) Load the review + current product stats
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        rating: true,
        productId: true,
        product: {
          select: {
            id: true,
            averageRating: true,
            ratingCount: true,
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const {
      rating,
      productId,
      product: { averageRating, ratingCount },
    } = review;

    // 2) Compute new stats before the transaction
    let newAverage = 0;
    let newCount = 0;

    if (ratingCount > 1) {
      newCount = ratingCount - 1;
      newAverage = (averageRating * ratingCount - rating) / newCount;
    } else {
      newCount = 0;
      newAverage = 0;
    }

    // 3) Transaction: delete review + update product
    await prisma.$transaction([
      prisma.review.delete({ where: { id: reviewId } }),
      prisma.product.update({
        where: { id: productId },
        data: {
          averageRating: newAverage,
          ratingCount: newCount,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      reviewId,
      productId,
      newProductStats: {
        averageRating: newAverage,
        ratingCount: newCount,
      },
    });
  } catch (err) {
    console.error("[DELETE /api/reviews/[reviewId]] error:", err);
    return NextResponse.json(
      { error: "Could not delete review" },
      { status: 500 }
    );
  }
}
