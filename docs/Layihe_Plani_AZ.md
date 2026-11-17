# Layihə Planı

## Bulud Mühitində Ransomware Aşkarlama və Kriptoqrafik Bərpa Sistemi

**Qısa adı:** CloudRDR (Cloud Ransomware Detection & Recovery)

| Sahə | Məlumat |
|---|---|
| **Layihənin adı** | Bulud Mühitində Ransomware Aşkarlama və Kriptoqrafik Bərpa Sistemi |
| **Müəllif** | _[Tələbənin adı və soyadı]_ |
| **Tələbə nömrəsi (ID)** | _[ID]_ |
| **Kurs** | 3-cü kurs / İnformasiya Təhlükəsizliyi |
| **Fənlər** | İnformasiya Təhlükəsizliyinin İdarəetmə Sistemləri (ISMS) · Bulud Təhlükəsizliyi · Kriptoqrafiyanın Əsasları |
| **Rəhbər** | _[Müəllimin adı]_ |
| **Versiya** | 1.0 |
| **Tarix** | Oktyabr 2026 |
| **Status** | Müəllimin rəyi üçün təqdim edilir |

---

## Mündəricat

1. [Xülasə](#1-xülasə)
2. [Mövzunun aktuallığı və problem qoyuluşu](#2-mövzunun-aktuallığı-və-problem-qoyuluşu)
3. [Layihənin məqsədi və vəzifələri](#3-layihənin-məqsədi-və-vəzifələri)
4. [Tədqiqat sualları](#4-tədqiqat-sualları)
5. [Layihənin əhatə dairəsi](#5-layihənin-əhatə-dairəsi)
6. [Sistemin arxitekturası](#6-sistemin-arxitekturası)
7. [Texniki həll və komponentlər](#7-texniki-həll-və-komponentlər)
8. [Üç fənn üzrə əlaqə](#8-üç-fənn-üzrə-əlaqə)
9. [İstifadə olunan standartlar](#9-istifadə-olunan-standartlar)
10. [İş planı və mərhələlər](#10-iş-planı-və-mərhələlər)
11. [Gözlənilən nəticələr](#11-gözlənilən-nəticələr)
12. [Qiymətləndirmə meyarları](#12-qiymətləndirmə-meyarları)
13. [Risk, fərziyyələr və məhdudiyyətlər](#13-risk-fərziyyələr-və-məhdudiyyətlər)
14. [Nəticə](#14-nəticə)
15. [İstinadlar](#15-istinadlar)

---

## 1. Xülasə

Ransomware (fidyə proqramı) bulud mühitində saxlanılan məlumatlar üçün ən
təhlükəli hücum növlərindən biridir. Adi zərərli proqramlardan fərqli olaraq,
onun əsas məqsədi məlumatı **oğurlamaq deyil, əlçatmaz etməkdir** — faylları
şifrələyərək fidyə tələb edir. Bulud anbarı çox vaxt təşkilatın "əsas məlumat
mənbəyi" sayıldığından, bulud anbarına çatan ransomware hadisəsi bütün
fəaliyyəti dayandıra bilər.

Bu layihədə **CloudRDR** — bulud üçün nəzərdə tutulmuş, yüngül bir sistem
tərtib edilir, qurulur və qiymətləndirilir. Sistem aşağıdakıları edir:

1. bulud anbarını **daim izləyir** və hər qorunan fayl üçün **SHA-256
   başlanğıc (baseline) heşi** hesablayır;
2. cari heşləri baseline ilə müqayisə edərək və zaman pəncərəsi üzrə dəyişmə
   sürəti həddi tətbiq edərək anormal kütləvi dəyişikliyi **aşkarlayır**;
3. təsirlənmiş hesabı avtomatik **təcrid edir** (yalnız-oxuma rejiminə keçirir)
   və dəyişdirilə bilməyən, kriptoqrafik olaraq qorunan hadisə qeydini saxlayır;
4. şifrələnmiş, bütövlüyü yoxlanılmış ehtiyat nüsxələrindən məlumatı
   **bərpa edir** və bərpanın baseline ilə **bit-bit eyni** olduğunu sübut edir.

Layihə üç fənnin kəsişməsində dayanır:

- **İnformasiya Təhlükəsizliyinin İdarəetmə Sistemləri (ISMS):** insident
  idarəetməsi, fasiləsizlik və fəlakətdən bərpa planlaması, risk
  qiymətləndirilməsi, aktivlərin təsnifatı və sübutlarla işləmə — ISO/IEC
  27001:2022 və NIST CSF 2.0 çərçivəsində.
- **Bulud Təhlükəsizliyi:** bulud obyekt anbarı, IAM vasitəsilə hesab təcridi,
  dəyişdirilməzlik (immutability) və versiyalama, bulud jurnallaşdırması və
  monitorinq, məsuliyyətin bölüşdürülməsi modeli.
- **Kriptoqrafiyanın Əsasları:** kriptoqrafik heşləmə (SHA-256), tampering
  aşkarlanması üçün Merkle tipli heş zənciri, sübutların təkzibolunmazlığı üçün
  rəqəmsal imzalar və ehtiyat nüsxələrin AES-256-GCM ilə autentifikasiyalı
  şifrələnməsi və açar idarəetməsi.

Gözlənilən nəticə: işlək prototip + idarəetmə (governance) sənəd paketi ilə
texniki bulud nəzarətlərinin auditi mümkün ISMS tələblərinə necə çevrildiyini
göstərən bir iş. Layihə bir semestr ərzində tamamlana biləcək şəkildə
planlaşdırılıb, eyni zamanda texniki cəhətdən ciddi və nümayiş etdirilə biləndir.

---

## 2. Mövzunun aktuallığı və problem qoyuluşu

### 2.1 Aktuallıq

Müasir təşkilatlar kritik məlumatlarını bulud obyekt anbarlarında (Amazon S3,
Azure Blob Storage, Google Cloud Storage, Supabase Storage və s.) saxlayır.
Ransomware operatorları buna uyğunlaşaraq yalnız bir fərdi kompüteri deyil,
**bulud anbarı qatını və ehtiyat nüsxə qatını eyni vaxtda** hədəfləyirlər ki,
qurban fidyə ödəmədən bərpa edə bilməsin. Buna görə müasir müdafiə həm
**anbar tərəfində aşkarlama**, həm də **kriptoqrafik olaraq yoxlanıla bilən,
təcrid olunmuş ehtiyat nüsxələr** tələb edir.

### 2.2 Problem qoyuluşu

Bu hücum sinfini müdafiə etməyi çətinləşdirən üç problem var:

1. **Aşkarlama qeyri-müəyyənliyi.** Ehtiyat nüsxə işi, kütləvi idxal və ya
   qanuni miqrasiya saniyələr içində minlərlə faylı dəyişə bilər — bu,
   ransomware şifrələməsi ilə eyni görünür. Sadə "fayl dəyişdi → xəbərdarlıq"
   qaydası istifadə olunmaz dərəcədə çox yalançı xəbərdarlıq yaradır.
2. **Bərpaya inam.** Hadisədən sonra məlumatı bərpa etmək o zaman faydalıdır ki,
   təşkilat bərpa olunan məlumatın **əsl, dəyişdirilməmiş orijinal** olduğunu
   *sübut edə bilsin*. Kriptoqrafik bütövlük olmadan kompromisə uğramış ehtiyat
   nüsxədən bərpa, hücumçunun dəyişdirdiyi məzmunu səssizcə geri qaytara bilər.
3. **Sübut bütövlüyü.** İnsident qeydləri etibarlı və təkzibolunmaz olmalıdır.
   Əgər hücumçu (və ya daxili şəxs) insident jurnalını dəyişə bilərsə, təşkilat
   nə baş verdiyini bərpa etmək qabiliyyətini itirir.

**CloudRDR** hər üç problemi **dəyişmə sürəti əsaslı anomaliya aşkarlaması**,
**kriptoqrafik olaraq yoxlanıla bilən ehtiyat nüsxələr** və **tampering
aşkarlayan, imzalanmış insident qeydləri** ilə birləşdirərək həll edir.

### 2.3 Niyə məhz bu mövzu

- **Reallıq:** bulud anbarına və ehtiyat nüsxələrə qarşı ransomware sənədləşmiş,
  aktual və sürətlə artan təhlükə sinfidir — bu nəzəri problem deyil.
- **Balans:** əsas aşkarlama məntiqi (heş müqayisəsi + hədd) bir semestrdə
  etibarlı qurula biləcək qədər sadədir, lakin dizayn real kriptoqrafiyaya
  (heşləmə, imza, AEAD) və real idarəetməyə (insident idarəetməsi, BCP/DRP, risk
  idarəetməsi) toxunur.
- **Nümayiş imkanı:** sistem aydın, vizual və təkrarlana bilən demo yaradır:
  simulyasiya edilmiş hücum başladılır, sistem onu aşkarlayır, hesabı dondurur,
  məlumatı bərpa edir və bütövlüyü sübut edir. Bu, layihəni təqdim etməyi və
  müdafiə etməyi asanlaşdırır.

---

## 3. Layihənin məqsədi və vəzifələri

**Ümumi məqsəd:** Ransomware tipli kütləvi fayl dəyişikliyini aşkarlayan,
toplanmış sübutları kriptoqrafik olaraq qoruyan və məlumatı yoxlanıla bilən
bütövlüklə bərpa edən bulud əsaslı sistem tərtib etmək, qurmaq və
qiymətləndirmək — hər texniki nəzarəti tanınmış ISMS tələbləri ilə
əlaqələndirməklə.

**Konkret vəzifələr:**

| № | Vəzifə | Əsas fənn |
|---|---|---|
| V1 | Bütün qorunan fayllar üçün SHA-256 baseline hesablayan və saxlayan monitorinq boru xəttini qurmaq | Kriptoqrafiya |
| V2 | Kütləvi şifrələmə hadisəsini adi kütləvi fəaliyyətdən zaman pəncərəsi əsaslı dəyişmə sürəti həddi ilə ayıran aşkarlama mühərriki tətbiq etmək | Bulud Təhlükəsizliyi |
| V3 | Avtomatik hesab təcridini (IAM yalnız-oxuma) və insident qeydinin yaradılmasını tətbiq etmək | Bulud Təhlükəsizliyi |
| V4 | Ehtiyat nüsxələri AES-256-GCM ilə qorumaq və insident/sübut manifestlərini rəqəmsal imzalarla imzalamaq | Kriptoqrafiya |
| V5 | Yoxlanılan bərpanı tətbiq etmək: bərpa olunan heşləri baseline ilə müqayisə edərək VALID/MODIFIED nəticəsi vermək | Kriptoqrafiya |
| V6 | ISMS sənəd paketini (insident planı, BCP/DRP, risk reyestri, aktivlərin təsnifatı, sübutlandırma siyasəti) hazırlamaq və nəzarətləri ISO/IEC 27001:2022 və NIST CSF 2.0 ilə əlaqələndirmək | ISMS |
| V7 | Prototipi müəyyən edilmiş meyarlar üzrə qiymətləndirmək və qalıq riski sənədləşdirmək | Hamısı |

---

## 4. Tədqiqat sualları

- **TS1.** Sadə, bulud əsaslı dəyişmə sürəti detektoru ransomware kütləvi
  şifrələmə hadisəsini adi kütləvi fayl fəaliyyətindən məqbul yalançı-müsbət
  nisbəti ilə etibarlı şəkildə ayıra bilirmi?
- **TS2.** Kriptoqrafik primitivləri (SHA-256, Merkle tipli zəncirləmə, rəqəmsal
  imzalar, AES-256-GCM) necə birləşdirmək olar ki, həm *sübutlar*, həm də
  *ehtiyat nüsxələr* bulud mühitində yoxlanıla bilən şəkildə tampering
  aşkarlayan olsun?
- **TS3.** Prototipdə tətbiq edilən texniki nəzarətlər ISO/IEC 27001:2022 və
  NIST CSF 2.0 tələblərinə necə uyğunlaşır və hansı qalıq risk qalır?

---

## 5. Layihənin əhatə dairəsi

### 5.1 Əhatə edilir (in scope)

- Sadələşdirilmiş bulud anbar qatı (versiyalamalı və dəyişdirilməz obyekt anbarı).
- Daimi fayl monitorinqi və SHA-256 baseline heşləməsi.
- Zaman pəncərəsi əsaslı anomaliya aşkarlama mühərriki.
- Avtomatik cavab: hesabın/iş yükünün təcrid edilməsi (yalnız-oxuma) və insident
  qeydinin yaradılması.
- Şifrələnmiş, imzalanmış, bütövlüyü yoxlanılan ehtiyat nüsxə və bərpa.
- ISMS sənədləri: insidentə cavab planı, BCP/DRP, risk reyestri, aktivlərin
  təsnifatı, sübutlarla işləmə siyasəti.

### 5.2 Əhatə edilmir (out of scope)

- Real zərərli proqramların təhlili və ya real ransomware ailələrinin
  tərs-mühəndisliyi.
- İstehsalat səviyyəsində paylanmış anbar (prototip tək idarə olunan bucket
  istifadə edir).
- Tam açıq açar infrastrukturu (PKI) və aparat təhlükəsizlik modulları (HSM);
  imzalar idarə olunan sirr anbarında saxlanılan açar cütü ilə edilir.
- Sübutların hüquqi qəbulediciliyinin sertifikatlaşdırılması; layihə bunu
  dəstəkləyən **texniki** mexanizmləri nümayiş etdirir.

---

## 6. Sistemin arxitekturası

CloudRDR bir-birindən asılı olmayan altı komponentdən ibarətdir. Hər biri ayrı
bir məsuliyyət daşıyır — bu, dizaynı test edilə bilən və sadə saxlayır.

```
                    ┌──────────────────────────────────────┐
                    │            BULUD ANBARI              │
                    │   (versiyalama + dəyişməzlik aktiv)  │
                    │   files/  ·  canary/  ·  evidence/   │
                    └───────────────────┬──────────────────┘
                                        │  obyekt hadisələri / sorğulama
                                        ▼
                    ┌──────────────────────────────────────┐
                    │            MONİTOR (agent)           │
                    │  • faylı oxu  • SHA-256 hesabla      │
                    │  • vaxt qeydi • dəyişiklik siqnalı   │
                    └───────────────────┬──────────────────┘
                                        ▼
                    ┌──────────────────────────────────────┐
                    │        BASELINE ANBARI (heş xəritəsi)│
                    │  path -> { sha256, size, mtime, ver }│
                    │  bütün baseline üzərində Merkle kökü │
                    └───────────────────┬──────────────────┘
                                        ▼
                    ┌──────────────────────────────────────┐
                    │          AŞKARLAMA MÜHƏRRİKİ         │
                    │  • cari ilə baseline müqayisəsi      │
                    │  • sürüşən zaman pəncərəsi (məs. 30s)│
                    │  • dəyişmə sürəti = dəyişmiş / cəmi  │
                    │  • hədd qaydası + canary tələsi      │
                    └──────────┬──────────────┬────────────┘
                               │              │
                      NORMAL   │              │  ŞÜBHƏLİ
                               ▼              ▼
                        (davam et)  ┌──────────────────────────┐
                                    │        CAVABVERİCİ       │
                                    │ 1. Hesabı dondur (yalnız-│
                                    │    oxuma IAM siyasəti)   │
                                    │ 2. İnsident qeydi yarat  │
                                    │ 3. İnsident manifestini  │
                                    │    imzala                │
                                    └──────────┬───────────────┘
                                               ▼
                                    ┌──────────────────────────┐
                                    │   EHTİYAT NÜSXƏ & BƏRPA  │
                                    │ • AES-256-GCM ilə şifrə  │
                                    │ • imzalanmış manifest    │
                                    │ • bərpa + heş yoxlaması  │
                                    └──────────┬───────────────┘
                                               ▼
                                    ┌──────────────────────────┐
                                    │        YOXLAYICI         │
                                    │  heş == baseline ?       │
                                    │    → VALID / MODIFIED    │
                                    └──────────────────────────┘
```

**Tətbiq edilən dizayn prinsipləri:**

- **Məsuliyyətlərin ayrılması.** Aşkarlama heç vaxt bərpa etmir; cavabverici
  heç vaxt heş hesablamır. Bu, hər komponenti ayrıca test etməyə imkan verir.
- **"Fail-closed" (uğursuzluqda bağlanma).** Sistem heş hesablaya bilmirsə və ya
  ehtiyat nüsxə imzasını yoxlaya bilmirsə, məlumatı etibarsız sayır və bərpanı
  rədd edir.
- **Əvvəlcə sübut.** İnsident qeydi bərpaya başlamazdan **əvvəl** yaradılır və
  imzalanır ki, xronologiya qorunsun.
- **Ən az imtiyaz.** Monitor yalnız-oxuma girişinə malikdir; yalnız cavabverici
  IAM siyasətini dəyişə bilər; yalnız ehtiyat nüsxə komponenti ehtiyat nüsxə
  bucket-inə yaza bilər.

---

## 7. Texniki həll və komponentlər

### 7.1 Anbar qatı

Tək idarə olunan obyekt anbarı (Supabase Storage, AWS S3 və ya ekvivalenti) dörd
məntiqi prefiksdən ibarətdir:

```
bucket/
├── files/       # qorunan kritik fayllar
├── canary/      # heç vaxt dəyişməməli olan tələ (decoy) fayllar
├── evidence/    # insident qeydləri və manifestlər
└── backup/      # şifrələnmiş, imzalanmış ehtiyat nüsxə blobları
```

Tələb olunan anbar xüsusiyyətləri: **versiyalama** (hər üzərinə yazma əvvəlki
versiyanı saxlayır), **dəyişməzlik/obyekt kilidi** (`backup/` və `evidence/`
yalnız-bir-dəfə-yazılır), **sərhəddə server tərəfli şifrələmə** və **hər prefiks
üçün ayrı giriş məlumatları**.

### 7.2 Baseline heşləmə

Baseline — hər qorunan faylın vəziyyətinin etibarlı snapshot-ıdır.

- Hər fayl üçün `{ path, sha256, size, mtime, version }` qeyd olunur.
- Baseline JSON manifest kimi saxlanılır və bütün fayl heşlərinin **Merkle kökü**
  ayrıca hesablanır. Tək fayl dəyişsə, Merkle kökü dəyişir — bütün məlumat
  dəsti üçün yığcam bir bütövlük dəyəri alınır.

```javascript
// Konseptual baseline heşləmə (Node.js, yalnız daxili crypto)
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

function sha256File(path) {
  const data = readFileSync(path);                 // baytları oxu
  return createHash('sha256').update(data).digest('hex');
}

function merkleRoot(hashes) {
  if (hashes.length === 0) return null;
  let level = hashes.map(h => createHash('sha256').update(h).digest('hex'));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = level[i + 1] ?? a;                 // tək qalarsa təkrarla
      next.push(createHash('sha256').update(a + b).digest('hex'));
    }
    level = next;
  }
  return level[0];
}

export { sha256File, merkleRoot };
```

### 7.3 Aşkarlama mühərriki

Aşkarlama mühərriki xam dəyişiklik siqnallarını qərara çevirir.

**Siqnal 1 — sürüşən pəncərədə dəyişmə sürəti.**

```
pəncərə W (məs. 30 saniyə) üçün:
    dəyişmiş = |{ f : hash_cari(f) != hash_baseline(f) }|
    sürət    = dəyişmiş / qorunan_faylların_sayı
    əgər sürət >= SÜRƏT_HƏDDİ (məs. 0.30):  -> ŞÜBHƏLİ
```

**Siqnal 2 — canary tələsi.** `canary/` faylının hər hansı dəyişməsi dərhal,
yüksək etibarlılıqlı tetikdir, çünki canary fayllarının dəyişməsi üçün qanuni
səbəb yoxdur.

**Siqnal 3 — yazma sürəti.** Yazma əməliyyatlarının partlaması (məs. saniyədə N-dən
çox) fayl sayı həddinə çatmadan belə etibarlılığı artırır.

```javascript
// Konseptual aşkarlama məntiqi
const RATE_THRESHOLD = 0.30;   // qorunan faylların 30%-i dəyişdi
const WINDOW_MS      = 30_000; // 30 saniyəlik sürüşən pəncərə

function evaluate(changes, totalFiles, canaryHit) {
  if (canaryHit) {
    return { verdict: 'SUSPICIOUS', reason: 'CANARY_MODIFIED', confidence: 1.0 };
  }
  const now = Date.now();
  const recent = changes.filter(c => now - c.ts <= WINDOW_MS);
  const rate = recent.length / totalFiles;

  if (rate >= RATE_THRESHOLD) {
    return {
      verdict: 'SUSPICIOUS',
      reason: 'MASS_MODIFICATION',
      confidence: Math.min(1, rate / RATE_THRESHOLD * 0.9)
    };
  }
  return { verdict: 'NORMAL', reason: 'WITHIN_TOLERANCE', confidence: 0 };
}

export { evaluate, RATE_THRESHOLD, WINDOW_MS };
```

**Tənzimləmə və yalançı-müsbət.** Hədd konfiqurasiya oluna bilər. Qanuni
kütləvi işlər (ehtiyat nüsxə, miqrasiya) üçün *icazəli pəncərə* mexanizmi
tətbiq olunur: elan edilmiş texniki xidmət dövründə hədd artırılır və ya işin
öz identifikatoru istisna edilir. Bu, TS1 sualına birbaşa cavabdır.

### 7.4 Avtomatik cavab (dondurma)

Qərar ŞÜBHƏLİ olduqda cavabverici sabit bir protokol icra edir:

1. **Təcrid (Contain).** Təsirlənmiş iş yükünün giriş məlumatları ləğv edilir və
   yazmanı qadağan edən (yalnız-oxuma) IAM siyasəti tətbiq olunur ki, kütləvi
   şifrələmə davam edə bilməsin. İdarə olunan buludda bu, kompromisə uğramış
   subyektə `s3:PutObject` / `storage.objects.insert` əməliyyatını **rədd edən**
   IAM siyasəti dəyişikliyidir.
2. **Qoruma (Preserve).** Cari (bəlkə də zədələnmiş) vəziyyət sonrakı forenzik
   təhlil üçün `evidence/`-ə snapshot kimi köçürülür — "hadisə yerini" heç vaxt
   məhv etməmək lazımdır.
3. **Qeyd (Record).** Strukturlu insident qeydi yaradılır: insident ID-si,
   aşkarlama vaxtı, tetik siqnalı, təsirlənmiş faylların siyahısı, əvvəl/sonra
   Merkle kökü, subyekt identifikasiyası və görülən tədbirlər.
4. **Möhürləmə (Seal).** İnsident manifestinin heşi hesablanır, əvvəlki qeydin
   heşinə zəncirlənir və nəticədə alınan manifest cavabvericinin şəxsi açarı ilə
   **imzalanır**.

```jsonc
// Nümunə insident qeydi (evidence/INC-2026-0001.json)
{
  "incidentId": "INC-2026-0001",
  "detectedAt": "2026-10-03T14:22:07Z",
  "trigger": { "signal": "MASS_MODIFICATION", "rate": 0.82, "window": "30s" },
  "affected": 82,
  "merkleRootBefore": "9f2c...a1",
  "merkleRootAfter":  "4b71...e0",
  "actor": "svc-compromised-writer",
  "actions": ["IAM_DENY_WRITE_APPLIED", "SNAPSHOT_TAKEN", "BACKUP_PENDING"],
  "prevHash": "0c13...77",           // heş zəncirinin halqası
  "signature": "MEUCIQ...base64"     // qeyd üzərində Ed25519 imzası
}
```

### 7.5 Ehtiyat nüsxə və yoxlanılan bərpa

**Ehtiyat nüsxə.** Hər qorunan fayl unikal nonce/IV və autentifikasiya teqi ilə
birlikdə AES-256-GCM blobu kimi saxlanılır. *Ehtiyat nüsxə manifesti* hər faylı
onun orijinal SHA-256-sı ilə sadalayır; sonra manifest imzalanır.

**Bərpa.** İnsident təcrid edildikdən sonra:

1. Ehtiyat nüsxə manifestinin imzası yoxlanılır (keçərsizdirsə rədd edilir).
2. Hər blob AES-256-GCM ilə açılır (AEAD teqi şifrəli mətnin dəyişdirilmədiyini
   təmin edir).
3. Hər bərpa olunan faylın SHA-256-sı yenidən hesablanır.
4. Etibarlı baseline heşləri və manifest ilə müqayisə olunur.
5. Merkle kökü yenidən hesablanır və imzalanmış baseline kökü ilə müqayisə edilir.

Yalnız bütün yoxlamalar keçərsə bərpa **VALID** elan olunur; əks halda fayl
**MODIFIED** kimi bildirilir və bərpa geri qaytarılır və eskalasiya edilir.

```javascript
// Konseptual AES-256-GCM ehtiyat nüsxə/bərpa (Node.js daxili crypto)
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGO = 'aes-256-gcm';

function encryptBlob(key, plaintext) {           // key = 32 təsadüfi bayt
  const iv = randomBytes(12);                    // GCM üçün 96-bit nonce
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, tag, ct };
}

function decryptBlob(key, { iv, tag, ct }) {
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);                      // dəyişdirilibsə uğursuz olur
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

function verify(restoredBytes, baselineSha256) {
  const actual = createHash('sha256').update(restoredBytes).digest('hex');
  return actual === baselineSha256 ? 'VALID' : 'MODIFIED';
}

export { encryptBlob, decryptBlob, verify };
```

### 7.6 Sübutların kriptoqrafik qorunması

Sübut alt-sistemi beş təminat verir:

| Təminat | Primitiv | Mexanizm |
|---|---|---|
| **Bütövlük** | SHA-256 | Hər fayl və manifest heşlənir; Merkle kökü məlumat dəstini yığcam əks etdirir |
| **Tampering aşkarlanması** | Heş zəncirləmə | Hər insident qeydi `prevHash` saxlayır; əvvəlki qeydi dəyişmək zənciri pozur |
| **Təkzibolunmazlıq** | Rəqəmsal imza (Ed25519 / ECDSA) | Həm insident, həm ehtiyat nüsxə manifestləri imzalanır; yoxlama saxtakarlığı aşkarlayır |
| **Məxfilik** | AES-256-GCM | Ehtiyat nüsxə blobları şifrələnir; GCM həm də autentifikasiya edir |
| **Açar idarəetməsi** | İdarə olunan sirr anbarı + rotasiya | Açarlar idarə olunan anbarda yaradılır/saxlanılır, cədvəl üzrə rotasiya olunur, koda heç vaxt yazılmır |

Nəticədə tədqiqatçı *"bu sübut dəyişdirilibmi?"* sualına inama deyil,
kriptoqrafik dəqiqliyə əsaslanaraq cavab verə bilir.

---

## 8. Üç fənn üzrə əlaqə

Bu bölmə layihənin üç fənni necə əhatə etdiyini göstərir — müəllimin rəyi üçün
əsas hissədir.

### 8.1 İnformasiya Təhlükəsizliyinin İdarəetmə Sistemləri (ISMS)

| Sahə | Layihədə tətbiqi | Uyğun standart |
|---|---|---|
| İnsident idarəetməsi | Planlaşdırma, qiymətləndirmə, cavab, öyrənmə, sübut toplama | ISO 27001: **5.24–5.28** |
| Aktivlərin təsnifatı | Fayl/bulud resurslarının aktiv reyestri və etiketlənməsi | **A.5.9, A.5.12, A.5.13** |
| Risk qiymətləndirilməsi | 5×5 ehtimal × təsir matrisi, risk reyestri, qalıq risk | Clause 6.1 |
| Fasiləsizlik və bərpa | BCP/DRP, RTO/RPO hədəfləri, bərpa məşqi | **A.5.29, A.5.30** |
| Sübutlarla işləmə | Kriptoqrafik möhürlənmiş insident qeydləri | **A.5.28** |
| Təchizatçı idarəetməsi | Bulud provayderinin qiymətləndirilməsi | **A.5.19–A.5.22** |

### 8.2 Bulud Təhlükəsizliyi

| Sahə | Layihədə tətbiqi |
|---|---|
| Obyekt anbarı | Versiyalama, dəyişməzlik/obyekt kilidi, server tərəfli şifrələmə |
| IAM və hesab təcridi | 3 ən-az-imtiyazlı subyekt; dondurma = deny-write siyasəti |
| Bulud jurnallaşdırması | Anbar giriş jurnalları + mərkəzi toplama + xəbərdarlıq |
| Monitorinq | Dəyişmə sürəti monitorinqi, canary tələləri |
| Məsuliyyətin bölüşdürülməsi | Provayder/müştəri vəzifələrinin matrisi (ISO 27017) |
| Şəbəkə seqmentasiyası | Monitor və cavabverici ayrı təhlükəsizlik zonalarında |

### 8.3 Kriptoqrafiyanın Əsasları

| Alqoritm / primitiv | Təyinat | Standart |
|---|---|---|
| SHA-256 | Fayl bütövlüyü | FIPS 180-4 |
| Heş zəncirləmə | Tampering aşkarlanması | — |
| AES-256-GCM | Ehtiyat nüsxə məxfiliyi + bütövlüyü (AEAD) | NIST SP 800-38D |
| Ed25519 / ECDSA P-256 | Sübutların təkzibolunmazlığı (imza) | FIPS 186-5 |
| HKDF / PBKDF2 | Açar törəməsi | SP 800-108 / RFC 8018 |
| CSPRNG | Düzgün nonce/IV və açar yaradılması | — |
| Sabit-vaxtlı müqayisə | Vaxt yan-kanal hücumlarının qarşısı | — |

### 8.4 NIST CSF 2.0 funksiyaları üzrə uyğunluq

| Funksiya | Layihənin töhfəsi |
|---|---|
| **İdarəetmə (Govern)** | Təhlükəsizlik siyasətləri, risk reyestri, kriptoqrafiya siyasəti |
| **Müəyyən etmə (Identify)** | Aktiv reyestri, təsnifat, təhdid modeli |
| **Qoruma (Protect)** | IAM ən-az-imtiyaz, şifrələmə, imzalama, dəyişməzlik |
| **Aşkarlama (Detect)** | Dəyişmə sürəti monitorinqi, canary tələ, bütövlük yoxlaması |
| **Cavab (Respond)** | Avtomatik dondurma, insident qeydi, sübut möhürləmə |
| **Bərpa (Recover)** | Yoxlanılan bərpa, DR planı, insidentdən sonrakı icmal |

### 8.5 Layihənin ISMS sənəd paketi

1. İnsidentə Cavab Planı (`INCIDENT_RESPONSE_PLAN.md`)
2. Fasiləsizlik Planı (BCP)
3. Fəlakətdən Bərpa Planı (DRP)
4. Risk Reyestri
5. Aktiv Reyestri və Təsnifatı
6. Sübutlarla İşləmə Siyasəti
7. Kriptoqrafiya Siyasəti
8. Nəzarət Uyğunluq Cədvəli (SoA) — maşın-oxuna bilən CSV

---

## 9. İstifadə olunan standartlar

- **ISO/IEC 27001:2022** — ISMS tələbləri; Əlavə A-da 4 mövzu üzrə 93 nəzarət
  (Təşkilati, İnsanlar, Fiziki, Texnoloji).
- **ISO/IEC 27017:2015** — bulud xidmətləri üçün təhlükəsizlik nəzarətləri.
- **NIST CSF 2.0 (2024)** — altı funksiya: Govern, Identify, Protect, Detect,
  Respond, Recover.
- **NIST SP 800-61** — insident idarəetmə təlimatı.
- **NIST SP 800-34** — fasiləsizlik planlaması (BCP/DRP əsası).
- **NIST SP 800-57 Pt.1 Rev.5** — açar idarəetməsi.
- **NIST SP 800-38D** — GCM/GMAC autentifikasiyalı şifrələmə.
- **FIPS 180-4** — SHA-256 heş standartı.
- **FIPS 186-5** — rəqəmsal imza standartı.
- **FIPS 203/204/205 (2024)** — post-kvant alqoritmlər (gələcək iş üçün).
- **OWASP ASVS / Top 10** — tətbiq təhlükəsizliyi yoxlaması.

---

## 10. İş planı və mərhələlər

Layihə 12 həftə (bir semestr) üçün planlaşdırılıb.

| Həftə | Mərhələ | Nəticə (deliverable) |
|---|---|---|
| 1 | Başlanğıc, əhatə dairəsi, tələblər, təhdid modeli | Təhdid modeli sənədi |
| 2 | ISMS boşluq təhlili və risk reyestri v1 | Risk reyestri |
| 3–4 | Anbarın qurulması + baseline heşləmə + Merkle kökü | `src/baseline/` + testlər |
| 5 | Monitorinq agenti (dəyişiklik siqnalları) | `src/monitor/` |
| 6–7 | Aşkarlama mühərriki (sürət + canary) + tənzimləmə eksperimenti | `src/detection/` + aşkarlama qrafiki |
| 8 | Avtomatik cavab (dondurma) + insident qeydi + imzalama | `src/response/` |
| 9 | Heş-zəncirli, imzalanmış audit jurnalı | `src/log/` |
| 10 | AES-256-GCM ehtiyat nüsxə + yoxlanılan bərpa | `src/backup/` + testlər |
| 11 | Başdan-başa demo + metrikalar + mənfi testlər | Demo skripti + nəticələr |
| 12 | ISMS sənəd paketi, yekun hesabat, təqdimat | Tam sənədlər + hesabat |

**Kritik yol:** baseline heşləmə → aşkarlama mühərriki → cavab → ehtiyat
nüsxə/bərpa. ISMS sənədləri 2-ci həftədən paralel gedir, çünki onlar hazır koddan
asılı deyil.

### Komanda və vəzifə bölgüsü (tək tələbə üçün)

| Rol | Vəzifə |
|---|---|
| Tərtibatçı (Kriptoqrafiya) | baseline, imzalama, AES-GCM, açar idarəetməsi |
| Tərtibatçı (Bulud) | anbar, IAM, dondurma, jurnallaşdırma |
| Analitik (ISMS) | risk reyestri, BCP/DRP, uyğunluq cədvəli, sübut siyasəti |
| Testçi | vahid + E2E + mənfi testlər |

---

## 11. Gözlənilən nəticələr

### 11.1 Texniki nəticələr

1. İşlək prototip: monitorinq → aşkarlama → dondurma → bərpa zənciri.
2. Kriptoqrafik modullar: `sha256File`, `merkleRoot`, `evaluate`,
   `encryptBlob/decryptBlob/verify`, imzalama.
3. Heş-zəncirli, imzalanmış insident jurnalı.
4. Vahid testlər və başdan-başa demo skripti.

### 11.2 İdarəetmə nəticələri

ISMS sənəd paketi (Bölmə 8.5), ISO 27001:2022 və NIST CSF 2.0 uyğunluq cədvəli,
risk reyestri qalıq risk dəyərləri ilə.

### 11.3 Nümayiş ssenarisi

Demo təkrarlana bilən, vizual və qısa (5 dəqiqədən az) olacaq:

1. **Hazırlıq.** 100 qorunan fayl + 3 canary faylı yerləşdirilir; baseline və
   imzalanmış Merkle kökü hesablanır.
2. **Normal fəaliyyət (kontrol).** 3 fayl dəyişir → sürət 3% → **NORMAL**.
3. **Qanuni kütləvi iş (kontrol).** 25 fayl 2 dəqiqə ərzində dəyişir → hədd
   aşılmır → **NORMAL** (yalançı-müsbət yoxdur).
4. **Simulyasiya edilmiş ransomware hücumu.** 82 fayl ~10 saniyə ərzində
   dəyişir + canary faylı toxunulur → **ŞÜBHƏLİ**, etibarlılıq ≈ 1.0.
5. **Avtomatik cavab.** Deny-write IAM siyasəti tətbiq olunur; zədələnmiş
   vəziyyət `evidence/`-ə snapshot edilir; `INC-2026-0001` imzalanır.
6. **Yoxlanılan bərpa.** AES-256-GCM ehtiyat nüsxələrindən bərpa; hər fayl
   yenidən heşlənir; Merkle kökü müqayisə edilir.
7. **Bütövlük sübutu.**
   ```
   Fayl:               files/report_q3.pdf
   Baseline SHA-256:   a3f1...9c
   Bərpa olunmuş:      a3f1...9c
   Merkle kökü uyğun:  BƏLİ
   Bütövlük:           VALID ✅
   ```
8. **Tampering testi (tampering aşkarlanmasının sübutu).** İnsident qeydində
   bir bayt əl ilə dəyişdirilir → imza yoxlaması uğursuz olur və heş zənciri
   pozulur:
   ```
   Zəncir yoxlaması: FAILED ❌  (1-ci qeyd prevHash uyğunsuzluğu)
   İmza:             INVALID ❌
   ```

Bu son addım demonun ən təsirli hissəsidir, çünki kriptoqrafiyanı *görünən*
edir.

---

## 12. Qiymətləndirmə meyarları

| № | Metrika | Hədəf | Ölçmə üsulu |
|---|---|---|---|
| M1 | Aşkarlama nisbəti (doğru müsbət) | ≥30% dəyişmə üçün ≥95% | Məlum sürətlərdə sintetik işlər |
| M2 | Yalançı-müsbət nisbəti | Normal/kütləvi işlərdə ≤5% | Kontrol işləri (addım 2–3) |
| M3 | Aşkarlama müddəti | Hücum başlamasından ≤60 saniyə | Vaxt fərqi |
| M4 | Dondurma effektivliyi | Dondurmadan sonra yazmaların 100%-i rədd | Dondurmadan sonrakı yazma cəhdləri |
| M5 | Ehtiyat nüsxə bütövlüyü | AEAD teq yoxlamasının 100%-i keçir | Toxunulmamış nüsxə üzərində bərpa testi |
| M6 | Bərpa düzgünlüyü | Faylların 100%-i VALID | Baseline ilə heş müqayisəsi |
| M7 | Tampering aşkarlanması | Dəyişdirilmiş qeydlərin 100%-i işarələnir | Qəsdən dəyişikliklər |
| M8 | Kripto modullarının test əhatəsi | Bütün ictimai funksiyalar test olunur | `node:test` hesabatı |
| M9 | Nəzarət uyğunluğu tamlığı | Tətbiq olunan Əlavə A nəzarətlərinin ≥90%-i sənədləşdirilir | SoA icmalı |

**TS1-in cavabı üçün eksperiment:** dəyişmə sürəti (1%, 5%, 10%, 20%, 30%, 50%,
80%) üzrə süpürgə aparılır və detektorun qərarı qeyd olunur — beləliklə
**aşkarlama nisbəti / yalançı-müsbət** əyrisi alınır və seçilmiş hədd əsaslandırılır.

---

## 13. Risk, fərziyyələr və məhdudiyyətlər

### 13.1 Layihə riskləri

| Risk | Təsir | Ehtimal | Azaltma tədbiri |
|---|---|---|---|
| Bulud provayderinin pulsuz limitləri | Orta | Orta | Lokal S3-uyğun emulyasiya (MinIO) ehtiyat variantı |
| Hədd tənzimləməsinin uzanması | Orta | Orta | Sadə izah edilə bilən qayda; bir həftə ilə məhdudlaşdırma |
| Əhatə dairəsinin genişlənməsi (entropy, dashboard) | Orta | Yüksək | Əhatəni dondurmaq; əlavələri Gələcək İşə keçirmək |
| Şifrələmə açarının itirilməsi | Yüksək | Aşağı | 1-ci gündən sənədləşdirilmiş, ehtiyatı alınmış sirr anbarı |
| Demo öncəsi pulsuz mühitin bitməsi | Yüksək | Aşağı | Ofllayn işləyən lokal emulyasiya rejimi |

### 13.2 Fərziyyələr

- Bulud anbarı versiyalama, obyekt kilidi və IAM siyasəti dəyişikliyini
  dəstəkləyir (bütün aparıcı provayderlər dəstəkləyir).
- Monitorinq agenti qorunan fayllara oxu girişinə malikdir və heşləri həddindən
  artıq xərc çəkmədən hesablaya bilir.
- Hücumçunun kütləvi-yazma davranışı qısa zaman pəncərəsində normal fəaliyyətdən
  həqiqi, aşkarlana bilən sapmadır.

### 13.3 Məhdudiyyətlər (dürüst şəkildə)

- **Aşkarlama evristikdir, mükəmməl deyil.** Yavaş, aşağı sürətli ("low-and-slow")
  ransomware dəqiqədə bir neçə fayl şifrələyərək sürət əsaslı detektordan yayına
  bilər. Entropiya təhlili və ya davranış bazalaması gələcək işdir.
- **Prototip tək-kirayəçidir (single-tenant).** Çox-kirayəçili açar ayrılması
  Gələcək İş bölməsindədir.
- **Aparat əsaslı açar saxlama** (HSM/KMS) prototipdə idarə olunan sirr anbarı
  ilə təmsil olunur, fiziki HSM ilə deyil.
- **Ransomware simulyatoru zərərsizdir**, ona görə nəticələr *detektoru* xarakterizə
  edir, real zərərli ailənin davranışını deyil.
- **Sübutların hüquqi qəbulediciliyi** sübut olunmur; yalnız texniki xassələr
  (bütövlük, həqiqilik, tampering aşkarlanması) nümayiş etdirilir.

### 13.4 Gələcək iş istiqamətləri

1. **Entropiya əsaslı aşkarlama** — dəyişmiş faylların Şennon entropiyasını
   hesablayıb ikinci, yüksək-etibarlılıqlı siqnal kimi əlavə etmək.
2. **Davranış bazalaması / ML** — hər faylın normal dəyişmə profilini öyrənmək.
3. **Çox-kirayəçili təcrid** — hər kirayəçi üçün ayrı açarlar və qovluqlar.
4. **Aparat əsaslı açar idarəetməsi** — real bulud KMS/HSM-in zərfləmə
   şifrələməsi ilə inteqrasiyası.
5. **Kripto-çeviklik və post-kvant hazırlığı** — imza/KEM qatını ML-DSA
   (FIPS 204) və ML-KEM (FIPS 203) üzərinə köçürülə bilən şəkildə abstraktlaşdırmaq.
6. **Avtomatlaşdırılmış hadisə orkestrasiyası** — SOAR tipli tam protokollar.
7. **Xarici dəyişməz lövbərləmə** — heş zənciri kökünü dövri olaraq yalnız-əlavə
   xarici lövhəyə lövbərləmək.

---

## 14. Nəticə

Bu layihə bulud anbarına qarşı ransomware hücumlarının real problemi üzərində
qurulmuşdur və üç fənni təbii şəkildə birləşdirir:

- **ISMS** baxımından — insident idarəetməsi, fasiləsizlik/fəlakət bərpası, risk
  və aktivlərin idarəetməsi ISO/IEC 27001:2022 və NIST CSF 2.0 çərçivəsində.
- **Bulud Təhlükəsizliyi** baxımından — obyekt anbarı, IAM ən-az-imtiyaz və hesab
  təcridi, dəyişməzlik, monitorinq və məsuliyyətin bölüşdürülməsi.
- **Kriptoqrafiya** baxımından — SHA-256, Merkle/heş zənciri, rəqəmsal imzalar,
  AES-256-GCM AEAD və açar idarəetməsi.

Layihə bir semestrdə tamamlana biləcək qədər sadə, eyni zamanda texniki cəhətdən
ciddi və nümayiş etdirilə biləndir. Ən əsası, o, kriptoqrafiyanı yalnız
"istifadə etdik" kimi deyil, **yoxlanıla bilən xassələrlə** (bütövlük, həqiqilik,
bərpa düzgünlüyü, tampering aşkarlanması) təqdim edir.

**Təklif olunan başlıq:** *Bulud Mühitində Ransomware Aşkarlama və Kriptoqrafik
Bərpa Sistemi (CloudRDR).*

---

## 15. İstinadlar

1. ISO/IEC 27001:2022 — *İnformasiya təhlükəsizliyi, kibertəhlükəsizlik və
   məxfilik mühafizəsi — İnformasiya təhlükəsizliyi idarəetmə sistemləri —
   Tələblər*.
2. ISO/IEC 27017:2015 — *Bulud xidmətləri üçün nəzarətlər kodu*.
3. NIST (2024) — *The NIST Cybersecurity Framework (CSF) 2.0*, NIST CSWP 29.
4. NIST SP 800-61 Rev. 2 — *Computer Security Incident Handling Guide*.
5. NIST SP 800-34 Rev. 1 — *Contingency Planning Guide for Information Systems*.
6. NIST SP 800-57 Pt. 1 Rev. 5 — *Recommendation for Key Management*.
7. NIST SP 800-38D — *GCM and GMAC*.
8. NIST FIPS 180-4 — *Secure Hash Standard (SHS)*.
9. NIST FIPS 186-5 — *Digital Signature Standard (DSS)*.
10. NIST FIPS 203 / 204 / 205 (2024) — ML-KEM / ML-DSA / SLH-DSA.
11. RFC 9106 — *Argon2*; RFC 8018 — *PBKDF2*.
12. OWASP — *Application Security Verification Standard (ASVS)*, *Top 10*.
13. NIST SP 800-145 — *The NIST Definition of Cloud Computing*.

---

## Əlavə A — İstifadə olunacaq texnologiyalar

| Qat | Seçim | Səbəb |
|---|---|---|
| İcra mühiti | Node.js 18+ (ES Modules) | Daxili `crypto` SHA-256, AES-GCM, imza verir |
| Anbar | Supabase Storage (pulsuz) və ya MinIO/S3 emulyasiyası | Versiyalama + IAM tipli siyasətlər |
| Verilənlər bazası | Supabase Postgres (pulsuz) | Baseline, insident qeydləri, RLS |
| Monitorinq | Node izləyici proses (sorğulama/webhook) | Sadə, sazlana bilən |
| İmzalama | Node `crypto.sign`/`verify` ilə Ed25519 | Sürətli, müasir, kiçik açarlar |
| CI | GitHub Actions və ya Jenkins | Təkrar qurulan build və testlər |
| Dashboard | HTML + Chart.js | Vizual, müəllim üçün rahat demo |

## Əlavə B — Bir səhifəlik xülasə

| Fənn | Nümayiş etdirilən əsas anlayış | Layihədəki sübut |
|---|---|---|
| **ISMS** | İnsident idarəetməsi, BCP/DRP, risk, aktiv təsnifatı, sübut | Bölmə 8.1, 8.5, ISMS sənəd paketi |
| **Bulud** | IAM ən-az-imtiyaz, hesab təcridi, dəyişməzlik, jurnallaşdırma | Bölmə 8.2, 7.4 |
| **Kriptoqrafiya** | SHA-256, heş zənciri, Ed25519 imza, AES-256-GCM AEAD | Bölmə 7.2, 7.5, 7.6, 8.3 |

**Bir cümləlik xülasə:** CloudRDR bulud fayllarının ransomware tipli kütləvi
dəyişməsini aşkarlayır, təsirlənmiş hesabı təcrid edir və məlumatı şifrələnmiş,
imzalanmış ehtiyat nüsxələrdən bərpa edir — SHA-256 heşləri, rəqəmsal imzalar və
AEAD ilə həm sübutların, həm də bərpa olunan məlumatın həqiqi və dəyişdirilməmiş
olduğunu sübut edir.

---

*Sənədin sonu.*