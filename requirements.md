# Requirements Document

## Introduction

Sistem WhatsApp Ticketing adalah fitur yang memungkinkan karyawan perusahaan melaporkan error pada aplikasi internal melalui pesan WhatsApp ke nomor khusus tim Application Support, tanpa perlu menginstal aplikasi baru. Pesan masuk secara otomatis dikonversi menjadi tiket di dalam aplikasi ticketing internal. Tim Application Support dapat melihat, mengelola, dan menugaskan tiket secara real-time melalui antarmuka web, menggantikan proses manual via forward pesan di grup WhatsApp.

---

## Glossary

- **Ticketing_System**: Aplikasi web internal yang digunakan oleh tim Application Support untuk mengelola tiket laporan error.
- **WhatsApp_Gateway**: Komponen yang menerima dan mengirim pesan melalui WhatsApp Business API ke nomor khusus tim Application Support.
- **Reporter**: Karyawan perusahaan yang mengirimkan laporan error melalui WhatsApp.
- **Staff**: Anggota tim Application Support yang bertugas menangani dan menyelesaikan tiket.
- **Supervisor**: Anggota tim Application Support dengan peran pengawas yang dapat mengelola penugasan tiket.
- **Tiket**: Representasi terstruktur dari laporan error yang diterima dari Reporter, tersimpan di dalam Ticketing_System.
- **Antrian_Tiket**: Daftar tiket yang belum di-assign ke Staff manapun.
- **Bot_Responder**: Komponen otomatis dalam Ticketing_System yang memberikan balasan pesan kepada Reporter melalui WhatsApp_Gateway.
- **Status_Tiket**: Kondisi terkini dari sebuah Tiket, dengan nilai: OPEN, IN_PROGRESS, RESOLVED, atau CLOSED.
- **Notifikasi**: Pesan yang dikirim oleh Ticketing_System kepada pihak terkait melalui WhatsApp atau antarmuka web.

---

## Requirements

### Requirement 1: Penerimaan Laporan Error via WhatsApp

**User Story:** Sebagai Reporter, saya ingin mengirimkan laporan error melalui WhatsApp ke nomor khusus tim Application Support, sehingga saya tidak perlu menginstal aplikasi baru untuk melaporkan masalah.

#### Acceptance Criteria

1. WHEN Reporter mengirim pesan teks ke nomor WhatsApp_Gateway, THE Ticketing_System SHALL menerima pesan tersebut dalam waktu maksimal 5 detik sejak pesan terkirim dari sisi Reporter.
2. WHEN pesan diterima dari nomor WhatsApp yang terdaftar sebagai karyawan, THE Ticketing_System SHALL membuat Tiket baru dengan Status_Tiket OPEN secara otomatis dan menghasilkan nomor Tiket unik berformat TKT-YYYYMMDD-NNNN.
3. WHEN pesan diterima dari nomor WhatsApp yang tidak terdaftar sebagai karyawan, THE Bot_Responder SHALL membalas dalam waktu maksimal 10 detik dengan pesan yang menyatakan bahwa nomor tersebut tidak dikenali dan menyertakan nama serta nomor kontak admin untuk pendaftaran.
4. WHEN Tiket berhasil dibuat, THE Bot_Responder SHALL mengirim konfirmasi ke Reporter dalam waktu maksimal 10 detik yang memuat: nomor Tiket, waktu penerimaan dalam format DD/MM/YYYY HH:MM, dan estimasi respons tim dalam 30 menit pada jam kerja (08.00-17.00 hari kerja).
5. IF WhatsApp_Gateway mengalami gangguan koneksi lebih dari 30 detik, THEN THE Ticketing_System SHALL mencatat kejadian tersebut ke log sistem dengan timestamp dan mengirim notifikasi kepada seluruh Supervisor yang sedang login.
6. IF Tiket gagal dibuat setelah pesan valid diterima, THEN THE Ticketing_System SHALL mencatat kegagalan ke log sistem dengan detail error dan mengirim notifikasi kepada Supervisor, serta THE Bot_Responder SHALL membalas Reporter dengan pesan permintaan maaf dan meminta Reporter mengirim ulang pesan.
7. WHEN Reporter mengirim pesan yang tidak mengandung konten teks (misalnya stiker atau reaksi emoji), THE Bot_Responder SHALL membalas dengan pesan yang meminta Reporter mengirim pesan dalam format teks.

---

### Requirement 2: Pengumpulan Informasi Laporan Terstruktur

**User Story:** Sebagai Reporter, saya ingin dipandu dalam menyampaikan informasi laporan secara terstruktur, sehingga tim Application Support mendapat informasi yang cukup untuk menangani masalah dengan cepat.

#### Acceptance Criteria

1. WHEN Tiket baru dibuat, THE Bot_Responder SHALL mengirim pesan panduan kepada Reporter yang meminta: (a) nama aplikasi yang bermasalah, (b) deskripsi error, dan (c) langkah-langkah untuk mereproduksi error.
2. WHEN Reporter membalas pesan panduan dengan ketiga informasi yang diminta yaitu (a) nama aplikasi, (b) deskripsi error, dan (c) langkah reproduksi, THE Ticketing_System SHALL melampirkan ketiga informasi tersebut ke Tiket yang sesuai dan memperbarui detail Tiket.
3. WHEN Reporter mengirim lampiran berupa gambar (format JPG, PNG, atau GIF, ukuran maksimal 5 MB) atau dokumen (format PDF atau DOCX, ukuran maksimal 10 MB) bersama pesan, THE Ticketing_System SHALL menyimpan lampiran tersebut dan menautkannya ke Tiket yang sesuai.
4. WHEN Reporter mengirim lampiran dengan format tidak didukung atau ukuran melebihi batas maksimal, THE Bot_Responder SHALL membalas dengan pesan yang menginformasikan format dan ukuran yang diperbolehkan, dan lampiran tersebut SHALL NOT disimpan ke Tiket.
5. IF Reporter tidak memberikan respons terhadap pesan panduan dalam 15 menit, THEN THE Bot_Responder SHALL mengirim pengingat sekali kepada Reporter bahwa laporan membutuhkan informasi tambahan.
6. IF Reporter tidak memberikan respons dalam 15 menit setelah pengingat dikirim, THEN THE Ticketing_System SHALL mengubah Status_Tiket menjadi CLOSED secara otomatis dengan keterangan "ditutup karena tidak ada respons dari Reporter" dan mencatat kejadian ke log sistem.
7. WHILE Tiket berada dalam Status_Tiket OPEN, THE Ticketing_System SHALL menerima dan menambahkan setiap pesan lanjutan dari Reporter ke riwayat Tiket yang sama.
8. WHEN Reporter mengirim pesan ke nomor WhatsApp_Gateway sementara Tiket terakhir miliknya berada dalam Status_Tiket IN_PROGRESS, RESOLVED, atau CLOSED, THE Bot_Responder SHALL membalas dengan informasi status Tiket terakhir dan nomor Tiket tersebut, serta menawarkan opsi untuk membuat laporan baru.

---

### Requirement 3: Tampilan Antrian Tiket Real-Time

**User Story:** Sebagai Staff, saya ingin melihat semua tiket yang masuk secara real-time di antarmuka web, sehingga tim dapat merespons laporan dengan cepat tanpa bergantung pada forward manual di grup WhatsApp.

#### Acceptance Criteria

1. WHILE pengguna yang terautentikasi mengakses halaman Antrian_Tiket, THE Ticketing_System SHALL menampilkan daftar Tiket yang diperbarui secara real-time tanpa memerlukan refresh halaman manual, mencakup Tiket baru yang masuk, perubahan Status_Tiket, dan perubahan penugasan Staff.
2. WHEN Tiket baru masuk, THE Ticketing_System SHALL menampilkan Tiket tersebut di Antrian_Tiket dalam waktu maksimal 3 detik setelah Tiket dibuat.
3. THE Ticketing_System SHALL menampilkan informasi berikut untuk setiap Tiket dalam daftar: nomor Tiket, nama Reporter, nama aplikasi, ringkasan deskripsi error (maksimal 150 karakter), Status_Tiket, waktu masuk, dan Staff yang ditugaskan (jika ada).
4. THE Ticketing_System SHALL menyediakan filter Antrian_Tiket berdasarkan Status_Tiket, nama aplikasi, Staff yang ditugaskan, dan rentang tanggal.
5. THE Ticketing_System SHALL menyediakan fitur pencarian Tiket berdasarkan nomor Tiket, nama Reporter, dan kata kunci pada deskripsi error dengan panjang minimal 3 karakter.
6. IF koneksi real-time antara browser pengguna dan Ticketing_System terputus, THEN THE Ticketing_System SHALL menampilkan pesan peringatan bahwa koneksi real-time sedang tidak aktif dan secara otomatis beralih ke mekanisme polling setiap 30 detik hingga koneksi pulih.
7. IF filter atau pencarian yang diterapkan tidak menghasilkan Tiket yang cocok, THEN THE Ticketing_System SHALL menampilkan pesan kosong yang menyatakan bahwa tidak ada Tiket yang sesuai dengan kriteria yang dipilih.

---

### Requirement 4: Penugasan Tiket ke Staff

**User Story:** Sebagai Supervisor, saya ingin menugaskan tiket ke Staff yang sesuai berdasarkan jenis error, sehingga penanganan menjadi lebih terstruktur dan dapat dilacak.

#### Acceptance Criteria

1. WHEN Supervisor membuka detail Tiket, THE Ticketing_System SHALL menampilkan daftar Staff dengan peran Staff dan status akun aktif yang tersedia untuk dipilih sebagai penanggung jawab Tiket.
2. WHEN Supervisor menugaskan Tiket yang berstatus OPEN ke seorang Staff, THE Ticketing_System SHALL mengubah Status_Tiket menjadi IN_PROGRESS dan mencatat waktu penugasan; WHEN Supervisor mengalihkan penugasan Tiket yang sudah berstatus IN_PROGRESS ke Staff lain, THE Ticketing_System SHALL mempertahankan Status_Tiket sebagai IN_PROGRESS dan mencatat waktu perubahan penugasan.
3. WHEN Tiket berhasil di-assign, THE Ticketing_System SHALL mengirim Notifikasi kepada Staff yang ditugaskan melalui antarmuka web dalam waktu maksimal 5 detik, yang memuat nomor Tiket, nama Reporter, nama aplikasi, dan deskripsi error.
4. WHEN Tiket berhasil di-assign, THE Bot_Responder SHALL mengirim pesan kepada Reporter yang menyatakan bahwa tiket sedang ditangani beserta nama Staff yang bertugas.
5. WHEN Supervisor mengalihkan penugasan Tiket dari satu Staff ke Staff lain, THE Ticketing_System SHALL mewajibkan Supervisor mengisi alasan pengalihan (maksimal 500 karakter, tidak boleh kosong atau hanya spasi) dan SHALL mencatat riwayat perubahan penugasan beserta alasan dan waktu perubahan.
6. IF Tiket dalam Status_Tiket OPEN belum di-assign dalam 30 menit sejak waktu pembuatan Tiket, THEN THE Ticketing_System SHALL mengirim Notifikasi pengingat kepada seluruh Supervisor yang sedang login.
7. IF Supervisor mencoba menugaskan Tiket kepada Staff dengan status akun tidak aktif atau akun yang tidak ditemukan pada saat konfirmasi, THEN THE Ticketing_System SHALL menolak penugasan tersebut, menampilkan pesan kesalahan kepada Supervisor, dan tidak mengubah Status_Tiket maupun data penugasan yang ada.

---

### Requirement 5: Pembaruan Status dan Penyelesaian Tiket

**User Story:** Sebagai Staff, saya ingin memperbarui status tiket dan mencatat resolusi yang dilakukan, sehingga Reporter dan Supervisor dapat memantau perkembangan penanganan secara transparan.

#### Acceptance Criteria

1. WHEN Staff membuka Tiket yang ditugaskan kepadanya dan Status_Tiket adalah IN_PROGRESS, THE Ticketing_System SHALL menampilkan tombol aksi untuk mengubah Status_Tiket ke RESOLVED saja; tombol untuk mengubah ke CLOSED SHALL NOT ditampilkan kepada Staff.
2. WHEN Staff mengubah Status_Tiket menjadi RESOLVED, THE Ticketing_System SHALL mewajibkan Staff mengisi catatan resolusi dengan panjang antara 10 hingga 2000 karakter (tidak boleh kosong atau hanya terdiri dari spasi) sebelum perubahan status disimpan.
3. WHEN Status_Tiket berubah menjadi RESOLVED, THE Bot_Responder SHALL mengirim pesan kepada Reporter yang memuat ringkasan resolusi dan meminta konfirmasi dengan membalas kata "YA" jika masalah telah terselesaikan.
4. WHEN Reporter membalas dengan kata "YA" (tidak peka huruf kapital) ke nomor WhatsApp_Gateway dan Status_Tiket saat itu masih RESOLVED, THE Ticketing_System SHALL mengubah Status_Tiket menjadi CLOSED secara otomatis.
5. IF Reporter tidak membalas konfirmasi dalam 24 jam setelah Status_Tiket menjadi RESOLVED, THEN THE Ticketing_System SHALL mengubah Status_Tiket menjadi CLOSED secara otomatis dan mencatat keterangan "auto-closed: tidak ada konfirmasi dari Reporter".
6. WHILE Tiket berada dalam Status_Tiket CLOSED, THE Ticketing_System SHALL mencegah perubahan status oleh Staff; hanya Supervisor yang dapat mengubah Status_Tiket CLOSED menjadi IN_PROGRESS untuk membuka kembali penanganan.

---

### Requirement 6: Riwayat Percakapan dan Audit Trail

**User Story:** Sebagai Supervisor, saya ingin melihat seluruh riwayat komunikasi dan perubahan pada setiap tiket, sehingga saya dapat melakukan audit dan evaluasi kualitas penanganan.

#### Acceptance Criteria

1. THE Ticketing_System SHALL menyimpan seluruh pesan teks WhatsApp antara Reporter dan Bot_Responder dalam riwayat Tiket secara kronologis berdasarkan waktu pengiriman pesan.
2. THE Ticketing_System SHALL mencatat setiap perubahan Status_Tiket dengan menyertakan: Status_Tiket sebelumnya, Status_Tiket baru, nama pengguna yang melakukan perubahan, dan waktu perubahan hingga presisi detik.
3. THE Ticketing_System SHALL mencatat setiap perubahan penugasan Tiket dengan menyertakan: nama Staff sebelumnya (atau label "Belum Ditugaskan" jika belum pernah ada penugasan), nama Staff baru, nama Supervisor yang melakukan perubahan, dan waktu perubahan hingga presisi detik.
4. WHEN Supervisor mengakses detail Tiket, THE Ticketing_System SHALL menampilkan riwayat yang menggabungkan seluruh entri berikut dalam satu daftar kronologis: pesan teks WhatsApp dari Reporter, pesan balasan dari Bot_Responder, perubahan Status_Tiket, dan perubahan penugasan Staff.
5. THE Ticketing_System SHALL menyimpan data riwayat Tiket selama minimal 365 hari sejak tanggal pembuatan Tiket, terlepas dari Status_Tiket saat ini.
6. THE Ticketing_System SHALL mencegah penghapusan atau pengubahan entri yang sudah tersimpan dalam riwayat percakapan dan audit trail; setiap entri SHALL bersifat immutable setelah disimpan.

---

### Requirement 7: Manajemen Pengguna dan Otentikasi

**User Story:** Sebagai Supervisor, saya ingin mengelola daftar pengguna yang berwenang mengakses sistem dan mengatur hak akses masing-masing, sehingga keamanan dan ketertelusuran tindakan dalam sistem terjaga.

#### Acceptance Criteria

1. THE Ticketing_System SHALL membatasi akses antarmuka web hanya kepada pengguna yang telah terautentikasi menggunakan kombinasi nama pengguna dan kata sandi yang cocok dengan data terdaftar di sistem.
2. WHEN pengguna gagal melakukan login sebanyak 5 kali berturut-turut, THE Ticketing_System SHALL mengunci akun pengguna tersebut selama 15 menit, mencatat kejadian ke log sistem, dan secara otomatis membuka kunci akun setelah periode 15 menit berakhir.
3. THE Ticketing_System SHALL mendukung dua peran pengguna: Staff dan Supervisor, dengan hak akses yang berbeda sesuai peran masing-masing.
4. WHERE pengguna memiliki peran Supervisor, THE Ticketing_System SHALL memberikan akses ke fitur manajemen penugasan, manajemen pengguna, dan laporan kinerja.
5. WHERE pengguna memiliki peran Staff, THE Ticketing_System SHALL membatasi akses hanya pada Tiket yang ditugaskan kepada Staff tersebut dan Antrian_Tiket yang belum di-assign, termasuk kemampuan melihat dan mengklaim Tiket dari Antrian_Tiket.
6. WHEN Reporter dengan nomor WhatsApp terdaftar mengirim pesan ke WhatsApp_Gateway, THE Ticketing_System SHALL menerima dan memproses pesan tersebut; WHEN pesan diterima dari nomor yang tidak terdaftar, THE Bot_Responder SHALL membalas bahwa nomor tersebut tidak dikenali dan menyertakan informasi kontak admin untuk pendaftaran.

---

### Requirement 8: Notifikasi dan Peringatan Proaktif

**User Story:** Sebagai Staff, saya ingin menerima notifikasi secara proaktif ketika ada tiket baru atau pembaruan pada tiket yang relevan, sehingga saya dapat merespons dengan cepat tanpa harus terus memantau antarmuka.

#### Acceptance Criteria

1. WHEN Tiket baru masuk dan belum di-assign, THE Ticketing_System SHALL menampilkan notifikasi visual berupa badge penghitung pada ikon notifikasi di antarmuka web kepada semua Staff dan Supervisor yang sedang login dalam waktu tidak lebih dari 5 detik setelah tiket masuk.
2. WHEN Tiket di-assign kepada seorang Staff, THE Ticketing_System SHALL menampilkan notifikasi visual berupa badge penghitung pada ikon notifikasi di antarmuka web kepada Staff yang bersangkutan dalam waktu tidak lebih dari 5 detik setelah assignment dilakukan.
3. WHEN Reporter menambahkan pesan baru ke Tiket yang sedang IN_PROGRESS, THE Ticketing_System SHALL menampilkan notifikasi visual berupa badge penghitung pada ikon notifikasi di antarmuka web kepada Staff yang ditugaskan dalam waktu tidak lebih dari 5 detik setelah pesan dikirim.
4. IF Tiket dalam Status_Tiket IN_PROGRESS tidak mengalami penambahan pesan atau perubahan status apapun selama 4 jam kerja berturut-turut (dihitung berdasarkan jam operasional 08.00-17.00 pada hari kerja Senin-Jumat), THEN THE Ticketing_System SHALL mengirim Notifikasi pengingat kepada Staff yang ditugaskan dan Supervisor.
5. THE Ticketing_System SHALL memungkinkan setiap Staff mengatur preferensi notifikasi untuk mengaktifkan atau menonaktifkan secara terpisah setiap jenis notifikasi berikut: tiket baru belum di-assign, tiket di-assign kepada saya, pesan baru pada tiket saya, dan pengingat tiket stagnan.
6. WHEN Staff yang sebelumnya tidak sedang login mengakses antarmuka web, THE Ticketing_System SHALL menampilkan seluruh notifikasi yang belum dibaca yang dihasilkan selama Staff tersebut tidak login, sesuai preferensi notifikasi yang aktif.

---

### Requirement 9: Laporan dan Rekap Kinerja

**User Story:** Sebagai Supervisor, saya ingin melihat laporan kinerja tim dalam menangani tiket, sehingga saya dapat mengidentifikasi tren masalah dan mengevaluasi efektivitas tim.

#### Acceptance Criteria

1. WHEN Supervisor memilih rentang tanggal (maksimal 365 hari) dan meminta laporan, THE Ticketing_System SHALL menampilkan jumlah Tiket yang dikelompokkan berdasarkan Status_Tiket, nama aplikasi, dan Staff yang menangani dalam rentang waktu yang dipilih.
2. WHEN Supervisor memilih rentang tanggal dan meminta laporan, THE Ticketing_System SHALL menghitung dan menampilkan rata-rata first response time (waktu dari Tiket dibuat hingga pertama kali di-assign) khusus untuk Tiket yang telah di-assign setidaknya satu kali dalam rentang waktu yang dipilih.
3. WHEN Supervisor memilih rentang tanggal dan meminta laporan, THE Ticketing_System SHALL menghitung dan menampilkan rata-rata resolution time (waktu dari Tiket dibuat hingga Status_Tiket menjadi RESOLVED) khusus untuk Tiket dengan Status_Tiket RESOLVED dalam rentang waktu yang dipilih.
4. WHEN Supervisor meminta ekspor laporan, THE Ticketing_System SHALL menghasilkan file dalam format CSV yang dapat diunduh dalam waktu maksimal 30 detik.
5. WHEN Supervisor memilih rentang tanggal dan meminta laporan, THE Ticketing_System SHALL menampilkan daftar 10 aplikasi teratas yang paling sering dilaporkan mengalami error, diurutkan secara descending berdasarkan jumlah Tiket dalam rentang waktu yang dipilih.
6. IF tidak ada Tiket yang ditemukan dalam rentang tanggal yang dipilih, THEN THE Ticketing_System SHALL menampilkan pesan yang menyatakan bahwa tidak ada data tiket pada periode tersebut, tanpa menampilkan tabel kosong atau nilai nol yang menyesatkan.

---

### Requirement 10: Manajemen Pelapor WhatsApp (Reporters Management)

**User Story:** Sebagai Supervisor, saya ingin mengelola daftar pelapor WhatsApp (karyawan/user terdaftar) melalui antarmuka web dashboard, sehingga saya dapat mendaftarkan, memperbarui, dan mengaktifkan/menonaktifkan nomor HP pelapor tanpa harus mengakses database secara langsung.

#### Acceptance Criteria

1. WHEN Supervisor membuka halaman Manajemen Pelapor WA, THE Ticketing_System SHALL menampilkan daftar seluruh Pelapor terdaftar beserta nama, nomor telepon, status aktif/non-aktif, dan tanggal dibuat.
2. WHEN Supervisor mendaftarkan Pelapor baru dengan nomor telepon dan nama yang valid, THE Ticketing_System SHALL menyimpan data Pelapor baru tersebut dan mengizinkan pesan WhatsApp dari nomor tersebut untuk diproses sebagai tiket.
3. WHEN Supervisor mengubah status aktif/non-aktif seorang Pelapor, THE Ticketing_System SHALL langsung memperbarui status Pelapor tersebut dan menolak pesan WhatsApp jika statusnya non-aktif.
4. THE Ticketing_System SHALL menyediakan fitur pencarian Pelapor berdasarkan nama atau nomor telepon.