import React from "react";
import { Truck, Scissors, Headphones, Leaf } from "lucide-react";

// Minimal 4-card feature grid aligned with "African Prints" container paddings
type Feature = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    icon: Truck,
    title: "Worldwide Shipping",
    description:
      "Fast, reliable delivery to every corner of the globe—your Marobi pieces arrive right when you need them.",
  },
  {
    icon: Scissors,
    title: "Tailored Elegance",
    description:
      "Expertly crafted silhouettes refined to your measurements for a confident, precise fit.",
  },
  {
    icon: Headphones,
    title: "24/7 Style Support",
    description:
      "Need a second opinion? Our fashion concierges are here day and night to help curate your next standout look.",
  },
  {
    icon: Leaf,
    title: "Sustainable Craft",
    description:
      "Thoughtful materials and responsible making—quality that feels good and does good.",
  },
];

const FeatureHighlights: React.FC = () => {
  return (
    <section className="py-16 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* SAME horizontal paddings as your "African Prints" section */}
      <div className="mx-auto px-5 md:px-10 lg:px-40">
        {/* Left-aligned to line up with other section heading */}
       <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
          Why Marobi?
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {features.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="
                group relative flex flex-col justify-between
                rounded-xl border border-gray-200 bg-white/80 p-6
                shadow-[0_0_0_0_rgba(0,0,0,0)]
                transition
                hover:-translate-y-0.5 hover:shadow-sm
                focus-within:-translate-y-0.5 focus-within:shadow-sm
                dark:border-gray-800 dark:bg-gray-900/60
              "
              tabIndex={0}
            >
              <div
                className="
                  inline-flex items-center justify-center
                  rounded-lg p-2.5
                  ring-1 ring-emerald-200/70 bg-emerald-50 text-emerald-700
                  transition group-hover:ring-emerald-300
                  dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800
                "
                aria-hidden="true"
              >
                <Icon className="h-6 w-6" />
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  {description}
                </p>
              </div>

              <div
                className="
                  pointer-events-none mt-6 h-px w-full
                  bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent
                  opacity-0 transition-opacity duration-300
                  group-hover:opacity-100 dark:via-emerald-700/50
                "
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureHighlights;
