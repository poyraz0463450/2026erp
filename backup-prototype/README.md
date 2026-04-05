# Defense ERP

Firebase ve React tabanli, moduler ERP iskeleti. Mevcut Step 1 materyal yonetimi yapisini koruyacak sekilde yeni moduller eklenmistir. Bu ilk iterasyonda `Purchasing` modulu daha detayli islenmis, diger moduller ayni mimariyle temel seviyede eklenmistir.

## Moduller

- Material Management (referans/korunan yapi)
- Purchasing
- Quality Control
- Warehouse (WMS)
- Sales
- Production (MES)
- Audit Logs

## Teknoloji

- React + Vite
- Firebase Firestore
- Firebase Storage
- Firebase Authentication

## Kurulum

1. `.env.example` dosyasini `.env` olarak kopyalayin ve Firebase bilgilerinizi girin.
2. Bagimliliklari kurun:

```bash
npm install
```

3. Gelistirme sunucusunu baslatin:

```bash
npm run dev
```

## Koleksiyon Dokumani

- [Firestore Collection Structure](./docs/firestore-collections.md)
- [Sample Documents](./docs/sample-documents.json)

## Notlar

- Step 1 tarafindaki `parts`, `part_revisions`, `models`, `bom_items` yapisi korunmustur.
- Satinalma mal kabul islemleri stoklari otomatik olarak `inventory_lots` ve `stock_movements` koleksiyonlarina isler.
- Incoming QC onayi olmadan alinmis malzeme `available_quantity` alanina dusmez.
