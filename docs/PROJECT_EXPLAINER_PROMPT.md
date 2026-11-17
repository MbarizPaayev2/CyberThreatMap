# CloudRDR Layihəsini Ətraflı İzah Etmək Üçün Hazır Prompt

> **İstifadə qaydası:** Aşağıda `PROMPT BAŞLAYIR` ilə `PROMPT BİTİR` arasındakı
> mətni kopyalayıb istənilən süni intellekt çatına (ChatGPT, Claude, Gemini və s.)
> yapışdır. AI layihəni müəllim səviyyəsində, ətraflı və ardıcıl izah edəcək.

```
PROMPT BAŞLAYIR

Sən informasiya təhlükəsizliyi üzrə təcrübəli universitet müəllimi və texniki
izahçısan. Sənin vəzifən: aşağıda tam təsviri verilən tələbə layihəsini elə izah
etmək ki, onu dinləyən müəllim layihənin məqsədini, dizaynını, texniki
detallarını və üç fənlə əlaqəsini tam başa düşsün.

ÇIXIŞ DİLİ: Azərbaycan dilində cavab ver. Texniki terminlər ingiliscə qalsın
(məsələn: SHA-256, Merkle root, baseline, IAM, canary file, fail-closed).

TON: Peşəkar, aydın, ardıcıl. Həddindən artıq jarqondan qaç, amma texniki
dəqiqliyi qurban vermə. Mürəkkəb anlayışları sadə gündəlik analogiyalarla açıqla.

════════ LAYİHƏ KONTEKSTİ ════════

Layihə adı: CloudRDR — Bulud Mühitində Ransomware Aşkarlama və Kriptoqrafik
Bərpa Sistemi.
Fənlər: (1) İnformasiya Təhlükəsizliyinin İdarəetmə Sistemləri (ISMS),
(2) Bulud Təhlükəsizliyi, (3) Kriptoqrafiyanın Əsasları.
Səviyyə: 3-cü kurs, İnformasiya Təhlükəsizliyi ixtisası. Bir semestr ərzində
icra olunur.

HƏLL ETDİYİ 3 PROBLEM:
P1 — Aşkarlama qeyri-müəyyənliyi: qanuni kütləvi əməliyyat (backup, miqrasiya)
ilə ransomware şifrələməsi eyni görünür (qısa vaxtda minlərlə fayl dəyişir).
Sadə "fayl dəyişdi → xəbərdarlıq" qaydası yararsız səs-küy yaradır.
P2 — Bərpaya inam: bərpa olunan məlumatın əsl, dəyişdirilməmiş orijinal olduğunu
sübut etmək lazımdır; əks halda kompromisə uğramış backup hücumçunun məzmununu
səssizcə geri qaytarar.
P3 — Sübut bütövlüyü: hücumçu və ya insider insident jurnalını dəyişə bilsə,
təşkilat hadisəni bərpa edə bilməz.

SİSTEMİN 4 FUNKSİYASI:
F1 — Monitorinq: bulud anbarındakı hər qorunan fayl üçün SHA-256 baseline heşi
hesablayır və saxlayır.
F2 — Aşkarlama: cari heşləri baseline ilə müqayisə edir, sürüşən zaman
pəncərəsində (30 saniyə) dəyişmə sürətini hesablayır; sürət ≥ 30% olduqda və ya
canary faylı dəyişdikdə ŞÜBHƏLİ qərarı verir.
F3 — Cavab: təsirlənmiş hesabı avtomatik təcrid edir (deny-write IAM siyasəti
ilə yalnız-oxuma rejimi), vəziyyəti evidence/ qovluğuna snapshot edir, insident
qeydini yaradır, heş zəncirinə bağlayır və Ed25519 ilə imzalayır.
F4 — Bərpa: AES-256-GCM ilə şifrələnmiş ehtiyat nüsxələrdən bərpa edir, hər
faylı yenidən heşləyib baseline ilə müqayisə edir, Merkle kökünü yoxlayır və
VALID / MODIFIED nəticəsi verir.


ARXİTEKTURA ZƏNCİRİ (ARDICILLIQ):
Bulud Anbarı {files/, canary/, evidence/, backup/} → MONİTOR (oxu + SHA-256 +
vaxt qeydi) → BASELINE ANBARI {path → sha256, size, mtime, ver; bütün dəst üzrə
Merkle kökü} → AŞKARLAMA MÜHƏRRİKİ {cari vs baseline + sürüşən pəncərə + hədd
qaydası + canary tələsi} → NORMAL (davam) YA DA ŞÜBHƏLİ → CAVABVERİCİ {hesabı
dondur + snapshot + imzalı insident qeydi} → EHTİYAT NÜSXƏ & BƏRPA {AES-256-GCM
bloblar + imzalanmış manifest + bərpa + heş yoxlaması} → YOXLAYICI {heş ==
baseline ? VALID / MODIFIED}.

DİZAYN PRİNSİPLƏRİ:
- Məsuliyyətlərin ayrılması: aşkarlama heç vaxt bərpa etmir; cavabverici heç
vaxt heş hesablamır.
- Fail-closed: heş hesablanmasa və ya imza yoxlanmasa, məlumat etibarsız sayılır
və bərpa rədd edilir.
- Əvvəlcə sübut: insident qeydi bərpadan ÖNCƏ yaradılır və imzalanır.
- Ən az imtiyaz: monitor yalnız-oxuma girişlidir; yalnız cavabverici IAM
dəyişə bilər.

KRİPTOQRAFİYA (cavabında bunları izah et):
- SHA-256 (FIPS 180-4): hər faylın bütövlük barmaq izi.
- Merkle kökü: dəyişən tək bayt belə kökü dəyişir → bütün dəst üçün yığcam
bütövlük dəyəri.
- Heş zəncirləmə (prevHash): əvvəlki qeydi dəyişmək zənciri pozur → tampering
aşkarlanır.
- Ed25519 / ECDSA rəqəmsal imza (FIPS 186-5): təkzibolunmazlıq; saxta qeyd imza
yoxlamasından keçə bilməz.
- AES-256-GCM (NIST SP 800-38D): ehtiyat nüsxələrin həm məxfiliyi, həm
bütövlüyü — AEAD teqi dəyişdirilmiş şifrəli mətni açma zamanı rədd edir.
- Açar idarəetməsi: idarə olunan sirr anbarı, rotasiya, zərfləmə şifrələməsi,
açar versiyası.
Bu layihənin kriptoqrafiyasını "AES istifadə etdik" səviyyəsindən fərqləndirən
səbəb: hər xassə (bütövlük, həqiqilik, bərpa düzgünlüyü, məxfilik) keç/qal testlə
sübut olunur, iddia ilə yox.

ÜÇ FƏNN ÜZRƏ ƏLAQƏ (bunları mütləq əhatə et):
ISMS — insident idarəetməsi ISO 27001: 5.24–5.28; aktiv reyestri/təsnifat
A.5.9, A.5.12, A.5.13; risk reyestri 5×5 matris; BCP/DRP, RTO ≤ 30 dəq,
RPO ≤ 15 dəq, A.5.29, A.5.30; sübut A.5.28.
Bulud — versiyalama, dəyişməzlik/obyekt kilidi, 3 ən-az-imtiyazlı subyekt
(svc-monitor, svc-responder, svc-backup), deny-write ilə dondurma, bulud
jurnallaşdırma, shared-responsibility (ISO 27017).
CSF 2.0 — Govern, Identify, Protect, Detect, Respond, Recover üzrə töhfələr.

DEMO SSENARİSİ (addım-addım danış):
1) Hazırlıq: 100 fayl + 3 canary, baseline + imzalanmış Merkle kökü.
2) Normal: 3 fayl dəyişir (3%) → NORMAL.
3) Qanuni bulk: 25 fayl 2 dəqiqədə → NORMAL (yalançı-müsbət yoxdur).
4) Hücum: 82 fayl ~10 saniyədə + canary toxunuşu → ŞÜBHƏLİ (≈1.0).
5) Cavab: deny-write IAM + snapshot + imzalı INC-2026-0001.
6) Bərpa: AES-GCM-dən bərpa + təkrar heş + Merkle müqayisəsi.
7) Sübut: Baseline SHA-256 == Bərpa SHA-256 → VALID ✅.
8) Tampering testi: qeyddə 1 bayt dəyişdirilir → imza INVALID ❌, zəncir
FAILED ❌ — bu, demonun ən təsirli anıdır.

METRİKALAR: M1 aşkarlama ≥95%, M2 yalançı-müsbət ≤5%, M3 aşkarlama ≤60 s,
M4 dondurma 100%, M5 AEAD 100%, M6 bərpa VALID 100%, M7 tampering 100% aşkar.

DÜRÜST MƏHDUDİYYƏTLƏR (gizlətmə):
- Evristikdir — "low-and-slow" hücumdan (dəqiqədə bir neçə fayl) yayına bilər;
gələcək iş: entropiya təhlili.
- Tək-kirayəçidir; fiziki HSM yox, idarə olunan sirr anbarıdır; simulyator
zərərsizdir; hüquqi qəbuledicilik sübut olunmur.

════════ İZAH STRUKTURU (MƏCBURİ) ════════
Cavabını bu 12 bölmə ilə qur:
1) Layihə nədir — 3-4 cümləlik giriş, gündəlik analogiya.
2) Niyə vacibdir — ransomware-in buluda keçməsi, 3 problem (P1, P2, P3).
3) Ümumi mənzərə — arxitektura zəncirini sadə dillə keç.
4) Monitorinq və baseline — SHA-256 + Merkle kökünü ayrı izah et.
5) Aşkarlama mexanikası — dəyişmə sürəti + canary + yazma sürəti; yalançı-müsbət
məsələsini aç.
6) Avtomatik cavab — 4 addımlı protokol (contain, preserve, record, seal).
7) Ehtiyat nüsxə və bərpa — AES-256-GCM + imzalı manifest + 5 addımlı bərpa + VALID/MODIFIED.
8) Sübutların kriptoqrafik qorunması — 5 təminat cədvəli.
9) Üç fənlə əlaqə — ISMS / Bulud / Kriptoqrafiya cədvəlləri + CSF 2.0.
10) Demo ssenarisi — 8 addımı canlı təqdimat kimi danış.
11) Metrikalar və məhdudiyyətlər — M1–M9 + dürüst limitlər.
12) Yekun — bir cümləlik xülasə + müəllimin verə biləcəyi 3 çətin sual və qısa cavabları.

FORMAT QAYDALARI:
- Başlıqlar, cədvəllər və qısa siyahılardan istifadə et.
- Kod nümunəsi istənilməyib; məntiqi sözlərlə açıqla.
- Həddindən uzun monolit mətn yazma; hər bölməni yığcam saxla.
- "VALID / MODIFIED" və "FAILED / INVALID" nəticələrini nümunə ilə göstər.

PROMPT BİTİR
```
