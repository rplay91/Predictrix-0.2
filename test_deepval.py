from deepeval import assert_test
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams



## how to use : deepeval test run test_deepval.py

def test_case():
    correctness_metric = GEval(
        name="Correctness",
        criteria=(
       """Keselarasan Semantik (Semantic Alignment):
Kalimat yang diprediksi harus akurat secara faktual dan selaras secara semantik dengan kalimat yang diharapkan (EXPECTED_OUTPUT). Variasi kecil dalam pilihan kata dapat diterima selama makna inti tetap tidak berubah.

Kepatuhan terhadap Prompt (Prompt Adherence):
Kalimat yang diprediksi harus mengikuti penulisan, nada, dan instruksi yang diberikan dalam prompt input (INPUT). Hal ini mencakup menjaga konsistensi dalam pemilihan kosakata, struktur kalimat, serta pedoman gaya yang disebutkan.

Koherensi Logis (Logical Coherence):
Kalimat yang diprediksi harus konsisten secara logis dan tidak boleh memperkenalkan kontradiksi, informasi yang salah, atau halusinasi."""
    ),
        evaluation_params=[LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
        threshold=0.5555
    )
    test_case = LLMTestCase(
        input="""
       # Instruksi:
Anda adalah asisten penulisan AI yang khusus memprediksi sebuah kalimat di dalam esai bahasa Indonesia pengguna.
Tugas Anda adalah menghasilkan SATU kalimat prediksi berdasarkan konteks lengkap yang diberikan.
Kalimat tersebut harus selaras dengan **topik inti** esai, sebagaimana didefinisikan oleh Judul dan Konteks, dan tidak boleh menyimpang dari subjek utama.
Berpikirlah langkah demi langkah!

# Detail Input:
- Judul Esai: Judul mendefinisikan topik inti esai dan menetapkan arah keseluruhan.
- Informasi Kontekstual: Deskripsi latar dan kata kunci yang mewakili maksud esai serta perspektif audiens.
- Isi Esai: Teks esai lengkap, dengan satu paragraf yang berisi penanda [PREDICTED SENTENCE], yaitu lokasi penyisipan kalimat.
- Tujuan Penulisan: Niat atau tujuan penambahan kalimat prediksi.
- Pola Penulisan: Struktur pengorganisasian esai.
- Fitur Penulisan: Nada stilistika dan linguistik.
- Pola Kalimat: Struktur gramatikal kalimat yang ditetapkan.
- Detail Peningkatan: Detail tambahan penulisan yang diambil dari draf saat ini dan draf sebelumnya.
- Konteks Kosakata Terekstrak: Kata dan ungkapan yang sering muncul dalam esai, mencerminkan nada dan konsistensi leksikal.

# Struktur Input:
Judul Esai:
Essay - Andreas Samuel Manullang

Informasi Kontekstual:
Context Infomation 1:
Keywords: Dengan begitu, hari itu pun berakhir dengan penuh aktivitas dan persiapan untuk hari-hari berikutnya.
Description: prediksi yang benar



Informasi Kontekstual:
Context Infomation 1:
Keywords: Dengan begitu, hari itu pun berakhir dengan penuh aktivitas dan persiapan untuk hari-hari berikutnya.
Description: prediksi yang benar



Informasi Kontekstual:
Context Infomation 1:
Keywords: Dengan begitu, hari itu pun berakhir dengan penuh aktivitas dan persiapan untuk hari-hari berikutnya.
Description: prediksi yang benar



Isi Esai:
Pada tanggal 30 Desember 2025, aku memulai hariku dengan tidur di kos pada pukul 00:00. Setelah seharian beraktivitas, aku merasa lelah dan penting untuk istirahat agar bisa bangun segar dan produktif keesokan harinya. Sebelum tidur, aku memastikan alarm sudah disetel dan menyusun daftar tugas untuk hari berikutnya. Dengan lampu yang dimatikan, aku berusaha tidur nyenyak dengan pikiran yang tenang.

Namun, pada pukul 01:00, aku masih terlelap. Jam masih dini hari, dan aku butuh istirahat cukup agar bisa bangun dengan tubuh segar. Begitu juga pada pukul 02:00 dan 03:00, aku masih menikmati tidur nyenyak, memastikan tubuh dan pikiran siap menghadapi aktivitas hari ini. 

Sekitar pukul 04:00, aku terbangun sejenak, melihat jam dan menyadari bahwa masih ada waktu sebelum harus bangun beneran. Aku memanfaatkan waktu itu untuk tidur lagi agar lebih segar nanti. Akhirnya, pada pukul 05:00, aku bangun dan langsung bersiap-siap untuk memulai hari. Hari ini adalah hari kerja, dan aku ingin memulai aktivitas lebih awal agar bisa mencapai target belajar yang sudah kususun. Aku mandi dan membuat sarapan ringan agar tetap berenergi.

Setelah sarapan, pada pukul 06:00, aku mengecek jadwal kuliah online dan bersiap untuk ikut kelas pagi. Aku ingin memastikan semuanya siap agar tidak ketinggalan materi penting. Dengan membuka laptop dan memastikan koneksi internet stabil, aku menyiapkan catatan serta alat tulis yang dibutuhkan. Pada pukul 07:00, aku berjemur sebentar di balkon kos sambil menikmati kopi pagi. Momen pagi yang tenang ini sangat penting untuk mengisi energiku sebelum hari sibuk dimulai.

Pukul 08:00, aku mulai kelas online di laptop sambil menikmati sarapan pagi. Aku ingin mengikuti pelajaran accounting education dengan baik agar bisa mencapai target nilai yang diinginkan. Setelah kelas selesai, pada pukul 09:00, aku memutuskan untuk membuat jurnal progres target belajar mingguan. Ini penting untuk mengevaluasi pencapaian belajarku dan memastikan semua target minggu ini tercapai.

Selanjutnya, pada pukul 10:00, aku mulai mempersiapkan presentasi untuk tugas kelompok yang akan dipresentasikan minggu depan. Aku ingin memastikan bahan presentasiku sudah siap, sehingga kelompokku bisa melakukan revisi jika diperlukan. Pukul 11:00, aku melanjutkan presentasi tugas kelompok sambil menyelesaikan satu bab materi akuntansi untuk ujian minggu depan. Aku merasa ada beberapa poin yang bisa diperbaiki dalam presentasi dan ingin memastikan sudah mempelajari materi ujian agar lebih siap.

Setelah itu, pada pukul 12:00, aku makan siang untuk istirahat sebentar dan menyegarkan pikiran setelah mengerjakan tugas. Perutku mulai keroncongan, dan ini waktu yang tepat untuk sejenak melepaskan lelah. Pukul 13:00, aku berencana ikut diskusi online dengan teman-teman kuliah untuk mempersiapkan tugas kelompok. Diskusi ini penting untuk memastikan kami semua berada di jalur yang benar.

Pada pukul 14:00, aku menonton video tentang teknik belajar akuntansi di YouTube. Aku ingin mencari metode belajar yang lebih efektif. Kemudian, pada pukul 15:00, aku membuat tracker harian untuk memantau perkembangan tugas yang harus selesai minggu ini. Ini penting agar semua tugas menjelang akhir tahun ini dapat selesai tepat waktu.

Pukul 16:00, aku bersepeda sore mengeksplorasi area sekitar dan menikmati udara segar untuk melepas stres. Setelah berolahraga, pada pukul 17:00, aku video call dengan temanku, Dimas, untuk diskusi santai tentang rencana tahun baru. Kami berbincang-bincang sambil menggali ide-ide untuk menyambut tahun baru.

Setelah itu, pada pukul 18:00, aku menonton film favorit di kamar untuk bersantai sebelum memulai aktivitas baru keesokan harinya. Pukul 19:00, aku video call dengan teman satu jurusan membahas kemampuan terbaik di beberapa mata kuliah sebelum libur akhir tahun. Ini penting untuk menyiapkan rencana perbaikan di semester depan.

Pada pukul 20:00, aku menonton film komedi di laptop untuk mengendurkan pikiran setelah sesi video call yang intens. Kemudian, pada pukul 21:00, aku membuat jadwal belajar sore esok hari untuk mengatasi kelemahan di mata kuliah tertentu. Aku merasa perlu mempersiapkan diri lebih baik agar bisa mencapai target nilai.

Akhirnya, pada pukul 22:00, aku menonton film favorit di laptop untuk mengakhiri hari dengan santai. Sebelum tidur, pada pukul 23:00, aku berbaring di kasur sambil mengecek media sosial di ponsel, melihat update dari teman-teman dan mencari hiburan ringan setelah seharian yang sibuk.[PREDICTED SENTENCE]

Tujuan Penulisan:
Tujuan kalimat prediksi adalah memperkenalkan ide selanjutnya yang akan dibahas dalam paragraf berikutnya.

Pola Penulisan:
Pattern 1:
Type: Naratif
Explanation: Pola penulisan naratif ini menekankan pada alur waktu, menggambarkan aktivitas harian penulis dengan detail dan urutan yang jelas. Informasi disajikan secara berurutan berdasarkan waktu, memberikan gambaran menyeluruh tentang rutinitas penulis sepanjang hari.
Pattern: Setiap paragraf umumnya mengikuti struktur waktu yang berurutan, mulai dari bangun tidur hingga kegiatan sebelum tidur, dengan menyertakan waktu spesifik untuk setiap aktivitas. Penggunaan kata keterangan waktu berulang juga membantu menjaga ritme narasi.
Example: Pada pukul 00:00, aku memulai malam dengan tidur di kos... Sekitar pukul 01:00, saya memanfaatkan waktu malam untuk refleksi dan menenangkan pikiran dengan membaca buku.


Fitur Penulisan:
Feature 1:
Type: Kosakata
Explanation: Kosakata yang digunakan penulis cukup beragam, dengan pencampuran bahasa formal dan informal. Terdapat penggunaan istilah teknis yang berhubungan dengan akademis, serta frasa yang bersifat reflektif dan casual.
Example: Pada pukul 00:00, aku memulai hariku dengan merancang target belajarku untuk semester depan. Kegiatan ini aku lakukan sendiri di kamar kos.
Preferred Words: target, progres, refleksi, santai, belajar, tugas, kegiatan, aktivitas, tracker, metrik
Preferred Syntax: Penggunaan kalimat kompleks dan kalimat sederhana secara berselang, sering kali menggabungkan elemen deskriptif dan naratif untuk membangun konteks.

Feature 2:
Type: Struktur Kalimat
Explanation: Struktur kalimat cenderung panjang dengan penggunaan banyak subordinasi. Penulis menggunakan kalimat kompleks yang menggabungkan beberapa ide dalam satu kalimat, ini mencerminkan pemikiran yang terorganisir dan terencana.
Example: Aku memulai aktivitas pagi ini dengan melepas rasa kantuk semalam, menjalani rutinitas mandi, dan menyiapkan sarapan ringan untuk dinikmati sebelum berangkat.
Preferred Words: menyiapkan, memulai, menikmati, menjalani, memastikan
Preferred Syntax: Sering menggunakan kalimat majemuk dengan beberapa klausa, yang memperkuat narasi, seperti:  "Setelah menyelesaikan rutinitas pagi, aku terbangun dan mempersiapkan diri untuk berangkat ke kampus."

Feature 3:
Type: Ritme dan alur
Explanation: Penulis menjaga ritme narasi dengan mengikuti urutan waktu yang konsisten, dari awal hingga akhir hari. Pergantian antara kegiatan belajar dan aktivitas santai menciptakan alur yang dinamis, membantu pembaca mengikuti perjalanan sehari-hari penulis.
Example: Pukul 20:00, aku menonton film komedi di laptop untuk mengendurkan pikiran setelah sesi video call yang intens. Kemudian, pada pukul 21:00, aku membuat jadwal belajar sore esok hari untuk mengatasi kelemahan di mata kuliah tertentu.
Preferred Words: aktivitas, mengikuti, menonton, merencanakan, menemui
Preferred Syntax: Memanfaatkan transisi antar kalimat dengan penghubung waktu, seperti 'setelah itu', 'kemudian', atau 'selanjutnya', untuk menciptakan kerangka yang logis dalam narasi.


Pola Kalimat:
Type: kalimat prediksi naratif
Explanation: Ringkas, mengacu pada gaya keseharian yang terstruktur, menghubungkan kejadian hari ini dengan topik berikutnya tanpa mengulang detail berlebih.
Example: "Selanjutnya, aku akan mencoba mengintegrasikan metode belajar yang lebih efisien untuk memperkuat progres minggu ini."
Pattern: pola klausa utama yang mengarahkan ke ide berikutnya, menggunakan kata hubung yang mengindikasikan kelanjutan (selanjutnya, berikutnya, kemudian) tanpa menyebut kejadian rinci.
Function: mengarahkan pembaca ke paragraf berikutnya dengan transisi mulus yang mempertahankan ritme narasi kebiasaan sehari-hari.

Detail Peningkatan:






# Tugas Anda:
1. **Fokus pada Topik Inti:**
   - Pastikan kalimat prediksi secara langsung mendukung topik inti esai sesuai Judul dan Informasi Kontekstual.
   - Identifikasi peran kalimat prediksi (memperkenalkan ide, memberikan bukti, memberi transisi, atau merangkum poin).
   - Hindari memasukkan ide yang tidak terkait atau menyimpang.

2. **Perkuat Alur Logis:**
   - Kalimat prediksi harus terhubung mulus dengan kalimat sebelum dan sesudahnya.
   - Gunakan kata atau frasa transisi jika diperlukan untuk memperbaiki alur.

3. **Hindari Redundansi:**
   - JANGAN mengulang atau memparafrase ide yang sudah ada di esai.
   - Periksa kemiripan semantik (bukan hanya teks permukaan).

4. **Pertahankan Akurasi Logis:**
   - Kalimat prediksi TIDAK BOLEH memperkenalkan informasi yang salah atau kontradiktif.

5. **Konsistensi Kontekstual:**
   - Selaraskan kalimat Anda dengan latar, nada, dan implikasi dunia nyata yang sudah ditetapkan dalam esai.
   - Gunakan informasi kontekstual dan kosakata terekstrak untuk menjaga kohesi leksikal.

6. **Integrasi Alami:**
   - Kalimat harus memperkuat alur paragraf, menghubungkan ide secara logis, dan terdengar alami.

7. **Jaga Konsistensi Gaya:**
   - Samakan nada dan pilihan leksikal yang digunakan dalam esai.
   - Hindari pergeseran figuratif atau emosional kecuali memang sudah ada.

8. **Keluarkan hanya SATU Kalimat.**

Sederhanakan kalimat PASTIKAN kalimatnya ringkas dan tidak terlalu panjang.
Sederhanakan kalimat PASTIKAN kalimatnya ringkas dan tidak terlalu panjang.
Sederhanakan kalimat PASTIKAN kalimatnya ringkas dan tidak terlalu panjang.
JANGAN TERLALU BERTELE-TELE.


""",
        # Replace this with the actual output from your LLM application
        actual_output="Hari itu ditutup dengan aktivitas yang padat dan persiapan untuk keesokan harinya.",
        expected_output=" Dengan begitu, hari itu pun berakhir dengan penuh aktivitas dan persiapan untuk hari-hari berikutnya.",
        #retrieval_context=["All customers are eligible for a 30 day full refund at no extra costs."]
        
    )
    assert_test(test_case, [correctness_metric])