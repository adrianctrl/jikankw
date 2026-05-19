const axios = require('axios');
const cheerio = require('cheerio');

async function cariAnimeGodVersion(judul) {
    try {
        const konfigurasiReq = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 15000
        };

        const responCari = await axios.get(`https://myanimelist.net/anime.php?q=${judul}&cat=anime`, konfigurasiReq);
        const $cari = cheerio.load(responCari.data);

        const tautanAnimePertama = $cari('div.title a.hoverinfo_trigger').first().attr('href');
        if (!tautanAnimePertama) throw new Error('Anime kagak ketemu, coba cek ejaannya.');

        const bagianTautan = tautanAnimePertama.split('/');
        const idAnime = bagianTautan[4];

        const responDetail = await axios.get(`https://myanimelist.net/anime/${idAnime}`, konfigurasiReq);
        const $ = cheerio.load(responDetail.data);

        const judulFix = $('h1.title-name').text().trim();
        const sinopsis = $('p[itemprop="description"]').text().trim();
        const skor = $('div.score-label').first().text().trim();
        const coverUrl = $('meta[property="og:image"]').attr('content') || $('img[itemprop="image"]').attr('data-src') || $('img[itemprop="image"]').attr('src');

        let judulInggris = 'N/A', judulJepang = 'N/A', judulSinonim = 'N/A';
        let tipe = 'Unknown', episode = 'Unknown', statusAsli = 'Unknown', tanggalRilis = 'Unknown';
        let musimRilis = 'Unknown', durasi = 'Unknown', ratingUmur = 'Unknown', sumberAdaptasi = 'Unknown';
        let popularitas = 'Unknown', totalMembers = 'Unknown', ranking = 'Unknown', studio = 'None', produser = 'None', lisensor = 'None';
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
            else if (teksElemen.startsWith('Premiered:')) musimRilis = $(elemen).find('a').text().trim() || 'Unknown';
            else if (teksElemen.startsWith('Duration:')) durasi = teksElemen.replace('Duration:', '').trim();
            else if (teksElemen.startsWith('Rating:')) ratingUmur = teksElemen.replace('Rating:', '').trim();
            else if (teksElemen.startsWith('Source:')) sumberAdaptasi = teksElemen.replace('Source:', '').trim();
            else if (teksElemen.startsWith('Popularity:')) popularitas = teksElemen.replace('Popularity:', '').trim();
            else if (teksElemen.startsWith('Members:')) totalMembers = teksElemen.replace('Members:', '').trim();
            else if (teksElemen.startsWith('Ranked:')) ranking = teksElemen.replace('Ranked:', '').trim().split('\n')[0];
            else if (teksElemen.startsWith('Studios:')) studio = $(elemen).find('a').text().trim() || 'None';
            else if (teksElemen.startsWith('Licensors:')) lisensor = $(elemen).find('a').text().trim() || 'None';
            else if (teksElemen.startsWith('Producers:')) {
                const listProd = [];
                $(elemen).find('a').each((j, a) => { listProd.push($(a).text().trim()); });
                produser = listProd.length > 0 ? listProd.join(', ') : 'None';
            } else if (teksElemen.startsWith('Genres:') || teksElemen.startsWith('Genre:')) {
                $(elemen).find('a').each((j, a) => { daftarGenre.push($(a).text().trim()); });
            } else if (teksElemen.includes('scored by')) {
                scoredBy = $(elemen).find('span[itemprop="ratingCount"]').text().trim() || 'Unknown';
            }
        });

        let statusCustom = 'Unknown';
        if (statusAsli.includes('finished airing')) {
            statusCustom = 'Complete';
        } else if (statusAsli.includes('currently airing')) {
            statusCustom = 'Ongoing';
        } else if (statusAsli.includes('not yet aired')) {
            statusCustom = 'Belum Tayang';
        }

        let listKarakterLengkap = [];
        $('div.detail-characters-list').first().find('> table').each((i, table) => {
            if (listKarakterLengkap.length >= 10) return false;
            const namaKarakter = $(table).find('td:nth-child(2) h3.h3_characters_voice_actors a').text().trim();
            const peran = $(table).find('td:nth-child(2) div.spaceit_pad').first().text().trim();
            
            let namaSeiyuu = 'Unknown';
            $(table).find('td:nth-child(3) table tr').each((j, trSeiyuu) => {
                const bahasa = $(trSeiyuu).find('td div.spaceit_pad').last().text().trim();
                if (bahasa === 'Japanese') {
                    namaSeiyuu = $(trSeiyuu).find('td a').first().text().trim();
                    return false;
                }
            });

            if (namaKarakter) {
                listKarakterLengkap.push({ nama: namaKarakter, peran, seiyuu_jepang: namaSeiyuu });
            }
        });

        let openingThemes = [];
        let endingThemes = [];
        $('div.opnening').find('span.theme-song').each((i, el) => { openingThemes.push($(el).text().replace(/^\d+:\s*/, '').trim()); });
        $('div.ending').find('span.theme-song').each((i, el) => { endingThemes.push($(el).text().replace(/^\d+:\s*/, '').trim()); });

        return {
            id: idAnime,
            judul_utama: judulFix,
            judul_alternatif: { inggris: judulInggris, jepang: judulJepang, sinonim: judulSinonim },
            sinopsis,
            skor,
            total_voter: scoredBy,
            cover_hd: coverUrl,
            status_custom: statusCustom,
            informasi_detail: { tipe, total_episode: episode, status_asli_mal: statusAsli.toUpperCase(), tanggal_rilis: tanggalRilis, musim_rilis: musimRilis, durasi_per_episode: durasi, sumber_adaptasi: sumberAdaptasi, rating_umur: ratingUmur, studio_animasi: studio, produser, lisensor_resmi: lisensor, genre: daftarGenre },
            statistik_komunitas: { ranking_global: ranking, popularitas, total_members: totalMembers },
            daftar_karakter_utama_dan_seiyuu: listKarakterLengkap,
            lagu_tema: {
                opening: openingThemes.length > 0 ? openingThemes : "N/A",
                ending: endingThemes.length > 0 ? endingThemes : "N/A"
            }
        };
    } catch (kesalahan) {
        throw new Error('Gagal melacak detail super dewa versi 2 anime lewat judul.');
    }
}

module.exports = async (permintaan, tanggapan) => {
    const { q } = permintaan.query;
    if (!q) return tanggapan.status(400).json({ pesanKesalahan: 'Masukan judul anime yang mau dicari!' });

    try {
        const data = await cariAnimeGodVersion(q);
        tanggapan.setHeader('Access-Control-Allow-Origin', '*');
        tanggapan.status(200).json(data);
    } catch (kesalahan) {
        tanggapan.status(500).json({ pesanKesalahan: kesalahan.message });
    }
};
