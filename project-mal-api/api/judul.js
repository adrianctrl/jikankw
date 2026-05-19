const axios = require('axios');
const cheerio = require('cheerio');

async function cariAnimeBerdasarkanJudul(judul) {
    try {
        const konfigurasiReq = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 7000
        };

        const respon = await axios.get(`https://myanimelist.net/anime.php?q=${judul}&cat=anime`, konfigurasiReq);
        const $ = cheerio.load(respon.data);

        const tautanAnimePertama = $('div.title a.hoverinfo_trigger').first().attr('href');
        if (!tautanAnimePertama) {
            throw new Error('Anime kagak ketemu, coba cek ejaannya.');
        }

        const bagianTautan = tautanAnimePertama.split('/');
        const idAnime = bagianTautan[4];

        const responDetail = await axios.get(`https://myanimelist.net/anime/${idAnime}`, konfigurasiReq);
        const $detail = cheerio.load(responDetail.data);

        return {
            id: idAnime,
            judul: $detail('h1.title-name').text().trim(),
            sinopsis: $detail('p[itemprop="description"]').text().trim(),
            skor: $detail('div.score-label').first().text().trim(),
            gambar: $detail('img[itemprop="image"]').attr('data-src') || $detail('img[itemprop="image"]').attr('src')
        };
    } catch (kesalahan) {
        throw new Error('Gagal melacak judul anime tersebut karena diblokir MAL.');
    }
}

module.exports = async (permintaan, tanggapan) => {
    const { q } = permintaan.query;
    if (!q) {
        return tanggapan.status(400).json({ pesanKesalahan: 'Masukan judul anime yang mau dicari!' });
    }

    try {
        const data = await cariAnimeBerdasarkanJudul(q);
        tanggapan.setHeader('Access-Control-Allow-Origin', '*');
        tanggapan.status(200).json(data);
    } catch (kesalahan) {
        tanggapan.status(500).json({ pesanKesalahan: kesalahan.message });
    }
};