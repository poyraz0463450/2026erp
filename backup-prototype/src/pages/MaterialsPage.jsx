import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { COLLECTIONS } from "../constants/collections";
import { useCollection } from "../hooks/useCollection";

const materialSections = [
  { key: COLLECTIONS.PARTS, title: "Parts" },
  { key: COLLECTIONS.PART_REVISIONS, title: "Part Revisions" },
  { key: COLLECTIONS.MODELS, title: "Models" },
  { key: COLLECTIONS.BOM_ITEMS, title: "BOM Items" },
];

export function MaterialsPage() {
  const parts = useCollection(COLLECTIONS.PARTS);
  const revisions = useCollection(COLLECTIONS.PART_REVISIONS);
  const models = useCollection(COLLECTIONS.MODELS);
  const bomItems = useCollection(COLLECTIONS.BOM_ITEMS);

  const counts = {
    [COLLECTIONS.PARTS]: parts.records.length,
    [COLLECTIONS.PART_REVISIONS]: revisions.records.length,
    [COLLECTIONS.MODELS]: models.records.length,
    [COLLECTIONS.BOM_ITEMS]: bomItems.records.length,
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Malzeme Yonetimi"
        description="Bu ekran temel veri yapisinin referans alanidir. `parts`, `part_revisions`, `models` ve `bom_items` koleksiyonlari korunmustur."
      />
      <section className="dashboard-grid">
        {materialSections.map((section) => (
          <SectionCard
            key={section.key}
            title={section.title}
            description={`${section.key} koleksiyonundaki mevcut kayit sayisi.`}
          >
            <div className="metric-card">
              <strong>{counts[section.key]}</strong>
              <span>Kayit</span>
            </div>
          </SectionCard>
        ))}
      </section>
      <SectionCard
        title="Korunan Kurallar"
        description="Step 1 akisina dokunmayan genisleme prensipleri."
      >
        <ul className="rule-list">
          <li>Parcalar modele bagli olmadan olusabilir.</li>
          <li>Revizyonlar silinmez, guncelleme yeni revizyon ile yapilir.</li>
          <li>Parca ve teknik cizim yapisi bu iterasyonda degistirilmemistir.</li>
        </ul>
      </SectionCard>
    </div>
  );
}
