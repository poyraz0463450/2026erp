import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";

const moduleCards = [
  {
    title: "Satin Alma",
    description:
      "Tedarikci, satin alma talebi, siparis ve mal kabul akisi. Mal kabul ile stok otomatik guncellenir.",
    to: "/purchasing",
  },
  {
    title: "Kalite",
    description:
      "Kalite plani, giris kalite kontrol, proses ici kontrol, final kontrol ve uygunsuzluk yonetimi.",
    to: "/quality",
  },
  {
    title: "Depo",
    description:
      "Depo, lokasyon, lot bazli stok hareketleri, transfer ve sayim duzeltmeleri.",
    to: "/warehouse",
  },
  {
    title: "Satis",
    description:
      "Musteri yonetimi, satis siparisi, sevkiyat ve stok dusum akislari.",
    to: "/sales",
  },
  {
    title: "Uretim",
    description:
      "Is emri, BOM snapshot, malzeme tuketimi, operator takibi ve bitmis urun girisi.",
    to: "/production",
  },
];

export function DashboardPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="ERP Kontrol Merkezi"
        description="Malzeme yonetimi ustune kurulan satin alma, kalite, depo, satis ve uretim modullerinin ilk omurgasi."
      />
      <section className="dashboard-grid">
        {moduleCards.map((card) => (
          <SectionCard key={card.title} title={card.title} description={card.description}>
            <Link className="button button--primary" to={card.to}>
              Modulu Ac
            </Link>
          </SectionCard>
        ))}
      </section>
    </div>
  );
}
