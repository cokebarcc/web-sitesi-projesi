# Firebase Kurulum Talimatları

Bu proje artık Firebase Authentication ve Firestore kullanıyor. Aşağıdaki adımları takip ederek Firebase'i yapılandırın.

## 1. Firebase Projesi Oluşturun

1. [Firebase Console](https://console.firebase.google.com/)'a gidin
2. "Add project" (Proje Ekle) butonuna tıklayın
3. Proje adını girin (örn: "mhrs-analiz")
4. Google Analytics'i istediğiniz gibi ayarlayın
5. "Create project" butonuna tıklayın

## 2. Web Uygulaması Ekleyin

1. Firebase Console'da projenize tıklayın
2. Project Overview sayfasında "Web" ikonuna (</>)tıklayın
3. Uygulama adını girin
4. Firebase Hosting'i şimdilik seçmeyin
5. "Register app" butonuna tıklayın
6. Çıkan yapılandırma kodunu kopyalayın

## 3. Firebase Yapılandırmasını Güncelleyin

1. `firebase.ts` dosyasını açın
2. `firebaseConfig` nesnesindeki placeholder değerleri, Firebase Console'dan kopyaladığınız değerlerle değiştirin:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

## 4. Firebase Authentication'ı Etkinleştirin

1. Firebase Console'da "Authentication" sekmesine tıklayın
2. "Get started" butonuna tıklayın
3. "Sign-in method" sekmesine gidin
4. "Email/Password" seçeneğini aktifleştirin
5. "Save" butonuna tıklayın

## 5. İlk Kullanıcıyı Oluşturun

### Yöntem 1: Firebase Console'dan
1. Authentication > Users sekmesine gidin
2. "Add user" butonuna tıklayın
3. E-posta ve şifre girin
4. "Add user" butonuna tıklayın

### Yöntem 2: Kod ile (Geçici)
```typescript
// Geliştirme sırasında kullanın, sonra silin
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

createUserWithEmailAndPassword(auth, 'admin@saglik.gov.tr', 'güvenli_şifre')
  .then(() => console.log('Kullanıcı oluşturuldu'))
  .catch(console.error);
```

## 6. Firestore Database'i Etkinleştirin

1. Firebase Console'da "Firestore Database" sekmesine tıklayın
2. "Create database" butonuna tıklayın
3. **Test mode** seçin (geliştirme için)
4. Lokasyon seçin (Europe-west için)
5. "Enable" butonuna tıklayın

### Güvenlik Kurallarını Ayarlayın

Firestore Rules sekmesinde aşağıdaki kuralları ayarlayın:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Sadece authenticate olmuş kullanıcılar erişebilir
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 7. Test Edin

1. Projeyi çalıştırın: `npm run dev`
2. Giriş ekranında oluşturduğunuz kullanıcı bilgileriyle giriş yapın
3. Veri yükleyin ve başka bir tarayıcıda/bilgisayarda aynı kullanıcıyla giriş yapın
4. Verilerin senkronize olduğunu kontrol edin

## 8. Deploy Edin

```bash
npm run deploy
```

## Önemli Notlar

- **Güvenlik**: Üretim ortamında Firestore kurallarını daha sıkı yapın
- **Kullanıcı Yönetimi**: Yeni kullanıcılar Firebase Console > Authentication'dan eklenebilir
- **Veri Senkronizasyonu**: Veriler otomatik olarak tüm bağlı cihazlara senkronize edilir
- **Offline Desteği**: localStorage backup olarak çalışmaya devam eder

## Kullanıcı Ekleme

Yeni kullanıcı eklemek için:
1. Firebase Console > Authentication > Users
2. "Add user" butonuna tıklayın
3. E-posta ve şifre girin
4. Kullanıcıya giriş bilgilerini iletin

## Sorun Giderme

### "Firebase configuration not found"
- `firebase.ts` dosyasındaki yapılandırmayı kontrol edin

### "Permission denied"
- Firestore kurallarını kontrol edin
- Kullanıcının giriş yapmış olduğundan emin olun

### "Auth domain not whitelisted"
- Firebase Console > Authentication > Settings > Authorized domains
- Domain'inizi ekleyin (örn: cokebarcc.github.io)
