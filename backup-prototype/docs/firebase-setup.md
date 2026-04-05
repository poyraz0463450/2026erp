# Firebase Kurulum Adimlari

## 1. Web App Olustur

Firebase console ana ekranda `Add app` butonuna tiklayin.

- Web (`</>`) ikonunu secin
- App nickname: `defense-erp-web`
- `Firebase Hosting` isaretlemeyin
- `Register app` ile devam edin

Olusan config icinden su alanlari alin:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

## 2. `.env` Dosyasi

`C:\Users\MEHMET\OneDrive\Belgeler\Playground\.env.example` dosyasindaki degiskenleri `.env` dosyasina kopyalayin ve Firebase config degerleri ile doldurun.

## 3. Authentication

Firebase Console > `Security` > `Authentication`

- `Get started`
- `Sign-in method`
- `Email/Password` etkinlestirin

## 4. Firestore Database

Firebase Console > `Databases & Storage` > `Firestore Database`

- `Create database`
- `Production mode` secin
- Region olarak size en yakin AB bolgesini secin

Sonrasinda `Rules` sekmesinde bu projedeki `firestore.rules` icerigini kullanin.

## 5. Storage

Firebase Console > `Databases & Storage` > `Storage`

- `Get started`
- Uygun region secin

Sonrasinda `Rules` sekmesinde bu projedeki `storage.rules` icerigini kullanin.

## 6. Ilk Kullanici

`Authentication` altinda ilk admin kullaniciyi elle olusturun.

Ardindan `users` koleksiyonunda ayni UID ile belge olusturun:

```json
{
  "full_name": "Admin Kullanici",
  "email": "mailiniz@example.com",
  "role": "admin"
}
```

## 7. Projeyi Calistir

```bash
npm run dev
```
