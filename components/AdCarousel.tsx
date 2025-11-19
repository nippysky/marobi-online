import { getAdProducts } from "@/lib/products";
import AdCarouselClient from "./AdCarouselClient";


export default async function AdCarousel() {
  const ads = await getAdProducts(12); 
  if (!ads.length) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <span className="text-gray-400">No products to advertise.</span>
      </div>
    );
  }
  return <AdCarouselClient ads={ads} />;
}
