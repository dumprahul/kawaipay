import LandingNavbar from "./landing/LandingNavbar";
import LandingHero from "./landing/LandingHero";
import TrustStrip from "./landing/TrustStrip";
import ProblemSection from "./landing/ProblemSection";
import HowItWorks from "./landing/HowItWorks";
import CreatorSection from "./landing/CreatorSection";
import FinalCTA from "./landing/FinalCTA";
import LandingFooter from "./landing/LandingFooter";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F7F3ED]">
      <LandingNavbar />
      <LandingHero />
      <TrustStrip />
      <ProblemSection />
      <HowItWorks />
      <CreatorSection />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}
