import { LandingPage } from "@/components/landing/landing-page";
import { getBrand } from "@/config/brand";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: HomePageProps) {
  await params;
  const brand = getBrand();
  return <LandingPage brandName={brand.name} />;
}
