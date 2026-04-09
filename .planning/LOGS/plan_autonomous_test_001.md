# GSD PLAN: EKOSİSTEM OTONOM TESTİ (T5 GENİŞLETME)

## 1. GÖREV (TASK)
`Her-Me-Z` projesindeki `tools/file_tools.py` dosyasında yer alan güvenlik korumalarını (Layer A, B, C) daha belirgin hale getirmek ve `_check_sensitive_read_path` fonksiyonuna ek kapsamlı yorumlar ekleyerek "Self-Documentation" seviyesini artırmak.

## 2. DOSYALAR (FILES)
- `tools/file_tools.py`

## 3. ADIMLAR (EXECUTE)
1. `tools/file_tools.py` dosyasını oku.
2. `_check_sensitive_read_path` fonksiyonu üzerine T5 görevinde tanımlanan "Surface-map" yorum bloğunu ekle.
3. Mevcut koruma listesini (`_SENSITIVE_HOME_FILES`) kontrol et ve dokümantasyonla uyumunu doğrula.
4. Değişiklikleri kaydet.

## 4. DOĞRULAMA (VERIFY)
1. Dosyanın sözdizimi (syntax) kontrolü.
2. `manifest.json` ve `merkle-root.js` ile yeni baseline'ın oluşturulması.
3. `attest-manifest.js` ile yeni durumun mühürlenmesi.
