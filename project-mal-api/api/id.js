const axios = require('axios');
const cheerio = require('cheerio');

async function ambilDataAnimeGodVersionV3(id) {
    try {
        const respon = await axios.get(`https://myanimelist.net/anime/${id}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 15000
        });
        const $ = cheerio.load(respon.data);

        // Helper: balik "Lastname, Firstname" jadi "Firstname Lastname"
        const balikNama = (nama) => {
            if (!nama || nama === 'Unknown') return nama;
            const parts = nama.split(',').map(s => s.trim());
            return parts.length === 2 ? `${parts[1]} ${parts[0]}` : nama;
        };

        const judul = $('h1.title-name').text().trim();
        const sinopsis = $('p[itemprop="description"]').text().trim();

        // BUG FIX #1: Skor bisa dari dua selector berbeda
        const skor = $('div.score-label').first().text().trim() ||
                     $('span[itemprop="ratingValue"]').first().text().trim() ||
                     'N/A';

        const coverUrl = $('meta[property="og:image"]').attr('content') ||
                         $('img[itemprop="image"]').attr('data-src') ||
                         $('img[itemprop="image"]').attr('src');

        // Trailer YouTube
        let trailerYoutubeUrl = 'N/A';
        const linkEmbedYoutube = $('a.iframe.js-fancybox-video').attr('href') ||
                                  $('iframe.youtube-preview').attr('src');
        if (linkEmbedYoutube) {
            const cocokId = linkEmbedYoutube.match(/(?:embed\/|v=)([^?&"]+)/);
            if (cocokId && cocokId[1]) {
                trailerYoutubeUrl = `https://www.youtube.com/watch?v=${cocokId[1]}`;
            }
        }

        let judulInggris = 'N/A', judulJepang = 'N/A', judulSinonim = 'N/A';
        let tipe = 'Unknown', episode = 'Unknown', statusAsli = 'Unknown';
        let tanggalRilis = 'Unknown', musimRilis = 'Unknown', durasi = 'Unknown';
        let ratingUmur = 'Unknown', sumberAdaptasi = 'Unknown';
        let popularitas = 'Unknown', totalMembers = 'Unknown', ranking = 'Unknown';
        let studio = 'None', produser = 'None', lisensor = 'None';
        let scoredBy = 'Unknown';
        let daftarGenre = [];

        $('.spaceit_pad').each((i, elemen) => {
            const teksElemen = $(elemen).text().trim();

            if (teksElemen.startsWith('English:')) judulInggris = teksElemen.replace('English:', '').trim();
            else if (teksElemen.startsWith('Japanese:')) judulJepang = teksElemen.replace('Japanese:', '').trim();
            else if (teksElemen.startsWith('Synonyms:')) judulSinonim = teksElemen.replace('Synonyms:', '').trim();
            else if (teksElemen.startsWith('Type:')) tipe = teksElemen.replace('Type:', '').trim();
            else if (teksElemen.startsWith('Episodes:')) episode = teksElemen.replace('Episodes:', '').trim();
            else if (teksElemen.startsWith('Status:')) statusAsli = teksElemen.replace('Status:', '').trim().toLowerCase();
            else if (teksElemen.startsWith('Aired:')) tanggalRilis = teksElemen.replace('Aired:', '').trim();
            else if (teksElemen.startsWith('Premiered:')) musimRilis = $(elemen).find('a').text().trim() || teksElemen.replace('Premiered:', '').trim() || 'Unknown';
            else if (teksElemen.startsWith('Duration:')) durasi = teksElemen.replace('Duration:', '').trim();
            else if (teksElemen.startsWith('Rating:')) ratingUmur = teksElemen.replace('Rating:', '').trim();
            else if (teksElemen.startsWith('Source:')) sumberAdaptasi = teksElemen.replace('Source:', '').trim();
            else if (teksElemen.startsWith('Popularity:')) popularitas = teksElemen.replace('Popularity:', '').trim();
            else if (teksElemen.startsWith('Members:')) totalMembers = teksElemen.replace('Members:', '').trim();
            else if (teksElemen.startsWith('Ranked:')) {
                // BUG FIX #2: Ranking punya noise teks "Ranked:#1 2N/A" dsb, perlu dibersihkan
                const rawRanking = teksElemen.replace('Ranked:', '').trim();
                const matchRank = rawRanking.match(/#?\d+/);
                ranking = matchRank ? matchRank[0] : rawRanking.split('\n')[0].trim();
            }
            else if (teksElemen.startsWith('Studios:')) studio = $(elemen).find('a').map((j, a) => $(a).text().trim()).get().join(' | ') || 'None';
            else if (teksElemen.startsWith('Licensors:')) lisensor = $(elemen).find('a').map((j, a) => $(a).text().trim()).get().join(' | ') || 'None';
            else if (teksElemen.startsWith('Producers:')) {
                const listProd = $(elemen).find('a').map((j, a) => $(a).text().trim()).get();
                produser = listProd.length > 0 ? listProd.join(' | ') : 'None';
            }
            else if (teksElemen.startsWith('Genres:') || teksElemen.startsWith('Genre:')) {
                $(elemen).find('a').each((j, a) => { daftarGenre.push($(a).text().trim()); });
            }
            else if (teksElemen.includes('scored by')) {
                // BUG FIX #3: Fallback selector untuk scoredBy
                scoredBy = $(elemen).find('span[itemprop="ratingCount"]').text().trim() ||
                           $(elemen).find('strong').text().trim() ||
                           teksElemen.match(/scored by ([\d,]+)/i)?.[1] ||
                           'Unknown';
            }
        });

        let statusCustom = 'Unknown';
        if (statusAsli.includes('finished airing')) statusCustom = 'Complete';
        else if (statusAsli.includes('currently airing')) statusCustom = 'Ongoing';
        else if (statusAsli.includes('not yet aired')) statusCustom = 'Belum Tayang';

        // BUG FIX #4: Selector karakter MAL yang benar
        // MAL pakai struktur: div.detail-characters-list > div > table (bukan langsung > table)
        let listKarakterLengkap = [];

        $('div.detail-characters-list').first().find('table').each((i, table) => {
            if (listKarakterLengkap.length >= 10) return false;

            // Nama karakter: ada di td kedua, di dalam h3 atau a tag
            const namaKarakter = $(table).find('td').eq(1).find('h3 a, a').first().text().trim();
            if (!namaKarakter) return; // skip baris yang bukan karakter

            // Peran: Main / Supporting
            const peran = $(table).find('td').eq(1).find('div.spaceit_pad, small').first().text().trim() || 'Unknown';

            // BUG FIX #5: Seiyuu - MAL struktur VA ada di td ke-3 (index 2)
            // Tiap VA punya baris sendiri dalam nested table di dalam td tersebut
            let namaSeiyuu = 'Unknown';
            const tdVA = $(table).find('td').eq(2);

            // Cari VA dengan bahasa Japanese dulu
            tdVA.find('table tr').each((j, trVA) => {
                // Bahasa ada di small atau div terakhir di td ke-2 (index 1)
                const tdVaInfo = $(trVA).find('td').eq(1);
                const bahasaText = tdVaInfo.find('div').last().text().trim() ||
                                   tdVaInfo.find('small').text().trim();

                if (bahasaText.toLowerCase().includes('japanese')) {
                    namaSeiyuu = balikNama(tdVaInfo.find('a').first().text().trim()) || 'Unknown';
                    return false; // break
                }
            });

            // Fallback: kalau ga ada Japanese, ambil VA pertama yang ada
            if (namaSeiyuu === 'Unknown') {
                namaSeiyuu = balikNama(tdVA.find('a').first().text().trim()) || 'Unknown';
            }

            listKarakterLengkap.push({
                nama: namaKarakter,
                peran,
                seiyuu_jepang: namaSeiyuu
            });
        });

        // BUG FIX #6: Opening/Ending - MAL sekarang pakai class 'opnening' (typo dari MAL itu sendiri)
        // tapi ada kemungkinan sudah berubah ke selector lain. Support keduanya.
        let openingThemes = [];
        let endingThemes = [];

        // Coba selector lama dulu (typo 'opnening' memang dari MAL aslinya)
        $('div.opnening, div.theme-songs.opnening').find('span.theme-song, .theme-song').each((i, el) => {
            const lagu = $(el).text().replace(/^\d+:\s*"?|"?\s*$/g, '').trim();
            if (lagu) openingThemes.push(lagu);
        });

        $('div.ending, div.theme-songs.ending').find('span.theme-song, .theme-song').each((i, el) => {
            const lagu = $(el).text().replace(/^\d+:\s*"?|"?\s*$/g, '').trim();
            if (lagu) endingThemes.push(lagu);
        });

        // BUG FIX #7: Fallback selector lagu tema dengan cara lain jika selector di atas kosong
        if (openingThemes.length === 0 && endingThemes.length === 0) {
            $('div.theme-songs').each((i, div) => {
                const header = $(div).find('h2, h3, .theme-songs-header').text().trim().toLowerCase();
                const songs = [];
                $(div).find('span.theme-song, li, .theme-song').each((j, el) => {
                    const lagu = $(el).text().replace(/^\d+:\s*"?|"?\s*$/g, '').trim();
                    if (lagu) songs.push(lagu);
                });
                if (header.includes('opening')) openingThemes = songs;
                else if (header.includes('ending')) endingThemes = songs;
            });
        }

        return {
            id,
            judul_utama: judul,
            judul_alternatif: { inggris: judulInggris, jepang: judulJepang, sinonim: judulSinonim },
            sinopsis,
            skor,
            total_voter: scoredBy,
            cover_hd: coverUrl,
            status_custom: statusCustom,
            trailer_youtube: trailerYoutubeUrl,
            informasi_detail: {
                tipe,
                total_episode: episode,
                status_asli_mal: statusAsli.toUpperCase(),
                tanggal_rilis: tanggalRilis,
                musim_rilis: musimRilis,
                durasi_per_episode: durasi,
                sumber_adaptasi: sumberAdaptasi,
                rating_umur: ratingUmur,
                studio_animasi: studio,
                produser,
                lisensor_resmi: lisensor,
                genre: daftarGenre
            },
            statistik_komunitas: { ranking_global: ranking, popularitas, total_members: totalMembers },
            daftar_karakter_utama_dan_seiyuu: listKarakterLengkap,
            lagu_tema: {
                opening: openingThemes.length > 0 ? openingThemes : 'N/A',
                ending: endingThemes.length > 0 ? endingThemes : 'N/A'
            }
        };
    } catch (kesalahan) {
        throw new Error(`Gagal mengambil data dari MAL: ${kesalahan.message}`);
    }
}

module.exports = async (permintaan, tanggapan) => {
    const { id } = permintaan.query;
    if (!id) return tanggapan.status(400).json({ pesanKesalahan: 'Parameter ID nya mana bro?' });

    try {
        const data = await ambilDataAnimeGodVersionV3(id);
        tanggapan.setHeader('Access-Control-Allow-Origin', '*');
        tanggapan.status(200).json(data);
    } catch (kesalahan) {
        tanggapan.status(500).json({ pesanKesalahan: kesalahan.message });
    }
};
