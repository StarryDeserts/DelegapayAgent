import { LandingHero } from './LandingHero'
import { SafetyStackSection } from './SafetyStackSection'
import { ProtocolRailSection } from './ProtocolRailSection'
import { ProofSection } from './ProofSection'

export function DelegaPayLanding() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#020303] text-zinc-100">
      <LandingHero />
      <SafetyStackSection />
      <ProtocolRailSection />
      <ProofSection />
    </main>
  )
}
