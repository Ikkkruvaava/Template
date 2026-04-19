import React, { Suspense } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import HeroSection from "@/components/home/HeroSection";
import FeaturesGrid from "@/components/home/FeaturesGrid";
import HowItWorks from "@/components/home/HowItWorks";
import UserPhotoFramingClient from "@/components/home/UserPhotoFramingClient";

import { getFrameById } from "@/lib/localDb";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const frameId = typeof params.frame === 'string' ? params.frame : undefined;

  if (frameId) {
    try {
      const frame = await getFrameById(frameId);
      if (frame) {
        return {
          title: `${frame.name} | ECLYZE Frames`,
          description: `Create your custom framed photo with the ${frame.name} collection. High-quality rendering and easy sharing.`,
          openGraph: {
            title: `${frame.name} - ECLYZE Frames`,
            description: `Click to create your custom framed photo using the ${frame.name} template!`,
            images: [
              {
                url: frame.imageUrl,
                width: frame.dimensions.width || 1200,
                height: frame.dimensions.height || 630,
                alt: frame.name,
              },
            ],
            type: "website",
          },
          twitter: {
            card: "summary_large_image",
            title: `${frame.name} - ECLYZE Frames`,
            description: `Click to create your custom framed photo using the ${frame.name} template!`,
            images: [frame.imageUrl],
          },
        };
      }
    } catch (error) {
      console.error("Error fetching metadata for frame:", error);
    }
  }

  return {
    title: "ECLYZE Frames | Premium Photo Framing System",
    description: "A perfect framing system working like an organiser. Create custom community frames with smooth rendering and easy sharing.",
    openGraph: {
      title: "ECLYZE Frames | Premium Photo Framing System",
      description: "A perfect framing system working like an organiser. Create custom community frames with smooth rendering and easy sharing.",
      images: [
        {
          url: "/api/og", // Fallback to a default OG image if you have one, or just a common asset
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}


const UserPhotoFraming = () => {
  return (
    <div className="min-h-screen bg-[#FDFCF9] font-outfit">
      <main className="flex-grow">
        <div className="max-w-6xl mx-auto p-4 md:p-6 pb-16 pt-8">
          <HeroSection />

          <FeaturesGrid />

          <Suspense fallback={
            <div className="min-h-[400px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-green"></div>
            </div>
          }>
            <UserPhotoFramingClient />
          </Suspense>

          <HowItWorks />
        </div>
      </main>

      {/* WhatsApp Floating Button / Pricing Link */}
      <Link
        href="/pricing"
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-emerald-600 text-white p-4 rounded-full shadow-2xl hover:shadow-[0_8px_30px_rgb(16,185,129,0.4)] hover:-translate-y-1 transition-all duration-300 z-50 flex items-center justify-center group border-2 border-white ring-4 ring-emerald-50 animate-bounce-subtle"
        aria-label="Check Pricing"
      >
        <Zap className="h-6 w-6 md:h-7 md:w-7 fill-white group-hover:scale-110 transition-transform duration-300" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:ml-3 transition-all duration-500 ease-in-out font-bold text-sm md:text-base">
          Check Pricing
        </span>
      </Link>
    </div>
  );
};

export default UserPhotoFraming;