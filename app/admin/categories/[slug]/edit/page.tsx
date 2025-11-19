import { redirect } from "next/navigation";
import { prisma, prismaReady } from "@/lib/db";
import { getAdminSession } from "@/lib/getAdminSession";
import BackButton from "@/components/BackButton";
import CategoryForm from "../../CategoryForm";



export default async function EditCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  await prismaReady;

    const { slug } = await params;

  const session = await getAdminSession();
  if (!session || !session.user?.email || session.user.role === "customer") {
    const cb = encodeURIComponent(`/admin/categories/${slug}/edit`);
    return redirect(`/admin-login?callbackUrl=${cb}`);
  }

  const cat = await prisma.category.findUnique({
    where: { slug: slug },
    select: {
      slug: true,
      name: true,
      description: true,
      bannerImage: true,
      sortOrder: true,
      isActive: true,
    },
  });

  if (!cat) {
    return redirect("/admin/categories");
  }

  return (
    <div className="px-6 md:px-10 lg:px-16 py-8 max-w-[900px] mx-auto">
      <div className="flex items-center justify-between">
        <BackButton />
      </div>

      <h1 className="mt-6 text-3xl md:text-4xl font-extrabold tracking-tight">
        Edit Category
      </h1>
      <p className="text-muted-foreground mt-2">
        Update details for <span className="font-semibold">{cat.name}</span>.
      </p>

      <div className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
        <CategoryForm
          mode="edit"
          initial={cat}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  );
}
