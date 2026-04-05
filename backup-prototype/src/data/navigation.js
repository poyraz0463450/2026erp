export const navigationSections = [
  {
    id: "genel",
    label: "Genel",
    items: [
      {
        to: "/",
        label: "Ana Panel",
        title: "Ana Panel",
        description: "ERP genel durumu ve modul gecisleri.",
      },
    ],
  },
  {
    id: "muhendislik",
    label: "Muhendislik",
    items: [
      {
        to: "/materials",
        label: "Malzeme Yonetimi",
        title: "Malzeme Yonetimi",
        description: "Parca, revizyon, model ve urun agaci yonetimi.",
      },
    ],
  },
  {
    id: "operasyon",
    label: "Operasyon",
    items: [
      {
        to: "/purchasing",
        label: "Satin Alma",
        title: "Satin Alma",
        description: "Tedarikci, talep, siparis ve mal kabul akisi.",
      },
      {
        to: "/quality",
        label: "Kalite",
        title: "Kalite Kontrol",
        description: "Kalite plani, olcumler ve uygunsuzluk kayitlari.",
      },
      {
        to: "/warehouse",
        label: "Depo",
        title: "Depo Yonetimi",
        description: "Lot bazli stok hareketleri ve lokasyon takibi.",
      },
      {
        to: "/production",
        label: "Uretim",
        title: "Uretim Yonetimi",
        description: "Uretim emri, tuketim ve tamamlanan urun kayitlari.",
      },
      {
        to: "/sales",
        label: "Satis",
        title: "Satis ve Sevkiyat",
        description: "Musteri, siparis ve sevkiyat yonetimi.",
      },
    ],
  },
];

export const navigationItems = navigationSections.flatMap((section) => section.items);

export const navigationByPath = Object.fromEntries(
  navigationItems.map((item) => [item.to, item]),
);
