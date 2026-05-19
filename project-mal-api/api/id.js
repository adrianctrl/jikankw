const axios = require('axios');
const cheerio = require('cheerio');

async function ambilDataAnime(id) {
    try {
        const respon = await axios.get(`https://myanimelist.net/anime/${id}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 7000
        });
        const $ = cheerio.load(respon.data);

        const judul = $('h1.title-name').text().trim();
        const sinopsis = $('p[itemprop="description"]').text().trim();
        const skor = $('div.score-label').first().text().trim();
        const gambar = $('img[itemprop="image"]').attr('data-src') || $('img[itemprop="image"]').attr('src');

        return { id, judul, sinopsis, skor, gambar };
    } catch (kesalahan) {
        throw new Error('Gagal mengambil data. ID salah atau diblokir MAL.');
    }
}

module.exports = async (permintaan, tanggapan) => {
    const { id } = permintaan.query;
    if (!id) {
        return tanggapan.status(400).json({ pesanKesalahan: 'Parameter ID nya mana bro?' });
    }

    try {
        const data = await ambilDataAnime(id);
        tanggapan.setHeader('Access-Control-Allow-Origin', '*');
        tanggapan.status(200).json(data);
    } catch (kesalahan) {
        tanggapan.status(500).json({ pesanKesalahan: kesalahan.message });
    }
};