// app/admin/categories/new/page.tsx
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/getAdminSession";
import BackButton from "@/components/BackButton";
import CategoryForm from "../CategoryForm";

export default async function NewCategoryPage() {
  const session = await getAdminSession();
  if (!session || !session.user?.email || session.user.role === "customer") {
    const cb = encodeURIComponent("/admin/categories/new");
    return redirect(`/admin-login?callbackUrl=${cb}`);
  }

  return (
    <div className="px-6 md:px-10 lg:px-16 py-8 max-w-[900px] mx-auto">
      <div className="flex items-center justify-between">
        <BackButton />
      </div>

      <h1 className="mt-6 text-3xl md:text-4xl font-extrabold tracking-tight">
        Create Category
      </h1>
      <p className="text-muted-foreground mt-2">
        Add a new category to organize your products.
      </p>

<div className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
  <CategoryForm mode="create" submitLabel="Create Category" />
</div>
    </div>
  );
}
