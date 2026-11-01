import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import BackToTop from '@/components/ui/BackToTop';
import MarketSimulatorBar from '@/components/layout/MarketSimulatorBar';
import WhatsAppFloatingChat from '@/components/ui/WhatsAppChat';
import TawkToChat from '@/components/ui/TawkToChat';
import QueryProvider from '@/components/providers/QueryProvider';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <Navbar />
      <main>{children}</main>
      <Footer />
      <BackToTop />
      <MarketSimulatorBar />
      <WhatsAppFloatingChat source="floating_widget" className="bottom-6 left-6 right-auto" />
      <TawkToChat />
    </QueryProvider>
  );
}
