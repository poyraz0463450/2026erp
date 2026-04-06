# Artegon ERP Demo Rehberi

Bu demo veri seti iki katmandan oluşur:

- `Firestore demo`: parça, model, satın alma, kalite, lot, üretim, satış ve sevkiyat kayıtları
- `Yerel demo`: iş merkezleri, makineler, dokümanlar, fiyat geçmişi, RFQ, ASN, sayım ve finans ayarları

## Hızlı Kontrol

- Giriş: `http://127.0.0.1:5173/`
- Model ekranı: `http://127.0.0.1:5173/models`
- Parça ekranı: `http://127.0.0.1:5173/parts`
- İş emirleri: `http://127.0.0.1:5173/work-orders`

## Mühendislik / Teknik

- `ART9-G2`, `ART9-TAC`, `ART9-CMP`, `ART9-TRN`, `ART9-SD` modellerini kontrol edin
- `PRD-ART9-G2` ve `ASM-ALT-GOVDE-001` ürün ağaçlarını inceleyin
- Parça detayında `Kullanıldığı Modeller`, `BOM / Ürün Ağacı`, `Stok & Lot`, `Kalite Geçmişi` sekmelerini açın

## Satın Alma

- Satın alma siparişi örneği: `PO-2026-0003`
- Talep örnekleri: `pr_001`, `pr_004`, `pr_005`
- Tedarikçi örnekleri: `Akyol Çelik`, `Ateş Kaplama`, `Delta Polimer`
- Mal kabulden lota geçiş için `Mal Kabul` ekranında sevk edilmiş siparişleri açın

## Kalite

- Lot örnekleri: `LOT-2026-03-001`, `LOT-2026-03-005`, `LOT-2026-04-001`
- QC kayıtları: `qc_001` ile başlayan kayıtlar
- Uygunsuzluk kayıtları: `ncr_001` ve devamı
- Ölçüm cihazı demoları yerel demo koleksiyonunda hazırdır

## Depo / WMS

- Stok hareketleri ve izlenebilirlik için lot sorgusu yapın
- Sayım kayıtları yerel demoda `cc_001` ile başlar
- Satın alma girişleri karantina lotu olarak açılır

## Üretim / MES

- İş emri örnekleri: `WO-2026-001` ile `WO-2026-006`
- Örnek kontrol iş emri: `WO-2026-003`
- Makine dağılımı:
  - 10 dik işleme merkezi
  - 2 yatay işleme merkezi
  - 2 kayar otomat
  - 2 torna
  - 2 metal enjeksiyon
  - 2 plastik enjeksiyon
  - 5 eksantrik pres
  - 2 broş
  - 2 yiv-set çekme
  - 1 tesviye ünitesi

## Satış ve Sevkiyat

- Satış siparişi örnekleri: `SO-2026-0002`, `SO-2026-0005`
- Müşteri örnekleri: `Atlas Tactical Systems`, `Kara Sistemleri Başkanlığı`
- Sevkiyat kayıtları: `shipment_001`, `shipment_002`

## Finans

- Satış faturaları ve alış faturaları demo olarak hazırdır
- Birim maliyet ekranı için mamul veya montaj seçerek BOM bazlı maliyet dağılımını izleyin

## Not

- `Storage` aktif olmadığı için teknik resimler şu an demo kayıt olarak görünür, gerçek PDF yükleme akışı ayrı yapılandırma ister
- Yerel demo koleksiyonları uygulama açıldığında otomatik olarak tarayıcı local storage içine kurulur
